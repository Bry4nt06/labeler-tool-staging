"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const controllerSource = fs.readFileSync(path.join(root, "app/controllers/build-inputs-controller.js"), "utf8");
const label = { brand: "Wrap Test", neckWrapType: "auto" };
const executions = [];
const context = {
  console,
  state: {
    selectedBrand: label.brand,
    labelSpecs: [label],
    bottleSpecs: [],
    buildInputs: {}
  }
};
context.window = context;
context.LabelerGeometryDriver = {
  normalizeNeckWrapType(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    return normalized === "full-wrap" || normalized === "full-wrap-overlap" ? "full-wrap-overlap" : normalized === "standard" ? "standard" : "auto";
  },
  normalizeOverlapEdge(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    return normalized.startsWith("leading") ? "leading" : normalized.startsWith("trailing") ? "trailing" : null;
  }
};
context.LabelerWorkspaceActionService = {
  call(name) {
    if (name === "selectedLabelSpec") return label;
    return null;
  },
  number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  execute(options) {
    executions.push(options);
    options.mutate();
    return true;
  }
};
vm.createContext(context);
vm.runInContext(controllerSource, context, { filename: "build-inputs-controller.js" });

const controller = context.LabelerBuildInputsController;
assert.ok(controller);
assert.equal(controller.updateNeckWrapSetting("wrapType", "Full Wrap"), true);
assert.equal(label.neckWrapType, "full-wrap-overlap");
assert.equal(controller.updateNeckWrapSetting("overlapEdge", "Trailing Edge"), true);
assert.equal(label.neckOverlapEdge, "trailing");
assert.equal(controller.updateNeckWrapSetting("overlapTargetMm", "14.25"), true);
assert.equal(label.neckOverlapTargetMm, 14.25);
assert.equal(controller.updateNeckWrapSetting("overlapTargetMm", ""), true);
assert.equal(label.neckOverlapTargetMm, null, "blank target must restore automatic geometry");
assert.equal(controller.updateNeckWrapSetting("seamWipeEnabled", false), true);
assert.equal(label.neckSeamWipeEnabled, false);
assert.equal(controller.updateNeckWrapSetting("seamOverWipeDeg", "7.5"), true);
assert.equal(label.neckSeamOverWipeDeg, 7.5);
assert.equal(controller.updateNeckWrapSetting("seamOverWipeDeg", "100"), true);
assert.equal(label.neckSeamOverWipeDeg, 45);
assert.ok(executions.every((entry) => entry.syncMap && entry.regenerate && entry.persist && entry.render === "all"));

console.log("Neck-wrap Build Inputs controller persistence and regeneration regression passed.");
