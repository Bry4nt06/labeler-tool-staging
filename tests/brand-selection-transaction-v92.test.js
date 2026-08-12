"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const actionSource = fs.readFileSync(path.join(root, "app/controllers/workspace-action-service.js"), "utf8");
const buildSource = fs.readFileSync(path.join(root, "app/controllers/build-inputs-controller.js"), "utf8");
let raf = null;
let saves = 0;
const buttons = { specs: { dataset: { tab: "specs" } }, buildInputs: { dataset: { tab: "buildInputs" } } };
const sandbox = {
  window: null,
  globalThis: null,
  state: {
    activeTab: "buildInputs",
    selectedBrand: "12oz Land Shark (LN)",
    selectedBottle: "SSNR - 12 Oz",
    labelSpecs: [
      { brand: "12oz Land Shark (LN)", applicationMode: "apl", bottleType: "SSNR - 12 Oz" },
      { brand: "12oz Bud Light Lime (9F)", applicationMode: "apl", bottleType: "LNNR - 12 Oz" }
    ],
    bottleSpecs: [{ bottleType: "SSNR - 12 Oz" }, { bottleType: "LNNR - 12 Oz" }],
    buildInputs: {}
  },
  document: {
    querySelector(selector) {
      if (selector === ".tabs .tab.active[data-tab]") return buttons[sandbox.state.activeTab] || null;
      if (selector.includes('data-tab="buildInputs"')) return buttons.buildInputs;
      if (selector.includes('data-tab="specs"')) return buttons.specs;
      return null;
    }
  },
  LabelerTabsController: {
    setDirectTabState(name) { sandbox.state.activeTab = name; return true; }
  },
  labelSpecsForApplication() { return sandbox.state.labelSpecs; },
  selectedLabelSpec() { return sandbox.state.labelSpecs.find((row) => row.brand === sandbox.state.selectedBrand); },
  ensureBottleReferenceForLabel(spec) { if (spec?.bottleType) sandbox.state.selectedBottle = spec.bottleType; },
  applyLabelLengthStationRules() {},
  applyGeneratedServoProfile() { sandbox.state.selectedBrand = "12oz Land Shark (LN)"; },
  saveCurrentSettings() { saves += 1; },
  render() { sandbox.state.activeTab = "specs"; },
  renderBuildInputs() {},
  requestAnimationFrame(callback) { raf = callback; return 1; },
  setTimeout(callback) { callback(); return 1; },
  console, Number, String, Boolean, Object
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(actionSource, sandbox, { filename: "workspace-action-service.js" });
vm.runInContext(buildSource, sandbox, { filename: "build-inputs-controller.js" });
const result = sandbox.LabelerBuildInputsController.selectBrand("12oz Bud Light Lime (9F)");
assert.notStrictEqual(result, false);
assert.equal(sandbox.state.selectedBrand, "12oz Bud Light Lime (9F)");
assert.equal(sandbox.state.selectedBottle, "LNNR - 12 Oz");
assert.equal(sandbox.state.activeTab, "buildInputs");
assert.ok(saves >= 1);
assert.equal(typeof raf, "function");
raf();
assert.equal(sandbox.state.selectedBrand, "12oz Bud Light Lime (9F)");
assert.equal(sandbox.state.activeTab, "buildInputs");
console.log("Brand selection transaction v92 behavioral regression passed.");
