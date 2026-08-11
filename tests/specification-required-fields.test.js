"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const requiredSource = fs.readFileSync(
  path.join(root, "app", "controllers", "specification-required-fields-controller.js"),
  "utf8"
);
const specsControllerSource = fs.readFileSync(
  path.join(root, "app", "controllers", "specs-controller.js"),
  "utf8"
);
const retirementSource = fs.readFileSync(
  path.join(root, "app", "spec-number-retirement-integration.js"),
  "utf8"
);
const labelLibraryText = fs.readFileSync(
  path.join(root, "config", "default-programs", "label-specs.json"),
  "utf8"
);

assert.doesNotThrow(() => new vm.Script(requiredSource, { filename: "specification-required-fields-controller.js" }));
assert.doesNotThrow(() => new vm.Script(specsControllerSource, { filename: "specs-controller.js" }));
assert.doesNotThrow(() => new vm.Script(retirementSource, { filename: "spec-number-retirement-integration.js" }));

const sandbox = { window: null, globalThis: null, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(requiredSource, sandbox, { filename: "specification-required-fields-controller.js" });

const requirements = sandbox.LabelerSpecificationRequirements;
const controller = sandbox.LabelerSpecificationRequiredFieldsController;
assert.strictEqual(requirements?.blocking, false, "Specification completeness must not block Specs editing.");
assert.strictEqual(controller?.blocking, false, "Required-field controller must remain non-blocking.");
assert.strictEqual(controller?.validateAndPrompt(), true, "Legacy validation callers must always be allowed to continue.");
assert.strictEqual(controller?.showRequiredDialog(), false, "The required-specification modal must remain disabled.");

const zeroState = {
  bottleSpecs: [{ bottleType: "Zero Bottle", diameterTargetMm: 0, radiusReductionMm: 0 }],
  labelSpecs: [{
    brand: "Zero Brand",
    applicationMode: "apl",
    bodyLengthMm: 0,
    backLengthMm: 0,
    neckHeightMm: 0,
    neckLengthMm: 0,
    neckBottomCurveMm: 0,
    neckBottomCircumferenceMm: 0,
    codeBoxCenterMm: 0
  }]
};
assert.strictEqual(requirements.validateState(zeroState).length, 0, "Numeric zero must remain valid.");

assert.ok(!/specNumber\s*:\s*["'`]/.test(specsControllerSource),
  "New label recipes must not create a Spec number property.");
assert.ok(!/key\s*===\s*["']specNumber["']/.test(specsControllerSource) || /key\s*===\s*["']specNumber["']\) return/.test(specsControllerSource),
  "Specs controller must not accept Spec number as an editable field.");
assert.ok(!/"specNumber"\s*:/.test(labelLibraryText),
  "Default label library must not contain the retired Spec number field.");

const bootstrap = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
assert.ok(bootstrap.includes("app/spec-number-retirement-integration.js"),
  "Spec number retirement integration must load in the active bootstrap.");
assert.ok(bootstrap.includes("spec-number-retired-v64-20260811-1038"),
  "Expected the v64 Spec number retirement build.");

console.log("Spec number retirement regression passed.");
