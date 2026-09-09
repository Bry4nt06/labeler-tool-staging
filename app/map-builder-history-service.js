"use strict";

let builderSaveTimer = null;

function selectMapBuilderObject(objectId, { openBuilder = true, scroll = true } = {}) {
  state.selectedMapObjectId = String(objectId || "");
  const map = activeMachineMap();
  const item = map?.objects?.find((entry) => entry.id === state.selectedMapObjectId);
  if (item) builderExpandedStation = String(item.kind === "coding" ? "coding" : item.station);
  if (openBuilder && typeof setBuilderOpen === "function") setBuilderOpen(true);
  renderMap();
  renderWipeDownBuilder();
  if (scroll) window.requestAnimationFrame(() => {
    const editor = els.wipeBuilderList?.querySelector(`[data-builder-object-id="${CSS.escape(state.selectedMapObjectId)}"]`);
    if (editor) {
      editor.open = true;
      editor.scrollIntoView({ behavior: "smooth", block: "center" });
      editor.querySelector("input, select")?.focus({ preventScroll: true });
    }
  });
}

function recordBuilderHistory(label = "Map edit") {
  const map = activeMachineMap();
  if (!map) return;
  state.builderHistory = state.builderHistory || { undo: [], redo: [] };
  state.builderHistory.undo.push({ label, map: deepClone(map) });
  if (state.builderHistory.undo.length > 30) state.builderHistory.undo.shift();
  state.builderHistory.redo = [];
}

function restoreBuilderHistory(direction) {
  const source = direction === "undo" ? state.builderHistory?.undo : state.builderHistory?.redo;
  const destination = direction === "undo" ? state.builderHistory?.redo : state.builderHistory?.undo;
  if (!source?.length) return;
  const current = activeMachineMap();
  destination.push({ label: direction === "undo" ? "Redo" : "Undo", map: deepClone(current) });
  const snapshot = source.pop();
  const index = state.mapLibrary.findIndex((map) => map.id === state.activeMapId);
  if (index >= 0) state.mapLibrary[index] = createMachineMap(snapshot.map);
  loadMachineMapIntoRuntime(state.mapLibrary[index], true);
  saveCurrentSettings();
  render();
  renderWipeDownBuilder();
}

function cloneBuilderObjects(items) {
  const source = Array.isArray(items) ? items : [];
  if (typeof deepClone === "function") return deepClone(source);
  return source.map((item) => ({ ...item }));
}

function restoreColdGlueBuilderObjects(machineMap, snapshot) {
  if (!machineMap || !Array.isArray(snapshot)) return;

  // Servo-profile generation is a consumer of the mechanical map, never its
  // owner. Some legacy Cold Glue wrappers still infer a contiguous station set
  // from stationCount and can rewrite the canonical object collection while a
  // profile is regenerated. That drops valid sparse physical stations such as
  // 1 / 3 / 5 when stationCount is 3. Restore the exact Map Builder collection
  // after generation so physical station numbers remain authoritative.
  const restored = cloneBuilderObjects(snapshot);
  if (Array.isArray(machineMap.objects)) {
    machineMap.objects.splice(0, machineMap.objects.length, ...restored);
  } else {
    machineMap.objects = restored;
  }

  if (machineMap.applicationMode === "cold-glue") {
    state.coldGlueMap = machineMap.objects.map((item) => ({ ...item }));
  }
}

function refreshAfterBuilderEdit({ persist = false, structural = false } = {}) {
  const machineMap = typeof activeMachineMap === "function" ? activeMachineMap() : null;
  const preserveColdGlueObjects = machineMap?.applicationMode === "cold-glue"
    ? cloneBuilderObjects(machineMap.objects)
    : null;

  if (structural && machineMap) machineMap.localStructuralMapOverride = true;

  syncApplicationMapToLegacyState();
  applyGeneratedServoProfile();
  restoreColdGlueBuilderObjects(machineMap, preserveColdGlueObjects);
  renderMap();
  renderProgram();
  renderSimulation();
  renderValidation();
  renderTopControls();
  if (persist) {
    state.builderSaveState = "saving";
    if (els.builderStatus) els.builderStatus.textContent = "Saving…";
    clearTimeout(builderSaveTimer);
    builderSaveTimer = setTimeout(() => {
      saveCurrentSettings();
      state.builderSaveState = "saved";
      if (els.builderStatus) els.builderStatus.textContent = `Saved • ${activeMachineMap()?.name || "Map"}`;
    }, 120);
  }
}

let builderExpandedStation = null;
