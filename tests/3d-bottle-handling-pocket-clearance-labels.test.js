"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/bottle-handling-pocket-clearance-label-restore-integration.js");

test("pocket clearance and label restoration layer loads after star presentation and before final direction parity", () => {
  const phaseIndex = bootstrap.indexOf('"app/3d/bottle-handling-pocket-phase-presentation-integration.js"');
  const restoreIndex = bootstrap.indexOf('"app/3d/bottle-handling-pocket-clearance-label-restore-integration.js"');
  const parityIndex = bootstrap.indexOf('"app/3d/three-d-direction-parity-presentation-integration.js"');
  assert.ok(phaseIndex >= 0);
  assert.ok(restoreIndex > phaseIndex);
  assert.ok(parityIndex > restoreIndex);
});

test("star body uses user-specified 60 mm thickness and active bottle diameter plus functional pocket clearance", () => {
  assert.match(source, /const STAR_THICKNESS_MM = 60;/);
  assert.match(source, /const POCKET_DIAMETRAL_CLEARANCE_MM = 3;/);
  assert.match(source, /resolveBottleDiameterMm\(snapshot\) \+ POCKET_DIAMETRAL_CLEARANCE_MM/);
  assert.match(source, /new THREE\.ExtrudeGeometry\(profile\.shape/);
  assert.match(source, /depth: thicknessWorld/);
  assert.match(source, /pocketOpeningDiameterMm/);
  assert.match(source, /pocketCenterSpacingMm/);
  assert.match(source, /active-bottle-diameter-plus-functional-clearance/);
  assert.match(source, /user-measured-60mm/);
});

test("star body is elevated into the bottle body panel and maintains vertical separation from the bottle pad", () => {
  assert.match(source, /const BODY_PANEL_BOTTOM_MM = 24;/);
  assert.match(source, /const BODY_PANEL_TOP_MM = 78;/);
  assert.match(source, /const MIN_PAD_VERTICAL_CLEARANCE_MM = 12;/);
  assert.match(source, /group\.position\.y = centerY/);
  assert.match(source, /bottlePadVerticalClearanceMm/);
  assert.match(source, /vertical-separation-above-bottle-pad-contact-plane/);
});

test("continuous handling bottles receive label meshes and apply them from each bottle's own carousel angle", () => {
  assert.match(source, /ServoForgeHandlingBottle\\d\+\$/);
  assert.match(source, /factory\.createBottleLabels\(THREE, snapshot\.labels, snapshot\.geometry\)/);
  assert.match(source, /ServoForgeHandlingBottleLabels/);
  assert.match(source, /bottleHasPassedApplication/);
  assert.match(source, /owner === "carousel"/);
  assert.match(source, /owner === "discharge-star" \|\| owner === "outfeed-conveyor"/);
  assert.match(source, /handling\.layout\.exitAngleDegrees/);
  assert.match(source, /handling-bottle-owner-and-table-angle/);
});

test("pocket and label restoration remains presentation-only", () => {
  [
    /saveCurrentSettings\s*\(/,
    /state\.program\s*=/,
    /setServoAngleOverride\s*\(/,
    /simulation\.lines\s*=/,
    /buildPlannerMotion\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern, `3D presentation layer must remain read-only: ${pattern}`));
  assert.match(source, /carouselServoAuthorityUntouched:\s*true/);
  assert.match(source, /readOnly:\s*true/);
});
