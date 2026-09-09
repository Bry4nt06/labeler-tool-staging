"use strict";

(function loadMobileWorkspaceStyles() {
  const stylesheetId = "servoforge-mobile-workspace-styles";
  if (document.getElementById(stylesheetId)) return;
  const link = document.createElement("link");
  link.id = stylesheetId;
  link.rel = "stylesheet";
  link.href = "./mobile.css?v=mobile-20260807-1";
  document.head.appendChild(link);
})();
(function optimizeMobileNumberInputs() {
  const applyInputModes = () => {
    document.querySelectorAll('input[type="number"]').forEach((input) => {
      if (!input.hasAttribute("inputmode")) input.setAttribute("inputmode", "decimal");
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyInputModes, { once: true });
  } else {
    applyInputModes();
  }
})();

(function installToolNavigation() {
  const install = () => {
    const settings = document.querySelector(".top-settings-menu");
    if (!settings?.parentElement) return;

    if (!document.getElementById("troubleshootingLibraryButton")) {
      const troubleshootingButton = document.createElement("button");
      troubleshootingButton.id = "troubleshootingLibraryButton";
      troubleshootingButton.type = "button";
      troubleshootingButton.textContent = "Troubleshooting";
      troubleshootingButton.title = "Open the ServoForge Troubleshooting Library";
      troubleshootingButton.addEventListener("click", () => { window.location.href = "./app/troubleshooting/index.html"; });
      settings.parentElement.insertBefore(troubleshootingButton, settings);
    }

    if (!document.getElementById("plcAnalyzerButton")) {
      const analyzerButton = document.createElement("button");
      analyzerButton.id = "plcAnalyzerButton";
      analyzerButton.type = "button";
      analyzerButton.textContent = "PLC Analyzer";
      analyzerButton.title = "Open the ServoForge PLC / L5K Analyzer";
      analyzerButton.addEventListener("click", () => { window.location.href = "./app/plc-analyzer/index.html"; });
      settings.parentElement.insertBefore(analyzerButton, settings);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();

(function seedDefaultWorkspacePanelVisibility() {
  const preferencesKey = "servoforge-developer-preferences-v1";
  const migrationKey = "servoforge-default-hidden-panels-v2-applied";
  const defaultHiddenPanels = ["simulation", "diagnostics"];

  try {
    if (localStorage.getItem(migrationKey) === "true") return;
    const parsed = JSON.parse(localStorage.getItem(preferencesKey) || "{}");
    const preferences = parsed && typeof parsed === "object" ? parsed : {};
    const hiddenPanels = new Set(Array.isArray(preferences.hiddenPanels) ? preferences.hiddenPanels.map(String) : []);
    defaultHiddenPanels.forEach((panel) => hiddenPanels.add(panel));
    localStorage.setItem(preferencesKey, JSON.stringify({
      ...preferences,
      hiddenPanels: [...hiddenPanels]
    }));
    localStorage.setItem(migrationKey, "true");
  } catch {
    // Storage may be unavailable in a restricted browser context. The normal
    // workspace controls remain usable without persisted visibility defaults.
  }
})();

(async function startServoForge() {
  const progress = window.ServoForgeStartupProgress;
  const build = window.ServoForgeBootstrapBuild || "cold-glue-back-label-channel-entry-v325-20260909-1936";

  function loadScript(path, version) {
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
      script.dataset.orientationConstraintModule = path;
      script.dataset.orientationConstraintBuild = build;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Unable to load ${path}.`)), { once: true });
      document.body.appendChild(script);
    });
  }

  async function loadOrientationConstraintPlanner() {
    const version = document.querySelector('meta[name="application-version"]')?.content || "0.9.10";
    await loadScript("app/global-machine-parameter-defaults-integration.js", version);
    await loadScript("drivers/profile/orientation-constraint-planner-driver.js", version);
    await loadScript("drivers/profile/sensor-target-policy-driver.js", version);
    await loadScript("drivers/profile/sensor-station-label-driver.js", version);
    await loadScript("drivers/profile/sensor-post-inspection-release-driver.js", version);
    await loadScript("app/label-centerline-policy-integration.js", version);
    await loadScript("app/orientation-constraint-target-service.js", version);
    await loadScript("app/first-application-zero-datum-integration.js", version);
    await loadScript("app/apl-finished-centerline-completion-integration.js", version);
    await loadScript("app/apl-first-tack-datum-flow-integration.js", version);
    await loadScript("app/topmodul-correction-chain-limit-integration.js", version);
    await loadScript("app/orientation-constraint-program-planner.js", version);
    await loadScript("app/sensor-editor-focus-guard-integration.js", version);

    try {
      await loadScript("app/orientation-constraint-planner-integration.js", version);
      await loadScript("app/sensor-post-inspection-release-integration.js", version);
      await loadScript("app/apl-post-wipe-sensor-hold-integration.js", version);
      await loadScript("app/sensor-orientation-default-map-fix-integration.js", version);
      await loadScript("app/standard-45h-wipe-down-default-integration.js", version);
      await loadScript("app/sensor-station-label-inheritance-integration.js", version);
      await loadScript("app/inactive-label-sensor-suppression-integration.js", version);
      await loadScript("app/company-default-map-catalog-integration.js", version);
      await loadScript("app/default-bottle-spec-retirement-integration.js", version);
      await loadScript("app/protected-default-map-integration.js", version);
      await loadScript("app/repository-brand-download-integration.js", version);
      await loadScript("app/workspace-panel-visibility-guard-integration.js", version);
      await loadScript("app/apl-post-wipe-sensor-continuity-fallback-integration.js", version);
      await loadScript("app/optimizer-post-wipe-coverage-fix-integration.js", version);
      await window.LabelerSensorEditorFocusGuard?.waitForScopedObservers?.(2, 2000);
    } finally {
      window.LabelerSensorEditorFocusGuard?.restoreMutationObserver?.();
    }

    await loadScript("app/sensor-editor-compact-interaction-integration.js", version);
    await loadScript("app/sensor-direction-live-status-integration.js", version);
    await loadScript("app/apl-neck-final-post-wipe-continuity-integration.js", version);
    const ready = window.ServoForgeOrientationConstraintPlannerReady;
    if (ready && typeof ready.then === "function") {
      await Promise.race([
        ready,
        new Promise((resolve) => window.setTimeout(resolve, 2000))
      ]);
    }
  }

  function rerenderServoState() {
    try { if (typeof renderProgram === "function") renderProgram(); }
    catch { window.renderProgram?.(); }
    try { if (typeof renderValidation === "function") renderValidation(); }
    catch { window.renderValidation?.(); }
    try { if (typeof renderAnimationFrame === "function") renderAnimationFrame(); }
    catch { window.renderAnimationFrame?.(); }
  }

  function applyFinalRollerSectionHandoff() {
    const handoff = window.LabelerAplRollerSectionHandoff;
    if (typeof handoff?.applyToState !== "function") return false;
    const changed = handoff.applyToState();
    if (changed) rerenderServoState();
    return changed;
  }

  function applyFinalNeckWipeOrientationMarriage() {
    const marriage = window.LabelerAplNeckWipeOrientationMarriage;
    if (typeof marriage?.applyMarriageToState !== "function") return false;
    const changed = marriage.applyMarriageToState();
    if (!changed) return false;
    rerenderServoState();
    return true;
  }

  try {
    progress?.set(12, "Loading profile engine…");
    if (window.ServoForgeProfileGenerationReady) await window.ServoForgeProfileGenerationReady;

    progress?.set(25, "Loading geometry and planning…");
    if (window.ServoForgeGeometryPlanningReady) await window.ServoForgeGeometryPlanningReady;

    progress?.set(39, "Loading Map Builder…");
    if (window.ServoForgeMapBuilderReady) await window.ServoForgeMapBuilderReady;

    progress?.set(53, "Loading feature integrations…");
    if (window.ServoForgeFeatureIntegrationsReady) await window.ServoForgeFeatureIntegrationsReady;

    progress?.set(61, "Applying common APL label and servo rules…");
    await loadOrientationConstraintPlanner();

    progress?.set(70, "Loading workspace controllers…");
    if (window.ServoForgeBootstrapReady) await window.ServoForgeBootstrapReady;

    progress?.set(74, "Aligning wipe visuals with servo coordinates…");
    const version = document.querySelector('meta[name="application-version"]')?.content || "0.9.10";
    await loadScript("app/wipe-side-servo-parity-v119.js", version);

    progress?.set(74.5, "Following physical machine wipe direction…");
    await loadScript("app/physical-wipe-direction-v125.js", version);

    progress?.set(74.7, "Enabling Community Admin delete…");
    await loadScript("app/community-admin-delete-v126.js", version);

    progress?.set(75, "Applying Autocol end-of-curve policy…");
    await loadScript("app/autocol-terminal-boundary-v120.js", version);

    progress?.set(76, "Aligning printed code-box artwork…");
    await loadScript("app/printed-codebox-left-edge-v121.js", version);

    progress?.set(76.5, "Using canonical Cold Glue brush planner with standard edge protection and full-wrap seam policy…");
    await loadScript("app/cold-glue-brush-visual-integration.js", `${version}-cold-glue-brush-v21`);
    await loadScript("app/cold-glue-brush-white-bristles-v22.js", `${version}-cold-glue-brush-white-v22`);
    await loadScript("app/cold-glue-brush-bevel-back-panel-v23.js", `${version}-cold-glue-brush-bevel-panel-v23`);

    if (typeof initializeLabelerApp !== "function") {
      throw new Error("initializeLabelerApp is not loaded.");
    }

    const initialized = await initializeLabelerApp();
    if (initialized === false) return;

    progress?.set(97.5, "Resolving APL roller section handoffs…");
    applyFinalRollerSectionHandoff();

    progress?.set(98, "Marrying neck wipe and orientation direction…");
    applyFinalNeckWipeOrientationMarriage();

    progress?.complete("ServoForge ready");
  } catch (error) {
    progress?.fail(error);
    if (typeof showStartupError === "function" && !document.querySelector(".startup-error")) showStartupError(error);
    else console.error("ServoForge startup is unavailable.", error);
  }
})();
