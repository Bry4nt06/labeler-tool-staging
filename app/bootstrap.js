"use strict";

(function loadServoForgeBootstrapModules() {
  const version = "0.9.10";
  const build = "wipe-inner-bottle-spin-v117-20260814-2235";
  const buildUpdatedAt = "Aug 14, 2026 10:35 PM ET";
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
    "app/compact-build-parameters-integration.js",
    "app/compact-layout-defaults-wipe-orientation-integration.js",
    "app/map-workspace-compact-support-integration.js",
    "app/inside-wipe-mounting-correction-integration.js",
    "app/controllers/health-status-ui-controller.js",
    "app/controllers/validation-panel-ui-controller.js",
    "app/controllers/settings-controller.js",
    "app/feedback-center-integration.js",
    "app/community-library-integration.js",
    "app/community-library-v104-metadata-integration.js",
    "app/community-library-v103-integration.js",
    "app/top-action-icons-integration.js",
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
    "app/controllers/transfer-controller.js",
    "app/controllers/simulation-controller.js",
    "app/controllers/servo-program-controller.js",
    "app/controllers/servo-program-event-controller.js",
    "app/servo-program-print-integration.js",
    "app/spec-number-retirement-integration.js",
    "app/servo-program-eight-row-grouping-integration.js",
    "app/bottle-orientation-panel-integration.js",
    "app/bottle-orientation-panel-recovery-integration.js",
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
      const expected = new URL(`./${path}?v=${encodeURIComponent(version)}&build=${encodeURIComponent(build)}`, window.location.href).href;
      const existing = [...document.scripts].find((script) => script.src === expected);
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
