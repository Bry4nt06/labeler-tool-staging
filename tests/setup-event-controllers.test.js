"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const controllerPaths = [
  "app/controllers/workspace-action-service.js",
  "app/controllers/settings-controller.js",
  "app/controllers/map-controller.js",
  "app/controllers/specs-controller.js",
  "app/controllers/build-inputs-controller.js",
  "app/controllers/tabs-controller.js",
  "app/controllers/transfer-controller.js",
  "app/controllers/simulation-controller.js",
  "app/controllers/application-controller.js",
  "app/controllers/setup-event-controller-integration.js"
];
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const sources = controllerPaths.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]);

class FakeElement {}
const listeners = [];
const calls = {
  syncMap: 0,
  syncAssembly: 0,
  regenerate: 0,
  persist: 0,
  render: 0,
  builder: 0,
  assembly: 0,
  loadMap: 0
};
const activeMap = {
  id: "map-1",
  applicationMode: "apl",
  objects: [],
  machineSettings: {}
};
const state = {
  headCount: 45,
  radius: 270,
  zeroAngle: 0,
  direction: "ccw",
  referencePitchRadiusMm: 572.958,
  encoderCountsPerRev: 4096,
  servoGearRatio: 1,
  autoScaleTableMap: false,
  maxMoveRatio: 21,
  tablePitchRadiusMm: 572.958,
  padClearanceMm: 5,
  showMoveDistanceOverlay: false,
  showAllProgramMovesOverlay: false,
  showQuadrantReferences: true,
  showAggregateSpacingOverlay: false,
  workspaceView: "standard",
  mapLocked: true,
  mapZoom: 1,
  mapPanX: 0,
  mapPanY: 0,
  previewAngle: 0,
  previewBottleAngle: null,
  isPlaying: false,
  animationSpeed: 10,
  depths: { spender: 1, opRoller: 2, nonOpRoller: 3, wipeInner: 4, wipeOuter: 5 },
  bottleSpecs: [{ id: 1, bottleType: "Bottle A", diameterTargetMm: 60, radiusReductionMm: 0 }],
  labelSpecs: [{ id: 1, brand: "Brand A", bottleType: "Bottle A", applicationMode: "apl", bodyLengthMm: 100, backLengthMm: 80, neckBottomCurveMm: 50, neckBottomCircumferenceMm: 120, codeBoxCenterMm: 10 }],
  selectedBottle: "Bottle A",
  selectedBrand: "Brand A",
  selectedZone: "Zone 1",
  selectedSite: "Site 1",
  buildInputs: { neckApplication: "Center", plateStartPositionDeg: 0, neckSpenderPlateDeg: 90, neckContactMm: 10, bodyContactMm: 10, backContactMm: 10 },
  program: [{ cmd: 3, tableAngle: 0, plateAngle: 0, action: "Rest" }],
  simulation: { useCustom: false, turns: [], rows: [], deletedRows: [], lines: [] },
  mapLibrary: [activeMap],
  applicationMode: "apl",
  activeMapId: "map-1",
  builderHistory: { undo: [], redo: [] }
};

const document = {
  addEventListener(type, handler, options) { listeners.push({ type, handler, options }); },
  querySelectorAll() { return []; },
  querySelector() { return null; }
};
const els = {
  showMoveDistanceOverlay: { checked: false },
  showAllProgramMovesOverlay: { checked: false },
  playPause: { textContent: "Play", setAttribute() {} }
};

const sandbox = {
  window: null,
  globalThis: null,
  state,
  els,
  document,
  Element: FakeElement,
  performance: { now: () => 100 },
  console,
  confirm: () => true,
  setTimeout,
  clearTimeout,
  syncApplicationMapToLegacyState() { calls.syncMap += 1; },
  syncMapPointsFromAssemblies() { calls.syncAssembly += 1; },
  applyGeneratedServoProfile() { calls.regenerate += 1; },
  saveCurrentSettings() { calls.persist += 1; },
  render() { calls.render += 1; },
  renderMap() {},
  renderSimulationMap() {},
  renderAnimationFrame() {},
  renderWipeDownBuilder() { calls.builder += 1; },
  renderAssemblyEditor() { calls.assembly += 1; },
  nextId(rows) { return Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1; },
  normalizeLabelApplicationMode(value) { return value === "cold-glue" ? "cold-glue" : "apl"; },
  ensureSelectedBrandForApplication() {},
  ensureBottleReferenceForLabel() {},
  ensureSelectedZoneAndSite() {},
  selectedLabelSpec() { return state.labelSpecs.find((row) => row.brand === state.selectedBrand); },
  bodyCircumference(bottle) { return Number(bottle?.diameterTargetMm || 0) * Math.PI; },
  degFromMm(mm, circumference) { return Number(mm || 0) / Math.max(0.001, Number(circumference || 0)) * 360; },
  editableMachineMap() { return activeMap; },
  normalizeColdGlueMap(objects) { return objects; },
  normalizeBuilderObject(item) { return item; },
  loadMachineMapIntoRuntime() { calls.loadMap += 1; },
  clearServoSimulationForSelectedMap() {},
  programSegments(rows = state.program) { return rows; },
  roundedServoExportRow(row) { return row; },
  heads() { return []; },
  LabelerAnimationRuntime: { resetClock() {} }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

sources.forEach(([file, source]) => {
  assert.doesNotThrow(() => vm.runInContext(source, sandbox, { filename: file }), `${file} must load without syntax or dependency errors.`);
});

assert.ok(sandbox.LabelerWorkspaceActionService);
assert.ok(sandbox.LabelerSettingsController);
assert.ok(sandbox.LabelerMapController);
assert.ok(sandbox.LabelerSpecsController);
assert.ok(sandbox.LabelerBuildInputsController);
assert.ok(sandbox.LabelerTabsController);
assert.ok(sandbox.LabelerTransferController);
assert.ok(sandbox.LabelerSimulationController);
assert.ok(sandbox.LabelerApplicationController);
assert.strictEqual(sandbox.LabelerSetupEventControllers.installed, true);

sandbox.LabelerWorkspaceActionService.render(["all", "builder", "assembly"]);
assert.strictEqual(calls.render, 1);
assert.strictEqual(calls.builder, 1);
assert.strictEqual(calls.assembly, 1);

sandbox.LabelerSettingsController.setMapSetting("headCount", 48);
assert.strictEqual(state.headCount, 48);
assert.strictEqual(calls.syncMap, 1);
assert.strictEqual(calls.persist, 1);

sandbox.LabelerSpecsController.updateBottle(0, "bottleType", "Bottle B");
assert.strictEqual(state.selectedBottle, "Bottle B");
assert.strictEqual(state.labelSpecs[0].bottleType, "Bottle B");

sandbox.LabelerBuildInputsController.updateField("neckSpenderPlateDeg", 95);
assert.strictEqual(state.buildInputs.neckSpenderPlateDeg, 95);

sandbox.LabelerApplicationController.setMode("cold-glue");
assert.strictEqual(state.applicationMode, "cold-glue");
assert.strictEqual(activeMap.applicationMode, "cold-glue");
assert.ok(calls.loadMap >= 1);

sandbox.LabelerSimulationController.loadGeneratedTurns();
assert.strictEqual(state.simulation.useCustom, true);
assert.deepStrictEqual(Array.from(state.simulation.turns), [0]);

const registeredTypes = new Set(listeners.map((entry) => entry.type));
["change", "input", "focusin", "submit", "click", "wheel", "pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((type) => {
  assert.ok(registeredTypes.has(type), `Delegated controller boundary must register ${type}.`);
});

let previousIndex = -1;
controllerPaths.forEach((file) => {
  const index = bootstrapSource.indexOf(file);
  assert.ok(index > previousIndex, `${file} must load in controller dependency order.`);
  previousIndex = index;
});
assert.ok(bootstrapSource.indexOf("app/controllers/setup-event-controller-integration.js") < bootstrapSource.indexOf("app/startup-runtime.js"));

console.log("Setup event controller ownership regression passed.");