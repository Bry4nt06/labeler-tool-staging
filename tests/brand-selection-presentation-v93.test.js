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
let renderCalls = 0;
let generatedBrand = "";
let visibleBrand = "";
let visibleBottle = "";
let presentations = 0;
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
  LabelerRenderingCoordinator: {
    driver: {
      present(handlers) {
        presentations += 1;
        handlers.renderBuildInputs();
        handlers.renderProgram();
        handlers.renderValidation();
        return ["renderBuildInputs", "renderProgram", "renderValidation"];
      }
    },
    handlers() {
      return {
        renderBuildInputs() {
          visibleBrand = sandbox.state.selectedBrand;
          visibleBottle = sandbox.state.selectedBottle;
        },
        renderProgram() {},
        renderValidation() {}
      };
    }
  },
  labelSpecsForApplication() { return sandbox.state.labelSpecs; },
  selectedLabelSpec() { return sandbox.state.labelSpecs.find((row) => row.brand === sandbox.state.selectedBrand); },
  ensureBottleReferenceForLabel(spec) { if (spec?.bottleType) sandbox.state.selectedBottle = spec.bottleType; },
  applyLabelLengthStationRules() {},
  applyGeneratedServoProfile() { generatedBrand = sandbox.state.selectedBrand; },
  saveCurrentSettings() { saves += 1; },
  render() {
    renderCalls += 1;
    sandbox.state.selectedBrand = "12oz Land Shark (LN)";
    sandbox.state.selectedBottle = "SSNR - 12 Oz";
    visibleBrand = sandbox.state.selectedBrand;
    visibleBottle = sandbox.state.selectedBottle;
    sandbox.state.activeTab = "specs";
  },
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
assert.equal(renderCalls, 0, "Brand selection must not enter full render normalization.");
assert.equal(sandbox.state.selectedBrand, "12oz Bud Light Lime (9F)");
assert.equal(sandbox.state.selectedBottle, "LNNR - 12 Oz");
assert.equal(generatedBrand, "12oz Bud Light Lime (9F)", "Servo Program must regenerate from the requested Brand.");
assert.equal(visibleBrand, "12oz Bud Light Lime (9F)", "Build Inputs must immediately present the requested Brand.");
assert.equal(visibleBottle, "LNNR - 12 Oz", "Build Inputs must immediately present the requested bottle association.");
assert.equal(sandbox.state.activeTab, "buildInputs");
assert.ok(saves >= 2, "The committed recipe must be persisted after generation and presentation.");
assert.ok(presentations >= 1);
assert.equal(typeof raf, "function");
raf();
assert.equal(renderCalls, 0);
assert.equal(visibleBrand, "12oz Bud Light Lime (9F)");
assert.equal(visibleBottle, "LNNR - 12 Oz");
assert.equal(sandbox.state.activeTab, "buildInputs");
assert.ok(presentations >= 2, "Deferred native-select settlement must repaint committed state.");
console.log("Brand selection presentation v93 behavioral regression passed.");
