"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.resolve(__dirname, "../app/3d/bottle-handling-viewport-integration.js"), "utf8");

test("all starwheels receive the visible top-surface inner hub", () => {
  assert.match(source, /ServoForgeStarVisibleInnerHub/);
  assert.match(source, /ServoForgeStarInnerRecessField/);
  assert.match(source, /ServoForgeStarInnerMountingRingVisible/);
  assert.match(source, /ServoForgeStarInnerFourLobeCouplingVisible/);
  assert.match(source, /ServoForgeStarCenterBoreVisible/);
  assert.match(source, /topSurfaceMounted = true/);
});

test("visible hub is part of the canonical starwheel build, not a recovery loop", () => {
  assert.match(source, /addVisibleInnerHub\(group, built\.profile, snapshot, built\.thicknessWorld\)/);
  assert.match(source, /visibleInnerHubAuthority: true/);
  assert.doesNotMatch(source, /requestAnimationFrame\s*\(/);
  assert.doesNotMatch(source, /prototype\.add\s*=/);
});
