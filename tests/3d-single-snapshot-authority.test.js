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

test("main animation clock reuses the renderer snapshot instead of rebuilding it", () => {
  const source = read("app/animation-runtime.js");
  assert.match(source, /sceneRuntime\?\.latestSnapshot/);
  assert.match(source, /const snapshot = sceneRuntime\.latestSnapshot\(\)/);
  assert.doesNotMatch(source, /sceneRuntime\.snapshot\(/);
  assert.doesNotMatch(source, /physical-mm-bottle-handling-primary-clock/);
});

test("canonical renderer remains the scene snapshot producer", () => {
  const source = read("app/3d/three-scene-renderer-v08.js");
  assert.match(source, /lastSnapshot = activeRuntime\.snapshot\(/);
  assert.match(source, /renderer\.render\(scene,camera\)/);
});
