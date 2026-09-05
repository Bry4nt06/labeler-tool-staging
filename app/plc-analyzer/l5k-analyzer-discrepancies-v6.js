"use strict";

(function installCallGraphDiscrepancies(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-dependencies-v5.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCallGraphDiscrepancies(base) {
  if (!base || typeof base.parseL5K !== "function") throw new Error("ServoForge dependency analyzer is required before v6 discrepancy rules.");

  const baseParseL5K = base.parseL5K;

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function routineKey(program, routine) {
    return `${program || "?"}/${routine || "?"}`;
  }

  function routineIndex(project) {
    const map = new Map();
    for (const routine of project.routines || []) {
      const key = routineKey(routine.program, routine.name);
      if (!map.has(key)) map.set(key, routine);
    }
    return map;
  }

  function callAdjacency(project) {
    const adjacency = new Map();
    for (const call of project.dependencies?.routineCalls || []) {
      const from = routineKey(call.program, call.callerRoutine);
      const to = routineKey(call.program, call.calleeRoutine);
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push({ to, call });
    }
    return adjacency;
  }

  function reachableFromMain(project) {
    const routines = routineIndex(project);
    const adjacency = callAdjacency(project);
    const reachable = new Set();
    const roots = [];

    for (const program of project.dependencies?.programMainRoutines || []) {
      if (!program.mainRoutine) continue;
      const key = routineKey(program.program, program.mainRoutine);
      roots.push(key);
      if (!routines.has(key)) continue;
      const stack = [key];
      while (stack.length) {
        const current = stack.pop();
        if (reachable.has(current)) continue;
        reachable.add(current);
        for (const edge of adjacency.get(current) || []) {
          if (!reachable.has(edge.to)) stack.push(edge.to);
        }
      }
    }
    return { reachable, roots, routines, adjacency };
  }

  function detectCallCycles(project) {
    const { adjacency } = reachableFromMain(project);
    const nodes = unique([
      ...(project.routines || []).map((routine) => routineKey(routine.program, routine.name)),
      ...[...adjacency.keys()]
    ]);
    const state = new Map();
    const stack = [];
    const cycles = new Map();

    function canonicalCycle(path) {
      if (!path.length) return "";
      const body = path[path.length - 1] === path[0] ? path.slice(0, -1) : path.slice();
      if (!body.length) return "";
      const variants = body.map((_, index) => body.slice(index).concat(body.slice(0, index)));
      variants.sort((a, b) => a.join("→").localeCompare(b.join("→")));
      return variants[0].join("→");
    }

    function visit(node) {
      state.set(node, 1);
      stack.push(node);
      for (const edge of adjacency.get(node) || []) {
        const next = edge.to;
        const nextState = state.get(next) || 0;
        if (nextState === 0) visit(next);
        else if (nextState === 1) {
          const start = stack.lastIndexOf(next);
          const path = stack.slice(start).concat(next);
          const key = canonicalCycle(path);
          if (key && !cycles.has(key)) cycles.set(key, { path, closingCall: edge.call });
        }
      }
      stack.pop();
      state.set(node, 2);
    }

    for (const node of nodes) if (!state.get(node)) visit(node);
    return [...cycles.values()];
  }

  function aoiInstanceTypeMismatches(project) {
    const definitions = new Set((project.dependencies?.aoiDefinitions || []).map((item) => item.name));
    const tags = project.dependencies?.scopedTags || [];
    const mismatches = [];
    for (const call of project.dependencies?.aoiCalls || []) {
      if (!call.instanceTag || !definitions.has(call.definition)) continue;
      const tag = tags.find((item) => item.name === call.instanceTag && item.program === call.program)
        || tags.find((item) => item.name === call.instanceTag && item.scope === "controller")
        || tags.find((item) => item.name === call.instanceTag);
      if (!tag) continue;
      const declaredType = String(tag.dataType || "").replace(/\[[^\]]+\]$/, "");
      if (declaredType && declaredType !== call.definition) mismatches.push({ call, tag, declaredType, expectedType: call.definition });
    }
    return mismatches;
  }

  function buildV6Findings(project) {
    const findings = [];
    const add = (id, classification, severity, title, summary, evidence = {}) => {
      findings.push({ id, classification, severity, title, summary, evidence, sourceRule: "plc-callgraph-discrepancies-v6" });
    };

    const dependencies = project.dependencies || {};
    const { reachable, routines } = reachableFromMain(project);
    const programMain = dependencies.programMainRoutines || [];
    const calls = dependencies.routineCalls || [];

    for (const program of programMain) {
      if (!program.mainRoutine) {
        add(
          `v6:main-unidentified:${program.program}`,
          "static-inference",
          "info",
          `MAIN routine not identified for ${program.program}`,
          `The supplied export contains PROGRAM ${program.program}, but this analyzer did not locate a source-visible MAIN routine declaration for it. This can reflect export/revision structure; verify before treating the program as unscheduled.`,
          { program }
        );
        continue;
      }
      const key = routineKey(program.program, program.mainRoutine);
      if (!routines.has(key)) {
        add(
          `v6:main-target-missing:${program.program}:${program.mainRoutine}`,
          "source-proven",
          "review",
          `PROGRAM MAIN target not present: ${program.program}/${program.mainRoutine}`,
          `PROGRAM ${program.program} declares MAIN := ${program.mainRoutine}, but no ROUTINE ${program.mainRoutine} in that program was recognized in the supplied export. This is a source/export discrepancy; verify project completeness and intended revision before diagnosing the machine.`,
          { program, expectedRoutineKey: key }
        );
      }
    }

    for (const call of calls) {
      const target = routineKey(call.program, call.calleeRoutine);
      if (routines.has(target)) continue;
      add(
        `v6:jsr-target-missing:${call.program || "?"}:${call.callerRoutine || "?"}:${call.rung}:${call.calleeRoutine}`,
        "source-proven",
        "review",
        `JSR target not present: ${call.calleeRoutine}`,
        `${call.callerRoutine || "A routine"} contains a source-visible JSR to ${call.calleeRoutine}, but that target routine was not recognized in the same program in the supplied export. Verify whether the export is complete, the call is revision-specific, or the target naming changed.`,
        { call, expectedRoutineKey: target }
      );
    }

    for (const cycle of detectCallCycles(project)) {
      add(
        `v6:call-cycle:${cycle.path.join("->")}`,
        "static-inference",
        "review",
        "Routine call cycle detected",
        `The source-visible JSR graph contains a cycle: ${cycle.path.join(" → ")}. This is not proof of an executing recursion fault; verify guards, conditional calls, and intended revision before drawing a runtime conclusion.`,
        { cycle }
      );
    }

    const orphanByProgram = new Map();
    for (const routine of project.routines || []) {
      const key = routineKey(routine.program, routine.name);
      if (reachable.has(key)) continue;
      const program = routine.program || "(unscoped)";
      if (!orphanByProgram.has(program)) orphanByProgram.set(program, []);
      orphanByProgram.get(program).push(routine);
    }
    for (const [program, orphanRoutines] of orphanByProgram) {
      const names = orphanRoutines.map((routine) => routine.name);
      add(
        `v6:routines-not-main-reachable:${program}`,
        "static-inference",
        "info",
        `Routines not source-reachable from MAIN in ${program}`,
        `${names.length} routine${names.length === 1 ? " is" : "s are"} not reachable through the source-visible JSR graph starting at the identified MAIN routine: ${names.slice(0, 12).join(", ")}${names.length > 12 ? `, +${names.length - 12} more` : ""}. These may be intentionally unused, invoked through unsupported language/task mechanisms, or revision artifacts; this is a review cue, not a defect finding.`,
        { program, routines: orphanRoutines, main: programMain.find((item) => item.program === program) || null }
      );
    }

    const unreachableFaults = [];
    for (const fault of project.faultWriters || []) {
      for (const writer of fault.writers || []) {
        if (!writer.routine || !writer.program) continue;
        const key = routineKey(writer.program, writer.routine);
        if (reachable.has(key)) continue;
        unreachableFaults.push({ target: fault.target, writer, routineKey: key });
      }
    }
    if (unreachableFaults.length) {
      add(
        "v6:fault-writers-not-main-reachable",
        "static-inference",
        "review",
        "Fault writers not source-reachable from identified MAIN routines",
        `${unreachableFaults.length} fault-writer location${unreachableFaults.length === 1 ? " is" : "s are"} outside the source-visible JSR graph reachable from identified PROGRAM MAIN routines. This does not prove the faults are dead; verify task/program scheduling, unsupported language calls, and project revision before using this as a diagnosis.`,
        { writers: unreachableFaults }
      );
    }

    for (const mismatch of aoiInstanceTypeMismatches(project)) {
      add(
        `v6:aoi-instance-type:${mismatch.call.program || "?"}:${mismatch.call.routine || "?"}:${mismatch.call.rung}:${mismatch.call.instanceTag}`,
        "source-proven",
        "review",
        `AOI instance type differs from invocation: ${mismatch.call.instanceTag}`,
        `${mismatch.call.definition}(...) uses ${mismatch.call.instanceTag} as its source-visible instance argument, but that tag is declared as ${mismatch.declaredType} in the supplied export rather than ${mismatch.expectedType}. Verify the export syntax/revision before treating this as a configuration defect.`,
        mismatch
      );
    }

    return findings;
  }

  function parseL5K(input, options = {}) {
    const project = baseParseL5K(input, options);
    const v6Findings = buildV6Findings(project);
    const existingIds = new Set((project.findings || []).map((item) => item.id));
    project.findings = [...(project.findings || []), ...v6Findings.filter((item) => !existingIds.has(item.id))];
    project.dependencies = {
      ...(project.dependencies || {}),
      discrepancyAnalysis: {
        version: "v6",
        evidenceClass: "static-callgraph-review",
        findings: v6Findings,
        sourceBoundary: "Call-graph reachability is derived only from source-visible PROGRAM MAIN and JSR relationships. A routine reported as unreachable may still be invoked through unsupported language/task mechanisms or exist intentionally."
      }
    };
    project.statistics = {
      ...(project.statistics || {}),
      findings: project.findings.length,
      callGraphFindings: v6Findings.length
    };
    return project;
  }

  return Object.freeze({
    ...base,
    parseL5K,
    buildCallGraphFindings: buildV6Findings,
    callGraphDiscrepancies: Object.freeze({
      version: "v6",
      reachableFromMain,
      detectCallCycles,
      aoiInstanceTypeMismatches
    })
  });
});
