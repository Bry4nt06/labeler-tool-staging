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
assert.equal(driver.channelExitHoldAuthority, true);

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

// If the outside brush begins first, it may perform the center-out wipe before
// the opposed portion begins. Once both brushes make contact, however, the
// bottle must hold that established channel angle until the later inside brush
// also clears. The trailing inside-only contact is NOT another turn window.
const outsideFirst = driver.createBrushChannelPlan({
  labelDeg: 65,
  overWipeDeg: 0,
  maxRatio: 21,
  safetyFactor: 0.9,
  mapDirection: "ccw",
  channels: [{
    id: "outside-first",
    outerStart: 83.9,
    outerEnd: 100,
    innerStart: 90,
    innerEnd: 113.9
  }]
});
assert.equal(outsideFirst.channelMoves.length, 3);
const outsideOpening = outsideFirst.channelMoves[0];
const shared = outsideFirst.channelMoves[1];
const insideTailHold = outsideFirst.channelMoves[2];
assert.equal(outsideOpening.stage, "outer");
assert.equal(outsideOpening.start, 83.9);
assert.equal(outsideOpening.end, 90);
assert.ok(Math.abs(outsideOpening.rotation - 32.5) < 1e-9);
assert.equal(shared.stage, "opposed");
assert.equal(shared.start, 90);
assert.equal(shared.end, 100);
assert.equal(shared.holdAngle, 90);
assert.equal(shared.rotation, 0);
assert.equal(insideTailHold.stage, "opposed");
assert.equal(insideTailHold.start, 100);
assert.equal(insideTailHold.end, 113.9);
assert.equal(insideTailHold.rotation, 0);
assert.equal(insideTailHold.parallelBrushHold, false);
assert.equal(insideTailHold.channelClearanceHold, true);
assert.equal(insideTailHold.trailingBrushSide, "inner");
assert.equal(insideTailHold.holdAngle, 90);
assert.equal(outsideFirst.totalRotation, 32.5);
assert.equal(outsideFirst.issues.length, 0);

// The physical rule is symmetric. If the inside brush begins first and the
// outside brush is the side that remains after overlap, that outside tail also
// holds until it clears instead of rotating the bottle into/out of the brush.
const insideFirst = driver.createBrushChannelPlan({
  labelDeg: 65,
  overWipeDeg: 0,
  maxRatio: 21,
  safetyFactor: 0.9,
  mapDirection: "ccw",
  channels: [{
    id: "inside-first",
    innerStart: 83.9,
    innerEnd: 100,
    outerStart: 90,
    outerEnd: 113.9
  }]
});
assert.equal(insideFirst.channelMoves.length, 3);
assert.equal(insideFirst.channelMoves[0].stage, "inner");
assert.ok(Math.abs(insideFirst.channelMoves[0].rotation - 32.5) < 1e-9);
assert.equal(insideFirst.channelMoves[1].stage, "opposed");
assert.equal(insideFirst.channelMoves[2].stage, "opposed");
assert.equal(insideFirst.channelMoves[2].channelClearanceHold, true);
assert.equal(insideFirst.channelMoves[2].trailingBrushSide, "outer");
assert.equal(insideFirst.channelMoves[2].rotation, 0);
assert.equal(insideFirst.channelMoves[2].holdAngle, 90);

// Real saved Cold Glue maps currently store separate brush objects rather than
// a synthetic brush-channel object. Protect that path too: the 60H CG MAB1
// pattern has outside contact 92-125 and inside contact 121-153. Rotation may
// occur over 92-121, overlap 121-125 holds, and 125-153 must remain held until
// the final inside brush clears.
const savedMapPattern = driver.createPlan({
  labelDeg: 65,
  overWipeDeg: 0,
  maxRatio: 24,
  safetyFactor: 0.9,
  mapDirection: "ccw",
  brushes: [
    { id: "outside", kind: "brush", side: "outer", start: 92, end: 125 },
    { id: "inside", kind: "brush", side: "inner", start: 121, end: 153 }
  ]
});
assert.equal(savedMapPattern.channelMoves.length, 3);
assert.equal(savedMapPattern.channelMoves[0].stage, "outer");
assert.equal(savedMapPattern.channelMoves[0].start, 92);
assert.equal(savedMapPattern.channelMoves[0].end, 121);
assert.equal(savedMapPattern.channelMoves[1].stage, "opposed");
assert.equal(savedMapPattern.channelMoves[1].start, 121);
assert.equal(savedMapPattern.channelMoves[1].end, 125);
assert.equal(savedMapPattern.channelMoves[2].stage, "opposed");
assert.equal(savedMapPattern.channelMoves[2].start, 125);
assert.equal(savedMapPattern.channelMoves[2].end, 153);
assert.equal(savedMapPattern.channelMoves[2].channelClearanceHold, true);
assert.equal(savedMapPattern.channelMoves[2].trailingBrushSide, "inner");
assert.equal(savedMapPattern.channelMoves[2].rotation, 0);

// Reverse machine direction must mirror the brush-facing angle and the only
// legal pre-overlap wipe rotation, while the trailing contact still remains a
// hold zone.
const reversed = driver.createBrushChannelPlan({
  labelDeg: 65,
  overWipeDeg: 0,
  maxRatio: 21,
  safetyFactor: 0.9,
  mapDirection: "cw",
  channels: [{
    id: "outside-first-reversed",
    outerStart: 83.9,
    outerEnd: 100,
    innerStart: 90,
    innerEnd: 113.9
  }]
});
assert.equal(reversed.channelEntryAngle, -90);
assert.equal(reversed.channelMoves[0].direction, -1);
assert.equal(reversed.channelMoves[1].holdAngle, -90);
assert.equal(reversed.channelMoves[2].holdAngle, -90);
assert.equal(reversed.channelMoves[2].rotation, 0);
assert.equal(reversed.channelMoves[2].channelClearanceHold, true);

for (const plan of [fullParallel, outsideFirst, insideFirst, savedMapPattern, reversed]) {
  assert.ok(plan.channelMoves.every((move) => move.leadingEdgeWipe !== true));
  assert.ok(plan.channelMoves.every((move) => move.tackMode === "center"));
}

// Static retirement checks: the behavior belongs to the canonical driver and
// generator, not a stack of final runtime wrappers.
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

console.log("Cold Glue canonical brush-channel authority regression passed.");
