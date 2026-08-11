"use strict";

(function installTabsController(global) {
  const actions = global.LabelerWorkspaceActionService;
  const NAVIGATION_CAPTURE_KEY = "servoforgeTopNavigationCaptureV2";

  function stateRef() {
    try { return typeof state !== "undefined" ? state : global.state; }
    catch { return global.state; }
  }

  function setDirectTabState(tabName, tabElement = null) {
    const source = stateRef();
    if (source) source.activeTab = tabName;
    document.querySelectorAll(".tabs .tab[data-tab]").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".table-wrap").forEach((panel) => panel.classList.remove("active"));
    tabElement?.classList.add("active");
    document.querySelector(`#${tabName}`)?.classList.add("active");
  }

  function activate(tabName, tabElement = null) {
    if (!tabName) return false;
    actions.execute({
      mutate() {
        setDirectTabState(tabName, tabElement);
      },
      persist: true,
      render: "all"
    });
    return true;
  }

  function setBuilderVisualState(open, button = document.querySelector("#wipeDownBuilderButton")) {
    button?.classList.toggle("active", Boolean(open));
    if (open) {
      document.querySelectorAll(".tabs .tab[data-tab]").forEach((tab) => tab.classList.remove("active"));
    } else {
      const source = stateRef();
      const activeTab = String(source?.activeTab || "specs");
      document.querySelector(`.tabs .tab[data-tab="${activeTab}"]`)?.classList.add("active");
      document.querySelector(`#${activeTab}`)?.classList.add("active");
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
    toggleMapBuilder,
    closeMapBuilder,
    installNavigationCapture,
    navigationCaptureV2: true
  });
})(window);
