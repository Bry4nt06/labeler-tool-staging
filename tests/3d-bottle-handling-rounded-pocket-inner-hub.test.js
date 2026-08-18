"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/bottle-handling-rounded-pocket-inner-hub-integration.js");

test("rounded pocket / inner hub layer is the final star-wheel presentation authority", () => {
  const unified = bootstrap.indexOf('"app/3d/bottle-handling-unified-star-height-thickness-integration.js"');
  const rounded = bootstrap.indexOf('"app/3d/bottle-handling-rounded-pocket-inner-hub-integration.js"');
  const runtime = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(unified >= 0);
  assert.ok(rounded > unified);
  assert.ok(runtime > rounded);
});

test("all three stars retain the common raised 80 mm body envelope", () => {
  assert.match(source, /const STAR_THICKNESS_MM = 80;/);
  assert.match(source, /const STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM = 30;/);
  assert.match(source, /ServoForgeInfeedStar/);
  assert.match(source, /ServoForgeIntermediateStar/);
  assert.match(source, /ServoForgeDischargeStar/);
  assert.match(source, /group\.position\.y = centerY/);
  assert.match(source, /allThreeStarsSameVerticalCenter:\s*true/);
});

test("pockets are true circular bottle-clearance arcs with visible bottle clearance", () => {
  assert.match(source, /const POCKET_DIAMETRAL_CLEARANCE_MM = 3;/);
  assert.match(source, /pocketDiameterMm = bottleDiameterMm\(snapshot\) \+ POCKET_DIAMETRAL_CLEARANCE_MM/);
  assert.match(source, /radialClearanceMm:\s*POCKET_DIAMETRAL_CLEARANCE_MM \/ 2/);
  assert.match(source, /const beta = centerAngle \+ Math\.PI \+ gamma - \(2 \* gamma \* t\)/);
  assert.match(source, /pocketShapeAuthority = "true-circular-bottle-clearance-arc"/);
});

test("inner wheel presentation follows the supplied drawing hierarchy", () => {
  assert.match(source, /ServoForgeStarDrawingInnerAssembly/);
  assert.match(source, /ServoForgeStarInnerMountingRing/);
  assert.match(source, /ServoForgeStarInnerCouplingPlate/);
  assert.match(source, /const PRIMARY_BOLT_COUNT = 4;/);
  assert.match(source, /const SECONDARY_BOLT_COUNT = 8;/);
  assert.match(source, /user-supplied-star-wheel-drawing-2026-08-18/);
  assert.match(source, /dimensionalAuthority = false/);
  assert.match(source, /visualHierarchyAuthority = true/);
});

test("star drawing refinement remains read only", () => {
  [
    /state\.program\s*=/,
    /buildPlannerMotion\s*\(/,
    /setServoAngleOverride\s*\(/,
    /saveCurrentSettings\s*\(/,
    /simulation\.lines\s*=/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern, `presentation layer must stay read-only: ${pattern}`));
  assert.match(source, /readOnly:\s*true/);
});
