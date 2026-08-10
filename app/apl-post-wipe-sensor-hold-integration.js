"use strict";

(function installAplPostWipeSensorHold(global) {
  if (global.LabelerAplPostWipeSensorHold?.version >= 3) return;

  const STAGE_ID = "motion.apl-post-wipe-sensor-hold";
  const ORIENTATION_STAGE_ID = "orientation.map-objects";
  const STAGE_ORDER = 350;
  const HOLD_TRAVEL_DEG = 0.5;
  const MIN_SPACING_DEG = 0.1;
  const EPS = 0.001;
  const TARGET_TOLERANCE_DEG = 0.05;
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
  const isMovingWipeHold = (row) => isCmd7(row) && /\bWipe\s+Hold\b/i.test(text(row?.action));
  const isStoppedWipeHold = (row) => isCmd3(row) && /\bWipe\s+Hold\b/i.test(text(row?.action));
  const isSensorTurn = (row) => isCmd7(row)
    && Boolean(
      row?.sensorId
      || (Array.isArray(row?.sensorIds) && row.sensorIds.length)
      || /orient.*(?:sensor|inspection)|(?:sensor|inspection).*orient/i.test(text(row?.action))
    );
  const isSensorHold = (row) => isCmd3(row)
    && Boolean(
      row?.sensorId
      || (Array.isArray(row?.sensorIds) && row.sensorIds.length)
      || row?.orientationHold
      || /sensor|inspection|orientation/i.test(text(row?.action))
    );

  function done(value) {
    return typeof global.finishAngle === "function"
      ? global.finishAngle(value)
      : Math.round(finite(value, 0) * 10) / 10;
  }

  function sectionName(value) {
    const section = text(value).toLowerCase();
    return section ? `${section.charAt(0).toUpperCase()}${section.slice(1)}` : "Label";
  }

  function sensorTurnStart(holdTable, sensorTable, preferred = HOLD_TRAVEL_DEG) {
    const start = finite(holdTable, NaN);
    const stop = finite(sensorTable, NaN);
    if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start + MIN_SPACING_DEG * 2) return NaN;
    const requested = start + preferred;
    if (requested < stop - MIN_SPACING_DEG) return done(requested);
    return done(start + (stop - start) / 2);
  }

  function clearOrientationMetadata(row) {
    const output = { ...row };
    [
      "orientationObjectId",
      "orientationObjectIds",
      "sensorId",
      "sensorIds",
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

  function stoppedWipeReference(source) {
    return {
      ...clearOrientationMetadata(source),
      cmd: 3,
      baseCmd: 3,
      plateAngle: done(source?.plateAngle),
      plannerIntent: "HOLD",
      plannerRequestedCommand: 3,
      plannerRecommendedCommand: 3,
      plannerReason: "A stopped reference closes the two-command wipe pair before sensor setup.",
      plannedRotation: 0,
      plannedRatio: 0,
      stage: "complete",
      wipeSensorSetupHold: true,
      sensorSetupBoundary: true,
      commandTranslated: false,
      motionProfileApplied: false
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
    const subject = through?.[1] || "Label Sensor";
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

  function sameWipePair(first, second) {
    const firstStation = finite(first?.station, NaN);
    const secondStation = finite(second?.station, NaN);
    const firstSection = text(first?.section).toLowerCase();
    const secondSection = text(second?.section).toLowerCase();
    return (!Number.isFinite(firstStation) || !Number.isFinite(secondStation) || firstStation === secondStation)
      && (!firstSection || !secondSection || firstSection === secondSection);
  }

  function activeMap() {
    try {
      if (typeof global.activeMachineMap === "function") return global.activeMachineMap();
      if (typeof activeMachineMap === "function") return activeMachineMap();
    } catch {
      return null;
    }
    return null;
  }

  function sensorIds(row) {
    const ids = [];
    if (row?.sensorId) ids.push(String(row.sensorId));
    if (Array.isArray(row?.sensorIds)) row.sensorIds.forEach((id) => { if (id) ids.push(String(id)); });
    if (row?.orientationObjectId) ids.push(String(row.orientationObjectId));
    if (Array.isArray(row?.orientationObjectIds)) row.orientationObjectIds.forEach((id) => { if (id) ids.push(String(id)); });
    return [...new Set(ids)];
  }

  function matchingSensor(turn, reference) {
    const map = activeMap();
    const objects = Array.isArray(map?.objects) ? map.objects : [];
    const ids = new Set([...sensorIds(turn), ...sensorIds(reference)]);
    if (ids.size) {
      const exact = objects.find((item) => item?.kind === "sensor" && ids.has(String(item.id)));
      if (exact) return exact;
    }
    const station = finite(turn?.station, finite(reference?.station, NaN));
    const section = text(turn?.section || reference?.section).toLowerCase();
    const candidates = objects.filter((item) => item?.kind === "sensor"
      && (!Number.isFinite(station) || !Number.isFinite(finite(item?.station, NaN)) || finite(item.station, NaN) === station));
    if (candidates.length === 1) return candidates[0];
    return candidates.find((item) => text(item?.labelSection).toLowerCase() === section) || null;
  }

  function shortestDelta(from, to) {
    const start = finite(from, 0);
    const end = finite(to, start);
    return ((end - start + 540) % 360) - 180;
  }

  function synchronizeMoveStart(rows, index, startPlate) {
    const move = rows[index];
    if (!isCmd7(move)) return;
    const start = done(startPlate);
    move.plateAngle = start;
    const reference = rows[index + 1];
    const target = finite(reference?.plateAngle, NaN);
    const tableStart = finite(move?.tableAngle, NaN);
    const tableStop = finite(reference?.tableAngle, NaN);
    if (!Number.isFinite(target) || !Number.isFinite(tableStart) || !Number.isFinite(tableStop) || tableStop <= tableStart + EPS) return;
    const rotation = target - start;
    move.plannedRotation = rotation;
    move.plannedRatio = Math.abs(rotation) / Math.max(EPS, tableStop - tableStart);
  }

  function revalidateStoppedWipeSensorTransitions(rows, changes) {
    const targetService = global.LabelerOrientationConstraintTargetService;
    if (!targetService?.targetFor) return rows;

    for (let index = 0; index < rows.length - 2; index += 1) {
      const wipeHold = rows[index];
      const turn = rows[index + 1];
      const reference = rows[index + 2];
      if (!isStoppedWipeHold(wipeHold) || !isSensorTurn(turn) || !isSensorHold(reference)) continue;

      const sensor = matchingSensor(turn, reference);
      if (!sensor) continue;
      const section = text(turn.section || reference.section || wipeHold.section).toLowerCase();
      const currentPlate = finite(wipeHold.plateAngle, NaN);
      const sensorTable = finite(sensor.angle, finite(sensor.start, finite(reference.tableAngle, NaN)));
      if (!section || !Number.isFinite(currentPlate) || !Number.isFinite(sensorTable)) continue;

      let targetInfo = null;
      try {
        targetInfo = targetService.targetFor(sensor, section, rows, currentPlate, sensorTable);
      } catch {
        targetInfo = null;
      }
      const target = finite(targetInfo?.target, NaN);
      if (!Number.isFinite(target)) continue;

      const delta = shortestDelta(currentPlate, target);
      const required = finite(targetInfo?.required, finite(sensor?.requiredVisibilityPercent, NaN));
      const visibility = finite(targetInfo?.visibility, NaN);
      const satisfied = Math.abs(delta) <= TARGET_TOLERANCE_DEG
        && (targetInfo?.satisfiedAtCommandResolution !== false)
        && (!Number.isFinite(required) || !Number.isFinite(visibility) || visibility + EPS >= required);

      if (satisfied) {
        const removedSensorId = sensor.id || turn.sensorId || reference.sensorId;
        rows.splice(index + 1, 2);
        wipeHold.postWipeSensorSatisfied = true;
        wipeHold.verifiedSensorId = removedSensorId;
        if (Number.isFinite(required)) wipeHold.requiredLabelVisibilityPercent = required;
        if (Number.isFinite(visibility)) wipeHold.plannedLabelVisibilityPercent = visibility;
        synchronizeMoveStart(rows, index + 1, currentPlate);
        changes.push({
          type: "sensor-turn-removed",
          station: wipeHold.station,
          section,
          sensorId: removedSensorId,
          wipeHoldTableAngle: wipeHold.tableAngle,
          plateAngle: done(currentPlate),
          visibilityPercent: Number.isFinite(visibility) ? visibility : undefined,
          requiredVisibilityPercent: Number.isFinite(required) ? required : undefined
        });
        index -= 1;
        continue;
      }

      const targetPlate = done(currentPlate + delta);
      turn.plateAngle = done(currentPlate);
      reference.plateAngle = targetPlate;
      const tableTravel = finite(reference.tableAngle, NaN) - finite(turn.tableAngle, NaN);
      turn.plannedRotation = targetPlate - done(currentPlate);
      if (Number.isFinite(tableTravel) && tableTravel > EPS) {
        turn.plannedRatio = Math.abs(turn.plannedRotation) / tableTravel;
      }
      turn.postWipeSensorRevalidated = true;
      reference.postWipeSensorRevalidated = true;
      if (Number.isFinite(required)) {
        turn.requiredLabelVisibilityPercent = required;
        reference.requiredLabelVisibilityPercent = required;
      }
      if (Number.isFinite(visibility)) {
        turn.plannedLabelVisibilityPercent = visibility;
        reference.plannedLabelVisibilityPercent = visibility;
      }
      synchronizeMoveStart(rows, index + 3, targetPlate);
      changes.push({
        type: "sensor-turn-replanned",
        station: wipeHold.station,
        section,
        sensorId: sensor.id || turn.sensorId || reference.sensorId,
        wipeHoldTableAngle: wipeHold.tableAngle,
        sensorTurnTableAngle: turn.tableAngle,
        sensorHoldTableAngle: reference.tableAngle,
        startPlateAngle: done(currentPlate),
        targetPlateAngle: targetPlate
      });
    }
    return rows;
  }

  function repair(sourceRows) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    const changes = [];
    const unresolved = [];

    for (let index = 0; index < rows.length - 3; index += 1) {
      const first = rows[index];
      const second = rows[index + 1];
      const movingHold = rows[index + 2];
      const sensorHold = rows[index + 3];

      if (!isWipeTurn1(first)
        || !isWipeTurn2(second)
        || !sameWipePair(first, second)
        || !isMovingWipeHold(movingHold)
        || !isSensorHold(sensorHold)) continue;

      const turnTable = sensorTurnStart(movingHold.tableAngle, sensorHold.tableAngle);
      if (!Number.isFinite(turnTable)) {
        unresolved.push({
          station: second.station,
          section: second.section,
          sensorId: movingHold.sensorId || sensorHold.sensorId,
          reason: "insufficient-table-spacing",
          message: `Move the ${sectionName(second.section).toLowerCase()} sensor later so a stopped reference can separate Wipe Turn 2 from sensor setup.`
        });
        continue;
      }

      const wipeHold = stoppedWipeReference(movingHold);
      const startPlate = finite(movingHold.plateAngle, 0);
      const targetPlate = finite(sensorHold.plateAngle, startPlate);
      const tableTravel = finite(sensorHold.tableAngle, turnTable) - turnTable;
      const sensorTurn = {
        ...movingHold,
        ...sensorMetadata(movingHold, sensorHold),
        cmd: 7,
        baseCmd: 7,
        tableAngle: turnTable,
        plateAngle: done(startPlate),
        action: sensorTurnAction(movingHold, sensorHold),
        stage: "sensor-setup",
        plannerIntent: "ROTATE",
        plannerRequestedCommand: 7,
        plannerRecommendedCommand: 7,
        plannerReason: "Begin sensor orientation only after the post-wipe stopped reference.",
        plannedRotation: targetPlate - startPlate,
        plannedRatio: Math.abs(targetPlate - startPlate) / Math.max(EPS, tableTravel),
        orientationConstraintContinuation: true,
        postWipeSensorSetup: true,
        sensorSetupAfterHold: true,
        wipeSensorSetupHoldTableAngle: done(movingHold.tableAngle),
        commandTranslated: false,
        motionProfileApplied: false
      };

      rows.splice(index + 2, 1, wipeHold, sensorTurn);
      changes.push({
        type: "moving-hold-split",
        station: second.station,
        section: second.section,
        wipeHoldTableAngle: wipeHold.tableAngle,
        sensorTurnTableAngle: sensorTurn.tableAngle,
        sensorHoldTableAngle: sensorHold.tableAngle,
        sensorId: sensorTurn.sensorId || sensorHold.sensorId
      });
      index += 3;
    }

    revalidateStoppedWipeSensorTransitions(rows, changes);
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
        version: 3,
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
    profilePipeline.registerStage({
      id: STAGE_ID,
      phase: "motion",
      order: STAGE_ORDER,
      source: "app/apl-post-wipe-sensor-hold-integration.js",
      description: "Close physical wipe motion at Rest, then revalidate any sensor correction from the final post-wipe bottle angle.",
      process
    });

    global.LabelerAplPostWipeSensorHold = Object.freeze({
      installed: true,
      version: 3,
      stageId: STAGE_ID,
      order: STAGE_ORDER,
      holdTravelDeg: HOLD_TRAVEL_DEG,
      isWipeTurn1,
      isWipeTurn2,
      isMovingWipeHold,
      isStoppedWipeHold,
      isSensorTurn,
      isSensorHold,
      sensorTurnStart,
      maxConsecutiveCorrections,
      revalidateStoppedWipeSensorTransitions,
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
