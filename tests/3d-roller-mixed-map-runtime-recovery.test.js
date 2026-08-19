"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/roller-shared-bracket-runtime-recovery-integration.js");

test("runtime recovery loads after shared roller bracket and before later equipment presentation", () => {
  const sharedIndex = bootstrap.indexOf('"app/3d/roller-shared-bracket-refinement-integration.js"');
  const recoveryIndex = bootstrap.indexOf('"app/3d/roller-shared-bracket-runtime-recovery-integration.js"');
  const spenderIndex = bootstrap.indexOf('"app/3d/spender-engagement-wipe-bevel-integration.js"');
  assert.ok(sharedIndex >= 0);
  assert.ok(recoveryIndex > sharedIndex);
  assert.ok(spenderIndex > recoveryIndex);
});

test("mixed equipment maps retain non-roller hardware rendering", () => {
  assert.match(source, /if \(item\?\.kind === "roller"\) return createRecoveredRollerAssembly\(THREE, item, geometry\);/);
  assert.match(source, /return baseFactory\.createEquipmentAssembly\(THREE, item, geometry\);/);
  assert.match(source, /mixedEquipmentMapsSupported: true/);
});

test("roller-only presentation keeps the approved 80 mm roller core", () => {
  assert.match(source, /const ROLLER_WIDTH_MM = 80/);
  assert.match(source, /ServoForgePurposeViewRoller/);
  assert.match(source, /ServoForgeRollerSpindleShaft/);
  assert.match(source, /ServoForgeRollerHubLower/);
  assert.match(source, /ServoForgeRollerHubUpper/);
});

test("mounting hardware is hidden while rail and bracket references are retained", () => {
  assert.match(source, /const RAIL_DIAMETER_MM = 14/);
  assert.match(source, /const POST_DIAMETER_MM = 12/);
  assert.match(source, /const OUTER_OUTSET_MM = 125/);
  assert.match(source, /const INNER_INSET_MM = 125/);
  assert.match(source, /referenceOnly: true/);
  assert.match(source, /railRendered: false/);
  assert.match(source, /carrierArmsRendered: false/);
  assert.match(source, /clampsRendered: false/);
  assert.match(source, /supportPostRendered: false/);
  assert.match(source, /supportFootRendered: false/);
  assert.match(source, /railsRetainedAsReference: true/);
  assert.match(source, /mountingHardwareRetainedAsReference: true/);
  assert.match(source, /threePointRadialAlignment: true/);
  assert.doesNotMatch(source, /ServoForgeSharedRollerMountRail/);
  assert.doesNotMatch(source, /ServoForgeSharedRollerCarrierArm/);
  assert.doesNotMatch(source, /ServoForgeSharedRollerClamp/);
  assert.doesNotMatch(source, /ServoForgeSharedRollerSupportPost/);
  assert.doesNotMatch(source, /ServoForgeSharedRollerSupportFoot/);
});

test("runtime recovery stays presentation-only", () => {
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
