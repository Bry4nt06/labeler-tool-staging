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
    const tabBefore = options.preserveTab === false ? "" : activeWorkspaceTab();
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
    call,
    number
  });
})(window);