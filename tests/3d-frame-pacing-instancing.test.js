"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const animation = read("app/animation-runtime.js");
assert.match(animation, /function isThreeDViewportOpen\(\)/);
assert.match(animation, /if \(!isThreeDViewportOpen\(\)\)/);
assert.doesNotMatch(animation, /LabelerBottleOrientationPanel\?\.renderAll/);

let queuedFrame = null;
let dashboardRenders = 0;
const context = {
  performance: { now: () => 0 },
  state: { isPlaying: true, animationSpeed: 10, previewAngle: 0 },
  num: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  norm: (value) => ((value % 360) + 360) % 360,
  renderAnimationFrame: () => { dashboardRenders += 1; },
  console,
  window: {
    __servoforge3DViewportSingletonV09: { open: true },
    requestAnimationFrame: (callback) => { queuedFrame = callback; return 1; },
    cancelAnimationFrame: () => {}
  }
};
vm.runInNewContext(animation, context);
context.window.LabelerAnimationRuntime.start();
queuedFrame(16);
assert.equal(dashboardRenders, 0, "hidden dashboard rendering must pause behind the 3D modal");
assert.ok(context.state.previewAngle > 0, "machine animation time must continue advancing");
context.window.__servoforge3DViewportSingletonV09.open = false;
queuedFrame(32);
assert.equal(dashboardRenders, 1, "dashboard rendering must resume after the modal closes");

const renderer = read("app/3d/three-scene-renderer-v08.js");
assert.match(renderer, /renderer\.shadowMap\.enabled = false/);
assert.match(renderer, /Math\.min\(global\.devicePixelRatio \|\| 1, 1\.5\)/);
assert.match(renderer, /Labeler3DPresentationFrameCoordinator\?\.frame/);
assert.equal((renderer.match(/new THREE\.WebGLRenderer/g) || []).length, 1);
assert.equal((renderer.match(/new THREE\.Scene\(/g) || []).length, 1);

const viewport = read("app/3d/bottle-handling-viewport-integration.js");
assert.match(viewport, /new THREE\.InstancedMesh\(geometry, material, count\)/);
assert.match(viewport, /ServoForgeHandlingBottleBodiesInstanced/);
assert.match(viewport, /ServoForgeHandlingBottleCapsInstanced/);
assert.match(viewport, /ServoForgeHandlingBottleServoDatumsInstanced/);
assert.match(viewport, /instancedBottleDraws/);
assert.match(viewport, /true-circular-bottle-clearance-arc/);
assert.match(viewport, /ServoForgeStarVisibleInnerHub/);
assert.doesNotMatch(viewport, /requestAnimationFrame\s*\(/);
assert.doesNotMatch(viewport, /prototype\.add\s*=/);

const progressive = read("app/3d/bottle-handling-progressive-label-flow-integration.js");
assert.match(progressive, /coordinator\.register\(INTEGRATION_VERSION, renderFrame/);
assert.match(progressive, /independentAnimationLoop: false/);
assert.doesNotMatch(progressive, /requestAnimationFrame\s*\(/);
assert.doesNotMatch(progressive, /prototype\.add\s*=/);

[
  "app/3d/bottle-handling-measured-star-presentation-integration.js",
  "app/3d/bottle-handling-photo-presentation-integration.js",
  "app/3d/bottle-handling-pocket-phase-presentation-integration.js",
  "app/3d/bottle-handling-pocket-clearance-label-restore-integration.js",
  "app/3d/three-d-direction-parity-presentation-integration.js",
  "app/3d/dashboard-top-view-parity-integration.js",
  "app/3d/bottle-handling-unified-star-height-thickness-integration.js",
  "app/3d/bottle-handling-rounded-pocket-inner-hub-integration.js",
  "app/3d/bottle-handling-visible-inner-hub-integration.js"
].forEach((relativePath) => assert.equal(exists(relativePath), false, `${relativePath} must stay retired`));

console.log("3D frame pacing, instancing, and single-environment tests passed");
