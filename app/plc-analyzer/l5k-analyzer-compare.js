"use strict";

(function installServoForgeL5KCompare(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createServoForgeL5KCompare() {
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

  function normalizedSource(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim();
  }

  function mapBy(items, keyFn) {
    const map = new Map();
    for (const item of items || []) {
      const key = keyFn(item);
      if (key !== null && key !== undefined && key !== "") map.set(String(key), item);
    }
    return map;
  }

  function setDelta(baselineValues, currentValues) {
    const baseline = new Set(sortedUnique(baselineValues));
    const current = new Set(sortedUnique(currentValues));
    return {
      added: [...current].filter((value) => !baseline.has(value)).sort(),
      removed: [...baseline].filter((value) => !current.has(value)).sort()
    };
  }

  function makeDifference(category, changeType, key, title, summary, options = {}) {
    return {
      id: `${category}:${changeType}:${key}`,
      category,
      changeType,
      key,
      title,
      summary,
      classification: options.classification || "configuration-difference",
      reviewLevel: options.reviewLevel || "info",
      baseline: options.baseline ?? null,
      current: options.current ?? null,
      evidence: options.evidence || null
    };
  }

  function compareNamedObjects(differences, category, baselineItems, currentItems, keyFn, snapshotFn, labelFn, options = {}) {
    const baseline = mapBy(baselineItems, keyFn);
    const current = mapBy(currentItems, keyFn);
    const keys = sortedUnique([...baseline.keys(), ...current.keys()]);
    for (const key of keys) {
      const left = baseline.get(key);
      const right = current.get(key);
      const label = labelFn ? labelFn(left || right, key) : key;
      if (!left) {
        differences.push(makeDifference(category, "added", key, `${label} added`, `${label} exists in the current export but not in the baseline export.`, {
          classification: options.classification,
          reviewLevel: options.addedReviewLevel || options.reviewLevel,
          baseline: null,
          current: snapshotFn(right)
        }));
        continue;
      }
      if (!right) {
        differences.push(makeDifference(category, "removed", key, `${label} removed`, `${label} exists in the baseline export but not in the current export.`, {
          classification: options.classification,
          reviewLevel: options.removedReviewLevel || options.reviewLevel,
          baseline: snapshotFn(left),
          current: null
        }));
        continue;
      }
      const leftSnapshot = snapshotFn(left);
      const rightSnapshot = snapshotFn(right);
      if (!same(leftSnapshot, rightSnapshot)) {
        const summary = options.changedSummary
          ? options.changedSummary(label, leftSnapshot, rightSnapshot, left, right)
          : `${label} differs between the baseline and current exports.`;
        differences.push(makeDifference(category, "changed", key, `${label} changed`, summary, {
          classification: options.classification,
          reviewLevel: options.changedReviewLevel || options.reviewLevel,
          baseline: leftSnapshot,
          current: rightSnapshot,
          evidence: options.evidence ? options.evidence(left, right) : null
        }));
      }
    }
  }

  function routineKey(item) {
    return `${item.program || "(unscoped)"}/${item.name || ""}`;
  }

  function rungKey(item) {
    return `${item.program || "(unscoped)"}/${item.routine || "(unscoped)"}/${item.number}`;
  }

  function compareProjects(baselineProject, currentProject, options = {}) {
    if (!baselineProject || !currentProject) throw new Error("Both baseline and current parsed projects are required.");
    const differences = [];

    const metadataSnapshot = (project) => ({
      controller: project.controller || null,
      exportVersion: project.exportVersion || null
    });
    if (!same(metadataSnapshot(baselineProject), metadataSnapshot(currentProject))) {
      differences.push(makeDifference(
        "project",
        "changed",
        "metadata",
        "Project metadata changed",
        "Controller name and/or export version differs. Treat this as source/configuration evidence, not proof of a machine fault.",
        {
          baseline: metadataSnapshot(baselineProject),
          current: metadataSnapshot(currentProject),
          reviewLevel: "info"
        }
      ));
    }

    const programDelta = setDelta((baselineProject.programs || []).map((item) => item.name), (currentProject.programs || []).map((item) => item.name));
    if (programDelta.added.length) {
      differences.push(makeDifference("programs", "added", "programs", "Programs added", `${programDelta.added.length} program(s) appear only in the current export.`, { current: programDelta.added, reviewLevel: "info" }));
    }
    if (programDelta.removed.length) {
      differences.push(makeDifference("programs", "removed", "programs", "Programs removed", `${programDelta.removed.length} program(s) appear only in the baseline export.`, { baseline: programDelta.removed, reviewLevel: "review" }));
    }

    const routineDelta = setDelta((baselineProject.routines || []).map(routineKey), (currentProject.routines || []).map(routineKey));
    if (routineDelta.added.length) {
      differences.push(makeDifference("routines", "added", "routines", "Routines added", `${routineDelta.added.length} routine(s) appear only in the current export.`, { current: routineDelta.added, reviewLevel: "info" }));
    }
    if (routineDelta.removed.length) {
      differences.push(makeDifference("routines", "removed", "routines", "Routines removed", `${routineDelta.removed.length} routine(s) appear only in the baseline export.`, { baseline: routineDelta.removed, reviewLevel: "review" }));
    }

    compareNamedObjects(
      differences,
      "faults",
      baselineProject.faultWriters,
      currentProject.faultWriters,
      (item) => item.target,
      (item) => ({
        writerCount: item.writerCount || 0,
        writerTypes: sortedUnique((item.writers || []).map((writer) => writer.instruction)),
        writerLocations: sortedUnique((item.writers || []).map((writer) => `${writer.program || "?"}/${writer.routine || "?"}/${writer.rung}`)),
        writerSymbols: sortedUnique((item.writers || []).flatMap((writer) => (writer.symbols || []).filter((symbol) => symbol !== item.target))),
        writerSources: sortedUnique((item.writers || []).map((writer) => normalizedSource(writer.source))),
        resetCount: (item.resets || []).length,
        resetLocations: sortedUnique((item.resets || []).map((reset) => `${reset.program || "?"}/${reset.routine || "?"}/${reset.rung}`)),
        resetSources: sortedUnique((item.resets || []).map((reset) => normalizedSource(reset.source)))
      }),
      (_item, key) => `Fault/output ${key}`,
      {
        reviewLevel: "review",
        classification: "source-proven",
        changedSummary: (label) => `${label} has different writer/reset source evidence between the two exports. Verify whether the change is intentional before treating it as a discrepancy.`
      }
    );

    compareNamedObjects(
      differences,
      "timers",
      baselineProject.timers,
      currentProject.timers,
      (item) => item.tag,
      (item) => ({
        instructions: sortedUnique((item.instructions || []).map((entry) => entry.type)),
        presetValues: sortedUnique(item.presetValues || []),
        instructionLocations: sortedUnique((item.instructions || []).map((entry) => `${entry.program || "?"}/${entry.routine || "?"}/${entry.rung}`))
      }),
      (_item, key) => `Timer ${key}`,
      {
        reviewLevel: "review",
        classification: "source-proven",
        changedSummary: (label, left, right) => `${label} differs in instruction type, numeric PRE evidence, and/or source location. Baseline PRE: ${left.presetValues.join(", ") || "none extracted"}; current PRE: ${right.presetValues.join(", ") || "none extracted"}. Numeric values are source evidence, not adjustment recommendations.`
      }
    );

    compareNamedObjects(
      differences,
      "counters",
      baselineProject.counters,
      currentProject.counters,
      (item) => item.tag,
      (item) => ({
        instructions: sortedUnique((item.instructions || []).map((entry) => entry.type)),
        presetValues: sortedUnique(item.presetValues || []),
        resetCount: (item.resets || []).length,
        instructionLocations: sortedUnique((item.instructions || []).map((entry) => `${entry.program || "?"}/${entry.routine || "?"}/${entry.rung}`))
      }),
      (_item, key) => `Counter ${key}`,
      {
        reviewLevel: "review",
        classification: "source-proven",
        changedSummary: (label) => `${label} differs in instruction, preset, location, and/or reset evidence between exports.`
      }
    );

    compareNamedObjects(
      differences,
      "modules",
      baselineProject.modules,
      currentProject.modules,
      (item) => item.name,
      (item) => ({ slot: item.slot ?? null, parent: item.parent ?? null, address: item.address ?? null, catalog: item.catalog ?? null }),
      (_item, key) => `Module ${key}`,
      {
        reviewLevel: "review",
        classification: "configuration-difference",
        changedSummary: (label) => `${label} has different slot, parent, address, and/or catalog evidence. Confirm the intended hardware/revision before calling this a fault.`
      }
    );

    const baselineAliases = (baselineProject.tags || []).filter((tag) => tag.aliasFor);
    const currentAliases = (currentProject.tags || []).filter((tag) => tag.aliasFor);
    compareNamedObjects(
      differences,
      "aliases",
      baselineAliases,
      currentAliases,
      (item) => item.name,
      (item) => ({ aliasFor: item.aliasFor || null, dataType: item.dataType || null }),
      (_item, key) => `Alias ${key}`,
      {
        reviewLevel: "review",
        classification: "source-proven",
        changedSummary: (label, left, right) => `${label} resolves to a different target. Baseline: ${left.aliasFor || "none"}; current: ${right.aliasFor || "none"}. Electrical pin/wire mapping is not inferred from this difference.`
      }
    );

    compareNamedObjects(
      differences,
      "axes",
      baselineProject.axes,
      currentProject.axes,
      (item) => item.name,
      (item) => ({ dataType: item.dataType || null }),
      (_item, key) => `Axis ${key}`,
      {
        reviewLevel: "review",
        classification: "configuration-difference",
        changedSummary: (label) => `${label} declaration differs between the exports. This does not establish live axis health.`
      }
    );

    const ioDelta = setDelta(baselineProject.ioReferences, currentProject.ioReferences);
    if (ioDelta.added.length) {
      differences.push(makeDifference("io", "added", "io-references", "I/O references added", `${ioDelta.added.length} direct I/O reference(s) appear only in the current export.`, {
        classification: "source-proven",
        reviewLevel: "review",
        current: ioDelta.added
      }));
    }
    if (ioDelta.removed.length) {
      differences.push(makeDifference("io", "removed", "io-references", "I/O references removed", `${ioDelta.removed.length} direct I/O reference(s) appear only in the baseline export.`, {
        classification: "source-proven",
        reviewLevel: "review",
        baseline: ioDelta.removed
      }));
    }

    const baselineMotion = sortedUnique((baselineProject.motionReferences || []).map((item) => `${item.instruction || "STATUS"}|${item.axis || ""}|${item.member || ""}|${item.program || ""}|${item.routine || ""}|${item.rung ?? ""}`));
    const currentMotion = sortedUnique((currentProject.motionReferences || []).map((item) => `${item.instruction || "STATUS"}|${item.axis || ""}|${item.member || ""}|${item.program || ""}|${item.routine || ""}|${item.rung ?? ""}`));
    const motionDelta = setDelta(baselineMotion, currentMotion);
    if (motionDelta.added.length || motionDelta.removed.length) {
      differences.push(makeDifference("motion", "changed", "motion-references", "Motion/status references changed", `${motionDelta.added.length} motion/status reference(s) added and ${motionDelta.removed.length} removed. Exact member changes are source evidence only; runtime axis condition still requires live verification.`, {
        classification: "source-proven",
        reviewLevel: "review",
        baseline: motionDelta.removed,
        current: motionDelta.added
      }));
    }

    compareNamedObjects(
      differences,
      "rungs",
      baselineProject.rungs,
      currentProject.rungs,
      rungKey,
      (item) => ({ source: normalizedSource(item.source) }),
      (_item, key) => `Rung ${key}`,
      {
        reviewLevel: "review",
        classification: "source-proven",
        changedSummary: (label) => `${label} has different source text between the exports. This comparison does not assume the difference is defective or functionally unsafe.`,
        evidence: (left, right) => ({
          baselineLine: left.startLine || null,
          currentLine: right.startLine || null,
          baselineSource: left.source || "",
          currentSource: right.source || ""
        })
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

    return {
      version: "l5k-compare-v2",
      baseline: {
        controller: baselineProject.controller || null,
        exportVersion: baselineProject.exportVersion || null,
        source: baselineProject.source || null,
        statistics: baselineProject.statistics || {}
      },
      current: {
        controller: currentProject.controller || null,
        exportVersion: currentProject.exportVersion || null,
        source: currentProject.source || null,
        statistics: currentProject.statistics || {}
      },
      differences,
      statistics: {
        totalDifferences: differences.length,
        categoryCounts,
        changeCounts,
        reviewCounts
      },
      options: {
        baselineLabel: options.baselineLabel || baselineProject.source?.fileName || "Baseline",
        currentLabel: options.currentLabel || currentProject.source?.fileName || "Current"
      }
    };
  }

  function filterDifferences(comparison, filters = {}) {
    const category = String(filters.category || "all").toLowerCase();
    const changeType = String(filters.changeType || "all").toLowerCase();
    const reviewLevel = String(filters.reviewLevel || "all").toLowerCase();
    const query = String(filters.query || "").trim().toLowerCase();
    return (comparison?.differences || []).filter((item) => {
      if (category !== "all" && String(item.category).toLowerCase() !== category) return false;
      if (changeType !== "all" && String(item.changeType).toLowerCase() !== changeType) return false;
      if (reviewLevel !== "all" && String(item.reviewLevel).toLowerCase() !== reviewLevel) return false;
      if (query) {
        const haystack = JSON.stringify(item).toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  return Object.freeze({
    version: "l5k-compare-v2",
    compareProjects,
    filterDifferences,
    normalizedSource,
    setDelta
  });
});
