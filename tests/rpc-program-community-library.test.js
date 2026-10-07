"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const editorSource = fs.readFileSync(path.join(root, "app/controllers/simulation-editor-controller.js"), "utf8");
const community = fs.readFileSync(path.join(root, "app/community-library-integration.js"), "utf8");
const communityV103 = fs.readFileSync(path.join(root, "app/community-library-v103-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const customPrograms = fs.readFileSync(path.join(root, "app/custom-programs-community-integration.js"), "utf8");
const simulationRenderer = fs.readFileSync(path.join(root, "app/simulation-table-renderer.js"), "utf8");
const setupEvents = fs.readFileSync(path.join(root, "app/controllers/setup-event-controller-integration.js"), "utf8");
const cart = fs.readFileSync(path.join(root, "app/community-library-cart-integration.js"), "utf8");
const topActions = fs.readFileSync(path.join(root, "app/top-action-icons-integration.js"), "utf8");

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
  'value="rpc_program"', "Custom Programs", "servoforge:rpc-program-saved",
  "payload.rpcProgram", "source.servoProfileLibrary"
]) assert.ok(community.includes(required), `RPC Community behavior missing: ${required}`);

for (const required of [
  "ServoForge Servo Program", ".sfservo", "communityCustomLocalProgram",
  "loadCommunityPrograms", 'type: "rpc_program"', "importPackage",
  "data-custom-program-preview", "data-custom-program-import", "data-community-cart-add",
  "bindDelegatedEvents"
]) assert.ok(customPrograms.includes(required), `Custom Program behavior missing: ${required}`);

assert.ok(community.includes('item?.type !== "rpc_program"'),
  "Normal Community Browse must exclude custom servo programs.");
assert.ok(simulationRenderer.includes('id="simulationBrandSelect"'),
  "Servo Simulation must expose an in-place Brand selector.");
assert.ok(simulationRenderer.includes('id="simulationBottleSelect"'),
  "Servo Simulation must expose an in-place Bottle selector.");
assert.ok(setupEvents.includes('target.id === "simulationBrandSelect"'));
assert.ok(setupEvents.includes('target.id === "simulationBottleSelect"'));
assert.ok(editorSource.includes("selectContextBrand"));
assert.ok(editorSource.includes("selectContextBottle"));
assert.ok(bootstrap.includes('"app/custom-programs-community-integration.js"'));
assert.ok(sw.includes("./app/custom-programs-community-integration.js"));
assert.ok(cart.includes('button?.closest?.("[data-community-package-id]")'),
  "Community cart must accept Custom Program cards.");
assert.ok(cart.includes("community-batch-cart-v3-20261004-custom-programs"));
for (const required of [
  "selectedRpcUploadProgram",
  "validateRpcUploadProgram",
  "payload: { rpcProgram: clone(rpcProgram) }",
  "RPC upload preparation failed"
]) assert.ok(communityV103.includes(required), `RPC upload handoff regression missing: ${required}`);

assert.ok(community.includes('rpcProgram: type === "rpc_program" ? sanitize(current.rpcProgram) : undefined'),
  "Base Community uploader must send the selected RPC program explicitly.");
assert.ok(communityV103.includes('rpcProgram: type === "rpc_program" ? library.sanitize(current.rpcProgram) : undefined'),
  "V103 Community uploader must send the selected RPC program explicitly.");

assert.ok(topActions.includes('if (type === "rpc_program")'),
  "Top-action Community fallback must recognize Custom RPC packages.");
assert.ok(topActions.includes('return library.currentPackage("rpc_program")'),
  "Top-action Community fallback must delegate RPC payload construction to the Community library.");
assert.ok(topActions.includes('rpcProgram: form.elements.type.value === "rpc_program"'),
  "Top-action Community fallback must send the selected RPC program explicitly.");
assert.ok(!topActions.includes('A Complete Setup requires a Machine Map, Bottle spec, and Brand / Label spec.'),
  "Top-action Community fallback must not route unknown types through the retired Complete Setup package path.");
assert.ok(bootstrap.includes('"app/controllers/simulation-editor-controller.js"'));
assert.ok(!bootstrap.includes('"app/rpc-program-library-integration.js"'),
  "Bootstrap must not load a competing RPC profile controller.");
assert.ok(!sw.includes("./app/rpc-program-library-integration.js"),
  "The removed duplicate controller must not remain in the offline cache.");
console.log("RPC Program local library and Community handoff regression passed.");
