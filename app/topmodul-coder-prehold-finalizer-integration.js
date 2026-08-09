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

  function codingObjects(map = activeMap()) {
    return (Array.isArray(map?.objects) ? map.objects : [])
      .filter((item) => item?.kind === "coding" && item?.enabled !== false && item?.orientBottle !== false);
  }

  function codingObjectForHold(hold, map = activeMap()) {
    const objects = codingObjects(map);
    if (!objects.length) return null;
    const ids = [
      hold?.codingObjectId,
      hold?.orientationObjectId,
      ...(Array.isArray(hold?.codingObjectIds) ? hold.codingObjectIds : []),
      ...(Array.isArray(hold?.orientationObjectIds) ? hold.orientationObjectIds : [])
    ].filter((value) => value !== null && value !== undefined && value !== "").map(String);
    const exact = objects.find((item) => ids.includes(String(item?.id || "")));
    if (exact) return exact;
    if (objects.length === 1) return objects[0];

    const anchor = number(hold?.tableAngle, number(hold?.codingReadyTableAngle, NaN));
    if (!Number.isFinite(anchor)) return objects[0];
    return [...objects].sort((left, right) => {
      const leftStart = number(left?.start, number(left?.angle, Infinity));
      const rightStart = number(right?.start, number(right?.angle, Infinity));
      return Math.abs(leftStart - anchor) - Math.abs(rightStart - anchor);
    })[0];
  }

  function equivalentNear(angle, reference) {
    const base = number(angle, NaN);
    const anchor = number(reference, base);
    if (!Number.isFinite(base)) return NaN;
    if (!Number.isFinite(anchor)) return base;
    return base + FULL_CYCLE_DEG * Math.round((anchor - base) / FULL_CYCLE_DEG);
  }

  function coderStartForHold(hold, map = activeMap()) {
    const explicitStart = number(
      hold?.codingWindowStart,
      number(hold?.inspectionWindowStart, NaN)
    );
    if (Number.isFinite(explicitStart)) return explicitStart;

    const item = codingObjectForHold(hold, map);
    const rawStart = number(item?.start, number(item?.angle, NaN));
    return equivalentNear(
      rawStart,
      number(hold?.tableAngle, number(hold?.codingReadyTableAngle, rawStart))
    );
  }

  function preCoderStopForHold(hold, map = activeMap()) {
    const coderStart = coderStartForHold(hold, map);
    if (!Number.isFinite(coderStart)) {
      return number(hold?.codingReadyTableAngle, number(hold?.tableAngle, NaN));
    }
    return done(coderStart - PRE_CODER_MARGIN_DEG);
  }

  function rowsBeforeStop(rows, holdIndex, stoppedTable) {
    return rows.slice(0, holdIndex).filter((row) => {
      const table = number(row?.tableAngle, NaN);
      return !Number.isFinite(table) || table < stoppedTable - EPS;
    });
  }

  function canonicalRows(sourceRows) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    if (!rows.length || !isTopModul()) return rows;

    const holdIndex = finalCodingHoldIndex(rows);
    if (holdIndex < 0) return rows;

    const hold = rows[holdIndex];
    const coderStart = coderStartForHold(hold);
    let stoppedTable = preCoderStopForHold(hold);
    if (!Number.isFinite(stoppedTable)) stoppedTable = number(hold.tableAngle, 0);

    const output = rowsBeforeStop(rows, holdIndex, stoppedTable);
    output.push({
      ...hold,
      cmd: 3,
      baseCmd: 3,
      tableAngle: stoppedTable,
      generatedTableAngle: stoppedTable,
      action: "Hold for Coding",
      codingHold: true,
      explicitCodingWindowHold: true,
      codingReadyTableAngle: stoppedTable,
      coderStartTableAngle: Number.isFinite(coderStart) ? coderStart : undefined,
      preCoderMarginDeg: PRE_CODER_MARGIN_DEG,
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
      version: 3,
      PRE_CODER_MARGIN_DEG,
      lateProfilePipelineReady,
      explicitCodingHold,
      finalCodingHoldIndex,
      codingObjects,
      codingObjectForHold,
      coderStartForHold,
      preCoderStopForHold,
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