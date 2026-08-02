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

  function grammarDriver() {
    return window.LabelerDriverRegistry?.resolve("servo.restCorrectionGrammar")
      || window.LabelerRestCorrectionGrammarDriver
      || null;
  }

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

  function repair(sourceRows) {
    if (!Array.isArray(sourceRows) || sourceRows.length < 2) return sourceRows;
    const driver = grammarDriver();
    if (!driver?.reconcile) return sourceRows;

    const actualIndex = actualCodingHoldIndex(sourceRows);
    const result = driver.reconcile(sourceRows, {
      tolerance: TOLERANCE,
      preserveRestIndexes: actualIndex >= 0 ? [actualIndex] : [],
      shouldRepair: (row, index) => index === actualIndex
        || suspiciousFalseCodingHold(row, actualIndex, index)
    });
    if (!result.repairs.length) return sourceRows;

    const repairsByIndex = new Map(result.repairs.map((entry) => [entry.index, entry]));
    const output = result.rows.map((row, index) => {
      const repair = repairsByIndex.get(index);
      if (!repair) return row;
      const preservingCodingHold = repair.strategy === "preserve-rest-target";
      return {
        ...row,
        coderRestGrammarRepaired: true,
        coderRestGrammarStrategy: repair.strategy,
        rejectedRestPlateTravel: repair.rejectedPlateTravel,
        rejectedFalseCodingHold: !preservingCodingHold,
        codeBoxDirectionCorrected: preservingCodingHold ? row.codeBoxDirectionCorrected : false
      };
    });

    if (state?.motionPlan && typeof state.motionPlan === "object") {
      state.motionPlan.rows = output;
      state.motionPlan.coderRestGrammarRepairs = result.repairs.map((repair) => ({
        hmi: repair.index + 1,
        strategy: repair.strategy,
        rejectedPlateTravel: repair.rejectedPlateTravel,
        restoredPlateAngle: repair.restoredPlateAngle,
        alignedThroughHmi: Number.isInteger(repair.alignedThroughIndex)
          ? repair.alignedThroughIndex + 1
          : undefined
      }));
      state.motionPlan.restCorrectionGrammarDriver = true;
      state.motionPlan.finalPlateAngle = output.at(-1)?.plateAngle;
    }
    return output;
  }

  function install() {
    if (installed) return true;
    if (typeof generatedServoProfile !== "function"
      || typeof state === "undefined"
      || !grammarDriver()?.reconcile) return false;
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
      console.error("Unable to reconcile coder Rest/Correction grammar.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})();
