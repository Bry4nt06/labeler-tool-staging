"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/bottle-handling-visible-inner-hub-integration.js");

test("visible hub layer loads after rounded star geometry", () => {
  const rounded = bootstrap.indexOf('"app/3d/bottle-handling-rounded-pocket-inner-hub-integration.js"');
  const visible = bootstrap.indexOf('"app/3d/bottle-handling-visible-inner-hub-integration.js"');
  assert.ok(rounded >= 0);
  assert.ok(visible > rounded);
});

test("all three star wheels receive visible top-surface drawing details", () => {
  assert.match(source, /ServoForgeInfeedStar/);
  assert.match(source, /ServoForgeIntermediateStar/);
  assert.match(source, /ServoForgeDischargeStar/);
  assert.match(source, /ServoForgeStarVisibleInnerHub/);
  assert.match(source, /ServoForgeStarInnerRecessField/);
  assert.match(source, /ServoForgeStarInnerMountingRingVisible/);
  assert.match(source, /ServoForgeStarInnerFourLobeCouplingVisible/);
  assert.match(source, /ServoForgeStarCenterBoreVisible/);
  assert.match(source, /PRIMARY_BOLT_COUNT = 4/);
  assert.match(source, /SECONDARY_BOLT_COUNT = 8/);
});

test("buried v183 hub is hidden and replacement is placed at the star top face", () => {
  assert.match(source, /ServoForgeStarDrawingInnerAssembly/);
  assert.match(source, /buried\.visible = false/);
  assert.match(source, /const topY = metrics\.topY/);
  assert.match(source, /topSurfaceMounted = true/);
});

test("visible hub layer remains read only", () => {
  [/state\.program\s*=/, /buildPlannerMotion\s*\(/, /setServoAngleOverride\s*\(/].forEach((pattern) => {
    assert.doesNotMatch(source, pattern);
  });
  assert.match(source, /readOnly:\s*true/);
});
