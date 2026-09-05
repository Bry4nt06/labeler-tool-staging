"use strict";

(function installSequenceTopology(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-consistency-v10.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSequenceTopology(base) {
  if (!base || typeof base.parseL5K !== "function" || typeof base.parseInstructionCalls !== "function") {
    throw new Error("ServoForge v10 analyzer is required before v11 sequence topology.");
  }

  const baseParseL5K = base.parseL5K;
  const baseSearchAnalysis = base.searchAnalysis;
  const COMPARISON_INSTRUCTIONS = new Set(["EQU", "NEQ", "LES", "LEQ", "GRT", "GEQ", "LIM"]);
  const CONTACT_INSTRUCTIONS = new Set(["XIC", "XIO"]);

  function rootSymbol(value) {
    return String(value || "").trim().split(".")[0].replace(/\[[^\]]*\].*$/, "");
  }

  function normalizeSymbol(value) {
    return String(value || "").trim();
  }

  function numericLiteral(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const compact = raw.replace(/_/g, "");
    const radix = /^([+-]?)(2|8|10|16)#([0-9A-F]+)$/i.exec(compact);
    if (radix) {
      const parsed = Number.parseInt(radix[3], Number(radix[2]));
      if (!Number.isFinite(parsed)) return null;
      const valueNumber = radix[1] === "-" ? -parsed : parsed;
      return { raw, value: valueNumber, canonical: String(valueNumber) };
    }
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(compact)) return null;
    const parsed = Number(compact);
    return Number.isFinite(parsed) ? { raw, value: parsed, canonical: String(parsed) } : null;
  }

  function sortedNumeric(values) {
    return [...new Set((values || []).map(String))].sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }

  function safeId(value) {
    return String(value || "unknown").replace(/[^A-Za-z0-9_.:[\]-]+/g, "_");
  }

  function resolveScope(project, symbol, program) {
    const root = rootSymbol(symbol);
    const tags = project?.dependencies?.scopedTags || [];
    const programTag = tags.find((tag) => tag.name === root && tag.program === program);
    if (programTag) return { scopeKind: "program-proven", scope: program, declaration: programTag };
    const controllerTag = tags.find((tag) => tag.name === root && tag.scope === "controller");
    if (controllerTag) return { scopeKind: "controller-proven", scope: "controller", declaration: controllerTag };
    return { scopeKind: "unresolved", scope: program || "unscoped", declaration: null };
  }

  function identity(project, symbol, program) {
    const normalized = normalizeSymbol(symbol);
    const scope = resolveScope(project, normalized, program || null);
    return {
      symbol: normalized,
      scopeKind: scope.scopeKind,
      scope: scope.scope,
      declaration: scope.declaration,
      key: `${scope.scopeKind}:${scope.scope}:${normalized}`
    };
  }

  // CLR is valid Logix ladder syntax but is not part of the older core KNOWN_INSTRUCTIONS set.
  // Keep this compatibility extraction local to v11 so earlier parser behavior remains stable.
  function sequenceInstructionCalls(source) {
    const text = String(source || "");
    const calls = [...base.parseInstructionCalls(text)];
    const seen = new Set(calls.map((call) => `${call.name}|${call.index}|${call.raw}`));
    const clr = /\bCLR\s*\(\s*([^()]+?)\s*\)/gi;
    let match;
    while ((match = clr.exec(text))) {
      const call = { name: "CLR", args: [match[1].trim()], raw: match[0], index: match.index };
      const key = `${call.name}|${call.index}|${call.raw}`;
      if (!seen.has(key)) {
        calls.push(call);
        seen.add(key);
      }
    }
    return calls.sort((a, b) => (a.index || 0) - (b.index || 0));
  }

  function stateGateFromCall(call) {
    const args = call.args || [];
    if (!COMPARISON_INSTRUCTIONS.has(call.name)) return null;
    if (call.name === "LIM" && args.length >= 3) {
      const low = numericLiteral(args[0]);
      const test = normalizeSymbol(args[1]);
      const high = numericLiteral(args[2]);
      if (!low || !high || !test || numericLiteral(test)) return null;
      return {
        instruction: call.name,
        symbol: test,
        exact: false,
        state: null,
        low: low.canonical,
        high: high.canonical,
        rawLow: low.raw,
        rawHigh: high.raw,
        source: call.raw
      };
    }
    if (args.length < 2) return null;
    const leftNumeric = numericLiteral(args[0]);
    const rightNumeric = numericLiteral(args[1]);
    if (!leftNumeric && rightNumeric) {
      return {
        instruction: call.name,
        symbol: normalizeSymbol(args[0]),
        exact: call.name === "EQU",
        state: rightNumeric.canonical,
        rawState: rightNumeric.raw,
        numericSide: "right",
        source: call.raw
      };
    }
    if (leftNumeric && !rightNumeric) {
      return {
        instruction: call.name,
        symbol: normalizeSymbol(args[1]),
        exact: call.name === "EQU",
        state: leftNumeric.canonical,
        rawState: leftNumeric.raw,
        numericSide: "left",
        source: call.raw
      };
    }
    return null;
  }

  function assignmentFromCall(call) {
    const args = call.args || [];
    if (call.name === "CLR" && args[0]) {
      const destination = normalizeSymbol(args[0]);
      return destination ? { instruction: "CLR", symbol: destination, state: "0", rawState: "0", source: call.raw } : null;
    }
    if (call.name === "MOV" && args.length >= 2) {
      const value = numericLiteral(args[0]);
      const destination = normalizeSymbol(args[1]);
      if (value && destination && !numericLiteral(destination)) {
        return { instruction: "MOV", symbol: destination, state: value.canonical, rawState: value.raw, source: call.raw };
      }
    }
    if (call.name === "CPT" && args.length >= 2) {
      const destination = normalizeSymbol(args[0]);
      const expression = numericLiteral(args[1]);
      if (destination && expression && !numericLiteral(destination)) {
        return { instruction: "CPT", symbol: destination, state: expression.canonical, rawState: expression.raw, source: call.raw };
      }
    }
    return null;
  }

  function timerDoneGate(call, project, rung) {
    if (!CONTACT_INSTRUCTIONS.has(call.name) || !call.args?.[0]) return null;
    const source = normalizeSymbol(call.args[0]);
    const match = /^(.+)\.DN$/i.exec(source);
    if (!match) return null;
    const timerTag = match[1];
    const candidates = (project.timers || []).filter((timer) => timer.tag === timerTag);
    const scoped = candidates.find((timer) => (timer.instructions || []).some((item) => item.program === rung.program)) || candidates[0] || null;
    return {
      instruction: call.name,
      tag: timerTag,
      member: "DN",
      sense: call.name === "XIC" ? "done-true" : "done-false",
      source: call.raw,
      numericPresetEvidence: scoped?.presetValues || [],
      runtimeDoneStateProven: false
    };
  }

  function taskContext(project, rung) {
    const scheduling = project?.dependencies?.taskScheduling;
    const program = rung.program || null;
    const routine = rung.routine || null;
    return {
      schedules: (scheduling?.scheduledPrograms || []).filter((item) => item.program === program),
      taskRootReachable: Boolean(scheduling?.taskRootReachableRoutines?.includes(`${program || ""}/${routine || ""}`)),
      runtimeExecutionProven: false
    };
  }

  function collectSequenceEvidence(project) {
    const groups = new Map();
    const rungRecords = [];

    function ensure(id) {
      if (!groups.has(id.key)) {
        groups.set(id.key, {
          key: id.key,
          symbol: id.symbol,
          scopeKind: id.scopeKind,
          scope: id.scope,
          declaration: id.declaration,
          exactGates: [],
          guards: [],
          assignments: [],
          transitions: []
        });
      }
      return groups.get(id.key);
    }

    for (const rung of project.rungs || []) {
      const calls = sequenceInstructionCalls(rung.source || "");
      const gates = [];
      const assignments = [];
      const timerDoneGates = [];

      for (const call of calls) {
        const gate = stateGateFromCall(call);
        if (gate) {
          const id = identity(project, gate.symbol, rung.program || null);
          const record = {
            ...gate,
            key: id.key,
            scopeKind: id.scopeKind,
            scope: id.scope,
            program: rung.program || null,
            routine: rung.routine || null,
            rung: rung.number,
            line: rung.startLine,
            rungSource: rung.source
          };
          gates.push(record);
          const group = ensure(id);
          group.guards.push(record);
          if (gate.exact) group.exactGates.push(record);
        }

        const assignment = assignmentFromCall(call);
        if (assignment) {
          const id = identity(project, assignment.symbol, rung.program || null);
          const record = {
            ...assignment,
            key: id.key,
            scopeKind: id.scopeKind,
            scope: id.scope,
            program: rung.program || null,
            routine: rung.routine || null,
            rung: rung.number,
            line: rung.startLine,
            rungSource: rung.source,
            anchoredByExactGate: false
          };
          assignments.push(record);
          ensure(id).assignments.push(record);
        }

        const timerGate = timerDoneGate(call, project, rung);
        if (timerGate) timerDoneGates.push(timerGate);
      }

      if (gates.length || assignments.length) {
        rungRecords.push({
          program: rung.program || null,
          routine: rung.routine || null,
          rung: rung.number,
          line: rung.startLine,
          source: rung.source,
          gates,
          assignments,
          timerDoneGates,
          instructionCalls: calls.map((call) => ({ name: call.name, raw: call.raw, args: call.args || [] }))
        });
      }
    }

    for (const rungRecord of rungRecords) {
      for (const assignment of rungRecord.assignments) {
        const exact = rungRecord.gates.filter((gate) => gate.exact && gate.key === assignment.key && gate.state !== null);
        if (!exact.length) continue;
        assignment.anchoredByExactGate = true;
        const group = groups.get(assignment.key);
        for (const gate of exact) {
          const task = taskContext(project, rungRecord);
          group.transitions.push({
            id: `${assignment.key}:${gate.state}->${assignment.state}:${rungRecord.program || "?"}:${rungRecord.routine || "?"}:${rungRecord.rung}`,
            symbol: assignment.symbol,
            key: assignment.key,
            from: gate.state,
            to: assignment.state,
            fromLiteral: gate.rawState || gate.state,
            toLiteral: assignment.rawState || assignment.state,
            assignmentInstruction: assignment.instruction,
            program: rungRecord.program,
            routine: rungRecord.routine,
            rung: rungRecord.rung,
            line: rungRecord.line,
            source: rungRecord.source,
            exactGate: gate,
            guards: rungRecord.gates.filter((item) => item !== gate),
            timerDoneGates: rungRecord.timerDoneGates,
            taskSchedules: task.schedules,
            taskRootReachable: task.taskRootReachable,
            runtimeExecutionProven: false,
            runtimeStateProven: false
          });
        }
      }
    }

    const variables = [...groups.values()]
      .filter((group) => group.exactGates.length && group.assignments.length)
      .map((group) => {
        const gatedStates = sortedNumeric(group.exactGates.map((item) => item.state).filter((value) => value !== null));
        const assignedStates = sortedNumeric(group.assignments.map((item) => item.state));
        const states = sortedNumeric([...gatedStates, ...assignedStates]);
        const transitions = group.transitions
          .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
          .sort((a, b) => Number(a.from) - Number(b.from) || Number(a.to) - Number(b.to) || (a.line || 0) - (b.line || 0));
        return {
          ...group,
          gatedStates,
          assignedStates,
          states,
          transitions,
          unanchoredAssignments: group.assignments.filter((item) => !item.anchoredByExactGate),
          sourceBoundary: "State values and transition edges are inferred only from source-visible numeric EQU gates paired with numeric MOV/CLR/CPT assignments to the same scoped symbol. This does not prove runtime state or execution order."
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

    return { variables, rungRecords };
  }

  function buildSequenceFindings(project, topology) {
    const findings = [];
    const add = (id, classification, severity, title, summary, evidence) => findings.push({
      id,
      classification,
      severity,
      title,
      summary,
      evidence,
      sourceRule: "plc-sequence-v11"
    });

    for (const variable of topology.variables) {
      add(
        `v11:sequence-topology:${safeId(variable.key)}`,
        "static-inference",
        "info",
        `Sequence topology identified: ${variable.symbol}`,
        `${variable.symbol} has ${variable.states.length} source-visible numeric state value(s) and ${variable.transitions.length} exact EQU → numeric assignment transition(s). This is a static sequence map only; it does not prove the current state, branch taken, execution order, or that every runtime transition is visible in this export.`,
        {
          variable: variable.symbol,
          scopeKind: variable.scopeKind,
          scope: variable.scope,
          states: variable.states,
          transitions: variable.transitions,
          unanchoredAssignments: variable.unanchoredAssignments
        }
      );

      const byFrom = new Map();
      for (const transition of variable.transitions) {
        if (!byFrom.has(transition.from)) byFrom.set(transition.from, new Set());
        byFrom.get(transition.from).add(transition.to);
      }
      for (const [from, targets] of [...byFrom.entries()].filter(([, values]) => values.size > 1)) {
        add(
          `v11:multiple-targets:${safeId(variable.key)}:${safeId(from)}`,
          "static-inference",
          "review",
          `Sequence state has multiple source-visible targets: ${variable.symbol} = ${from}`,
          `${variable.symbol} state ${from} has source-visible transitions to ${[...targets].join(", ")}. Branching can be intentional; review the attached rung guards and machine sequence intent rather than treating this as a defect.`,
          { variable: variable.symbol, from, targets: [...targets], transitions: variable.transitions.filter((item) => item.from === from) }
        );
      }

      const gated = new Set(variable.gatedStates);
      const assigned = new Set(variable.assignedStates);
      const assignedNeverGated = variable.assignedStates.filter((state) => !gated.has(state));
      if (assignedNeverGated.length) {
        add(
          `v11:assigned-state-not-gated:${safeId(variable.key)}`,
          "static-inference",
          "info",
          `Assigned sequence state has no exact source-visible EQU gate: ${variable.symbol}`,
          `${variable.symbol} is assigned state value(s) ${assignedNeverGated.join(", ")} but no exact numeric EQU gate for those values was located in the supplied ladder source. These can be terminal/reset states or can be handled by other languages, protected logic, external writes, or an incomplete export.`,
          { variable: variable.symbol, states: assignedNeverGated, assignments: variable.assignments.filter((item) => assignedNeverGated.includes(item.state)) }
        );
      }

      const gatedNeverAssigned = variable.gatedStates.filter((state) => !assigned.has(state));
      if (gatedNeverAssigned.length) {
        add(
          `v11:gated-state-not-assigned:${safeId(variable.key)}`,
          "static-inference",
          "info",
          `Gated sequence state has no numeric source-visible assignment: ${variable.symbol}`,
          `${variable.symbol} is tested at state value(s) ${gatedNeverAssigned.join(", ")} but no numeric MOV/CLR/CPT assignment to those values was located in the supplied ladder source. Startup values, HMI/external writes, other languages, protected logic, or export scope can explain this.`,
          { variable: variable.symbol, states: gatedNeverAssigned, gates: variable.exactGates.filter((item) => gatedNeverAssigned.includes(item.state)) }
        );
      }

      if (variable.unanchoredAssignments.length) {
        add(
          `v11:unanchored-state-assignments:${safeId(variable.key)}`,
          "static-inference",
          "info",
          `Sequence assignments outside an exact same-rung state gate: ${variable.symbol}`,
          `${variable.symbol} has ${variable.unanchoredAssignments.length} numeric assignment(s) on rung(s) without an exact same-symbol EQU gate. These commonly represent initialization/reset or alternate paths; v11 preserves them but does not invent a source state for those assignments.`,
          { variable: variable.symbol, assignments: variable.unanchoredAssignments }
        );
      }
    }
    return findings;
  }

  function parseL5K(input, options = {}) {
    const project = baseParseL5K(input, options);
    const collected = collectSequenceEvidence(project);
    const topology = {
      version: "v11",
      evidenceClass: "static-sequence-topology",
      variables: collected.variables,
      sourceBoundary: "v11 infers sequence edges only from source-visible exact numeric EQU state gates paired on the same ladder rung with numeric MOV, CLR, or constant CPT assignments to the same scoped symbol. It does not simulate the PLC and does not prove current state, scan order, branch selection, timer completion, task execution, physical I/O state, or that all sequence writes are visible in the supplied export."
    };
    const findings = buildSequenceFindings(project, topology);
    const existingIds = new Set((project.findings || []).map((item) => item.id));
    const uniqueFindings = findings.filter((item) => !existingIds.has(item.id));
    project.dependencies = { ...(project.dependencies || {}), sequenceTopology: topology };
    project.findings = [...(project.findings || []), ...uniqueFindings];
    project.statistics = {
      ...(project.statistics || {}),
      findings: project.findings.length,
      sequenceVariables: topology.variables.length,
      sequenceStates: topology.variables.reduce((sum, item) => sum + item.states.length, 0),
      sequenceTransitions: topology.variables.reduce((sum, item) => sum + item.transitions.length, 0),
      sequenceFindings: uniqueFindings.length
    };
    return project;
  }

  function searchAnalysis(project, query, limit = 50) {
    const baseResults = baseSearchAnalysis ? baseSearchAnalysis(project, query, limit) : [];
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return baseResults;
    const extra = [];
    for (const variable of project?.dependencies?.sequenceTopology?.variables || []) {
      for (const transition of variable.transitions || []) {
        const haystack = JSON.stringify({
          symbol: variable.symbol,
          scope: variable.scope,
          from: transition.from,
          to: transition.to,
          guards: transition.guards,
          timers: transition.timerDoneGates,
          source: transition.source
        }).toLowerCase();
        if (!haystack.includes(needle)) continue;
        extra.push({
          type: "rung",
          key: `${transition.program || ""}/${transition.routine || ""}/${transition.rung}`,
          title: `${variable.symbol}: state ${transition.from} → ${transition.to}`,
          detail: `${transition.program || "?"}/${transition.routine || "?"} rung ${transition.rung}${transition.timerDoneGates.length ? ` • ${transition.timerDoneGates.map((item) => `${item.tag}.DN`).join(", ")}` : ""}`,
          score: variable.symbol.toLowerCase() === needle ? 122 : 86,
          source: transition.source
        });
      }
    }
    return [...extra, ...baseResults]
      .filter((item, index, all) => all.findIndex((candidate) => `${candidate.type}|${candidate.key}|${candidate.title}` === `${item.type}|${item.key}|${item.title}`) === index)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);
  }

  return Object.freeze({
    ...base,
    version: "l5k-analyzer-v11",
    parseL5K,
    searchAnalysis,
    collectSequenceEvidence,
    buildSequenceFindings,
    parseSequenceNumericLiteral: numericLiteral
  });
});
