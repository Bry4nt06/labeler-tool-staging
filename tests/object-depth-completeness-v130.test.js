"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const text = (name) => fs.readFileSync(path.join(root, name), "utf8");

const index = text("index.html");
const defaults = text("app/defaults.js");
const setupState = text("app/controllers/setup-state-controller.js");
const setupEvents = text("app/controllers/setup-event-controller-integration.js");
const runtime = text("app/map-runtime-service.js");
const renderer = text("app/assembly-map-renderer.js");

const depthInputs = {
  spenderDepth: "spender",
  codingDepth: "coding",
  sensorDepth: "sensor",
  gripperDepth: "gripper",
  opRollerDepth: "opRoller",
  nonOpRollerDepth: "nonOpRoller",
  wipeOuterDepth: "wipeOuter",
  wipeInnerDepth: "wipeInner",
  brushOuterDepth: "brushOuter",
  brushInnerDepth: "brushInner"
};

Object.entries(depthInputs).forEach(([id, key]) => {
  assert.match(index, new RegExp(`id=["']${id}["']`), `Map Builder must expose ${id}`);
  assert.match(defaults, new RegExp(`\\b${id}:\\s*document\\.querySelector`), `els must bind ${id}`);
  assert.match(setupState, new RegExp(`els\\.${id}[^\\n]*state\\.depths\\?\\.${key}`), `setup state must sync ${key}`);
  assert.match(setupEvents, new RegExp(`\\b${id}:\\s*["']${key}["']`), `change routing must commit ${key}`);
});

["spender", "coding", "sensor", "gripper", "opRoller", "nonOpRoller", "wipeInner", "wipeOuter", "brushInner", "brushOuter"].forEach((key) => {
  assert.match(defaults, new RegExp(`\\b${key}:\\s*-?\\d`), `defaultObjectDepths must define ${key}`);
});

assert.match(renderer, /state\.depths\.sensor/, "sensor must use its own depth");
assert.match(renderer, /state\.depths\.coding/, "coding must use its own depth");
assert.match(renderer, /state\.depths\.gripper/, "gripper must use its own depth");
assert.match(renderer, /state\.depths\.brushOuter/, "outside brush must use its own depth");
assert.match(renderer, /state\.depths\.brushInner/, "inside brush must use its own depth");
assert.doesNotMatch(renderer, /state\.depths\.opRoller\s*\+\s*7/, "sensor must not borrow outside roller depth");

const context = { console, Object, Number };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(runtime, context, { filename: "map-runtime-service.js" });

const legacy = context.LabelerMapRuntimeService.completeObjectDepths({
  spender: 8,
  opRoller: 3,
  nonOpRoller: -3,
  wipeOuter: 16,
  wipeInner: -16
});
assert.equal(legacy.coding, 3, "legacy coder placement must inherit outside roller depth");
assert.equal(legacy.sensor, 10, "legacy sensor placement must inherit outside roller depth + 7");
assert.equal(legacy.gripper, 8, "legacy gripper placement must inherit spender depth");
assert.equal(legacy.brushOuter, 16, "legacy outside brush must inherit outside wipe depth");
assert.equal(legacy.brushInner, -16, "legacy inside brush must inherit inside wipe depth");

const explicit = context.LabelerMapRuntimeService.completeObjectDepths({
  spender: 8,
  coding: 6,
  sensor: 12,
  gripper: 9,
  opRoller: 3,
  nonOpRoller: -3,
  wipeOuter: 16,
  wipeInner: -16,
  brushOuter: 18,
  brushInner: -19
});
assert.equal(explicit.coding, 6);
assert.equal(explicit.sensor, 12);
assert.equal(explicit.gripper, 9);
assert.equal(explicit.brushOuter, 18);
assert.equal(explicit.brushInner, -19);

assert.match(runtime, /map\.depths\s*=\s*\{\s*\.\.\.state\.depths\s*\}/, "migrated depths must be written back to the active map");

console.log("Object depth completeness v130 regression passed.");
