"use strict";

function runtimeReleaseVersion() {
  return window.SERVOFORGE_RELEASE_VERSION
    || document.querySelector('meta[name="application-version"]')?.content
    || "0.9.2";
}

function showStartupError(error) {
  console.error("Labeler tool startup failed", error);
  const mapPanel = document.querySelector(".map-panel");
  const validationList = document.querySelector("#validationList");
  const message = error && error.message ? error.message : String(error || "Unknown startup error");
  if (mapPanel) {
    const notice = document.createElement("div");
    notice.className = "startup-error";
    notice.innerHTML = `<strong>Tool startup error</strong><span>${message}</span>`;
    mapPanel.appendChild(notice);
  }
  if (validationList) validationList.innerHTML = `<div class="notice bad">Startup failed: ${message}</div>`;
}

function loadSimulatorRuntime() {
  const version = runtimeReleaseVersion();
  if (document.querySelector("script[data-servoforge-simulator]")) return;
  const script = document.createElement("script");
  script.src = `app/simulator-milestone.js?v=${encodeURIComponent(version)}`;
  script.dataset.servoforgeSimulator = version;
  document.head.appendChild(script);
}

async function initializeLabelerApp() {
  try {
    if (!window.LabelerSetupEventControllers?.installed) {
      throw new Error("Setup event controller boundary is not loaded.");
    }
    if (!window.LabelerSetupStateController?.initialize) {
      throw new Error("Setup state controller is not loaded.");
    }
    if (!window.LabelerMapController?.populateBuilder) {
      throw new Error("Map Builder lifecycle controller is not loaded.");
    }
    loadSavedSettings();
    if (!window.LabelerCompanyDefaultsService?.reconcile) {
      throw new Error("Company catalog service is not loaded.");
    }
    window.ServoForgeCompanyDefaultsReady = window.LabelerCompanyDefaultsService.reconcile();
    await window.ServoForgeCompanyDefaultsReady;
    ensurePersistentApplicationMaps();
    if (typeof initializeStella660ColdGlueExample === "function" && initializeStella660ColdGlueExample()) {
      saveCurrentSettings();
    }
    window.LabelerSetupStateController.initialize();
    window.LabelerMapController.populateBuilder({ bind: true });
    bindGlobalActions();
    render();
    startAnimationLoop();
    await registerToolUpdateService();
    loadSimulatorRuntime();
  } catch (error) {
    showStartupError(error);
  }
}

window.LabelerStartupRuntime = Object.freeze({
  initialize: initializeLabelerApp,
  showError: showStartupError,
  loadSimulator: loadSimulatorRuntime,
  releaseVersion: runtimeReleaseVersion
});
