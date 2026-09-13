"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const serviceSource = fs.readFileSync(path.join(root, "app/map-builder-slot-service.js"), "utf8");
const actionSource = fs.readFileSync(path.join(root, "app/controllers/map-builder-action-controller.js"), "utf8");
const eventSource = fs.readFileSync(path.join(root, "app/controllers/map-builder-event-controller.js"), "utf8");
const layoutSource = fs.readFileSync(path.join(root, "app/controllers/map-builder-layout-controller.js"), "utf8");
const loaderSource = fs.readFileSync(path.join(root, "app/wipe-down-builder.js"), "utf8");
const topologyGuardSource = fs.readFileSync(path.join(root, "app/cold-glue-slot-topology-guard-v315.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(serviceSource, { filename: "map-builder-slot-service.js" }));
assert.doesNotThrow(() => new vm.Script(layoutSource, { filename: "map-builder-layout-controller.js" }));
assert.doesNotThrow(() => new vm.Script(topologyGuardSource, { filename: "cold-glue-slot-topology-guard-v315.js" }));
assert.match(eventSource, /target\.dataset\?\.machineSlot/,
  "Map Builder change ownership must inspect aggregate/station slot controls");
assert.match(eventSource, /builder\.setMachineSlot\(machineSlot, slotNumber, Boolean\(target\.checked\)\)/,
  "slot checkbox changes must dispatch to the Map Builder action controller");
assert.match(layoutSource, /LabelerMapBuilderActionController/,
  "the layout fallback must delegate machine-slot changes to the canonical action controller");
assert.doesNotMatch(layoutSource, /editable\.enabledStations\s*=/,
  "the layout controller must not directly rewrite station topology");
assert.doesNotMatch(layoutSource, /editable\.enabledAggregates\s*=/,
  "the layout controller must not directly rewrite aggregate topology");
assert.doesNotMatch(layoutSource, /ensureAplObjectsForNewStations\(/,
  "the layout controller must not run APL station seeding against Cold Glue maps");
assert.match(loaderSource, /app\/map-builder-slot-service\.js/,
  "slot service must load as part of Map Builder startup");
assert.match(loaderSource, /app\/cold-glue-slot-topology-guard-v315\.js/,
  "Map Builder startup must load the explicit Cold Glue topology guard");
assert.match(loaderSource, /aggregate-custom-reset-v334/,
  "Map Builder must cross a fresh cache boundary for the Station 5 object-add fix");
assert.match(bootstrapSource, /app\/map-builder-slot-service\.js/,
  "workspace bootstrap must independently guarantee the canonical slot service before layout controllers install");
assert.ok(
  bootstrapSource.indexOf("app/map-builder-slot-service.js") < bootstrapSource.indexOf("app/controllers/map-builder-action-controller.js"),
  "workspace bootstrap must load the slot service before any machine-slot controller"
);
assert.doesNotMatch(serviceSource, /loadMachineMapIntoRuntime\?\.\(machineMap, false\)/,
  "slot changes must not perform a complete runtime reload immediately before structural regeneration");
assert.match(serviceSource, /mutationActive/,
  "slot mutations must have a synchronous re-entry guard");
assert.match(serviceSource, /mirrorColdGlueTopology/,
  "Cold Glue sparse topology must be mirrored directly into profile-generation state");

const machineMap = {
  id: "cold-glue-slot-map",
  applicationMode: "cold-glue",
  aggregateCount: 1,
  stationCount: 1,
  enabledAggregates: [true, false, false, false, false, false],
  enabledStations: [true, false, false, false, false, false],
  aggregateAngles: { "1": 75, "3": 153, "5": 231 },
  stationAngles: { "1": 75, "3": 153, "5": 231 },
  spenderPlateAngles: { "1": 75, "3": 75, "5": 75 },
  machineSettings: { direction: "ccw" },
  objects: []
};

const history = [];
let refreshes = 0;
let builderRenders = 0;
let aplStationSeeds = 0;
let forceReentry = false;
let reentryResult = null;
const status = { textContent: "", classList: { remove() {} } };

const sandbox = {
  console,
  window: null,
  state: { coldGlueAggregateSettings: null },
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
  ensureAplObjectsForNewStations() { aplStationSeeds += 1; },
  recordBuilderHistory(label) { history.push(label); },
  loadMachineMapIntoRuntime() {
    throw new Error("slot transaction must not call loadMachineMapIntoRuntime");
  },
  refreshAfterBuilderEdit(options) {
    assert.equal(options?.persist, true);
    assert.equal(options?.structural, true);
    refreshes += 1;
    if (forceReentry) {
      forceReentry = false;
      reentryResult = sandbox.LabelerMapBuilderSlotService.setEnabled("station", 5, true);
    }
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

assert.equal(actions.setMachineSlot("aggregate", 3, true), true);
assert.deepEqual(Array.from(machineMap.enabledAggregates), [true, false, true, false, false, false]);
assert.equal(machineMap.aggregateCount, 2);

forceReentry = true;
assert.equal(actions.setMachineSlot("station", 3, true), true);
assert.equal(reentryResult, false, "a structural refresh must not recursively enter another slot mutation");
assert.deepEqual(Array.from(machineMap.enabledStations), [true, false, true, false, false, false]);
assert.equal(machineMap.stationCount, 2);
assert.equal(aplStationSeeds, 0,
  "enabling a Cold Glue station must never invoke APL station-object seeding");

assert.equal(actions.setMachineSlot("aggregate", 5, true), true);
assert.equal(actions.setMachineSlot("station", 5, true), true);
assert.deepEqual(Array.from(machineMap.enabledAggregates), [true, false, true, false, true, false],
  "Aggregate 1/3/5 topology must remain sparse and enabled");
assert.deepEqual(Array.from(machineMap.enabledStations), [true, false, true, false, true, false],
  "Station 1/3/5 topology must remain sparse and enabled");
assert.equal(machineMap.aggregateCount, 3);
assert.equal(machineMap.stationCount, 3);
assert.equal(machineMap.localStructuralMapOverride, true);
assert.deepEqual(Array.from(sandbox.state.coldGlueAggregateSettings.enabledAggregates), [true, false, true, false, true, false]);
assert.deepEqual(Array.from(sandbox.state.coldGlueAggregateSettings.enabledStations), [true, false, true, false, true, false]);

machineMap.objects.push({ id: "brush-3", kind: "brush", application: "cold-glue", station: 3, side: "outer", start: 150, end: 170 });
machineMap.objects.push({ id: "brush-5", kind: "brush", application: "cold-glue", station: 5, side: "inner", start: 230, end: 250 });
assert.deepEqual(Array.from(machineMap.enabledStations), [true, false, true, false, true, false],
  "adding Cold Glue brushes after enabling stations must not collapse sparse station topology");

assert.equal(refreshes, 4, "each successful 1/3/5 slot edit must regenerate once, not reload plus regenerate");
assert.equal(builderRenders, 4, "each successful slot edit rerenders the builder once");
assert.equal(history.length, 4);
assert.equal(status.textContent, "Station 5 enabled.");

console.log("Map Builder sparse Cold Glue 1/3/5 slot transaction regression passed.");
