"use strict";

(function installStructuralTroubleshootingOverlay(global) {
  const STORAGE_KEY = "servoforge.troubleshooting.plcOverlay.v1";
  let lastQueue = null;

  function clean(value, maxLength = 240) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, maxLength) : null;
  }

  function unique(values, limit = 100) {
    return [...new Set((values || []).map((value) => clean(value, 240)).filter(Boolean))].slice(0, limit);
  }

  function location(record = {}) {
    const nested = record.location || {};
    return {
      program: clean(nested.program ?? record.program, 160),
      routine: clean(nested.routine ?? record.routine, 160),
      rung: nested.rung ?? record.rung ?? null,
      line: nested.line ?? record.startLine ?? record.line ?? null
    };
  }

  function compactWriter(writer = {}) {
    return Object.freeze({
      instruction: clean(writer.instruction, 32),
      ...location(writer),
      symbols: unique(writer.symbols, 40)
    });
  }

  function compactGate(gate = {}) {
    return Object.freeze({
      kind: clean(gate.kind, 40),
      instruction: clean(gate.instruction, 24),
      symbol: clean(gate.symbol, 240),
      sense: clean(gate.sense, 80),
      runtimeStateProven: false
    });
  }

  function compactInterlock(value) {
    if (!value) return null;
    return Object.freeze({
      version: "v12",
      pathCount: Number(value.pathCount || 0),
      gateCount: Number(value.gateCount || 0),
      gateSymbols: Object.freeze(unique(value.gateSymbols, 80)),
      paths: Object.freeze((value.paths || []).slice(0, 8).map((path) => Object.freeze({
        actionInstruction: clean(path.actionInstruction, 24),
        actionKind: clean(path.actionKind, 40),
        ...location(path),
        gateCount: Number(path.gateCount || 0),
        gates: Object.freeze((path.gates || []).slice(0, 16).map(compactGate)),
        gateSymbols: Object.freeze(unique(path.gateSymbols, 30)),
        selfHoldCandidate: Boolean(path.selfHoldCandidate),
        runtimeExecutionProven: false,
        runtimeGateStateProven: false,
        booleanBranchSemanticsProven: false
      }))),
      runtimeGateStateProven: false,
      booleanBranchSemanticsProven: false
    });
  }

  function compactRecovery(value) {
    if (!value) return null;
    return Object.freeze({
      version: "v13",
      relationshipCount: Number(value.relationshipCount || 0),
      pathCount: Number(value.pathCount || 0),
      sourcePairLocated: Boolean(value.sourcePairLocated),
      gateSymbols: Object.freeze(unique(value.gateSymbols, 80)),
      relationships: Object.freeze((value.relationships || []).slice(0, 8).map((item) => Object.freeze({
        target: clean(item.target, 240),
        latchWriterCount: Number(item.latchWriterCount || 0),
        unlatchPathCount: Number(item.unlatchPathCount || 0),
        sourcePairLocated: Boolean(item.sourcePairLocated),
        runtimeStateProven: false,
        causeClearedProven: false,
        safeToResetProven: false
      }))),
      paths: Object.freeze((value.paths || []).slice(0, 8).map((path) => Object.freeze({
        instruction: clean(path.instruction, 24),
        recoveryKind: clean(path.recoveryKind, 40),
        targetClass: clean(path.targetClass, 60),
        ...location(path),
        gateSymbols: Object.freeze(unique(path.gateSymbols, 30)),
        gates: Object.freeze((path.gates || []).slice(0, 16).map(compactGate)),
        runtimeExecutionProven: false,
        causeClearedProven: false,
        safeToResetProven: false
      }))),
      runtimeStateProven: false,
      causeClearedProven: false,
      safeToResetProven: false
    });
  }

  function compactAfi(value) {
    if (!value) return null;
    return Object.freeze({
      version: "v14",
      sameWriterRungCount: Number(value.sameWriterRungCount || 0),
      locations: Object.freeze((value.locations || []).slice(0, 12).map((item) => Object.freeze({
        instruction: "AFI",
        ...location(item),
        classification: clean(item.classification, 60) || "source-proven",
        runtimeStateProven: false
      }))),
      runtimeStateProven: false,
      causeProven: false,
      wholeRoutineDisabledProven: false
    });
  }

  function compactStructuralEvidence(value) {
    if (!value) return null;
    const interlock = compactInterlock(value.interlock);
    const recovery = compactRecovery(value.recovery);
    const afi = compactAfi(value.afi);
    if (!interlock && !recovery && !afi) return null;
    return Object.freeze({
      version: "v8",
      authority: "static-site-structure-only",
      interlock,
      recovery,
      afi,
      sourceBoundary: "Static source structure only. Interlock gates do not prove live gate state or Boolean branch semantics; recovery paths do not prove cause-clear or reset safety; AFI on the same writer rung does not prove AFI causality or whole-routine disablement."
    });
  }

  function compactCandidate(candidate = {}) {
    const dependency = candidate.dependencyEvidence || {};
    return Object.freeze({
      target: clean(candidate.target, 240),
      coverageStatus: clean(candidate.coverageStatus, 80),
      writers: Object.freeze((candidate.writers || []).slice(0, 40).map(compactWriter)),
      resets: Object.freeze((candidate.resets || []).slice(0, 40).map(compactWriter)),
      relatedTimers: Object.freeze(unique((candidate.relatedTimers || []).map((item) => item?.tag || item), 50)),
      relatedCounters: Object.freeze(unique((candidate.relatedCounters || []).map((item) => item?.tag || item), 50)),
      ioReferences: Object.freeze(unique(candidate.ioReferences, 80)),
      motionReferences: Object.freeze(unique((candidate.motionReferences || []).flatMap((item) => [item?.axis, item?.member, item?.instruction]).filter(Boolean), 80)),
      upstreamSymbols: Object.freeze(unique((dependency.upstreamSymbols || []).map((item) => item?.symbol || item), 80)),
      structuralEvidence: compactStructuralEvidence(candidate.structuralEvidence)
    });
  }

  function currentQueue() {
    return lastQueue || global.ServoForgePLCImportControllerIntake?.getLastQueue?.() || null;
  }

  function currentIdentity() {
    return global.ServoForgePLCImportControllerIntake?.readIdentity?.() || {};
  }

  function buildOverlay(queue = currentQueue()) {
    if (!queue || !Array.isArray(queue.candidates)) throw new Error("Analyze a PLC export before carrying it to Troubleshooter.");
    const identity = queue.controllerIdentity || queue.project?.controllerIdentity || {};
    const project = queue.project || {};
    const intake = currentIdentity();
    return Object.freeze({
      schema: "servoforge-troubleshooting-plc-overlay-v1",
      overlayVersion: "v2-structural-v8",
      structuralEvidenceVersion: "v8",
      createdAt: new Date().toISOString(),
      authority: "session-site-evidence-only",
      universalLibraryModified: false,
      sourceBoundary: "Machine-specific PLC names, tags, addresses, rung locations, timing values, I/O references, dependencies, interlock/permissive paths, recovery paths, and AFI locations are temporary source evidence for this uploaded controller only. Static structure does not prove live gate state, branch semantics, reset safety, AFI causality, or a universal machine rule.",
      siteLabel: clean(intake.siteLabel, 160),
      assetLabel: clean(intake.assetLabel || identity.displayName, 180),
      controllerRole: clean(intake.controllerRole || identity.role, 120),
      controllerName: clean(identity.parsedController || project.controller, 180),
      sourceFile: clean(identity.sourceFile || project.sourceFile, 220),
      sourceStatus: clean(identity.sourceStatus, 80),
      sourceStatusLabel: clean(identity.sourceStatusLabel, 160),
      controllerRevision: clean(identity.controllerRevision, 120),
      firmwareRevision: clean(identity.firmwareRevision, 120),
      exportDate: clean(identity.exportDate, 32),
      candidates: Object.freeze(queue.candidates.filter((candidate) => candidate?.target).slice(0, 750).map(compactCandidate))
    });
  }

  function saveOverlay(queue = currentQueue()) {
    const overlay = buildOverlay(queue);
    global.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
    return overlay;
  }

  global.addEventListener("servoforge:plc-import-queue-ready", (event) => {
    lastQueue = event.detail?.queue || null;
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("#plcImportUseInTroubleshooter");
    if (!button || button.disabled) return;
    const queue = currentQueue();
    if (!queue) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    saveOverlay(queue);
    global.location.href = "../troubleshooting/index.html?plcOverlay=1&structuralEvidence=v8";
  }, true);

  global.ServoForgePLCImportStructuralOverlay = Object.freeze({
    version: "v8",
    buildOverlay,
    saveOverlay,
    compactCandidate,
    compactStructuralEvidence
  });
})(window);
