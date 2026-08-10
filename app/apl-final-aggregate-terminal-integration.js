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

  function runtimeState() {
    try {
      if (typeof state !== "undefined" && state) return state;
    } catch {
      // Fall back to a Window property only when the lexical runtime binding is unavailable.
    }
    return global.state || null;
  }

  function activeMap() {
    try {
      if (typeof activeMachineMap === "function") return activeMachineMap();
      if (typeof global.activeMachineMap === "function") return global.activeMachineMap();
    } catch {
      return null;
    }
    return null;
  }

  function isApl(map = activeMap()) {
    const current = runtimeState();
    return String(current?.applicationMode || map?.applicationMode || "apl").toLowerCase() === "apl";
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

  function aggregateTerminalIndex(rows, aggregate) {
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

  function isTrustedCoderTerminal(row) {
    return Boolean(row
      && Number(row.cmd) === 3
      && row.codingHold === true
      && row.coderTerminalHold === true
      && row.motionSource === "apl-coder-codebox"
      && row.codeBoxTargetSource === "label-code-box-center-from-left-edge");
  }

  function terminalIndex(rows, aggregate) {
    const aggregateIndex = aggregateTerminalIndex(rows, aggregate);
    if (aggregateIndex < 0) return -1;
    for (let index = rows.length - 1; index > aggregateIndex; index -= 1) {
      if (isTrustedCoderTerminal(rows[index])) return index;
    }
    return aggregateIndex;
  }

  function canonicalRows(sourceRows, map = activeMap()) {
    const source = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    if (!source.length || !isApl(map)) return source;
    const aggregate = finalAggregateNumber(map, source);
    const index = terminalIndex(source, aggregate);
    if (index < 0) return source;

    const rows = source.slice(0, index + 1).map((row) => ({
      ...row,
      terminalRest: false,
      aggregateTerminal: false,
      codingTerminal: false
    }));
    const coderTerminal = isTrustedCoderTerminal(rows[index]);
    rows[index] = {
      ...rows[index],
      cmd: 3,
      baseCmd: 3,
      terminalRest: true,
      activeHold: false,
      aggregateTerminal: !coderTerminal,
      codingTerminal: coderTerminal,
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
    const current = runtimeState();
    if (!Array.isArray(rows) || !rows.length || !current) return rows;
    current.program = rows;
    const finalRow = rows.at(-1);
    const aggregate = finalRow?.terminalAggregate;
    const coderTerminal = finalRow?.codingTerminal === true;

    if (current.motionPlan) {
      current.motionPlan.rows = rows;
      current.motionPlan.finalPlateAngle = finalRow?.plateAngle;
      current.motionPlan.finalAggregateTerminal = !coderTerminal;
      current.motionPlan.coderTerminal = coderTerminal;
      current.motionPlan.termination = {
        ...(current.motionPlan.termination || {}),
        section: coderTerminal ? "coding" : (finalRow?.section || current.motionPlan.termination?.section || "none"),
        station: coderTerminal ? null : aggregate,
        hmi: finalRow?.hmi,
        tableAngle: finalRow?.tableAngle,
        command: "Rest"
      };
      syncPlan(current.motionPlan.planner, rows);
    }
    if (current.motionTranslation) {
      current.motionTranslation.rows = rows;
      syncPlan(current.motionTranslation.plan, rows);
    }
    syncPlan(current.plannerPreview, rows);
    return rows;
  }

  function finalizeCurrentProgram(output) {
    const current = runtimeState();
    const source = Array.isArray(current?.program) && current.program.length
      ? current.program
      : output;
    return synchronize(canonicalRows(source));
  }

  function install() {
    if (installed) return true;
    const current = runtimeState();
    if (!current || typeof global.applyGeneratedServoProfile !== "function") return false;

    const base = global.applyGeneratedServoProfile;
    global.applyGeneratedServoProfile = function applyGeneratedServoProfileWithFinalAggregateTerminal(...args) {
      const output = base.apply(this, args);
      return finalizeCurrentProgram(output);
    };

    global.LabelerAplFinalAggregateTerminal = Object.freeze({
      installed: true,
      version: 4,
      runtimeState,
      finalAggregateNumber,
      belongsToAggregate,
      isPhysicalAggregateHold,
      aggregateTerminalIndex,
      isTrustedCoderTerminal,
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
      console.error("Unable to apply final aggregate/coder terminal policy.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
