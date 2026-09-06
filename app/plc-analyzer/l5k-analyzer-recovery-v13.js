"use strict";

(function installResetRecovery(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-interlocks-v12.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createResetRecoveryAnalyzer(base) {
  if (!base || typeof base.parseL5K !== "function") {
    throw new Error("ServoForge v12 interlock/permissive analysis is required before v13 reset/recovery analysis.");
  }

  const baseParseL5K = base.parseL5K;
  const baseTraceTarget = base.traceTarget;
  const baseSearchAnalysis = base.searchAnalysis;
  const GATE_INSTRUCTIONS = new Set(["XIC", "XIO", "EQU", "NEQ", "LES", "LEQ", "GRT", "GEQ", "LIM"]);

  function rootSymbol(value) {
    return String(value || "").trim().split(".")[0].replace(/\[[^\]]*\].*$/, "");
  }

  function taskContext(project, program, routine) {
    const scheduling = project?.dependencies?.taskScheduling;
    const schedules = (scheduling?.scheduledPrograms || []).filter((item) => item.program === program);
    return {
      schedules,
      taskRootReachable: Boolean(scheduling?.taskRootReachableRoutines?.includes(`${program || ""}/${routine || ""}`)),
      runtimeExecutionProven: false
    };
  }

  function gateRecord(call) {
    const instruction = call?.name || null;
    const args = (call?.args || []).map((value) => String(value || "").trim());
    if (instruction === "XIC" || instruction === "XIO") {
      return {
        kind: "contact",
        instruction,
        symbol: args[0] || null,
        sense: instruction === "XIC" ? "true-required-source-condition" : "false-required-source-condition",
        args
      };
    }
    return { kind: "comparison", instruction, symbol: args[0] || null, sense: "comparison-source-condition", args };
  }

  function collectResetPaths(project) {
    const timerNames = new Set((project.timers || []).map((item) => item.tag));
    const counterNames = new Set((project.counters || []).map((item) => item.tag));
    const paths = [];

    for (const rung of project.rungs || []) {
      const calls = rung.instructions || [];
      for (const call of calls) {
        if (call.name !== "OTU" && call.name !== "RES") continue;
        const target = String(call.args?.[0] || "").trim();
        if (!target) continue;
        const gates = calls
          .filter((candidate) => GATE_INSTRUCTIONS.has(candidate.name) && Number(candidate.index ?? -1) < Number(call.index ?? Number.MAX_SAFE_INTEGER))
          .map(gateRecord);
        const task = taskContext(project, rung.program || null, rung.routine || null);
        const targetClass = call.name === "OTU"
          ? "unlatch"
          : timerNames.has(target) && counterNames.has(target)
            ? "timer-counter"
            : timerNames.has(target)
              ? "timer"
              : counterNames.has(target)
                ? "counter"
                : "unresolved-res-target";
        paths.push({
          target,
          targetRoot: rootSymbol(target),
          instruction: call.name,
          recoveryKind: call.name === "OTU" ? "unlatch" : "reset-structure",
          targetClass,
          program: rung.program || null,
          routine: rung.routine || null,
          rung: rung.number,
          line: rung.startLine,
          source: rung.source,
          gates,
          schedules: task.schedules,
          taskRootReachable: task.taskRootReachable,
          runtimeExecutionProven: false,
          causeClearedProven: false,
          safeToResetProven: false
        });
      }
    }
    return paths;
  }

  function collectLatchWriters(project) {
    const writers = [];
    for (const rung of project.rungs || []) {
      for (const call of rung.instructions || []) {
        if (call.name !== "OTL") continue;
        const target = String(call.args?.[0] || "").trim();
        if (!target) continue;
        const task = taskContext(project, rung.program || null, rung.routine || null);
        writers.push({
          target,
          targetRoot: rootSymbol(target),
          instruction: "OTL",
          program: rung.program || null,
          routine: rung.routine || null,
          rung: rung.number,
          line: rung.startLine,
          source: rung.source,
          schedules: task.schedules,
          taskRootReachable: task.taskRootReachable,
          runtimeExecutionProven: false
        });
      }
    }
    return writers;
  }

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function buildRelationships(latches, paths) {
    const targets = unique([...latches.map((item) => item.target), ...paths.filter((item) => item.instruction === "OTU").map((item) => item.target)]);
    return targets.map((target) => {
      const targetLatches = latches.filter((item) => item.target === target);
      const unlatches = paths.filter((item) => item.instruction === "OTU" && item.target === target);
      return {
        target,
        latches: targetLatches,
        unlatches,
        latchWriterCount: targetLatches.length,
        unlatchPathCount: unlatches.length,
        sourcePairLocated: targetLatches.length > 0 && unlatches.length > 0,
        runtimeStateProven: false,
        causeClearedProven: false
      };
    });
  }

  function buildFindings(relationships, paths) {
    const findings = [];
    const add = (id, classification, severity, title, summary, evidence) => findings.push({
      id,
      classification,
      severity,
      title,
      summary,
      evidence,
      sourceRule: "plc-reset-recovery-v13"
    });

    for (const relationship of relationships) {
      if (relationship.latchWriterCount > 0 && relationship.unlatchPathCount === 0) {
        add(
          `v13:latch-without-unlatch:${relationship.target}`,
          "static-inference",
          "review",
          `Latched target has no source-visible OTU path: ${relationship.target}`,
          `${relationship.target} has ${relationship.latchWriterCount} source-visible OTL writer(s), but no OTU path was located in the supplied ladder source. This does not prove the target cannot be cleared: reset logic may exist in unsupported/protected logic, another scope, another controller, or a different export/revision. Do not add or force a reset from this finding alone.`,
          relationship
        );
      }
      if (relationship.latchWriterCount === 0 && relationship.unlatchPathCount > 0) {
        add(
          `v13:unlatch-without-latch:${relationship.target}`,
          "static-inference",
          "info",
          `OTU target has no source-visible OTL writer: ${relationship.target}`,
          `${relationship.target} has ${relationship.unlatchPathCount} source-visible OTU path(s), but no OTL writer was located in the supplied ladder source. This can be intentional when the producer is outside the visible ladder scope or export. It is not proof of invalid reset logic.`,
          relationship
        );
      }
    }

    for (const path of paths.filter((item) => item.instruction === "RES" && item.targetClass === "unresolved-res-target")) {
      add(
        `v13:res-target-unresolved:${path.program || "?"}:${path.routine || "?"}:${path.rung}:${path.target}`,
        "static-inference",
        "info",
        `RES target is not resolved as a native timer/counter: ${path.target}`,
        `A source-visible RES(${path.target}) instruction was found, but ${path.target} was not resolved by the current parser as a native TON/TOF/RTO or CTU/CTD instance. RES can be used with other control structures or source may be incomplete, so this is a review cue only.`,
        path
      );
    }

    return findings;
  }

  function parseL5K(input, options = {}) {
    const project = baseParseL5K(input, options);
    const paths = collectResetPaths(project);
    const latchWriters = collectLatchWriters(project);
    const relationships = buildRelationships(latchWriters, paths);
    const findings = buildFindings(relationships, paths);
    const unlatchPaths = paths.filter((item) => item.instruction === "OTU");
    const resPaths = paths.filter((item) => item.instruction === "RES");
    const paired = relationships.filter((item) => item.sourcePairLocated);
    const unpairedLatch = relationships.filter((item) => item.latchWriterCount > 0 && item.unlatchPathCount === 0);

    project.dependencies = project.dependencies || {};
    project.dependencies.resetRecoveryTopology = {
      version: "v13",
      paths,
      unlatchPaths,
      resPaths,
      latchWriters,
      relationships,
      sourceBoundary: "Reset/recovery topology is static L5K source evidence only. OTU and RES call sites do not prove the rung executes, the triggering condition is currently true, the original fault/interlock cause has cleared, the machine is safe to restart, or that a reset should be performed. Never use this analysis to force, bypass, or automatically reset machine or safety logic.",
      statistics: {
        recoveryPaths: paths.length,
        unlatchPaths: unlatchPaths.length,
        resPaths: resPaths.length,
        latchWriters: latchWriters.length,
        pairedLatchTargets: paired.length,
        latchTargetsWithoutUnlatch: unpairedLatch.length
      }
    };
    project.findings = [...(project.findings || []), ...findings];
    project.statistics = {
      ...(project.statistics || {}),
      recoveryPaths: paths.length,
      unlatchPaths: unlatchPaths.length,
      resPaths: resPaths.length,
      pairedLatchTargets: paired.length,
      latchTargetsWithoutUnlatch: unpairedLatch.length,
      findings: (project.findings || []).length
    };
    return project;
  }

  function traceTarget(project, target, options = {}) {
    const trace = baseTraceTarget ? baseTraceTarget(project, target, options) : { target, nodes: [] };
    const topology = project?.dependencies?.resetRecoveryTopology;
    const exact = String(target || "").trim();
    const root = rootSymbol(exact);
    const contexts = (topology?.relationships || [])
      .filter((item) => item.target === exact || rootSymbol(item.target) === root)
      .map((item) => ({
        target: item.target,
        latches: item.latches,
        unlatches: item.unlatches,
        sourcePairLocated: item.sourcePairLocated,
        runtimeStateProven: false,
        causeClearedProven: false,
        safeToResetProven: false
      }));
    const resContexts = (topology?.resPaths || []).filter((item) => item.target === exact || rootSymbol(item.target) === root);
    return {
      ...trace,
      resetRecoveryContexts: contexts,
      resRecoveryContexts: resContexts,
      resetStateProven: false,
      resetSafetyProven: false,
      note: `${trace.note ? `${trace.note} ` : ""}v13 reset/recovery evidence does not prove that a reset executes, clears the originating cause, or is safe to perform.`.trim()
    };
  }

  function searchAnalysis(project, query, limit = 50) {
    const baseResults = baseSearchAnalysis ? baseSearchAnalysis(project, query, limit) : [];
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return baseResults;
    const topology = project?.dependencies?.resetRecoveryTopology;
    const extra = [];
    for (const path of topology?.paths || []) {
      const haystack = JSON.stringify(path).toLowerCase();
      if (!haystack.includes(needle)) continue;
      extra.push({
        type: "recovery-path",
        key: `${path.program || "?"}/${path.routine || "?"}/${path.rung}/${path.instruction}/${path.target}`,
        title: `${path.instruction} • ${path.target}`,
        detail: `${path.program || "?"}/${path.routine || "?"} rung ${path.rung} • ${path.gates.length} source-visible gate(s)`,
        score: String(path.target).toLowerCase() === needle ? 125 : 82,
        source: path.source
      });
    }
    return [...extra, ...baseResults].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
  }

  return Object.freeze({
    ...base,
    version: "l5k-analyzer-v13",
    parseL5K,
    traceTarget,
    searchAnalysis,
    collectResetPaths,
    collectLatchWriters,
    buildRelationships
  });
});
