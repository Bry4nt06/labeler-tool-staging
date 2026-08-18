"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/bottle-handling-unified-star-height-thickness-integration.js");

test("unified star layer is final star-wheel presentation authority", () => {
  const phase = bootstrap.indexOf('"app/3d/bottle-handling-pocket-clearance-label-restore-integration.js"');
  const parity = bootstrap.indexOf('"app/3d/dashboard-top-view-parity-integration.js"');
  const unified = bootstrap.indexOf('"app/3d/bottle-handling-unified-star-height-thickness-integration.js"');
  const runtime = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(phase >= 0);
  assert.ok(parity > phase);
  assert.ok(unified > parity);
  assert.ok(runtime > unified);
});

test("all three handling stars share one raised 80 mm envelope", () => {
  assert.match(source, /const STAR_THICKNESS_MM = 80;/);
  assert.match(source, /const STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM = 30;/);
  assert.match(source, /\["infeed", "intermediate", "discharge"\]/);
  assert.match(source, /group\.position\.y = centerY/);
  assert.match(source, /starCenterAboveBottleBaseMm/);
  assert.match(source, /allThreeStarsShareVerticalCenter:\s*true/);
});

test("final star layer thickens plate geometry without changing XZ placement", () => {
  assert.match(source, /plate\.scale\.y = thicknessWorld \/ nominalHeight/);
  assert.doesNotMatch(source, /group\.position\.x\s*=/);
  assert.doesNotMatch(source, /group\.position\.z\s*=/);
  assert.match(source, /padCollisionAvoidance/);
});

test("unified star layer remains read-only", () => {
  [
    /state\.program\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
  assert.match(source, /readOnly:\s*true/);
});
