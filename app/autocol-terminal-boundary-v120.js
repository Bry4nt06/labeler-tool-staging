"use strict";

(function installAutocolTerminalBoundaryV120(global) {
  const BUILD_ID = "autocol-end-curve-v120-20260814-2319";
  const END_CURVE_DEG = 359;
  const TOLERANCE = 0.5;
  const TERMINAL_EVENT_ID = "ME-AUTOCOL-END-CURVE";

  if (global.ServoForgeAutocolTerminalBoundaryV120?.buildId === BUILD_ID) return;

  function runtimeState() {
    try { return state; }
    catch { return global.state || {}; }
  }

  function activeMapSafe() {
    try { return typeof activeMachineMap === "function" ? activeMachineMap() : null; }
    catch { return null; }
  }

  function number(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function machineContext(rows) {
    const current = runtimeState();
    const map = activeMapSafe();
    return {
      rows,
      map,
      machineType: map?.machineType || map?.name || "",
      machineProfile: current.motionTranslation?.machineProfile
        || current.motionPlan?.translation?.machineProfile
        || rows?.find?.((row) => row?.translatedMachineProfile)?.translatedMachineProfile
        || "",
      applicationMode: current.applicationMode || map?.applicationMode || ""
    };
  }

  function machineFamily(rows) {
    const grammar = global.LabelerMachineFamilyGrammarDriver;
    if (typeof grammar?.resolveFamily === "function") {
      return String(grammar.resolveFamily(machineContext(rows)) || "DEFAULT").toUpperCase();
    }
    const identity = String(machineContext(rows).machineType || "").toUpperCase();
    return identity.includes("AUTOCOL") ? "AUTOCOL" : "DEFAULT";
  }

  function isValidEndCurve(row) {
    return Boolean(row)
      && Number(row.cmd) === 3
      && (row.autocolBoundary === "end-curve"
        || (/end\s*(?:of\s*)?curve/i.test(String(row.action || "")) && row.autocolProfile === true))
      && Math.abs(number(row.tableAngle, END_CURVE_DEG) - END_CURVE_DEG) <= TOLERANCE;
  }

  function restCommandName() {
    return global.LabelerServoCommandDriver?.moveDefinition?.(3)?.name || "Rest";
  }

  function normalizeRows(rows) {
    return rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
  }

  function terminalRowFrom(finalRow, index) {
    return {
      hmi: index + 1,
      plc: index,
      cmd: 3,
      baseCmd: 3,
      tableAngle: END_CURVE_DEG,
      plateAngle: number(finalRow?.plateAngle, 0),
      action: "End of curve",
      terminalRest: true,
      activeHold: false,
      autocolBoundary: "end-curve",
      autocolProfile: true,
      plannerIntent: "HOLD",
      plannerRequestedCommand: 3,
      plannerRecommendedCommand: 3,
      translatedCommandName: restCommandName(),
      commandTranslated: false,
      motionSource: "terminal-end-curve-rest",
      motionEventId: TERMINAL_EVENT_ID,
      motionEventType: "TERMINAL",
      machineGrammarFamily: "AUTOCOL",
      machineGrammarProfile: "AUTOCOL"
    };
  }

  function ensureAutocolEndCurve(rows) {
    const source = Array.isArray(rows) ? normalizeRows(rows.map((row) => ({ ...row }))) : [];
    if (!source.length || machineFamily(source) !== "AUTOCOL") return source;

    const finalIndex = source.length - 1;
    const finalRow = source[finalIndex];
    if (isValidEndCurve(finalRow)) {
      source[finalIndex] = {
        ...finalRow,
        cmd: 3,
        baseCmd: 3,
        tableAngle: END_CURVE_DEG,
        action: "End of curve",
        terminalRest: true,
        activeHold: false,
        autocolBoundary: "end-curve",
        autocolProfile: true,
        plannerIntent: "HOLD",
        plannerRequestedCommand: 3,
        plannerRecommendedCommand: 3,
        translatedCommandName: restCommandName(),
        commandTranslated: false,
        motionSource: finalRow.motionSource || "terminal-end-curve-rest",
        motionEventId: finalRow.motionEventId || TERMINAL_EVENT_ID,
        motionEventType: finalRow.motionEventType || "TERMINAL"
      };
      return normalizeRows(source);
    }

    const finalTableAngle = number(finalRow.tableAngle, 0);
    if (finalTableAngle >= END_CURVE_DEG - TOLERANCE) {
      // Never create a non-increasing terminal row. Leave genuinely overrun
      // curves visible to validation instead of hiding a separate geometry fault.
      return source;
    }

    source.push(terminalRowFrom(finalRow, source.length));
    return normalizeRows(source);
  }

  function syncPlan(plan, rows) {
    if (!plan || typeof plan !== "object") return;
    const oldSteps = Array.isArray(plan.steps) ? plan.steps : [];
    plan.steps = rows.map((row, index) => {
      const previous = oldSteps[index] || {};
      const eventId = row.motionEventId || previous.eventId || `EV${String(index + 1).padStart(3, "0")}`;
      return {
        ...previous,
        index,
        eventId,
        mechanicalEventId: row.motionEventId || previous.mechanicalEventId || eventId,
        eventType: row.motionEventType || previous.eventType || (row.terminalRest ? "TERMINAL" : "GENERAL"),
        hmi: row.hmi,
        plc: row.plc,
        tableAngle: number(row.tableAngle, 0),
        plateAngle: number(row.plateAngle, 0),
        action: String(row.action || ""),
        baseCommand: number(row.baseCmd, number(row.cmd, 3)),
        requestedCommand: number(row.plannerRequestedCommand, number(row.cmd, 3)),
        recommendedCommand: number(row.cmd, 3),
        recommendedCommandName: row.translatedCommandName || `CMD ${row.cmd}`,
        intent: row.plannerIntent || (Number(row.cmd) === 7 ? "ROTATE" : "HOLD"),
        terminal: row.terminalRest === true
      };
    });

    if (Array.isArray(plan.events)) {
      const events = plan.events.slice(0, Math.min(plan.events.length, rows.length));
      while (events.length < rows.length) {
        const row = rows[events.length];
        events.push({
          id: row.motionEventId || `EV${String(events.length + 1).padStart(3, "0")}`,
          eventId: row.motionEventId || `EV${String(events.length + 1).padStart(3, "0")}`,
          type: row.motionEventType || "TERMINAL",
          eventType: row.motionEventType || "TERMINAL",
          hmi: row.hmi,
          tableAngle: number(row.tableAngle, 0),
          plateAngle: number(row.plateAngle, 0),
          action: String(row.action || "")
        });
      }
      plan.events = events;
    }
  }

  function syncProgramState(rows) {
    const current = runtimeState();
    current.program = rows;

    if (current.motionPlan) {
      current.motionPlan.rows = rows;
      current.motionPlan.finalPlateAngle = rows.at(-1)?.plateAngle;
      current.motionPlan.termination = {
        ...(current.motionPlan.termination || {}),
        section: current.motionPlan.termination?.section || "end-curve",
        hmi: rows.at(-1)?.hmi,
        tableAngle: rows.at(-1)?.tableAngle,
        command: "Rest"
      };
      syncPlan(current.motionPlan.planner, rows);
    }

    if (current.motionTranslation) {
      current.motionTranslation.rows = rows;
      syncPlan(current.motionTranslation.plan, rows);
      current.motionTranslation.commandSummary = rows.reduce((summary, row) => {
        const command = String(row.cmd);
        summary[command] = (summary[command] || 0) + 1;
        return summary;
      }, {});
    }

    syncPlan(current.plannerPreview, rows);

    const grammar = global.LabelerMachineFamilyGrammarDriver;
    if (typeof grammar?.annotateCorrectionChains === "function") {
      const annotated = grammar.annotateCorrectionChains(rows, machineContext(rows));
      current.program = annotated.rows;
      if (current.motionPlan) current.motionPlan.rows = current.program;
      if (current.motionTranslation) current.motionTranslation.rows = current.program;
      syncPlan(current.motionPlan?.planner, current.program);
      syncPlan(current.motionTranslation?.plan, current.program);
      syncPlan(current.plannerPreview, current.program);
      current.machineFamilyGrammar = {
        family: annotated.family,
        rule: annotated.rule,
        chains: annotated.chains,
        chainCount: annotated.chains.length
      };
    }

    current.machineTerminalPolicy = {
      family: "AUTOCOL",
      mode: "END_CURVE",
      finalHmi: current.program.at(-1)?.hmi,
      finalCommand: current.program.at(-1)?.cmd,
      finalAction: current.program.at(-1)?.action
    };
    return current.program;
  }

  function applyAutocolTerminalBoundary() {
    const current = runtimeState();
    if (!Array.isArray(current.program) || !current.program.length) return false;
    if (machineFamily(current.program) !== "AUTOCOL") return false;
    const nextRows = ensureAutocolEndCurve(current.program);
    const changed = nextRows.length !== current.program.length
      || !isValidEndCurve(current.program.at(-1));
    if (!changed) return false;
    syncProgramState(nextRows);
    return true;
  }

  function installGenerationHook() {
    let current;
    try { current = applyGeneratedServoProfile; }
    catch { current = global.applyGeneratedServoProfile; }
    if (typeof current !== "function") return false;
    if (current.autocolTerminalBoundaryV120 === true) return true;

    const wrapped = function applyGeneratedServoProfileWithAutocolTerminalBoundary(...args) {
      const output = current.apply(this, args);
      applyAutocolTerminalBoundary();
      return output;
    };
    wrapped.autocolTerminalBoundaryV120 = true;
    wrapped.previousApplyGeneratedServoProfile = current;

    try { applyGeneratedServoProfile = wrapped; } catch { }
    global.applyGeneratedServoProfile = wrapped;
    return true;
  }

  function install() {
    if (!global.LabelerMachineFamilyGrammarDriver) return false;
    if (!installGenerationHook()) return false;
    applyAutocolTerminalBoundary();

    global.SERVOFORGE_BUILD_ID = BUILD_ID;
    global.SERVOFORGE_BUILD_UPDATED_AT = "Aug 14, 2026 11:19 PM ET";
    const banner = global.document?.querySelector?.(".staging-environment-banner");
    if (banner) {
      const version = String(global.SERVOFORGE_RELEASE_VERSION || "0.9.10");
      banner.textContent = `STAGING ${version} • BUILD ${BUILD_ID} • UPDATED Aug 14, 2026 11:19 PM ET — NOT PRODUCTION`;
    }

    global.ServoForgeAutocolTerminalBoundaryV120 = Object.freeze({
      installed: true,
      buildId: BUILD_ID,
      endCurveDeg: END_CURVE_DEG,
      terminalEventId: TERMINAL_EVENT_ID,
      ensureAutocolEndCurve,
      applyAutocolTerminalBoundary
    });
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, 25);
  }

  wait();
})(window);
