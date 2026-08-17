"use strict";

(function installMachineMapSelectorIntegration(global) {
  if (global.LabelerMachineMapSelectorIntegration?.installed) return;

  const RETRY_MS = 50;
  const PREFS_KEY = "servoforge-developer-preferences-v1";
  const RETIRED_MAP_ID = "map-workbook-3-label-apl-reference";
  const RETIRED_ACTIVATION_KEY = "servoforgeWorkbookReferenceMapV1Activated";
  const VIEWER_ID = "machineMapViewer";
  const SELECT_ID = "machineMapViewerSelect";
  const LEGACY_VIEWER_ID = "lockedMapViewer";
  let installed = false;
  let refreshPending = false;
  let observer = null;

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      return {
        ...saved,
        lockedMapIds: Array.isArray(saved?.lockedMapIds)
          ? [...new Set(saved.lockedMapIds.map(String))]
          : [],
        hiddenPanels: Array.isArray(saved?.hiddenPanels)
          ? [...new Set(saved.hiddenPanels.map(String))]
          : []
      };
    } catch {
      return { lockedMapIds: [], hiddenPanels: [] };
    }
  }

  function savePreferences(preferences) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(preferences)); }
    catch { }
  }

  function maps() {
    return Array.isArray(state?.mapLibrary) ? state.mapLibrary : [];
  }

  function activeMap() {
    try { return typeof activeMachineMap === "function" ? activeMachineMap() : null; }
    catch { return null; }
  }

  function mapIsLocked(map) {
    return Boolean(map?.id && readPreferences().lockedMapIds.includes(String(map.id)));
  }

  function purgeRetiredWorkbookFeature() {
    document.querySelectorAll(".workbook-reference-comparison,#workbookReferenceComparisonStyles")
      .forEach((node) => node.remove());
    try { localStorage.removeItem(RETIRED_ACTIVATION_KEY); } catch { }

    const library = maps();
    const previousLength = library.length;
    const removedActiveMap = String(state.activeMapId || "") === RETIRED_MAP_ID;
    state.mapLibrary = library.filter((map) => String(map?.id || "") !== RETIRED_MAP_ID);

    const preferences = readPreferences();
    const filteredLocks = preferences.lockedMapIds.filter((id) => id !== RETIRED_MAP_ID);
    if (filteredLocks.length !== preferences.lockedMapIds.length) {
      preferences.lockedMapIds = filteredLocks;
      savePreferences(preferences);
    }

    if (removedActiveMap && state.mapLibrary.length) {
      state.activeMapId = String(state.mapLibrary[0].id || "");
      if (typeof loadMachineMapIntoRuntime === "function") {
        loadMachineMapIntoRuntime(state.mapLibrary[0], false);
      }
    }
    return previousLength !== state.mapLibrary.length;
  }

  function restoreSurfaceControls(surface) {
    if (!surface) return;
    surface.classList.remove("read-only-surface");
    surface.querySelectorAll("input,select,textarea,button").forEach((control) => {
      if (!control.hasAttribute("data-developer-was-disabled")) return;
      control.disabled = control.dataset.developerWasDisabled === "true";
      delete control.dataset.developerWasDisabled;
    });
  }

  function unlockEditableSurfaces() {
    restoreSurfaceControls(document.querySelector("#specs"));
    restoreSurfaceControls(document.querySelector("#buildInputs"));

    const note = document.querySelector("#workspaceControlsCard .workspace-controls-note:last-child");
    const noteText = "Locked maps protect the mechanical map, Map Builder, and Servo Program edits. Specs and Build Inputs remain editable.";
    if (note && note.textContent.trim() !== noteText) note.textContent = noteText;

    const help = document.querySelector("#workspaceMapLockHelp");
    if (help && mapIsLocked(activeMap())) {
      help.textContent = "The selected mechanical map is protected. Specs and Build Inputs remain editable.";
    }
  }

  function optionFor(map, lockedIds) {
    const option = document.createElement("option");
    const id = String(map?.id || "");
    option.value = id;
    option.dataset.mapId = id;
    option.dataset.locked = String(lockedIds.has(id));
    option.textContent = `${lockedIds.has(id) ? "🔒 " : ""}${String(map?.name || "Machine Map")}`;
    return option;
  }

  function retireLegacyViewer() {
    const legacy = document.querySelector(`#${LEGACY_VIEWER_ID}`);
    if (!legacy) return;
    legacy.dataset.machineMapSelectorRetired = "true";
    legacy.setAttribute("aria-hidden", "true");
  }

  function ensureViewer() {
    const mapHead = document.querySelector(".map-head");
    if (!mapHead) return null;
    retireLegacyViewer();

    let viewer = mapHead.querySelector(`#${VIEWER_ID}`);
    if (viewer) return viewer;

    viewer = document.createElement("div");
    viewer.id = VIEWER_ID;
    viewer.className = "locked-map-viewer machine-map-viewer";
    viewer.dataset.machineMapSelectorOwner = "v150";
    viewer.innerHTML = `
      <label>Machine Map <select id="${SELECT_ID}" aria-label="Machine Map"></select></label>
      <span class="locked-map-badge" data-state="editable">Map Editable</span>`;
    mapHead.appendChild(viewer);
    return viewer;
  }

  function updateViewerCopy(viewer, map) {
    const badge = viewer?.querySelector(".locked-map-badge");
    if (!badge) return;
    const locked = mapIsLocked(map);
    badge.textContent = locked ? "Map Locked • Specs & Inputs Editable" : "Map Editable";
    badge.dataset.state = locked ? "locked" : "editable";
  }

  function renderMapOptions() {
    refreshPending = false;
    retireLegacyViewer();
    const viewer = ensureViewer();
    const select = viewer?.querySelector(`#${SELECT_ID}`);
    if (!viewer || !select) return;

    const library = maps();
    viewer.hidden = library.length === 0;
    if (!library.length) {
      select.replaceChildren();
      updateViewerCopy(viewer, null);
      return;
    }

    const lockedIds = new Set(readPreferences().lockedMapIds);
    const expected = library.map((map) => `${String(map?.id || "")}\u001f${lockedIds.has(String(map?.id || ""))}`);
    const current = [...select.options].map((option) => `${String(option.dataset.mapId || "")}\u001f${String(option.dataset.locked || "false") === "true"}`);

    if (expected.length !== current.length || expected.some((identity, index) => identity !== current[index])) {
      const fragment = document.createDocumentFragment();
      library.forEach((map) => fragment.appendChild(optionFor(map, lockedIds)));
      select.replaceChildren(fragment);
    }

    const activeId = String(state.activeMapId || "");
    const selectedId = library.some((map) => String(map?.id || "") === activeId)
      ? activeId
      : String(library[0]?.id || "");
    select.value = selectedId;
    updateViewerCopy(viewer, library.find((map) => String(map?.id || "") === selectedId));
  }

  function applySelectedMap(mapId) {
    const requestedId = String(mapId || "");
    const map = maps().find((entry) => String(entry?.id || "") === requestedId);
    if (!map) {
      console.warn("Machine map selection ignored because the requested map is no longer in the library.", requestedId);
      renderMapOptions();
      return false;
    }
    if (String(map.id) === String(state.activeMapId || "")) {
      renderMapOptions();
      return true;
    }

    if (typeof clearServoSimulationForSelectedMap === "function") clearServoSimulationForSelectedMap();
    else if (state.simulation) state.simulation.useCustom = false;

    if (typeof loadMachineMapIntoRuntime === "function") loadMachineMapIntoRuntime(map, false);
    else state.activeMapId = String(map.id);

    if (typeof applyGeneratedServoProfile === "function") applyGeneratedServoProfile();
    if (typeof render === "function") render();
    if (typeof saveCurrentSettings === "function") saveCurrentSettings();
    renderMapOptions();
    return String(state.activeMapId || "") === String(map.id);
  }

  function bindSelection() {
    if (document.documentElement.dataset.machineMapSelectorBoundV150 === "true") return;
    document.documentElement.dataset.machineMapSelectorBoundV150 = "true";

    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest?.(`#${SELECT_ID}`)) return;
      renderMapOptions();
    }, true);

    document.addEventListener("focusin", (event) => {
      if (!event.target.closest?.(`#${SELECT_ID}`)) return;
      renderMapOptions();
    }, true);

    document.addEventListener("change", (event) => {
      const select = event.target.closest?.(`#${SELECT_ID}`);
      if (!select) return;
      const requestedId = String(select.value || select.selectedOptions?.[0]?.dataset?.mapId || "");
      event.preventDefault();
      event.stopImmediatePropagation();
      applySelectedMap(requestedId);
    }, true);

    document.addEventListener("click", (event) => {
      if (!event.target.closest?.("#workspaceToggleMapLock")) return;
      window.setTimeout(scheduleRefresh, 0);
    }, true);

    window.addEventListener?.("storage", (event) => {
      if (event.key === PREFS_KEY) scheduleRefresh();
    });
  }

  function installStyles() {
    if (document.querySelector("#machineMapSelectorStyles")) return;
    document.querySelector("#lockedMapBrandSelectorStyles")?.remove();
    const style = document.createElement("style");
    style.id = "machineMapSelectorStyles";
    style.textContent = `
      #${LEGACY_VIEWER_ID}[data-machine-map-selector-retired="true"]{display:none!important}
      #${SELECT_ID} option{font-weight:500;color:var(--text)}
      .machine-map-viewer .locked-map-badge[data-state="editable"]{border-color:var(--green);color:var(--green)}
      #specs:not(.read-only-surface) input:not(:disabled),
      #specs:not(.read-only-surface) select:not(:disabled),
      #buildInputs:not(.read-only-surface) input:not(:disabled),
      #buildInputs:not(.read-only-surface) select:not(:disabled){opacity:1;cursor:auto}
    `;
    document.head.appendChild(style);
  }

  function refresh() {
    refreshPending = false;
    purgeRetiredWorkbookFeature();
    unlockEditableSurfaces();
    renderMapOptions();
  }

  function scheduleRefresh() {
    if (refreshPending) return;
    refreshPending = true;
    window.requestAnimationFrame(refresh);
  }

  function installObserver() {
    if (observer) return;
    const mapHead = document.querySelector(".map-head");
    if (!mapHead) return;
    observer = new MutationObserver(scheduleRefresh);
    observer.observe(mapHead, {
      childList: true,
      subtree: false
    });
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined" || typeof activeMachineMap !== "function" || !document.querySelector(".map-head")) return false;

    installed = true;
    const changed = purgeRetiredWorkbookFeature();
    installStyles();
    ensureViewer();
    bindSelection();
    installObserver();
    unlockEditableSurfaces();
    renderMapOptions();
    if (changed && typeof saveCurrentSettings === "function") saveCurrentSettings();
    window.setTimeout(scheduleRefresh, 250);
    window.setTimeout(scheduleRefresh, 1000);
    return true;
  }

  global.LabelerMachineMapSelectorIntegration = Object.freeze({
    installed: true,
    VIEWER_ID,
    SELECT_ID,
    renderMapOptions,
    applySelectedMap,
    scheduleRefresh,
    selectorOwnershipV150: true
  });

  function wait() {
    if (!install()) window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})(typeof window !== "undefined" ? window : globalThis);
