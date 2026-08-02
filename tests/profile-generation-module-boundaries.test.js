"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const loader = read("app/profile-generation.js");
const legacy = read("app/profile-family-generators-legacy.js");
const routing = read("app/profile-routing.js");
const framing = read("app/machine-profile-framing.js");
const overrides = read("app/servo-overrides.js");
const app = read("app.js");
const serviceWorker = read("service-worker.js");

const expectedModules = [
  "app/profile-family-generators-legacy.js",
  "app/profile-routing.js",
  "app/machine-profile-framing.js",
  "app/servo-overrides.js"
];
expectedModules.forEach((modulePath) => {
  const escaped = modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(loader, new RegExp(escaped));
  assert.match(serviceWorker, new RegExp(escaped));
});

assert.ok(loader.split("\n").length < 80, "profile-generation.js should remain a small loader");
assert.match(loader, /ServoForgeProfileGenerationReady/);
assert.match(app, /await window\.ServoForgeProfileGenerationReady/);
assert.match(app, /await window\.ServoForgeBootstrapReady/);

assert.match(legacy, /function generatedAplSeedProfile\(/);
assert.match(legacy, /function generatedAplTwoLabelProfile\(/);
assert.match(legacy, /function generatedColdGlueFixedProfile\(/);
assert.match(legacy, /function generatedAplMapDrivenProfile\(/);
assert.match(routing, /function generatedServoProfile\(/);
assert.match(framing, /function applyMachineTypeProfileFraming\(/);
assert.match(overrides, /function applyGeneratedServoProfile\(/);
assert.match(overrides, /function servoOverrideProfileKey\(/);
assert.match(overrides, /function setServoAngleOverride\(/);

function context(extra = {}) {
  const sandbox = {
    console,
    window: {},
    ...extra
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

const oldColdGlue = context({
  state: { applicationMode: "cold-glue" }
});
vm.runInContext(legacy, oldColdGlue);
oldColdGlue.generatedColdGlueFixedProfile = () => ["cold-glue"];
const newColdGlue = context({
  state: { applicationMode: "cold-glue" },
  generatedColdGlueFixedProfile: () => ["cold-glue"]
});
vm.runInContext(routing, newColdGlue);
assert.deepEqual(
  JSON.parse(JSON.stringify(oldColdGlue.generatedServoProfile())),
  JSON.parse(JSON.stringify(newColdGlue.generatedServoProfile()))
);

const map = { id: "map-1" };
const oldMapRoute = context({
  state: { applicationMode: "apl" },
  selectedLabelApplicationState: () => ({ neck: true, body: true, back: true }),
  activeMachineMap: () => map
});
vm.runInContext(legacy, oldMapRoute);
oldMapRoute.generatedAplMapDrivenProfile = (value) => [value.id];
const newMapRoute = context({
  state: { applicationMode: "apl" },
  selectedLabelApplicationState: () => ({ neck: true, body: true, back: true }),
  activeMachineMap: () => map,
  generatedAplMapDrivenProfile: (value) => [value.id]
});
vm.runInContext(routing, newMapRoute);
assert.deepEqual(
  JSON.parse(JSON.stringify(oldMapRoute.generatedServoProfile())),
  JSON.parse(JSON.stringify(newMapRoute.generatedServoProfile()))
);

const sampleRows = [
  { cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
  { cmd: 7, tableAngle: 10, plateAngle: 0, action: "Move 1" },
  { cmd: 7, tableAngle: 20, plateAngle: 40, action: "Move 2" },
  { cmd: 3, tableAngle: 30, plateAngle: 80, action: "End Curve - Rest", terminalRest: true }
];
const oldFrame = context({ activeMachineMap: () => ({ machineType: "Autocol" }) });
vm.runInContext(legacy, oldFrame);
const newFrame = context({ activeMachineMap: () => ({ machineType: "Autocol" }) });
vm.runInContext(framing, newFrame);
assert.deepEqual(
  JSON.parse(JSON.stringify(oldFrame.applyMachineTypeProfileFraming(sampleRows))),
  JSON.parse(JSON.stringify(newFrame.applyMachineTypeProfileFraming(sampleRows)))
);

function overrideContext(source) {
  const sandbox = context({
    state: {
      activeMapId: "map-1",
      applicationMode: "apl",
      selectedBrand: "brand",
      selectedBottle: "bottle",
      servoOverrides: {
        "map-1|apl|brand|bottle": {
          "0": { tableAngle: 12.5, plateAngle: 22.5 }
        }
      },
      program: []
    },
    generatedServoProfile: () => [{ plc: 0, hmi: 1, cmd: 3, tableAngle: 10, plateAngle: 20 }],
    applyMachineTypeProfileFraming: (rows) => rows,
    num: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
  });
  vm.runInContext(source, sandbox);
  sandbox.generatedServoProfile = () => [{ plc: 0, hmi: 1, cmd: 3, tableAngle: 10, plateAngle: 20 }];
  sandbox.applyMachineTypeProfileFraming = (rows) => rows;
  sandbox.applyGeneratedServoProfile();
  return JSON.parse(JSON.stringify(sandbox.state.program));
}
assert.deepEqual(overrideContext(legacy), overrideContext(overrides));

console.log("Profile generation module boundary regression passed.");
