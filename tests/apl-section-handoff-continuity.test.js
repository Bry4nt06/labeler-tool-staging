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

// Exact Mic Family APL 6-Aggregate pattern reported from HMI 6 through HMI 13.
// The second CMD 3 in each 3 -> 3 -> 7 chain is only a logical reference point:
// it does not change the bottle angle and therefore must not consume an HMI row.
const micSegment = context.LabelerAplSectionHandoffContinuity.repair([
  {
    hmi: 6,
    plc: 5,
    cmd: 3,
    tableAngle: 105,
    plateAngle: 0,
    action: "Wipe Hold Neck - Agg 1",
    station: 1,
    section: "neck"
  },
  {
    hmi: 7,
    plc: 6,
    cmd: 3,
    tableAngle: 110.5,
    plateAngle: 0,
    action: "Orient Neck for Re-Wipe - Agg 2",
    station: 2,
    section: "neck",
    wipeResetReference: true,
    canonicalSectionHandoffV44: true,
    motionSource: "canonical-section-handoff-v44"
  },
  {
    hmi: 8,
    plc: 7,
    cmd: 7,
    tableAngle: 112,
    plateAngle: 0,
    action: "Wipe Turn 1 Neck - Agg 2",
    station: 2,
    section: "neck"
  },
  {
    hmi: 9,
    plc: 8,
    cmd: 3,
    tableAngle: 127.5,
    plateAngle: 157,
    action: "Wipe Turn 1 Neck - Agg 2 - Rest",
    station: 2,
    section: "neck"
  },
  {
    hmi: 10,
    plc: 9,
    cmd: 7,
    tableAngle: 129.5,
    plateAngle: 157,
    action: "Wipe Turn 2 Neck - Agg 2",
    station: 2,
    section: "neck"
  },
  {
    hmi: 11,
    plc: 10,
    cmd: 3,
    tableAngle: 147.5,
    plateAngle: -63.5,
    action: "Wipe Hold Neck - Agg 2",
    station: 2,
    section: "neck"
  },
  {
    hmi: 12,
    plc: 11,
    cmd: 3,
    tableAngle: 148.5,
    plateAngle: -63.5,
    action: "Hold for Body Application - Agg 3",
    station: 3,
    section: "body",
    applicationReference: true,
    applicationReferenceMode: "leading-edge",
    finishedLabelCenterlineDeg: 0,
    canonicalSectionHandoffV44: true,
    motionSource: "canonical-section-handoff-v44"
  },
  {
    hmi: 13,
    plc: 12,
    cmd: 7,
    tableAngle: 149,
    plateAngle: -63.5,
    action: "Wipe Turn 1 Body - Agg 3",
    station: 3,
    section: "body"
  }
]);

assert.deepEqual(
  Array.from(micSegment.rows, (row) => Number(row.cmd)),
  [3, 7, 3, 7, 3, 7],
  "Mic Family must not retain redundant 3 -> 3 -> 7 handoffs."
);
assert.equal(micSegment.collapsed.length, 2);
assert.equal(micSegment.rows[0].tableAngle, 105, "The preceding wipe Rest must keep its real physical endpoint.");
assert.equal(micSegment.rows[1].tableAngle, 112, "The next wipe turn must keep its original start angle.");
assert.equal(micSegment.rows[4].tableAngle, 147.5, "The Neck Agg 2 Rest must keep its real physical endpoint.");
assert.equal(micSegment.rows[5].tableAngle, 149, "The Body Agg 3 wipe must keep its original start angle.");

const neckResetEvent = micSegment.rows[0].logicalReferenceEvents?.[0];
assert.equal(neckResetEvent?.tableAngle, 110.5);
assert.equal(neckResetEvent?.action, "Orient Neck for Re-Wipe - Agg 2");
assert.equal(neckResetEvent?.wipeResetReference, true);

const bodyApplicationEvent = micSegment.rows[4].logicalReferenceEvents?.[0];
assert.equal(bodyApplicationEvent?.tableAngle, 148.5);
assert.equal(bodyApplicationEvent?.action, "Hold for Body Application - Agg 3");
assert.equal(bodyApplicationEvent?.applicationReference, true);
assert.equal(micSegment.rows[4].applicationSection, "body");
assert.equal(micSegment.rows[4].applicationReferenceTableAngle, 148.5);
assert.equal(micSegment.rows[4].applicationReferenceStation, 3);
assert.equal(micSegment.rows[4].plateAngle, -63.5);

for (let index = 0; index < micSegment.rows.length - 1; index += 1) {
  const left = micSegment.rows[index];
  const right = micSegment.rows[index + 1];
  const redundant = Number(left.cmd) === 3
    && Number(right.cmd) === 3
    && Math.abs(Number(left.plateAngle) - Number(right.plateAngle)) <= 0.001;
  assert.equal(redundant, false, `Redundant consecutive Rest remains at rows ${index + 1}/${index + 2}.`);
}

// The same rule applies to a startup application marker: Zero Line already
// holds the servo at the requested angle, so a second Rest at the same plate
// position is a logical application event rather than another HMI command.
const firstApplication = context.LabelerAplSectionHandoffContinuity.repair([
  { cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
  {
    cmd: 3,
    tableAngle: 67.5,
    plateAngle: 0,
    action: "Hold for Neck Application - Agg 1",
    station: 1,
    section: "neck",
    applicationReference: true,
    applicationReferenceMode: "center-tack",
    canonicalSectionHandoffV44: true,
    motionSource: "canonical-section-handoff-v44"
  },
  { cmd: 7, tableAngle: 72, plateAngle: 0, action: "Wipe Turn 1 Neck - Agg 1", station: 1, section: "neck" }
]);
assert.deepEqual(Array.from(firstApplication.rows, (row) => Number(row.cmd)), [3, 7]);
assert.equal(firstApplication.collapsed.length, 1);
assert.equal(firstApplication.rows[0].applicationReferenceTableAngle, 67.5);
assert.equal(firstApplication.rows[0].applicationSection, "neck");

console.log("APL section handoff continuity and redundant Rest regression passed.");
