"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const integrationSource = fs.readFileSync(
  path.join(__dirname, "..", "app", "apl-roller-section-handoff-integration.js"),
  "utf8"
);

function fixture(maxMoveRatio = 21) {
  const program = [
    {
      hmi: 8, plc: 7, cmd: 7, tableAngle: 129.5, plateAngle: 162.5,
      action: "Wipe Turn 2 Neck - Agg 2", station: 2, section: "neck", stage: "inner"
    },
    {
      hmi: 9, plc: 8, cmd: 3, tableAngle: 147.5, plateAngle: 0,
      action: "Rest", station: 2, section: "neck"
    },
    {
      hmi: 10, plc: 9, cmd: 7, tableAngle: 148, plateAngle: 0,
      action: "Servo Correction"
    },
    {
      hmi: 11, plc: 10, cmd: 3, tableAngle: 148.5, plateAngle: -112,
      action: "Reference"
    },
    {
      hmi: 12, plc: 11, cmd: 7, tableAngle: 149, plateAngle: -112,
      action: "Wipe Turn 1 Body - Agg 3", station: 3, section: "body", stage: "set-down"
    }
  ];

  const state = {
    applicationMode: "apl",
    maxMoveRatio,
    program: program.map((row) => ({ ...row })),
    motionPlan: { rows: program.map((row) => ({ ...row })) }
  };

  const map = {
    applicationMode: "apl",
    stationSections: { "2": "neck", "3": "body" },
    objects: [
      { station: 2, application: "apl", kind: "roller", side: "outer" },
      { station: 2, application: "apl", kind: "roller", side: "inner" },
      { station: 3, application: "apl", kind: "pad", side: "outer" }
    ]
  };

  const stages = new Map();
  const pipeline = {
    registerStage(stage) { stages.set(stage.id, stage); return stage; },
    getStage(id) { return stages.get(id) || null; }
  };

  const context = {
    console,
    state,
    activeMachineMap: () => map,
    finishAngle: (value) => Math.round(Number(value) * 10) / 10,
    LabelerProfilePipelineDriver: pipeline,
    setTimeout(callback) { callback(); return 0; },
    clearTimeout() {}
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(integrationSource, context, { filename: "apl-roller-section-handoff-integration.js" });
  return { context, state, map, pipeline };
}

test("registers the roller handoff as a late authoritative profile pipeline stage", () => {
  const { pipeline } = fixture(21);
  const stage = pipeline.getStage("apl.roller-section-handoff");
  assert.ok(stage);
  assert.equal(stage.order, 9000);
});

test("merges the real metadata-free 224:1 Neck roller to Body handoff when the combined move is safe", () => {
  const { context, state, map, pipeline } = fixture(21);
  const stage = pipeline.getStage("apl.roller-section-handoff");
  const rows = stage.process(state.program, { state, map, applicationMode: "apl" });

  assert.equal(rows.length, 3, "the separate 0.5 degree correction/reference pair should be removed");
  assert.equal(rows[0].cmd, 7);
  assert.equal(rows[0].tableAngle, 129.5);
  assert.equal(rows[0].plateAngle, 162.5);
  assert.equal(rows[0].plannedRotation, -274.5);
  assert.ok(Math.abs(rows[0].plannedRatio - 15.25) < 1e-9);
  assert.equal(rows[0].rollerSectionHandoffMerged, true);

  assert.equal(rows[1].cmd, 3);
  assert.equal(rows[1].tableAngle, 147.5);
  assert.equal(rows[1].plateAngle, -112);
  assert.equal(rows[1].applicationReferenceTableAngle, 148.5);
  assert.equal(rows[1].applicationTargetSection, "body");
  assert.equal(rows[1].rollerSectionHandoffMerged, true);

  assert.equal(rows[2].tableAngle, 149);
  assert.equal(rows[2].plateAngle, -112);
  assert.equal(rows[2].hmi, 3);
  assert.equal(rows[2].plc, 2);

  assert.equal(state.motionPlan.aplRollerSectionHandoff.applied, true);
  assert.equal(state.motionPlan.aplRollerSectionHandoff.changes[0].originalTransitionRatio, 224);
  assert.equal(state.motionPlan.aplRollerSectionHandoff.changes[0].mergedRatio, 15.3);
  assert.equal(context.ServoForgeAplRollerSectionHandoffLastResult.applied, true);
});

test("keeps the original faulting transition when the roller cannot absorb it under the configured limit", () => {
  const { state, map, pipeline } = fixture(10);
  const stage = pipeline.getStage("apl.roller-section-handoff");
  const rows = stage.process(state.program, { state, map, applicationMode: "apl" });

  assert.equal(rows.length, 5);
  assert.equal(rows[1].plateAngle, 0);
  assert.equal(rows[2].tableAngle, 148);
  assert.equal(rows[3].plateAngle, -112);
  assert.equal(state.motionPlan.aplRollerSectionHandoff.applied, false);
});
