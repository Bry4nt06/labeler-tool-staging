"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/cold-glue-brush-runtime-v131.js"), "utf8");

function makeContext(storedDirection) {
  const map = {
    applicationMode: "cold-glue",
    machineSettings: { direction: storedDirection },
    objects: [
      { id: "channel", kind: "brush-channel", application: "cold-glue", station: 1, outerStart: 120, outerEnd: 128, innerStart: 120, innerEnd: 136 }
    ]
  };

  const context = {
    console,
    setTimeout(callback) { callback(); return 1; },
    document: {
      readyState: "complete",
      getElementById(id) { return id === "mapDirection" ? { value: storedDirection } : null; },
      querySelector() { return null; }
    },
    state: {
      maxMoveRatio: 21,
      buildInputs: { plateStartPositionDeg: 0 },
      motionPlan: { mapDriven: true, rows: [], issues: [] }
    },
    activeMachineMap() { return map; },
    ServoForgePhysicalWipeDirectionV125: {
      physicalDirectionForStored(stored) { return stored === "cw" ? "ccw" : "cw"; }
    },
    generatedColdGlueFixedProfile() {
      return [
        {
          cmd: 3,
          tableAngle: 110,
          plateAngle: 0,
          station: 1,
          section: "neck",
          coldGlueNeckTwoSideWipe: true,
          brushStage: "gripper-application",
          action: "Hold Neck Label Centerline Through Gripper Application"
        },
        {
          cmd: 3,
          tableAngle: 120,
          plateAngle: 0,
          station: 1,
          section: "neck",
          coldGlueNeckTwoSideWipe: true,
          brushStage: "press-both-sides",
          action: "Press Both Loose Neck Label Sides Down"
        },
        {
          cmd: 7,
          tableAngle: 120.1,
          plateAngle: 0,
          station: 1,
          section: "neck",
          coldGlueNeckTwoSideWipe: true,
          brushStage: "left",
          neckWipeSide: "left",
          objectIds: ["channel-outer"],
          plannedRotation: -45
        },
        {
          cmd: 3,
          tableAngle: 124,
          plateAngle: -45,
          station: 1,
          section: "neck",
          coldGlueNeckTwoSideWipe: true,
          brushStage: "left-complete",
          neckWipeSide: "left",
          objectIds: ["channel-outer"],
          plannedRotation: -45
        },
        {
          cmd: 7,
          tableAngle: 124.1,
          plateAngle: -45,
          station: 1,
          section: "neck",
          coldGlueNeckTwoSideWipe: true,
          brushStage: "right",
          neckWipeSide: "right",
          objectIds: ["channel-inner"],
          plannedRotation: 90
        },
        {
          cmd: 3,
          tableAngle: 132,
          plateAngle: 45,
          station: 1,
          section: "neck",
          coldGlueNeckTwoSideWipe: true,
          brushStage: "right-complete",
          neckWipeSide: "right",
          objectIds: ["channel-inner"],
          plannedRotation: 90
        }
      ];
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "cold-glue-brush-runtime-v131.js" });
  return context;
}

const physicalClockwise = makeContext("ccw");
const clockwiseRows = physicalClockwise.generatedColdGlueFixedProfile();
const clockwiseApi = physicalClockwise.ServoForgeColdGlueBrushRuntimeV131;
assert.ok(clockwiseApi?.installed);
assert.equal(clockwiseApi.physicalDirectionForStored("ccw"), "cw");
assert.equal(clockwiseApi.channelEntryAngle("ccw"), 90);

const cwApplication = clockwiseRows.find((row) => row.brushStage === "gripper-application");
const cwPreBrush = clockwiseRows.find((row) => row.brushStage === "pre-brush-entry");
const cwContact = clockwiseRows.find((row) => row.brushStage === "press-both-sides");
const cwOuter = clockwiseRows.find((row) => row.brushStage === "left" && row.cmd === 7);
const cwInner = clockwiseRows.find((row) => row.brushStage === "right" && row.cmd === 7);

assert.equal(cwApplication.cmd, 3, "center-tack application must remain a hold, not a turn");
assert.ok(cwPreBrush, "the bottle must begin its brush-facing move before physical brush contact");
assert.ok(cwPreBrush.tableAngle > cwApplication.tableAngle, "pre-brush spin must begin after center-tack application");
assert.ok(cwPreBrush.tableAngle < cwContact.tableAngle, "pre-brush spin must begin before brush contact");
assert.equal(cwContact.plateAngle, 90, "physical clockwise machines must face the center-tacked label into the brush at +90 degrees");
assert.equal(cwOuter.plannedDirection, -1, "outside brush wipe must follow physical clockwise center-out direction");
assert.equal(cwOuter.plannedRotation, -45);
assert.equal(cwInner.plannedDirection, 1, "inside brush wipe must follow physical clockwise center-out direction");
assert.equal(cwInner.plannedRotation, 90);
assert.ok(clockwiseRows.every((row) => row.leadingEdgeWipe !== true), "Cold Glue must never generate leading-edge wipe behavior");
assert.ok(clockwiseRows.filter((row) => row.coldGlueNeckTwoSideWipe).every((row) => row.tackMode === "center"));

const physicalCounterClockwise = makeContext("cw");
const counterClockwiseRows = physicalCounterClockwise.generatedColdGlueFixedProfile();
const counterClockwiseApi = physicalCounterClockwise.ServoForgeColdGlueBrushRuntimeV131;
assert.equal(counterClockwiseApi.physicalDirectionForStored("cw"), "ccw");
assert.equal(counterClockwiseApi.channelEntryAngle("cw"), -90);
const ccwContact = counterClockwiseRows.find((row) => row.brushStage === "press-both-sides");
const ccwOuter = counterClockwiseRows.find((row) => row.brushStage === "left" && row.cmd === 7);
const ccwInner = counterClockwiseRows.find((row) => row.brushStage === "right" && row.cmd === 7);
assert.equal(ccwContact.plateAngle, -90, "physical counter-clockwise machines must mirror brush entry to -90 degrees");
assert.equal(ccwOuter.plannedDirection, 1);
assert.equal(ccwOuter.plannedRotation, 45);
assert.equal(ccwInner.plannedDirection, -1);
assert.equal(ccwInner.plannedRotation, -90);

console.log("Cold Glue center-tack pre-brush runtime v131 regression passed.");
