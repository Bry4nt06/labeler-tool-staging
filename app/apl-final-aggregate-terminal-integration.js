"use strict";

(function installAplFinalAggregateTerminal(global) {
  if (global.LabelerAplFinalAggregateTerminal?.installed) return;

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

  function isApl(map = activeMap()) {
    return String(global.state?.applicationMode || map?.applicationMode || "apl").toLowerCase() === "apl";
  }

  function finalAggregateNumber(map, rows = []) {
    const candidates = [];
    const configured = number(map?.aggregateCount, NaN);
    if (Number.isFinite(configured)) candidates.push(configured);
    Object.keys(map?.aggregateAngles || {}).forEach((key) => {
      const station = Number(key);
      if (Number.isFinite(station)) candidates.push(station);
    });
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const station = number(row?.station, NaN);
      if (Number.isFinite(station)) candidates.push(station);
      const match = String(row?.action || "").match(/\bAgg\s*(\d+)\b/i);
      if (match) candidates.push(Number(match[1]));
    });
    return candidates.length ? Math.max(...candidates.filter(Number.isFinite)) : NaN;
  }

  function belongsToAggregate(row, aggregate) {
    if (!row || !Number.isFinite(aggregate)) return false;
    if (number(row.station, NaN) === aggregate) return true;
    return new RegExp(`\\bAgg\\s*${aggregate}\\b`, "i").test(String(row.action || ""));
  }

  function isPhysicalAggregateHold(row, aggregate) {
    if (!belongsToAggregate(row, aggregate) || Number(row?.cmd) !== 3) return false;
    const action = String(row?.action || "");
    return row?.stage === "complete"
      || row?.wipeReference === true
      || /wipe\s+hold|wipe.*rest|(?:hold|rest|complete).*agg/i.test(action);
  }

  function terminalIndex(rows, aggregate) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (isPhysicalAggregateHold(rows[index], aggregate)) return index;
    }
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (belongsToAggregate(rows[index], aggregate) && Number(rows[index]?.cmd) === 3) return index;
    }
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (belongsToAggregate(rows[index], aggregate)) return index;
    }
    return -1;
  }

  function canonicalRows(sourceRows, map = activeMap()) {
    const source = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    if (!source.length || !isApl(map)) return source;
    const aggregate = finalAggregateNumber(map, source);
    const index = terminalIndex(source, aggregate);
    if (index < 0) return source;

    const rows = source.slice(0, index + 1);
    rows[index] = {
      ...rows[index],
      cmd: 3,
      baseCmd: 3,
      terminalRest: true,
      activeHold: false,
      aggregateTerminal: true,
      terminalAggregate: aggregate,
      plannerIntent: "HOLD",
      plannerRequestedCommand: 3,
      plannerRecommendedCommand: 3
    };
    return rows.map((row, rowIndex) => ({ ...row, hmi: rowIndex + 1, plc: rowIndex }));
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
    const aggregate = finalRow?.terminalAggregate;

    if (global.state.motionPlan) {
      global.state.motionPlan.rows = rows;
      global.state.motionPlan.finalPlateAngle = finalRow?.plateAngle;
      global.state.motionPlan.finalAggregateTerminal = true;
      global.state.motionPlan.termination = {
        ...(global.state.motionPlan.termination || {}),
        section: finalRow?.section || global.state.motionPlan.termination?.section || "none",
        station: aggregate,
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
    return synchronize(canonicalRows(source));
  }

  function latePipelineReady() {
    return global.LabelerProfilePipelineOrchestratorInstalled === true
      && global.LabelerOrientationConstraintPlannerInstalled === true
      && global.LabelerTopModulCorrectionChainLimit?.installed === true;
  }

  function install() {
    if (installed) return true;
    if (!global.state
      || typeof global.applyGeneratedServoProfile !== "function"
      || !latePipelineReady()) return false;

    const base = global.applyGeneratedServoProfile;
    global.applyGeneratedServoProfile = function applyGeneratedServoProfileWithFinalAggregateTerminal(...args) {
      const output = base.apply(this, args);
      return finalizeCurrentProgram(output);
    };

    global.LabelerAplFinalAggregateTerminal = Object.freeze({
      installed: true,
      version: 1,
      finalAggregateNumber,
      belongsToAggregate,
      isPhysicalAggregateHold,
      terminalIndex,
      canonicalRows,
      finalizeCurrentProgram
    });
    installed = true;

    try {
      global.applyGeneratedServoProfile();
      global.render?.();
      global.renderValidation?.();
    } catch (error) {
      console.error("Unable to apply final aggregate terminal policy.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
