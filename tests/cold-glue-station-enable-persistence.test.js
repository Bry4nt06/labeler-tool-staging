"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/cold-glue-gripper-sequence-integration-v2.js"), "utf8");

function normalize(map) {
  const document = {
    readyState: "complete",
    documentElement: { dataset: {} },
    head: { appendChild() {} },
    querySelector() { return null; },
    createElement() { return {}; },
    addEventListener() {}
  };
  const sandbox = {
    console,
    document,
    state: {},
    CSS: { escape(value) { return String(value); } },
    MutationObserver: class MutationObserver { observe() {} },
    activeMachineMap() { return map; },
    generatedColdGlueFixedProfile() { return []; },
    syncApplicationMapToLegacyState() {},
    saveCurrentSettings() {},
    render() {},
    setTimeout(callback) { callback(); },
    requestAnimationFrame(callback) { callback(); },
    addEventListener() {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "cold-glue-gripper-sequence-integration-v2.js" });
  return map;
}

// Regression: a brush already assigned to Station 1 must not make the Cold
// Glue normalizer turn off Stations 2 and 3 after the operator enables them.
const operatorEnabled = normalize({
  applicationMode: "cold-glue",
  headCount: 60,
  enabledAggregates: [true, true, true, false, false, false],
  enabledStations: [true, true, true, false, false, false],
  aggregateCount: 3,
  stationCount: 3,
  objects: [
    { id: "brush-1", kind: "brush", application: "cold-glue", station: 1, side: "outer", start: 92, end: 125 }
  ]
});
assert.deepEqual(operatorEnabled.enabledStations, [true, true, true, false, false, false],
  "empty Stations 2 and 3 must remain enabled after Cold Glue normalization");
assert.deepEqual(operatorEnabled.enabledAggregates, [true, true, true, false, false, false],
  "operator-enabled aggregates must not be collapsed to only stations containing hardware");
assert.equal(operatorEnabled.stationCount, 3);
assert.equal(operatorEnabled.aggregateCount, 3);

// Hardware may still auto-enable its assigned slot. The normalizer should add
// that slot to the current operator selection instead of replacing it.
const hardwareAutoEnable = normalize({
  applicationMode: "cold-glue",
  headCount: 60,
  enabledAggregates: [true, false, false, false, false, false],
  enabledStations: [true, false, false, false, false, false],
  aggregateCount: 1,
  stationCount: 1,
  objects: [
    { id: "brush-3", kind: "brush", application: "cold-glue", station: 3, side: "inner", start: 165, end: 185 }
  ]
});
assert.deepEqual(hardwareAutoEnable.enabledStations, [true, false, true, false, false, false]);
assert.deepEqual(hardwareAutoEnable.enabledAggregates, [true, false, true, false, false, false]);
assert.equal(hardwareAutoEnable.stationCount, 2);
assert.equal(hardwareAutoEnable.aggregateCount, 2);

console.log("Cold Glue station enable persistence regression passed.");
