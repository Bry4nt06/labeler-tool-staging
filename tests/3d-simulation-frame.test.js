"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");

[
  "drivers/simulation/three-d-simulation-frame-driver.js",
  "app/3d/scene-adapter.js",
  "app/3d/scene-runtime.js"
].forEach((modulePath) => {
  assert.ok(bootstrap.includes(modulePath), `${modulePath} must be loaded by the ServoForge bootstrap.`);
});

const sandbox = {
  window: {},
  console,
  Math,
  Object,
  Array,
  Number,
  String,
  Boolean,
  Set,
  Map
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

[
  "drivers/servo/servo-command-driver.js",
  "drivers/simulation/servo-replay-driver.js",
  "drivers/simulation/three-d-simulation-frame-driver.js",
  "app/3d/scene-adapter.js",
  "app/3d/scene-runtime.js"
].forEach((relative) => vm.runInContext(read(relative), sandbox, { filename: relative }));

const rows = [
  { hmi: 1, plc: 0, cmd: 3, tableAngle: 90, plateAngle: 0, action: "Initial hold" },
  { hmi: 2, plc: 1, cmd: 7, tableAngle: 100, plateAngle: 0, action: "First correction" },
  { hmi: 3, plc: 2, cmd: 3, tableAngle: 120, plateAngle: 95.6, action: "Application hold" },
  { hmi: 4, plc: 3, cmd: 7, tableAngle: 145, plateAngle: 95.6, action: "Second correction" },
  { hmi: 5, plc: 4, cmd: 3, tableAngle: 170, plateAngle: 180, action: "Final hold" }
];
const originalRows = JSON.stringify(rows);
const driver = sandbox.Labeler3DSimulationFrameDriver;
const adapter = sandbox.Labeler3DSceneAdapter;

assert.ok(driver, "3D simulation frame driver must register globally.");
assert.ok(adapter, "3D scene adapter must register globally.");
assert.strictEqual(driver.SCHEMA_VERSION, "servoforge.3d-frame.v1");

let frame = driver.snapshot(rows, 95, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(frame.flags.hold, true, "CMD 3 must remain a physical hold in the 3D contract.");
assert.strictEqual(frame.container.servoAngleUnwrapped, 0, "CMD 3 may not interpolate toward the following waypoint.");

frame = driver.snapshot(rows, 110, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(frame.servo.command, 7);
assert.strictEqual(frame.flags.executesRotation, true);
assert.ok(Math.abs(frame.container.servoAngleUnwrapped - 47.8) < 0.000001, "CMD 7 must interpolate the commanded bottle rotation exactly.");

frame = driver.snapshot(rows, 130, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(frame.servo.command, 3);
assert.ok(Math.abs(frame.container.servoAngleUnwrapped - 95.6) < 0.000001, "The next Rest stage must hold the completed correction angle.");

frame = driver.snapshot(rows, 157.5, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.ok(Math.abs(frame.container.servoAngleUnwrapped - 137.8) < 0.000001, "The second correction must preserve numerical servo parity.");
assert.ok(Math.abs(frame.container.cumulativeNetRotation - 137.8) < 0.000001, "Cumulative net rotation must be deterministic.");

const sceneFrame = driver.snapshot(rows, 120, { commandDriver: sandbox.LabelerServoCommandDriver });
const scene = adapter.toSceneState(sceneFrame, { carouselRadius: 2, carouselDirection: "cw", zeroAngleDegrees: 0 });
assert.strictEqual(scene.schemaVersion, "servoforge.3d-scene.v1");
assert.strictEqual(scene.world.mapCoordinateParity, true);
assert.ok(Math.abs(scene.bottleTable.position.x - 1) < 0.000001, "Clockwise 120 degree table position must mirror ServoForge angleToXY X coordinates.");
assert.ok(Math.abs(scene.bottleTable.position.z - Math.sqrt(3)) < 0.000001, "Clockwise 120 degree table position must mirror ServoForge angleToXY Y coordinates on the XZ plane.");
assert.ok(Math.abs(scene.bottle.servoAngleDegrees - 95.6) < 0.000001, "Scene bottle rotation must use the exact servo angle from the frame contract.");

sandbox.state = { program: rows, previewAngle: 110, direction: "ccw", zeroAngle: 0 };
const runtimeSnapshot = sandbox.Labeler3DSceneRuntime.snapshot({ commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(runtimeSnapshot.readOnly, true, "3D runtime must remain read-only.");
assert.ok(Math.abs(runtimeSnapshot.frame.container.servoAngleUnwrapped - 47.8) < 0.000001, "Runtime must source the generated Servo Program and current preview angle.");
assert.strictEqual(JSON.stringify(rows), originalRows, "3D frame generation must not mutate Servo Program rows.");
assert.ok(Object.isFrozen(runtimeSnapshot.frame), "Published 3D frames must be immutable.");
assert.ok(Object.isFrozen(runtimeSnapshot.scene), "Published 3D scene states must be immutable.");

console.log("ServoForge 3D simulation-frame parity regression passed.");
