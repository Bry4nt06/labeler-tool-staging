"use strict";

(function installAplNeckWipeOrientationMarriage(global) {
  if (global.LabelerAplNeckWipeOrientationMarriage?.version >= 1) return;

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

  function isOrientationTurn(row) {
    if (Number(row?.cmd) !== 7) return false;
    if (row?.postWipeSensorSetup || row?.orientationConstraintContinuation || row?.mapObjectOrientation) return true;
    return /orient|sensor|inspection|reference/i.test(text(row?.action));
  }

  function sameStation(a, b) {
    const left = finite(a?.station, NaN);
    const right = finite(b?.station, NaN);
    return !Number.isFinite(left) || !Number.isFinite(right) || left === right;
  }

  function equivalentInDirection(target, current, direction) {
    const candidates = [];
    for (let turn = -8; turn <= 8; turn += 1) candidates.push(target + turn * 360);
    return candidates
      .filter((candidate) => {
        const delta = candidate - current;
        return Math.abs(delta) <= EPS || Math.sign(delta) === direction;
      })
      .sort((a, b) => Math.abs(a - current) - Math.abs(b - current))[0];
  }

  function syncPlannerRows(plan, rows) {
    if (!plan || typeof plan !== "object" || !Array.isArray(plan.steps)) return;
    plan.steps = plan.steps.map((step, index) => {
      const row = rows[index];
      if (!row) return step;
      return {
        ...step,
        hmi: row.hmi,
        plc: row.plc,
        tableAngle: row.tableAngle,
        plateAngle: row.plateAngle,
        action: row.action,
        requestedCommand: Number(row.cmd),
        recommendedCommand: Number(row.cmd)
      };
    });
  }

  function refreshMetrics(rows) {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (Number(row?.cmd) !== 7) continue;
      const next = rows[index + 1];
      const startPlate = finite(row?.plateAngle, NaN);
      const stopPlate = finite(next?.plateAngle, NaN);
      const startTable = finite(row?.tableAngle, NaN);
      const stopTable = finite(next?.tableAngle, NaN);
      if (!Number.isFinite(startPlate) || !Number.isFinite(stopPlate)) continue;
      const rotation = done(stopPlate - startPlate);
      row.plannedRotation = rotation;
      row.bottleTravel = rotation;
      if (Number.isFinite(startTable) && Number.isFinite(stopTable) && stopTable > startTable + EPS) {
        row.plannedRatio = Math.abs(rotation) / (stopTable - startTable);
      }
    }
  }

  function marryRows(sourceRows) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    const changes = [];

    for (let index = 0; index < rows.length - 3; index += 1) {
      const wipeTurn = rows[index];
      const wipeEdge = rows[index + 1];
      const orientationTurn = rows[index + 2];
      const orientationReference = rows[index + 3];

      if (!isWipeTurn2(wipeTurn)) continue;
      if (Number(wipeEdge?.cmd) !== 3) continue;
      if (!isOrientationTurn(orientationTurn)) continue;
      if (Number(orientationReference?.cmd) !== 3) continue;
      if (!sameStation(wipeTurn, orientationTurn)) continue;

      const wipeStart = finite(wipeTurn.plateAngle, NaN);
      const edgeAngle = finite(wipeEdge.plateAngle, NaN);
      const targetAngle = finite(orientationReference.plateAngle, NaN);
      if (![wipeStart, edgeAngle, targetAngle].every(Number.isFinite)) continue;

      const wipeTravel = edgeAngle - wipeStart;
      const direction = Math.sign(wipeTravel);
      if (!direction || Math.abs(wipeTravel) < 180) continue;

      const rawOrientationTravel = targetAngle - edgeAngle;
      const continuousTarget = equivalentInDirection(targetAngle, edgeAngle, direction);
      if (!Number.isFinite(continuousTarget)) continue;

      const continuousTravel = continuousTarget - edgeAngle;
      const aliasOffset = continuousTarget - targetAngle;
      if (Math.abs(aliasOffset) <= EPS) continue;
      if (Math.sign(continuousTravel) !== direction) continue;
      if (Math.abs(continuousTravel) > Math.abs(rawOrientationTravel) + EPS) continue;
      if (Math.abs(aliasOffset / 360 - Math.round(aliasOffset / 360)) > EPS) continue;

      orientationTurn.plateAngle = done(edgeAngle);
      orientationTurn.wipeOrientationMarried = true;
      orientationTurn.continuousFromWipeDirection = direction;
      orientationTurn.originalOrientationTravel = done(rawOrientationTravel);
      orientationTurn.resolvedOrientationTravel = done(continuousTravel);
      orientationTurn.moduloEquivalentOrientation = true;

      for (let downstream = index + 3; downstream < rows.length; downstream += 1) {
        const row = rows[downstream];
        const plate = finite(row?.plateAngle, NaN);
        if (!Number.isFinite(plate)) continue;
        row.plateAngle = done(plate + aliasOffset);
        row.moduloRevolutionOffset = done(finite(row?.moduloRevolutionOffset, 0) + aliasOffset);
        if (downstream === index + 3) {
          row.wipeOrientationMarried = true;
          row.moduloEquivalentOrientation = true;
          row.physicalReferenceAngle = done(((targetAngle % 360) + 360) % 360);
        }
      }

      changes.push({
        wipeHmi: wipeTurn.hmi,
        orientationHmi: orientationTurn.hmi,
        station: orientationTurn.station ?? wipeTurn.station,
        wipeTravel: done(wipeTravel),
        edgeAngle: done(edgeAngle),
        originalTarget: done(targetAngle),
        marriedTarget: done(continuousTarget),
        originalOrientationTravel: done(rawOrientationTravel),
        marriedOrientationTravel: done(continuousTravel),
        aliasOffset: done(aliasOffset)
      });
    }

    refreshMetrics(rows);
    return {
      rows: rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index })),
      changes
    };
  }

  function applyMarriageToState() {
    const current = global.state;
    if (!current || !Array.isArray(current.program) || !current.program.length) return false;
    const result = marryRows(current.program);
    if (!result.changes.length) return false;

    current.program = result.rows;
    if (current.motionPlan && typeof current.motionPlan === "object") {
      current.motionPlan.rows = result.rows;
      current.motionPlan.neckWipeOrientationMarriage = {
        version: VERSION,
        applied: true,
        changes: result.changes
      };
      syncPlannerRows(current.motionPlan.planner, result.rows);
    }
    if (current.motionTranslation && typeof current.motionTranslation === "object") {
      current.motionTranslation.rows = result.rows;
      syncPlannerRows(current.motionTranslation.plan, result.rows);
    }
    syncPlannerRows(current.plannerPreview, result.rows);
    return true;
  }

  function install() {
    let base;
    try { base = applyGeneratedServoProfile; }
    catch { base = global.applyGeneratedServoProfile; }
    if (typeof base !== "function") return false;
    if (base.aplNeckWipeOrientationMarriageV1 === true) return true;

    const wrapped = function applyGeneratedServoProfileWithNeckWipeMarriage(...args) {
      const output = base.apply(this, args);
      applyMarriageToState();
      return output;
    };
    wrapped.aplNeckWipeOrientationMarriageV1 = true;
    wrapped.previousApplyGeneratedServoProfile = base;

    try { applyGeneratedServoProfile = wrapped; } catch { }
    global.applyGeneratedServoProfile = wrapped;

    global.LabelerAplNeckWipeOrientationMarriage = Object.freeze({
      installed: true,
      version: VERSION,
      marryRows,
      applyMarriageToState
    });

    try {
      if (applyMarriageToState()) {
        global.renderProgram?.();
        global.renderValidation?.();
        global.renderAnimationFrame?.();
      }
    } catch (error) {
      console.error("Unable to marry neck wipe and orientation direction.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
