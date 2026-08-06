"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "apl-post-wipe-sensor-hold-integration.js"), "utf8");
const startup = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(source));
assert.match(source, /motion\.apl-post-wipe-sensor-hold/);
assert.match(source, /HOLD_TRAVEL_DEG\s*=\s*0\.5/);
assert.match(source, /maxConsecutiveCorrections/);
assert.match(source, /postApplicationSetupHold/);
assert.match(source, /wipeSensorSetupHold/);
assert.match(source, /sensorSetupAfterHold/);
assert.match(startup, /apl-post-wipe-sensor-hold-v23/);
assert.match(startup, /apl-post-wipe-sensor-hold-integration\.js/);

const stages = new Map([
  ["orientation.map-objects", { id: "orientation.map-objects", order: 300, process: (rows) => rows }]
]);
const pipeline = {
  getStage(id) { return stages.get(id) || null; },
  registerStage(stage) { stages.set(stage.id, stage); return stage; }
};
const context = {
  console,
  state: { motionPlan: {} },
  finishAngle(value) { return Math.round(Number(value) * 10) / 10; },
  applyGeneratedServoProfile() {},
  renderProgram() {},
  renderValidation() {},
  setTimeout(callback) { callback(); },
  LabelerDriverRegistry: {
    resolve(name) { return name === "profile.pipeline" ? pipeline : null; }
  }
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context);

const api = context.LabelerAplPostWipeSensorHold;
assert.equal(api.installed, true);
assert.equal(stages.get("motion.apl-post-wipe-sensor-hold").order, 350);

const sourceRows = [
  {
    hmi: 20,
    plc: 19,
    cmd: 7,
    tableAngle: 230,
    plateAngle: 7.5,
    action: "Hold for Back Label Application - Agg 6",
    station: 6,
    section: "back",
    applicationReference: true
  },
  {
    hmi: 21,
    plc: 20,
    cmd: 7,
    tableAngle: 240,
    plateAngle: 100,
    action: "Wipe Turn 1 Back - Agg 6",
    station: 6,
    section: "back",
    stage: "set-down"
  },
  {
    hmi: 22,
    plc: 21,
    cmd: 7,
    tableAngle: 250,
    plateAngle: 180,
    action: "Wipe Turn 2 Back - Agg 6",
    station: 6,
    section: "back",
    stage: "wipe"
  },
  {
    hmi: 23,
    plc: 22,
    cmd: 7,
    tableAngle: 260,
    plateAngle: 107.3,
    action: "Wipe Hold Back - Agg 6",
    station: 6,
    section: "back",
    stage: "complete",
    mapObjectOrientation: true,
    orientationConstraintPlanner: true,
    orientationConstraintContinuation: true,
    orientationObjectId: "back-sensor",
    orientationObjectIds: ["back-sensor"],
    sensorId: "back-sensor",
    sensorIds: ["back-sensor"]
  },
  {
    hmi: 24,
    plc: 23,
    cmd: 3,
    tableAngle: 272,
    plateAngle: 34.6,
    action: "Hold Back Orientation Through Back Label Sensor",
    station: 6,
    section: "back",
    orientationHold: true,
    orientationObjectId: "back-sensor",
    orientationObjectIds: ["back-sensor"],
    sensorId: "back-sensor",
    sensorIds: ["back-sensor"],
    inspectionWindowStart: 272,
    inspectionWindowStop: 275
  }
];

const result = api.repair(sourceRows);
assert.deepEqual(
  Array.from(result.rows, (row) => Number(row.cmd)),
  [7, 3, 7, 7, 3, 7, 3],
  "The application setup, two-step wipe, stopped wipe hold, and sensor turn must be separated by CMD 3 references."
);
assert.equal(result.maxConsecutiveCorrections, 2);
assert.equal(result.changes.length, 1);
assert.equal(result.unresolved.length, 0);

const applicationHold = result.rows.find((row) => row.postApplicationSetupHold === true);
assert.ok(applicationHold);
assert.equal(applicationHold.cmd, 3);
assert.equal(applicationHold.tableAngle, 239.5);
assert.equal(applicationHold.plateAngle, 100);

const wipeHold = result.rows.find((row) => row.wipeSensorSetupHold === true);
assert.ok(wipeHold);
assert.equal(wipeHold.cmd, 3);
assert.equal(wipeHold.tableAngle, 260);
assert.equal(wipeHold.plateAngle, 107.3);
assert.equal(wipeHold.sensorId, undefined, "The physical wipe hold must not retain sensor-turn metadata.");

const sensorTurn = result.rows.find((row) => row.sensorSetupAfterHold === true);
assert.ok(sensorTurn);
assert.equal(sensorTurn.cmd, 7);
assert.equal(sensorTurn.tableAngle, 260.5);
assert.equal(sensorTurn.plateAngle, 107.3);
assert.equal(sensorTurn.sensorId, "back-sensor");
assert.match(sensorTurn.action, /Orient Back Label for Back Label Sensor/);
assert.equal(Number(sensorTurn.plannedRotation.toFixed(1)), -72.7);

const originalSensorHold = result.rows.at(-1);
assert.equal(originalSensorHold.tableAngle, 272);
assert.equal(originalSensorHold.sensorId, "back-sensor", "The configured sensor position must remain unchanged.");
assert.deepEqual(sourceRows.map((row) => row.cmd), [7, 7, 7, 7, 3], "The repair must not mutate the source rows.");

const noMatch = api.repair([
  { cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
  { cmd: 7, tableAngle: 10, plateAngle: 0, action: "General Correction" },
  { cmd: 3, tableAngle: 20, plateAngle: 20, action: "Reference" }
]);
assert.equal(noMatch.changes.length, 0);
assert.equal(noMatch.rows.length, 3);

console.log("APL post-wipe sensor hold regression passed.");
