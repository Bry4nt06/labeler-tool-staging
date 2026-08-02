"use strict";

(function installCoderRestGrammarRepair() {
  const RETRY_MS = 50;
  const TOLERANCE = 0.5;
  let installed = false;

  const num = (value, fallback = NaN) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function codingHoldScore(row) {
    if (Number(row?.cmd) !== 3) return -1;
    const action = String(row?.action || "");
    let score = 0;
    if (row?.codingHold === true) score += 100;
    if (row?.coderAfterWipeHandoff === true && row?.orientationHold === true) score += 90;
    if (row?.codingObjectId && row?.orientationHold === true) score += 80;
    if (/hold.*(?:coding|code box)|(?:coding|code box).*hold|inspection\s*&?\s*coding|coding.*reference/i.test(action)) score += 70;
    return score || -1;
  }

  function actualCodingHoldIndex(rows) {
    const candidates = rows.map((row, index) => ({
      index,
      score: codingHoldScore(row),
      tableAngle: num(row?.tableAngle, -Infinity)
    })).filter((entry) => entry.score > 0);
    candidates.sort((left, right) => right.score - left.score || right.tableAngle - left.tableAngle);
    return candidates[0]?.index ?? -1;
  }

  function suspiciousFalseCodingHold(row, actualIndex, index) {
    if (index === actualIndex || Number(row?.cmd) !== 3) return false;
    return row?.codeBoxDirectionCorrected === true
      || (row?.codingMotion && !row?.codingHold)
      || (row?.codingReadyTableAngle && !row?.codingHold);
  }

  function repairPreviousCorrection(rows, index, restoredPlate) {
    const previous = rows[index - 1];
    if (!previous || Number(previous.cmd) !== 7) return;
    const startPlate = num(previous.plateAngle, NaN);
    const tableTravel = num(rows[index]?.tableAngle, NaN) - num(previous.tableAngle, NaN);
    rows[index - 1] = {
      ...previous,
      plannedRotation: Number.isFinite(startPlate) ? restoredPlate - startPlate : previous.plannedRotation,
      plannedRatio: Number.isFinite(startPlate) && tableTravel > 0.001
        ? Math.abs(restoredPlate - startPlate) / tableTravel
        : previous.plannedRatio,
      coderRestGrammarRepaired: true
    };
  }

  function repair(sourceRows) {
    if (!Array.isArray(sourceRows) || sourceRows.length < 2) return sourceRows;
    const rows = sourceRows.map((row) => ({ ...row }));
    const actualIndex = actualCodingHoldIndex(rows);
    const repairs = [];

    for (let index = rows.length - 2; index >= 0; index -= 1) {
      const row = rows[index];
      const next = rows[index + 1];
      if (!suspiciousFalseCodingHold(row, actualIndex, index)) continue;
      const current = num(row.plateAngle, NaN);
      const nextPlate = num(next?.plateAngle, NaN);
      if (!Number.isFinite(current) || !Number.isFinite(nextPlate)) continue;
      const falseTravel = nextPlate - current;
      if (Math.abs(falseTravel) <= TOLERANCE) continue;

      rows[index] = {
        ...row,
        plateAngle: nextPlate,
        coderRestGrammarRepaired: true,
        rejectedFalseCodingHold: true,
        rejectedRestPlateTravel: falseTravel,
        codeBoxDirectionCorrected: false
      };
      repairPreviousCorrection(rows, index, nextPlate);
      repairs.push({
        hmi: index + 1,
        action: String(row.action || "Rest"),
        rejectedPlateTravel: falseTravel,
        restoredPlateAngle: nextPlate
      });
    }

    if (!repairs.length) return sourceRows;
    const output = rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
    if (state?.motionPlan && typeof state.motionPlan === "object") {
      state.motionPlan.rows = output;
      state.motionPlan.coderRestGrammarRepairs = repairs.reverse();
      state.motionPlan.finalPlateAngle = output.at(-1)?.plateAngle;
    }
    return output;
  }

  function install() {
    if (installed) return true;
    if (typeof generatedServoProfile !== "function" || typeof state === "undefined") return false;
    const base = generatedServoProfile;
    generatedServoProfile = function generatedServoProfileWithCoderRestGrammarRepair(...args) {
      return repair(base.apply(this, args));
    };
    generatedServoProfile.coderRestGrammarRepair = true;
    window.generatedServoProfile = generatedServoProfile;
    installed = true;
    try {
      if (typeof applyGeneratedServoProfile === "function") applyGeneratedServoProfile();
      if (typeof render === "function") render();
    } catch (error) {
      console.error("Unable to repair false coder Rest movements.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})();
