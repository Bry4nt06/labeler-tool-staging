"use strict";

(function installControllerIntakeUi(global) {
  const importer = global.ServoForgeL5KImport;
  if (!importer || importer.controllerIntakeVersion !== "v6") throw new Error("ServoForge PLC controller intake v6 engine did not load.");

  const STORAGE_KEY = "servoforge.troubleshooting.plcOverlay.v1";
  let lastQueue = null;
  const baseBuildImportQueue = importer.buildImportQueue;
  const id = (name) => document.getElementById(name);

  function clean(value, maxLength = 240) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, maxLength) : null;
  }

  function unique(values, limit = 100) {
    return [...new Set((values || []).map((value) => clean(value, 240)).filter(Boolean))].slice(0, limit);
  }

  function readIdentity() {
    return {
      expectedControllerId: id("plcImportControllerSlot")?.value || null,
      sourceStatus: id("plcImportSourceStatus")?.value || null,
      controllerRevision: id("plcImportControllerRevision")?.value || null,
      firmwareRevision: id("plcImportFirmwareRevision")?.value || null,
      exportDate: id("plcImportExportDate")?.value || null,
      notes: id("plcImportIdentityNotes")?.value || null,
      siteLabel: id("plcImportSiteLabel")?.value || null,
      assetLabel: id("plcImportAssetLabel")?.value || null,
      controllerRole: id("plcImportControllerRole")?.value || null
    };
  }

  const browserImporter = Object.freeze({
    ...importer,
    buildImportQueue(project, libraryEntries = [], options = {}) {
      lastQueue = baseBuildImportQueue(project, libraryEntries, {
        ...options,
        controllerIdentity: options.controllerIdentity || readIdentity()
      });
      global.setTimeout(() => global.dispatchEvent(new CustomEvent("servoforge:plc-import-queue-ready", { detail: { queue: lastQueue } })), 0);
      return lastQueue;
    }
  });
  global.ServoForgeL5KImport = browserImporter;

  const controllerSelect = () => id("plcImportControllerSlot");
  const sourceStatusSelect = () => id("plcImportSourceStatus");

  function populateOptions() {
    const controller = controllerSelect();
    const status = sourceStatusSelect();
    if (controller) {
      controller.innerHTML = [
        '<option value="other">Site-specific / not in ServoForge reference inventory</option>',
        ...browserImporter.getExpectedControllers().map((item) => `<option value="${item.id}">${item.displayName} — current reference set</option>`)
      ].join("");
      controller.value = "other";
    }
    if (status) {
      status.innerHTML = [
        '<option value="">Select source status</option>',
        ...browserImporter.getSourceStatuses().map((item) => `<option value="${item.id}">${item.label}</option>`)
      ].join("");
    }
  }

  function ensurePortableFields() {
    const grid = document.querySelector(".plc-import-controller-grid");
    if (!grid || id("plcImportSiteLabel")) return;
    grid.insertAdjacentHTML("beforeend", `
      <label class="plc-import-field"><span>Site / line label</span><input id="plcImportSiteLabel" type="text" maxlength="160" autocomplete="off" placeholder="Optional: site, line, area" /></label>
      <label class="plc-import-field"><span>Machine / asset label</span><input id="plcImportAssetLabel" type="text" maxlength="180" autocomplete="off" placeholder="Optional: local machine name" /></label>
      <label class="plc-import-field"><span>Controller purpose</span><input id="plcImportControllerRole" type="text" maxlength="120" autocomplete="off" placeholder="Optional: labeler, cart, conveyor, inspection…" /></label>`);
    const controllerLabel = controllerSelect()?.closest("label")?.querySelector("span");
    if (controllerLabel) controllerLabel.textContent = "Known reference mapping (optional)";
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
      upstreamSymbols: Object.freeze(unique(dependency.upstreamSymbols, 80))
    });
  }

  function buildTroubleshootingOverlay() {
    if (!lastQueue) throw new Error("Analyze a PLC export before carrying it to Troubleshooter.");
    const identity = lastQueue.controllerIdentity || lastQueue.project?.controllerIdentity || {};
    const project = lastQueue.project || {};
    const intake = readIdentity();
    return Object.freeze({
      schema: "servoforge-troubleshooting-plc-overlay-v1",
      overlayVersion: "v1",
      createdAt: new Date().toISOString(),
      authority: "session-site-evidence-only",
      universalLibraryModified: false,
      sourceBoundary: "Machine-specific PLC names, tags, addresses, rung locations, timing values, I/O references, AFIs, and dependency paths are temporary source evidence for this uploaded controller only. They are not universal ServoForge troubleshooting rules and must not be transferred to another machine without local source verification.",
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
      candidates: Object.freeze((lastQueue.candidates || []).filter((candidate) => candidate?.target).slice(0, 750).map(compactCandidate))
    });
  }

  function saveTroubleshootingOverlay() {
    const overlay = buildTroubleshootingOverlay();
    global.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
    return overlay;
  }

  function clearTroubleshootingOverlay() {
    try { global.sessionStorage.removeItem(STORAGE_KEY); } catch {}
  }

  function addCarryoverControls() {
    const actions = document.querySelector(".plc-import-actions");
    if (!actions || id("plcImportUseInTroubleshooter")) return;
    const useButton = document.createElement("button");
    useButton.id = "plcImportUseInTroubleshooter";
    useButton.type = "button";
    useButton.disabled = !lastQueue;
    useButton.textContent = "Use this controller in Troubleshooter";
    actions.appendChild(useButton);

    const clearButton = document.createElement("button");
    clearButton.id = "plcImportClearTroubleshootingOverlay";
    clearButton.type = "button";
    clearButton.className = "secondary-button";
    clearButton.textContent = "Clear carried controller";
    clearButton.hidden = !global.sessionStorage.getItem(STORAGE_KEY);
    actions.appendChild(clearButton);

    const boundary = document.createElement("p");
    boundary.className = "plc-source-boundary";
    boundary.innerHTML = "<strong>Portable troubleshooting boundary:</strong> Carrying a controller to Troubleshooter creates a session-only site overlay. Local tag names, addresses, rung locations, AFIs, timing values, I/O references, and dependencies do not become permanent ServoForge troubleshooting rules.";
    actions.insertAdjacentElement("afterend", boundary);

    useButton.addEventListener("click", () => {
      saveTroubleshootingOverlay();
      global.location.href = "../troubleshooting/index.html?plcOverlay=1";
    });
    clearButton.addEventListener("click", () => {
      clearTroubleshootingOverlay();
      clearButton.hidden = true;
    });
    global.addEventListener("servoforge:plc-import-queue-ready", () => { useButton.disabled = !lastQueue; });
  }

  function resetIdentity() {
    const fields = ["plcImportSourceStatus", "plcImportControllerRevision", "plcImportFirmwareRevision", "plcImportExportDate", "plcImportIdentityNotes", "plcImportSiteLabel", "plcImportAssetLabel", "plcImportControllerRole"];
    for (const name of fields) {
      const element = id(name);
      if (element) element.value = "";
    }
    if (controllerSelect()) controllerSelect().value = "other";
  }

  function syncGate() {
    const fileInput = id("plcImportFileInput");
    const analyzeButton = id("plcImportAnalyzeButton");
    const status = id("plcImportIdentityStatus");
    if (!analyzeButton || !status) return;
    const hasFile = Boolean(fileInput?.files?.length);
    const sourceStatusSelected = Boolean(sourceStatusSelect()?.value);
    const ready = hasFile && sourceStatusSelected;
    analyzeButton.disabled = !ready;

    if (!hasFile) {
      status.textContent = "Select an L5K export. Reference mapping is optional; source status is required.";
      status.dataset.status = "";
    } else if (!sourceStatusSelected) {
      status.textContent = "Confirm whether this is current production, a backup, an older revision, or unknown.";
      status.dataset.status = "caution";
    } else {
      const expected = browserImporter.getExpectedControllers().find((item) => item.id === controllerSelect()?.value);
      const mapping = expected?.displayName || "site-specific controller";
      const source = browserImporter.getSourceStatuses().find((item) => item.id === sourceStatusSelect().value)?.label || sourceStatusSelect().value;
      status.textContent = `${mapping} • ${source} • ready for local review analysis.`;
      status.dataset.status = "ready";
    }
  }

  function bind() {
    populateOptions();
    ensurePortableFields();
    addCarryoverControls();
    const identityInputs = ["plcImportControllerSlot", "plcImportSourceStatus", "plcImportControllerRevision", "plcImportFirmwareRevision", "plcImportExportDate", "plcImportIdentityNotes", "plcImportSiteLabel", "plcImportAssetLabel", "plcImportControllerRole"].map(id).filter(Boolean);
    identityInputs.forEach((element) => element.addEventListener("input", syncGate));
    identityInputs.forEach((element) => element.addEventListener("change", syncGate));
    const fileInput = id("plcImportFileInput");
    const dropZone = id("plcImportDropZone");
    const clearButton = id("plcImportClearButton");
    fileInput?.addEventListener("change", () => { resetIdentity(); syncGate(); });
    dropZone?.addEventListener("drop", () => { resetIdentity(); global.setTimeout(syncGate, 0); });
    clearButton?.addEventListener("click", () => { resetIdentity(); lastQueue = null; global.setTimeout(syncGate, 0); });
    syncGate();
  }

  global.ServoForgePLCImportControllerIntake = Object.freeze({
    version: "v7-portable-overlay",
    readIdentity,
    syncGate,
    resetIdentity,
    getLastQueue: () => lastQueue,
    buildTroubleshootingOverlay,
    saveTroubleshootingOverlay,
    clearTroubleshootingOverlay
  });

  const scheduleBind = () => global.setTimeout(bind, 0);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleBind, { once: true });
  else scheduleBind();
})(window);
