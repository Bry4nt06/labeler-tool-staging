(function (global) {
  "use strict";

  const INTENTS = Object.freeze({
    HOLD: "HOLD",
    ROTATE: "ROTATE",
    START: "START",
    MAINTAIN: "MAINTAIN",
    CHANGE_SPEED: "CHANGE_SPEED",
    SPECIAL: "SPECIAL",
    STOP: "STOP"
  });

  function number(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function rowMotion(row, nextRow) {
    const start = number(row?.plateAngle);
    const end = number(nextRow?.plateAngle);
    const tableStart = number(row?.tableAngle);
    const tableEnd = number(nextRow?.tableAngle);
    const plateTravel = start !== null && end !== null ? end - start : 0;
    const tableTravel = tableStart !== null && tableEnd !== null ? tableEnd - tableStart : 0;
    return {
      plateTravel,
      tableTravel,
      moving: Math.abs(plateTravel) > 0.001,
      ratio: Math.abs(tableTravel) > 0.001 ? Math.abs(plateTravel / tableTravel) : null
    };
  }

  function intentForRow(row, nextRow, previousStep, options = {}) {
    const motion = rowMotion(row, nextRow);
    const action = String(row?.action || "").toLowerCase();
    const specialRequested = /special|spline|calculated/.test(action) || row?.specialMotion === true;
    const explicitHold = Number(row?.cmd) === 3 || /hold|rest|reference|idle|end curve/.test(action);

    if (!motion.moving) {
      return {
        intent: INTENTS.HOLD,
        reason: explicitHold ? "Existing row is a hold/reference stage." : "No bottle-plate travel occurs in this stage.",
        motion
      };
    }

    if (specialRequested) {
      return {
        intent: INTENTS.SPECIAL,
        reason: "The stage is marked for calculated or spline motion.",
        motion
      };
    }

    const previousWasMoving = Boolean(previousStep?.motion?.moving);
    const nextMotion = rowMotion(nextRow, options.rows?.[options.index + 2]);
    const nextIsMoving = Boolean(nextMotion.moving);
    const currentSpeed = number(row?.absSpeed, number(row?.speed));
    const nextSpeed = number(nextRow?.absSpeed, number(nextRow?.speed));
    const speedChanged = currentSpeed !== null && nextSpeed !== null && Math.abs(nextSpeed - currentSpeed) > 0.25;

    if (!previousWasMoving && nextIsMoving) {
      return { intent: INTENTS.START, reason: "Bottle rotation begins from a stopped/reference stage.", motion };
    }
    if (previousWasMoving && !nextIsMoving) {
      return { intent: INTENTS.STOP, reason: "Bottle rotation ends before the next hold/reference stage.", motion };
    }
    if (previousWasMoving && nextIsMoving && speedChanged) {
      return { intent: INTENTS.CHANGE_SPEED, reason: "Adjacent moving stages require different turn speeds.", motion };
    }
    if (previousWasMoving && nextIsMoving) {
      return { intent: INTENTS.MAINTAIN, reason: "Bottle rotation continues through adjacent stages.", motion };
    }
    return { intent: INTENTS.ROTATE, reason: "Point-to-point bottle rotation is required between stopped positions.", motion };
  }

  function normalizeForProfile(step, profileId) {
    const id = String(profileId || "automatic").toLowerCase();
    if (id === "rest-correction") {
      return step.intent === INTENTS.HOLD ? step : { ...step, originalIntent: step.intent, intent: INTENTS.ROTATE, reason: `${step.reason} Rest / Correction profile converts motion to point-to-point rotation.` };
    }
    if (id === "special-spline" && step.motion.moving) {
      return { ...step, originalIntent: step.intent, intent: INTENTS.SPECIAL, reason: `${step.reason} Special / Spline profile requests calculated motion.` };
    }
    if (id === "continuous-motion") return step;
    return step;
  }

  function buildPlan(rows, options = {}) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const profileId = options.profileId || "automatic";
    const steps = [];
    sourceRows.forEach((row, index) => {
      const raw = intentForRow(row, sourceRows[index + 1], steps[index - 1], { rows: sourceRows, index });
      const normalized = normalizeForProfile(raw, profileId);
      steps.push({
        index,
        hmi: row?.hmi ?? index + 1,
        tableAngle: number(row?.tableAngle),
        plateAngle: number(row?.plateAngle),
        action: String(row?.action || ""),
        ...normalized
      });
    });
    return {
      profileId,
      createdAt: new Date().toISOString(),
      steps,
      summary: steps.reduce((counts, step) => {
        counts[step.intent] = (counts[step.intent] || 0) + 1;
        return counts;
      }, {})
    };
  }

  global.LabelerMotionPlannerDriver = Object.freeze({ INTENTS, rowMotion, intentForRow, buildPlan });
})(window);
