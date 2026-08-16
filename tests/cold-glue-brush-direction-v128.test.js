"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/cold-glue-brush-direction-v128.js"), "utf8");

function makeContext(storedDirection = "cw") {
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
      buildInputs: { plateStartPositionDeg: 90 },
      coldGlueAggregateSettings: {
        machineSettings: { direction: storedDirection },
        aggregateAngles: { "1": 100 }
      },
      coldGlueMap: [
        {
          kind: "brush-channel",
          station: 1,
          start: 120,
          end: 150,
          outerStart: 120,
          outerEnd: 140,
          innerStart: 120,
          innerEnd: 150
        }
      ],
      motionPlan: { mapDriven: true, rows: [] }
    },
    activeMachineMap() {
      return {
        applicationMode: "cold-glue",
        machineSettings: { direction: storedDirection },
        aggregateAngles: { "1": 100 },
        objects: context.state.coldGlueMap
      };
    },
    ServoForgePhysicalWipeDirectionV125: {
      physicalDirectionForStored(stored) { return stored === "cw" ? "ccw" : "cw"; }
    },
    LabelerColdGlueMotionDriver: {
      centerOutSafetyInstalledV2: true,
      createPlan() {
        return {
          simultaneousOppositeWipe: true,
          process: [{ side: "inner", rotation: 40, direction: 1 }],
          final: [],
          holds: [{ holdAngle: 90 }],
          finalPlateTravel: 40
        };
      },
      applicationTarget(value) { return value; },
      flowFacingTarget() { return 90; }
    },
    generatedColdGlueFixedProfile() {
      return [
        { cmd: 3, tableAngle: 100, plateAngle: 90 },
        {
          cmd: 7,
          tableAngle: 140,
          plateAngle: 90,
          coldGlueCenterOut: true,
          station: 1,
          section: "neck",
          brushStage: "inner",
          brushSide: "inner",
          channelEntryAngle: 90,
          plannedRotation: 40
        },
        {
          cmd: 3,
          tableAngle: 150,
          plateAngle: 130,
          coldGlueCenterOut: true,
          station: 1,
          section: "neck",
          brushStage: "inner-complete",
          brushSide: "inner",
          channelEntryAngle: 90,
          plannedRotation: 40
        }
      ];
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "cold-glue-brush-direction-v128.js" });
  return context;
}

const physicalCcw = makeContext("cw");
const api = physicalCcw.ServoForgeColdGlueBrushDirectionV128;
assert.equal(api.physicalDirectionForStored("cw"), "ccw");
assert.equal(api.channelEntryAngle("cw"), -90);
assert.equal(api.wipeDirectionForSide("inner", "cw"), -1);
assert.equal(api.wipeDirectionForSide("outer", "cw"), 1);

const ccwPlan = physicalCcw.LabelerColdGlueMotionDriver.createPlan({ mapDirection: "cw" });
assert.equal(ccwPlan.process[0].direction, -1);
assert.equal(ccwPlan.holds[0].holdAngle, -90);
assert.equal(ccwPlan.leadingEdgeWipe, false);
assert.equal(ccwPlan.tackMode, "center");

const repaired = physicalCcw.generatedColdGlueFixedProfile();
const entryCorrection = repaired.find((row) => row.brushStage === "channel-entry" && row.cmd === 7);
const entryRest = repaired.find((row) => row.brushStage === "opposed" && row.cmd === 3);
const innerTurn = repaired.find((row) => row.brushStage === "inner" && row.cmd === 7);
const innerRest = repaired.find((row) => row.brushStage === "inner-complete" && row.cmd === 3);
assert.ok(entryCorrection, "center-tacked label must begin rotating before the brush channel");
assert.ok(entryCorrection.tableAngle < 120, "pre-brush correction must start before physical brush contact");
assert.equal(entryRest.tableAngle, 120);
assert.equal(entryRest.plateAngle, -90, "physical CCW must face the center-tacked label into the channel at -90 deg");
assert.equal(innerTurn.plateAngle, -90);
assert.equal(innerTurn.plannedDirection, -1);
assert.equal(innerRest.plateAngle, -130, "inside brush must continue from center toward the free edge");
assert.ok(repaired.every((row) => row.leadingEdgeWipe !== true), "Cold Glue must never generate a leading-edge wipe flag");

const physicalCw = makeContext("ccw");
const cwApi = physicalCw.ServoForgeColdGlueBrushDirectionV128;
assert.equal(cwApi.physicalDirectionForStored("ccw"), "cw");
assert.equal(cwApi.channelEntryAngle("ccw"), 90);
assert.equal(cwApi.wipeDirectionForSide("inner", "ccw"), 1);
assert.equal(cwApi.wipeDirectionForSide("outer", "ccw"), -1);

console.log("Cold Glue center-tack pre-brush direction v128 regression passed.");
