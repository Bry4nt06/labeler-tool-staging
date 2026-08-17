"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const serviceSource = fs.readFileSync(path.join(root, "app/map-builder-slot-service.js"), "utf8");
const actionSource = fs.readFileSync(path.join(root, "app/controllers/map-builder-action-controller.js"), "utf8");
const eventSource = fs.readFileSync(path.join(root, "app/controllers/map-builder-event-controller.js"), "utf8");
const loaderSource = fs.readFileSync(path.join(root, "app/wipe-down-builder.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(serviceSource, { filename: "map-builder-slot-service.js" }));
assert.match(eventSource, /target\.dataset\?\.machineSlot/,
  "Map Builder change ownership must inspect aggregate/station slot controls");
assert.match(eventSource, /builder\.setMachineSlot\(machineSlot, slotNumber, Boolean\(target\.checked\)\)/,
  "slot checkbox changes must dispatch to the Map Builder action controller");
assert.match(loaderSource, /app\/map-builder-slot-service\.js/,
  "slot service must load as part of Map Builder startup");
assert.ok(
  loaderSource.indexOf("app/map-builder-slot-service.js") < loaderSource.indexOf("app/controllers/map-builder-action-controller.js"),
  "slot service must load before the action/event controllers"
);
assert.match(loaderSource, /map-builder-slot-authority-v135/,
  "Map Builder must cross a fresh cache boundary for the slot fix");

const machineMap = {
  id: "cold-glue-slot-map",
  applicationMode: "cold-glue",
  aggregateCount: 1,
  stationCount: 1,
  enabledAggregates: [true, false, false, false, false, false],
  enabledStations: [true, false, false, false, false, false],
  aggregateAngles: { "1": 75, "2": 153 },
  spenderPlateAngles: { "1": 75, "2": 153 },
  objects: []
};

const history = [];
let runtimeLoads = 0;
let refreshes = 0;
let builderRenders = 0;
const status = { textContent: "", classList: { remove() {} } };

const sandbox = {
  console,
  window: null,
  document: {
    querySelector(selector) {
      return selector === "#builderStatus" ? status : null;
    }
  },
  editableMachineMap: () => machineMap,
  normalizeEnabledSlots(value, fallbackCount = 1) {
    const source = Array.isArray(value) ? value : [];
    const fallback = Math.max(1, Math.min(6, Math.round(Number(fallbackCount) || 1)));
    const slots = Array.from({ length: 6 }, (_, index) => source.length ? Boolean(source[index]) : index < fallback);
    if (!slots.some(Boolean)) slots[0] = true;
    return slots;
  },
  normalizeAggregateAngles(value) { return { ...(value || {}) }; },
  normalizeSpenderPlateAngles(value) { return { ...(value || {}) }; },
  recordBuilderHistory(label) { history.push(label); },
  loadMachineMapIntoRuntime(map, shouldRender) {
    assert.equal(map, machineMap);
    assert.equal(shouldRender, false);
    runtimeLoads += 1;
  },
  refreshAfterBuilderEdit(options) {
    assert.deepEqual(options, { persist: true, structural: true });
    refreshes += 1;
  },
  renderWipeDownBuilder() { builderRenders += 1; },
  LabelerWorkspaceActionService: {
    call() { throw new Error("slot service should own machine-slot mutations"); }
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(serviceSource, sandbox);
vm.runInContext(actionSource, sandbox);

const actions = sandbox.LabelerMapBuilderActionController;
assert.equal(actions.setMachineSlot("aggregate", 2, true), true);
assert.deepEqual(machineMap.enabledAggregates, [true, true, false, false, false, false]);
assert.equal(machineMap.aggregateCount, 2);
assert.equal(status.textContent, "Aggregate 2 enabled.");

assert.equal(actions.setMachineSlot("station", 3, true), true);
assert.deepEqual(machineMap.enabledStations, [true, false, true, false, false, false]);
assert.equal(machineMap.stationCount, 2);
assert.equal(status.textContent, "Station 3 enabled.");

assert.equal(actions.setMachineSlot("aggregate", 1, false), true);
assert.deepEqual(machineMap.enabledAggregates, [false, true, false, false, false, false]);
assert.equal(machineMap.aggregateCount, 1);

assert.equal(actions.setMachineSlot("aggregate", 2, false), false,
  "the final active aggregate must not be removable");
assert.deepEqual(machineMap.enabledAggregates, [false, true, false, false, false, false]);
assert.equal(machineMap.aggregateCount, 1);
assert.match(status.textContent, /At least one aggregate/);

assert.equal(runtimeLoads, 3, "successful slot edits must reload the active runtime immediately");
assert.equal(refreshes, 3, "successful slot edits must regenerate dependent outputs immediately");
assert.equal(builderRenders, 4, "three successful edits plus one rejected final-slot removal rerender the builder");
assert.equal(history.length, 3);

console.log("Map Builder machine-slot v135 regression passed.");
