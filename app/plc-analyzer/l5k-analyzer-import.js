"use strict";

(function installServoForgeL5KImport(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createServoForgeL5KImport() {
  function unique(values) {
    return [...new Set((values || []).filter((value) => value !== null && value !== undefined && value !== "").map((value) => String(value)))];
  }

  function normalized(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function stringifyEntry(entry) {
    try { return normalized(JSON.stringify(entry)); }
    catch { return normalized(String(entry || "")); }
  }

  function entryLabel(entry, index) {
    return String(entry?.title || entry?.label || entry?.name || entry?.id || entry?.code || `Library entry ${index + 1}`);
  }

  function findCoverageMatches(target, libraryEntries) {
    const needle = normalized(target);
    if (!needle) return [];
    const matches = [];
    (libraryEntries || []).forEach((entry, index) => {
      if (!stringifyEntry(entry).includes(needle)) return;
      matches.push({
        id: entry?.id ?? null,
        code: entry?.code ?? null,
        title: entryLabel(entry, index)
      });
    });
    return matches;
  }

  function sourceMentions(source, tag) {
    const haystack = String(source || "");
    const needle = String(tag || "");
    return Boolean(needle) && haystack.includes(needle);
  }

  function writerSources(fault) {
    return (fault?.writers || []).map((writer) => String(writer?.source || ""));
  }

  function writerSymbols(fault) {
    return unique((fault?.writers || []).flatMap((writer) => writer?.symbols || []));
  }

  function relatedByTag(items, fault) {
    const sources = writerSources(fault);
    const symbols = new Set(writerSymbols(fault));
    return (items || []).filter((item) => {
      const tag = String(item?.tag || item?.name || "");
      return Boolean(tag) && (symbols.has(tag) || sources.some((source) => sourceMentions(source, tag)));
    });
  }

  function relatedMotion(project, fault) {
    const sources = writerSources(fault);
    const symbols = writerSymbols(fault);
    const symbolSet = new Set(symbols);
    const related = [];
    const seen = new Set();

    function add(reference) {
      const key = JSON.stringify([
        reference?.instruction ?? null,
        reference?.axis ?? null,
        reference?.member ?? null,
        reference?.source ?? null,
        reference?.routine ?? null,
        reference?.rung ?? null
      ]);
      if (seen.has(key)) return;
      seen.add(key);
      related.push(reference);
    }

    for (const reference of project?.motionReferences || []) {
      const axis = String(reference?.axis || "");
      const member = String(reference?.member || "");
      const source = String(reference?.source || "");
      const fullStatus = axis && member ? `${axis}.${member}` : "";
      const exactCandidates = unique([source, fullStatus, axis]);
      const matches = exactCandidates.some((value) => symbolSet.has(value) || sources.some((writerSource) => sourceMentions(writerSource, value)))
        || (axis && symbols.some((symbol) => symbol === axis || symbol.startsWith(`${axis}.`)));
      if (matches) add(reference);
    }

    // Some Rockwell projects use axis tag names such as AxisOne or Servo1 that
    // do not end in the word "Axis". Use the parsed AXIS_* declarations as the
    // authority instead of inferring motion status from the tag name alone.
    for (const axisRecord of project?.axes || []) {
      const axis = String(axisRecord?.name || "");
      if (!axis) continue;
      for (const symbol of symbols) {
        if (!symbol.startsWith(`${axis}.`)) continue;
        const member = symbol.slice(axis.length + 1);
        if (!member) continue;
        const writer = (fault?.writers || []).find((item) => (item?.symbols || []).includes(symbol) || sourceMentions(item?.source, symbol));
        add({
          instruction: "STATUS",
          axis,
          member,
          source: symbol,
          program: writer?.program ?? null,
          routine: writer?.routine ?? null,
          rung: writer?.rung ?? null,
          line: writer?.line ?? null,
          evidenceClass: "declared-axis-status"
        });
      }
    }

    return related;
  }

  function collectIoReferences(fault) {
    const io = [];
    for (const writer of fault?.writers || []) {
      for (const symbol of writer?.symbols || []) {
        if (/(?:^|\b)(?:Local|Remote|Node\w*):\d+:[IO](?:\.|$)/i.test(String(symbol))) io.push(symbol);
      }
      for (const match of String(writer?.source || "").matchAll(/\b(?:Local|Remote|Node\w*):\d+:[IO](?:\.[A-Za-z0-9_:[\].-]+)?/gi)) io.push(match[0]);
    }
    return unique(io);
  }

  function sourceLocation(record) {
    return {
      program: record?.program ?? null,
      routine: record?.routine ?? null,
      rung: record?.rung ?? null,
      line: record?.line ?? null
    };
  }

  function makeCandidate(project, fault, libraryEntries, libraryAvailable) {
    const target = String(fault?.target || "").trim();
    const coverageMatches = libraryAvailable ? findCoverageMatches(target, libraryEntries) : [];
    const coverageStatus = !libraryAvailable
      ? "coverage-unverified"
      : coverageMatches.length
        ? "covered-exact-source-reference"
        : "review-candidate";
    const timers = relatedByTag(project?.timers, fault);
    const counters = relatedByTag(project?.counters, fault);
    const motion = relatedMotion(project, fault);
    const ioReferences = collectIoReferences(fault);
    const writers = (fault?.writers || []).map((writer) => ({
      instruction: writer?.instruction ?? null,
      location: sourceLocation(writer),
      source: writer?.source ?? null,
      symbols: unique(writer?.symbols || [])
    }));
    const resets = (fault?.resets || []).map((reset) => ({
      instruction: reset?.instruction ?? null,
      location: sourceLocation(reset),
      source: reset?.source ?? null
    }));

    return {
      target,
      coverageStatus,
      reviewRequired: coverageStatus !== "covered-exact-source-reference",
      coverageMatches,
      controller: project?.controller ?? null,
      exportVersion: project?.exportVersion ?? null,
      sourceFile: project?.source?.fileName ?? null,
      writers,
      resets,
      relatedTimers: timers.map((timer) => ({
        tag: timer?.tag ?? null,
        instructions: unique((timer?.instructions || []).map((item) => item?.type)),
        presetValues: unique(timer?.presetValues || [])
      })),
      relatedCounters: counters.map((counter) => ({
        tag: counter?.tag ?? null,
        instructions: unique((counter?.instructions || []).map((item) => item?.type)),
        presetValues: unique(counter?.presetValues || [])
      })),
      ioReferences,
      motionReferences: motion.map((reference) => ({
        instruction: reference?.instruction ?? null,
        axis: reference?.axis ?? null,
        source: reference?.source ?? null,
        member: reference?.member ?? null,
        routine: reference?.routine ?? null,
        rung: reference?.rung ?? null,
        evidenceClass: reference?.evidenceClass ?? null
      })),
      draft: {
        status: "draft-sme-review-required",
        suggestedId: `plc-${target.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fault"}`,
        alarmCode: null,
        alarmText: null,
        title: null,
        exactPlcTarget: target,
        sourceClass: "PLC export",
        sourceFile: project?.source?.fileName ?? null,
        controller: project?.controller ?? null,
        producerEvidence: writers,
        resetEvidence: resets,
        timerEvidence: timers.map((timer) => ({ tag: timer?.tag ?? null, presetValues: unique(timer?.presetValues || []) })),
        counterEvidence: counters.map((counter) => ({ tag: counter?.tag ?? null, presetValues: unique(counter?.presetValues || []) })),
        ioEvidence: ioReferences,
        motionEvidence: motion,
        unresolvedFields: [
          "HMI/alarm number",
          "HMI/alarm text",
          "machine scope and namespace",
          "technician-facing symptom wording",
          "electrical schematic/wire/connector route unless separately sourced",
          "runtime state and actual device condition"
        ],
        sourceBoundary: "Static PLC-source evidence only. Do not publish this draft until an SME verifies alarm identity, machine scope, runtime meaning, and any electrical/mechanical route from separate source material."
      }
    };
  }

  function buildImportQueue(project, libraryEntries = [], options = {}) {
    if (!project) throw new Error("A parsed L5K project is required.");
    const libraryAvailable = options.libraryAvailable !== false;
    const candidates = (project.faultWriters || []).map((fault) => makeCandidate(project, fault, libraryEntries, libraryAvailable));
    const statistics = {
      totalFaultTargets: candidates.length,
      coveredExactSource: candidates.filter((candidate) => candidate.coverageStatus === "covered-exact-source-reference").length,
      reviewCandidates: candidates.filter((candidate) => candidate.coverageStatus === "review-candidate").length,
      coverageUnverified: candidates.filter((candidate) => candidate.coverageStatus === "coverage-unverified").length
    };
    return {
      project: {
        controller: project.controller ?? null,
        exportVersion: project.exportVersion ?? null,
        sourceFile: project.source?.fileName ?? null
      },
      libraryAvailable,
      statistics,
      candidates
    };
  }

  function filterImportQueue(queue, filters = {}) {
    const search = normalized(filters.search || "");
    const status = String(filters.coverageStatus || "all");
    return (queue?.candidates || []).filter((candidate) => {
      if (status !== "all" && candidate.coverageStatus !== status) return false;
      if (!search) return true;
      return normalized(JSON.stringify(candidate)).includes(search);
    });
  }

  function exportReviewQueue(queue, options = {}) {
    const includeCovered = options.includeCovered === true;
    const candidates = (queue?.candidates || []).filter((candidate) => includeCovered || candidate.reviewRequired);
    return {
      schema: "servoforge-plc-import-review-v1",
      generatedAt: options.generatedAt || null,
      sourceProject: queue?.project || null,
      libraryCoverageAvailable: Boolean(queue?.libraryAvailable),
      publicationState: "review-only",
      candidates: candidates.map((candidate) => candidate.draft)
    };
  }

  return Object.freeze({
    findCoverageMatches,
    buildImportQueue,
    filterImportQueue,
    exportReviewQueue
  });
});
