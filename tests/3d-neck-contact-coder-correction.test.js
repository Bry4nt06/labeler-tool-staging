"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/neck-contact-coder-correction-integration.js");

test("neck/coder correction loads after equipment layout and before bottle handling", () => {
  const equipment = bootstrap.indexOf('"app/3d/equipment-layout-adapter.js"');
  const correction = bootstrap.indexOf('"app/3d/neck-contact-coder-correction-integration.js"');
  const handling = bootstrap.indexOf('"app/3d/bottle-handling-adapter.js"');
  assert.ok(equipment >= 0);
  assert.ok(correction > equipment);
  assert.ok(handling > correction);
});

test("aggregates/stations 1 and 2 are treated as neck-contact stations", () => {
  assert.match(source, /station === 1 \|\| station === 2/);
  assert.match(source, /section === "neck"/);
  assert.match(source, /verticalContactAuthority: "aggregate-1-2-neck-level"/);
  assert.match(source, /aggregate-1-2-same-neck-level-as-rollers/);
});

test("neck pads use the neck radius while preserving measured 2 mm pad penetration", () => {
  assert.match(source, /neckGeometryForPad/);
  assert.match(source, /effectiveRadiusMm: neckRadiusMm/);
  assert.match(source, /baseWipePadAdapter\.snapshot\(item, neckGeometryForPad\(geometry\)\)/);
  assert.match(source, /neck-radius-plus-measured-2mm-pad-penetration/);
});

test("neck rollers and brushes are radially positioned for actual neck surface contact", () => {
  assert.match(source, /neckRadiusWorld \+ toolHalfDepth/);
  assert.match(source, /tangent-contact-at-reference-neck-radius/);
  assert.match(source, /machine-map-angle-plus-neck-surface-tangent-contact/);
  assert.match(source, /kind === "roller" \|\| kind === "brush" \|\| kind === "brush-channel"/);
});

test("outside neck roller tilt is flipped while inner roller tilt is preserved", () => {
  assert.match(source, /item\?\.side === "inner" \? number\(neck\.radialSlope\) : -number\(neck\.radialSlope\)/);
  assert.match(source, /outsideRollerTiltCorrected: item\?\.side !== "inner"/);
  assert.match(source, /user-corrected-opposite-sign-for-outside-neck-roller/);
});

test("coder face is 190 mm from bottle surface and emitter points at carousel centerline", () => {
  assert.match(source, /const CODER_BOTTLE_SURFACE_SETBACK_MM = 190;/);
  assert.match(source, /faceRadiusWorld = pitchRadius \+ bottleBodyRadius \+ setbackWorld/);
  assert.match(source, /radialWorld = faceRadiusWorld \+ faceOffsetWorld/);
  assert.match(source, /return Math\.atan2\(number\(position\.x\), number\(position\.z\)\);/);
  assert.match(source, /orientationTarget: "carousel-centerline"/);
  assert.match(source, /user-specified-190mm-from-bottle-surface/);
});

test("correction remains 3D presentation-only", () => {
  [
    /state\.program\s*=/,
    /saveCurrentSettings\s*\(/,
    /buildPlannerMotion\s*\(/,
    /setServoAngleOverride\s*\(/,
    /simulation\.lines\s*=/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
  assert.match(source, /readOnly:\s*true/);
});
