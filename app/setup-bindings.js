"use strict";

// Setup state hydration and most browser events are owned by focused
// controllers loaded through the bootstrap pipeline. Workspace tab navigation
// is intentionally installed here as a bootstrap-independent safety boundary:
// this file is loaded directly by index.html before app/bootstrap.js, so a
// later startup-module failure can never leave the visible workspace trapped
// on Specs.
(function installBootstrapIndependentWorkspaceNavigation(global) {
  if (global.ServoForgeEarlyWorkspaceNavigation?.installed) return;

  const FALLBACK_BUILD = "bootstrap-independent-navigation-v69-20260811-1308";
  const WORKSPACE_TABS = new Set(["specs", "buildInputs", "program", "diagnostics", "simulation"]);
  let lastActivationAt = 0;

  function stateRef() {
    try { return typeof state !== "undefined" ? state : global.state; }
    catch { return global.state; }
  }

  function tabFromTarget(target) {
    return target?.closest?.(".tabs .tab[data-tab]") || null;
  }

  function tabFromCoordinates(event) {
    const x = Number(event?.clientX);
    const y = Number(event?.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [...document.querySelectorAll(".tabs .tab[data-tab]")].find((tab) => {
      const rect = tab.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }) || null;
  }

  function selectedTab(event) {
    const direct = tabFromTarget(event?.target);
    if (direct) return direct;
    // Saved-workspace UI state can leave an invisible layer above the tabs.
    // Resolve the intended button geometrically so that layer cannot trap the
    // workspace on its current page.
    return tabFromCoordinates(event);
  }

  function closeBuilderDirectly() {
    const source = stateRef();
    if (source) source.wipeBuilderOpen = false;
    const drawer = document.querySelector("#applicationSetupDialog");
    if (drawer) drawer.hidden = true;
    document.querySelector("#mapRightRail")?.classList.remove("builder-open");
    document.querySelector("#wipeDownBuilderButton")?.classList.remove("active");
  }

  function renderSelectedPanel(tabName) {
    try {
      if (tabName === "buildInputs" && typeof global.renderBuildInputs === "function") global.renderBuildInputs();
      else if (tabName === "program" && typeof global.renderProgram === "function") global.renderProgram();
      else if (tabName === "simulation" && typeof global.renderSimulation === "function") global.renderSimulation();
    } catch (error) {
      console.warn(`Workspace ${tabName} renderer is not ready yet; navigation remains available.`, error);
    }
  }

  function activate(tabName, tabElement = null) {
    const name = String(tabName || "");
    if (!WORKSPACE_TABS.has(name)) return false;

    closeBuilderDirectly();
    const source = stateRef();
    if (source) source.activeTab = name;

    document.querySelectorAll(".tabs .tab[data-tab]").forEach((tab) => {
      const active = tab === tabElement || tab.dataset.tab === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    document.querySelectorAll(".table-wrap").forEach((panel) => {
      const active = panel.id === name;
      panel.classList.toggle("active", active);
      panel.setAttribute("aria-hidden", String(!active));
      if (active) {
        panel.hidden = false;
        panel.removeAttribute("hidden");
        panel.style.removeProperty("display");
        if (panel.dataset?.developerHidden === "true") panel.dataset.developerHidden = "false";
      }
    });

    renderSelectedPanel(name);
    return Boolean(document.getElementById(name)?.classList.contains("active"));
  }

  function handleNavigationEvent(event) {
    const tab = selectedTab(event);
    const name = String(tab?.dataset?.tab || "");
    if (!tab || !WORKSPACE_TABS.has(name)) return;

    const now = Date.now();
    if (event.type === "click" && now - lastActivationAt < 350) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      return;
    }

    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    lastActivationAt = now;
    activate(name, tab);
  }

  // Window capture is deliberately earlier and broader than the modular
  // document-level event controllers. Pointerdown also recovers clicks when an
  // invisible saved-state layer is the actual event target above a tab.
  global.addEventListener("pointerdown", handleNavigationEvent, true);
  global.addEventListener("click", handleNavigationEvent, true);

  function publishBuildMarker() {
    const banner = document.querySelector(".staging-environment-banner");
    if (!banner) return;
    const activeBuild = String(global.ServoForgeBootstrapBuild || global.SERVOFORGE_BUILD_ID || "").trim();
    const activeUpdatedAt = String(global.SERVOFORGE_BUILD_UPDATED_AT || "").trim();
    if (activeBuild) {
      banner.textContent = `STAGING 0.9.10 • BUILD ${activeBuild} • UPDATED ${activeUpdatedAt || "current build"} — NOT PRODUCTION`;
      return;
    }
    banner.textContent = `STAGING 0.9.10 • BUILD ${FALLBACK_BUILD} • UPDATED Aug 11, 2026 1:08 PM ET — NOT PRODUCTION`;
  }

  publishBuildMarker();
  document.addEventListener("DOMContentLoaded", publishBuildMarker, { once: true });
  global.addEventListener("load", publishBuildMarker, { once: true });

  global.ServoForgeEarlyWorkspaceNavigation = Object.freeze({
    installed: true,
    version: 1,
    build: FALLBACK_BUILD,
    activate,
    selectedTab,
    bootstrapIndependent: true,
    coordinateRecovery: true
  });
})(window);

window.LabelerSetupBindingsCompatibility = Object.freeze({
  stateOwner: "LabelerSetupStateController",
  eventOwner: "LabelerSetupEventControllers",
  mapOwner: "LabelerMapController",
  settingsOwner: "LabelerSettingsController",
  workspaceNavigationOwner: "ServoForgeEarlyWorkspaceNavigation"
});
