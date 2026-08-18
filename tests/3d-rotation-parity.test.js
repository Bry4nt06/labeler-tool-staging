"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

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
  "app/3d/scene-adapter.js"
].forEach((relative) => vm.runInContext(read(relative), sandbox, { filename: relative }));

const rows = [
  { hmi: 1, plc: 0, cmd: 3, tableAngle: 90, plateAngle: 0, action: "Initial hold" },
  { hmi: 2, plc: 1, cmd: 7, tableAngle: 100, plateAngle: 0, action: "Wipe turn" },
  { hmi: 3, plc: 2, cmd: 3, tableAngle: 120, plateAngle: 95.6, action: "Wipe hold" }
];

const frame = sandbox.Labeler3DSimulationFrameDriver.snapshot(rows, 110, {
  commandDriver: sandbox.LabelerServoCommandDriver
});
assert.ok(Math.abs(frame.container.servoAngleUnwrapped - 47.8) < 1e-6);

const deg = (value) => value * Math.PI / 180;
const near = (actual, expected, message) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
};

function threePlusXDirection(rotationY) {
  // Three.js right-handed Y rotation maps local +X to (cos(theta), 0, -sin(theta)).
  return { x: Math.cos(rotationY), z: -Math.sin(rotationY) };
}

function expectedMapDirection(angleDegrees) {
  return { x: Math.cos(deg(angleDegrees)), z: Math.sin(deg(angleDegrees)) };
}

// ServoForge 2D authority for CCW:
// referenceRotation = mapBearing + (+1 * servoAngle) = 110 + 47.8 = 157.8 degrees.
const ccw = sandbox.Labeler3DSceneAdapter.toSceneState(frame, {
  carouselRadius: 1,
  carouselDirection: "ccw",
  zeroAngleDegrees: 0
});
near(ccw.carousel.rotationY, -deg(110), "CCW table facing must negate the ServoForge map bearing for Three.js");
near(ccw.bottle.servoRotationY, -deg(47.8), "CCW local servo turn must visually match the 2D positive turn");
near(ccw.bottle.rotation.y, -deg(157.8), "CCW absolute bottle rotation must match the 2D top-view formula");
let actual = threePlusXDirection(ccw.bottle.rotation.y);
let expected = expectedMapDirection(157.8);
near(actual.x, expected.x, "CCW bottle +X datum x parity");
near(actual.z, expected.z, "CCW bottle +X datum z parity");

// ServoForge 2D authority for CW:
// mapBearing = 180 - 110 = 70 degrees
// referenceRotation = 70 + (-1 * 47.8) = 22.2 degrees.
const cw = sandbox.Labeler3DSceneAdapter.toSceneState(frame, {
  carouselRadius: 1,
  carouselDirection: "cw",
  zeroAngleDegrees: 0
});
near(cw.carousel.rotationY, -deg(70), "CW table facing must negate the ServoForge map bearing for Three.js");
near(cw.bottle.servoRotationY, deg(47.8), "CW local servo turn must visually match the 2D negative turn");
near(cw.bottle.rotation.y, -deg(22.2), "CW absolute bottle rotation must match the 2D top-view formula");
actual = threePlusXDirection(cw.bottle.rotation.y);
expected = expectedMapDirection(22.2);
near(actual.x, expected.x, "CW bottle +X datum x parity");
near(actual.z, expected.z, "CW bottle +X datum z parity");

assert.strictEqual(ccw.world.mapToThreeRotationY, "negate-map-plane-radians");
assert.strictEqual(cw.world.mapToThreeRotationY, "negate-map-plane-radians");

console.log("ServoForge 2D/3D bottle rotation parity regression passed for CCW and CW wipe turns.");
