"use strict";

const COLD_GLUE_PROCESS_KINDS = Object.freeze(["brush", "brush-channel", "wipe", "roller", "gripper"]);

function coldGlueProcessObjects(items) {
  return (Array.isArray(items) ? items : []).filter((item) => COLD_GLUE_PROCESS_KINDS.includes(item?.kind));
}

function normalizeColdGlueMap(items) {
  return coldGlueProcessObjects(items)
    .map((item) => ({ ...item, kind: item.kind === "wipe" ? "brush" : item.kind }));
}

function normalizeColdGlueMachineMapObjects(items, stationCount = 6) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (!COLD_GLUE_PROCESS_KINDS.includes(item?.kind)) return { ...item };
    const source = { ...item, kind: item.kind === "wipe" ? "brush" : item.kind, application: "cold-glue" };
    return typeof normalizeBuilderObject === "function"
      ? normalizeBuilderObject(source, "cold-glue", stationCount)
      : source;
  });
}

function activeColdGlueMachineMap() {
  const map = typeof activeMachineMap === "function"
    ? activeMachineMap()
    : state.mapLibrary?.find((entry) => entry.id === state.activeMapId) || null;
  if (!map) return null;
  const mode = typeof inferredMachineMapApplicationMode === "function"
    ? inferredMachineMapApplicationMode(map)
    : map.applicationMode;
  return mode === "cold-glue" ? map : null;
}

function normalizeCanonicalColdGlueObjects(items, stationCount = 6) {
  return normalizeColdGlueMap(items).map((item) => {
    const source = { ...item, application: "cold-glue" };
    return typeof normalizeBuilderObject === "function"
      ? normalizeBuilderObject(source, "cold-glue", stationCount)
      : source;
  });
}

function coldGlueMapObjects() {
  // The saved machine map is the Cold Glue mechanical source of truth. The
  // state.coldGlueMap array remains only as a compatibility mirror for older
  // integrations and persistence payloads. Rendering, editing, and profile
  // generation must never depend on the mirror being current.
  const machineMap = activeColdGlueMachineMap();
  if (machineMap) {
    machineMap.objects = normalizeColdGlueMachineMapObjects(machineMap.objects, machineMap.stationCount || 6);
    const canonicalProcessObjects = coldGlueProcessObjects(machineMap.objects);
    state.coldGlueMap = canonicalProcessObjects.map((item) => ({ ...item }));
    return canonicalProcessObjects;
  }

  const legacy = normalizeCanonicalColdGlueObjects(state.coldGlueMap, 6);
  state.coldGlueMap = legacy;
  return state.coldGlueMap;
}

function resetColdGlueMap() {
  const machineMap = activeColdGlueMachineMap();
  if (machineMap) {
    machineMap.objects = [];
    machineMap.restoreDefaultObjects = false;
    machineMap.localStructuralMapOverride = true;
  }
  state.coldGlueMap = [];
}

function coldGlueMapRows() {
  return coldGlueMapObjects().flatMap((item) => {
    if (item.kind === "brush-channel") return [
      { name: `${item.name} Outside Start`, angle: Number(item.outerStart), station: null, fixedName: true, update: (value) => { item.outerStart = value; } },
      { name: `${item.name} Outside Stop`, angle: Number(item.outerEnd), station: null, fixedName: true, update: (value) => { item.outerEnd = value; } },
      { name: `${item.name} Inside Start`, angle: Number(item.innerStart), station: null, fixedName: true, update: (value) => { item.innerStart = value; } },
      { name: `${item.name} Inside Stop`, angle: Number(item.innerEnd), station: null, fixedName: true, update: (value) => { item.innerEnd = value; } }
    ];
    if (Number.isFinite(Number(item.angle))) {
      return [{
        name: item.name, angle: Number(item.angle), station: null, fixedName: true,
        update: (value) => { item.angle = value; }
      }];
    }
    return [
      { name: `${item.name} Start`, angle: Number(item.start), station: null, fixedName: true, update: (value) => { item.start = value; } },
      { name: `${item.name} Stop`, angle: Number(item.end), station: null, fixedName: true, update: (value) => { item.end = value; } }
    ];
  });
}

function coldGlueMapValue(id, field, fallback) {
  const item = coldGlueMapObjects().find((entry) => entry.id === id);
  return num(item?.[field], fallback);
}

function mapPointAngle(pattern, fallback = 0) {
  const dynamicPoint = applicationMapPointRows().find((point) => pattern.test(point.name));
  if (dynamicPoint && Number.isFinite(Number(dynamicPoint.angle))) return Number(dynamicPoint.angle);
  return state.mapPoints.find((point) => pattern.test(point.name))?.angle ?? fallback;
}

function finishAngle(value) {
  return Number.isFinite(value) ? Math.round(value * 2) / 2 : null;
}

window.LabelerColdGlueMapService = Object.freeze({
  normalizeColdGlueMap,
  coldGlueProcessObjects,
  normalizeColdGlueMachineMapObjects,
  activeColdGlueMachineMap,
  normalizeCanonicalColdGlueObjects,
  coldGlueMapObjects,
  resetColdGlueMap,
  coldGlueMapRows,
  coldGlueMapValue,
  activeMapAuthorityV133: true
});