"use strict";

(function installTabsController(global) {
  const NAVIGATION_CAPTURE_KEY = "servoforgeTopNavigationCaptureV3";
  const WORKSPACE_TABS = Object.freeze(["specs", "buildInputs", "program", "diagnostics", "simulation"]);

  function stateRef() {
    try { return typeof state !== "undefined" ? state : global.state; }
    catch { return global.state; }
  }

  function workspacePanels() {
    return WORKSPACE_TABS
      .map((name) => document.getElementById(name))
      .filter(Boolean);
  }

  function setDirectTabState(tabName, tabElement = null) {
    if (!WORKSPACE_TABS.includes(String(tabName || ""))) return false;

    const source = stateRef();
    if (source) source.activeTab = tabName;

    document.querySelectorAll(".tabs .tab[data-tab]").forEach((item) => {
      const active = item === tabElement || item.dataset.tab === tabName;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });

    workspacePanels().forEach((panel) => {
      const active = panel.id === tabName;
      panel.classList.toggle("active", active);
      if (active) {
        panel.hidden = false;
        panel.removeAttribute("hidden");
        panel.style.removeProperty("display");
        if (panel.dataset?.developerHidden === "true") panel.dataset.developerHidden = "false";
        panel.setAttribute("aria-hidden", "false");
      } else {
        panel.setAttribute("aria-hidden", "true");
      }
    });

    const selected = document.getElementById(tabName);
    return Boolean(selected?.classList.contains("active"));
  }

  function persistActiveTab() {
    try {
      if (typeof global.saveCurrentSettings === "function") global.saveCurrentSettings();
    } catch (error) {
      console.warn("Workspace tab state could not be persisted.", error);
    }
  }

  function activate(tabName, tabElement = null) {
    if (!tabName) return false;
    const source = stateRef();
    const enteringSimulation = tabName === "simulation"
      && source?.activeTab !== "simulation"
      && source?.simulation?.sessionOpened !== true;
    const opened = setDirectTabState(tabName, tabElement);
    if (!opened) return false;
    if (enteringSimulation) global.LabelerSimulationController?.openBlankWorkspace?.();
    persistActiveTab();
    return true;
  }

  function setBuilderVisualState(open, button = document.querySelector("#wipeDownBuilderButton")) {
    button?.classList.toggle("active", Boolean(open));
    if (open) {
      document.querySelectorAll(".tabs .tab[data-tab]").forEach((tab) => tab.classList.remove("active"));
    } else {
      const source = stateRef();
      const activeTab = String(source?.activeTab || "specs");
      setDirectTabState(activeTab, document.querySelector(`.tabs .tab[data-tab="${activeTab}"]`));
    }
  }

  function toggleMapBuilder(button = document.querySelector("#wipeDownBuilderButton")) {
    const source = stateRef();
    const nextOpen = !Boolean(source?.wipeBuilderOpen);
    const map = global.LabelerMapController;

    if (typeof map?.setBuilderOpen === "function") {
      map.setBuilderOpen(nextOpen);
    } else {
      if (source) source.wipeBuilderOpen = nextOpen;
      const drawer = document.querySelector("#applicationSetupDialog");
      if (drawer) drawer.hidden = !nextOpen;
      document.querySelector("#mapRightRail")?.classList.toggle("builder-open", nextOpen);
    }

    setBuilderVisualState(nextOpen, button);
    return nextOpen;
  }

  function closeMapBuilder() {
    const source = stateRef();
    if (!source?.wipeBuilderOpen && document.querySelector("#applicationSetupDialog")?.hidden !== false) return false;
    const map = global.LabelerMapController;
    if (typeof map?.setBuilderOpen === "function") map.setBuilderOpen(false);
    else {
      if (source) source.wipeBuilderOpen = false;
      const drawer = document.querySelector("#applicationSetupDialog");
      if (drawer) drawer.hidden = true;
      document.querySelector("#mapRightRail")?.classList.remove("builder-open");
    }
    setBuilderVisualState(false);
    return true;
  }

  function installNavigationCapture() {
    const root = document.documentElement;
    if (!root || root.dataset[NAVIGATION_CAPTURE_KEY] === "true") return false;
    root.dataset[NAVIGATION_CAPTURE_KEY] = "true";

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const builder = target.closest?.("#wipeDownBuilderButton");
      if (builder) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleMapBuilder(builder);
        return;
      }

      const closeBuilder = target.closest?.("#closeApplicationSetup");
      if (closeBuilder) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeMapBuilder();
        return;
      }

      const applyBuilder = target.closest?.("#applyApplicationSetup");
      if (applyBuilder) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof global.LabelerMapController?.applyBuilder === "function") global.LabelerMapController.applyBuilder();
        else closeMapBuilder();
        return;
      }

      const tab = target.closest?.(".tabs .tab[data-tab]");
      if (!tab) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      closeMapBuilder();
      activate(tab.dataset.tab, tab);
    }, true);
    return true;
  }

  installNavigationCapture();

  global.LabelerTabsController = Object.freeze({
    activate,
    setDirectTabState,
    toggleMapBuilder,
    closeMapBuilder,
    installNavigationCapture,
    workspaceTabs: WORKSPACE_TABS,
    navigationCaptureV3: true
  });
})(window);
