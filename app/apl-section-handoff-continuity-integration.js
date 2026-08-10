"use strict";

(function installAplSectionHandoffContinuity(global) {
  if (global.LabelerAplSectionHandoffContinuity?.installed) return;

  const VERSION = 1;
  const EPS = 0.001;
  const RETRY_MS = 25;
  let installed = false;

  const finite = (value, fallback = NaN) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const done = (value) => typeof global.finishAngle === "function"
    ? global.finishAngle(value)
    : Math.round(finite(value, 0) * 10) / 10;

  function runtimeState() {
    try {
      if (typeof state !== "undefined" && state) return state;
    } catch {
      // Fall back to a Window property only when the lexical binding is unavailable.
    }
    return global.state || null;
  }

  function isSectionHandoffTurn(row) {
    if (Number(row?.cmd) !== 7) return false;
    if (row?.applicationTransition === true || row?.wipeResetTransition === true) return true;
    const action = String(row?.action || "");
    return /^Orient\s+(?:Neck|Body|Back)\s+(?:to\s+Tack\s+Reference|for\s+Re-Wipe)/i.test(action);
  }

  function repair(sourceRows) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    const changes = [];

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const previous = rows[index - 1];
      if (!isSectionHandoffTurn(row) || Number(previous?.cmd) !== 3) continue;

      const previousPlate = finite(previous?.plateAngle, NaN);
      const currentPlate = finite(row?.plateAngle, NaN);
      if (!Number.isFinite(previousPlate) || !Number.isFinite(currentPlate)) continue;

      const correctedStart = done(previousPlate);
      if (Math.abs(currentPlate - correctedStart) <= EPS) continue;

      row.plateAngle = correctedStart;
      row.sectionHandoffContinuityV56 = true;
      row.continuitySourceHmi = previous.hmi ?? index;

      const next = rows[index + 1];
      const targetPlate = finite(next?.plateAngle, NaN);
      const tableStart = finite(row?.tableAngle, NaN);
      const tableStop = finite(next?.tableAngle, NaN);
      if (Number.isFinite(targetPlate)) row.plannedRotation = targetPlate - correctedStart;
      if (Number.isFinite(targetPlate)
        && Number.isFinite(tableStart)
        && Number.isFinite(tableStop)
        && tableStop > tableStart + EPS) {
        row.plannedRatio = Math.abs(targetPlate - correctedStart) / (tableStop - tableStart);
      }

      changes.push({
        hmi: row.hmi ?? index + 1,
        action: String(row.action || ""),
        previousPlateAngle: done(currentPlate),
        correctedPlateAngle: correctedStart,
        sourceRestHmi: previous.hmi ?? index
      });
    }

    return {
      rows: rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index })),
      changes
    };
  }

  function synchronize(result) {
    const current = runtimeState();
    if (!current || !Array.isArray(result?.rows)) return result?.rows || [];
    current.program = result.rows;
    current.motionPlan = current.motionPlan && typeof current.motionPlan === "object"
      ? current.motionPlan
      : {};
    current.motionPlan.rows = result.rows;
    current.motionPlan.aplSectionHandoffContinuity = {
      version: VERSION,
      applied: result.changes.length > 0,
      changes: result.changes
    };
    return result.rows;
  }

  function install() {
    if (installed) return true;
    const current = runtimeState();
    if (!current || typeof global.applyGeneratedServoProfile !== "function") return false;

    const base = global.applyGeneratedServoProfile;
    if (base.aplSectionHandoffContinuityV56 === true) {
      installed = true;
      return true;
    }

    const wrapped = function applyGeneratedServoProfileWithSectionHandoffContinuity(...args) {
      const output = base.apply(this, args);
      const source = Array.isArray(current.program) && current.program.length
        ? current.program
        : output;
      return synchronize(repair(source));
    };
    wrapped.aplSectionHandoffContinuityV56 = true;
    wrapped.previousApplyGeneratedServoProfile = base;
    global.applyGeneratedServoProfile = wrapped;

    global.LabelerAplSectionHandoffContinuity = Object.freeze({
      installed: true,
      version: VERSION,
      isSectionHandoffTurn,
      repair
    });
    installed = true;

    try {
      global.applyGeneratedServoProfile();
      global.renderProgram?.();
      global.renderValidation?.();
    } catch (error) {
      console.error("Unable to apply APL section handoff continuity.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
