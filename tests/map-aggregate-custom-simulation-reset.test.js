"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "..", "app", "map-builder-slot-service.js"),
  "utf8"
);

function fixture() {
  const events = [];
  const map = {
    id: "three-aggregate-map",
    applicationMode: "apl",
    aggregateCount: 3,
    stationCount: 3,
    enabledAggregates: [true, false, true, false, true, false],
    enabledStations: [true, false, true, false, true, false],
    aggregateAngles: { 1: 68.5, 3: 148.5, 5: 238.5 },
    objects: []
  };
  const state = {
    simulation: {
      useCustom: true,
      turns: [{ tableAngle: 112, plateAngle: 0 }],
      rows: [{ cmd: 7 }],
      deletedRows: [2],
      lines: [{ cmd: 7, action: "Custom correction" }]
    },
    servoProfileLibrary: [{ id: "saved-rpc", name: "Saved RPC" }]
  };
  const context = {
    console,
    state,
    document: { querySelector() { return null; } },
    editableMachineMap: () => map,
    normalizeEnabledSlots(value, fallbackCount = 1) {
      const sourceSlots = Array.isArray(value) ? value : [];
      return Array.from({ length: 6 }, (_, index) =>
        sourceSlots.length ? Boolean(sourceSlots[index]) : index < fallbackCount);
    },
    normalizeAggregateAngles: value => ({ ...(value || {}) }),
    normalizeSpenderPlateAngles: value => ({ ...(value || {}) }),
    recordBuilderHistory: label => events.push(["history", label]),
    refreshAfterBuilderEdit() {
      events.push(["refresh", state.simulation.useCustom]);
    },
    renderWipeDownBuilder() { events.push(["render"]); },
    LabelerMapBuilderDomainActions: {
      clearServoSimulationForSelectedMap() {
        events.push(["clear"]);
        state.simulation = { useCustom: false, turns: [], rows: [], deletedRows: [], lines: [] };
      }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "map-builder-slot-service.js" });
  return { context, map, state, events };
}

test("adding an aggregate clears the custom simulation before regenerating", () => {
  const { context, map, state, events } = fixture();

  assert.equal(context.LabelerMapBuilderSlotService.setEnabled("aggregate", 2, true), true);
  assert.deepEqual(Array.from(map.enabledAggregates), [true, true, true, false, true, false]);
  assert.equal(map.aggregateCount, 4);
  assert.equal(state.simulation.useCustom, false);
  assert.deepEqual(Array.from(state.simulation.lines), []);
  assert.deepEqual(events.slice(0, 3), [
    ["history", "Enable Aggregate 2"],
    ["clear"],
    ["refresh", false]
  ]);
  assert.equal(state.servoProfileLibrary.length, 1, "saved RPC programs must not be deleted");
});

test("removing an aggregate also discards the now-stale custom simulation", () => {
  const { context, map, state } = fixture();

  assert.equal(context.LabelerMapBuilderSlotService.setEnabled("aggregate", 5, false), true);
  assert.equal(map.aggregateCount, 2);
  assert.equal(state.simulation.useCustom, false);
});

test("station-only and no-op changes do not clear the custom simulation", () => {
  const { context, state, events } = fixture();

  assert.equal(context.LabelerMapBuilderSlotService.setEnabled("aggregate", 1, true), true);
  assert.equal(context.LabelerMapBuilderSlotService.setEnabled("station", 2, true), true);
  assert.equal(state.simulation.useCustom, true);
  assert.equal(events.some(event => event[0] === "clear"), false);
});

