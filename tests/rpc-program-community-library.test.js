"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const editorSource = fs.readFileSync(path.join(root, "app/controllers/simulation-editor-controller.js"), "utf8");
const community = fs.readFileSync(path.join(root, "app/community-library-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

const calls = [];
const state = {
  activeMapId: "map-1",
  selectedBrand: "Brand A",
  selectedBottle: "Bottle A",
  applicationMode: "cold-glue",
  mapLibrary: [{ id: "map-1", name: "Map A" }],
  servoProfileLibrary: [],
  simulation: {
    useCustom: true,
    draftName: "Line 4 neck RPC",
    draftDescription: "Validated full-wrap trial",
    turns: [1],
    rows: [{ hmi: 1 }],
    deletedRows: [],
    lines: [{ angle: 12 }]
  }
};
const context = {
  console,
  Date,
  Math,
  JSON,
  crypto: { randomUUID: () => "test-rpc" },
  CustomEvent: class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  },
  document: { querySelector() { return null; } },
  state,
  LabelerWorkspaceActionService: {
    call(name, value) {
      if (name === "activeMachineMap") return state.mapLibrary[0];
      if (name === "deepClone") return JSON.parse(JSON.stringify(value));
      return undefined;
    },
    execute(options = {}) {
      const result = options.mutate?.();
      if (options.persist) calls.push("save");
      return result;
    },
    number(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    render() {}
  },
  LabelerLocalPersistenceController: { flush() { calls.push("flush"); } },
  dispatchEvent(event) { calls.push(event.type); },
  alert() {},
  confirm() { return true; }
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(editorSource, context);

const saved = context.LabelerSimulationEditorController.saveProfile(
  "Line 4 neck RPC",
  "Validated full-wrap trial"
);
assert.equal(saved.id, "rpc-test-rpc");
assert.equal(saved.name, "Line 4 neck RPC");
assert.equal(saved.mapName, "Map A");
assert.equal(saved.simulation.lines[0].angle, 12);
assert.deepEqual(calls, ["save", "flush", "servoforge:rpc-program-saved"],
  "RPC program must persist locally before opening the optional Community upload.");

for (const required of [
  'value="rpc_program"', "RPC Programs", "servoforge:rpc-program-saved",
  "payload.rpcProgram", "source.servoProfileLibrary"
]) assert.ok(community.includes(required), `RPC Community behavior missing: ${required}`);

assert.ok(bootstrap.includes('"app/controllers/simulation-editor-controller.js"'));
assert.ok(!bootstrap.includes('"app/rpc-program-library-integration.js"'),
  "Bootstrap must not load a competing RPC profile controller.");
assert.ok(!sw.includes("./app/rpc-program-library-integration.js"),
  "The removed duplicate controller must not remain in the offline cache.");
console.log("RPC Program local library and Community handoff regression passed.");
