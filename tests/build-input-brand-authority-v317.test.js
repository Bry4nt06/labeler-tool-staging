"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const serviceSource = fs.readFileSync(path.join(root, "app/label-specification-service.js"), "utf8");
const rendererSource = fs.readFileSync(path.join(root, "app/build-inputs-renderer.js"), "utf8");
const controllerSource = fs.readFileSync(path.join(root, "app/controllers/build-inputs-controller.js"), "utf8");
const specsSource = fs.readFileSync(path.join(root, "app/controllers/specs-controller.js"), "utf8");
const apl = { brand: "APL Brand", applicationMode: "apl", bottleType: "Bottle A" };
const coldGlue = { brand: "Cold Glue Brand", applicationMode: "cold-glue", bottleType: "Bottle B" };
const serviceContext = {
  state: {
    applicationMode: "cold-glue",
    selectedBrand: apl.brand,
    selectedBottle: apl.bottleType,
    labelSpecs: [apl, coldGlue],
    bottleSpecs: [{ bottleType: "Bottle A" }, { bottleType: "Bottle B" }]
  },
  window: null
};
serviceContext.window = serviceContext;
vm.createContext(serviceContext);
vm.runInContext(serviceSource, serviceContext, { filename: "label-specification-service.js" });

assert.equal(serviceContext.labelSpecsForApplication().length, 1,
  "application metadata queries remain available for catalog views");
assert.equal(serviceContext.ensureSelectedBrandForApplication().brand, apl.brand);
assert.equal(serviceContext.state.selectedBrand, apl.brand,
  "loading a Cold Glue map must not replace an existing APL-tagged build recipe");
assert.match(rendererSource, /availableLabels = Array\.isArray\(state\.labelSpecs\) \? state\.labelSpecs : \[\]/);
assert.doesNotMatch(rendererSource, /const availableLabels = labelSpecsForApplication\(\)/);
assert.match(controllerSource, /const available = state\.labelSpecs \|\| \[\]/);

const calls = [];
const specsContext = {
  console,
  confirm: () => true,
  state: { selectedBrand: apl.brand, selectedBottle: apl.bottleType, labelSpecs: [apl], bottleSpecs: [] },
  LabelerWorkspaceActionService: {
    call(name, value) {
      calls.push(name);
      if (name === "normalizeLabelApplicationMode") return String(value).toLowerCase() === "cold glue" ? "cold-glue" : value;
      return null;
    },
    execute(options) {
      options.mutate();
      calls.push({ regenerate: options.regenerate });
      return true;
    }
  },
  window: null
};
specsContext.window = specsContext;
vm.createContext(specsContext);
vm.runInContext(specsSource, specsContext, { filename: "specs-controller.js" });
specsContext.LabelerSpecsController.updateLabel(0, "applicationMode", "Cold Glue");
assert.equal(specsContext.state.selectedBrand, apl.brand);
assert.equal(calls.includes("ensureSelectedBrandForApplication"), false);
assert.equal(calls.find((entry) => typeof entry === "object").regenerate, false,
  "editing catalog application metadata must not regenerate or replace the active build recipe");

console.log("Build Inputs all-brand selection and label metadata independence regression passed.");
