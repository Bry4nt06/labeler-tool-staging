"use strict";

(function installPlcSourceIntakeV15(global) {
  if (!global?.document) return;

  const ACCEPT = ".l5k,.L5K,.l5x,.L5X,text/plain,application/xml,text/xml";
  const nativeWorker = global.Worker;

  if (typeof nativeWorker === "function" && !global.__servoforgePlcWorkerV15) {
    const WrappedWorker = function ServoForgeSourceWorker(url, options) {
      const raw = String(url || "");
      const next = /(?:^|\/)l5k-analyzer-worker\.js(?:\?|$)/i.test(raw)
        ? raw.replace(/l5k-analyzer-worker\.js(?:\?[^#]*)?/i, "l5k-analyzer-worker.js?v=15")
        : raw;
      return new nativeWorker(next, options);
    };
    WrappedWorker.prototype = nativeWorker.prototype;
    Object.setPrototypeOf(WrappedWorker, nativeWorker);
    global.Worker = WrappedWorker;
    global.__servoforgePlcWorkerV15 = true;
  }

  function configure(config) {
    const input = document.getElementById(config.inputId);
    const dropZone = document.getElementById(config.dropZoneId);
    const status = document.getElementById(config.statusId);
    const analyze = document.getElementById(config.analyzeId);
    if (!input || !dropZone || !status || !analyze) return;

    input.accept = ACCEPT;
    dropZone.setAttribute("aria-label", "Drop L5K or L5X source file or choose a file");
    const strong = dropZone.querySelector("strong");
    if (strong) strong.textContent = "Drop .L5K or .L5X here";

    function updateFor(file) {
      if (!file) return;
      const name = String(file.name || "");
      if (/\.acd$/i.test(name)) {
        status.textContent = "ACD is a binary project file. Export a readable full-project L5K or L5X source file first.";
        status.dataset.status = "error";
        analyze.disabled = true;
        return;
      }
      if (/\.l5x$/i.test(name)) {
        status.textContent = "Ready to analyze L5X locally.";
        status.dataset.status = "ready";
        analyze.disabled = false;
        return;
      }
      if (/\.l5k$/i.test(name)) {
        status.textContent = "Ready to analyze L5K locally.";
        status.dataset.status = "ready";
      }
    }

    input.addEventListener("change", () => global.setTimeout(() => updateFor(input.files?.[0] || null), 0));
    dropZone.addEventListener("drop", (event) => global.setTimeout(() => updateFor(event.dataTransfer?.files?.[0] || null), 0));
  }

  configure({ inputId: "plcFileInput", dropZoneId: "plcDropZone", statusId: "plcFileStatus", analyzeId: "plcAnalyzeButton" });
  configure({ inputId: "plcImportFileInput", dropZoneId: "plcImportDropZone", statusId: "plcImportFileStatus", analyzeId: "plcImportAnalyzeButton" });
})(typeof globalThis !== "undefined" ? globalThis : this);
