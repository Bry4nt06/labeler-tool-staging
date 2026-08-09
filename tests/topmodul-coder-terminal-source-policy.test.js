"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const policySource = fs.readFileSync(
  path.join(root, "app", "topmodul-coder-terminal-source-policy-integration.js"),
  "utf8"
);
const orientationSource = fs.readFileSync(
  path.join(root, "drivers", "profile", "map-object-orientation-driver.js"),
  "utf8"
);
const map = require("../config/default-programs/map-apl-6-aggregate.json");

assert.equal(map.machineType, "TopModul");
const coder = map.objects.find((item) => item.kind === "coding");
assert.ok(coder, "APL 6-Aggregate must include its physical coder.");
assert.equal(coder.start, 304);
assert.equal(coder.end, 309);

// The orientation domain must use the actual physical coder start. The retired
// 5-degree lead produced a 299-degree deadline that was never the requested
// terminal behavior.
{
  const context = { console };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(orientationSource, context);
  const driver = context.LabelerMapObjectOrientationDriver;
  assert.equal(driver.CODER_PRE_ORIENTATION_MARGIN_DEG, 0);
  const window = driver.objectWindow({ item: coder, rows: [{ tableAngle: 0 }] });
  assert.equal(window.start, 304);
  assert.equal(window.physicalStart, 304);
  assert.equal(window.end, 309);
  assert.equal(window.preOrientationMarginDeg, 0);
}

// Reproduce the exact generated failure visible in the UI: the final physical
// wipe stops at 290, the coding correction starts at 290.5, and a synthetic
// terminal row at 359 becomes its destination. The terminal source stage must
// replace that 359 destination with the physical coder start before grammar.
{
  let registeredStage = null;
  const context = {
    console,
    state: {
      applicationMode: "apl",
      maxMoveRatio: 21,
      machineFamilyGrammar: { family: "TOPMODUL" },
      motionPlan: {
        coderCenterlineTarget: 219.5,
        rows: [],
        termination: { section: "coding", command: "Rest" }
      },
      program: []
    },
    activeMachineMap() { return map; },
    finishAngle(value) { return Math.round(Number(value) * 10) / 10; },
    LabelerProfilePipelineDriver: {
      registerStage(stage) {
        registeredStage = stage;
        return stage;
      }
    },
    document: {
      readyState: "complete",
      addEventListener() {}
    },
    setTimeout(callback) { callback(); }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(policySource, context);

  assert.ok(registeredStage, "Coder terminal source policy must register in the profile pipeline.");
  assert.equal(registeredStage.id, "terminal.topmodul-coder");
  assert.equal(registeredStage.order, 550, "Terminal ownership must run after orientation and before grammar (600).");

  const failedGeneratedRows = [
    {
      hmi: 20,
      plc: 19,
      cmd: 3,
      tableAngle: 290,
      plateAngle: 287,
      action: "Wipe Hold Back - Agg 6",
      station: 6,
      section: "back",
      stage: "complete"
    },
    {
      hmi: 21,
      plc: 20,
      cmd: 7,
      tableAngle: 290.5,
      plateAngle: 287,
      action: "Orient Back Code Box for Coding",
      section: "back",
      codingMotion: true,
      codingObjectId: coder.id
    },
    {
      hmi: 22,
      plc: 21,
      cmd: 3,
      tableAngle: 359,
      plateAngle: 219.5,
      action: "Hold for Coding",
      section: "back",
      codingHold: true,
      codingObjectId: coder.id,
      terminalRest: true
    }
  ];

  const rows = registeredStage.process(failedGeneratedRows);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].tableAngle, 290);
  assert.equal(rows[1].cmd, 7);
  assert.equal(rows[1].tableAngle, 290.5, "The valid existing coding-turn start should be preserved.");
  assert.equal(rows[1].plateAngle, 287);
  assert.equal(rows[1].plannedRotation, -67.5);
  assert.ok(rows[1].plannedRatio < 21, "Coding correction must fit the speed envelope before the coder.");

  const terminal = rows.at(-1);
  assert.equal(terminal.cmd, 3);
  assert.equal(terminal.tableAngle, 304, "Generated TopModul program must stop at the physical coder start.");
  assert.equal(terminal.plateAngle, 219.5);
  assert.equal(terminal.action, "Hold for Coding");
  assert.equal(terminal.codingHold, true);
  assert.equal(terminal.terminalRest, true);
  assert.equal(terminal.preCoderMarginDeg, 0);
  assert.equal(terminal.coderStartTableAngle, 304);
  assert.equal(terminal.codingWindowStop, 309);
  assert.equal(rows.some((row) => Number(row.tableAngle) === 359), false, "359-degree synthetic terminal must be absent.");
  assert.equal(rows.some((row) => Number(row.tableAngle) > 304), false, "No servo-program row may continue through or past the coder start.");
  assert.equal(context.state.motionPlan.termination.tableAngle, 304);
  assert.equal(context.state.motionPlan.coderTerminalSourcePolicy, true);
}

// The terminal policy owns table timing, not recipe-specific code-box geometry.
// A different valid target must still finish at the same physical 304-degree
// coder boundary rather than stretching the move to 359.
{
  const context = {
    console,
    state: {
      applicationMode: "apl",
      maxMoveRatio: 21,
      machineFamilyGrammar: { family: "TOPMODUL" },
      motionPlan: { coderCenterlineTarget: 180, rows: [], termination: {} },
      program: []
    },
    activeMachineMap() { return map; },
    finishAngle(value) { return Math.round(Number(value) * 10) / 10; },
    LabelerProfilePipelineDriver: { registerStage(stage) { context.stage = stage; return stage; } },
    document: { readyState: "complete", addEventListener() {} },
    setTimeout(callback) { callback(); }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(policySource, context);
  const rows = context.stage.process([
    { cmd: 3, tableAngle: 290, plateAngle: 287, action: "Wipe Hold Back - Agg 6", station: 6, section: "back" },
    { cmd: 7, tableAngle: 290.5, plateAngle: 287, action: "Orient Back Code Box for Coding", codingMotion: true, codingObjectId: coder.id },
    { cmd: 3, tableAngle: 359, plateAngle: 180, action: "Hold for Coding", codingHold: true, codingObjectId: coder.id, terminalRest: true }
  ]);
  assert.equal(rows.at(-1).tableAngle, 304);
  assert.equal(rows.at(-1).plateAngle, 180);
  assert.equal(rows.some((row) => Number(row.tableAngle) === 359), false);
}

console.log("TopModul coder terminal source policy regression passed: physical 304° terminal replaces the generated 359° destination.");
