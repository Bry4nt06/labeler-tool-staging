"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const driverSource = fs.readFileSync(path.join(root, "drivers/mechanical/cold-glue-motion-driver.js"), "utf8");
const integrationSource = fs.readFileSync(path.join(root, "app/cold-glue-label-relative-brush-entry-integration.js"), "utf8");
const profileSource = fs.readFileSync(path.join(root, "app/cold-glue-profile-generation.js"), "utf8");

const context = { console };
context.window = context;
vm.createContext(context);
vm.runInContext(driverSource, context, { filename: "cold-glue-motion-driver.js" });
vm.runInContext(integrationSource, context, { filename: "cold-glue-label-relative-brush-entry-integration.js" });

assert.match(profileSource, /applicationPlateDeg:\s*applicationTargets\[section\]/,
  "Cold Glue brush planner must receive the current section application datum");

const channel = {
  id: "equal-channel",
  outerStart: 10,
  outerEnd: 30,
  innerStart: 10,
  innerEnd: 30
};

const front = context.LabelerColdGlueMotionDriver.createBrushChannelPlan({
  labelDeg: 50,
  overWipeDeg: 0,
  mapDirection: "ccw",
  applicationPlateDeg: 0,
  channels: [channel]
});
const back = context.LabelerColdGlueMotionDriver.createBrushChannelPlan({
  labelDeg: 50,
  overWipeDeg: 0,
  mapDirection: "ccw",
  applicationPlateDeg: 180,
  channels: [channel]
});

assert.equal(front.channelEntryAngle, 90, "front label should enter at +90° from its 0° application datum");
assert.equal(back.channelEntryAngle, 270, "back label should enter at +90° from its 180° application datum");
assert.equal(front.channelMoves[0].holdAngle, 90);
assert.equal(back.channelMoves[0].holdAngle, 270);
assert.equal((back.channelEntryAngle - front.channelEntryAngle + 360) % 360, 180,
  "back-label brush entry must remain exactly 180° shifted from front-label brush entry");

console.log("Cold Glue back-label brush-entry v325 regression passed.");
