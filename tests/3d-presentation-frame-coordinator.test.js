"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const coordinator = read("app/3d/presentation-frame-coordinator.js");
const renderer = read("app/3d/three-scene-renderer-v08.js");
const bootstrap = read("app/bootstrap.js");
const presentationModules = [
  "app/3d/bottle-handling-progressive-label-flow-integration.js",
  "app/3d/bottle-handling-measured-star-presentation-integration.js",
  "app/3d/bottle-handling-photo-presentation-integration.js",
  "app/3d/bottle-handling-pocket-phase-presentation-integration.js",
  "app/3d/bottle-handling-pocket-clearance-label-restore-integration.js",
  "app/3d/bottle-handling-progressive-label-authority-integration.js",
  "app/3d/three-d-direction-parity-presentation-integration.js",
  "app/3d/dashboard-top-view-parity-integration.js",
  "app/3d/bottle-handling-unified-star-height-thickness-integration.js",
  "app/3d/bottle-handling-rounded-pocket-inner-hub-integration.js",
  "app/3d/bottle-handling-visible-inner-hub-integration.js"
];

assert.ok(coordinator.includes("const callbacks = new Map()"), "Coordinator must own one callback registry.");
assert.ok(coordinator.includes("minIntervalMs"), "Coordinator must throttle static presentation work.");
assert.ok(renderer.includes("Labeler3DPresentationFrameCoordinator?.frame?.({"), "Renderer must drive presentation callbacks from its authoritative frame.");
assert.ok(renderer.includes("Math.min(global.devicePixelRatio || 1, 1.5)"), "3D fill rate must be capped on high-DPI displays.");

presentationModules.forEach((file) => {
  const source = read(file);
  assert.ok(source.includes("Labeler3DPresentationFrameCoordinator"), `${file} must register with the frame coordinator.`);
  assert.ok(!/requestAnimationFrame\((?:loop|renderFrame)\)/.test(source), `${file} must not own a legacy animation loop.`);
});

const coordinatorIndex = bootstrap.indexOf('"app/3d/presentation-frame-coordinator.js"');
const firstPresentationIndex = bootstrap.indexOf('"app/3d/bottle-handling-progressive-label-flow-integration.js"');
assert.ok(coordinatorIndex >= 0 && coordinatorIndex < firstPresentationIndex, "Coordinator must load before presentation integrations.");

console.log("3D shared presentation frame coordinator regression passed.");
