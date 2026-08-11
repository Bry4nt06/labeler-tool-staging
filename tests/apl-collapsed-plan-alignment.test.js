"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const translationSource = fs.readFileSync(
  path.resolve(__dirname, "../app/profile-translation-service.js"),
  "utf8"
);
const continuitySource = fs.readFileSync(
  path.resolve(__dirname, "../app/apl-section-handoff-continuity-integration.js"),
  "utf8"
);

const sourceRows = [
  {
    hmi: 1,
    plc: 0,
    cmd: 3,
    tableAngle: 100,
    plateAngle: 20,
    action: "Wipe Hold Neck - Agg 1",
    motionEventId: "ME-A1-NECK-WIPE-HOLD",
    motionEventType: "WIPE_HOLD",
    plannerIntent: "HOLD"
  },
  {
    hmi: 2,
    plc: 1,
    cmd: 3,
    tableAngle: 101,
    plateAngle: 20,
    action: "Hold for Body Application - Agg 3",
    station: 3,
    section: "body",
    applicationReference: true,
    applicationReferenceMode: "leading-edge",
    canonicalSectionHandoffV44: true,
    motionSource: "canonical-section-handoff-v44",
    motionEventId: "ME-A3-BODY-APPLICATION-HOLD",
    motionEventType: "APPLICATION_HOLD",
    plannerIntent: "HOLD"
  },
  {
    hmi: 3,
    plc: 2,
    cmd: 7,
    tableAngle: 102,
    plateAngle: 20,
    action: "Wipe Turn 1 Body - Agg 3",
    station: 3,
    section: "body",
    motionEventId: "ME-A3-BODY-TURN-1",
    motionEventType: "WIPE_TURN",
    plannerIntent: "ROTATE"
  }
];

const plan = {
  steps: sourceRows.map((row, index) => ({
    index,
    eventId: row.motionEventId,
    eventType: row.motionEventType,
    hmi: row.hmi,
    tableAngle: row.tableAngle,
    plateAngle: row.plateAngle,
    action: row.action,
    recommendedCommand: row.cmd,
    intent: row.plannerIntent,
    stationTag: `station-step-${index + 1}`
  }))
};

const context = {
  console,
  state: {
    program: sourceRows.map((row) => ({ ...row })),
    motionPlan: {
      planner: plan,
      translation: { commandSummary: { "3": 2, "7": 1 } }
    },
    motionTranslation: {
      rows: sourceRows.map((row) => ({ ...row })),
      plan,
      commandSummary: { "3": 2, "7": 1 }
    }
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

vm.runInContext(translationSource, context);
vm.runInContext(continuitySource, context);

assert.equal(context.state.program.length, 2, "The passive application Rest should collapse from the HMI program.");
assert.deepEqual(
  Array.from(context.state.program, (row) => row.motionEventId),
  ["ME-A1-NECK-WIPE-HOLD", "ME-A3-BODY-TURN-1"]
);
assert.equal(context.state.motionTranslation.plan.steps.length, 2);
assert.deepEqual(
  Array.from(context.state.motionTranslation.plan.steps, (step) => step.eventId),
  ["ME-A1-NECK-WIPE-HOLD", "ME-A3-BODY-TURN-1"],
  "The translated validation plan must follow surviving motion event IDs, not stale array positions."
);
assert.equal(
  context.state.motionTranslation.plan.steps[1].stationTag,
  "station-step-3",
  "Survivor metadata must come from the matching pre-collapse event rather than the removed row at the same index."
);
assert.equal(context.state.motionTranslation.plan.steps[1].hmi, 2);
assert.equal(context.state.motionTranslation.plan.steps[1].recommendedCommand, 7);
assert.equal(context.state.motionPlan.planner, context.state.motionTranslation.plan);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.state.motionTranslation.commandSummary)),
  { "3": 1, "7": 1 }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.state.motionPlan.translation.commandSummary)),
  { "3": 1, "7": 1 }
);

console.log("APL collapsed planner alignment regression passed.");