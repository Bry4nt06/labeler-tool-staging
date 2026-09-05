"use strict";

(function installSequenceCompare(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-compare-consistency-v10-1.js")
    : root?.ServoForgeL5KCompare;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSequenceCompare(base) {
  if (!base || typeof base.compareProjects !== "function") {
    throw new Error("ServoForge v10.1 consistency comparison is required before v11.1 sequence comparison.");
  }

  const baseCompareProjects = base.compareProjects;

  function sortedUnique(values) {
    return [...new Set((values || []).filter((value) => value !== null && value !== undefined).map(String))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== "object") return value;
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }

  function same(a, b) {
    return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  }

  function topology(project) {
    return project?.dependencies?.sequenceTopology || null;
  }

  function variableMap(project) {
    return new Map((topology(project)?.variables || []).map((item) => [item.key, item]));
  }

  function guardSnapshot(item) {
    return {
      instruction: item?.instruction || null,
      symbol: item?.symbol || null,
      state: item?.state ?? null,
      low: item?.low ?? null,
      high: item?.high ?? null,
      source: item?.source || null
    };
  }

  function timerSnapshot(item) {
    return {
      instruction: item?.instruction || null,
      tag: item?.tag || null,
      member: item?.member || null,
      sense: item?.sense || null,
      numericPresetEvidence: sortedUnique(item?.numericPresetEvidence || [])
    };
  }

  function transitionSnapshot(item) {
    return {
      from: String(item?.from ?? ""),
      to: String(item?.to ?? ""),
      assignmentInstruction: item?.assignmentInstruction || null,
      program: item?.program || null,
      routine: item?.routine || null,
      rung: item?.rung ?? null,
      guards: (item?.guards || []).map(guardSnapshot),
      timerDoneGates: (item?.timerDoneGates || []).map(timerSnapshot),
      taskSchedules: (item?.taskSchedules || []).map((schedule) => ({ task: schedule.task || null, order: schedule.order ?? null })),
      taskRootReachable: Boolean(item?.taskRootReachable),
      source: item?.source || null
    };
  }

  function transitionKey(item) {
    return `${String(item?.from ?? "")}->${String(item?.to ?? "")}`;
  }

  function transitionMap(variable) {
    const map = new Map();
    for (const transition of variable?.transitions || []) {
      const key = transitionKey(transition);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(transitionSnapshot(transition));
    }
    for (const [key, values] of map.entries()) {
      map.set(key, values.sort((a, b) => `${a.program}/${a.routine}/${a.rung}`.localeCompare(`${b.program}/${b.routine}/${b.rung}`, undefined, { numeric: true })));
    }
    return map;
  }

  function variableSnapshot(variable) {
    if (!variable) return null;
    return {
      symbol: variable.symbol,
      scopeKind: variable.scopeKind,
      scope: variable.scope,
      states: sortedUnique(variable.states || []),
      gatedStates: sortedUnique(variable.gatedStates || []),
      assignedStates: sortedUnique(variable.assignedStates || []),
      transitionCount: (variable.transitions || []).length,
      unanchoredAssignmentCount: (variable.unanchoredAssignments || []).length
    };
  }

  function difference(changeType, key, title, summary, options = {}) {
    return {
      id: `sequences:${changeType}:${key}`,
      category: "sequences",
      sequenceKind: options.sequenceKind || "sequence-topology",
      changeType,
      key,
      title,
      summary,
      classification: options.classification || "static-inference",
      reviewLevel: options.reviewLevel || "review",
      baseline: options.baseline ?? null,
      current: options.current ?? null,
      evidence: options.evidence || null
    };
  }

  function recalculateStatistics(result) {
    const differences = result.differences || [];
    const categoryCounts = {};
    const changeCounts = { added: 0, removed: 0, changed: 0 };
    const reviewCounts = { info: 0, review: 0, caution: 0 };
    for (const item of differences) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      changeCounts[item.changeType] = (changeCounts[item.changeType] || 0) + 1;
      reviewCounts[item.reviewLevel] = (reviewCounts[item.reviewLevel] || 0) + 1;
    }
    result.statistics = {
      ...(result.statistics || {}),
      totalDifferences: differences.length,
      categoryCounts,
      changeCounts,
      reviewCounts,
      dependencyDifferences: categoryCounts.dependencies || 0,
      taskScheduleDifferences: categoryCounts.tasks || 0,
      communicationDifferences: categoryCounts.communications || 0,
      messageDifferences: categoryCounts.messages || 0,
      consistencyDifferences: categoryCounts.consistency || 0,
      sequenceDifferences: categoryCounts.sequences || 0
    };
  }

  function addSequenceDifferences(result, baselineProject, currentProject) {
    const leftTopology = topology(baselineProject);
    const rightTopology = topology(currentProject);
    if (!leftTopology && !rightTopology) return result;

    const differences = result.differences || [];
    const left = variableMap(baselineProject);
    const right = variableMap(currentProject);
    const keys = sortedUnique([...left.keys(), ...right.keys()]);

    for (const key of keys) {
      const before = left.get(key) || null;
      const after = right.get(key) || null;
      const variable = before || after;
      const label = `${variable?.scope || "unscoped"}/${variable?.symbol || key}`;

      if (!before && after) {
        differences.push(difference(
          "added",
          `variable:${key}`,
          `Sequence topology added: ${label}`,
          `${label} has source-visible numeric state/transition evidence only in the current export. This is a static source difference and does not prove the sequence is new at runtime or that either project is correct.`,
          { sequenceKind: "sequence-variable", current: variableSnapshot(after), reviewLevel: "review" }
        ));
        continue;
      }

      if (before && !after) {
        differences.push(difference(
          "removed",
          `variable:${key}`,
          `Sequence topology removed: ${label}`,
          `${label} has source-visible numeric state/transition evidence only in the baseline export. Verify the intended project/revision and export scope before treating this as a machine discrepancy.`,
          { sequenceKind: "sequence-variable", baseline: variableSnapshot(before), reviewLevel: "review" }
        ));
        continue;
      }

      const beforeStates = sortedUnique(before.states || []);
      const afterStates = sortedUnique(after.states || []);
      if (!same(beforeStates, afterStates)) {
        const addedStates = afterStates.filter((state) => !beforeStates.includes(state));
        const removedStates = beforeStates.filter((state) => !afterStates.includes(state));
        differences.push(difference(
          "changed",
          `states:${key}`,
          `Sequence state set changed: ${label}`,
          `${label} has a different set of source-visible numeric state values between the supplied exports. Added/removed state values are review evidence only; initialization, external writes, protected logic, other languages, or export scope may explain the difference.`,
          {
            sequenceKind: "state-set",
            baseline: beforeStates,
            current: afterStates,
            evidence: { addedStates, removedStates },
            reviewLevel: "review"
          }
        ));
      }

      const leftTransitions = transitionMap(before);
      const rightTransitions = transitionMap(after);
      const transitionKeys = sortedUnique([...leftTransitions.keys(), ...rightTransitions.keys()]);
      for (const edgeKey of transitionKeys) {
        const beforeEdges = leftTransitions.get(edgeKey) || null;
        const afterEdges = rightTransitions.get(edgeKey) || null;
        if (!beforeEdges) {
          differences.push(difference(
            "added",
            `transition:${key}:${edgeKey}`,
            `Sequence transition added: ${label} ${edgeKey}`,
            `${label} has source-visible transition ${edgeKey} only in the current export. The edge is inferred from an exact numeric EQU gate paired with a same-rung numeric assignment; it does not prove the transition executes at runtime.`,
            { sequenceKind: "transition", current: afterEdges, reviewLevel: "review" }
          ));
          continue;
        }
        if (!afterEdges) {
          differences.push(difference(
            "removed",
            `transition:${key}:${edgeKey}`,
            `Sequence transition removed: ${label} ${edgeKey}`,
            `${label} has source-visible transition ${edgeKey} only in the baseline export. Verify source revision and sequence intent before treating the missing edge as a defect.`,
            { sequenceKind: "transition", baseline: beforeEdges, reviewLevel: "review" }
          ));
          continue;
        }
        if (!same(beforeEdges, afterEdges)) {
          const beforeTimers = sortedUnique(beforeEdges.flatMap((edge) => (edge.timerDoneGates || []).map((timer) => `${timer.instruction}:${timer.tag}.${timer.member}:${timer.sense}:${(timer.numericPresetEvidence || []).join("/")}`)));
          const afterTimers = sortedUnique(afterEdges.flatMap((edge) => (edge.timerDoneGates || []).map((timer) => `${timer.instruction}:${timer.tag}.${timer.member}:${timer.sense}:${(timer.numericPresetEvidence || []).join("/")}`)));
          const timerContextChanged = !same(beforeTimers, afterTimers);
          differences.push(difference(
            "changed",
            `transition-context:${key}:${edgeKey}`,
            `Sequence transition context changed: ${label} ${edgeKey}`,
            `${label} retains source-visible transition ${edgeKey}, but its rung source, guards, timer .DN evidence, assignment instruction, task scheduling context, and/or source location changed. ${timerContextChanged ? "Timer-gate evidence changed; PRE values are comparison evidence only, not adjustment recommendations. " : ""}This does not prove which branch executes or whether the transition is active at runtime.`,
            {
              sequenceKind: timerContextChanged ? "timer-gated-transition" : "transition-context",
              baseline: beforeEdges,
              current: afterEdges,
              evidence: { timerContextChanged, baselineTimerEvidence: beforeTimers, currentTimerEvidence: afterTimers },
              reviewLevel: "review"
            }
          ));
        }
      }
    }

    result.version = "l5k-compare-v11.1";
    result.differences = differences;
    recalculateStatistics(result);
    result.sequenceComparison = {
      version: "v11.1",
      baselineAvailable: Boolean(leftTopology),
      currentAvailable: Boolean(rightTopology),
      sourceBoundary: "Sequence comparison reports static L5K source differences only. State values and edges come from source-visible exact numeric EQU gates paired with same-rung numeric MOV/CLR/constant CPT assignments. Differences do not prove current state, runtime execution, transition order, branch selection, timer completion, task execution, physical I/O state, or which export is correct. Timer PRE values are not adjustment recommendations."
    };
    return result;
  }

  function compareProjects(baselineProject, currentProject, options = {}) {
    return addSequenceDifferences(baseCompareProjects(baselineProject, currentProject, options), baselineProject, currentProject);
  }

  return Object.freeze({
    ...base,
    version: "l5k-compare-v11.1",
    compareProjects,
    addSequenceDifferences
  });
});
