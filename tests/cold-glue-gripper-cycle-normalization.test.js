"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/cold-glue-gripper-channel-integration.js"), "utf8");

function runScenario(previousTable, gripperAngle, brushStart, brushEnd) {
  const map = {
    applicationMode: "cold-glue",
    aggregateCount: 1,
    stationCount: 1,
    enabledAggregates: [true, false, false, false, false, false],
    enabledStations: [true, false, false, false, false, false],
    objects: [
      { id: "gripper-1", kind: "gripper", application: "cold-glue", station: 1, angle: gripperAngle },
      {
        id: "channel-1",
        kind: "brush-channel",
        application: "cold-glue",
        station: 1,
        outerStart: brushStart,
        outerEnd: brushEnd,
        innerStart: brushStart,
        innerEnd: brushEnd
      }
    ]
  };
  const state = {
    direction: "ccw",
    maxMoveRatio: 21,
    buildInputs: { plateStartPositionDeg: 45 },
    coldGlueMap: map.objects.map((item) => ({ ...item })),
    coldGlueAggregateSettings: {},
    motionPlan: { mapDriven: true, issues: [] }
  };
  const seedRows = [
    { hmi: 1, plc: 0, cmd: 3, tableAngle: previousTable, plateAngle: 45, action: "Previous" },
    { hmi: 2, plc: 1, cmd: 3, tableAngle: gripperAngle, plateAngle: 0, action: "Neck Application", station: 1, section: "neck" },
    { hmi: 3, plc: 2, cmd: 3, tableAngle: brushEnd, plateAngle: 90, action: "Neck Complete", station: 1, section: "neck" }
  ];
  const context = {
    console,
    state,
    document: { readyState: "complete" },
    activeMachineMap: () => map,
    generatedColdGlueFixedProfile: () => seedRows.map((row) => ({ ...row })),
    sectionWipePlan: () => ({ labelDeg: 65, overWipeDeg: 0 }),
    selectedNeckWrapPlan: () => ({ resolvedMode: "standard" }),
    finishAngle: (value) => Math.round(Number(value) * 10) / 10,
    normalizeEnabledSlots(value, count) {
      const slots = Array.from({ length: 6 }, (_, index) => value?.[index] ?? index < count);
      if (!slots.some(Boolean)) slots[0] = true;
      return slots;
    },
    LabelerColdGlueMotionDriver: {
      wipeDirectionForSide(side) { return side === "inner" ? -1 : 1; }
    },
    setTimeout() { throw new Error("integration should install immediately"); }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "cold-glue-gripper-channel-integration.js" });
  return context.generatedColdGlueFixedProfile();
}

// A small geometric backtrack is not a 360/0 seam crossing. The gripper must
// stay on the local table cycle instead of being pushed forward by 360 degrees.
const localBacktrack = runScenario(88.5, 87, 92, 120);
const localGripper = localBacktrack.find((row) => row.brushStage === "gripper-application");
assert.ok(localGripper, "local-backtrack scenario must emit the gripper application row");
assert.equal(localGripper.tableAngle, 87);
assert.ok(localGripper.tableAngle < 360, "87 degrees must not be rewritten as 447 degrees");

// A true 360/0 seam crossing must still unwrap onto the next table cycle.
const seamCrossing = runScenario(358, 2, 10, 40);
const seamGripper = seamCrossing.find((row) => row.brushStage === "gripper-application");
assert.ok(seamGripper, "seam-crossing scenario must emit the gripper application row");
assert.equal(seamGripper.tableAngle, 362);

console.log("Cold Glue gripper cycle normalization regression passed.");
