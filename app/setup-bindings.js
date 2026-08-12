"use strict";

// Workspace tab navigation is owned by app/controllers/tabs-controller.js,
// which is loaded directly by index.html before the bootstrap pipeline. This
// compatibility module intentionally attaches no browser listeners. Keeping a
// second window-capture navigation layer here caused native Build Inputs
// controls to race the authoritative tab controller during full rerenders.
(function publishSetupBindingsCompatibility(global) {
  function activate(tabName, tabElement = null) {
    const tabs = global.LabelerTabsController;
    if (typeof tabs?.setDirectTabState !== "function") return false;
    return tabs.setDirectTabState(
      String(tabName || ""),
      tabElement || global.document?.querySelector?.(`.tabs .tab[data-tab="${String(tabName || "")}"]`) || null
    );
  }

  global.ServoForgeEarlyWorkspaceNavigation = Object.freeze({
    installed: true,
    version: 2,
    build: "brand-selection-transaction-v92-20260811-2109",
    activate,
    bootstrapIndependent: true,
    delegatedToTabsController: true,
    coordinateRecovery: false
  });

  global.LabelerSetupBindingsCompatibility = Object.freeze({
    stateOwner: "LabelerSetupStateController",
    eventOwner: "LabelerSetupEventControllers",
    mapOwner: "LabelerMapController",
    settingsOwner: "LabelerSettingsController",
    workspaceNavigationOwner: "LabelerTabsController"
  });
})(window);
