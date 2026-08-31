"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const authoritySource = read("app/3d/bottle-handling-direction-authority-integration.js");
const viewportSource = read("app/3d/bottle-handling-viewport-integration.js");
const rendererSource = read("app/3d/three-scene-renderer-v08.js");

test("direction authority stays in the handling data pipeline before the viewport", () => {
  const sixteenIndex = bootstrap.indexOf('"app/3d/bottle-handling-16-pocket-integration.js"');
  const measuredIndex = bootstrap.indexOf('"app/3d/bottle-handling-measured-star-layout-integration.js"');
  const authorityIndex = bootstrap.indexOf('"app/3d/bottle-handling-direction-authority-integration.js"');
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  assert.ok(sixteenIndex >= 0);
  assert.ok(measuredIndex > sixteenIndex);
  assert.ok(authorityIndex > measuredIndex);
  assert.ok(viewportIndex > authorityIndex);
  assert.equal(bootstrap.includes("three-d-direction-parity-presentation-integration.js"), false);
});

test("authoritative application direction overrides stale caller options", () => {
  assert.match(authoritySource, /typeof state !== "undefined"/);
  assert.match(authoritySource, /carouselDirection/);
  assert.match(authoritySource, /zeroAngleDegrees/);
  assert.match(authoritySource, /directionAuthorityV1/);
});

test("canonical starwheel viewport applies wheel phase and conveyor direction directly", () => {
  assert.match(viewportSource, /group\.position\.x = number\(wheel\?\.center\?\.x/);
  assert.match(viewportSource, /group\.position\.z = number\(wheel\?\.center\?\.z/);
  assert.match(viewportSource, /group\.rotation\.y = -worldPocketAngle/);
  assert.match(viewportSource, /ServoForgeInfeedConveyor/);
  assert.match(viewportSource, /ServoForgeOutfeedConveyor/);
  assert.match(viewportSource, /Math\.atan2\(-dz, dx\)/);
});

test("top camera parity is native to the canonical renderer", () => {
  assert.match(rendererSource, /camera\.up\.set\(0, 0, -1\)/);
  assert.match(rendererSource, /camera\.up\.set\(0, 1, 0\)/);
  assert.doesNotMatch(rendererSource, /PerspectiveCamera\.prototype/);
});

test("direction path remains read only", () => {
  [authoritySource, viewportSource].forEach((source) => {
    [/state\.program\s*=/, /state\.direction\s*=/, /saveCurrentSettings\s*\(/, /setServoAngleOverride\s*\(/, /simulation\.lines\s*=/]
      .forEach((pattern) => assert.doesNotMatch(source, pattern));
  });
});
