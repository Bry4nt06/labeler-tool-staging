"use strict";

(function installSnapshotCompare(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-compare-interlocks-v12-1.js")
    : root?.ServoForgeL5KCompare;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSnapshotCompare(base) {
  if (!base || typeof base.compareProjects !== "function") {
    throw new Error("ServoForge v12.1 comparison is required before v13.1 snapshot alignment.");
  }

  const baseCompareProjects = base.compareProjects;

  function normalizeSource(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim();
  }

  function scopeKey(rung) {
    return `${rung?.program || "(unscoped)"}/${rung?.routine || "(unscoped)"}`;
  }

  function groupRungs(project) {
    const groups = new Map();
    for (const rung of project?.rungs || []) {
      const key = scopeKey(rung);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(rung);
    }
    for (const rungs of groups.values()) {
      rungs.sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0) || Number(a.startLine ?? 0) - Number(b.startLine ?? 0));
    }
    return groups;
  }

  function lcsAnchors(left, right) {
    const a = left.map((rung) => normalizeSource(rung.source));
    const b = right.map((rung) => normalizeSource(rung.source));
    const rows = a.length + 1;
    const cols = b.length + 1;
    const dp = Array.from({ length: rows }, () => new Uint16Array(cols));
    for (let i = a.length - 1; i >= 0; i -= 1) {
      for (let j = b.length - 1; j >= 0; j -= 1) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const anchors = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        anchors.push([i, j]);
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }
    return anchors;
  }

  function rungSnapshot(rung) {
    if (!rung) return null;
    return {
      program: rung.program || null,
      routine: rung.routine || null,
      rung: rung.number ?? null,
      sourceLine: rung.startLine ?? null,
      source: rung.source || ""
    };
  }

  function difference(changeType, scope, ordinal, before, after) {
    const baselineNumber = before?.number ?? null;
    const currentNumber = after?.number ?? null;
    const location = scope.replace("/", " / ");
    const title = changeType === "added"
      ? `Aligned rung added — ${location}`
      : changeType === "removed"
        ? `Aligned rung removed — ${location}`
        : `Aligned rung changed — ${location}`;
    const summary = changeType === "added"
      ? `Same-controller sequence alignment found a source rung only in the current export. Later rung-number shifts in this routine are aligned separately and are not automatically reported as edits.`
      : changeType === "removed"
        ? `Same-controller sequence alignment found a source rung only in the baseline export. Later rung-number shifts in this routine are aligned separately and are not automatically reported as edits.`
        : `Same-controller sequence alignment paired a baseline and current rung as one source edit even if surrounding insertions changed their displayed rung numbers. Numeric constants are source evidence only and are not adjustment recommendations.`;
    return {
      id: `snapshots:${changeType}:${scope}:${ordinal}`,
      category: "snapshots",
      snapshotKind: "aligned-rung-source",
      changeType,
      key: `${scope}:${ordinal}`,
      title,
      summary,
      classification: "source-proven",
      reviewLevel: "review",
      baseline: rungSnapshot(before),
      current: rungSnapshot(after),
      evidence: {
        scope,
        baselineRung: baselineNumber,
        currentRung: currentNumber,
        baselineLine: before?.startLine ?? null,
        currentLine: after?.startLine ?? null,
        alignment: "routine-local exact-source LCS with bounded unmatched-segment pairing"
      }
    };
  }

  function alignRoutine(scope, left, right) {
    const anchors = lcsAnchors(left, right);
    const output = [];
    let leftStart = 0;
    let rightStart = 0;
    let ordinal = 0;

    function emitSegment(leftEnd, rightEnd) {
      const leftBlock = left.slice(leftStart, leftEnd);
      const rightBlock = right.slice(rightStart, rightEnd);
      const paired = Math.min(leftBlock.length, rightBlock.length);
      for (let index = 0; index < paired; index += 1) {
        output.push(difference("changed", scope, ordinal++, leftBlock[index], rightBlock[index]));
      }
      for (let index = paired; index < leftBlock.length; index += 1) {
        output.push(difference("removed", scope, ordinal++, leftBlock[index], null));
      }
      for (let index = paired; index < rightBlock.length; index += 1) {
        output.push(difference("added", scope, ordinal++, null, rightBlock[index]));
      }
    }

    for (const [leftAnchor, rightAnchor] of anchors) {
      emitSegment(leftAnchor, rightAnchor);
      leftStart = leftAnchor + 1;
      rightStart = rightAnchor + 1;
    }
    emitSegment(left.length, right.length);
    return output;
  }

  function alignedSnapshotDifferences(baselineProject, currentProject) {
    const leftGroups = groupRungs(baselineProject);
    const rightGroups = groupRungs(currentProject);
    const scopes = [...new Set([...leftGroups.keys(), ...rightGroups.keys()])].sort();
    const differences = [];
    const changedScopes = new Set();
    for (const scope of scopes) {
      const rows = alignRoutine(scope, leftGroups.get(scope) || [], rightGroups.get(scope) || []);
      if (rows.length) changedScopes.add(scope);
      differences.push(...rows);
    }
    return { differences, scopesCompared: scopes.length, changedScopes: [...changedScopes].sort() };
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
      interlockDifferences: categoryCounts.interlocks || 0,
      snapshotAlignedDifferences: categoryCounts.snapshots || 0,
      snapshotRoutinesChanged: result.snapshotComparison?.changedScopes?.length || 0,
      sameControllerSnapshot: Boolean(result.snapshotComparison?.sameController)
    };
  }

  function addSnapshotAlignment(result, baselineProject, currentProject) {
    const baselineController = String(baselineProject?.controller || "").trim();
    const currentController = String(currentProject?.controller || "").trim();
    const sameController = Boolean(baselineController && currentController && baselineController === currentController);

    result.snapshotComparison = {
      version: "v13.1",
      sameController,
      controller: sameController ? baselineController : null,
      scopesCompared: 0,
      changedScopes: [],
      alignedDifferences: 0,
      sourceBoundary: "Snapshot alignment is an offline same-controller source-review aid. It aligns exact unchanged rung text within each program/routine so inserted or removed rungs do not create a cascade of false positional changes. Unmatched nearby rungs are paired only for review; the newer export is not assumed correct, live, approved, or safe. Numeric constants and timer values are source evidence, not adjustment recommendations."
    };

    if (!sameController) {
      result.version = "l5k-compare-v13.1";
      recalculateStatistics(result);
      return result;
    }

    const aligned = alignedSnapshotDifferences(baselineProject, currentProject);
    result.differences = (result.differences || []).filter((item) => item.category !== "rungs");
    result.differences.push(...aligned.differences);
    result.snapshotComparison.scopesCompared = aligned.scopesCompared;
    result.snapshotComparison.changedScopes = aligned.changedScopes;
    result.snapshotComparison.alignedDifferences = aligned.differences.length;
    result.version = "l5k-compare-v13.1";
    recalculateStatistics(result);
    return result;
  }

  function compareProjects(baselineProject, currentProject, options = {}) {
    return addSnapshotAlignment(baseCompareProjects(baselineProject, currentProject, options), baselineProject, currentProject);
  }

  return Object.freeze({
    ...base,
    version: "l5k-compare-v13.1",
    compareProjects,
    addSnapshotAlignment,
    alignedSnapshotDifferences
  });
});
