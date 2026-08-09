"use strict";

(function installTopModulCoderPreholdFinalizer(global) {
  if (global.LabelerTopModulCoderPreholdFinalizer?.installed) return;

  const RETRY_MS = 25;
  const EPS = 0.001;
  const FULL_CYCLE_DEG = 360;
  const PRE_CODER_MARGIN_DEG = 5;
  let installed = false;

  const number = (value, fallback = NaN) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const done = (value) => typeof global.finishAngle === "function"
    ? global.finishAngle(value)
    : Math.round(number(value, 0) * 10) / 10;

  function activeMap() {
    try { return typeof global.activeMachineMap === "function" ? global.activeMachineMap() : null; }
    catch { return null; }
  }

  function lateProfilePipelineReady() {
    return global.LabelerProfilePipelineOrchestratorInstalled === true
      && global.LabelerCoderWindowReferenceHandoff?.installed === true
      && global.LabelerTopModulCorrectionChainLimit?.installed === true;
  }

  function isTopModul() {
    const map = activeMap();
    const machine = String(map?.machineType || map?.name || "").toUpperCase();
    if (machine.includes("TOPMODUL")) return true;
    const family = String(
      global.state?.machineFamilyGrammar?.family
      || global.LabelerMachineFamilyGrammarDriver?.resolveFamily?.({
        map,
        machineType: map?.machineType || "",
        applicationMode: global.state?.applicationMode || map?.applicationMode || ""
      })
      || ""
    ).toUpperCase();
    return family === "TOPMODUL";
  }

  function explicitCodingHold(row) {
    if (!row) return false;
    const action = String(row.action || "");
    return row.codingHold === true
      || row.explicitCodingWindowHold === true
      || (Number.isFinite(number(row.codingReadyTableAngle)) && /coding|code box/i.test(action))
      || (row.orientationHold === true && /coding|code box/i.test(action));
  }

  function finalCodingHoldIndex(rows) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (explicitCodingHold(rows[index])) return index;
    }
    return -1;
  }

  function codingOrientationTurn(row) {
    if (!row || Number(row.cmd) !== 7) return false;
    if (row.codingMotion || row.coderAfterWipeHandoff || row.mapObjectOrientation) {
      const action = String(row.action || "");
      if (/coding|code box|coder/i.test(action) || row.codingObjectId || row.codingObjectIds?.length) return true;
    }
    return /(?:orient|direct\s+turn|turn).*?(?:coding|code\s*box|coder)|(?:coding|code\s*box|coder).*?(?:orient|turn)/i
      .test(String(row.action || ""));
  }

  function finalCodingTurnIndex(rows) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (codingOrientationTurn(rows[index])) return index;
    }
    return -1;
  }

  function codingObjects(map = activeMap()) {
    return (Array.isArray(map?.objects) ? map.objects : [])
      .filter((item) => item?.kind === "coding" && item?.enabled !== false && item?.orientBottle !== false);
  }

  function codingObjectForRow(row, map = activeMap()) {
    const objects = codingObjects(map);
    if (!objects.length) return null;
    const ids = [
      row?.codingObjectId,
      row?.orientationObjectId,
      ...(Array.isArray(row?.codingObjectIds) ? row.codingObjectIds : []),
      ...(Array.isArray(row?.orientationObjectIds) ? row.orientationObjectIds : [])
    ].filter((value) => value !== null && value !== undefined && value !== "").map(String);
    const exact = objects.find((item) => ids.includes(String(item?.id || "")));
    if (exact) return exact;
    if (objects.length === 1) return objects[0];

    const anchor = number(row?.tableAngle, number(row?.codingReadyTableAngle, NaN));
    if (!Number.isFinite(anchor)) return objects[0];
    return [...objects].sort((left, right) => {
      const leftStart = number(left?.start, number(left?.angle, Infinity));
      const rightStart = number(right?.start, number(right?.angle, Infinity));
      return Math.abs(leftStart - anchor) - Math.abs(rightStart - anchor);
    })[0];
  }

  function codingObjectForHold(hold, map = activeMap()) {
    return codingObjectForRow(hold, map);
  }

  function equivalentNear(angle, reference) {
    const base = number(angle, NaN);
    const anchor = number(reference, base);
    if (!Number.isFinite(base)) return NaN;
    if (!Number.isFinite(anchor)) return base;
    return base + FULL_CYCLE_DEG * Math.round((anchor - base) / FULL_CYCLE_DEG);
  }

  function coderStartForRow(row, map = activeMap()) {
    // The map object is the physical coder position. Planner windows may begin
    // earlier because they represent the orientation-ready deadline, so do not
    // treat those logical window starts as the hardware location.
    const item = codingObjectForRow(row, map);
    const rawStart = number(item?.start, number(item?.angle, NaN));
    if (Number.isFinite(rawStart)) {
      return equivalentNear(
        rawStart,
        number(row?.tableAngle, number(row?.codingReadyTableAngle, rawStart))
      );
    }

    return number(
      row?.physicalCodingWindowStart,
      number(row?.coderStartTableAngle,
        number(row?.codingWindowStart, number(row?.inspectionWindowStart, NaN)))
    );
  }

  function coderStartForHold(hold, map = activeMap()) {
    return coderStartForRow(hold, map);
  }

  function preCoderStopForRow(row, map = activeMap()) {
    const coderStart = coderStartForRow(row, map);
    if (!Number.isFinite(coderStart)) {
      return number(row?.codingReadyTableAngle, number(row?.tableAngle, NaN));
    }
    return done(coderStart - PRE_CODER_MARGIN_DEG);
  }

  function preCoderStopForHold(hold, map = activeMap()) {
    return preCoderStopForRow(hold, map);
  }

  function rowsBeforeStop(rows, exclusiveEndIndex, stoppedTable) {
    return rows.slice(0, exclusiveEndIndex).filter((row) => {
      const table = number(row?.tableAngle, NaN);
      return !Number.isFinite(table) || table < stoppedTable - EPS;
    });
  }

  function codingTargetPlate(rows, turnIndex, holdIndex) {
    if (holdIndex >= 0) {
      const held = number(rows[holdIndex]?.plateAngle, NaN);
      if (Number.isFinite(held)) return held;
    }

    if (turnIndex >= 0) {
      const turn = rows[turnIndex];
      const next = rows.slice(turnIndex + 1).find((row) =>
        number(row?.tableAngle, Infinity) > number(turn?.tableAngle, -Infinity) + EPS
        && Number.isFinite(number(row?.plateAngle, NaN))
      );
      const destination = number(next?.plateAngle, NaN);
      if (Number.isFinite(destination)) return destination;
      const rotation = number(turn?.plannedRotation, NaN);
      const startPlate = number(turn?.plateAngle, NaN);
      if (Number.isFinite(rotation) && Number.isFinite(startPlate)) return startPlate + rotation;
      if (Number.isFinite(startPlate)) return startPlate;
    }
    return NaN;
  }

  function canonicalRows(sourceRows) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    if (!rows.length || !isTopModul()) return rows;

    const holdIndex = finalCodingHoldIndex(rows);
    const turnIndex = finalCodingTurnIndex(rows);
    if (holdIndex < 0 && turnIndex < 0) return rows;

    // In the live APL path the visible brown coding segment can exist even when
    // a later planner failed to tag its destination as codingHold. Use the turn
    // itself as the authoritative fallback so the real map segment is clipped,
    // not merely a terminal row after it.
    const anchor = holdIndex >= 0 ? rows[holdIndex] : rows[turnIndex];
    const coderStart = coderStartForRow(anchor);
    let stoppedTable = preCoderStopForRow(anchor);
    if (!Number.isFinite(stoppedTable)) {
      stoppedTable = number(rows[holdIndex]?.tableAngle, number(rows[turnIndex]?.tableAngle, 0));
    }

    const targetPlate = codingTargetPlate(rows, turnIndex, holdIndex);
    const exclusiveEndIndex = holdIndex >= 0 ? holdIndex : turnIndex + 1;
    const output = rowsBeforeStop(rows, exclusiveEndIndex, stoppedTable);

    // If the coding turn begins before the deadline, keep that CMD 7 row. The
    // newly inserted CMD 3 at the deadline becomes its destination, which makes
    // both the actual servo interpolation and the brown map wedge stop there.
    if (turnIndex >= 0) {
      const turn = rows[turnIndex];
      const turnTable = number(turn?.tableAngle, NaN);
      const alreadyKept = output.some((row) => row === turn || (
        Number(row?.cmd) === 7
        && Math.abs(number(row?.tableAngle, Infinity) - turnTable) <= EPS
        && String(row?.action || "") === String(turn?.action || "")
      ));
      if (!alreadyKept && Number.isFinite(turnTable) && turnTable < stoppedTable - EPS) {
        output.push({ ...turn });
      }
    }

    output.sort((left, right) => number(left?.tableAngle, 0) - number(right?.tableAngle, 0));
    const sourceHold = holdIndex >= 0 ? rows[holdIndex] : (turnIndex >= 0 ? rows[turnIndex] : {});
    const codingObject = codingObjectForRow(anchor);
    const codingObjectId = sourceHold?.codingObjectId || codingObject?.id;
    output.push({
      ...sourceHold,
      cmd: 3,
      baseCmd: 3,
      tableAngle: stoppedTable,
      generatedTableAngle: stoppedTable,
      plateAngle: Number.isFinite(targetPlate) ? done(targetPlate) : number(sourceHold?.plateAngle, 0),
      action: "Hold for Coding",
      codingHold: true,
      codingMotion: false,
      explicitCodingWindowHold: true,
      codingReadyTableAngle: stoppedTable,
      coderStartTableAngle: Number.isFinite(coderStart) ? coderStart : undefined,
      physicalCodingWindowStart: Number.isFinite(coderStart) ? coderStart : undefined,
      preCoderMarginDeg: PRE_CODER_MARGIN_DEG,
      codingObjectId,
      codingObjectIds: codingObjectId ? [codingObjectId] : sourceHold?.codingObjectIds,
      terminalRest: true,
      activeHold: false,
      plannerIntent: "HOLD",
      plannerRequestedCommand: 3,
      plannerRecommendedCommand: 3,
      motionSource: "topmodul-pre-coder-terminal-hold",
      topModulPreCoderHold: true
    });

    return output.map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
  }

  function syncPlan(plan, rows) {
    if (!plan || !Array.isArray(plan.steps)) return;
    plan.steps = rows.map((row, index) => ({
      ...(plan.steps[index] || {}),
      index,
      hmi: row.hmi,
      plc: row.plc,
      tableAngle: number(row.tableAngle, 0),
      plateAngle: number(row.plateAngle, 0),
      action: String(row.action || ""),
      baseCommand: number(row.baseCmd, number(row.cmd, 3)),
      requestedCommand: number(row.plannerRequestedCommand, number(row.cmd, 3)),
      recommendedCommand: number(row.cmd, 3),
      intent: row.plannerIntent || (Number(row.cmd) === 7 ? "ROTATE" : "HOLD"),
      terminal: row.terminalRest === true
    }));
    if (Array.isArray(plan.events)) plan.events = plan.events.slice(0, rows.length);
  }

  function synchronize(rows) {
    if (!Array.isArray(rows) || !rows.length || !global.state) return rows;
    global.state.program = rows;
    const finalRow = rows.at(-1);

    if (global.state.motionPlan) {
      global.state.motionPlan.rows = rows;
      global.state.motionPlan.finalPlateAngle = finalRow?.plateAngle;
      global.state.motionPlan.topModulPreCoderHold = finalRow?.topModulPreCoderHold === true;
      global.state.motionPlan.preCoderMarginDeg = finalRow?.preCoderMarginDeg;
      global.state.motionPlan.termination = {
        ...(global.state.motionPlan.termination || {}),
        section: "coding",
        hmi: finalRow?.hmi,
        tableAngle: finalRow?.tableAngle,
        command: "Rest"
      };
      syncPlan(global.state.motionPlan.planner, rows);
    }

    if (global.state.motionTranslation) {
      global.state.motionTranslation.rows = rows;
      syncPlan(global.state.motionTranslation.plan, rows);
    }
    syncPlan(global.state.plannerPreview, rows);
    return rows;
  }

  function finalizeCurrentProgram(output) {
    const source = Array.isArray(global.state?.program) && global.state.program.length
      ? global.state.program
      : output;
    const rows = canonicalRows(source);
    return synchronize(rows);
  }

  function install() {
    if (installed) return true;
    if (!global.state
      || typeof global.applyGeneratedServoProfile !== "function"
      || !lateProfilePipelineReady()) return false;

    const base = global.applyGeneratedServoProfile;
    global.applyGeneratedServoProfile = function applyGeneratedServoProfileWithTopModulPreCoderHold(...args) {
      const output = base.apply(this, args);
      return finalizeCurrentProgram(output);
    };

    global.LabelerTopModulCoderPreholdFinalizer = Object.freeze({
      installed: true,
      version: 5,
      PRE_CODER_MARGIN_DEG,
      lateProfilePipelineReady,
      explicitCodingHold,
      finalCodingHoldIndex,
      codingOrientationTurn,
      finalCodingTurnIndex,
      codingObjects,
      codingObjectForRow,
      codingObjectForHold,
      coderStartForRow,
      coderStartForHold,
      preCoderStopForRow,
      preCoderStopForHold,
      codingTargetPlate,
      canonicalRows,
      finalizeCurrentProgram
    });
    installed = true;
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);