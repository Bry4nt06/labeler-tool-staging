"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

test("only the canonical v08 Three.js renderer remains", () => {
  const files = fs.readdirSync(path.join(root, "app/3d"));
  const renderers = files.filter((name) => /^three-scene-renderer(?:-v\d+)?\.js$/.test(name));
  assert.deepEqual(renderers, ["three-scene-renderer-v08.js"]);

  const renderer = read("app/3d/three-scene-renderer-v08.js");
  assert.equal((renderer.match(/new THREE\.WebGLRenderer/g) || []).length, 1);
  assert.match(renderer, /requestAnimationFrame\(renderFrame\)/);
  assert.match(renderer, /cancelAnimationFrame\(animationFrame\)/);
});

test("legacy 3D recovery authorities are absent", () => {
  [
    "app/3d/animation-authority-integration.js",
    "app/3d/control-surface-recovery-integration.js",
    "app/3d/mechanical-map-animation-launcher-integration.js",
    "app/3d/free-roam-camera-capture-integration.js",
    "app/3d/scene-root-bridge-integration.js"
  ].forEach((file) => assert.equal(exists(file), false, `${file} must not exist`));

  const bootstrap = read("app/bootstrap.js");
  const animation = read("app/animation-runtime.js");
  assert.doesNotMatch(bootstrap, /free-roam-camera-capture-integration|scene-root-bridge-integration/);
  assert.doesNotMatch(animation, /animation-authority-integration|control-surface-recovery-integration|mechanical-map-animation-launcher-integration|Labeler3DAllBottleServoSynchronization/);
});

test("active 3D runtime does not monkey-patch the renderer or camera prototypes", () => {
  const active = [
    "app/3d/scene-runtime.js",
    "app/3d/three-scene-renderer-v08.js",
    "app/3d/viewport-ui-controls-integration.js",
    "app/3d/bottle-handling-viewport-integration.js"
  ].map(read).join("\n");

  assert.doesNotMatch(active, /WebGLRenderer\.prototype\.render\s*=/);
  assert.doesNotMatch(active, /Camera\.prototype\.updateMatrixWorld\s*=/);
});
