"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");

function runtime() {
  const context = {
    console, setTimeout() {},
    state: { applicationMode: "cold-glue", buildInputs: {}, motionPlan: null },
    activeMachineMap: () => ({ machineType: "Autocol", applicationMode: "cold-glue" }),
    selectedLabelApplicationState: () => ({ neck: true, body: true, back: true }),
    generatedAplSeedProfile: () => [],
    document: { createElement: () => ({ addEventListener() {} }), head: { appendChild() {} } }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ["drivers/mechanical/cold-glue-motion-driver.js", "drivers/validation/motion-validation-driver.js",
    "app/simulation-engine.js", "app/label-centerline-policy-integration.js", "app/machine-profile-framing.js", "drivers/servo/servo-command-driver.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  return context;
}

function coverageFixture() {
  const phase = { side: "inner", requiredRotation: 90, deferredRotation: 110.3,
    deferredToFinalBrush: true, windows: [{ start: 131, end: 140, direction: -1 }] };
  const plan = { mapDriven: true, coldGluePlans: {}, issues: [
    { code: "cold-glue-channel-capacity", level: "bad", station: 1, section: "neck", message: "Inside brush opening short" }
  ], stationPlans: [
    { station: 1, section: "neck", aggregateTableAngle: 81, objects: [], plan: { phasePlans: [phase] } },
    { station: 5, section: "back", aggregateTableAngle: 232, objects: [
      { id: "finisher", kind: "brush", role: "final", labelSection: "neck", side: "outer", start: 212, end: 224 }
    ], plan: null }
  ] };
  const rows = [
    { cmd: 7, tableAngle: 131, plateAngle: 90, station: 1, section: "neck", brushSide: "inner", wipeOutward: true },
    { cmd: 3, tableAngle: 140, plateAngle: 0 },
    { cmd: 7, tableAngle: 212, plateAngle: 0, station: 5, section: "neck", brushId: "finisher", brushSide: "outer", carryoverWipe: true },
    { cmd: 3, tableAngle: 220, plateAngle: 110.3 }
  ];
  return { plan, rows, maxRatio: 24, tolerance: 0.5 };
}

test("coverage uses commanded upstream wipe plus physical downstream finishing contact", () => {
  const context = runtime();
  const fixture = coverageFixture();
  const issues = context.LabelerMotionValidationDriver.analyze(fixture);
  assert.ok(!issues.some((issue) => issue.level === "bad"), JSON.stringify(issues));
  assert.ok(issues.some((issue) => issue.code === "cold-glue-combined-coverage" && issue.level === "ok"));
  fixture.rows[3].plateAngle = 50;
  assert.ok(context.LabelerMotionValidationDriver.analyze(fixture)
    .some((issue) => issue.code === "cold-glue-combined-coverage" && issue.level === "bad"));
});

test("coverage rejects noncontact, wrong-direction, overspeed and post-gripper finishing motion", () => {
  for (const mutate of [
    (f) => { f.rows[2].tableAngle = 225; f.rows[3].tableAngle = 231; },
    (f) => { f.rows[3].plateAngle = -110.3; },
    (f) => { f.rows[3].tableAngle = 213; },
    (f) => { f.plan.stationPlans[1].aggregateTableAngle = 215; },
    (f) => { f.plan.stationPlans[1].objects = []; },
    (f) => { f.rows[1].plateAngle = 90; }
  ]) {
    const context = runtime();
    const fixture = coverageFixture();
    mutate(fixture);
    assert.ok(context.LabelerMotionValidationDriver.analyze(fixture)
      .some((issue) => issue.code === "cold-glue-combined-coverage" && issue.level === "bad"));
  }
});

test("Cold Glue validates pickup references and ignores later brush orientation", () => {
  const context = runtime();
  const rows = [
    { cmd: 3, tableAngle: 81, plateAngle: 0, section: "neck", applicationReference: true },
    { cmd: 3, tableAngle: 156, plateAngle: 0, section: "body", applicationReference: true },
    { cmd: 3, tableAngle: 178, plateAngle: 90, section: "body", postApplicationBrushEntry: true,
      action: "Body Rotate After Application to Parallel Brush Entry - Reference" },
    { cmd: 7, tableAngle: 221, plateAngle: 90, section: "back", applicationTransition: true,
      action: "Turn for Back Application at Aggregate 5" },
    { cmd: 3, tableAngle: 232, plateAngle: 180, section: "back", applicationReference: true }
  ];
  assert.equal(context.LabelerLabelCenterlinePolicy.applicationReferences(rows).body.length, 1);
  assert.equal(context.LabelerLabelCenterlinePolicy.validationNotes(rows).length, 0);
  rows[4].plateAngle = 170;
  assert.ok(context.LabelerLabelCenterlinePolicy.validationNotes(rows)
    .some((note) => note[0] === "bad" && note[2].code === "cold-glue-gripper-centerline"));
});

test("gripper angle is checked on the physical curve when framing has merged its named Rest", () => {
  const context = runtime();
  context.state.motionPlan = { stationPlans: [{ station: 3, section: "body", aggregateTableAngle: 156 }] };
  const rows = [
    { hmi: 1, cmd: 3, tableAngle: 120, plateAngle: 0 },
    { hmi: 2, cmd: 7, tableAngle: 156, plateAngle: 0 },
    { hmi: 3, cmd: 3, tableAngle: 178, plateAngle: 90, section: "body", postApplicationBrushEntry: true }
  ];
  assert.equal(context.LabelerLabelCenterlinePolicy.validationNotes(rows).length, 0);
  rows[1].tableAngle = 146;
  assert.ok(context.LabelerLabelCenterlinePolicy.validationNotes(rows).some((note) => note[0] === "bad"));
});

test("8.4:1 against 9.5:1 stays advisory and excessive speed stays a fault", () => {
  const context = runtime();
  Object.assign(context.state, { headCount: 60, maxMoveRatio: 9.5, mapPoints: [], assemblies: [], program: [], motionPlan: null });
  Object.assign(context, {
    programSegments: () => [{ hmi: 5, cmd: 7, tableAngle: 0, plateAngle: 0, absSpeed: 8.4 }],
    selectedLabelApplicationState: () => ({ neck: false, body: false, back: false }),
    activeSlotNumbers: () => [], num: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    fmt: (value, digits) => Number(value).toFixed(digits)
  });
  vm.runInContext(fs.readFileSync(path.join(root, "app/validation.js"), "utf8"), context);
  assert.ok(context.validate().some(([level, text]) => level === "warn" && text.includes("NEAR THRESHOLD")));
  context.programSegments = () => [{ hmi: 5, cmd: 7, tableAngle: 0, plateAngle: 0, absSpeed: 10 }];
  assert.ok(context.validate().some(([level, text]) => level === "bad" && text.includes("EXCEEDS THRESHOLD")));
});

test("Autocol terminal cleanup removes only a zero-travel final correction", () => {
  const context = runtime();
  const rows = [
    { cmd: 3, tableAngle: 0, plateAngle: 0 },
    { cmd: 7, tableAngle: 100, plateAngle: 0 },
    { cmd: 3, tableAngle: 120, plateAngle: 90 },
    { cmd: 7, tableAngle: 280, plateAngle: 90 },
    { cmd: 3, tableAngle: 359, plateAngle: 90, terminalRest: true }
  ];
  const cleaned = context.LabelerMachineProfileFraming.apply(rows);
  assert.ok(!cleaned.some((row) => row.cmd === 7 && row.tableAngle === 280));
  assert.equal(cleaned.at(-1).plateAngle, 90);
  assert.ok(!context.LabelerServoCommandDriver.validateGrammar(cleaned).some((issue) => issue.level !== "ok"));
  rows.at(-1).plateAngle = 180;
  const required = context.LabelerMachineProfileFraming.apply(rows);
  assert.ok(required.some((row) => row.cmd === 7 && row.tableAngle === 280));
  assert.equal(required.at(-1).plateAngle, 180, "required terminal positioning must survive framing");
});
