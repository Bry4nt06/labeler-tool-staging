"use strict";

(function installTopModulAllowedCorrectionDiagnostics(global) {
  if (global.LabelerTopModulAllowedCorrectionDiagnostics?.installed) return;

  const RETRY_MS = 25;
  let installed = false;

  function activeMap() {
    try { return typeof global.activeMachineMap === "function" ? global.activeMachineMap() : null; }
    catch { return null; }
  }

  function lateOptimizerReady() {
    return global.LabelerTopModulCorrectionChainLimit?.installed === true
      && Number(global.LabelerPostWipeCoveragePolicy?.version || 0) >= 3;
  }

  function isTopModul() {
    const map = activeMap();
    const machine = String(map?.machineType || map?.name || "").toUpperCase();
    if (machine.includes("TOPMODUL")) return true;
    return String(global.state?.machineFamilyGrammar?.family || "").toUpperCase() === "TOPMODUL";
  }

  function allowedRestSeparatedCorrectionDiagnostic(item) {
    if (!item) return false;
    const message = String(item.message || "");
    const recommendation = String(item.recommendation || "");
    const code = String(item.code || "").toLowerCase();
    const combined = `${message} ${recommendation}`;
    const namesObsoleteRule = /nonstandard\s+correction\s+chain/i.test(combined)
      || /only\s+standard\s+backspin\s*\/\s*forward[-\s]?wipe\s+pairs/i.test(combined)
      || /nonstandard[-_]?correction[-_]?chain/.test(code);
    const hasRestSeparatedCorrections = /CMD\s*7[\s\S]*?(?:→|->|>)\s*CMD\s*3[\s\S]*?(?:→|->|>)\s*CMD\s*7/i.test(combined)
      || /7\s*[-→>]\s*3\s*[-→>]\s*7/.test(combined);
    return namesObsoleteRule && hasRestSeparatedCorrections;
  }

  function filteredResult(result, rows, options, driver) {
    if (!result || !isTopModul()) return result;
    const diagnostics = (Array.isArray(result.diagnostics) ? result.diagnostics : [])
      .filter((item) => !allowedRestSeparatedCorrectionDiagnostic(item));
    if (diagnostics.length === result.diagnostics?.length) return result;

    result.diagnostics = diagnostics;
    if (typeof driver?.calculateMetrics === "function") {
      result.currentMetrics = driver.calculateMetrics(result.sourceRows || rows || [], options || {}, diagnostics);
    }
    result.status = diagnostics.some((item) => item.level === "bad")
      ? "ACTION"
      : diagnostics.some((item) => item.level === "warn")
        ? "REVIEW"
        : "HEALTHY";
    result.topModulRestSeparatedCorrectionsAllowed = true;
    return result;
  }

  function install() {
    if (installed) return true;
    const driver = global.LabelerProgramOptimizerDriver;
    if (!driver?.analyze || !lateOptimizerReady()) return false;

    const baseAnalyze = driver.analyze.bind(driver);
    global.LabelerProgramOptimizerDriver = Object.freeze({
      ...driver,
      analyze(rows, options = {}) {
        return filteredResult(baseAnalyze(rows, options), rows, options, driver);
      },
      topModulRestSeparatedCorrectionsAllowedV2: true
    });

    global.LabelerTopModulAllowedCorrectionDiagnostics = Object.freeze({
      installed: true,
      version: 2,
      lateOptimizerReady,
      allowedRestSeparatedCorrectionDiagnostic,
      filteredResult
    });
    installed = true;

    try {
      if (global.state?.programOptimization) {
        global.state.programOptimization.lastSignature = "";
        global.state.programOptimization.result = null;
      }
      global.setTimeout(() => {
        if (typeof global.renderProgram === "function") global.renderProgram();
        if (typeof global.renderValidation === "function") global.renderValidation();
      }, 0);
    } catch {
      // The next normal render will use the corrected diagnostic policy.
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);