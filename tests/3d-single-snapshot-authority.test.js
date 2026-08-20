"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("scene runtime exposes the latest canonical renderer snapshot", () => {
  const source = read("app/3d/scene-runtime.js");
  assert.match(source, /const RUNTIME_VERSION = "servoforge\.3d-runtime\.v3"/);
  assert.match(source, /function latestSnapshot\(\)/);
  assert.match(source, /snapshotBuildCount \+= 1/);
  assert.match(source, /lastSnapshot = Object\.freeze/);
  assert.match(source, /snapshotAuthority: "canonical-3d-render-frame"/);
  assert.match(source, /viewportAuthority: "starwheel-bottle-handling-single-scene-v09"/);
  assert.match(source, /legacyCarouselViewportRetired: true/);
  assert.match(source, /latestSnapshot,/);
});

test("main application clock does not build or resynchronize 3D snapshots", () => {
  const source = read("app/animation-runtime.js");
  assert.doesNotMatch(source, /Labeler3DSceneRuntime/);
  assert.doesNotMatch(source, /latestSnapshot\(/);
  assert.doesNotMatch(source, /\.snapshot\(/);
  assert.doesNotMatch(source, /syncBottleHandling/);
  assert.match(source, /if \(!viewportOpen\) renderAnimationFrame\(\)/);
});

test("canonical v09 renderer is the sole 3D snapshot producer", () => {
  const source = read("app/3d/three-scene-renderer-v09.js");
  assert.equal((source.match(/activeRuntime\.snapshot\(/g) || []).length, 1);
  assert.match(source, /lastSnapshot = activeRuntime\.snapshot\(/);
  assert.match(source, /handlingViewport\(\)\?\.sync\?\.\(snapshot\)/);
  assert.match(source, /progressiveLabelFlow\(\)\?\.sync\?\.\(snapshot\)/);
  assert.match(source, /renderer\.render\(scene, camera\)/);
});

test("secondary 3D features consume the canonical snapshot instead of building their own", () => {
  [
    "app/3d/bottle-handling-viewport-integration.js",
    "app/3d/bottle-handling-progressive-label-flow-integration.js",
    "app/3d/viewport-ui-controls-integration.js",
    "app/3d/measured-spacing-overlay.js"
  ].forEach((file) => {
    const source = read(file);
    assert.doesNotMatch(source, /Labeler3DSceneRuntime\?\.snapshot/);
    assert.doesNotMatch(source, /runtime\(\)\?\.snapshot/);
  });
});
