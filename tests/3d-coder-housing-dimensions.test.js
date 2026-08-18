"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/coder-housing-dimension-refinement-integration.js");

test("coder housing refinement loads after bottle label coder polish", () => {
  const polishIndex = bootstrap.indexOf('"app/3d/bottle-label-coder-visual-polish-integration.js"');
  const housingIndex = bootstrap.indexOf('"app/3d/coder-housing-dimension-refinement-integration.js"');
  const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(polishIndex >= 0);
  assert.ok(housingIndex > polishIndex);
  assert.ok(runtimeIndex > housingIndex);
});

test("coder dimensions follow the supplied 36 inch sketch", () => {
  assert.match(source, /const HOUSING_HEIGHT_MM = 914\.4;/);
  assert.match(source, /const HOUSING_WIDTH_MM = 101\.6;/);
  assert.match(source, /const HOUSING_DEPTH_MM = 101\.6;/);
  assert.match(source, /const EXTENSION_LENGTH_MM = 152\.4;/);
  assert.match(source, /const OPTIC_HEAD_LENGTH_MM = 101\.6;/);
  assert.match(source, /const LENS_DIAMETER_MM = 76\.2;/);
  assert.match(source, /ServoForgeCoderHousing36in/);
  assert.match(source, /ServoForgeCoderExtension6in/);
  assert.match(source, /ServoForgeCoderOpticHead4in/);
});

test("coder lens is clear while laser beam geometry remains untouched", () => {
  assert.match(source, /ServoForgeCoderClearLens3in/);
  assert.match(source, /lensFinish = "clear-translucent"/);
  assert.match(source, /transmission: 0\.82/);
  assert.match(source, /opacity: 0\.30/);
  assert.match(source, /if \(child === beam\) return;/);
  assert.match(source, /beam\.userData\.geometryPreserved = true/);
  assert.match(source, /beam\.userData\.sizePreserved = true/);
  assert.match(source, /bottleSurfaceSetbackPreservedMm: 190/);
});

test("coder refinement remains presentation only", () => {
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
