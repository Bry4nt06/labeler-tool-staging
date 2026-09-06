"use strict";

(function installInterlockCompare(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-compare-sequence-v11-1.js")
    : root?.ServoForgeL5KCompare;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createInterlockCompare(base) {
  if (!base || typeof base.compareProjects !== "function") {
    throw new Error("ServoForge v11.1 sequence comparison is required before v12.1 interlock/permissive comparison.");
  }

  const baseCompareProjects = base.compareProjects;

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

  function sortedUnique(values) {
    return [...new Set((values || []).filter((value) => value !== null && value !== undefined).map(String))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function topology(project) {
    return project?.dependencies?.interlockTopology || null;
  }

  function gateSnapshot(gate) {
    return {
      kind: gate?.kind || null,
      instruction: gate?.instruction || null,
      symbol: gate?.symbol || null,
      sense: gate?.sense || null,
      args: (gate?.args || []).map(String)
    };
  }

  function pathSnapshot(path) {
    return {
      target: path?.target || null,
      actionInstruction: path?.actionInstruction || null,
      actionKind: path?.actionKind || null,
      program: path?.program || null,
      routine: path?.routine || null,
      gates: (path?.gates || []).map(gateSnapshot),
      selfHoldCandidate: Boolean(path?.selfHoldCandidate),
      taskRootReachable: Boolean(path?.taskRootReachable)
    };
  }

  function snapshotSortKey(path) {
    return [
      path.program || "",
      path.routine || "",
      path.actionInstruction || "",
      JSON.stringify(path.gates || []),
      String(path.selfHoldCandidate),
      String(path.taskRootReachable)
    ].join("|");
  }

  function targetMap(project) {
    const map = new Map();
    for (const path of topology(project)?.actionPaths || []) {
      if (!map.has(path.target)) map.set(path.target, []);
      map.get(path.target).push(pathSnapshot(path));
    }
    for (const [target, paths] of map.entries()) {
      map.set(target, paths.sort((a, b) => snapshotSortKey(a).localeCompare(snapshotSortKey(b), undefined, { numeric: true })));
    }
    return map;
  }

  function gateEvidence(paths) {
    return sortedUnique((paths || []).flatMap((path) => (path.gates || []).map((gate) => `${gate.instruction}:${(gate.args || []).join(",")}`)));
  }

  function writerEvidence(paths) {
    return sortedUnique((paths || []).map((path) => `${path.program || "?"}/${path.routine || "?"}:${path.actionInstruction || "?"}`));
  }

  function selfHoldEvidence(paths) {
    return sortedUnique((paths || []).filter((path) => path.selfHoldCandidate).map((path) => `${path.program || "?"}/${path.routine || "?"}:${path.actionInstruction || "?"}`));
  }

  function taskReachabilityEvidence(paths) {
    return sortedUnique((paths || []).map((path) => `${path.program || "?"}/${path.routine || "?"}:${path.taskRootReachable ? "task-root-reachable" : "not-task-root-reachable"}`));
  }

  function difference(changeType, key, title, summary, options = {}) {
    return {
      id: `interlocks:${changeType}:${key}`,
      category: "interlocks",
      interlockKind: options.interlockKind || "permissive-path",
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
      sequenceDifferences: categoryCounts.sequences || 0,
      interlockDifferences: categoryCounts.interlocks || 0
    };
  }

  function addInterlockDifferences(result, baselineProject, currentProject) {
    const leftTopology = topology(baselineProject);
    const rightTopology = topology(currentProject);
    if (!leftTopology && !rightTopology) return result;

    const differences = result.differences || [];
    const left = targetMap(baselineProject);
    const right = targetMap(currentProject);
    const targets = sortedUnique([...left.keys(), ...right.keys()]);

    for (const target of targets) {
      const before = left.get(target) || null;
      const after = right.get(target) || null;

      if (!before && after) {
        differences.push(difference(
          "added",
          `target:${target}`,
          `Interlock/permissive path added: ${target}`,
          `${target} has source-visible output/motion action path evidence only in the current export. This proves an offline source difference only; it does not prove the action executes, the path is currently permissive, or that the change is defective.`,
          { interlockKind: "target-path", current: after }
        ));
        continue;
      }

      if (before && !after) {
        differences.push(difference(
          "removed",
          `target:${target}`,
          `Interlock/permissive path removed: ${target}`,
          `${target} has source-visible output/motion action path evidence only in the baseline export. Verify the intended project/revision and export scope before treating the missing path as a machine discrepancy.`,
          { interlockKind: "target-path", baseline: before }
        ));
        continue;
      }

      if (same(before, after)) continue;

      const beforeGates = gateEvidence(before);
      const afterGates = gateEvidence(after);
      const beforeWriters = writerEvidence(before);
      const afterWriters = writerEvidence(after);
      const beforeSelfHold = selfHoldEvidence(before);
      const afterSelfHold = selfHoldEvidence(after);
      const beforeTask = taskReachabilityEvidence(before);
      const afterTask = taskReachabilityEvidence(after);

      const writerChanged = !same(beforeWriters, afterWriters);
      const selfHoldChanged = !same(beforeSelfHold, afterSelfHold);
      const taskReachabilityChanged = !same(beforeTask, afterTask);
      const gatesChanged = !same(beforeGates, afterGates);
      const kind = writerChanged
        ? "writer-path"
        : selfHoldChanged
          ? "self-hold"
          : taskReachabilityChanged
            ? "task-reachability"
            : "gate-evidence";

      const notes = [];
      if (gatesChanged) notes.push("XIC/XIO/comparison evidence changed");
      if (writerChanged) notes.push("writer/action location changed");
      if (selfHoldChanged) notes.push("self-hold candidate evidence changed");
      if (taskReachabilityChanged) notes.push("task-root reachability context changed");

      differences.push(difference(
        "changed",
        `target-context:${target}`,
        `Interlock/permissive path changed: ${target}`,
        `${target} retains source-visible action-path evidence, but ${notes.join(", ") || "its static path context changed"}. v12.1 compares only offline same-rung source evidence. It does not prove Boolean branch semantics, current contact state, current permissive/interlock state, physical interlock condition, or that any gate should be bypassed, forced, or changed.`,
        {
          interlockKind: kind,
          baseline: before,
          current: after,
          evidence: {
            gatesChanged,
            writerChanged,
            selfHoldChanged,
            taskReachabilityChanged,
            baselineGateEvidence: beforeGates,
            currentGateEvidence: afterGates,
            baselineWriters: beforeWriters,
            currentWriters: afterWriters,
            baselineSelfHold: beforeSelfHold,
            currentSelfHold: afterSelfHold,
            baselineTaskReachability: beforeTask,
            currentTaskReachability: afterTask
          }
        }
      ));
    }

    result.version = "l5k-compare-v12.1";
    result.differences = differences;
    recalculateStatistics(result);
    result.interlockComparison = {
      version: "v12.1",
      baselineAvailable: Boolean(leftTopology),
      currentAvailable: Boolean(rightTopology),
      sourceBoundary: "Interlock/permissive comparison reports static source-visible same-rung XIC/XIO/comparison evidence preceding supported OTE/OTL or motion actions. It is not a Boolean ladder solver and does not prove branch semantics, live contact values, current permissive state, physical interlock state, action execution, task execution, or which export is correct. Findings must not be used to justify forcing or bypassing machine or safety interlocks."
    };
    return result;
  }

  function compareProjects(baselineProject, currentProject, options = {}) {
    return addInterlockDifferences(baseCompareProjects(baselineProject, currentProject, options), baselineProject, currentProject);
  }

  return Object.freeze({
    ...base,
    version: "l5k-compare-v12.1",
    compareProjects,
    addInterlockDifferences
  });
});
