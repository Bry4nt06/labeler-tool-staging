"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/map-builder-history-service.js"), "utf8");

const map = {
  id: "sparse-cold-glue-map",
  applicationMode: "cold-glue",
  stationCount: 3,
  enabledStations: [true, false, true, false, true, false],
  objects: [
    { id: "s1", kind: "brush", application: "cold-glue", station: 1, start: 10, end: 20 },
    { id: "s3", kind: "brush", application: "cold-glue", station: 3, start: 30, end: 40 },
    { id: "s5", kind: "brush", application: "cold-glue", station: 5, start: 50, end: 60 }
  ]
};

const state = {
  activeMapId: map.id,
  mapLibrary: [map],
  coldGlueMap: map.objects.map((item) => ({ ...item })),
  builderHistory: { undo: [], redo: [] },
  builderSaveState: "saved"
};

const context = {
  console,
  state,
  els: {},
  window: { requestAnimationFrame() {} },
  CSS: { escape(value) { return String(value); } },
  activeMachineMap() { return map; },
  syncApplicationMapToLegacyState() {},
  applyGeneratedServoProfile() {
    // Reproduce the legacy failure: a generator assumes stationCount=3 means
    // physical stations 1..3 and drops the valid sparse physical Station 5.
    map.objects = map.objects.filter((item) => Number(item.station) <= map.stationCount);
    state.coldGlueMap = map.objects.map((item) => ({ ...item }));
  },
  renderMap() {},
  renderProgram() {},
  renderSimulation() {},
  renderValidation() {},
  renderTopControls() {},
  renderWipeDownBuilder() {},
  render() {},
  saveCurrentSettings() {},
  clearTimeout() {},
  setTimeout(fn) { fn(); return 1; },
  deepClone(value) { return JSON.parse(JSON.stringify(value)); },
  createMachineMap(value) { return JSON.parse(JSON.stringify(value)); },
  loadMachineMapIntoRuntime() {}
};
context.window = { ...context.window, ...context };

vm.createContext(context);
vm.runInContext(source, context, { filename: "map-builder-history-service.js" });

context.refreshAfterBuilderEdit({ structural: true, persist: false });

assert.deepEqual(map.enabledStations, [true, false, true, false, true, false]);
assert.equal(map.stationCount, 3);
assert.deepEqual(map.objects.map((item) => Number(item.station)), [1, 3, 5]);
assert.equal(map.objects.find((item) => item.id === "s5")?.station, 5);
assert.deepEqual(state.coldGlueMap.map((item) => Number(item.station)), [1, 3, 5]);
assert.equal(map.localStructuralMapOverride, true);

console.log("Cold Glue sparse physical Station 5 object refresh regression passed.");
