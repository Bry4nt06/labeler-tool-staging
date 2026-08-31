"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.resolve(__dirname, "../app/3d/bottle-handling-viewport-integration.js"), "utf8");

test("all three integrated starwheels share the raised 80 mm envelope", () => {
  assert.match(source, /const STAR_THICKNESS_MM = 80/);
  assert.match(source, /const STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM = 30/);
  assert.match(source, /allThreeStarsSameVerticalCenter = true/);
  assert.match(source, /ServoForgeInfeedStar/);
  assert.match(source, /ServoForgeIntermediateStar/);
  assert.match(source, /ServoForgeDischargeStar/);
});

test("star height is rendered directly with no post-render authority", () => {
  assert.match(source, /starBodyGeometry/);
  assert.match(source, /independentAnimationLoop: false/);
  assert.doesNotMatch(source, /requestAnimationFrame\s*\(/);
});
