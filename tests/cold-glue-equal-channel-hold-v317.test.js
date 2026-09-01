"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/cold-glue-gripper-channel-integration.js"), "utf8");
const map = {
  applicationMode: "cold-glue",
  aggregateCount: 1,
  stationCount: 1,
  enabledAggregates: [true, false, false, false, false, false],
  enabledStations: [true, false, false, false, false, false],
  aggregateAngles: { "1": 68.5 },
  stationAngles: { "1": 68.5 },
  objects: [{
    id: "equal-channel",
    kind: "brush-channel",
    application: "cold-glue",
    station: 1,
    outerStart: 83.9,
    outerEnd: 113.9,
    innerStart: 83.9,
    innerEnd: 113.9
  }]
};
const state = {
  direction: "ccw",
  maxMoveRatio: 21,
  buildInputs: { plateStartPositionDeg: 0 },
  coldGlueMap: map.objects.map((item) => ({ ...item })),
  coldGlueAggregateSettings: { aggregateAngles: { "1": 68.5 } },
  motionPlan: { mapDriven: true, issues: [] }
};
const seedRows = [
  { hmi: 1, plc: 0, cmd: 3, tableAngle: 0, plateAngle: 0, action: "Start" },
  { hmi: 2, plc: 1, cmd: 3, tableAngle: 68.5, plateAngle: 0, action: "Neck Application", station: 1, section: "neck" },
  { hmi: 3, plc: 2, cmd: 3, tableAngle: 113.9, plateAngle: 90, action: "Neck Complete", station: 1, section: "neck" }
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

const rows = context.generatedColdGlueFixedProfile();
const entry = rows.find((row) => row.brushStage === "opposed");
const exit = rows.find((row) => row.brushStage === "opposed-exit");
assert.ok(entry, "equal channel must define the 90-degree hold at brush entry");
assert.ok(exit, "equal channel must define the same hold at brush exit");
assert.equal(entry.tableAngle, 83.9);
assert.equal(exit.tableAngle, 113.9);
assert.equal(entry.plateAngle, 90);
assert.equal(exit.plateAngle, 90);
assert.equal(exit.equalLengthChannel, true);
assert.equal(state.motionPlan.issues.some((issue) => issue.code === "cold-glue-center-out-runout-missing"), false);
assert.equal(state.motionPlan.issues.some((issue) => issue.code === "cold-glue-gripper-centerline-fallback"), false,
  "the enabled Aggregate 1 spender datum must satisfy the gripper reference");

const driverSource = fs.readFileSync(path.join(root, "drivers/mechanical/cold-glue-motion-driver.js"), "utf8");
const profileSource = fs.readFileSync(path.join(root, "app/cold-glue-profile-generation.js"), "utf8");
const canonicalState = {
  headCount: 60,
  maxMoveRatio: 21,
  buildInputs: { plateStartPositionDeg: 0 },
  coldGlueMap: map.objects.map((item) => ({ ...item })),
  coldGlueAggregateSettings: {
    enabledAggregates: [...map.enabledAggregates],
    enabledStations: [...map.enabledStations],
    aggregateAngles: { "1": 68.5 },
    machineSettings: { direction: "ccw" }
  }
};
const canonical = {
  console,
  state: canonicalState,
  activeMachineMap: () => map,
  activeSlotNumbers: (slots) => slots.map((enabled, index) => enabled ? index + 1 : null).filter(Boolean),
  selectedLabelApplicationState: () => ({ neck: true, body: false, back: false }),
  selectedNeckWrapPlan: () => ({ resolvedMode: "full-wrap-overlap", fullWrapReady: false }),
  sectionWipePlan: () => ({ labelDeg: 65, overWipeDeg: 0 }),
  generatedAplSeedProfile: () => Array.from({ length: 22 }, (_, index) => ({ plateAngle: index === 1 ? 0 : 0 })),
  inferredMapObjectStation: (item) => item.station,
  sectionLabel: (section) => section[0].toUpperCase() + section.slice(1),
  num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  norm(value) {
    const angle = Number(value) % 360;
    return angle < 0 ? angle + 360 : angle;
  },
  finishAngle: (value) => Math.round(Number(value) * 10) / 10,
  window: null
};
canonical.window = canonical;
vm.createContext(canonical);
vm.runInContext(driverSource, canonical, { filename: "cold-glue-motion-driver.js" });
vm.runInContext(profileSource, canonical, { filename: "cold-glue-profile-generation.js" });
const canonicalRows = canonical.generatedColdGlueFixedProfile();
const canonicalExit = canonicalRows.find((row) => row.equalLengthChannel && row.brushStage === "opposed-exit");
assert.ok(canonicalExit, "the canonical profile must also hold through an equal channel when Full Wrap routes around the legacy adapter");
assert.ok(canonicalExit.tableAngle >= 113.9,
  "the canonical exit/terminal hold must remain at or beyond the physical channel exit");
assert.equal(canonicalExit.plateAngle, 90);

console.log("Cold Glue equal-length channel 90-degree hold and aggregate spender authority regression passed.");
