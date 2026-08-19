"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/coder-height-26in-refinement-integration.js");

test("26 inch coder refinement loads after the base coder housing dimensions", () => {
  const baseIndex = bootstrap.indexOf('"app/3d/coder-housing-dimension-refinement-integration.js"');
  const correctionIndex = bootstrap.indexOf('"app/3d/coder-height-26in-refinement-integration.js"');
  const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(baseIndex >= 0);
  assert.ok(correctionIndex > baseIndex);
  assert.ok(runtimeIndex > correctionIndex);
});

test("final coder housing is 26 inches tall while lens and beam datums remain preserved", () => {
  assert.match(source, /const HOUSING_HEIGHT_MM = 660\.4;/);
  assert.match(source, /const HOUSING_WIDTH_MM = 101\.6;/);
  assert.match(source, /const HOUSING_DEPTH_MM = 101\.6;/);
  assert.match(source, /ServoForgeCoderHousing26in/);
  assert.match(source, /ServoForgeCoderClearLens3in/);
  assert.match(source, /lensDatumPreserved = true/);
  assert.match(source, /laserBeamGeometryUntouched: true/);
  assert.match(source, /bottleSurfaceSetbackPreservedMm: 190/);
});

test("26 inch coder correction remains presentation only", () => {
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
