"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

test("only the canonical v09 starwheel renderer remains", () => {
  const files = fs.readdirSync(path.join(root, "app/3d"));
  const renderers = files.filter((name) => /^three-scene-renderer(?:-v\d+)?\.js$/.test(name));
  assert.deepEqual(renderers, ["three-scene-renderer-v09.js"]);
  assert.equal(exists("app/3d/three-scene-renderer-v08.js"), false);

  const renderer = read("app/3d/three-scene-renderer-v09.js");
  assert.equal((renderer.match(/new THREE\.WebGLRenderer/g) || []).length, 1);
  assert.equal((renderer.match(/new THREE\.Scene\(/g) || []).length, 1);
  assert.match(renderer, /ServoForgeCanonicalBottleHandlingScene/);
  assert.match(renderer, /handling\.attachScene\(scene\)/);
  assert.match(renderer, /sceneAuthority: "starwheel-bottle-handling-only"/);
  assert.match(renderer, /legacyCarouselEnvironment: false/);
  assert.match(renderer, /requestAnimationFrame\(renderFrame\)/);
  assert.match(renderer, /cancelAnimationFrame\(animationFrame\)/);
});

test("retired generic carousel and head environment cannot be constructed", () => {
  const renderer = read("app/3d/three-scene-renderer-v09.js");
  [
    /ServoForgeBottleTablePopulation/,
    /function createHeadAssembly/,
    /function createBottleModel/,
    /carouselBody/,
    /carouselTop/,
    /pathRing/
  ].forEach((pattern) => assert.doesNotMatch(renderer, pattern));
});

test("legacy 3D recovery authorities are physically absent", () => {
  [
    "app/3d/animation-authority-integration.js",
    "app/3d/control-surface-recovery-integration.js",
    "app/3d/mechanical-map-animation-launcher-integration.js",
    "app/3d/free-roam-camera-capture-integration.js",
    "app/3d/scene-root-bridge-integration.js",
    "app/3d/bottle-handling-progressive-label-authority-integration.js",
    "app/3d/three-scene-renderer-v08.js"
  ].forEach((file) => assert.equal(exists(file), false, `${file} must not exist`));

  const bootstrap = read("app/bootstrap.js");
  assert.doesNotMatch(bootstrap, /animation-authority-integration|control-surface-recovery-integration|mechanical-map-animation-launcher-integration|free-roam-camera-capture-integration|scene-root-bridge-integration|bottle-handling-progressive-label-authority-integration|three-scene-renderer-v08/);
});

test("3D integrations do not own competing animation loops or scene hooks", () => {
  const handling = read("app/3d/bottle-handling-viewport-integration.js");
  const labels = read("app/3d/bottle-handling-progressive-label-flow-integration.js");
  const controls = read("app/3d/viewport-ui-controls-integration.js");
  const spacing = read("app/3d/measured-spacing-overlay.js");

  [handling, labels, controls].forEach((source) => {
    assert.doesNotMatch(source, /Object3D\.prototype/);
    assert.doesNotMatch(source, /\.prototype\.add\s*=/);
    assert.doesNotMatch(source, /\.prototype\.lookAt\s*=/);
    assert.doesNotMatch(source, /requestAnimationFrame\s*\(/);
  });
  assert.doesNotMatch(spacing, /setInterval\s*\(/);
  assert.doesNotMatch(spacing, /\.snapshot\s*\(/);
  assert.match(handling, /prototypeSceneHook: false/);
  assert.match(labels, /independentAnimationLoop: false/);
  assert.match(controls, /independentAnimationLoop: false/);
  assert.match(spacing, /independentTimer: false/);
});

test("legacy 2D preview does not render behind the open 3D viewport", () => {
  const animation = read("app/animation-runtime.js");
  assert.match(animation, /const viewportOpen = Boolean\(window\.Labeler3DViewport\?\.status\?\.\(\)\.open\)/);
  assert.match(animation, /if \(!viewportOpen\) renderAnimationFrame\(\)/);
  assert.doesNotMatch(animation, /syncBottleHandling/);
  assert.doesNotMatch(animation, /Labeler3DBottleHandlingViewport/);
});
