"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("scene runtime exposes the latest renderer snapshot", () => {
  const source = read("app/3d/scene-runtime.js");
  assert.match(source, /const RUNTIME_VERSION = "servoforge\.3d-runtime\.v2"/);
  assert.match(source, /function latestSnapshot\(\)/);
  assert.match(source, /snapshotBuildCount \+= 1/);
  assert.match(source, /lastSnapshot = Object\.freeze/);
  assert.match(source, /snapshotAuthority: "single-latest-render-snapshot"/);
  assert.match(source, /latestSnapshot,/);
});

test("main animation clock does not synchronize a second 3D environment", () => {
  const source = read("app/animation-runtime.js");
  assert.doesNotMatch(source, /Labeler3DBottleHandlingViewport/);
  assert.doesNotMatch(source, /sceneRuntime\.snapshot\(/);
  assert.doesNotMatch(source, /sceneRuntime\.latestSnapshot\(/);
  assert.doesNotMatch(source, /syncBottleHandling/);
});

test("canonical renderer owns the snapshot, complete bottle population, and render", () => {
  const source = read("app/3d/three-scene-renderer-v08.js");
  assert.match(source, /lastSnapshot = activeRuntime\.snapshot\(/);
  assert.match(source, /handlingViewport\?\.attach\?\.\(scene\)/);
  assert.match(source, /handlingViewport\?\.sync\?\.\(snapshot\)/);
  assert.match(source, /renderer\.render\(scene,camera\)/);
  assert.ok(
    source.indexOf("handlingViewport?.sync?.(snapshot)") < source.indexOf("renderer.render(scene,camera)"),
    "the complete handling environment must be synchronized before the scene renders"
  );
  assert.doesNotMatch(source, /ServoForgeLiveBottle|createBottleModel|activeBottleModel/);
});
