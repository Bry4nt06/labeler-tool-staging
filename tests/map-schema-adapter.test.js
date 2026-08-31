"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const driverSource = fs.readFileSync(path.join(root, "drivers/map/map-schema-driver.js"), "utf8");
const adapterSource = fs.readFileSync(path.join(root, "app/map-schema-adapter-integration.js"), "utf8");

const standardDepths = {
  spender: 12,
  coding: 14,
  sensor: 21,
  gripper: 12,
  opRoller: 14,
  nonOpRoller: -18,
  wipeInner: -4,
  wipeOuter: 16,
  brushInner: -16,
  brushOuter: 16
};

const sandbox = {
  console,
  Date,
  Math,
  // Simulate the legacy default object table still carrying the former -4
  // brush depth. The map-schema authority must override it to -16 for all new
  // machine maps until every legacy caller has been retired.
  LabelerDefaultObjectDepths: Object.freeze({ ...standardDepths, brushInner: -4 }),
  state: {
    mapLibrary: [{ name: "Map" }],
    headCount: 45,
    radius: 250,
    referencePitchRadiusMm: 572.958,
    encoderCountsPerRev: 10000,
    servoGearRatio: 1,
    zeroAngle: 0,
    maxMoveRatio: 21,
    // Simulate a user changing the active map before creating another map.
    depths: {
      spender: 99,
      coding: 98,
      sensor: 97,
      gripper: 96,
      opRoller: 95,
      nonOpRoller: -95,
      wipeInner: -94,
      wipeOuter: 94,
      brushInner: -93,
      brushOuter: 93
    }
  },
  defaultAplAggregateAngles: () => ({ "1": 10, "2": 20, "3": 30, "4": 40, "5": 50, "6": 60 }),
  defaultAplStationAngles: () => ({ "1": 10, "2": 20, "3": 30, "4": 40, "5": 50, "6": 60 }),
  defaultAplMapObjects: () => [],
  deepClone: (value) => JSON.parse(JSON.stringify(value)),
  mapLocationFor: () => ({ zone: "Zone", site: "Site" }),
  LabelerDriverRegistry: {
    register() {},
    resolve(name) { return name === "map.schema" ? sandbox.LabelerMapSchemaDriver : null; }
  },
  uniqueMapName: () => "legacy",
  normalizeBuilderObject: () => ({ legacy: true }),
  createMachineMap: () => ({ legacy: true })
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(driverSource, sandbox);
vm.runInContext(adapterSource, sandbox);

assert.equal(sandbox.uniqueMapName("Map"), "Map 2");
assert.equal(sandbox.normalizeBuilderObject({ kind: "sensor", angle: 25 }, "apl", 6).end, 28);
const map = sandbox.createMachineMap({ id: "map-1", applicationMode: "cold-glue", objects: [] });
assert.equal(map.schemaVersion, 11);
assert.equal(map.zone, "Zone");
assert.equal(map.site, "Site");
assert.deepEqual(JSON.parse(JSON.stringify(map.depths)), standardDepths,
  "a new map must start from standard object depths, including inside brush depth -16, not the active map's user-edited depths");
assert.equal(map.depths.brushInner, -16);

const savedMap = sandbox.createMachineMap({
  id: "saved-map",
  applicationMode: "cold-glue",
  objects: [],
  depths: { ...standardDepths, sensor: 33, brushOuter: 27, brushInner: -22 }
});
assert.equal(savedMap.depths.sensor, 33, "explicit depths stored on an existing/imported map remain loadable");
assert.equal(savedMap.depths.brushOuter, 27, "user depth overrides remain map-specific");
assert.equal(savedMap.depths.brushInner, -22, "an explicitly saved inside brush depth remains map-specific");
assert.equal(sandbox.LabelerMapSchemaAdapter.driver, "map.schema");
assert.ok(sandbox.LabelerMapSchemaAdapter.functions.includes("inferAplStationSections"));
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.LabelerMapSchemaAdapter.standardObjectDepths())), standardDepths);

console.log("Map schema adapter regressions passed.");
