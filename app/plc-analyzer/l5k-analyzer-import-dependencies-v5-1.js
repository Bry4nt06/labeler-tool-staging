"use strict";

(function installDependencyAwareImport(root, factory) {
  const importer = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-import.js")
    : root?.ServoForgeL5KImport;
  const analyzer = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-dependencies-v5.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(importer, analyzer);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDependencyAwareImport(importer, analyzer) {
  if (!importer || typeof importer.buildImportQueue !== "function") throw new Error("ServoForge PLC import engine is required before dependency-aware import.");

  const baseBuildImportQueue = importer.buildImportQueue;

  function summarizeTrace(trace) {
    if (!trace) return null;
    return {
      classification: trace.classification || "static-inference",
      runtimeStateProven: false,
      truncated: Boolean(trace.truncated),
      limits: trace.limits || null,
      upstreamSymbols: (trace.nodes || []).slice(0, 150).map((node) => ({
        symbol: node.symbol,
        depth: node.depth,
        kind: node.kind,
        program: node.program ?? null,
        scope: node.scope ?? null,
        dataType: node.dataType ?? null,
        memberDataType: node.memberDataType ?? null,
        dataTypeDefinition: node.dataTypeDefinition ?? null,
        aoiDefinition: node.aoiDefinition ?? null,
        cycle: Boolean(node.cycle)
      })),
      sourceRelationships: (trace.edges || []).slice(0, 150).map((edge) => ({
        from: edge.from,
        to: edge.to,
        relation: edge.relation,
        program: edge.program ?? null,
        routine: edge.routine ?? null,
        rung: edge.rung ?? null,
        line: edge.line ?? null
      })),
      writerRoutines: [...new Set((trace.writers || []).map((writer) => `${writer.program || "?"}/${writer.routine || "?"}`).filter(Boolean))],
      executionPaths: (trace.executionPaths || []).slice(0, 30).map((group) => ({
        routine: group.routine,
        paths: (group.paths || []).slice(0, 12).map((path) => path.map((step) => ({
          program: step.program ?? null,
          routine: step.routine ?? null,
          main: Boolean(step.root),
          callerNotLocated: Boolean(step.unlocatedCaller),
          cycle: Boolean(step.cycle),
          callLocation: step.call ? {
            program: step.call.program ?? null,
            routine: step.call.callerRoutine ?? null,
            rung: step.call.rung ?? null,
            line: step.call.line ?? null
          } : null
        })))
      })),
      aoiContexts: (trace.aoiContexts || []).slice(0, 50).map((context) => ({
        symbol: context.symbol,
        instanceTag: context.instanceTag,
        definition: context.definition,
        callCount: (context.calls || []).length
      })),
      sourceBoundary: "Dependency evidence is a bounded static-source trace. It does not prove live tag values, physical wiring condition, actual scan behavior, device health, or alarm identity."
    };
  }

  function dependencyEvidenceFor(project, target) {
    if (!project?.dependencies || !analyzer || typeof analyzer.traceTarget !== "function") return null;
    try {
      return summarizeTrace(analyzer.traceTarget(project, target, { maxDepth: 5, maxNodes: 180 }));
    } catch (_error) {
      return null;
    }
  }

  function buildImportQueue(project, libraryEntries = [], options = {}) {
    const queue = baseBuildImportQueue(project, libraryEntries, options);
    let traced = 0;
    queue.candidates = (queue.candidates || []).map((candidate) => {
      const dependencyEvidence = dependencyEvidenceFor(project, candidate.target);
      if (!dependencyEvidence) return candidate;
      traced += 1;
      return {
        ...candidate,
        dependencyEvidence,
        draft: {
          ...candidate.draft,
          dependencyEvidence,
          unresolvedFields: [...new Set([
            ...(candidate.draft?.unresolvedFields || []),
            "live values/states for dependency symbols",
            "runtime execution/scan behavior beyond source-visible call relationships"
          ])]
        }
      };
    });
    queue.statistics = {
      ...(queue.statistics || {}),
      dependencyTraced: traced
    };
    queue.dependencyEvidenceVersion = "v5.1";
    return queue;
  }

  return Object.freeze({
    ...importer,
    buildImportQueue,
    summarizeDependencyTrace: summarizeTrace
  });
});
