"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const root = process.env.SERVO_RUNTIME_ROOT || path.resolve(__dirname, "..");

function fixture(applicationMode = "cold-glue") {
  const frames = [], saved = [], displayed = [];
  const state = {
    activeTab: "simulation", applicationMode,
    selectedBrand: "First", selectedBottle: "Bottle A",
    labelSpecs: [
      { brand: "First", bottleType: "Bottle A", applicationMode: "cold-glue" },
      { brand: "Second", bottleType: "Bottle B", applicationMode: "apl" },
      { brand: "Third", bottleType: "Bottle C", applicationMode: "cold-glue" }
    ],
    bottleSpecs: ["Bottle A", "Bottle B", "Bottle C"].map(bottleType => ({ bottleType })),
    simulation: { useCustom: true, source: "manual", draftName: "My draft", lines: [{ cmd: 7, tableAngle: 13, plateAngle: 27 }] }
  };
  const context = {
    state, document: { querySelector: () => null, getElementById: () => null },
    requestAnimationFrame: callback => frames.push(callback),
    setTimeout: callback => frames.push(callback),
    loadSavedSettings() {}, buildProgramSummary: () => ({ rows: [] }), renderBuildInputs() {},
    LabelerTabsController: { setDirectTabState: tab => { state.activeTab = tab; } },
    saveCurrentSettings: () => saved.push(JSON.parse(JSON.stringify(state))),
    ensureBottleReferenceForLabel: label => { state.selectedBottle = label.bottleType; },
    applyLabelLengthStationRules() {},
    // Reproduce recipe normalization in the old full-render path. A brand
    // choice must use the established presentation-only selection transaction.
    render: () => { state.selectedBrand = "First"; state.selectedBottle = "Bottle A"; },
    applyGeneratedServoProfile: () => { state.program = [{ brand: state.selectedBrand }]; },
    renderSimulation: () => displayed.push({ brand: state.selectedBrand, bottle: state.selectedBottle })
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ["workspace-action-service", "build-inputs-controller", "simulation-editor-controller"]) {
    vm.runInContext(fs.readFileSync(path.join(root, `app/controllers/${file}.js`), "utf8"), context, { filename: file });
  }
  vm.runInContext(fs.readFileSync(path.join(root, "app/global-machine-parameter-defaults-integration.js"), "utf8"), context);
  return { context, state, frames, saved, displayed, select: value => context.LabelerSimulationEditorController.selectContextBrand(value) };
}

for (const mode of ["apl", "cold-glue"]) {
  test(`${mode}: Simulation brand selection survives presentation and keeps the draft`, () => {
    const f = fixture(mode);
    const draft = JSON.stringify(f.state.simulation);
    assert.equal(f.select("Second"), true);
    while (f.frames.length) f.frames.shift()();
    assert.equal(f.state.selectedBrand, "Second");
    assert.equal(f.state.selectedBottle, "Bottle B");
    assert.equal(f.state.activeTab, "simulation");
    assert.equal(JSON.stringify(f.state.simulation), draft);
    assert.equal(f.saved.at(-1).selectedBrand, "Second");
    assert.deepEqual(f.displayed.at(-1), { brand: "Second", bottle: "Bottle B" });
    assert.equal(f.state.program[0].brand, "Second");
  });
}

test("newest Simulation brand wins if a deferred compatibility task restores the old recipe", () => {
  const f = fixture();
  f.select("Second");
  f.select("Third");
  f.state.selectedBrand = "First";
  f.state.selectedBottle = "Bottle A";
  while (f.frames.length) f.frames.shift()();
  assert.equal(f.state.selectedBrand, "Third");
  assert.equal(f.state.selectedBottle, "Bottle C");
  assert.equal(f.saved.at(-1).selectedBrand, "Third");
  assert.equal(f.state.program[0].brand, "Third");
  assert.equal(f.state.activeTab, "simulation");
});

test("invalid Simulation brand leaves state and persistence untouched", () => {
  const f = fixture();
  const before = JSON.stringify(f.state);
  assert.equal(f.select("Missing"), false);
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(f.saved.length, 0);
  assert.equal(f.frames.length, 0);
});

test("Build Inputs keeps its existing brand selection destination", () => {
  const f = fixture();
  f.context.LabelerBuildInputsController.selectBrand("Second");
  while (f.frames.length) f.frames.shift()();
  assert.equal(f.state.selectedBrand, "Second");
  assert.equal(f.state.activeTab, "buildInputs");
});

test("Simulation applies saved brand contact parameters before generation and persistence", () => {
  const f = fixture();
  const label = f.state.labelSpecs[1];
  label.neckBottomCircumferenceMm = 120;
  f.context.LabelerBrandContactParameterDefaults.setContactDeg(f.state, "neck", 24, label);
  let generatedContact;
  f.context.applyGeneratedServoProfile = () => { generatedContact = f.state.buildInputs.neckContactMm; };
  f.select("Second");
  while (f.frames.length) f.frames.shift()();
  assert.equal(generatedContact, 8);
  assert.equal(f.state.buildInputs.neckContactMm, 8);
  assert.equal(f.saved.at(-1).buildInputs.neckContactMm, 8);
  assert.equal(f.state.activeTab, "simulation");
});
