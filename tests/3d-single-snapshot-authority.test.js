"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("scene runtime exposes one latest renderer snapshot", () => {
  const source = read("app/3d/scene-runtime.js");
  assert.match(source, /const RUNTIME_VERSION = "servoforge\.3d-runtime\.v3"/);
  assert.match(source, /function latestSnapshot\(\)/);
  assert.match(source, /snapshotBuildCount \+= 1/);
  assert.match(source, /lastSnapshot = Object\.freeze/);
  assert.match(source, /snapshotAuthority: "single-latest-render-snapshot"/);
  assert.match(source, /sceneAuthority: "starwheel-bottle-handling-only"/);
  assert.match(source, /legacyCarouselEnvironment: false/);
});

test("canonical renderer is the scene snapshot producer", () => {
  const source = read("app/3d/three-scene-renderer-v08.js");
  assert.match(source, /lastSnapshot = activeRuntime\.snapshot\(/);
  assert.match(source, /Labeler3DPresentationFrameCoordinator\?\.frame/);
  assert.match(source, /snapshot: lastSnapshot/);
  assert.match(source, /renderer\.render\(scene, camera\)/);
});

test("bottle handling consumes the renderer snapshot rather than creating a second render clock", () => {
  const source = read("app/3d/bottle-handling-viewport-integration.js");
  assert.match(source, /function sync\(snapshot\)/);
  assert.doesNotMatch(source, /requestAnimationFrame\s*\(/);
  assert.match(source, /singleSnapshotAuthority: true/);
});
