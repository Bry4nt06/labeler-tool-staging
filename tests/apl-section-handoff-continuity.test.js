"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.resolve(__dirname, "../app/apl-section-handoff-continuity-integration.js"),
  "utf8"
);

const failingRows = [
  { hmi: 15, plc: 14, cmd: 3, tableAngle: 250, plateAngle: -73, action: "Wipe Hold Body - Agg 5" },
  {
    hmi: 16,
    plc: 15,
    cmd: 7,
    tableAngle: 250.5,
    plateAngle: 90.5,
    action: "Orient Back for Re-Wipe - Agg 6",
    station: 6,
    section: "back",
    wipeResetTransition: true,
    canonicalSectionHandoffV44: true
  },
  {
    hmi: 17,
    plc: 16,
    cmd: 3,
    tableAngle: 268.5,
    plateAngle: -163.5,
    action: "Orient Back for Re-Wipe - Agg 6",
    station: 6,
    section: "back",
    wipeResetReference: true
  }
];

const context = {
  console,
  state: {
    program: failingRows.map((row) => ({ ...row })),
    motionPlan: { rows: failingRows.map((row) => ({ ...row })) }
  },
  finishAngle(value) { return Math.round(Number(value) * 10) / 10; },
  applyGeneratedServoProfile() { return context.state.program; },
  renderProgram() {},
  renderValidation() {},
  setTimeout(callback) { callback(); }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context);

assert.equal(context.LabelerAplSectionHandoffContinuity.installed, true);
assert.equal(context.state.program[0].cmd, 3);
assert.equal(context.state.program[0].plateAngle, -73);
assert.equal(context.state.program[1].cmd, 7);
assert.equal(
  context.state.program[1].plateAngle,
  -73,
  "The re-wipe CMD 7 must start from the immediately preceding CMD 3 Rest bottle angle."
);
assert.equal(context.state.program[2].plateAngle, -163.5);
assert.equal(context.state.program[1].plannedRotation, -90.5);
assert.ok(Math.abs(context.state.program[1].plannedRatio - (90.5 / 18)) < 1e-9);
assert.equal(
  context.state.program[1].plateAngle - context.state.program[0].plateAngle,
  0,
  "The preceding CMD 3 must not appear to rotate the bottle before the correction begins."
);
assert.equal(context.state.motionPlan.aplSectionHandoffContinuity.applied, true);
assert.equal(context.state.motionPlan.aplSectionHandoffContinuity.changes.length, 1);

const ordinaryWipe = context.LabelerAplSectionHandoffContinuity.repair([
  { cmd: 3, tableAngle: 100, plateAngle: 20, action: "Hold" },
  { cmd: 7, tableAngle: 100.5, plateAngle: 35, action: "Wipe Turn 1 Body - Agg 4", canonicalSectionHandoffV44: true },
  { cmd: 3, tableAngle: 110, plateAngle: 55, action: "Wipe Hold Body - Agg 4" }
]);
assert.equal(
  ordinaryWipe.rows[1].plateAngle,
  35,
  "Ordinary wipe turns must not be rewritten merely because they carry canonical-section metadata."
);
assert.equal(ordinaryWipe.changes.length, 0);

console.log("APL section handoff continuity regression passed.");
