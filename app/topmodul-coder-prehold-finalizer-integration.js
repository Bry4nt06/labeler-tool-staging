"use strict";

(function installTopModulCoderPreholdFinalizer(global) {
  if (global.LabelerTopModulCoderPreholdFinalizer?.installed) return;

  const RETRY_MS = 25;
  let installed = false;

  const number = (value, fallback = NaN) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

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

  function canonicalRows(sourceRows) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    if (!rows.length || !isTopModul()) return rows;

    const holdIndex = finalCodingHoldIndex(rows);
    if (holdIndex < 0) return rows;

    const hold = rows[holdIndex];
    const ready = number(hold.codingReadyTableAngle, number(hold.tableAngle, NaN));
    const coderStart = number(
      hold.codingWindowStart,
      number(hold.inspectionWindowStart, NaN)
    );
    let stoppedTable = ready;
    if (Number.isFinite(coderStart)) stoppedTable = Math.min(stoppedTable, coderStart);
    if (!Number.isFinite(stoppedTable)) stoppedTable = number(hold.tableAngle, 0);

    rows.splice(holdIndex + 1);
    rows[holdIndex] = {
      ...hold,
      cmd: 3,
      baseCmd: 3,
      tableAngle: stoppedTable,
      generatedTableAngle: stoppedTable,
      action: "Hold for Coding",
      codingHold: true,
      explicitCodingWindowHold: true,
      codingReadyTableAngle: stoppedTable,
      terminalRest: true,
      activeHold: false,
      plannerIntent: "HOLD",
      plannerRequestedCommand: 3,
      plannerRecommendedCommand: 3,
      motionSource: "topmodul-pre-coder-terminal-hold",
      topModulPreCoderHold: true
    };

    return rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
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
      version: 2,
      lateProfilePipelineReady,
      explicitCodingHold,
      finalCodingHoldIndex,
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