"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "global-machine-parameter-defaults-integration.js"), "utf8");
const controllerSource = fs.readFileSync(path.join(root, "app", "controllers", "build-inputs-controller.js"), "utf8");
const startup = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(source));
assert.doesNotThrow(() => new vm.Script(controllerSource));
assert.match(source, /DEFAULT_CONTACT_DEG\s*=\s*10/);
assert.match(source, /DEFAULT_CONTACT_DEG_BY_SECTION\s*=\s*Object\.freeze\(\{\s*neck:\s*10,\s*body:\s*10,\s*back:\s*0\s*\}\)/);
assert.match(source, /contactParameterDegByBrand/);
assert.match(source, /programNeckContactDeg/);
assert.match(source, /programBodyContactDeg/);
assert.match(source, /programBackContactDeg/);
assert.match(controllerSource, /persistContactParameter\("neck", value\)/);
assert.match(controllerSource, /persistContactParameter\("body", value\)/);
assert.match(controllerSource, /persistContactParameter\("back", value\)/);
assert.match(controllerSource, /LabelerBrandContactParameterDefaults\?\.setContactDeg/);
assert.match(startup, /editable-contact-parameters-v65-20260811/);
assert.doesNotMatch(startup, /brand-contact-parameter-defaults-integration\.js/);
assert.match(startup, /global-machine-parameter-defaults-integration\.js/);

const inputs = new Map([
  ["programNeckContactDeg", { value: "" }],
  ["programBodyContactDeg", { value: "" }],
  ["programBackContactDeg", { value: "" }]
]);
const storage = new Map();
const listeners = new Map();

const state = {
  applicationMode: "apl",
  selectedBrand: "12oz LandShark (LN)",
  selectedBottle: "SSNR - 12 Oz",
  buildInputs: {
    neckContactMm: 4.4,
    bodyContactMm: 5,
    backContactMm: 5
  },
  labelSpecs: [
    {
      applicationMode: "apl",
      brand: "12oz LandShark (LN)",
      bottleType: "SSNR - 12 Oz",
      neckBottomCircumferenceMm: 0
    },
    {
      applicationMode: "apl",
      brand: "12oz Mic Family",
      bottleType: "SSNR - 12 Oz",
      neckBottomCircumferenceMm: 105
    }
  ],
  bottleSpecs: [
    { bottleType: "SSNR - 12 Oz", diameterTargetMm: 60.68, radiusReductionMm: 0.3 }
  ]
};

function bodyCircumference(bottle) {
  return Math.PI * (Number(bottle.diameterTargetMm) - 2 * Number(bottle.radiusReductionMm));
}

const baseController = {
  selectBrand(value) {
    state.selectedBrand = value;
    const label = state.labelSpecs.find((spec) => spec.brand === value);
    state.selectedBottle = label?.bottleType || state.selectedBottle;
  },
  selectBottle(value) {
    state.selectedBottle = value;
  },
  updateCalculatedField(id, rawValue) {
    const value = Number(rawValue);
    const label = state.labelSpecs.find((spec) => spec.brand === state.selectedBrand);
    const bottle = state.bottleSpecs.find((spec) => spec.bottleType === state.selectedBottle);
    const bodyCirc = bodyCircumference(bottle);
    if (id === "programNeckContactDeg") state.buildInputs.neckContactMm = value / 360 * Math.max(0.001, Number(label.neckBottomCircumferenceMm));
    if (id === "programBodyContactDeg") state.buildInputs.bodyContactMm = value / 360 * bodyCirc;
    if (id === "programBackContactDeg") state.buildInputs.backContactMm = value / 360 * bodyCirc;
  }
};

const context = {
  console,
  state,
  document: {
    getElementById(id) { return inputs.get(id) || null; }
  },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  setTimeout(callback) { callback(); },
  addEventListener(type, callback) { listeners.set(type, callback); },
  bodyCircumference,
  loadSavedSettings() {},
  buildProgramSummary() {
    return {
      rows: [
        ["Neck Contact Parameter (deg)", 0],
        ["Body Contact Parameter (deg)", 0],
        ["Back Contact Parameter (deg)", 0]
      ]
    };
  },
  renderBuildInputs() {},
  LabelerBuildInputsController: baseController,
  saveCurrentSettings() {},
  applyGeneratedServoProfile() {},
  render() {}
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context);

assert.equal(context.LabelerBrandContactParameterDefaults.installed, true);
assert.equal(context.LabelerBrandContactParameterDefaults.version, 2);
assert.equal(context.LabelerBrandContactParameterDefaults.DEFAULT_CONTACT_DEG, 10);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.LabelerBrandContactParameterDefaults.DEFAULT_CONTACT_DEG_BY_SECTION)),
  { neck: 10, body: 10, back: 0 }
);

context.loadSavedSettings();
assert.equal(storage.get("servoforge-brand-contact-parameters-10-10-0-v2-applied"), "true");

const api = context.LabelerBrandContactParameterDefaults;
for (const spec of state.labelSpecs) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.ensureBrand(state, spec))),
    { neck: 10, body: 10, back: 0 },
    `${spec.brand} must default contact parameters to 10 / 10 / 0 degrees.`
  );
}

api.applySelectedBrand(state);
const bodyCirc = bodyCircumference(state.bottleSpecs[0]);
assert.equal(state.buildInputs.neckContactMm, 0, "A disabled zero-circumference neck remains physically zero millimeters.");
assert.ok(Math.abs(state.buildInputs.bodyContactMm - 10 / 360 * bodyCirc) < 1e-9);
assert.equal(state.buildInputs.backContactMm, 0);

const summary = context.buildProgramSummary();
assert.deepEqual(
  JSON.parse(JSON.stringify(summary.rows)),
  [
    ["Neck Contact Parameter (deg)", 10],
    ["Body Contact Parameter (deg)", 10],
    ["Back Contact Parameter (deg)", 0]
  ],
  "Workbook Feed Check must show the requested 10 / 10 / 0 defaults."
);
context.renderBuildInputs();
assert.equal(inputs.get("programNeckContactDeg").value, "10");
assert.equal(inputs.get("programBodyContactDeg").value, "10");
assert.equal(inputs.get("programBackContactDeg").value, "0");

context.LabelerBuildInputsController.selectBrand("12oz Mic Family");
assert.ok(Math.abs(state.buildInputs.neckContactMm - 10 / 360 * 105) < 1e-9);
assert.ok(Math.abs(state.buildInputs.bodyContactMm - 10 / 360 * bodyCirc) < 1e-9);
assert.equal(state.buildInputs.backContactMm, 0);

context.LabelerBuildInputsController.updateCalculatedField("programBodyContactDeg", 12);
assert.equal(api.contactDeg(state, "body"), 12, "A user body-contact adjustment must be stored for the active brand.");
context.renderBuildInputs();
assert.equal(inputs.get("programBodyContactDeg").value, "12", "Rendering must not overwrite an explicit body-contact edit.");

context.LabelerBuildInputsController.updateCalculatedField("programBackContactDeg", 7);
assert.equal(api.contactDeg(state, "back"), 7, "A user back-contact adjustment must be stored for the active brand.");
context.renderBuildInputs();
assert.equal(inputs.get("programBackContactDeg").value, "7", "Rendering must not overwrite an explicit back-contact edit.");

context.LabelerBuildInputsController.selectBrand("12oz LandShark (LN)");
assert.equal(api.contactDeg(state, "body"), 10);
assert.equal(api.contactDeg(state, "back"), 0);
context.LabelerBuildInputsController.selectBrand("12oz Mic Family");
assert.equal(api.contactDeg(state, "body"), 12, "Switching brands must preserve an explicit brand-specific body adjustment.");
assert.equal(api.contactDeg(state, "back"), 7, "Switching brands must preserve an explicit brand-specific back adjustment.");

const legacySpec = {
  applicationMode: "apl",
  brand: "Legacy 10-10-10 Brand",
  bottleType: "SSNR - 12 Oz",
  neckBottomCircumferenceMm: 100
};
state.labelSpecs.push(legacySpec);
api.ensureStore(state)[api.brandKey(legacySpec, state.applicationMode)] = { neck: 10, body: 10, back: 10 };
assert.equal(api.migrateLegacyDefaultTuples(state), true);
assert.deepEqual(
  JSON.parse(JSON.stringify(api.ensureBrand(state, legacySpec))),
  { neck: 10, body: 10, back: 0 },
  "The untouched legacy 10 / 10 / 10 tuple must migrate to 10 / 10 / 0."
);

state.labelSpecs.push({
  applicationMode: "apl",
  brand: "New Repository Brand",
  bottleType: "SSNR - 12 Oz",
  neckBottomCircumferenceMm: 100
});
api.ensureAllBrands(state);
assert.deepEqual(
  JSON.parse(JSON.stringify(api.ensureBrand(state, state.labelSpecs.at(-1)))),
  { neck: 10, body: 10, back: 0 },
  "Newly downloaded brands must inherit the same 10 / 10 / 0 defaults."
);

console.log("Editable brand contact parameter defaults regression passed.");
