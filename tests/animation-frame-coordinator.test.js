"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const rendererSource = fs.readFileSync(path.join(root, "app", "map-animation-renderer.js"), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, "app", "animation-runtime.js"), "utf8");

let activeRowUpdates = 0;
let wipeUpdates = 0;
let requestedFrame = null;

const context = {
  console,
  performance: { now() { return 1000; } },
  state: {
    previewAngle: 42.3,
    animationSpeed: 10,
    animationSpeedUnit: "deg-per-second",
    isPlaying: true,
    radius: 250,
    headCount: 45,
    direction: "ccw"
  },
  els: {
    mapSvg: null,
    simulation: null,
    previewAngle: { value: "" },
    tableAngleJump: { value: "" },
    wipeDownDataPanel: { hidden: false }
  },
  document: { activeElement: null },
  currentProgram() { return []; },
  simulationProgram() { return []; },
  renderMap() {},
  renderSimulationMap() {},
  updateActiveServoProgramRow() { activeRowUpdates += 1; },
  renderWipeDownData() { wipeUpdates += 1; },
  fmt(value, decimals = 1) { return Number(value).toFixed(decimals); },
  num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  norm(value) { return ((Number(value) % 360) + 360) % 360; },
  requestAnimationFrame(callback) {
    requestedFrame = callback;
    return 1;
  },
  cancelAnimationFrame() {}
};
context.window = context;
context.globalThis = context;

vm.createContext(context);
assert.doesNotThrow(() => vm.runInContext(rendererSource, context));

assert.equal(typeof context.renderAnimationFrame, "function",
  "The extracted map animation renderer must publish the frame coordinator used by Play.");
assert.equal(context.LabelerMapAnimationRenderer.renderAnimationFrame, context.renderAnimationFrame);
assert.equal(context.LabelerMapAnimationRenderer.animationFrameCoordinatorV2, true);

context.renderAnimationFrame();
assert.equal(context.els.previewAngle.value, "42.3");
assert.equal(context.els.tableAngleJump.value, "42.3");
assert.equal(activeRowUpdates, 1, "The active servo-program row must follow animation frames.");
assert.equal(wipeUpdates, 1, "An open wipe telemetry panel must follow animation frames.");

// Exercise the real requestAnimationFrame runtime. The historical regression
// advanced previewAngle but threw because renderAnimationFrame was undefined.
assert.doesNotThrow(() => vm.runInContext(runtimeSource, context));
context.LabelerAnimationRuntime.start();
assert.equal(typeof requestedFrame, "function");

const before = context.state.previewAngle;
assert.doesNotThrow(() => requestedFrame(1000));
assert.equal(typeof requestedFrame, "function", "Animation runtime must schedule its next frame.");
assert.equal(context.state.previewAngle, before,
  "The first runtime frame establishes the clock without jumping the table angle.");
assert.ok(activeRowUpdates >= 2, "The runtime frame must reach the restored renderAnimationFrame coordinator.");

// A subsequent frame advances the table and repaints without requiring a
// synthetic 359-degree servo-program waypoint.
const secondFrame = requestedFrame;
assert.doesNotThrow(() => secondFrame(1100));
assert.ok(context.state.previewAngle > before);
assert.equal(context.els.previewAngle.value, String(context.state.previewAngle));

console.log("Animation frame coordinator regression passed: Play advances state and repaints the extracted renderers.");
