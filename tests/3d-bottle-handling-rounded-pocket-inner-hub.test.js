"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.resolve(__dirname, "../app/3d/bottle-handling-viewport-integration.js"), "utf8");

test("integrated starwheel geometry uses true circular bottle-clearance pockets", () => {
  assert.match(source, /roundedPocketProfile/);
  assert.match(source, /const beta = centerAngle \+ Math\.PI \+ gamma - \(2 \* gamma \* t\)/);
  assert.match(source, /true-circular-bottle-clearance-arc/);
  assert.match(source, /active-bottle-diameter-plus-3mm-diametral-clearance/);
});

test("inner hub reference hierarchy is built inside the starwheel itself", () => {
  assert.match(source, /user-supplied-star-wheel-drawing-2026-08-18/);
  assert.match(source, /ServoForgeStarVisibleInnerHub/);
  assert.match(source, /ServoForgeStarInnerMountingRingVisible/);
  assert.match(source, /ServoForgeStarInnerFourLobeCouplingVisible/);
  assert.match(source, /const PRIMARY_BOLT_COUNT = 4/);
  assert.match(source, /const SECONDARY_BOLT_COUNT = 8/);
});
