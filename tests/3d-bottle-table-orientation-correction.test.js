"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const correction = read("app/3d/bottle-table-orientation-correction-integration.js");
const viewport = read("app/3d/bottle-handling-viewport-integration.js");
const sceneAdapter = read("app/3d/scene-adapter.js");

function indexOfModule(modulePath) {
  return bootstrap.indexOf(`"${modulePath}"`);
}

test("v304 correction loads immediately after the bottle-handling viewport", () => {
  const viewportIndex = indexOfModule("app/3d/bottle-handling-viewport-integration.js");
  const correctionIndex = indexOfModule("app/3d/bottle-table-orientation-correction-integration.js");
  const polishIndex = indexOfModule("app/3d/bottle-label-coder-visual-polish-integration.js");
  const runtimeIndex = indexOfModule("app/3d/scene-runtime.js");
  assert.ok(viewportIndex >= 0);
  assert.ok(correctionIndex > viewportIndex);
  assert.ok(polishIndex > correctionIndex);
  assert.ok(runtimeIndex > correctionIndex);
  assert.match(bootstrap, /bottle-table-orientation-parity-v304/);
});

test("bottle table is restored inside the canonical bottle-handling layer", () => {
  assert.match(correction, /ServoForgeBottleTableAssembly/);
  assert.match(correction, /ServoForgeBottleTableDeck/);
  assert.match(correction, /ServoForgeBottleTableTopSkin/);
  assert.match(correction, /ServoForgeBottleTableCenterHub/);
  assert.match(correction, /ServoForgeBottleTablePlatesInstanced/);
  assert.match(correction, /new THREE\.InstancedMesh\(plateGeometry, plateMaterial, headCount\)/);
  assert.match(correction, /geometry\?\.bottleTable\?\.plateDiameterWorld/);
  assert.match(correction, /geometry\?\.machine\?\.physicalPitchRadiusWorld/);
  assert.match(correction, /geometry\?\.machine\?\.carouselOuterRadiusWorld/);
  assert.match(correction, /singleEnvironmentAuthority = true/);
});

test("carousel bottle orientation uses the same table-frame plus servo transform as Top View", () => {
  assert.match(sceneAdapter, /bottleAbsoluteMapRadians = orbit\.radians \+ servoMapRadians/);
  assert.match(correction, /return routeRotationY \+ sharedServoRotation/);
  assert.match(correction, /String\(point\?\.owner \|\| ""\) !== "carousel"/);
  assert.match(correction, /orientationMatchesTopViewWorldFrame: true/);
  assert.match(correction, /orientationUsesRoutePlusServoOnCarousel: true/);
  assert.doesNotMatch(correction, /return -\(routeRotationY \+ sharedServoRotation\)/);
});

test("orientation correction preserves the existing instanced bottle render path", () => {
  assert.match(viewport, /ServoForgeHandlingBottleBodiesInstanced/);
  assert.match(viewport, /ServoForgeHandlingBottleCapsInstanced/);
  assert.match(viewport, /ServoForgeHandlingBottleServoDatumsInstanced/);
  assert.match(correction, /mesh\.getMatrixAt\(index, currentInstanceMatrix\)/);
  assert.match(correction, /mesh\.setMatrixAt\(index, correctedInstanceMatrix\)/);
  assert.match(correction, /mesh\.instanceMatrix\.needsUpdate = true/);
  assert.doesNotMatch(correction, /new THREE\.Mesh\(assets\.bodyGeometry/);
});

test("v304 remains read-only and does not reintroduce scene prototype hooks", () => {
  [
    /Object3D\.prototype/,
    /prototype\.add\s*=/,
    /state\.program\s*=/,
    /state\.direction\s*=/,
    /saveCurrentSettings\s*\(/,
    /setServoAngleOverride\s*\(/,
    /simulation\.lines\s*=/
  ].forEach((pattern) => assert.doesNotMatch(correction, pattern));
  assert.match(correction, /prototypeSceneHook: false/);
  assert.match(correction, /readOnly: true/);
});
