"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app/community-library-integration.js"), "utf8");
let uuid = 0;
const calls = { save: 0, flush: 0, present: 0, render: 0 };
const context = {
  console,
  crypto: { randomUUID: () => `batch-${++uuid}` },
  state: { mapLibrary: [], bottleSpecs: [], labelSpecs: [] },
  document: { readyState: "loading", addEventListener() {} },
  saveCurrentSettings() { calls.save += 1; },
  LabelerLocalPersistenceController: { flush() { calls.flush += 1; } },
  LabelerWorkspaceActionService: { present() { calls.present += 1; } },
  render() { calls.render += 1; }
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context);

const packages = [
  {
    name: "Line A",
    configPayload: {
      map: { name: "Line A", machineType: "Rotary" },
      bottle: { bottleType: "Amber 12oz" },
      brand: { brand: "House Label" }
    }
  },
  {
    name: "Line B",
    configPayload: {
      map: { name: "Line B", machineType: "Rotary" },
      bottle: { bottleType: "Amber 12oz" },
      brand: { brand: "House Label" }
    }
  }
];

const result = context.LabelerCommunityLibrary.importPackages(packages, "add");
assert.equal(result.importedCount, 2);
assert.equal(context.state.mapLibrary.length, 2);
assert.equal(context.state.bottleSpecs.length, 2);
assert.equal(context.state.labelSpecs.length, 2);
assert.notEqual(context.state.bottleSpecs[0].bottleType, context.state.bottleSpecs[1].bottleType);
assert.equal(context.state.labelSpecs[1].bottleType, context.state.bottleSpecs[1].bottleType);
assert.deepEqual(calls, { save: 1, flush: 1, present: 1, render: 1 });

console.log("Community Library batch transaction behavior passed.");
