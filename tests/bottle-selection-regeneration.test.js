"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const controllerSource = fs.readFileSync(
  path.join(root, "app", "controllers", "build-inputs-controller.js"),
  "utf8"
);
const labelServiceSource = fs.readFileSync(
  path.join(root, "app", "label-specification-service.js"),
  "utf8"
);

assert.doesNotThrow(
  () => new vm.Script(controllerSource, { filename: "build-inputs-controller.js" }),
  "Build Inputs controller must parse."
);
assert.doesNotThrow(
  () => new vm.Script(labelServiceSource, { filename: "label-specification-service.js" }),
  "Label specification service must parse."
);

let execution = null;
const calls = [];
const sandbox = {
  window: null,
  globalThis: null,
  state: {
    applicationMode: "apl",
    selectedBrand: "Test Brand",
    selectedBottle: "Bottle A",
    labelSpecs: [
      { applicationMode: "apl", brand: "Test Brand", bottleType: "Bottle A" }
    ],
    bottleSpecs: [
      { id: 1, bottleType: "Bottle A", diameterTargetMm: 60, radiusReductionMm: 0.3 },
      { id: 2, bottleType: "Bottle B", diameterTargetMm: 75, radiusReductionMm: 0.5 }
    ],
    buildInputs: {}
  },
  LabelerWorkspaceActionService: {
    execute(options) {
      execution = options;
      const result = options.mutate?.();
      if (options.regenerate) calls.push("regenerate");
      if (options.persist) calls.push("persist");
      calls.push(`render:${options.render}`);
      return result;
    },
    call() {
      return undefined;
    },
    number(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
  },
  console
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(labelServiceSource, sandbox, { filename: "label-specification-service.js" });
vm.runInContext(controllerSource, sandbox, { filename: "build-inputs-controller.js" });

const result = sandbox.LabelerBuildInputsController.selectBottle("Bottle B");

assert.strictEqual(sandbox.state.selectedBottle, "Bottle B", "Bottle Type selection must update application state.");
assert.strictEqual(execution?.regenerate, true, "Bottle Type selection must regenerate the Servo Program for the new bottle geometry.");
assert.strictEqual(execution?.persist, true, "Bottle Type selection must persist immediately.");
assert.strictEqual(execution?.render, "all", "Bottle Type selection must rerender the full workspace.");
assert.ok(calls.includes("regenerate"));
assert.ok(calls.includes("persist"));
assert.ok(calls.includes("render:all"));
assert.strictEqual(result, undefined);

sandbox.ensureSelectedBrandForApplication();
assert.strictEqual(
  sandbox.state.selectedBottle,
  "Bottle B",
  "The render-preparation brand check must preserve a valid manually selected bottle."
);

execution = null;
const invalidResult = sandbox.LabelerBuildInputsController.selectBottle("Missing Bottle");
assert.strictEqual(invalidResult, false, "Unknown Bottle Type values must be rejected.");
assert.strictEqual(sandbox.state.selectedBottle, "Bottle B", "Rejected Bottle Type values must not overwrite the active selection.");
assert.strictEqual(execution, null, "Rejected Bottle Type values must not persist or rerender.");

console.log("Bottle Type selection regeneration regression passed.");
