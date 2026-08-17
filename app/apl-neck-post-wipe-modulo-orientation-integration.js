"use strict";

(function installAplNeckPostWipeModuloOrientation(global) {
  if (global.LabelerAplNeckPostWipeModuloOrientationIntegration?.installed) return;

  const RETRY_MS = 25;
  const EPS = 0.001;

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalize360(value) {
    return ((finite(value, 0) % 360) + 360) % 360;
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

  function eligibleNeckPadStations(machineMap) {
    const sections = stationSections(machineMap);
    const stations = new Set();
    (machineMap?.objects || []).forEach((item) => {
      if (item?.application === "cold-glue" || item?.kind !== "pad") return;
      const station = Number(item.station);
      if (!Number.isFinite(station)) return;
      const section = sections[String(station)]
        || (typeof labelSectionForStation === "function" ? labelSectionForStation(station) : "");
      if (section === "neck") stations.add(station);
    });
    return stations;
  }

  function activeLongCenterTackNeck() {
    try {
      const wipe = typeof sectionWipePlan === "function" ? sectionWipePlan("neck") : null;
      return Boolean(wipe?.mode === "center-tack-two-stage" && finite(wipe?.labelDeg, 0) > 360);
    } catch {
      return false;
    }
  }

  function previousMotionSign(rows, beforeIndex, station) {
    for (let index = beforeIndex; index > 0; index -= 1) {
      const current = rows[index];
      const previous = rows[index - 1];
      if (Number(current?.station) !== station && Number(previous?.station) !== station) continue;
      const delta = finite(current?.plateAngle, NaN) - finite(previous?.plateAngle, NaN);
      if (Number.isFinite(delta) && Math.abs(delta) > EPS) return Math.sign(delta);
    }
    return 0;
  }

  function equivalentTarget(target, current, preferredSign) {
    const candidates = [];
    for (let turn = -6; turn <= 6; turn += 1) candidates.push(target + turn * 360);

    const directional = preferredSign
      ? candidates.filter((candidate) => {
        const delta = candidate - current;
        return Math.abs(delta) <= EPS || Math.sign(delta) === preferredSign;
      })
      : candidates;
    const pool = directional.length ? directional : candidates;

    return pool.reduce((best, candidate) => {
      const travel = Math.abs(candidate - current);
      const bestTravel = Math.abs(best - current);
      return travel < bestTravel - EPS ? candidate : best;
    }, pool[0]);
  }

  function isNeckSensorOrientation(row) {
    const action = String(row?.action || "").toLowerCase();
    return action.includes("orient") && action.includes("neck") && action.includes("sensor");
  }

  function rewritePostWipeOrientation(rows, eligibleStations) {
    const rewritten = rows.map((row) => ({ ...row }));
    let changed = false;

    for (let index = 0; index < rewritten.length - 1; index += 1) {
      const start = rewritten[index];
      const end = rewritten[index + 1];
      const station = Number(start?.station);
      if (!eligibleStations.has(station)) continue;
      if (Number(start?.cmd) !== 7 || Number(end?.cmd) !== 3) continue;
      if (start?.section !== "neck" || end?.section !== "neck") continue;
      if (!isNeckSensorOrientation(start)) continue;

      const current = finite(start.plateAngle, NaN);
      const target = finite(end.plateAngle, NaN);
      if (!Number.isFinite(current) || !Number.isFinite(target)) continue;

      const preferredSign = previousMotionSign(rewritten, index - 1, station);
      if (!preferredSign) continue;

      const resolved = equivalentTarget(target, current, preferredSign);
      const originalTravel = target - current;
      const resolvedTravel = resolved - current;
      const offset = resolved - target;
      if (Math.abs(offset) <= EPS || Math.abs(resolvedTravel) <= EPS) continue;
      if (Math.sign(resolvedTravel) !== preferredSign) continue;
      if (Math.abs(resolvedTravel) >= Math.abs(originalTravel) - EPS) continue;
      if (Math.abs(offset % 360) > EPS) continue;

      const physicalReference = normalize360(target);
      rewritten[index] = {
        ...start,
        moduloEquivalentOrientation: true,
        physicalReferenceAngle: physicalReference,
        preferredRotationSign: preferredSign,
        postWipeContinuousOrientation: true,
        originalOrientationTravel: originalTravel,
        resolvedOrientationTravel: resolvedTravel
      };

      // Carry the full-turn alias forward. -360 deg and 0 deg are the same
      // physical bottle orientation, but keeping the unwrapped offset prevents
      // a false +360 deg jump on the next HMI row.
      for (let downstream = index + 1; downstream < rewritten.length; downstream += 1) {
        const row = rewritten[downstream];
        if (!Number.isFinite(Number(row?.plateAngle))) continue;
        rewritten[downstream] = {
          ...row,
          plateAngle: finite(row.plateAngle, 0) + offset,
          moduloEquivalentOrientation: downstream === index + 1 ? true : row.moduloEquivalentOrientation,
          physicalReferenceAngle: downstream === index + 1 ? physicalReference : row.physicalReferenceAngle,
          postWipeContinuousOrientation: downstream === index + 1 ? true : row.postWipeContinuousOrientation
        };
      }

      changed = true;
      // One full-turn alias shift is enough for this generated profile. Any
      // later movements retain their original deltas because all downstream
      // plate references received the same offset.
      break;
    }

    return { rows: rewritten, changed };
  }

  function install() {
    const original = global.generatedAplMapDrivenProfile;
    if (typeof original !== "function") return false;
    if (original.aplNeckPostWipeModuloOrientationV2) return true;

    const wrapped = function generatedAplMapDrivenProfileWithModuloOrientation(machineMap, ...args) {
      const result = original.call(this, machineMap, ...args);
      if (!activeLongCenterTackNeck() || !Array.isArray(result)) return result;

      const eligibleStations = eligibleNeckPadStations(machineMap);
      if (!eligibleStations.size) return result;

      const rewritten = rewritePostWipeOrientation(result, eligibleStations);
      if (!rewritten.changed) return result;

      try {
        if (typeof state !== "undefined" && state.motionPlan) {
          state.motionPlan.rows = rewritten.rows;
          state.motionPlan.neckPostWipeModuloOrientation = true;
          state.motionPlan.profileVariant = `${state.motionPlan.profileVariant || "apl"}+neck-post-wipe-modulo-v2`;
        }
      } catch (error) {
        console.warn("Unable to annotate neck post-wipe modulo orientation.", error);
      }

      return rewritten.rows;
    };

    wrapped.aplNeckPostWipeModuloOrientationV2 = true;
    wrapped.previousGenerator = original;
    global.generatedAplMapDrivenProfile = wrapped;
    global.LabelerAplMapProfileGenerator = Object.freeze({
      ...(global.LabelerAplMapProfileGenerator || {}),
      generate: wrapped
    });
    global.LabelerAplNeckPostWipeModuloOrientationIntegration = Object.freeze({
      installed: true,
      version: 2,
      refresh: install
    });
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
