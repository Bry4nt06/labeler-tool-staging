"use strict";

(function installAplNeckFinalPostWipeContinuity(global) {
  if (global.LabelerAplNeckFinalPostWipeContinuity?.installed) return;

  const VERSION = 1;
  const EPS = 0.001;
  const RETRY_MS = 25;

  const finite = (value, fallback = NaN) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const text = (value) => String(value ?? "").trim();
  const done = (value) => typeof global.finishAngle === "function"
    ? global.finishAngle(value)
    : Math.round(finite(value, 0) * 10) / 10;

  function isNeck(row) {
    return text(row?.section).toLowerCase() === "neck" || /\bneck\b/i.test(text(row?.action));
  }

  function isWipeTurn2(row) {
    return Number(row?.cmd) === 7
      && isNeck(row)
      && /\bWipe\s+Turn\s+2\b/i.test(text(row?.action));
  }

  function isSensorOrientation(row) {
    const action = text(row?.action);
    return Number(row?.cmd) === 7
      && isNeck(row)
      && /orient/i.test(action)
      && /sensor|inspection/i.test(action);
  }

  function equivalentTarget(target, current, preferredSign) {
    const candidates = [];
    for (let turn = -6; turn <= 6; turn += 1) candidates.push(target + turn * 360);
    const directional = candidates.filter((candidate) => {
      const delta = candidate - current;
      return Math.abs(delta) <= EPS || Math.sign(delta) === preferredSign;
    });
    const pool = directional.length ? directional : candidates;
    return pool.reduce((best, candidate) =>
      Math.abs(candidate - current) < Math.abs(best - current) - EPS ? candidate : best,
    pool[0]);
  }

  function refreshMoveMetrics(rows) {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (Number(row?.cmd) !== 7) continue;
      const next = rows[index + 1];
      const startPlate = finite(row?.plateAngle, NaN);
      const stopPlate = finite(next?.plateAngle, NaN);
      const startTable = finite(row?.tableAngle, NaN);
      const stopTable = finite(next?.tableAngle, NaN);
      if (!Number.isFinite(startPlate) || !Number.isFinite(stopPlate)) continue;
      const rotation = stopPlate - startPlate;
      row.plannedRotation = rotation;
      row.bottleTravel = rotation;
      if (Number.isFinite(startTable) && Number.isFinite(stopTable) && stopTable > startTable + EPS) {
        row.plannedRatio = Math.abs(rotation) / (stopTable - startTable);
      }
    }
  }

  function repair(sourceRows) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    const changes = [];

    for (let index = 0; index < rows.length - 3; index += 1) {
      const wipeTurn = rows[index];
      const wipeReference = rows[index + 1];
      const sensorTurn = rows[index + 2];
      const sensorReference = rows[index + 3];

      if (!isWipeTurn2(wipeTurn)) continue;
      if (Number(wipeReference?.cmd) !== 3 || !isNeck(wipeReference)) continue;
      if (!isSensorOrientation(sensorTurn)) continue;
      if (Number(sensorReference?.cmd) !== 3 || !isNeck(sensorReference)) continue;

      const wipeStart = finite(wipeTurn.plateAngle, NaN);
      const current = finite(wipeReference.plateAngle, NaN);
      const target = finite(sensorReference.plateAngle, NaN);
      if (![wipeStart, current, target].every(Number.isFinite)) continue;

      const wipeRotation = current - wipeStart;
      if (Math.abs(wipeRotation) < 350) continue;
      const preferredSign = Math.sign(wipeRotation);
      if (!preferredSign) continue;

      const originalTravel = target - current;
      const resolvedTarget = equivalentTarget(target, current, preferredSign);
      const resolvedTravel = resolvedTarget - current;
      const offset = resolvedTarget - target;

      if (Math.abs(offset) <= EPS) continue;
      if (Math.sign(resolvedTravel) !== preferredSign) continue;
      if (Math.abs(resolvedTravel) >= Math.abs(originalTravel) - EPS) continue;
      if (Math.abs(offset / 360 - Math.round(offset / 360)) > EPS) continue;

      sensorTurn.plateAngle = done(current);
      sensorTurn.postWipeContinuousOrientation = true;
      sensorTurn.moduloEquivalentOrientation = true;
      sensorTurn.originalOrientationTravel = done(originalTravel);
      sensorTurn.resolvedOrientationTravel = done(resolvedTravel);

      for (let downstream = index + 3; downstream < rows.length; downstream += 1) {
        const row = rows[downstream];
        const plate = finite(row?.plateAngle, NaN);
        if (!Number.isFinite(plate)) continue;
        row.plateAngle = done(plate + offset);
        if (downstream === index + 3) {
          row.postWipeContinuousOrientation = true;
          row.moduloEquivalentOrientation = true;
          row.physicalReferenceAngle = ((target % 360) + 360) % 360;
        }
      }

      changes.push({
        hmi: sensorTurn.hmi,
        station: sensorTurn.station,
        currentPlateAngle: done(current),
        originalTarget: done(target),
        resolvedTarget: done(resolvedTarget),
        originalTravel: done(originalTravel),
        resolvedTravel: done(resolvedTravel),
        offset: done(offset)
      });
    }

    refreshMoveMetrics(rows);
    return {
      rows: rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index })),
      changes
    };
  }

  function publish(result) {
    try {
      if (!global.state?.motionPlan || typeof global.state.motionPlan !== "object") return;
      global.state.motionPlan.neckFinalPostWipeContinuity = {
        version: VERSION,
        applied: result.changes.length > 0,
        changes: result.changes
      };
    } catch { }
  }

  function install() {
    const base = global.generatedServoProfile;
    if (typeof base !== "function") return false;
    if (base.aplNeckFinalPostWipeContinuityV1 === true) return true;

    const wrapped = function generatedServoProfileWithFinalNeckContinuity(...args) {
      const result = repair(base.apply(this, args));
      publish(result);
      return result.rows;
    };
    wrapped.aplNeckFinalPostWipeContinuityV1 = true;
    wrapped.previousGeneratedServoProfile = base;
    global.generatedServoProfile = wrapped;

    global.LabelerAplNeckFinalPostWipeContinuity = Object.freeze({
      installed: true,
      version: VERSION,
      repair
    });

    try {
      global.applyGeneratedServoProfile?.();
      global.renderProgram?.();
      global.renderValidation?.();
    } catch (error) {
      console.error("Unable to apply final neck post-wipe continuity.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
