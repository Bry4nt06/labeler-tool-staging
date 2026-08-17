"use strict";

(function installAplNeckPadEdgeLock(global) {
  if (global.LabelerAplNeckPadEdgeLockIntegration?.installed) return;

  const RETRY_MS = 25;
  const EPS = 0.001;

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function positive(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function enabledStation(machineMap, station) {
    try {
      return typeof isStationEnabled !== "function" || isStationEnabled(machineMap, station);
    } catch {
      return true;
    }
  }

  function normalizedObject(item) {
    try {
      return typeof normalizeBuilderObject === "function"
        ? normalizeBuilderObject(item, "apl", 6)
        : item;
    } catch {
      return item;
    }
  }

  function stationSections(machineMap) {
    try {
      return typeof inferAplStationSections === "function"
        ? inferAplStationSections(machineMap)
        : { ...(machineMap?.stationSections || {}) };
    } catch {
      return { ...(machineMap?.stationSections || {}) };
    }
  }

  function neckLongPlanCallQueue(machineMap) {
    const sections = stationSections(machineMap);
    const groups = new Map();

    (machineMap?.objects || [])
      .filter((item) => item?.application !== "cold-glue")
      .filter((item) => item?.kind === "pad" || item?.kind === "roller")
      .filter((item) => enabledStation(machineMap, Number(item.station)))
      .map(normalizedObject)
      .forEach((item) => {
        const station = Number(item?.station);
        if (!Number.isFinite(station)) return;
        if (!groups.has(station)) groups.set(station, []);
        groups.get(station).push(item);
      });

    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .flatMap(([station, objects]) => {
        const section = sections[String(station)]
          || (typeof labelSectionForStation === "function" ? labelSectionForStation(station) : "");
        if (section !== "neck") return [];

        const preferredKind = objects.some((item) => item.kind === "pad") ? "pad" : "roller";
        const preferred = objects.filter((item) => item.kind === preferredKind);
        if (!preferred.length) return [];

        if (preferredKind === "pad") return [{ station, kind: "pad" }];

        const hasOutside = preferred.some((item) => item.side !== "inner");
        const hasInside = preferred.some((item) => item.side === "inner");
        return hasOutside && hasInside ? [{ station, kind: "roller" }] : [];
      });
  }

  function hardEdgePlan(options, labelDeg) {
    const outsideSpan = Math.max(0, finite(options?.outsideSpan, 0));
    const insideSpan = Math.max(0, finite(options?.insideSpan, 0));
    const maxRatio = positive(options?.maxRatio, 21);
    const safetyFactor = Math.min(0.98, Math.max(0.25, finite(options?.safetyFactor, 0.9)));
    const safeRatio = maxRatio * safetyFactor;

    // Center-tack pad mechanics have fixed physical endpoints:
    //   Turn 1: center tack -> first developed-label edge.
    //   Turn 2: reverse from that edge, through center, -> opposite edge.
    // Never extend Turn 1 to compensate for insufficient Turn 2 pad capacity.
    const outsideRotation = Math.max(0, labelDeg / 2);
    const insideRotation = Math.max(0, labelDeg);
    const totalRequired = outsideRotation + insideRotation;
    const outsideCapacity = outsideSpan * safeRatio;
    const insideCapacity = insideSpan * safeRatio;
    const outsideShortfall = Math.max(0, outsideRotation - outsideCapacity);
    const insideShortfall = Math.max(0, insideRotation - insideCapacity);
    const shortfall = outsideShortfall + insideShortfall;

    return {
      longWrap: labelDeg > 360,
      labelDeg,
      totalRequired,
      preferredOutside: outsideRotation,
      outsideRotation,
      insideRotation,
      outsideSpan,
      insideSpan,
      outsideCapacity,
      insideCapacity,
      outsideRequiredTableSpan: outsideRotation / Math.max(EPS, safeRatio),
      insideRequiredTableSpan: insideRotation / Math.max(EPS, safeRatio),
      safeRatio,
      shortfall,
      fits: shortfall <= EPS,
      centerTackEdgeLocked: true,
      outsideShortfall,
      insideShortfall
    };
  }

  function activeCenterTackNeckWipe() {
    try {
      return typeof sectionWipePlan === "function" ? sectionWipePlan("neck") : null;
    } catch {
      return null;
    }
  }

  function install() {
    const original = global.generatedAplMapDrivenProfile;
    const geometry = global.LabelerGeometryDriver;
    if (typeof original !== "function" || typeof geometry?.planTwoSurfaceWipe !== "function") return false;
    if (original.aplNeckPadCenterTackEdgeLockV1) return true;

    const wrapped = function generatedAplMapDrivenProfileWithNeckPadEdgeLock(machineMap, ...args) {
      const wipe = activeCenterTackNeckWipe();
      const labelDeg = finite(wipe?.labelDeg, NaN);
      const centerTack = wipe?.mode === "center-tack-two-stage";
      const callQueue = centerTack && Number.isFinite(labelDeg) && labelDeg > 360
        ? neckLongPlanCallQueue(machineMap)
        : [];

      if (!callQueue.some((entry) => entry.kind === "pad")) {
        return original.call(this, machineMap, ...args);
      }

      const basePlanner = geometry.planTwoSurfaceWipe;
      let longNeckCallIndex = 0;
      const lockedStations = new Set(callQueue.filter((entry) => entry.kind === "pad").map((entry) => entry.station));

      geometry.planTwoSurfaceWipe = function planTwoSurfaceWipeWithNeckPadEdgeLock(options) {
        const plannedLabelDeg = finite(options?.labelDeg, NaN);
        const isCurrentLongNeck = Number.isFinite(plannedLabelDeg)
          && plannedLabelDeg > 360
          && Math.abs(plannedLabelDeg - labelDeg) <= 0.05;
        if (!isCurrentLongNeck) return basePlanner.call(this, options);

        const expected = callQueue[longNeckCallIndex++];
        if (expected?.kind !== "pad") return basePlanner.call(this, options);
        return hardEdgePlan(options, plannedLabelDeg);
      };

      let rows;
      try {
        rows = original.call(this, machineMap, ...args);
      } finally {
        geometry.planTwoSurfaceWipe = basePlanner;
      }

      try {
        if (typeof state !== "undefined" && state.motionPlan && lockedStations.size) {
          state.motionPlan.neckPadCenterTackEdgeLock = true;
          state.motionPlan.profileVariant = "apl-neck-pad-center-tack-edge-lock-v1";
          state.motionPlan.stationPlans = (Array.isArray(state.motionPlan.stationPlans) ? state.motionPlan.stationPlans : []).map((plan) => {
            if (plan?.section !== "neck" || !lockedStations.has(Number(plan.station))) return plan;
            const movePath = Array.isArray(plan.movePath) ? plan.movePath : [];
            return {
              ...plan,
              requiredRotation: movePath.reduce((total, move) => total + Math.abs(finite(move, 0)), 0),
              neckPadCenterTackEdgeLock: true,
              developedLabelDeg: labelDeg,
              firstEdgeRotationDeg: labelDeg / 2,
              reverseToOppositeEdgeDeg: labelDeg
            };
          });
        }
      } catch (error) {
        console.warn("Unable to annotate the center-tack neck pad edge-lock plan.", error);
      }

      return rows;
    };

    wrapped.aplNeckPadCenterTackEdgeLockV1 = true;
    wrapped.previousGenerator = original;
    global.generatedAplMapDrivenProfile = wrapped;
    global.LabelerAplMapProfileGenerator = Object.freeze({
      ...(global.LabelerAplMapProfileGenerator || {}),
      generate: wrapped
    });
    global.LabelerAplNeckPadEdgeLockIntegration = Object.freeze({
      installed: true,
      version: 1,
      refresh: install
    });
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
