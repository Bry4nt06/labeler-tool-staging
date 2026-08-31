"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const driverSource = fs.readFileSync(path.join(root, "drivers/mechanical/cold-glue-motion-driver.js"), "utf8");
const guardSource = fs.readFileSync(path.join(root, "app/cold-glue-brush-exit-clearance-v24.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(driverSource, { filename: "cold-glue-motion-driver.js" }));
assert.doesNotThrow(() => new vm.Script(guardSource, { filename: "cold-glue-brush-exit-clearance-v24.js" }));

const sandbox = { console, window: null };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(driverSource, sandbox, { filename: "cold-glue-motion-driver.js" });
vm.runInContext(guardSource, sandbox, { filename: "cold-glue-brush-exit-clearance-v24.js" });

const plan = sandbox.LabelerColdGlueMotionDriver.createBrushChannelPlan({
  channels: [{
    id: "agg1-brush-channel",
    outerStart: 80,
    outerEnd: 100,
    innerStart: 90,
    innerEnd: 110
  }],
  labelDeg: 60,
  overWipeDeg: 10,
  maxRatio: 21,
  safetyFactor: 0.9,
  mapDirection: "ccw"
});

const outerOpening = plan.channelMoves.find((move) => move.stage === "outer");
const opposedHold = plan.channelMoves.find((move) => move.stage === "opposed");
const innerExit = plan.channelMoves.find((move) => move.stage === "inner");

assert.ok(outerOpening, "channel must retain the first one-sided opening");
assert.ok(opposedHold, "channel must retain the opposed-brush hold zone");
assert.ok(innerExit, "channel must retain the final single-brush exit window");
assert.equal(outerOpening.rotation, 40,
  "first center-out move remains label/2 plus over-wipe and is not changed by exit protection");
assert.equal(opposedHold.rotation, 0, "opposed brushes must continue holding the bottle angle");
assert.equal(innerExit.rotation, 60,
  "final single-brush exit must rotate one label length, not label plus two over-wipes");
assert.equal(innerExit.centerTackStage, "edge-to-opposite-edge-protected");
assert.equal(innerExit.oppositeLabelEdgeProtected, true);
assert.equal(plan.oppositeLabelEdgeProtection.enabled, true);
assert.equal(plan.oppositeLabelEdgeProtection.configuredOverWipeDeg, 10);
assert.equal(plan.oppositeLabelEdgeProtection.oppositeEdgeClearanceDeg, 10,
  "the existing over-wipe becomes the physical clearance before the opposite label edge reaches the brush");
assert.equal(plan.oppositeLabelEdgeProtection.legacyFinalRotationDeg, 80);
assert.equal(plan.oppositeLabelEdgeProtection.protectedFinalRotationDeg, 60);
assert.equal(plan.issues.some((issue) => issue.code === "cold-glue-brush-exit-clearance-capacity"), false);

console.log("Cold Glue motion-driver exit clearance regression passed.");
