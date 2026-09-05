"use strict";

(function installDependencyCompare(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-compare.js")
    : root?.ServoForgeL5KCompare;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDependencyCompare(base) {
  if (!base || typeof base.compareProjects !== "function") throw new Error("ServoForge L5K comparison engine is required before dependency comparison.");

  const baseCompareProjects = base.compareProjects;

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = stable(value[key]);
    return result;
  }

  function same(a, b) {
    return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  }

  function sortedUnique(values) {
    return [...new Set((values || []).filter((value) => value !== null && value !== undefined).map((value) => String(value)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function mapBy(items, keyFn) {
    const map = new Map();
    for (const item of items || []) {
      const key = keyFn(item);
      if (key !== null && key !== undefined && key !== "") map.set(String(key), item);
    }
    return map;
  }

  function difference(changeType, key, title, summary, options = {}) {
    return {
      id: `dependencies:${changeType}:${key}`,
      category: "dependencies",
      dependencyKind: options.dependencyKind || "dependency",
      changeType,
      key,
      title,
      summary,
      classification: options.classification || "source-proven",
      reviewLevel: options.reviewLevel || "review",
      baseline: options.baseline ?? null,
      current: options.current ?? null,
      evidence: options.evidence || null
    };
  }

  function compareNamed(differences, baselineItems, currentItems, keyFn, snapshotFn, labelFn, kind, options = {}) {
    const baseline = mapBy(baselineItems, keyFn);
    const current = mapBy(currentItems, keyFn);
    const keys = sortedUnique([...baseline.keys(), ...current.keys()]);
    for (const key of keys) {
      const left = baseline.get(key);
      const right = current.get(key);
      const label = labelFn(left || right, key);
      if (!left) {
        differences.push(difference("added", `${kind}:${key}`, `${label} added`, options.addedSummary?.(label, right) || `${label} exists only in the current export.`, {
          dependencyKind: kind,
          current: snapshotFn(right),
          reviewLevel: options.addedReviewLevel || options.reviewLevel || "review",
          classification: options.classification
        }));
        continue;
      }
      if (!right) {
        differences.push(difference("removed", `${kind}:${key}`, `${label} removed`, options.removedSummary?.(label, left) || `${label} exists only in the baseline export.`, {
          dependencyKind: kind,
          baseline: snapshotFn(left),
          reviewLevel: options.removedReviewLevel || options.reviewLevel || "review",
          classification: options.classification
        }));
        continue;
      }
      const leftSnapshot = snapshotFn(left);
      const rightSnapshot = snapshotFn(right);
      if (same(leftSnapshot, rightSnapshot)) continue;
      differences.push(difference("changed", `${kind}:${key}`, `${label} changed`, options.changedSummary?.(label, leftSnapshot, rightSnapshot) || `${label} differs between the baseline and current exports.`, {
        dependencyKind: kind,
        baseline: leftSnapshot,
        current: rightSnapshot,
        reviewLevel: options.changedReviewLevel || options.reviewLevel || "review",
        classification: options.classification,
        evidence: options.evidence?.(left, right) || null
      }));
    }
  }

  function dataTypeSnapshot(item) {
    return {
      members: (item?.members || []).map((member) => ({ name: member.name, dataType: member.dataType }))
    };
  }

  function aoiDefinitionSnapshot(item) {
    return {
      parameters: (item?.parameters || []).map((parameter) => ({ name: parameter.name, dataType: parameter.dataType, usage: parameter.usage || null })),
      localTags: (item?.localTags || []).map((tag) => ({ name: tag.name, dataType: tag.dataType }))
    };
  }

  function programMainSnapshot(item) {
    return { mainRoutine: item?.mainRoutine || null };
  }

  function routineCallKey(item) {
    return `${item.program || "?"}|${item.callerRoutine || "?"}|${item.calleeRoutine || "?"}|${item.rung ?? "?"}`;
  }

  function routineCallSnapshot(item) {
    return {
      program: item?.program || null,
      callerRoutine: item?.callerRoutine || null,
      calleeRoutine: item?.calleeRoutine || null,
      rung: item?.rung ?? null,
      args: item?.args || []
    };
  }

  function aoiCallKey(item) {
    return `${item.definition || "?"}|${item.instanceTag || "?"}|${item.program || "?"}|${item.routine || "?"}|${item.rung ?? "?"}`;
  }

  function aoiCallSnapshot(item) {
    return {
      definition: item?.definition || null,
      instanceTag: item?.instanceTag || null,
      program: item?.program || null,
      routine: item?.routine || null,
      rung: item?.rung ?? null,
      args: item?.args || []
    };
  }

  function addDependencyDifferences(result, baselineProject, currentProject) {
    const left = baselineProject?.dependencies;
    const right = currentProject?.dependencies;
    if (!left && !right) return result;
    const differences = result.differences || [];

    compareNamed(
      differences,
      left?.programMainRoutines,
      right?.programMainRoutines,
      (item) => item.program,
      programMainSnapshot,
      (item, key) => `Program MAIN ${item?.program || key}`,
      "program-main",
      {
        changedSummary: (label, before, after) => `${label} changed from ${before.mainRoutine || "not identified"} to ${after.mainRoutine || "not identified"}. This changes the source-visible program entry routine; verify that the revision is intentional.`,
        reviewLevel: "review"
      }
    );

    compareNamed(
      differences,
      left?.dataTypes,
      right?.dataTypes,
      (item) => item.name,
      dataTypeSnapshot,
      (item, key) => `UDT ${item?.name || key}`,
      "udt",
      {
        changedSummary: (label) => `${label} has different source-visible member names and/or member data types between the exports.`,
        reviewLevel: "review"
      }
    );

    compareNamed(
      differences,
      left?.aoiDefinitions,
      right?.aoiDefinitions,
      (item) => item.name,
      aoiDefinitionSnapshot,
      (item, key) => `AOI definition ${item?.name || key}`,
      "aoi-definition",
      {
        changedSummary: (label) => `${label} has different parameter/local-tag declaration evidence. Protected AOI internals are not inferred when they are not present in the export.`,
        reviewLevel: "review"
      }
    );

    compareNamed(
      differences,
      left?.routineCalls,
      right?.routineCalls,
      routineCallKey,
      routineCallSnapshot,
      (item) => `JSR ${item?.callerRoutine || "?"} → ${item?.calleeRoutine || "?"}`,
      "routine-call",
      {
        addedSummary: (label) => `${label} appears only in the current source call graph. Verify whether the called routine was intentionally introduced or moved.`,
        removedSummary: (label) => `${label} appears only in the baseline source call graph. Verify whether removing or moving this call was intentional.`,
        changedSummary: (label) => `${label} has different source-visible call arguments or location evidence.`,
        reviewLevel: "review"
      }
    );

    compareNamed(
      differences,
      left?.aoiCalls,
      right?.aoiCalls,
      aoiCallKey,
      aoiCallSnapshot,
      (item) => `AOI call ${item?.definition || "?"} (${item?.instanceTag || "?"})`,
      "aoi-call",
      {
        addedSummary: (label) => `${label} appears only in the current export. This is source invocation evidence, not proof of runtime execution.`,
        removedSummary: (label) => `${label} appears only in the baseline export. This is source invocation evidence, not proof of runtime execution.`,
        changedSummary: (label) => `${label} has different source-visible arguments or location evidence.`,
        reviewLevel: "review"
      }
    );

    const categoryCounts = {};
    const changeCounts = { added: 0, removed: 0, changed: 0 };
    const reviewCounts = { info: 0, review: 0, caution: 0 };
    for (const item of differences) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      changeCounts[item.changeType] = (changeCounts[item.changeType] || 0) + 1;
      reviewCounts[item.reviewLevel] = (reviewCounts[item.reviewLevel] || 0) + 1;
    }
    result.version = "l5k-compare-v5.2";
    result.differences = differences;
    result.statistics = {
      ...(result.statistics || {}),
      totalDifferences: differences.length,
      categoryCounts,
      changeCounts,
      reviewCounts,
      dependencyDifferences: categoryCounts.dependencies || 0
    };
    result.dependencyComparison = {
      version: "v5.2",
      baselineAvailable: Boolean(left),
      currentAvailable: Boolean(right),
      sourceBoundary: "Dependency comparison reports offline source/configuration differences only. It does not prove runtime execution, live state, physical device condition, or that a change is defective."
    };
    return result;
  }

  function compareProjects(baselineProject, currentProject, options = {}) {
    const result = baseCompareProjects(baselineProject, currentProject, options);
    return addDependencyDifferences(result, baselineProject, currentProject);
  }

  return Object.freeze({
    ...base,
    version: "l5k-compare-v5.2",
    compareProjects,
    addDependencyDifferences
  });
});
