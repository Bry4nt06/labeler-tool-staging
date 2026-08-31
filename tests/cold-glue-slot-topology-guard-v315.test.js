"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/cold-glue-slot-topology-guard-v315.js"), "utf8");
assert.doesNotThrow(() => new vm.Script(source, { filename: "cold-glue-slot-topology-guard-v315.js" }));

const map = {
  id: "eli-mab1",
  applicationMode: "cold-glue",
  aggregateCount: 3,
  stationCount: 3,
  enabledAggregates: [true, false, true, false, true, false],
  enabledStations: [true, false, true, false, true, false],
  localStructuralMapOverride: true
};

const state = { coldGlueAggregateSettings: null };
let throwFromLegacy = false;
function legacyGripperSequenceWrapper() {
  // Reproduce the retired ownership collision: infer enabled topology only from
  // currently populated Station 1 objects while the operator has selected 1/3/5.
  map.enabledAggregates = [true, false, false, false, false, false];
  map.enabledStations = [true, false, false, false, false, false];
  map.aggregateCount = 1;
  map.stationCount = 1;
  if (throwFromLegacy) throw new Error("legacy generator failure");
  return [{ hmi: 1, cmd: 3 }];
}
legacyGripperSequenceWrapper.coldGlueThreeGripperWrappedV2 = true;
legacyGripperSequenceWrapper.originalGenerator = function baseColdGlueProfile() {};

function legacyGripperChannelWrapper(...args) {
  return legacyGripperSequenceWrapper(...args);
}
legacyGripperChannelWrapper.coldGlueGripperChannelWrapped = true;
legacyGripperChannelWrapper.originalGenerator = legacyGripperSequenceWrapper;

const sandbox = {
  console,
  window: null,
  state,
  activeMachineMap: () => map,
  generatedColdGlueFixedProfile: legacyGripperChannelWrapper,
  normalizeEnabledSlots(value, fallbackCount = 1) {
    const sourceSlots = Array.isArray(value) ? value : [];
    const fallback = Math.max(1, Math.min(6, Math.round(Number(fallbackCount) || 1)));
    const slots = Array.from({ length: 6 }, (_, index) => sourceSlots.length ? Boolean(sourceSlots[index]) : index < fallback);
    if (!slots.some(Boolean)) slots[0] = true;
    return slots;
  },
  LabelerMapBuilderSlotService: {
    mirrorColdGlueTopology(machineMap) {
      state.coldGlueAggregateSettings = {
        enabledAggregates: [...machineMap.enabledAggregates],
        enabledStations: [...machineMap.enabledStations]
      };
    }
  },
  setInterval() { throw new Error("guard should install immediately once both legacy wrappers exist"); },
  clearInterval() {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

assert.equal(sandbox.generatedColdGlueFixedProfile.coldGlueSlotTopologyGuardV315, true);
assert.equal(sandbox.ServoForgeColdGlueSlotTopologyGuard.installed, true);
assert.equal(sandbox.ServoForgeColdGlueSlotTopologyGuard.coldGlueGeneratorStackReady(legacyGripperChannelWrapper), true);

const rows = sandbox.generatedColdGlueFixedProfile();
assert.equal(rows.length, 1);
assert.deepEqual(Array.from(map.enabledAggregates), [true, false, true, false, true, false]);
assert.deepEqual(Array.from(map.enabledStations), [true, false, true, false, true, false]);
assert.equal(map.aggregateCount, 3);
assert.equal(map.stationCount, 3);
assert.equal(map.localStructuralMapOverride, true);
assert.deepEqual(Array.from(state.coldGlueAggregateSettings.enabledAggregates), [true, false, true, false, true, false]);
assert.deepEqual(Array.from(state.coldGlueAggregateSettings.enabledStations), [true, false, true, false, true, false]);

throwFromLegacy = true;
assert.throws(() => sandbox.generatedColdGlueFixedProfile(), /legacy generator failure/);
assert.deepEqual(Array.from(map.enabledAggregates), [true, false, true, false, true, false],
  "topology must restore in finally even when an inner legacy generator fails");
assert.deepEqual(Array.from(map.enabledStations), [true, false, true, false, true, false]);

console.log("Cold Glue sparse topology generator guard v315 regression passed.");
