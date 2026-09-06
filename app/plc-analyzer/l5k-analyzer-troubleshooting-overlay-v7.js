"use strict";

(function installTroubleshootingOverlay(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeTroubleshootingOverlay = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTroubleshootingOverlay() {
  const STORAGE_KEY = "servoforge.troubleshooting.plcOverlay.v1";
  const MAX_CANDIDATES = 750;
  const MAX_UPSTREAM = 80;

  function clean(value, maxLength = 240) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, maxLength) : null;
  }

  function unique(values, limit = 100) {
    return [...new Set((values || []).map((value) => clean(value, 240)).filter(Boolean))].slice(0, limit);
  }

  function compactWriter(writer = {}) {
    return Object.freeze({
      instruction: clean(writer.instruction, 32),
      program: clean(writer.program, 160),
      routine: clean(writer.routine, 160),
      rung: writer.rung ?? null,
      line: writer.startLine ?? writer.line ?? null,
      symbols: unique(writer.symbols, 40)
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
      motionReferences: Object.freeze(unique((candidate.motionReferences || []).map((item) => item?.axis || item?.member || item), 80)),
      upstreamSymbols: Object.freeze(unique(dependency.upstreamSymbols, MAX_UPSTREAM))
    });
  }

  function buildOverlay(queue, options = {}) {
    if (!queue || !Array.isArray(queue.candidates)) throw new Error("A completed PLC Import Assistant review queue is required.");
    const identity = queue.controllerIdentity || queue.project?.controllerIdentity || {};
    const project = queue.project || {};
    const siteLabel = clean(options.siteLabel || identity.siteLabel, 160);
    const assetLabel = clean(options.assetLabel || identity.assetLabel || identity.displayName, 180);
    const controllerRole = clean(options.controllerRole || identity.controllerRole || identity.role, 120);
    const controllerName = clean(identity.parsedController || project.controller, 180);
    const sourceFile = clean(identity.sourceFile || project.sourceFile, 220);
    const candidates = queue.candidates.filter((candidate) => candidate?.target).slice(0, MAX_CANDIDATES).map(compactCandidate);

    return Object.freeze({
      schema: "servoforge-troubleshooting-plc-overlay-v1",
      overlayVersion: "v1",
      createdAt: new Date().toISOString(),
      authority: "session-site-evidence-only",
      universalLibraryModified: false,
      sourceBoundary: "Machine-specific PLC names, tags, addresses, rung locations, timing values, I/O references, and dependency paths are temporary source evidence for this uploaded controller only. They are not universal ServoForge troubleshooting rules and must not be transferred to another machine without local source verification.",
      siteLabel,
      assetLabel,
      controllerRole,
      controllerName,
      sourceFile,
      sourceStatus: clean(identity.sourceStatus, 80),
      sourceStatusLabel: clean(identity.sourceStatusLabel, 160),
      controllerRevision: clean(identity.controllerRevision, 120),
      firmwareRevision: clean(identity.firmwareRevision, 120),
      exportDate: clean(identity.exportDate, 32),
      candidates: Object.freeze(candidates)
    });
  }

  function saveOverlay(overlay, storage) {
    if (!overlay || overlay.schema !== "servoforge-troubleshooting-plc-overlay-v1") throw new Error("A valid ServoForge troubleshooting PLC overlay is required.");
    const target = storage || (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    if (!target) throw new Error("Session storage is unavailable.");
    target.setItem(STORAGE_KEY, JSON.stringify(overlay));
    return overlay;
  }

  function loadOverlay(storage) {
    const target = storage || (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    if (!target) return null;
    try {
      const parsed = JSON.parse(target.getItem(STORAGE_KEY) || "null");
      return parsed?.schema === "servoforge-troubleshooting-plc-overlay-v1" ? parsed : null;
    } catch {
      return null;
    }
  }

  function clearOverlay(storage) {
    const target = storage || (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    if (target) target.removeItem(STORAGE_KEY);
  }

  return Object.freeze({ STORAGE_KEY, buildOverlay, saveOverlay, loadOverlay, clearOverlay });
});
