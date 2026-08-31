"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/cold-glue-brush-exit-clearance-v24.js"), "utf8");
assert.doesNotThrow(() => new vm.Script(source, { filename: "cold-glue-brush-exit-clearance-v24.js" }));

function basePlan(overWipeDeg = 10) {
  return {
    source: "cold-glue-brush-channel",
    labelDeg: 60,
    overWipeDeg,
    totalRotation: 120,
    finalPlateTravel: -40,
    channelMoves: [
      {
        key: "first",
        stage: "outer",
        side: "outer",
        start: 80,
        end: 90,
        span: 10,
        rotation: 40,
        ratio: 4,
        direction: 1,
        centerTackStage: "center-to-first-edge"
      },
      {
        key: "parallel",
        stage: "opposed",
        start: 90,
        end: 100,
        span: 10,
        rotation: 0,
        ratio: 0,
        direction: 0,
        parallelBrushHold: true
      },
      {
        key: "final",
        stage: "inner",
        side: "inner",
        start: 100,
        end: 110,
        span: 10,
        rotation: 80,
        ratio: 8,
        direction: -1,
        centerTackStage: "edge-to-opposite-edge"
      }
    ],
    process: [{ key: "first", stage: "outer", side: "outer", start: 80, end: 90, span: 10, rotation: 40, ratio: 4, direction: 1, centerTackStage: "center-to-first-edge" }],
    final: [{ key: "final", stage: "inner", side: "inner", start: 100, end: 110, span: 10, rotation: 80, ratio: 8, direction: -1, centerTackStage: "edge-to-opposite-edge" }],
    holds: [{ key: "parallel", stage: "opposed", start: 90, end: 100, span: 10, rotation: 0, ratio: 0, direction: 0 }],
    phasePlans: [
      { side: "outer", windows: [{ key: "first" }], requiredRotation: 40, remaining: 0, ratio: 4 },
      { side: "inner", windows: [{ key: "final" }], requiredRotation: 80, remaining: 0, ratio: 8 }
    ],
    issues: [],
    tackMode: "center"
  };
}

const sandbox = {
  console,
  window: null
};
sandbox.window = sandbox;
sandbox.LabelerColdGlueMotionDriver = Object.freeze({
  createBrushChannelPlan(options) {
    return basePlan(Number(options?.overWipeDeg ?? 10));
  },
  createPlan(options) {
    return basePlan(Number(options?.overWipeDeg ?? 10));
  }
});
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "cold-glue-brush-exit-clearance-v24.js" });

const protectedPlan = sandbox.LabelerColdGlueMotionDriver.createBrushChannelPlan({
  labelDeg: 60,
  overWipeDeg: 10,
  maxRatio: 21,
  safetyFactor: 0.9
});
const protectedFinal = protectedPlan.channelMoves.find((move) => move.key === "final");

assert.equal(protectedPlan.oppositeLabelEdgeProtection.enabled, true);
assert.equal(protectedPlan.oppositeLabelEdgeProtection.brushSide, "inner");
assert.equal(protectedPlan.oppositeLabelEdgeProtection.legacyFinalRotationDeg, 80,
  "legacy final phase would rotate past the opposite edge by the configured over-wipe");
assert.equal(protectedPlan.oppositeLabelEdgeProtection.protectedFinalRotationDeg, 60,
  "with 10 deg configured over-wipe, the final single-brush phase must stop one over-wipe before the opposite edge");
assert.equal(protectedPlan.oppositeLabelEdgeProtection.oppositeEdgeClearanceDeg, 10);
assert.equal(protectedFinal.rotation, 60);
assert.equal(protectedFinal.direction, -1, "exit protection must preserve the physical wipe-away direction");
assert.equal(protectedFinal.centerTackStage, "edge-to-opposite-edge-protected");
assert.equal(protectedFinal.oppositeLabelEdgeProtected, true);
assert.equal(protectedPlan.channelMoves.some((move) => move.exitClearanceHold), false,
  "protection must come from bottle-angle clearance, not an invented extra brush or table hold");

const minimumGuardPlan = sandbox.LabelerColdGlueMotionDriver.createBrushChannelPlan({
  labelDeg: 60,
  overWipeDeg: 1,
  labelEdgeGuardDeg: 3,
  maxRatio: 21,
  safetyFactor: 0.9
});
const minimumGuardFinal = minimumGuardPlan.channelMoves.find((move) => move.key === "final");
assert.equal(minimumGuardPlan.oppositeLabelEdgeProtection.oppositeEdgeClearanceDeg, 3,
  "a small configured over-wipe must be raised to the minimum opposite-edge clearance");
assert.equal(minimumGuardFinal.rotation, 58,
  "final rotation must stop three bottle degrees before the opposite label edge when over-wipe is smaller than the guard");

console.log("Cold Glue brush exit opposite-label-edge clearance regression passed.");
