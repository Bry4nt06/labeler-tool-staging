"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const mapSchema = require("../drivers/map/map-schema-driver.js");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const objects = [1, 2, 3, 4, 5, 6].flatMap((station) => [
  { id: "pad-" + station + "-outer", name: "Station " + station + " Outside", kind: "pad", application: "apl", station, side: "outer", start: station * 40, end: station * 40 + 12 },
  { id: "pad-" + station + "-inner", name: "Station " + station + " Inside", kind: "pad", application: "apl", station, side: "inner", start: station * 40 + 14, end: station * 40 + 26 }
]);
const map = {
  id: "six-station-apl-pads",
  applicationMode: "apl",
  headCount: 45,
  stationCount: 6,
  aggregateCount: 6,
  enabledStations: [true, true, true, true, true, true],
  enabledAggregates: [true, true, true, true, true, true],
  stationSections: {},
  stationAngles: { "1": 40, "2": 80, "3": 120, "4": 160, "5": 200, "6": 240 },
  aggregateAngles: { "1": 40, "2": 80, "3": 120, "4": 160, "5": 200, "6": 240 },
  machineSettings: {},
  depths: {},
  objects
};
const defaultAssemblies = [1, 2, 3, 4, 5, 6].map((station) => ({
  station,
  spenderAngle: station * 40,
  enabled: false,
  type: "none",
  sides: [],
  innerRollerAngles: [0, 0],
  outerRollerAngles: [0, 0],
  padSpanDeg: 12,
  padSideOffsetDeg: 2
}));
const state = {
  mapLibrary: [map],
  activeMapId: map.id,
  applicationMode: "apl",
  headCount: 45,
  direction: "ccw",
  radius: 250,
  referencePitchRadiusMm: 573,
  encoderCountsPerRev: 10000,
  servoGearRatio: 1,
  autoScaleTableMap: true,
  zeroAngle: 0,
  maxMoveRatio: 21,
  depths: {},
  padClearanceMm: 2,
  assemblies: [],
  aplMapObjects: [],
  coldGlueMap: [],
  selectedBrand: "Pad Neck Label",
  selectedBottle: "Bottle",
  labelSpecs: [{ brand: "Pad Neck Label", bottleType: "Bottle", applicationMode: "apl", neckLengthMm: 50, neckBottomCurveMm: 50, bodyLengthMm: 70, backLengthMm: 60 }],
  mapPoints: [],
  program: [],
  motionPlan: { profileKind: "apl-map-driven" }
};
const sandbox = {
  console,
  Math,
  Number,
  state,
  defaultAssemblies,
  els: {},
  LabelerDriverRegistry: { register() {} },
  LabelerAplProfileDriver: { stationWindows: {} },
  ensurePersistentApplicationMaps() {},
  mapLocationFor: () => ({ zone: "", site: "" }),
  inferredMachineMapApplicationMode: () => "apl",
  normalizeBuilderObject: (item) => ({ ...item }),
  activeAplStationNumbers: () => [1, 2, 3, 4, 5, 6],
  inferAplStationSections: mapSchema.inferAplStationSections,
  isStationEnabled: mapSchema.isStationEnabled,
  mmToTableDegrees: (value) => value,
  num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  norm: (value) => ((Number(value) % 360) + 360) % 360,
  ensureSelectedBrandForApplication() {},
  selectedLabelSpec: () => state.labelSpecs[0],
  programSegments: () => [],
  sectionWipePlan: () => ({ wipeAllowance: 1 }),
  fmt: (value) => String(value),
  render() {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("drivers/assembly/assembly-model-driver.js"), sandbox, { filename: "assembly-model-driver.js" });
sandbox.normalizeAssembly = sandbox.LabelerAssemblyModelDriver.normalizeAssembly;
vm.runInContext(read("app/map-runtime-service.js"), sandbox, { filename: "map-runtime-service.js" });
vm.runInContext(read("app/label-station-planning-service.js"), sandbox, { filename: "label-station-planning-service.js" });
sandbox.syncApplicationMapToLegacyState();

const station1 = state.assemblies.find((assembly) => Number(assembly.station) === 1);
assert.ok(station1, "Station 1 must be represented in the runtime assembly model");
assert.deepEqual(Array.from(station1.sides).sort(), ["inner", "outer"]);
assert.equal(station1.labelSection, "neck", "Station 1 wipe-down pads must be classified as Neck hardware");
assert.equal(sandbox.selectedLabelApplicationState().neck, true, "the active Neck label must remain detected");
assert.equal(sandbox.stationIsOperational(station1), true, "Station 1 pad hardware must be available to the neck wipe planner");

vm.runInContext(read("app/validation.js"), sandbox, { filename: "validation.js" });
const messages = sandbox.validate().map((entry) => entry[1]);
assert.equal(
  messages.includes("Neck label is present, but neither neck wipe-down station is installed. No complete wipe-down can occur."),
  false,
  "installed Station 1 pads must suppress the missing neck wipe-down warning"
);
assert.doesNotMatch(
  read("app/apl-neck-pad-center-tack-integration.js"),
  /window\\.inferAplStationSections\\s*=(?!=)/,
  "the neck-pad integration must not replace the map-schema driver's station-section owner"
);

console.log("APL Station 1 wipe-down pad detection regression passed.");
