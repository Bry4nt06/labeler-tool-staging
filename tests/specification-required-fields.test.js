"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "app", "controllers", "specification-required-fields-controller.js"),
  "utf8"
);
assert.doesNotThrow(() => new vm.Script(source, { filename: "specification-required-fields-controller.js" }));

const sandbox = { window: null, globalThis: null, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "specification-required-fields-controller.js" });

const requirements = sandbox.LabelerSpecificationRequirements;
const controller = sandbox.LabelerSpecificationRequiredFieldsController;
assert.ok(requirements?.blankOnly);
assert.ok(requirements?.zeroIsComplete);
assert.strictEqual(requirements?.blocking, false, "Specification completeness must not block Specs editing.");
assert.strictEqual(requirements?.advisoryOnly, true, "Specification completeness must be advisory only.");
assert.strictEqual(controller?.blocking, false, "Required-field controller must be non-blocking.");
assert.strictEqual(controller?.validateAndPrompt(), true, "Legacy validateAndPrompt callers must always be allowed to continue.");
assert.strictEqual(controller?.showRequiredDialog(), false, "The blocking required-specification dialog must stay disabled.");

const zeroState = {
  bottleSpecs: [{
    bottleType: "Zero Bottle",
    diameterTargetMm: 0,
    radiusReductionMm: 0
  }],
  labelSpecs: [{
    brand: "Zero Brand",
    specNumber: "",
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
assert.strictEqual(requirements.validateState(zeroState).length, 0,
  "Numeric zero must remain valid and the legacy Spec # must not be required.");

const blankLabel = JSON.parse(JSON.stringify(zeroState));
blankLabel.labelSpecs[0].neckHeightMm = "";
assert.ok(requirements.validateState(blankLabel).some((issue) => issue.field === "neckHeightMm"),
  "Blank dimensions may still be surfaced as advisory diagnostics.");

const blankBottle = JSON.parse(JSON.stringify(zeroState));
blankBottle.bottleSpecs[0].diameterTargetMm = null;
assert.ok(requirements.validateState(blankBottle).some((issue) => issue.field === "diameterTargetMm"));

const invalidNumeric = JSON.parse(JSON.stringify(zeroState));
invalidNumeric.labelSpecs[0].bodyLengthMm = "not-a-number";
assert.ok(requirements.validateState(invalidNumeric).some((issue) => issue.field === "bodyLengthMm"));

const missingSpecNumber = JSON.parse(JSON.stringify(zeroState));
missingSpecNumber.labelSpecs[0].specNumber = "";
assert.ok(!requirements.validateState(missingSpecNumber).some((issue) => issue.field === "specNumber"),
  "Spec # is not an editable Specs-table field and must never block or invalidate a recipe.");

const bootstrap = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const guidanceIndex = bootstrap.indexOf("app/controllers/specification-sensor-guidance-controller.js");
const requiredIndex = bootstrap.indexOf("app/controllers/specification-required-fields-controller.js");
const sensorIndex = bootstrap.indexOf("app/controllers/sensor-activation-controller.js");
assert.ok(guidanceIndex >= 0 && requiredIndex > guidanceIndex && requiredIndex < sensorIndex);

console.log("Non-blocking specification editing regression passed.");
