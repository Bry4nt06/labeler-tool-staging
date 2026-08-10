"use strict";

(function installAplPostWipeSensorContinuityFallback(global) {
  if (global.LabelerAplPostWipeSensorContinuityFallback?.installed) return;

  const VERSION = 1;
  const EPS = 0.001;
  const TARGET_TOLERANCE_DEG = 0.05;
  const RETRY_MS = 50;

  const finite = (value, fallback = NaN) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const text = (value) => String(value ?? "").trim();
  const done = (value) => typeof global.finishAngle === "function"
    ? global.finishAngle(value)
    : Math.round(finite(value, 0) * 10) / 10;

  function activeMap() {
    try {
      if (typeof global.activeMachineMap === "function") return global.activeMachineMap();
      if (typeof activeMachineMap === "function") return activeMachineMap();
    } catch {
      return null;
    }
    return null;
  }

  function isStoppedWipeHold(row) {
    return Number(row?.cmd) === 3 && /\bWipe\s+Hold\b/i.test(text(row?.action));
  }

  function isSensorTurn(row) {
    return Number(row?.cmd) === 7 && Boolean(
      row?.sensorId
      || (Array.isArray(row?.sensorIds) && row.sensorIds.length)
      || /orient.*(?:sensor|inspection)|(?:sensor|inspection).*orient/i.test(text(row?.action))
    );
  }

  function isSensorReference(row) {
    return Number(row?.cmd) === 3 && Boolean(
      row?.sensorId
      || (Array.isArray(row?.sensorIds) && row.sensorIds.length)
      || row?.orientationHold
      || /sensor|inspection|orientation/i.test(text(row?.action))
    );
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
      && (!Number.isFinite(station)
        || !Number.isFinite(finite(item?.station, NaN))
        || finite(item.station, NaN) === station));
    if (candidates.length === 1) return candidates[0];
    return candidates.find((item) => text(item?.labelSection).toLowerCase() === section) || null;
  }

  function shortestDelta(from, to) {
    const start = finite(from, 0);
    const end = finite(to, start);
    return ((end - start + 540) % 360) - 180;
  }

  function synchronizeFollowingMove(rows, index, startPlate) {
    const move = rows[index];
    if (Number(move?.cmd) !== 7) return;
    const start = done(startPlate);
    move.plateAngle = start;
    const reference = rows[index + 1];
    const target = finite(reference?.plateAngle, NaN);
    const tableStart = finite(move?.tableAngle, NaN);
    const tableStop = finite(reference?.tableAngle, NaN);
    if (!Number.isFinite(target)
      || !Number.isFinite(tableStart)
      || !Number.isFinite(tableStop)
      || tableStop <= tableStart + EPS) return;
    move.plannedRotation = target - start;
    move.plannedRatio = Math.abs(move.plannedRotation) / Math.max(EPS, tableStop - tableStart);
  }

  function repair(sourceRows) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    const changes = [];
    const targetService = global.LabelerOrientationConstraintTargetService;
    if (!targetService?.targetFor) return { rows, changes };

    for (let index = 0; index < rows.length - 2; index += 1) {
      const wipeHold = rows[index];
      const turn = rows[index + 1];
      const reference = rows[index + 2];
      if (!isStoppedWipeHold(wipeHold) || !isSensorTurn(turn) || !isSensorReference(reference)) continue;

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
        && targetInfo?.satisfiedAtCommandResolution !== false
        && (!Number.isFinite(required) || !Number.isFinite(visibility) || visibility + EPS >= required);

      if (satisfied) {
        const sensorId = sensor.id || turn.sensorId || reference.sensorId;
        rows.splice(index + 1, 2);
        wipeHold.postWipeSensorSatisfied = true;
        wipeHold.verifiedSensorId = sensorId;
        if (Number.isFinite(required)) wipeHold.requiredLabelVisibilityPercent = required;
        if (Number.isFinite(visibility)) wipeHold.plannedLabelVisibilityPercent = visibility;
        synchronizeFollowingMove(rows, index + 1, currentPlate);
        changes.push({
          type: "sensor-turn-removed",
          section,
          station: wipeHold.station,
          sensorId,
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
      synchronizeFollowingMove(rows, index + 3, targetPlate);
      changes.push({
        type: "sensor-turn-replanned",
        section,
        station: wipeHold.station,
        sensorId: sensor.id || turn.sensorId || reference.sensorId,
        wipeHoldTableAngle: wipeHold.tableAngle,
        sensorTurnTableAngle: turn.tableAngle,
        sensorHoldTableAngle: reference.tableAngle,
        startPlateAngle: done(currentPlate),
        targetPlateAngle: targetPlate
      });
    }

    return {
      rows: rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index })),
      changes
    };
  }

  function publish(result) {
    if (!global.state?.motionPlan || typeof global.state.motionPlan !== "object") return;
    global.state.motionPlan.aplPostWipeSensorContinuity = {
      version: VERSION,
      runtimeMode: "generated-profile-fallback",
      applied: result.changes.length > 0,
      changes: result.changes
    };
  }

  function install() {
    const base = global.generatedServoProfile;
    if (typeof base !== "function" || !global.LabelerOrientationConstraintTargetService?.targetFor) return false;
    if (base.aplPostWipeSensorContinuityV52 === true) return true;

    const wrapped = function generatedServoProfileWithPostWipeSensorContinuity(...args) {
      const result = repair(base.apply(this, args));
      publish(result);
      return result.rows;
    };
    wrapped.aplPostWipeSensorContinuityV52 = true;
    wrapped.previousGeneratedServoProfile = base;
    global.generatedServoProfile = wrapped;

    global.LabelerAplPostWipeSensorContinuityFallback = Object.freeze({
      installed: true,
      version: VERSION,
      runtimeMode: "generated-profile-fallback",
      isStoppedWipeHold,
      isSensorTurn,
      isSensorReference,
      matchingSensor,
      repair
    });

    try {
      global.applyGeneratedServoProfile?.();
      global.renderProgram?.();
      global.renderValidation?.();
    } catch (error) {
      console.error("Unable to apply the post-wipe sensor continuity fallback.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
