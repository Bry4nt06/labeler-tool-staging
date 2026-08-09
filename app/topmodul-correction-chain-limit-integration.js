"use strict";

(function installTopModulCorrectionChainLimit(global) {
  if (global.LabelerTopModulCorrectionChainLimit?.installed) return;

  const MAX_CONSECUTIVE_CORRECTIONS = 2;
  const APPLICABLE_FAMILIES = new Set(["TOPMODUL", "APL"]);

  const familyToken = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");

  function activeMap() {
    try { return typeof global.activeMachineMap === "function" ? global.activeMachineMap() : null; }
    catch { return null; }
  }

  function applicable(rows = global.state?.program, options = {}) {
    const map = options.map || activeMap();
    const machine = familyToken(options.machineFamily || options.family || options.machineType || map?.machineType || map?.name);
    if (machine.includes("TOPMODUL")) return true;
    const application = String(options.applicationMode || map?.applicationMode || global.state?.applicationMode || "").toLowerCase();
    if (application === "apl") return true;
    const annotated = familyToken(global.state?.machineFamilyGrammar?.family || rows?.find?.((row) => row?.machineGrammarFamily)?.machineGrammarFamily);
    return APPLICABLE_FAMILIES.has(annotated);
  }

  function limitIssues(rows = []) {
    const issues = [];
    let run = 0;
    let runStart = -1;
    (Array.isArray(rows) ? rows : []).forEach((row, index) => {
      if (Number(row?.cmd) === 7) {
        if (run === 0) runStart = index;
        run += 1;
        if (run === MAX_CONSECUTIVE_CORRECTIONS + 1) {
          const startHmi = rows[runStart]?.hmi ?? runStart + 1;
          const hmi = row?.hmi ?? index + 1;
          issues.push({
            level: "bad",
            code: "topmodul-correction-chain-too-long",
            category: "grammar",
            hmi,
            startHmi,
            consecutiveCorrections: run,
            maxConsecutiveCorrections: MAX_CONSECUTIVE_CORRECTIONS,
            message: `HMI ${startHmi} -> ${hmi} contains more than ${MAX_CONSECUTIVE_CORRECTIONS} consecutive CMD 7 corrections. TopModul APL requires a CMD 3 reference after at most two consecutive CMD 7 commands.`
          });
        }
      } else {
        run = 0;
        runStart = -1;
      }
    });
    return issues;
  }

  function dedupe(issues) {
    const seen = new Set();
    return (Array.isArray(issues) ? issues : []).filter((issue) => {
      const key = `${issue?.code}|${issue?.hmi ?? ""}|${issue?.startHmi ?? ""}|${issue?.message ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function summary(issues) {
    return issues.reduce((result, issue) => {
      const level = issue?.level || "warn";
      result[level] = (result[level] || 0) + 1;
      result.total += 1;
      return result;
    }, { bad: 0, warn: 0, ok: 0, total: 0 });
  }

  function categories(issues) {
    return issues.reduce((result, issue) => {
      const category = issue?.category || "general";
      const level = issue?.level || "warn";
      result[category] ||= { bad: 0, warn: 0, ok: 0, total: 0 };
      result[category][level] = (result[category][level] || 0) + 1;
      result[category].total += 1;
      return result;
    }, {});
  }

  function wrapGrammar() {
    const base = global.LabelerMachineFamilyGrammarDriver;
    if (!base?.analyze || base.maxTwoConsecutiveCorrections) return;
    const analyze = (rows, options = {}) => {
      const result = base.analyze(rows, options);
      if (!applicable(rows, { ...options, machineFamily: result?.family || options.machineFamily })) return result;
      const issues = dedupe([...(result?.issues || []), ...limitIssues(rows)]);
      const counts = summary(issues);
      return {
        ...result,
        valid: counts.bad === 0,
        status: counts.bad ? "FAIL" : counts.warn ? "REVIEW" : "PASS",
        summary: counts,
        issues,
        maxConsecutiveCorrections: MAX_CONSECUTIVE_CORRECTIONS
      };
    };
    global.LabelerMachineFamilyGrammarDriver = Object.freeze({
      ...base,
      analyze,
      validate(rows, options = {}) { return analyze(rows, options).issues; },
      maxTwoConsecutiveCorrections: true,
      maxConsecutiveCorrections: MAX_CONSECUTIVE_CORRECTIONS
    });
  }

  function wrapCommandDriver() {
    const base = global.LabelerServoCommandDriver;
    if (!base || base.maxTwoConsecutiveCorrections) return;
    const priorGrammar = typeof base.validateGrammar === "function" ? base.validateGrammar.bind(base) : () => [];
    const priorReferences = typeof base.validateReferences === "function" ? base.validateReferences.bind(base) : priorGrammar;
    const merged = (prior, rows, tolerance) => applicable(rows)
      ? dedupe([...(prior(rows, tolerance) || []), ...limitIssues(rows)])
      : prior(rows, tolerance);
    global.LabelerServoCommandDriver = Object.freeze({
      ...base,
      validateGrammar(rows, tolerance) { return merged(priorGrammar, rows, tolerance); },
      validateReferences(rows, tolerance) { return merged(priorReferences, rows, tolerance); },
      maxTwoConsecutiveCorrections: true,
      maxConsecutiveCorrections: MAX_CONSECUTIVE_CORRECTIONS
    });
  }

  function wrapPipeline() {
    const base = global.LabelerServoPipelineValidator;
    if (!base?.analyze || base.maxTwoConsecutiveCorrections) return;
    global.LabelerServoPipelineValidator = Object.freeze({
      ...base,
      analyze(options = {}) {
        const result = base.analyze(options);
        const rows = options.rows || global.state?.program || [];
        if (!applicable(rows, options)) return result;
        const issues = dedupe([...(result?.issues || []), ...limitIssues(rows)]);
        const counts = summary(issues);
        return {
          ...result,
          valid: counts.bad === 0,
          status: counts.bad ? "FAIL" : counts.warn ? "REVIEW" : "PASS",
          summary: counts,
          categories: categories(issues),
          issues,
          maxConsecutiveCorrections: MAX_CONSECUTIVE_CORRECTIONS
        };
      },
      maxTwoConsecutiveCorrections: true,
      maxConsecutiveCorrections: MAX_CONSECUTIVE_CORRECTIONS
    });
  }

  wrapGrammar();
  wrapCommandDriver();
  wrapPipeline();

  global.LabelerTopModulCorrectionChainLimit = Object.freeze({
    installed: true,
    version: 1,
    maxConsecutiveCorrections: MAX_CONSECUTIVE_CORRECTIONS,
    limitIssues
  });
})(typeof window !== "undefined" ? window : globalThis);
