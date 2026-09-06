"use strict";

(function installPlcImportTroubleshooterHandoff(global) {
  const universal = global.ServoForgeUniversalTroubleshooting;
  const importer = global.ServoForgeL5KImport;
  if (!universal || !importer || typeof importer.buildImportQueue !== "function") {
    throw new Error("Universal troubleshooting core and PLC Import Assistant are required before handoff v7.");
  }

  const baseBuildImportQueue = importer.buildImportQueue;
  const capture = {
    project: null,
    queue: null,
    handoff: null
  };

  function id(name) { return document.getElementById(name); }

  function identity() {
    return global.ServoForgePLCImportControllerIntake?.readIdentity?.() || {};
  }

  function syncUi() {
    const button = id("plcImportUseTroubleshooterButton");
    const status = id("plcImportHandoffStatus");
    if (!button || !status) return;
    button.disabled = !(capture.project && capture.queue);
    if (!capture.project || !capture.queue) {
      status.textContent = "Analyze an L5K first. No controller-specific evidence has been attached to Troubleshooting.";
      status.dataset.status = "";
      return;
    }
    const preview = universal.buildAnalyzerHandoff(capture.project, capture.queue, identity());
    const familyCount = preview.families?.length || 0;
    const bindingCount = preview.statistics?.storedBindings || 0;
    status.textContent = `${bindingCount} controller-specific fault targets classified across ${familyCount} universal troubleshooting families. Ready for temporary local handoff.`;
    status.dataset.status = "ready";
  }

  const browserImporter = Object.freeze({
    ...importer,
    buildImportQueue(project, libraryEntries = [], options = {}) {
      const queue = baseBuildImportQueue(project, libraryEntries, options);
      capture.project = project;
      capture.queue = queue;
      capture.handoff = null;
      global.setTimeout(syncUi, 0);
      return queue;
    }
  });
  global.ServoForgeL5KImport = browserImporter;

  function buildHandoff() {
    if (!capture.project || !capture.queue) return null;
    capture.handoff = universal.buildAnalyzerHandoff(capture.project, capture.queue, identity());
    return capture.handoff;
  }

  function saveHandoff() {
    const handoff = buildHandoff();
    const status = id("plcImportHandoffStatus");
    if (!handoff) {
      if (status) {
        status.textContent = "Analyze an L5K before opening Troubleshooting with controller context.";
        status.dataset.status = "caution";
      }
      return;
    }
    try {
      global.localStorage?.setItem(universal.STORAGE_KEY, JSON.stringify(handoff));
    } catch (error) {
      if (status) {
        status.textContent = `Unable to save local handoff: ${error?.message || error}`;
        status.dataset.status = "error";
      }
      return;
    }
    const next = new URL("../troubleshooting/index.html", global.location.href);
    next.searchParams.set("analyzerContext", "1");
    global.location.href = next.href;
  }

  function clearCapture() {
    capture.project = null;
    capture.queue = null;
    capture.handoff = null;
    syncUi();
  }

  function bind() {
    id("plcImportUseTroubleshooterButton")?.addEventListener("click", saveHandoff);
    id("plcImportFileInput")?.addEventListener("change", clearCapture);
    id("plcImportClearButton")?.addEventListener("click", clearCapture);
    id("plcImportDropZone")?.addEventListener("drop", () => global.setTimeout(clearCapture, 0));
    syncUi();
  }

  global.ServoForgePLCImportTroubleshooterHandoff = Object.freeze({
    version: "v7",
    buildHandoff,
    clearCapture,
    getCapture() {
      return Object.freeze({
        project: capture.project,
        queue: capture.queue,
        handoff: capture.handoff
      });
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})(window);
