"use strict";

(function installWorkspaceActionService(global) {
  function call(name, ...args) {
    const fn = global[name];
    return typeof fn === "function" ? fn(...args) : undefined;
  }

  function renderTargets(targets) {
    const requested = Array.isArray(targets) ? targets : targets ? [targets] : [];
    const unique = new Set(requested);
    if (unique.has("all")) call("render");
    if (unique.has("map")) call("renderMap");
    if (unique.has("simulation-map")) call("renderSimulationMap");
    if (unique.has("animation")) call("renderAnimationFrame");
    if (unique.has("builder")) call("renderWipeDownBuilder");
    if (unique.has("assembly")) call("renderAssemblyEditor");
    if (unique.has("validation")) call("renderValidation");
    if (unique.has("simulation")) call("renderSimulation");
    if (unique.has("labeler-map")) call("renderLabelerMapReference");
  }

  function presentCurrentState() {
    const coordinator = global.LabelerRenderingCoordinator;
    if (typeof coordinator?.driver?.present === "function" && typeof coordinator?.handlers === "function") {
      return coordinator.driver.present(coordinator.handlers());
    }

    // Compatibility fallback for startup/test environments where the rendering
    // coordinator has not been installed yet. This is intentionally presentation
    // only: do not call global render(), because render() runs normalization.
    [
      "renderMap",
      "renderStations",
      "renderBottleSpecs",
      "renderLabelSpecs",
      "renderBuildInputs",
      "renderProgram",
      "renderSimulation",
      "renderHeads",
      "renderValidation",
      "renderTopControls"
    ].forEach((name) => call(name));
    return null;
  }

  function activeWorkspaceTab() {
    let stateTab = "";
    try { stateTab = String(global.state?.activeTab || (typeof state !== "undefined" ? state.activeTab : "") || ""); }
    catch { stateTab = ""; }
    const domTab = String(global.document?.querySelector?.(".tabs .tab.active[data-tab]")?.dataset?.tab || "");
    return domTab || stateTab || "specs";
  }

  function restoreWorkspaceTab(tabName) {
    const name = String(tabName || "");
    if (!name) return;
    const tabs = global.LabelerTabsController;
    if (typeof tabs?.setDirectTabState === "function") {
      tabs.setDirectTabState(name, global.document?.querySelector?.(`.tabs .tab[data-tab="${name}"]`) || null);
      return;
    }
    global.ServoForgeEarlyWorkspaceNavigation?.activate?.(name);
  }

  function execute(options = {}) {
    const tabBefore = options.preserveTab === false
      ? ""
      : typeof options.restoreTab === "string" && options.restoreTab
        ? options.restoreTab
        : activeWorkspaceTab();
    const result = typeof options.mutate === "function" ? options.mutate() : undefined;
    if (options.syncMap) call("syncApplicationMapToLegacyState");
    if (options.syncAssemblyMap) call("syncMapPointsFromAssemblies");
    if (options.regenerate) call("applyGeneratedServoProfile");
    if (typeof options.beforeRender === "function") options.beforeRender(result);
    if (options.persist) call("saveCurrentSettings");
    renderTargets(options.render);
    if (tabBefore) restoreWorkspaceTab(tabBefore);
    if (typeof options.after === "function") options.after(result);
    return result;
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  global.LabelerWorkspaceActionService = Object.freeze({
    execute,
    render: renderTargets,
    present: presentCurrentState,
    call,
    number
  });
})(window);