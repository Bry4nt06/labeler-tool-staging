"use strict";

(function installConsistencyCompare(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-compare-message-v9-1.js")
    : root?.ServoForgeL5KCompare;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createConsistencyCompare(base) {
  if (!base || typeof base.compareProjects !== "function") {
    throw new Error("ServoForge v9.1 MSG/MESSAGE comparison is required before v10.1 consistency comparison.");
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

  function review(project) {
    return project?.dependencies?.consistencyReview || null;
  }

  function valueSignature(values) {
    return sortedUnique(values).join("|");
  }

  function peersByFamily(items, selector) {
    const groups = new Map();
    for (const item of items || []) {
      if (item.scopeKind !== "program-proven" || !item.program || !item.family) continue;
      const values = sortedUnique(selector(item));
      if (!values.length) continue;
      if (!groups.has(item.family)) groups.set(item.family, []);
      groups.get(item.family).push({
        program: item.program,
        values,
        signature: valueSignature(values),
        declarationLine: item.declaration?.line || null,
        dataType: item.declaration?.dataType || null,
        selfIncrementByOne: Boolean(item.selfIncrementByOne)
      });
    }
    return groups;
  }

  function familySnapshot(family, peers) {
    const ordered = [...peers].sort((a, b) => a.program.localeCompare(b.program, undefined, { numeric: true }));
    const uniqueSignatures = sortedUnique(ordered.map((peer) => peer.signature));
    const counts = new Map();
    for (const peer of ordered) counts.set(peer.signature, (counts.get(peer.signature) || 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const majority = ranked.length && ranked[0][1] >= 2
      ? { signature: ranked[0][0], count: ranked[0][1], total: ordered.length }
      : null;
    const state = ordered.length < 2 ? "single-peer" : uniqueSignatures.length <= 1 ? "uniform" : "divergent";
    return {
      family,
      state,
      peerCount: ordered.length,
      programs: ordered.map((peer) => peer.program),
      uniqueSignatures,
      majority,
      peers: ordered
    };
  }

  function dimensionMap(project, dimension) {
    const source = review(project);
    if (!source) return new Map();
    let groups;
    if (dimension === "timer-preset") groups = peersByFamily(source.timers, (item) => item.presets || []);
    else if (dimension === "timer-instruction") groups = peersByFamily(source.timers, (item) => item.instructionTypes || []);
    else if (dimension === "counter-preset") groups = peersByFamily(source.counters, (item) => item.presets || []);
    else if (dimension === "counter-instruction") groups = peersByFamily(source.counters, (item) => item.instructionTypes || []);
    else groups = peersByFamily(source.thresholds, (item) => item.thresholdSignatures || []);
    return new Map([...groups.entries()].map(([family, peers]) => [family, familySnapshot(family, peers)]));
  }

  function difference(changeType, key, title, summary, options = {}) {
    return {
      id: `consistency:${changeType}:${key}`,
      category: "consistency",
      consistencyKind: options.consistencyKind || "peer-state",
      changeType,
      key,
      title,
      summary,
      classification: "static-inference",
      reviewLevel: options.reviewLevel || "review",
      baseline: options.baseline ?? null,
      current: options.current ?? null,
      evidence: options.evidence || null
    };
  }

  function stateTransitionTitle(label, before, after) {
    if (before?.state === "uniform" && after?.state === "divergent") return `${label} became divergent`;
    if (before?.state === "divergent" && after?.state === "uniform") return `${label} became uniform`;
    return `${label} peer consistency changed`;
  }

  function stateTransitionSummary(label, before, after) {
    if (before?.state === "uniform" && after?.state === "divergent") {
      return `${label} was uniform across its source-visible program-scoped peers in the baseline export and is divergent in the current export. This is a review cue only; same-name program tags are inferred peers and no value is identified as correct.`;
    }
    if (before?.state === "divergent" && after?.state === "uniform") {
      return `${label} was divergent in the baseline export and is uniform across its source-visible program-scoped peers in the current export. This is source/configuration evidence only and does not prove the current value is correct.`;
    }
    return `${label} has different peer membership, per-program evidence, majority/outlier pattern, or consistency state between the supplied exports. Same-name program-scoped tags are inferred peers only; numeric values are not adjustment recommendations.`;
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
      consistencyDifferences: categoryCounts.consistency || 0
    };
  }

  function addConsistencyDifferences(result, baselineProject, currentProject) {
    const leftReview = review(baselineProject);
    const rightReview = review(currentProject);
    if (!leftReview && !rightReview) return result;

    const differences = result.differences || [];
    const dimensions = [
      ["timer-preset", "Timer PRE"],
      ["timer-instruction", "Timer instruction"],
      ["counter-preset", "Counter PRE"],
      ["counter-instruction", "Counter instruction"],
      ["threshold", "Decision threshold"]
    ];

    for (const [dimension, labelPrefix] of dimensions) {
      const left = dimensionMap(baselineProject, dimension);
      const right = dimensionMap(currentProject, dimension);
      const families = sortedUnique([...left.keys(), ...right.keys()]);
      for (const family of families) {
        const before = left.get(family) || null;
        const after = right.get(family) || null;
        const label = `${labelPrefix} ${family}`;
        const key = `${dimension}:${family}`;

        if (!before && after) {
          differences.push(difference(
            "added",
            key,
            `${label} peer family added`,
            `${label} has source-visible program-scoped peer evidence only in the current export. This does not prove the programs are functionally equivalent or that the current peer values are correct.`,
            { consistencyKind: dimension, current: after, reviewLevel: after.state === "divergent" ? "review" : "info" }
          ));
          continue;
        }
        if (before && !after) {
          differences.push(difference(
            "removed",
            key,
            `${label} peer family removed`,
            `${label} has source-visible program-scoped peer evidence only in the baseline export. Verify project/revision and tag scope before treating the change as a machine discrepancy.`,
            { consistencyKind: dimension, baseline: before, reviewLevel: "info" }
          ));
          continue;
        }
        if (same(before, after)) continue;

        const becameDivergent = before.state === "uniform" && after.state === "divergent";
        const becameUniform = before.state === "divergent" && after.state === "uniform";
        const cycleStyle = dimension === "threshold" && [...(before?.peers || []), ...(after?.peers || [])].some((peer) => peer.selfIncrementByOne);
        let summary = stateTransitionSummary(label, before, after);
        if (cycleStyle) summary += " At least one peer has source-visible self-increment-by-one evidence; threshold values must not be converted to milliseconds without runtime scan-time evidence.";
        differences.push(difference(
          "changed",
          key,
          stateTransitionTitle(label, before, after),
          summary,
          {
            consistencyKind: dimension,
            baseline: before,
            current: after,
            reviewLevel: becameDivergent ? "review" : becameUniform ? "info" : "review",
            evidence: { becameDivergent, becameUniform, cycleStyle }
          }
        ));
      }
    }

    result.version = "l5k-compare-v10.1";
    result.differences = differences;
    recalculateStatistics(result);
    result.consistencyComparison = {
      version: "v10.1",
      baselineAvailable: Boolean(leftReview),
      currentAvailable: Boolean(rightReview),
      sourceBoundary: "Consistency comparison tracks source-visible same-name program-scoped peer evidence only. Peer grouping is static inference, not proof of identical machine function. Uniformity, divergence, majority/outlier patterns, PRE values, and numeric thresholds do not establish the correct field setting and are not adjustment recommendations. PLC-cycle counters are not converted to time without runtime scan evidence."
    };
    return result;
  }

  function compareProjects(baselineProject, currentProject, options = {}) {
    return addConsistencyDifferences(baseCompareProjects(baselineProject, currentProject, options), baselineProject, currentProject);
  }

  return Object.freeze({
    ...base,
    version: "l5k-compare-v10.1",
    compareProjects,
    addConsistencyDifferences,
    buildConsistencyDimensionMap: dimensionMap
  });
});
