"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const driverSource = fs.readFileSync(path.join(root, "drivers/mechanical/cold-glue-motion-driver.js"), "utf8");
const context = { console };
context.window = context;
vm.createContext(context);
vm.runInContext(driverSource, context, { filename: "cold-glue-motion-driver.js" });
const driver = context.LabelerColdGlueMotionDriver;

assert.ok(driver, "Cold Glue motion driver must load");
assert.equal(driver.centerTackOnly, true);
assert.equal(driver.leadingEdgeWipeAllowed, false);
assert.equal(driver.parallelOverlapTurnsBottle, false);

// Entire brush channel runs parallel: enter facing the channel and hold that
// angle for the complete channel. No bottle rotation may be allocated here.
const fullParallel = driver.createBrushChannelPlan({
  labelDeg: 65,
  overWipeDeg: 0,
  maxRatio: 21,
  safetyFactor: 0.9,
  mapDirection: "ccw",
  channels: [{
    id: "parallel",
    outerStart: 83.9,
    outerEnd: 113.9,
    innerStart: 83.9,
    innerEnd: 113.9
  }]
});
assert.equal(fullParallel.channelEntryAngle, 90);
assert.equal(fullParallel.channelMoves.length, 1);
assert.equal(fullParallel.channelMoves[0].stage, "opposed");
assert.equal(fullParallel.channelMoves[0].start, 83.9);
assert.equal(fullParallel.channelMoves[0].end, 113.9);
assert.equal(fullParallel.channelMoves[0].holdAngle, 90);
assert.equal(fullParallel.channelMoves[0].rotation, 0);
assert.equal(fullParallel.totalRotation, 0);
assert.equal(fullParallel.issues.length, 0, "a fully parallel brush channel is a valid hold zone, not a closed-channel fault");

// Screenshot case: outside brush ends at 100 while inside brush continues to
// 113.9. Hold 90 degrees through 83.9 -> 100, then consume the remaining
// center-to-edge rotation over exactly the 13.9-degree inside-only opening.
const partialOpening = driver.createBrushChannelPlan({
  labelDeg: 65,
  overWipeDeg: 0,
  maxRatio: 21,
  safetyFactor: 0.9,
  mapDirection: "ccw",
  channels: [{
    id: "partial",
    outerStart: 83.9,
    outerEnd: 100,
    innerStart: 83.9,
    innerEnd: 113.9
  }]
});
assert.equal(partialOpening.channelMoves.length, 2);
const shared = partialOpening.channelMoves[0];
const insideOpening = partialOpening.channelMoves[1];
assert.equal(shared.stage, "opposed");
assert.equal(shared.start, 83.9);
assert.equal(shared.end, 100);
assert.equal(shared.holdAngle, 90);
assert.equal(shared.rotation, 0);
assert.equal(insideOpening.stage, "inner");
assert.equal(insideOpening.start, 100);
assert.equal(insideOpening.end, 113.9);
assert.equal(insideOpening.direction, 1);
assert.ok(Math.abs(insideOpening.rotation - 32.5) < 1e-9);
assert.ok(Math.abs(insideOpening.ratio - (32.5 / 13.9)) < 1e-9,
  "remaining turn speed must be based on the available one-sided opening length");
assert.equal(insideOpening.centerTackStage, "center-to-first-edge");
assert.equal(partialOpening.issues.length, 0);

// Reverse machine direction must mirror both brush-facing angle and rotation.
const reversed = driver.createBrushChannelPlan({
  labelDeg: 65,
  overWipeDeg: 0,
  maxRatio: 21,
  safetyFactor: 0.9,
  mapDirection: "cw",
  channels: [{
    id: "partial-reversed",
    outerStart: 83.9,
    outerEnd: 100,
    innerStart: 83.9,
    innerEnd: 113.9
  }]
});
assert.equal(reversed.channelEntryAngle, -90);
assert.equal(reversed.channelMoves[0].holdAngle, -90);
assert.equal(reversed.channelMoves[1].direction, -1);

for (const plan of [fullParallel, partialOpening, reversed]) {
  assert.ok(plan.channelMoves.every((move) => move.leadingEdgeWipe !== true));
  assert.ok(plan.channelMoves.every((move) => move.tackMode === "center"));
}

// Static retirement checks: v132 is core driver/generator behavior, not a
// stack of final runtime wrappers.
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const generatorSource = fs.readFileSync(path.join(root, "app/cold-glue-profile-generation.js"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
assert.match(appSource, /canonical Cold Glue center-tack brush-channel planner/i);
assert.doesNotMatch(appSource, /cold-glue-brush-direction-v128|cold-glue-brush-runtime-v131/);
assert.match(generatorSource, /createBrushChannelPlan/);
assert.match(generatorSource, /Parallel Brush Hold/);
assert.match(generatorSource, /Brush Opening Center-Out Wipe/);
assert.doesNotMatch(workerSource, /cold-glue-center-out-brush-integration|cold-glue-neck-left-right-integration/);
for (const retired of [
  "app/cold-glue-brush-direction-v128.js",
  "app/cold-glue-brush-runtime-v131.js",
  "app/cold-glue-center-out-brush-integration.js",
  "app/cold-glue-neck-left-right-integration.js"
]) {
  assert.equal(fs.existsSync(path.join(root, retired)), false, `${retired} must be retired after v132`);
}

console.log("Cold Glue canonical brush-channel authority v132 regression passed.");
