"use strict";

(function installTroubleshootingCarryover(global) {
  const overlayApi = global.ServoForgeTroubleshootingOverlay;
  const importer = global.ServoForgeL5KImport;
  if (!overlayApi || !importer?.buildImportQueue) throw new Error("ServoForge PLC overlay and Import Assistant engines are required.");

  let lastQueue = null;
  const baseBuildImportQueue = importer.buildImportQueue;
  const wrappedImporter = Object.freeze({
    ...importer,
    buildImportQueue(project, libraryEntries = [], options = {}) {
      lastQueue = baseBuildImportQueue(project, libraryEntries, options);
      global.setTimeout(() => global.dispatchEvent(new CustomEvent("servoforge:plc-import-queue-ready", { detail: { queue: lastQueue } })), 0);
      return lastQueue;
    }
  });
  global.ServoForgeL5KImport = wrappedImporter;

  const id = (name) => document.getElementById(name);

  function ensurePortableFields() {
    const grid = document.querySelector(".plc-import-controller-grid");
    if (!grid || id("plcImportSiteLabel")) return;
    const html = `
      <label class="plc-import-field">
        <span>Site / line label</span>
        <input id="plcImportSiteLabel" type="text" maxlength="160" autocomplete="off" placeholder="Optional: site, line, area" />
      </label>
      <label class="plc-import-field">
        <span>Machine / asset label</span>
        <input id="plcImportAssetLabel" type="text" maxlength="180" autocomplete="off" placeholder="Optional: local machine name" />
      </label>
      <label class="plc-import-field">
        <span>Controller purpose</span>
        <input id="plcImportControllerRole" type="text" maxlength="120" autocomplete="off" placeholder="Optional: labeler, cart, conveyor, inspection…" />
      </label>`;
    grid.insertAdjacentHTML("beforeend", html);
  }

  function makeReferenceMappingPortable() {
    const select = id("plcImportControllerSlot");
    const label = select?.closest("label")?.querySelector("span");
    if (label) label.textContent = "Known reference mapping (optional)";
    if (!select) return;
    const other = [...select.options].find((option) => option.value === "other");
    if (other) other.textContent = "Site-specific / not in ServoForge reference inventory";
    if (!select.value) select.value = "other";
    global.ServoForgePLCImportControllerIntake?.syncGate?.();
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
    clearButton.hidden = !overlayApi.loadOverlay();
    actions.appendChild(clearButton);

    const boundary = document.createElement("p");
    boundary.className = "plc-source-boundary";
    boundary.innerHTML = "<strong>Portable troubleshooting boundary:</strong> Carrying a controller to Troubleshooter creates a session-only site overlay. Local tag names, addresses, rung locations, AFIs, timing values, I/O references, and dependencies do not become permanent ServoForge troubleshooting rules.";
    actions.insertAdjacentElement("afterend", boundary);

    useButton.addEventListener("click", () => {
      if (!lastQueue) return;
      const overlay = overlayApi.buildOverlay(lastQueue, {
        siteLabel: id("plcImportSiteLabel")?.value,
        assetLabel: id("plcImportAssetLabel")?.value,
        controllerRole: id("plcImportControllerRole")?.value
      });
      overlayApi.saveOverlay(overlay);
      global.location.href = "../troubleshooting/index.html?plcOverlay=1";
    });

    clearButton.addEventListener("click", () => {
      overlayApi.clearOverlay();
      clearButton.hidden = true;
    });
  }

  function syncCarryButton() {
    const button = id("plcImportUseInTroubleshooter");
    if (button) button.disabled = !lastQueue;
  }

  function afterIdentityReset() {
    global.setTimeout(() => {
      makeReferenceMappingPortable();
      global.ServoForgePLCImportControllerIntake?.syncGate?.();
    }, 0);
  }

  function bind() {
    ensurePortableFields();
    makeReferenceMappingPortable();
    addCarryoverControls();
    id("plcImportFileInput")?.addEventListener("change", afterIdentityReset);
    id("plcImportDropZone")?.addEventListener("drop", afterIdentityReset);
    id("plcImportClearButton")?.addEventListener("click", afterIdentityReset);
    global.addEventListener("servoforge:plc-import-queue-ready", syncCarryButton);
  }

  global.ServoForgePLCImportTroubleshootingCarryover = Object.freeze({
    version: "v7",
    getLastQueue: () => lastQueue,
    getOverlay: () => overlayApi.loadOverlay(),
    clearOverlay: () => overlayApi.clearOverlay()
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => global.setTimeout(bind, 0), { once: true });
  else global.setTimeout(bind, 0);
})(window);
