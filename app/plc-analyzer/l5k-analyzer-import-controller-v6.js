"use strict";

(function installControllerIntakeImport(root, factory) {
  const importer = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-import-dependencies-v5-1.js")
    : root?.ServoForgeL5KImport;
  const api = factory(importer);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createControllerIntakeImport(importer) {
  if (!importer || typeof importer.buildImportQueue !== "function" || typeof importer.exportReviewQueue !== "function") {
    throw new Error("ServoForge dependency-aware PLC import engine is required before controller intake v6.");
  }

  const EXPECTED_CONTROLLERS = Object.freeze([
    Object.freeze({ id: "lb1-labeler-1", line: "LB1", role: "Labeler", station: "Labeler 1", displayName: "LB1 Labeler 1", priority: 1 }),
    Object.freeze({ id: "lb1-apl-cart-2", line: "LB1", role: "APL Cart", station: "Cart 2", displayName: "LB1 APL Cart 2", priority: 2 }),
    Object.freeze({ id: "lb1-apl-cart-3", line: "LB1", role: "APL Cart", station: "Cart 3", displayName: "LB1 APL Cart 3", priority: 2 }),
    Object.freeze({ id: "lb1-apl-cart-4", line: "LB1", role: "APL Cart", station: "Cart 4", displayName: "LB1 APL Cart 4", priority: 2 }),
    Object.freeze({ id: "lb1-apl-cart-5", line: "LB1", role: "APL Cart", station: "Cart 5", displayName: "LB1 APL Cart 5", priority: 2 }),
    Object.freeze({ id: "lb1-apl-cart-6", line: "LB1", role: "APL Cart", station: "Cart 6", displayName: "LB1 APL Cart 6", priority: 2 }),
    Object.freeze({ id: "lb2-labeler-2", line: "LB2", role: "Labeler", station: "Labeler 2", displayName: "LB2 Labeler 2", priority: 3 }),
    Object.freeze({ id: "lb2-apl-cart-1", line: "LB2", role: "APL Cart", station: "Cart 1", displayName: "LB2 APL Cart 1", priority: 4 }),
    Object.freeze({ id: "lb2-apl-cart-2", line: "LB2", role: "APL Cart", station: "Cart 2", displayName: "LB2 APL Cart 2", priority: 4 }),
    Object.freeze({ id: "lb2-apl-cart-3", line: "LB2", role: "APL Cart", station: "Cart 3", displayName: "LB2 APL Cart 3", priority: 4 }),
    Object.freeze({ id: "lb2-apl-cart-4", line: "LB2", role: "APL Cart", station: "Cart 4", displayName: "LB2 APL Cart 4", priority: 4 }),
    Object.freeze({ id: "lb2-apl-cart-5", line: "LB2", role: "APL Cart", station: "Cart 5", displayName: "LB2 APL Cart 5", priority: 4 }),
    Object.freeze({ id: "lb2-apl-cart-6", line: "LB2", role: "APL Cart", station: "Cart 6", displayName: "LB2 APL Cart 6", priority: 4 })
  ]);

  const SOURCE_STATUSES = Object.freeze([
    Object.freeze({ id: "current-production", label: "Current production program" }),
    Object.freeze({ id: "backup", label: "Backup / saved copy" }),
    Object.freeze({ id: "older-revision", label: "Older / superseded revision" }),
    Object.freeze({ id: "unknown", label: "Source status not yet confirmed" })
  ]);

  const expectedById = new Map(EXPECTED_CONTROLLERS.map((item) => [item.id, item]));
  const sourceStatusIds = new Set(SOURCE_STATUSES.map((item) => item.id));

  function clean(value, maxLength = 240) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, maxLength) : null;
  }

  function normalizeDate(value) {
    const text = clean(value, 32);
    return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  function normalizeControllerIdentity(input = {}, project = {}) {
    const requestedId = clean(input.expectedControllerId, 80);
    const expected = requestedId ? expectedById.get(requestedId) : null;
    const explicitOther = requestedId === "other";
    const sourceStatus = sourceStatusIds.has(String(input.sourceStatus || "")) ? String(input.sourceStatus) : "unknown";
    const mapped = Boolean(expected);
    const displayName = expected?.displayName || (explicitOther ? "Other / unresolved controller" : "Controller mapping not selected");
    const mappingStatus = mapped ? "inventory-mapped" : explicitOther ? "explicit-unresolved" : "not-mapped";
    const identityConfidence = mapped && sourceStatus !== "unknown"
      ? "mapped-source-status-confirmed"
      : mapped
        ? "mapped-source-status-unconfirmed"
        : explicitOther
          ? "explicitly-unresolved"
          : "incomplete";

    return Object.freeze({
      intakeVersion: "v6",
      expectedControllerId: expected?.id || (explicitOther ? "other" : null),
      displayName,
      line: expected?.line || null,
      role: expected?.role || null,
      station: expected?.station || null,
      inventoryPriority: expected?.priority ?? null,
      mappingStatus,
      sourceStatus,
      sourceStatusLabel: SOURCE_STATUSES.find((item) => item.id === sourceStatus)?.label || "Source status not yet confirmed",
      controllerRevision: clean(input.controllerRevision, 120),
      firmwareRevision: clean(input.firmwareRevision, 120),
      exportDate: normalizeDate(input.exportDate),
      notes: clean(input.notes, 500),
      parsedController: clean(project?.controller, 160),
      sourceFile: clean(project?.source?.fileName, 220),
      identityConfidence,
      inferredFromFileName: false,
      runtimeProgramProven: false
    });
  }

  function identityUnresolvedFields(identity) {
    const fields = [];
    if (identity.mappingStatus === "not-mapped") fields.push("physical controller mapping (LB1/LB2 Labeler or APL Cart)");
    if (identity.mappingStatus === "explicit-unresolved") fields.push("physical controller mapping remains unresolved by operator selection");
    if (identity.sourceStatus === "unknown") fields.push("whether the export is the current production program, a backup, or an older revision");
    return fields;
  }

  function decorateCandidate(candidate, identity) {
    const unresolved = [...new Set([...(candidate?.draft?.unresolvedFields || []), ...identityUnresolvedFields(identity)])];
    return {
      ...candidate,
      controllerIdentity: identity,
      draft: {
        ...candidate.draft,
        controllerIdentity: identity,
        unresolvedFields: unresolved,
        sourceBoundary: `${candidate.draft?.sourceBoundary || "Static PLC-source evidence only."} Controller identity metadata is operator-supplied intake context; ServoForge does not infer the physical machine from the file name or parsed controller name.`
      }
    };
  }

  const baseBuildImportQueue = importer.buildImportQueue;
  const baseExportReviewQueue = importer.exportReviewQueue;

  function buildImportQueue(project, libraryEntries = [], options = {}) {
    const queue = baseBuildImportQueue(project, libraryEntries, options);
    const identity = normalizeControllerIdentity(options.controllerIdentity || {}, project);
    const candidates = (queue.candidates || []).map((candidate) => decorateCandidate(candidate, identity));
    return {
      ...queue,
      controllerIntakeVersion: "v6",
      controllerIdentity: identity,
      project: {
        ...(queue.project || {}),
        controllerIdentity: identity
      },
      statistics: {
        ...(queue.statistics || {}),
        controllerInventoryMapped: identity.mappingStatus === "inventory-mapped" ? 1 : 0,
        controllerSourceStatusConfirmed: identity.sourceStatus !== "unknown" ? 1 : 0
      },
      candidates
    };
  }

  function exportReviewQueue(queue, options = {}) {
    const base = baseExportReviewQueue(queue, options);
    return {
      ...base,
      schema: "servoforge-plc-import-review-v2",
      controllerIntakeVersion: "v6",
      controllerIdentity: queue?.controllerIdentity || queue?.project?.controllerIdentity || null,
      sourceProject: queue?.project || base.sourceProject || null
    };
  }

  function getExpectedControllers() {
    return EXPECTED_CONTROLLERS.map((item) => ({ ...item }));
  }

  function getSourceStatuses() {
    return SOURCE_STATUSES.map((item) => ({ ...item }));
  }

  return Object.freeze({
    ...importer,
    buildImportQueue,
    exportReviewQueue,
    normalizeControllerIdentity,
    getExpectedControllers,
    getSourceStatuses,
    controllerIntakeVersion: "v6"
  });
});
