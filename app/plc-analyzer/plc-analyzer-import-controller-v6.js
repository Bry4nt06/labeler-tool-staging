"use strict";

(function installControllerIntakeUi(global) {
  const importer = global.ServoForgeL5KImport;
  if (!importer || importer.controllerIntakeVersion !== "v6") throw new Error("ServoForge PLC controller intake v6 engine did not load.");

  const baseBuildImportQueue = importer.buildImportQueue;
  const id = (name) => document.getElementById(name);

  function readIdentity() {
    return {
      expectedControllerId: id("plcImportControllerSlot")?.value || null,
      sourceStatus: id("plcImportSourceStatus")?.value || null,
      controllerRevision: id("plcImportControllerRevision")?.value || null,
      firmwareRevision: id("plcImportFirmwareRevision")?.value || null,
      exportDate: id("plcImportExportDate")?.value || null,
      notes: id("plcImportIdentityNotes")?.value || null
    };
  }

  const browserImporter = Object.freeze({
    ...importer,
    buildImportQueue(project, libraryEntries = [], options = {}) {
      return baseBuildImportQueue(project, libraryEntries, {
        ...options,
        controllerIdentity: options.controllerIdentity || readIdentity()
      });
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
        '<option value="">Select the physical controller for this export</option>',
        ...browserImporter.getExpectedControllers().map((item) => `<option value="${item.id}">${item.displayName}</option>`),
        '<option value="other">Other / unresolved controller</option>'
      ].join("");
    }
    if (status) {
      status.innerHTML = [
        '<option value="">Select source status</option>',
        ...browserImporter.getSourceStatuses().map((item) => `<option value="${item.id}">${item.label}</option>`)
      ].join("");
    }
  }

  function resetIdentity() {
    const fields = [
      "plcImportControllerSlot",
      "plcImportSourceStatus",
      "plcImportControllerRevision",
      "plcImportFirmwareRevision",
      "plcImportExportDate",
      "plcImportIdentityNotes"
    ];
    for (const name of fields) {
      const element = id(name);
      if (element) element.value = "";
    }
  }

  function syncGate() {
    const fileInput = id("plcImportFileInput");
    const analyzeButton = id("plcImportAnalyzeButton");
    const status = id("plcImportIdentityStatus");
    if (!analyzeButton || !status) return;
    const hasFile = Boolean(fileInput?.files?.length);
    const mappingSelected = Boolean(controllerSelect()?.value);
    const sourceStatusSelected = Boolean(sourceStatusSelect()?.value);
    const ready = hasFile && mappingSelected && sourceStatusSelected;
    analyzeButton.disabled = !ready;

    if (!hasFile) {
      status.textContent = "Select an L5K export, then map it to the physical controller.";
      status.dataset.status = "";
    } else if (!mappingSelected) {
      status.textContent = "Controller mapping is required before the review queue is built.";
      status.dataset.status = "caution";
    } else if (!sourceStatusSelected) {
      status.textContent = "Confirm whether this is current production, a backup, an older revision, or unknown.";
      status.dataset.status = "caution";
    } else {
      const expected = browserImporter.getExpectedControllers().find((item) => item.id === controllerSelect().value);
      const mapping = expected?.displayName || "Other / unresolved controller";
      const source = browserImporter.getSourceStatuses().find((item) => item.id === sourceStatusSelect().value)?.label || sourceStatusSelect().value;
      status.textContent = `${mapping} • ${source} • ready for local review analysis.`;
      status.dataset.status = "ready";
    }
  }

  function bind() {
    populateOptions();
    const identityInputs = [
      "plcImportControllerSlot",
      "plcImportSourceStatus",
      "plcImportControllerRevision",
      "plcImportFirmwareRevision",
      "plcImportExportDate",
      "plcImportIdentityNotes"
    ].map(id).filter(Boolean);
    identityInputs.forEach((element) => element.addEventListener("input", syncGate));
    identityInputs.forEach((element) => element.addEventListener("change", syncGate));

    const fileInput = id("plcImportFileInput");
    const dropZone = id("plcImportDropZone");
    const clearButton = id("plcImportClearButton");
    fileInput?.addEventListener("change", () => { resetIdentity(); syncGate(); });
    dropZone?.addEventListener("drop", () => { resetIdentity(); global.setTimeout(syncGate, 0); });
    clearButton?.addEventListener("click", () => { resetIdentity(); global.setTimeout(syncGate, 0); });
    syncGate();
  }

  global.ServoForgePLCImportControllerIntake = Object.freeze({
    version: "v6",
    readIdentity,
    syncGate,
    resetIdentity
  });

  const scheduleBind = () => global.setTimeout(bind, 0);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleBind, { once: true });
  else scheduleBind();
})(window);
