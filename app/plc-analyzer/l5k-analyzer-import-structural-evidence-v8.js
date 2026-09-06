"use strict";

(function installStructuralEvidenceImport(root, factory) {
  const importer = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-import-controller-v6.js")
    : root?.ServoForgeL5KImport;
  const api = factory(importer);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createStructuralEvidenceImport(importer) {
  if (!importer || typeof importer.buildImportQueue !== "function") {
    throw new Error("ServoForge controller-intake PLC import engine is required before structural evidence v8.");
  }

  const baseBuildImportQueue = importer.buildImportQueue;
  const SOURCE_BOUNDARY = "Structural evidence is bounded static PLC-source evidence only. Source-visible interlock gates do not prove current gate state or complete Boolean branch semantics; reset/unlatch paths do not prove the original cause has cleared or that a reset is safe; AFI on a writer rung does not prove the AFI caused the fault, disabled every branch, or disabled the whole routine.";

  function unique(values, limit = 100) {
    return [...new Set((values || []).filter((value) => value !== null && value !== undefined && value !== "").map((value) => String(value)))].slice(0, limit);
  }

  function location(record = {}) {
    const nested = record.location || {};
    return {
      program: nested.program ?? record.program ?? null,
      routine: nested.routine ?? record.routine ?? null,
      rung: nested.rung ?? record.rung ?? null,
      line: nested.line ?? record.startLine ?? record.line ?? null
    };
  }

  function sameLocation(left, right) {
    const a = location(left);
    const b = location(right);
    return Boolean(a.program && a.routine)
      && a.program === b.program
      && a.routine === b.routine
      && String(a.rung) === String(b.rung);
  }

  function compactGate(gate = {}) {
    return {
      kind: gate.kind ?? null,
      instruction: gate.instruction ?? null,
      symbol: gate.symbol ?? null,
      sense: gate.sense ?? null,
      args: unique(gate.args, 8),
      runtimeStateProven: false
    };
  }

  function interlockEvidence(project, target) {
    const paths = (project?.dependencies?.interlockTopology?.actionPaths || [])
      .filter((path) => String(path?.target || "") === target)
      .slice(0, 20)
      .map((path) => ({
        actionInstruction: path.actionInstruction ?? null,
        actionKind: path.actionKind ?? null,
        ...location(path),
        gateCount: (path.gates || []).length,
        gates: (path.gates || []).slice(0, 30).map(compactGate),
        gateSymbols: unique((path.gates || []).map((gate) => gate?.symbol), 30),
        selfHoldCandidate: Boolean(path.selfHoldCandidate),
        taskRootReachable: Boolean(path.taskRootReachable),
        runtimeExecutionProven: false,
        runtimeGateStateProven: false,
        booleanBranchSemanticsProven: false
      }));
    if (!paths.length) return null;
    return {
      version: "v12",
      pathCount: paths.length,
      gateCount: paths.reduce((sum, path) => sum + path.gateCount, 0),
      gateSymbols: unique(paths.flatMap((path) => path.gateSymbols), 80),
      paths,
      runtimeGateStateProven: false,
      booleanBranchSemanticsProven: false,
      sourceBoundary: "Source-visible same-rung XIC/XIO/comparison evidence preceding a supported action. This does not prove current gate values, complete branch logic, or that any displayed condition is the live blocker."
    };
  }

  function recoveryEvidence(project, target) {
    const topology = project?.dependencies?.resetRecoveryTopology;
    if (!topology) return null;
    const relationships = (topology.relationships || [])
      .filter((item) => String(item?.target || "") === target)
      .slice(0, 12)
      .map((item) => ({
        target: item.target,
        latchWriterCount: Number(item.latchWriterCount || 0),
        unlatchPathCount: Number(item.unlatchPathCount || 0),
        sourcePairLocated: Boolean(item.sourcePairLocated),
        runtimeStateProven: false,
        causeClearedProven: false,
        safeToResetProven: false
      }));
    const paths = (topology.paths || [])
      .filter((path) => String(path?.target || "") === target)
      .slice(0, 20)
      .map((path) => ({
        instruction: path.instruction ?? null,
        recoveryKind: path.recoveryKind ?? null,
        targetClass: path.targetClass ?? null,
        ...location(path),
        gates: (path.gates || []).slice(0, 30).map(compactGate),
        gateSymbols: unique((path.gates || []).map((gate) => gate?.symbol), 30),
        taskRootReachable: Boolean(path.taskRootReachable),
        runtimeExecutionProven: false,
        causeClearedProven: false,
        safeToResetProven: false
      }));
    if (!relationships.length && !paths.length) return null;
    return {
      version: "v13",
      relationshipCount: relationships.length,
      pathCount: paths.length,
      sourcePairLocated: relationships.some((item) => item.sourcePairLocated),
      gateSymbols: unique(paths.flatMap((path) => path.gateSymbols), 80),
      relationships,
      paths,
      runtimeStateProven: false,
      causeClearedProven: false,
      safeToResetProven: false,
      sourceBoundary: "Source-visible latch/unlatch or RES recovery structure only. It does not prove the recovery rung executes, the cause has cleared, or that any reset is currently safe or appropriate."
    };
  }

  function afiEvidence(project, candidate) {
    const writers = candidate?.writers || [];
    if (!writers.length) return null;
    const references = (project?.afiReferences || [])
      .filter((afi) => writers.some((writer) => sameLocation(writer, afi)))
      .slice(0, 30)
      .map((afi) => ({
        instruction: "AFI",
        ...location(afi),
        classification: afi.classification || "source-proven",
        runtimeStateProven: false
      }));
    if (!references.length) return null;
    return {
      version: "v14",
      sameWriterRungCount: references.length,
      locations: references,
      runtimeStateProven: false,
      causeProven: false,
      wholeRoutineDisabledProven: false,
      sourceBoundary: "AFI is source-proven on the same program/routine/rung as a candidate writer. This is a control-sequence review clue only; it does not prove the AFI caused the fault, disabled adjacent branches, or disabled the whole routine."
    };
  }

  function structuralEvidenceFor(project, candidate) {
    const target = String(candidate?.target || "").trim();
    if (!target) return null;
    const interlock = interlockEvidence(project, target);
    const recovery = recoveryEvidence(project, target);
    const afi = afiEvidence(project, candidate);
    if (!interlock && !recovery && !afi) return null;
    return {
      version: "v8",
      authority: "static-site-structure-only",
      interlock,
      recovery,
      afi,
      sourceBoundary: SOURCE_BOUNDARY
    };
  }

  function decorateCandidate(project, candidate) {
    const structuralEvidence = structuralEvidenceFor(project, candidate);
    if (!structuralEvidence) return candidate;
    return {
      ...candidate,
      structuralEvidence,
      draft: {
        ...candidate.draft,
        structuralEvidence,
        unresolvedFields: [...new Set([
          ...(candidate.draft?.unresolvedFields || []),
          "live interlock/permissive state and complete Boolean branch semantics",
          "whether a reset/unlatch path is executing, the originating cause is cleared, or a reset is safe",
          "whether an AFI on the same source rung is causal or affects the branch/routine relevant to the symptom"
        ])],
        sourceBoundary: `${candidate.draft?.sourceBoundary || "Static PLC-source evidence only."} ${SOURCE_BOUNDARY}`
      }
    };
  }

  function buildImportQueue(project, libraryEntries = [], options = {}) {
    const queue = baseBuildImportQueue(project, libraryEntries, options);
    const candidates = (queue.candidates || []).map((candidate) => decorateCandidate(project, candidate));
    return {
      ...queue,
      importEvidenceVersion: "v8",
      statistics: {
        ...(queue.statistics || {}),
        interlockEnriched: candidates.filter((candidate) => candidate.structuralEvidence?.interlock).length,
        recoveryEnriched: candidates.filter((candidate) => candidate.structuralEvidence?.recovery).length,
        afiWriterRungCandidates: candidates.filter((candidate) => candidate.structuralEvidence?.afi).length
      },
      candidates
    };
  }

  return Object.freeze({
    ...importer,
    buildImportQueue,
    importEvidenceVersion: "v8",
    summarizeStructuralEvidence: structuralEvidenceFor,
    structuralEvidenceSourceBoundary: SOURCE_BOUNDARY
  });
});
