"use strict";

(function installInterlockAnalyzer(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-sequence-v11.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createInterlockAnalyzer(base) {
  if (!base || typeof base.parseL5K !== "function") throw new Error("ServoForge v11 analyzer is required before v12 interlock/permissive analysis.");

  const baseParseL5K = base.parseL5K;
  const baseTraceTarget = base.traceTarget;
  const baseSearchAnalysis = base.searchAnalysis;
  const CONTACTS = new Set(["XIC", "XIO"]);
  const COMPARISONS = new Set(["EQU", "NEQ", "LES", "LEQ", "GRT", "GEQ", "LIM"]);
  const ACTIONS = new Set(["OTE", "OTL", "MSO", "MSF", "MAH", "MAR", "MAM", "MAS", "MAJ", "MAG", "MAPC", "MCD", "MCS"]);
  const MOTION_ACTIONS = new Set(["MSO", "MSF", "MAH", "MAR", "MAM", "MAS", "MAJ", "MAG", "MAPC", "MCD", "MCS"]);

  function rootSymbol(value) {
    return String(value || "").trim().split(".")[0].replace(/\[[^\]]*\].*$/, "");
  }

  function safeId(value) {
    return String(value || "").replace(/[^A-Za-z0-9_.:-]+/g, "_").slice(0, 180);
  }

  function gateRecord(call) {
    if (CONTACTS.has(call.name)) {
      const symbol = String(call.args?.[0] || "").trim();
      if (!symbol) return null;
      return {
        kind: "contact",
        instruction: call.name,
        symbol,
        sense: call.name === "XIC" ? "true-required" : "false-required",
        args: call.args || [],
        raw: call.raw,
        index: call.index,
        runtimeStateProven: false
      };
    }
    if (COMPARISONS.has(call.name)) {
      return {
        kind: "comparison",
        instruction: call.name,
        symbol: String(call.args?.[0] || "").trim() || null,
        sense: "comparison-required",
        args: call.args || [],
        raw: call.raw,
        index: call.index,
        runtimeStateProven: false
      };
    }
    return null;
  }

  function actionTarget(call) {
    return String(call.args?.[0] || "").trim() || null;
  }

  function gateSignature(gates) {
    return (gates || []).map((gate) => `${gate.instruction}:${gate.args.join(",")}`).sort().join("|");
  }

  function producerRelations(project, symbol, program) {
    if (!symbol) return [];
    const root = rootSymbol(symbol);
    return (project?.dependencies?.writeRelations || [])
      .filter((relation) => {
        const sameProgram = !program || !relation.program || relation.program === program;
        const destination = String(relation.destination || "");
        return sameProgram && (destination === symbol || rootSymbol(destination) === root);
      })
      .slice(0, 12);
  }

  function taskContext(project, program, routine) {
    const scheduling = project?.dependencies?.taskScheduling;
    return {
      schedules: (scheduling?.scheduledPrograms || []).filter((item) => item.program === program),
      taskRootReachable: Boolean(scheduling?.taskRootReachableRoutines?.includes(`${program || ""}/${routine || ""}`)),
      runtimeExecutionProven: false
    };
  }

  function collectActionPaths(project) {
    const paths = [];
    for (const rung of project.rungs || []) {
      const calls = rung.instructions || [];
      for (const action of calls.filter((call) => ACTIONS.has(call.name))) {
        const target = actionTarget(action);
        if (!target) continue;
        const gates = calls
          .filter((call) => call.index < action.index && (CONTACTS.has(call.name) || COMPARISONS.has(call.name)))
          .map(gateRecord)
          .filter(Boolean);
        const contacts = gates.filter((gate) => gate.kind === "contact");
        const xic = contacts.filter((gate) => gate.instruction === "XIC");
        const xio = contacts.filter((gate) => gate.instruction === "XIO");
        const selfHold = xic.some((gate) => gate.symbol === target || rootSymbol(gate.symbol) === rootSymbol(target));
        const task = taskContext(project, rung.program || null, rung.routine || null);
        paths.push({
          id: `${rung.program || "?"}/${rung.routine || "?"}/${rung.number}:${action.name}:${target}`,
          target,
          targetRoot: rootSymbol(target),
          actionInstruction: action.name,
          actionKind: MOTION_ACTIONS.has(action.name) ? "motion-action" : "output-write",
          program: rung.program || null,
          routine: rung.routine || null,
          rung: rung.number,
          line: rung.startLine,
          source: rung.source,
          gates,
          trueRequiredContacts: xic,
          falseRequiredContacts: xio,
          comparisons: gates.filter((gate) => gate.kind === "comparison"),
          selfHoldCandidate: selfHold,
          gateSignature: gateSignature(gates),
          taskSchedules: task.schedules,
          taskRootReachable: task.taskRootReachable,
          runtimeExecutionProven: false,
          runtimeGateStateProven: false,
          booleanBranchSemanticsProven: false
        });
      }
    }
    return paths;
  }

  function enrichGateProducers(project, path) {
    return {
      ...path,
      gates: path.gates.map((gate) => ({
        ...gate,
        producerRelations: gate.symbol ? producerRelations(project, gate.symbol, path.program) : []
      }))
    };
  }

  function buildFindings(project, paths) {
    const findings = [];
    const add = (id, classification, severity, title, summary, evidence) => findings.push({
      id,
      classification,
      severity,
      title,
      summary,
      evidence,
      sourceRule: "plc-interlocks-v12"
    });

    const byTarget = new Map();
    for (const path of paths) {
      if (!byTarget.has(path.target)) byTarget.set(path.target, []);
      byTarget.get(path.target).push(path);
      if (path.selfHoldCandidate) {
        add(
          `v12:self-hold:${safeId(path.id)}`,
          "static-inference",
          "info",
          `Self-hold / seal-in contact candidate: ${path.target}`,
          `${path.target} is written by ${path.actionInstruction} on a rung that also contains a source-visible XIC reference to the same target before the writer. This is a seal-in candidate only; branch structure and live contact state are not proven by the offline export.`,
          { path: enrichGateProducers(project, path) }
        );
      }
    }

    for (const [target, targetPaths] of byTarget) {
      if (targetPaths.length < 2) continue;
      const signatures = [...new Set(targetPaths.map((path) => path.gateSignature))];
      if (signatures.length < 2) continue;
      add(
        `v12:multiple-permissive-paths:${safeId(target)}`,
        "static-inference",
        "review",
        `Multiple source-visible permissive paths: ${target}`,
        `${target} has ${targetPaths.length} source-visible action writers with differing same-rung contact/comparison evidence. Multiple paths can be intentional. Review which writer/routine is intended for the machine state; this does not prove conflicting live logic or a defect.`,
        { target, paths: targetPaths.map((path) => enrichGateProducers(project, path)) }
      );
    }
    return findings;
  }

  function parseL5K(input, options = {}) {
    const project = baseParseL5K(input, options);
    const actionPaths = collectActionPaths(project);
    const findings = buildFindings(project, actionPaths);
    const existing = new Set((project.findings || []).map((item) => item.id));
    const uniqueFindings = findings.filter((item) => !existing.has(item.id));
    const gated = actionPaths.filter((path) => path.gates.length);
    const topology = {
      version: "v12",
      evidenceClass: "static-interlock-permissive-topology",
      actionPaths,
      byTarget: [...new Set(actionPaths.map((path) => path.target))].map((target) => ({
        target,
        paths: actionPaths.filter((path) => path.target === target)
      })),
      sourceBoundary: "v12 reports source-visible same-rung contact/comparison evidence that appears before OTE/OTL and supported motion actions. It is not a Boolean ladder solver: parallel branch semantics, scan order, live contact values, current permissive state, physical interlocks, and runtime execution are not proven. XIC/XIO are shown as source conditions, not as proof that a condition is currently permitting or blocking an action."
    };
    project.dependencies = { ...(project.dependencies || {}), interlockTopology: topology };
    project.findings = [...(project.findings || []), ...uniqueFindings];
    project.statistics = {
      ...(project.statistics || {}),
      findings: project.findings.length,
      interlockActionPaths: actionPaths.length,
      gatedActionPaths: gated.length,
      interlockGateEvidence: gated.reduce((sum, path) => sum + path.gates.length, 0),
      selfHoldCandidates: actionPaths.filter((path) => path.selfHoldCandidate).length,
      interlockFindings: uniqueFindings.length
    };
    return project;
  }

  function traceTarget(project, target, options = {}) {
    const trace = baseTraceTarget ? baseTraceTarget(project, target, options) : { target, nodes: [] };
    const needle = String(target || "").trim();
    const root = rootSymbol(needle);
    const contexts = (project?.dependencies?.interlockTopology?.actionPaths || [])
      .filter((path) => path.target === needle || path.targetRoot === root)
      .map((path) => enrichGateProducers(project, path));
    return {
      ...trace,
      interlockContexts: contexts,
      permissiveStateProven: false,
      booleanBranchSemanticsProven: false,
      note: `${trace.note ? `${trace.note} ` : ""}v12 same-rung XIC/XIO/comparison evidence does not prove which contacts are currently true/false, that every displayed condition is series-required through branch structure, or that the action is executing.`.trim()
    };
  }

  function searchAnalysis(project, query, limit = 50) {
    const baseResults = baseSearchAnalysis ? baseSearchAnalysis(project, query, limit) : [];
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return baseResults;
    const extra = [];
    for (const path of project?.dependencies?.interlockTopology?.actionPaths || []) {
      const haystack = JSON.stringify({ target: path.target, gates: path.gates, program: path.program, routine: path.routine, source: path.source }).toLowerCase();
      if (!haystack.includes(needle)) continue;
      extra.push({
        type: "rung",
        key: `${path.program || ""}/${path.routine || ""}/${path.rung}`,
        title: `${path.target} • ${path.actionInstruction} permissive path`,
        detail: `${path.program || "?"}/${path.routine || "?"} rung ${path.rung} • ${path.gates.length} source-visible gate${path.gates.length === 1 ? "" : "s"}`,
        score: path.target.toLowerCase() === needle ? 124 : 88,
        source: path.source
      });
    }
    return [...extra, ...baseResults]
      .filter((item, index, all) => all.findIndex((candidate) => `${candidate.type}|${candidate.key}|${candidate.title}` === `${item.type}|${item.key}|${item.title}`) === index)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);
  }

  return Object.freeze({
    ...base,
    version: "l5k-analyzer-v12",
    parseL5K,
    traceTarget,
    searchAnalysis,
    collectInterlockActionPaths: collectActionPaths,
    buildInterlockFindings: buildFindings
  });
});
