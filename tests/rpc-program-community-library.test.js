"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const rpcSource = fs.readFileSync(path.join(root, "app/rpc-program-library-integration.js"), "utf8");
const community = fs.readFileSync(path.join(root, "app/community-library-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

const listeners = {};
const inputs = {
  servoProfileName: { value: "Line 4 neck RPC", focus() {} },
  servoProfileDescription: { value: "Validated full-wrap trial" },
  servoProfileLibrarySelect: { value: "" }
};
const calls = [];
const context = {
  console,
  Date,
  crypto: { randomUUID: () => "test-rpc" },
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  document: {
    addEventListener(type, handler) { listeners[type] = handler; },
    getElementById(id) { return inputs[id] || null; }
  },
  state: {
    activeMapId: "map-1",
    selectedBrand: "Brand A",
    selectedBottle: "Bottle A",
    applicationMode: "cold-glue",
    mapLibrary: [{ id: "map-1", name: "Map A" }],
    servoProfileLibrary: [],
    simulation: { useCustom: true, turns: [1], rows: [{ hmi: 1 }], deletedRows: [], lines: [{ angle: 12 }] }
  },
  activeMachineMap() { return this.state.mapLibrary[0]; },
  saveCurrentSettings() { calls.push("save"); },
  LabelerLocalPersistenceController: { flush() { calls.push("flush"); } },
  renderSimulation() { calls.push("render"); },
  dispatchEvent(event) { calls.push(event.type); },
  alert() {},
  confirm() { return true; }
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(rpcSource, context);

const saved = context.LabelerRpcProgramLibrary.saveProfile();
assert.equal(saved.id, "rpc-test-rpc");
assert.equal(saved.name, "Line 4 neck RPC");
assert.equal(saved.mapName, "Map A");
assert.equal(saved.simulation.lines[0].angle, 12);
assert.deepEqual(calls, ["save", "flush", "render", "servoforge:rpc-program-saved"],
  "RPC program must persist locally before opening the optional Community upload.");

for (const required of [
  'value="rpc_program"', "RPC Programs", "servoforge:rpc-program-saved",
  "payload.rpcProgram", "source.servoProfileLibrary"
]) assert.ok(community.includes(required), `RPC Community behavior missing: ${required}`);

assert.ok(bootstrap.includes('"app/rpc-program-library-integration.js"'));
assert.ok(sw.includes("./app/rpc-program-library-integration.js"));
console.log("RPC Program local library and Community handoff regression passed.");
