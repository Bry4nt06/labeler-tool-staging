"use strict";

(function installPostWipeCoveragePolicy(global) {
  if (global.LabelerPostWipeCoveragePolicy?.version >= 2) return;

  const RETRY_MS = 50;
  const EPSILON = 0.001;
  const number = (value, fallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const text = (value) => String(value ?? "").trim();
  const key = (value) => text(value).toLowerCase();

  function objectRange(item) {
    const start = number(item?.angle, number(item?.start));
    if (start === null) return null;
    let end = number(item?.end);
    if (end === null) end = start + Math.max(0, number(item?.wipeSpanDeg, 0));
    if (end < start) end += 360;
    return { start, end: Math.max(start, end) };
  }

  function alignedRange(item, frameStart, frameEnd) {
    const range = objectRange(item);
    if (!range) return null;
    const targetMid = (frameStart + frameEnd) / 2;
    const baseMid = (range.start + range.end) / 2;
    const shift = Math.round((targetMid - baseMid) / 360);
    const candidates = [shift - 1, shift, shift + 1].map((turns) => ({
      start: range.start + turns * 360,
      end: range.end + turns * 360,
      distance: Math.abs((range.start + range.end) / 2 + turns * 360 - targetMid)
    }));
    candidates.sort((left, right) => left.distance - right.distance || Math.abs(left.start) - Math.abs(right.start));
    return candidates[0];
  }

  function rowForDiagnostic(rows, diagnostic) {
    const source = Array.isArray(rows) ? rows : [];
    return source.find((row) => diagnostic?.eventId && String(row?.motionEventId || row?.mechanicalEventId || "") === String(diagnostic.eventId))
      || source.find((row) => Number(row?.hmi) === Number(diagnostic?.hmi))
      || null;
  }

  function matchingWipeObjects(row, diagnostic, options = {}) {
    const map = options.map && typeof options.map === "object"
      ? options.map
      : typeof global.activeMachineMap === "function"
        ? global.activeMachineMap()
        : null;
    const objects = Array.isArray(map?.objects) ? map.objects : [];
    const explicitIds = new Set([
      ...(Array.isArray(diagnostic?.objectIds) ? diagnostic.objectIds : []),
      ...(Array.isArray(row?.objectIds) ? row.objectIds : [])
    ].map(String));
    if (explicitIds.size) return objects.filter((item) => explicitIds.has(String(item?.id)));
    return objects.filter((item) =>
      Number(item?.station ?? item?.aggregate) === Number(row?.station ?? row?.aggregate)
      && /pad|roller|brush|wipe/i.test(`${item?.kind || ""} ${item?.type || ""} ${item?.name || ""}`)
    );
  }

  function isPostWipeOrientationHandoff(diagnostic, rows, options = {}) {
    if (diagnostic?.code !== "optimizer-wipe-contact") return false;
    const row = rowForDiagnostic(rows, diagnostic);
    if (!row || !/wipe\s+hold/.test(key(row.action || diagnostic.message))) return false;

    const source = Array.isArray(rows) ? rows : [];
    const index = source.indexOf(row);
    const frameStart = number(row.tableAngle);
    const frameEnd = number(source[index + 1]?.tableAngle);
    if (frameStart === null || frameEnd === null || frameEnd <= frameStart + EPSILON) return false;

    const ranges = matchingWipeObjects(row, diagnostic, options)
      .map((item) => alignedRange(item, frameStart, frameEnd))
      .filter(Boolean);
    if (!ranges.length) return false;

    const contactEnd = Math.max(...ranges.map((range) => range.end));
    return frameStart >= contactEnd - EPSILON;
  }

  function filterDiagnostics(result, rows, options, driver) {
    const sourceRows = Array.isArray(result?.sourceRows) ? result.sourceRows : rows;
    const diagnostics = (Array.isArray(result?.diagnostics) ? result.diagnostics : [])
      .filter((diagnostic) => !isPostWipeOrientationHandoff(diagnostic, sourceRows, options));
    result.diagnostics = diagnostics;
    if (typeof driver?.calculateMetrics === "function") result.currentMetrics = driver.calculateMetrics(sourceRows || [], options, diagnostics);
    result.status = diagnostics.some((item) => item.level === "bad")
      ? "ACTION"
      : diagnostics.some((item) => item.level === "warn")
        ? "REVIEW"
        : "HEALTHY";
    return result;
  }

  function install() {
    const driver = global.LabelerProgramOptimizerDriver;
    if (!driver?.analyze || driver.postWipeCoveragePolicyV2) return Boolean(driver?.postWipeCoveragePolicyV2);
    if (!/analyzeWithMapAwareCoverage/.test(String(driver.analyze))) return false;

    const baseAnalyze = driver.analyze.bind(driver);
    global.LabelerProgramOptimizerDriver = Object.freeze({
      ...driver,
      analyze(rows, options = {}) {
        return filterDiagnostics(baseAnalyze(rows, options), rows, options, driver);
      },
      postWipeCoveragePolicyV2: true
    });
    global.LabelerPostWipeCoveragePolicy = Object.freeze({
      installed: true,
      version: 2,
      objectRange,
      alignedRange,
      rowForDiagnostic,
      matchingWipeObjects,
      isPostWipeOrientationHandoff,
      filterDiagnostics
    });

    try {
      if (typeof state !== "undefined" && state.programOptimization) {
        state.programOptimization.lastSignature = "";
        state.programOptimization.result = null;
      }
      global.setTimeout(() => {
        if (typeof renderProgram === "function") renderProgram();
        if (typeof renderValidation === "function") renderValidation();
      }, 0);
    } catch {
      // The next render will use the corrected optimizer result.
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
