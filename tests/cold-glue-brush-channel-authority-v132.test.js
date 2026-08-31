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
assert.equal(driver.channelRunoutWipeAuthority, true);

// Machine-map direction tokens preserve ServoForge's legacy inverted storage
// convention. Cold Glue must use physical machine travel before choosing which
// way the bottle turns away from a brush. The final standard-label runout must
// stop at the protected edge clearance instead of allowing the opposite edge
// to re-enter the remaining brush.
assert.equal(driver.physicalMachineDirection("ccw"), "cw");
assert.equal(driver.physicalMachineDirection("cw"), "ccw");
assert.equal(driver.wipeDirectionForSide("outer", "ccw"), 1);
assert.equal(driver.wipeDirectionForSide("inner", "ccw"), -1);
assert.equal(driver.wipeDirectionForSide("outer", "cw"), -1);
assert.equal(driver.wipeDirectionForSide("inner", "cw"), 1);

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

// When one brush ends first, the remaining one-sided section is the physical
// wipe-away runout. The bottle must rotate away from the brush that is still in
// contact for the remaining label-length wipe; it must never first turn into it.
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
const insideRunout = outsideFirst.channelMoves[2];
assert.equal(outsideOpening.stage, "outer");
assert.equal(outsideOpening.start, 83.9);
assert.equal(outsideOpening.end, 90);
assert.equal(outsideOpening.direction, 1);
assert.ok(Math.abs(outsideOpening.rotation - 32.5) < 1e-9);
assert.equal(shared.stage, "opposed");
assert.equal(shared.start, 90);
assert.equal(shared.end, 100);
assert.equal(shared.holdAngle, 90);
assert.equal(shared.rotation, 0);
assert.equal(insideRunout.stage, "inner");
assert.equal(insideRunout.start, 100);
assert.equal(insideRunout.end, 113.9);
assert.equal(insideRunout.direction, -1,
  "stored ccw means physical CW, so an inside-brush runout must turn negative/away from the brush");
assert.ok(Math.abs(insideRunout.rotation - 62) < 1e-9,
  "the remaining inside brush must stop at the three-degree opposite-edge guard");
assert.equal(insideRunout.centerTackStage, "edge-to-opposite-edge-protected");
assert.equal(insideRunout.oppositeLabelEdgeProtected, true);
assert.equal(outsideFirst.totalRotation, 94.5);
assert.equal(outsideFirst.issues.length, 0);

// The physical rule is symmetric. If the outside brush remains after overlap,
// the outside runout turns in the opposite physical direction for one label
// length until the wiped label is clear.
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
assert.equal(insideFirst.channelMoves[0].direction, -1);
assert.ok(Math.abs(insideFirst.channelMoves[0].rotation - 32.5) < 1e-9);
assert.equal(insideFirst.channelMoves[1].stage, "opposed");
assert.equal(insideFirst.channelMoves[2].stage, "outer");
assert.equal(insideFirst.channelMoves[2].direction, 1);
assert.ok(Math.abs(insideFirst.channelMoves[2].rotation - 62) < 1e-9);

// Real saved Cold Glue maps currently store separate brush objects rather than
// a synthetic brush-channel object. Protect the 60H CG MAB1 pattern: outside
// contact 92-125, inside contact 121-153. Once the outside brush ends at 125,
// the remaining inside brush must drive the label away, not hold or turn into it.
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
assert.equal(savedMapPattern.channelMoves[0].direction, 1);
assert.equal(savedMapPattern.channelMoves[1].stage, "opposed");
assert.equal(savedMapPattern.channelMoves[1].start, 121);
assert.equal(savedMapPattern.channelMoves[1].end, 125);
assert.equal(savedMapPattern.channelMoves[2].stage, "inner");
assert.equal(savedMapPattern.channelMoves[2].start, 125);
assert.equal(savedMapPattern.channelMoves[2].end, 153);
assert.equal(savedMapPattern.channelMoves[2].direction, -1);
assert.ok(Math.abs(savedMapPattern.channelMoves[2].rotation - 62) < 1e-9);
assert.equal(savedMapPattern.issues.length, 0);

// Reversing the stored machine direction mirrors both physical wipe directions.
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
assert.equal(reversed.channelMoves[2].stage, "inner");
assert.equal(reversed.channelMoves[2].direction, 1);
assert.ok(Math.abs(reversed.channelMoves[2].rotation - 62) < 1e-9);

for (const plan of [fullParallel, outsideFirst, insideFirst, savedMapPattern, reversed]) {
  assert.ok(plan.channelMoves.every((move) => move.leadingEdgeWipe !== true));
  assert.ok(plan.channelMoves.every((move) => move.tackMode === "center"));
}

// The neck gripper/channel generator must consume the canonical direction rule;
// it may not keep a second hard-coded inside/outside sign table.
const gripperChannelSource = fs.readFileSync(path.join(root, "app/cold-glue-gripper-channel-integration.js"), "utf8");
assert.match(gripperChannelSource, /LabelerColdGlueMotionDriver\.wipeDirectionForSide/);
assert.doesNotMatch(gripperChannelSource, /openSide\s*===\s*["']inner["']\s*\?\s*1\s*:\s*-1/);
assert.match(gripperChannelSource, /Protected Neck Exit Away from/);
assert.match(gripperChannelSource, /wrapPlan\?\.resolvedMode === "full-wrap-overlap"\) return originalBlock/,
  "the legacy gripper/channel adapter must preserve the canonical full-wrap overlap stages");
assert.match(gripperChannelSource, /labelDeg \+ overWipeDeg - oppositeEdgeClearanceDeg/,
  "the legacy adapter must keep the standard opposite-edge clearance after wrapper consolidation");

// Static retirement checks: the behavior belongs to the canonical driver and
// generator, not a stack of final runtime wrappers.
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const generatorSource = fs.readFileSync(path.join(root, "app/cold-glue-profile-generation.js"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
assert.match(appSource, /canonical Cold Glue brush planner/i);
assert.match(appSource, /full-wrap seam policy/i);
assert.doesNotMatch(appSource, /cold-glue-brush-direction-v128|cold-glue-brush-runtime-v131/);
assert.doesNotMatch(appSource, /cold-glue-brush-exit-clearance-v24/);
assert.match(generatorSource, /createBrushChannelPlan/);
assert.match(generatorSource, /Parallel Brush Hold/);
assert.match(generatorSource, /Brush Opening Center-Out Wipe/);
assert.doesNotMatch(workerSource, /cold-glue-center-out-brush-integration|cold-glue-neck-left-right-integration/);
for (const retired of [
  "app/cold-glue-brush-direction-v128.js",
  "app/cold-glue-brush-runtime-v131.js",
  "app/cold-glue-center-out-brush-integration.js",
  "app/cold-glue-neck-left-right-integration.js",
  "app/cold-glue-brush-exit-clearance-v24.js"
]) {
  assert.equal(fs.existsSync(path.join(root, retired)), false, `${retired} must be retired after v132`);
}

console.log("Cold Glue canonical brush-channel authority regression passed.");
