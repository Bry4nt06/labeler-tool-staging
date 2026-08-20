"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

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

const recovery = read("app/bottle-orientation-panel-recovery-integration.js");
assert.match(recovery, /document\.querySelector\?\.\("main"\)/);
assert.match(recovery, /documentObserver\.observe\(workspaceRoot, \{ childList: true \}\)/);
assert.doesNotMatch(recovery, /documentObserver\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);

const renderer = read("app/3d/three-scene-renderer-v08.js");
assert.match(renderer, /renderer\.shadowMap\.enabled = false/);
assert.doesNotMatch(renderer, /PCFSoftShadowMap/);
assert.match(renderer, /const setText = \(node, value\)/);

const viewport = read("app/3d/bottle-handling-viewport-integration.js");
assert.match(viewport, /new THREE\.InstancedMesh\(geometry, material, count\)/);
assert.match(viewport, /ServoForgeHandlingBottleBodiesInstanced/);
assert.match(viewport, /ServoForgeHandlingBottleCapsInstanced/);
assert.match(viewport, /ServoForgeHandlingBottleServoDatumsInstanced/);
assert.match(viewport, /function latestSnapshot\(\)/);
assert.match(viewport, /instancedBottleDraws/);
assert.doesNotMatch(viewport, /new THREE\.Mesh\(assets\.bodyGeometry/);

const labelFactory = read("app/3d/label-mesh-factory.js");
assert.match(labelFactory, /const assetCaches = new WeakMap\(\)/);
assert.match(labelFactory, /servoforgeSharedLabelAsset: true/);
assert.match(labelFactory, /cache\.set\(cacheKey, meshGeometry\)/);
assert.match(labelFactory, /cache\.set\(cacheKey, texture\)/);

const progressive = read("app/3d/bottle-handling-progressive-label-flow-integration.js");
assert.doesNotMatch(progressive, /mesh\.material = mesh\.material\.clone\(\)/);
assert.match(progressive, /servoforgeSharedLabelAsset/);

const polish = read("app/3d/bottle-label-coder-visual-polish-integration.js");
assert.match(polish, /handlingBottleInstances/);
assert.doesNotMatch(polish, /object\.castShadow = true/);
assert.match(polish, /const beerTextureCaches = new WeakMap\(\)/);
assert.doesNotMatch(polish, /const material = child\.material\.clone\(\)/);

const controls = read("app/3d/viewport-ui-controls-integration.js");
assert.match(controls, /mesh\?\.userData\?\.handlingBottleInstances/);

[
  "app/3d/bottle-handling-measured-star-presentation-integration.js",
  "app/3d/bottle-handling-photo-presentation-integration.js",
  "app/3d/bottle-handling-pocket-phase-presentation-integration.js",
  "app/3d/bottle-handling-pocket-clearance-label-restore-integration.js",
  "app/3d/three-d-direction-parity-presentation-integration.js",
  "app/3d/bottle-handling-rounded-pocket-inner-hub-integration.js"
].forEach((relativePath) => {
  assert.match(read(relativePath), /Labeler3DBottleHandlingViewport\?\.latestSnapshot\?\.\(\)/, `${relativePath} must reuse the viewport handling snapshot`);
});

console.log("3D frame pacing and instancing tests passed");

