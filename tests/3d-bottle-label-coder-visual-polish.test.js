"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/bottle-label-coder-visual-polish-integration.js");

test("bottle label coder polish loads after handling viewport and before scene runtime", () => {
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  const polishIndex = bootstrap.indexOf('"app/3d/bottle-label-coder-visual-polish-integration.js"');
  const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(viewportIndex >= 0);
  assert.ok(polishIndex > viewportIndex);
  assert.ok(runtimeIndex > polishIndex);
});

test("coder lens is 76.2mm while laser beam geometry remains untouched", () => {
  assert.match(source, /const CODER_LENS_DIAMETER_MM = 76\.2;/);
  assert.match(source, /CircleGeometry\(radiusWorld, 64\)/);
  assert.match(source, /laserBeamGeometryUntouched = true/);
  assert.match(source, /laserBeamSizePreserved = true/);
});

test("all applicable 3D labels use the requested I heart Beer artwork", () => {
  assert.match(source, /const LABEL_TEXT = "I ♥ Beer";/);
  assert.match(source, /createBeerLabelTexture/);
  assert.match(source, /group\.userData\.artworkText = LABEL_TEXT/);
  assert.match(source, /artworkAuthority: true/);
});

test("neck label is centered in the neck zone", () => {
  assert.match(source, /centeredNeckSection/);
  assert.match(source, /user-requested-centered-mid-neck-label-zone/);
  assert.match(source, /neckLabelPlacement: "centered-mid-neck-zone"/);
});

test("bottles use amber physical glass and silver metallic crowns", () => {
  assert.match(source, /new THREERef\.MeshPhysicalMaterial/);
  assert.match(source, /ior: 1\.52/);
  assert.match(source, /transmission: 0\.10/);
  assert.match(source, /crownFinish = "silver-metallic"/);
  assert.match(source, /metalness: 0\.94/);
});

test("visual polish does not mutate servo or planner authority", () => {
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
