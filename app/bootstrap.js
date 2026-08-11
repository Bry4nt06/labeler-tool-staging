"use strict";

(function loadServoForgeBootstrapModules() {
  const version = "0.9.10";
  const build = "servo-program-print-view-v58-20260811-0925";
  const buildUpdatedAt = "Aug 11, 2026 9:25 AM ET";
  // Regression lineage: servo-program-print-view-v58-20260811-0925 • apl-redundant-rest-handoff-v57-20260811-0823 • specs-info-handoff-continuity-v56-20260810-1035 • specs-actions-visible-v55-20260810-1022 • specs-compact-centered-v54-20260810-1001 • neck-body-coder-window-v53-20260810-0923 • mic-sensor-continuity-diagnostics-v52-20260810-0823 • coder-codebox-pad-rules-v51-20260809-2143 • coding-disabled-startup-animation-v50-20260809-2138 • coding-disabled-aggregate6-terminal-v49-20260809-2103 • coder-prehold-allowed-corrections-v48-20260809-1836 • progressive-label-loader-order-v47-20260809-1802 • progressive-label-application-v46-20260809-1735 • mobile-specs-horizontal-scroll-v45-20260809-0214 • canonical-section-handoff-v44-20260809-0203 • common-apl-active-sections-v42-20260809-0133 • first-tack-datum-flow-v41-20260808-2330 (Aug 8, 2026 11:30 PM ET) • label-datum-servo-flow-v40-20260808-2300 • finished-centerline-completion-v39-20260808-2148 • inside-wipe-rendered-geometry-v38-20260807-2000 • compact-layout-defaults-pad-orientation-v36-20260807-1545 • bottle-pocket-sync-20260807-1223 • bottle-type-selection-20260806-v3 • label-application-reference-v32-20260807-1251
  window.SERVOFORGE_RELEASE_VERSION = version;
  window.SERVOFORGE_BUILD_UPDATED_AT = buildUpdatedAt;
  const banner = document.querySelector(".staging-environment-banner");
  if (banner) banner.textContent = `STAGING ${version} • BUILD ${build} • UPDATED ${buildUpdatedAt} — NOT PRODUCTION`;
  const modules = Object.freeze([
    "app/startup-dom-binding-guard-integration.js",
    "app/export-service.js",
    "app/controllers/workspace-action-service.js",
    "app/controllers/theme-presets-controller.js",
    "app/servoforge-brand-theme-integration.js",
    "app/compact-layout-defaults-wipe-orientation-integration.js",
    "app/inside-wipe-mounting-correction-integration.js",
    "app/controllers/health-status-ui-controller.js",
    "app/controllers/validation-panel-ui-controller.js",
    "app/controllers/settings-controller.js",
    "app/controllers/settings-reset-controller.js",
    "app/controllers/local-persistence-controller.js",
    "app/controllers/map-controller.js",
    "app/controllers/specs-controller.js",
    "app/controllers/specification-event-controller.js",
    "app/controllers/label-section-event-controller.js",
    "app/controllers/specification-table-ui-controller.js",
    "app/controllers/specification-sensor-guidance-controller.js",
    "app/controllers/specification-required-fields-controller.js",
    "app/controllers/sensor-activation-controller.js",
    "app/sensor-map-visibility-color-integration.js",
    "app/controllers/build-inputs-controller.js",
    "app/controllers/tabs-controller.js",
    "app/controllers/transfer-controller.js",
    "app/controllers/simulation-controller.js",
    "app/controllers/servo-program-controller.js",
    "app/controllers/servo-program-event-controller.js",
    "app/servo-program-print-integration.js",
    "app/controllers/simulation-editor-controller.js",
    "app/controllers/station-table-controller.js",
    "app/controllers/station-table-event-controller.js",
    "app/controllers/application-controller.js",
    "app/controllers/setup-state-controller.js",
    "app/controllers/workspace-panel-controller.js",
    "app/controllers/map-builder-action-controller.js",
    "app/controllers/map-builder-event-controller.js",
    "app/controllers/map-builder-layout-controller.js",
    "app/controllers/map-builder-row-controller.js",
    "app/controllers/map-builder-popup-controller.js",
    "app/controllers/setup-event-controller-integration.js",
    "app/application-reference-build-input-integration.js",
    "app/apl-final-aggregate-terminal-integration.js",
    "app/apl-section-handoff-continuity-integration.js",
    "app/topmodul-allowed-correction-diagnostics-integration.js",
    "app/global-actions.js",
    "app/animation-runtime.js",
    "app/startup-runtime.js"
  ]);

  function loadScript(path) {
    return new Promise((resolve, reject) => {
      const expected = new URL(`./${path}`, window.location.href).pathname;
      const existing = [...document.scripts].find((script) => {
        try { return new URL(script.src, window.location.href).pathname === expected; }
        catch { return false; }
      });
      if (existing) {
        if (existing.dataset.loaded === "true") resolve();
        else {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
        }
        return;
      }
      const script = document.createElement("script");
      script.src = `./${path}?v=${encodeURIComponent(version)}&build=${encodeURIComponent(build)}`;
      script.async = false;
      script.dataset.bootstrapModule = path;
      script.dataset.bootstrapBuild = build;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Unable to load ${path}.`)), { once: true });
      document.body.appendChild(script);
    });
  }

  window.ServoForgeBootstrapModules = modules;
  window.ServoForgeBootstrapBuild = build;
  window.ServoForgeBootstrapReady = modules.reduce(
    (promise, path) => promise.then(() => loadScript(path)),
    Promise.resolve()
  );
})();