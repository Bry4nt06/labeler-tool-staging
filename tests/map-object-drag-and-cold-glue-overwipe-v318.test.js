"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const controllerSource = fs.readFileSync(path.join(root, "app/controllers/map-controller.js"), "utf8");
const sceneSource = fs.readFileSync(path.join(root, "app/mechanical-map-scene-renderer.js"), "utf8");
const profileSource = fs.readFileSync(path.join(root, "app/cold-glue-profile-generation.js"), "utf8");
const channelSource = fs.readFileSync(path.join(root, "app/cold-glue-gripper-channel-integration.js"), "utf8");

const item = {
  id: 42,
  name: "Station brush",
  kind: "brush-channel",
  start: 10,
  end: 30,
  outerStart: 10,
  outerEnd: 30,
  innerStart: 12,
  innerEnd: 32
};
const machineMap = { objects: [item] };
const objectNode = { dataset: { mapObjectId: "42" } };
const overlayNode = { closest: () => null };
const svg = {
  contains: (node) => node === objectNode || node === overlayNode,
  createSVGPoint() {
    return {
      x: 0,
      y: 0,
      matrixTransform() { return { x: this.x, y: this.y }; }
    };
  },
  getScreenCTM: () => ({ inverse: () => ({}) }),
  setPointerCapture() {},
  hasPointerCapture: () => false,
  classList: { add() {}, remove() {}, toggle() {} }
};
const state = {
  mapLocked: false,
  direction: "ccw",
  zeroAngle: 0,
  previewAngle: 0,
  mapPanX: 0,
  mapPanY: 0,
  mapZoom: 1,
  builderHistory: { undo: [] }
};
const calls = [];
const actionService = {
  call(name, ...args) {
    calls.push([name, ...args]);
    if (name === "editableMachineMap") return machineMap;
    if (name === "deepClone") return JSON.parse(JSON.stringify(args[0]));
    return undefined;
  },
  execute(options = {}) {
    options.mutate?.();
    return undefined;
  },
  render() {},
  number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
};
const context = {
  console,
  state,
  els: { mapSvg: svg },
  document: { elementsFromPoint: () => [overlayNode, { closest: () => objectNode }] },
  LabelerWorkspaceActionService: actionService,
  signedAngleDifference: (left, right) => left - right,
  norm: (value) => ((value % 360) + 360) % 360,
  window: null
};
context.window = context;
vm.createContext(context);
vm.runInContext(controllerSource, context, { filename: "map-controller.js" });

const pointerDown = {
  button: 0,
  pointerId: 7,
  clientX: 1,
  clientY: 0,
  target: overlayNode
};
assert.equal(context.LabelerMapController.beginPointer(pointerDown), true,
  "an overlay-covered station object must still acquire the map drag");
assert.equal(state.selectedMapObjectId, "42",
  "numeric persisted IDs must match their SVG string representation");
assert.equal(context.LabelerMapController.movePointer({ ...pointerDown, clientX: 0, clientY: 1 }), true);
assert.equal(item.start, 100, "dragging must rotate the canonical station object");
assert.equal(item.outerStart, 100);
assert.equal(item.innerStart, 102);

assert.match(sceneSource, /Active servo move distance overlay", "pointer-events": "none"/);
assert.match(sceneSource, /All servo program moves overlay", "pointer-events": "none"/);
assert.match(sceneSource, /Servo move fault overlay", "pointer-events": "none"/);

assert.match(profileSource, /overWipeDeg: section === "neck" \? 0 : wipe\.overWipeDeg/,
  "the canonical Cold Glue planner must ignore the APL neck over-wipe input");
assert.match(channelSource, /const overWipeDeg = 0;/,
  "the legacy channel adapter must enforce the same Cold Glue rule");

console.log("Map object drag hit-testing and Cold Glue neck over-wipe authority regression passed.");
