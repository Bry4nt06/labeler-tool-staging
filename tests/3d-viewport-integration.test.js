"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const runtime = read("app/3d/scene-runtime.js");
const viewport = read("app/3d/three-scene-renderer-v08.js");
const handling = read("app/3d/bottle-handling-viewport-integration.js");
const bootstrap = read("app/bootstrap.js");

assert.match(runtime, /app\/3d\/three-scene-renderer-v08\.js/);
assert.match(runtime, /servoforge\.3d-runtime\.v3/);
assert.match(runtime, /starwheel-bottle-handling-only/);
assert.match(runtime, /legacyCarouselEnvironment: false/);

assert.match(viewport, /servoforge\.3d-viewport\.v0\.10/);
assert.match(viewport, /new THREE\.WebGLRenderer/);
assert.match(viewport, /new THREE\.PerspectiveCamera/);
assert.match(viewport, /ServoForgeCanonicalBottleHandlingScene/);
assert.match(viewport, /await handlingViewport\(\)\.attachScene\(scene\)/);
assert.match(viewport, /handlingViewport\(\)\?\.sync\?\.\(snapshot\)/);
assert.match(viewport, /Follow Head 1/);
assert.match(viewport, /textContent = "3D View"/);
assert.doesNotMatch(viewport, /ServoForgeBottleTablePopulation/);
assert.doesNotMatch(viewport, /createHeadAssembly/);

assert.match(handling, /servoforge\.3d-bottle-handling-viewport\.v7/);
assert.match(handling, /new THREE\.InstancedMesh/);
assert.match(handling, /ServoForgeInfeedStar/);
assert.match(handling, /ServoForgeIntermediateStar/);
assert.match(handling, /ServoForgeDischargeStar/);
assert.match(handling, /const STAR_THICKNESS_MM = 80/);
assert.match(handling, /const POCKET_DIAMETRAL_CLEARANCE_MM = 3/);
assert.match(handling, /ServoForgeStarVisibleInnerHub/);
assert.match(handling, /attachScene/);
assert.match(handling, /prototypeSceneHook: false/);

const handlingIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
assert.ok(handlingIndex >= 0);
assert.ok(runtimeIndex > handlingIndex);

[
  /saveCurrentSettings\s*\(/,
  /setServoAngleOverride\s*\(/,
  /state\.program\s*=/,
  /simulation\.lines\s*=/
].forEach((pattern) => {
  assert.doesNotMatch(viewport, pattern);
  assert.doesNotMatch(handling, pattern);
});

console.log("ServoForge starwheel-only 3D viewport boundary regression passed.");
