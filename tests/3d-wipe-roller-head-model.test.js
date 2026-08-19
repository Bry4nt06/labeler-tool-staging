"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const source = read("app/3d/models/wipe-roller.js");

test("wipe roller model owns native photo-backed roller-head geometry", () => {
  assert.match(source, /MODEL_VERSION = "servoforge\.3d-model\.wipe-roller\.v3-direct-head-hardware"/);
  assert.match(source, /migrationState: "native-model-geometry"/);
  assert.match(source, /directHeadHardwareAuthority: "user-machine-photo-backed-proportional"/);
});

test("roller head renders only hardware directly attached to the roller", () => {
  [
    "ServoForgeWipeRollerSponge",
    "ServoForgeWipeRollerSpindle",
    "ServoForgeWipeRollerHubLower",
    "ServoForgeWipeRollerHubUpper",
    "ServoForgeWipeRollerYokeLower",
    "ServoForgeWipeRollerYokeUpper",
    "ServoForgeWipeRollerYokeRearBridge",
    "ServoForgeWipeRollerImmediatePivotBlock",
    "ServoForgeWipeRollerPivotPin"
  ].forEach((name) => assert.match(source, new RegExp(name)));
  assert.match(source, /directRollerHardwareVisible: true/);
  assert.match(source, /stationMountingHardwareVisible: false/);
  assert.match(source, /mountingRailVisible: false/);
});

test("roller head keeps the 80 mm width and current neck contact orientation authority", () => {
  assert.match(source, /const ROLLER_WIDTH_MM = 80/);
  assert.match(source, /item\?\.contactHeightWorld/);
  assert.match(source, /neckSlopeReference/);
  assert.match(source, /item\?\.side === "inner"/);
  assert.match(source, /positionAuthority: "servoforge-machine-map-neck-contact"/);
  assert.match(source, /tiltAuthority: "existing-section-aware-neck-slope"/);
});

test("long station mounting system remains reference-only", () => {
  assert.match(source, /longLinkArmRendered: false/);
  assert.match(source, /riserRendered: false/);
  assert.match(source, /railClampRendered: false/);
  assert.match(source, /mountingRailRendered: false/);
  assert.match(source, /railAdjustmentHandleRendered: false/);
  assert.match(source, /referenceGeometryRetained: true/);
});

test("native roller model remains read-only to planner and servo state", () => {
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
