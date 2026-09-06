"use strict";

(function installAfiAudit(root, factory) {
  const analyzer = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-recovery-v13.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(analyzer, root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createAfiAudit(analyzer, root) {
  if (!analyzer || typeof analyzer.parseL5K !== "function") throw new Error("ServoForge PLC Analyzer v13 must load before AFI audit v14.");

  const baseParseL5K = analyzer.parseL5K;
  let lastProject = null;

  function locationKey(record) {
    return `${record.program || ""}/${record.routine || ""}/${record.rung}`;
  }

  function scanAfiReferences(project) {
    const afiReferences = [];
    for (const rung of project?.rungs || []) {
      const source = String(rung?.source || "");
      const pattern = /\bAFI\s*\(\s*\)/gi;
      let match;
      let ordinal = 0;
      while ((match = pattern.exec(source))) {
        ordinal += 1;
        const prefix = source.slice(0, match.index);
        const lineOffset = (prefix.match(/\n/g) || []).length;
        afiReferences.push({
          id: `afi:${rung.program || "unscoped"}:${rung.routine || "unscoped"}:${rung.number}:${ordinal}`,
          instruction: "AFI",
          program: rung.program ?? null,
          routine: rung.routine ?? null,
          rung: rung.number,
          line: (Number(rung.startLine) || 0) + lineOffset,
          source: match[0],
          rungSource: source,
          rungKey: locationKey(rung),
          classification: "source-proven",
          runtimeStateProven: false
        });
      }
    }

    project.afiReferences = afiReferences;
    project.afiAudit = {
      version: "v14",
      count: afiReferences.length,
      locations: afiReferences,
      sourceBoundary: "AFI locations are source-proven from the supplied L5K. An AFI forces the evaluated rung path false at that source location, but this static audit does not prove why it was placed there, whether adjacent branches remain active, or whether the surrounding routine is intentionally disabled."
    };
    project.statistics = {
      ...(project.statistics || {}),
      afis: afiReferences.length
    };
    return project;
  }

  function parseL5K(input, options = {}) {
    const project = scanAfiReferences(baseParseL5K(input, options));
    lastProject = project;
    if (root?.document && typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
      root.dispatchEvent(new root.CustomEvent("servoforge:plc-afi-project", { detail: { project } }));
    }
    return project;
  }

  return Object.freeze({
    ...analyzer,
    version: "l5k-analyzer-v14",
    parseL5K,
    scanAfiReferences,
    getLastAfiProject: () => lastProject
  });
});
