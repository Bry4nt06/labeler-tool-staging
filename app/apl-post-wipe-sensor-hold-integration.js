"use strict";

(function installAplPostWipeSensorHold(global) {
  if (global.LabelerAplPostWipeSensorHold?.installed) return;

  const STAGE_ID = "motion.apl-post-wipe-sensor-hold";
  const ORIENTATION_STAGE_ID = "orientation.map-objects";
  const STAGE_ORDER = 350;
  const HOLD_TRAVEL_DEG = 0.5;
  const MIN_SPACING_DEG = 0.1;
  const EPS = 0.001;
  const RETRY_MS = 50;

  const finite = (value, fallback = NaN) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const text = (value) => String(value ?? "").trim();
  const isCmd7 = (row) => Number(row?.cmd) === 7;
  const isCmd3 = (row) => Number(row?.cmd) === 3;
  const isWipeTurn1 = (row) => isCmd7(row) && /\bWipe\s+Turn\s+1\b/i.test(text(row?.action));
  const isWipeTurn2 = (row) => isCmd7(row) && /\bWipe\s+Turn\s+2\b/i.test(text(row?.action));
  const isWipeHold = (row) => /\bWipe\s+Hold\b/i.test(text(row?.action));
  const isApplicationSetup = (row) => isCmd7(row)
    && (/^Hold\s+for\s+.+Application\b/i.test(text(row?.action)) || row?.applicationReference === true);
  const isSensorHold = (row) => isCmd3(row)
    && Boolean(row?.sensorId || (Array.isArray(row?.sensorIds) && row.sensorIds.length) || row?.orientationHold)
    && /sensor|inspection|orientation/i.test(text(row?.action));

  function done(value) {
    return typeof global.finishAngle === "function"
      ? global.finishAngle(value)
      : Math.round(finite(value, 0) * 10) / 10;
  }

  function sectionName(value) {
    const section = text(value).toLowerCase();
    return section ? `${section.charAt(0).toUpperCase()}${section.slice(1)}` : "Label";
  }

  function holdAngleBetween(start, stop, preferredFromStop = HOLD_TRAVEL_DEG) {
    const left = finite(start, NaN);
    const right = finite(stop, NaN);
    if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left + MIN_SPACING_DEG * 2) return NaN;
    const preferred = right - preferredFromStop;
    if (preferred > left + MIN_SPACING_DEG) return done(preferred);
    return done(left + (right - left) / 2);
  }

  function turnAngleAfterHold(start, stop, preferred = HOLD_TRAVEL_DEG) {
    const left = finite(start, NaN);
    const right = finite(stop, NaN);
    if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left + MIN_SPACING_DEG * 2) return NaN;
    const preferredAngle = left + preferred;
    if (preferredAngle < right - MIN_SPACING_DEG) return done(preferredAngle);
    return done(left + (right - left) / 2);
  }

  function clearOrientationMetadata(row) {
    const output = { ...row };
    [
      "orientationObjectId",
      "orientationObjectIds",
      "sensorId",
      "sensorIds",
      "codingObjectId",
      "codingObjectIds",
      "mapObjectOrientation",
      "mapObjectOrientationContinuation",
      "orientationConstraintPlanner",
      "orientationConstraintMerged",
      "orientationConstraintContinuation",
      "orientationHold",
      "inspectionWindowStart",
      "inspectionWindowStop",
      "autoTargetSource",
      "requiredLabelVisibilityPercent",
      "plannedLabelVisibilityPercent"
    ].forEach((field) => delete output[field]);
    return output;
  }

  function stoppedReference(source, overrides = {}) {
    return {
      ...clearOrientationMetadata(source),
      cmd: 3,
      baseCmd: 3,
      plannerIntent: "HOLD",
      plannerRequestedCommand: 3,
      plannerRecommendedCommand: 3,
      plannerReason: "A stopped reference separates adjacent TopModul correction groups.",
      plannedRotation: 0,
      plannedRatio: 0,
      commandTranslated: false,
      motionProfileApplied: false,
      ...overrides
    };
  }

  function sensorMetadata(source, sensorHold) {
    const output = {};
    [
      "section",
      "station",
      "mapDriven",
      "mapObjectOrientation",
      "orientationConstraintPlanner",
      "orientationConstraintMerged",
      "orientationConstraintContinuation",
      "orientationSections",
      "orientationObjectId",
      "orientationObjectIds",
      "sensorId",
      "sensorIds",
      "autoTargetSource",
      "requiredLabelVisibilityPercent",
      "plannedLabelVisibilityPercent"
    ].forEach((field) => {
      if (source?.[field] !== undefined) output[field] = source[field];
      else if (sensorHold?.[field] !== undefined) output[field] = sensorHold[field];
    });
    return output;
  }

  function sensorTurnAction(row, sensorHold) {
    const holdAction = text(sensorHold?.action);
    const through = holdAction.match(/\bthrough\s+(.+)$/i);
    const subject = through?.[1] || sensorHold?.name || "Label Sensor";
    return `Orient ${sectionName(row?.section || sensorHold?.section)} Label for ${subject}`;
  }

  function maxConsecutiveCorrections(rows) {
    let longest = 0;
    let current = 0;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      current = isCmd7(row) ? current + 1 : 0;
      longest = Math.max(longest, current);
    });
    return longest;
  }

  function repair(sourceRows) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    const changes = [];
    const unresolved = [];

    for (let index = 1; index < rows.length - 2; index += 1) {
      const setup = rows[index - 1];
      const first = rows[index];
      const second = rows[index + 1];
      const postWipe = rows[index + 2];
      const sensorHold = rows[index + 3];

      if (!isApplicationSetup(setup)
        || !isWipeTurn1(first)
        || !isWipeTurn2(second)
        || !isCmd7(postWipe)
        || !(isWipeHold(postWipe) || postWipe?.sensorId || postWipe?.orientationConstraintContinuation)
        || !sensorHold
        || !isSensorHold(sensorHold)) continue;

      const applicationHoldTable = holdAngleBetween(setup.tableAngle, first.tableAngle);
      const sensorTurnTable = turnAngleAfterHold(postWipe.tableAngle, sensorHold.tableAngle);
      if (!Number.isFinite(applicationHoldTable) || !Number.isFinite(sensorTurnTable)) {
        unresolved.push({
          station: second.station,
          section: second.section,
          reason: "insufficient-table-spacing",
          message: `Move the ${sectionName(second.section).toLowerCase()} sensor later so a stopped reference can be inserted after Wipe Turn 2.`
        });
        continue;
      }

      const applicationHold = stoppedReference(first, {
        tableAngle: applicationHoldTable,
        plateAngle: done(first.plateAngle),
        action: `Hold for ${sectionName(first.section)} Application - Agg ${first.station}`,
        stage: "application-hold",
        applicationReference: true,
        postApplicationSetupHold: true
      });

      const wipeHold = stoppedReference(postWipe, {
        tableAngle: done(postWipe.tableAngle),
        plateAngle: done(postWipe.plateAngle),
        action: isWipeHold(postWipe)
          ? postWipe.action
          : `Wipe Hold ${sectionName(second.section)} - Agg ${second.station}`,
        stage: "complete",
        wipeSensorSetupHold: true,
        sensorSetupBoundary: true
      });

      const rotation = finite(sensorHold.plateAngle, finite(postWipe.plateAngle, 0))
        - finite(postWipe.plateAngle, 0);
      const tableTravel = finite(sensorHold.tableAngle, sensorTurnTable) - sensorTurnTable;
      const sensorTurn = {
        ...postWipe,
        ...sensorMetadata(postWipe, sensorHold),
        cmd: 7,
        baseCmd: 7,
        tableAngle: sensorTurnTable,
        plateAngle: done(postWipe.plateAngle),
        action: sensorTurnAction(postWipe, sensorHold),
        stage: "sensor-setup",
        plannerIntent: "ROTATE",
        plannerRequestedCommand: 7,
        plannerRecommendedCommand: 7,
        plannerReason: "Begin sensor orientation only after the post-wipe stopped reference.",
        plannedRotation: rotation,
        plannedRatio: Math.abs(rotation) / Math.max(EPS, tableTravel),
        orientationConstraintContinuation: true,
        postWipeSensorSetup: true,
        sensorSetupAfterHold: true,
        wipeSensorSetupHoldTableAngle: done(postWipe.tableAngle),
        commandTranslated: false,
        motionProfileApplied: false
      };

      rows.splice(index, 0, applicationHold);
      rows.splice(index + 3, 1, wipeHold, sensorTurn);
      changes.push({
        station: second.station,
        section: second.section,
        applicationHoldTableAngle: applicationHold.tableAngle,
        wipeHoldTableAngle: wipeHold.tableAngle,
        sensorTurnTableAngle: sensorTurn.tableAngle,
        sensorId: sensorTurn.sensorId || sensorHold.sensorId
      });
      index += 4;
    }

    const numbered = rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
    return {
      rows: numbered,
      changes,
      unresolved,
      maxConsecutiveCorrections: maxConsecutiveCorrections(numbered)
    };
  }

  function process(rows) {
    const result = repair(rows);
    if (global.state?.motionPlan && typeof global.state.motionPlan === "object") {
      global.state.motionPlan.aplPostWipeSensorHold = {
        applied: result.changes.length > 0,
        changes: result.changes,
        unresolved: result.unresolved,
        maxConsecutiveCorrections: result.maxConsecutiveCorrections
      };
    }
    return result.rows;
  }

  function pipeline() {
    return global.LabelerDriverRegistry?.resolve?.("profile.pipeline")
      || global.LabelerProfilePipelineDriver
      || null;
  }

  function install() {
    const profilePipeline = pipeline();
    if (!profilePipeline?.registerStage || !profilePipeline.getStage?.(ORIENTATION_STAGE_ID)) return false;
    if (!profilePipeline.getStage(STAGE_ID)) {
      profilePipeline.registerStage({
        id: STAGE_ID,
        phase: "motion",
        order: STAGE_ORDER,
        source: "app/apl-post-wipe-sensor-hold-integration.js",
        description: "Insert stopped references before the two-step back wipe and before the following sensor setup turn.",
        process
      });
    }

    global.LabelerAplPostWipeSensorHold = Object.freeze({
      installed: true,
      stageId: STAGE_ID,
      order: STAGE_ORDER,
      holdTravelDeg: HOLD_TRAVEL_DEG,
      isApplicationSetup,
      isWipeTurn1,
      isWipeTurn2,
      isWipeHold,
      isSensorHold,
      holdAngleBetween,
      turnAngleAfterHold,
      maxConsecutiveCorrections,
      repair,
      process
    });

    try {
      global.applyGeneratedServoProfile?.();
      global.renderProgram?.();
      global.renderValidation?.();
    } catch (error) {
      console.error("Unable to apply the post-wipe sensor hold policy.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
