"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("all 3D handling bottles use one generated servo path", () => {
  const integration = read("app/3d/all-bottle-servo-synchronization-integration.js");
  assert.match(integration, /all-bottles-one-servo-path/);
  assert.match(integration, /state\?\.previewAngle/);
  assert.match(integration, /Labeler3DSimulationFrameDriver/);
  assert.match(integration, /Labeler3DSceneRuntime/);
  assert.match(integration, /bottle\.rotation\.y = rotationY/);
  assert.match(integration, /positionAuthorityUntouched: true/);
  assert.match(integration, /starWheelAuthorityUntouched: true/);
});

test("animation runtime loads and drives all-bottle synchronization", () => {
  const runtime = read("app/animation-runtime.js");
  assert.match(runtime, /all-bottle-servo-synchronization-integration\.js/);
  assert.match(runtime, /Labeler3DAllBottleServoSynchronization\?\.synchronize\?\.\(\)/);
  assert.match(runtime, /animation-authority-integration\.js/);
});
