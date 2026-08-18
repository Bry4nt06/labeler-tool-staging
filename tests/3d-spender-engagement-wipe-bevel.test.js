"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/spender-engagement-wipe-bevel-integration.js");

test("spender engagement and wipe bevel layer loads after neck contact correction", () => {
  const neckIndex = bootstrap.indexOf('"app/3d/neck-contact-coder-correction-integration.js"');
  const refinementIndex = bootstrap.indexOf('"app/3d/spender-engagement-wipe-bevel-integration.js"');
  const handlingIndex = bootstrap.indexOf('"app/3d/bottle-handling-adapter.js"');
  assert.ok(neckIndex >= 0);
  assert.ok(refinementIndex > neckIndex);
  assert.ok(handlingIndex > refinementIndex);
});

test("all spender plates use the shared engagement pivot for opposite radial end corrections", () => {
  assert.match(source, /const SPENDER_ROOT_OUTSET_MM = 2;/);
  assert.match(source, /const SPENDER_DOWNSTREAM_INSET_MM = 2;/);
  assert.match(source, /ServoForgeEngagementAnglePivot/);
  assert.match(source, /totalRadialDeltaWorld/);
  assert.match(source, /Math\.atan2\(totalRadialDeltaWorld, plateLength\)/);
  assert.match(source, /pivot\.rotation\.y \+= outwardSign \* engagementAngleRadians/);
  assert.match(source, /rootOutsetMm: SPENDER_ROOT_OUTSET_MM/);
  assert.match(source, /downstreamInsetMm: SPENDER_DOWNSTREAM_INSET_MM/);
  assert.match(source, /mapAnglePreserved: true/);
});

test("wipe sponge has a leading entry bevel with label clearance while normal penetration remains measured", () => {
  assert.match(source, /const WIPE_LEADING_BEVEL_LENGTH_MM = 15;/);
  assert.match(source, /const WIPE_LEADING_BEVEL_DEPTH_MM = 6;/);
  assert.match(source, /function beveledAnnularPrismGeometry/);
  assert.match(source, /ServoForgeWipePadSponge18mm/);
  assert.match(source, /leadingBevelStart = "machine-map-start-angle"/);
  assert.match(source, /label-entry-clearance-before-full-wipe-contact/);
  assert.match(source, /normalContactPenetrationMm: number\(wipePad\?\.bottlePenetrationMm, 2\)/);
});

test("refinement remains 3D presentation-only", () => {
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
