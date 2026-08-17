"use strict";

(function installAplNeckTopModulWipeReference(global) {
  if (global.LabelerAplNeckTopModulWipeReference?.installed) return;

  const RETRY_MS = 25;
  const EPS = 0.001;

  const finite = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const positive = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  function enabledStation(machineMap, station) {
    try { return typeof isStationEnabled !== "function" || isStationEnabled(machineMap, station); }
    catch { return true; }
  }

  function normalizedObject(item) {
    try { return typeof normalizeBuilderObject === "function" ? normalizeBuilderObject(item, "apl", 6) : item; }
    catch { return item; }
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

  function longNeckPadCallQueue(machineMap) {
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
        return preferredKind === "pad" ? [{ station, kind: "pad" }] : [];
      });
  }

  function topModulCenterTackPlan(options, labelDeg) {
    const outsideSpan = Math.max(0, finite(options?.outsideSpan, 0));
    const insideSpan = Math.max(0, finite(options?.insideSpan, 0));
    const maxRatio = positive(options?.maxRatio, 21);
    const safetyFactor = Math.min(0.98, Math.max(0.25, finite(options?.safetyFactor, 0.9)));
    const safeRatio = maxRatio * safetyFactor;

    // Known working TopModul center-tack behavior:
    //   Turn 1: center tack -> first developed-label edge.
    //   Turn 2: reverse from that edge -> through center -> configured over-wipe.
    // The second turn is NOT a second full developed-label revolution.
    const halfLabel = Math.max(0, labelDeg / 2);
    const legacyPreferred = positive(options?.preferredOutside, halfLabel);
    const overWipeDeg = Math.max(0, legacyPreferred - halfLabel);
    const outsideRotation = halfLabel;
    const insideRotation = halfLabel + overWipeDeg;
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
      overWipeDeg,
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
      topModulCenterTackReturn: true,
      outsideShortfall,
      insideShortfall
    };
  }

  function activeCenterTackNeckWipe() {
    try { return typeof sectionWipePlan === "function" ? sectionWipePlan("neck") : null; }
    catch { return null; }
  }

  function restorePreEdgeLockGenerator() {
    let base = global.generatedAplMapDrivenProfile;
    if (base?.aplNeckPadCenterTackEdgeLockV1 && typeof base.previousGenerator === "function") {
      base = base.previousGenerator;
      global.generatedAplMapDrivenProfile = base;
      global.LabelerAplMapProfileGenerator = Object.freeze({
        ...(global.LabelerAplMapProfileGenerator || {}),
        generate: base
      });
    }
    return base;
  }

  function install() {
    const original = restorePreEdgeLockGenerator();
    const geometry = global.LabelerGeometryDriver;
    if (typeof original !== "function" || typeof geometry?.planTwoSurfaceWipe !== "function") return false;
    if (original.aplNeckPadTopModulReferenceV1) return true;

    const wrapped = function generatedAplMapDrivenProfileWithTopModulNeckWipe(machineMap, ...args) {
      const wipe = activeCenterTackNeckWipe();
      const labelDeg = finite(wipe?.labelDeg, NaN);
      const centerTack = wipe?.mode === "center-tack-two-stage";
      const callQueue = centerTack && Number.isFinite(labelDeg) && labelDeg > 360
        ? longNeckPadCallQueue(machineMap)
        : [];

      if (!callQueue.length) return original.call(this, machineMap, ...args);

      const basePlanner = geometry.planTwoSurfaceWipe;
      let callIndex = 0;
      const stations = new Set(callQueue.map((entry) => entry.station));

      geometry.planTwoSurfaceWipe = function planTwoSurfaceWipeWithTopModulReference(options) {
        const plannedLabelDeg = finite(options?.labelDeg, NaN);
        const isCurrentLongNeck = Number.isFinite(plannedLabelDeg)
          && plannedLabelDeg > 360
          && Math.abs(plannedLabelDeg - labelDeg) <= 0.05;
        if (!isCurrentLongNeck) return basePlanner.call(this, options);

        const expected = callQueue[callIndex++];
        if (expected?.kind !== "pad") return basePlanner.call(this, options);
        return topModulCenterTackPlan(options, plannedLabelDeg);
      };

      let rows;
      try {
        rows = original.call(this, machineMap, ...args);
      } finally {
        geometry.planTwoSurfaceWipe = basePlanner;
      }

      rows = (Array.isArray(rows) ? rows : []).map((row) => {
        if (Number(row?.cmd) !== 7 || !/Wipe\s+Turn\s+2\s+Neck/i.test(String(row?.action || ""))) return row;
        if (Number.isFinite(Number(row?.station)) && !stations.has(Number(row.station))) return row;
        return { ...row, topModulCenterTackReturn: true };
      });

      try {
        if (typeof state !== "undefined" && state.motionPlan) {
          state.motionPlan.neckPadCenterTackEdgeLock = false;
          state.motionPlan.neckPadTopModulReference = true;
          state.motionPlan.profileVariant = "apl-neck-pad-topmodul-reference-v1";
        }
      } catch { }

      return rows;
    };

    wrapped.aplNeckPadTopModulReferenceV1 = true;
    wrapped.previousGenerator = original;
    global.generatedAplMapDrivenProfile = wrapped;
    global.LabelerAplMapProfileGenerator = Object.freeze({
      ...(global.LabelerAplMapProfileGenerator || {}),
      generate: wrapped
    });
    global.LabelerAplNeckTopModulWipeReference = Object.freeze({
      installed: true,
      version: 1,
      topModulCenterTackPlan,
      refresh: install
    });
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
