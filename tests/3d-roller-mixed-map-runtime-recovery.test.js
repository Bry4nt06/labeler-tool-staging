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

test("roller vector helpers receive THREE explicitly and cannot throw from a free THREE identifier", () => {
  assert.match(source, /function localMemberPosition\(THREE, member, masterPosition/);
  assert.match(source, /function mountPointForMember\(THREE, member, masterPosition/);
  assert.match(source, /localMemberPosition\(THREE, member, masterPosition/);
  assert.match(source, /mountPointForMember\(THREE, member, masterPosition/);
});

test("mixed equipment maps retain non-roller hardware rendering", () => {
  assert.match(source, /if \(item\?\.kind === "roller"\) return createRecoveredRollerAssembly\(THREE, item, geometry\);/);
  assert.match(source, /return baseFactory\.createEquipmentAssembly\(THREE, item, geometry\);/);
  assert.match(source, /mixedEquipmentMapsSupported: true/);
});

test("recovered roller keeps approved compact bracket dimensions and 80 mm roller width", () => {
  assert.match(source, /const ROLLER_WIDTH_MM = 80/);
  assert.match(source, /const RAIL_DIAMETER_MM = 14/);
  assert.match(source, /const POST_DIAMETER_MM = 12/);
  assert.match(source, /ServoForgeSharedRollerMountRail/);
  assert.match(source, /ServoForgeSharedRollerSupportPost/);
  assert.match(source, /threePointRadialAlignment: true/);
});

test("inside and outside rollers use the same mirrored mounting architecture", () => {
  assert.match(source, /const OUTER_OUTSET_MM = 125/);
  assert.match(source, /const INNER_INSET_MM = 125/);
  assert.match(source, /insideHardwareRadiallyInward: side === "inner"/);
  assert.match(source, /outsideHardwareRadiallyOutward: side === "outer"/);
  assert.match(source, /mirroredMountingSetup: true/);
  assert.match(source, /sameTubeAndBracketGeometryBothSides: true/);
  assert.match(source, /same-bracket-hardware-mirrored-radially-by-side/);
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
