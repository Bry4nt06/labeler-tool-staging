"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const driverPath = path.join(root, "drivers/mechanical/cold-glue-motion-driver.js");
const driverSource = fs.readFileSync(driverPath, "utf8");
assert.doesNotThrow(() => new vm.Script(driverSource, { filename: "cold-glue-motion-driver.js" }));

const sandbox = { console, window: null };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(driverSource, sandbox, { filename: "cold-glue-motion-driver.js" });
const driver = sandbox.LabelerColdGlueMotionDriver;

function channelPlan(overrides = {}) {
  return driver.createBrushChannelPlan({
    channels: [{ id: "neck-channel", outerStart: 80, outerEnd: 100, innerStart: 90, innerEnd: 110 }],
    labelDeg: 60,
    overWipeDeg: 10,
    maxRatio: 21,
    safetyFactor: 0.9,
    mapDirection: "ccw",
    ...overrides
  });
}

const standard = channelPlan();
const standardFirst = standard.channelMoves.find((move) => move.centerTackStage === "center-to-first-edge");
const standardFinal = standard.channelMoves.find((move) => move.centerTackStage === "edge-to-opposite-edge-protected");
assert.equal(driver.standardOppositeEdgeProtectionAuthority, true);
assert.equal(driver.fullWrapOverlapPolicyAuthority, true);
assert.equal(standardFirst.rotation, 40, "standard first-edge wipe remains half a label plus over-wipe");
assert.equal(standardFinal.rotation, 60, "standard final brush must stop before the opposite edge re-enters contact");
assert.equal(standardFinal.oppositeLabelEdgeProtected, true);
assert.equal(standard.oppositeLabelEdgeProtection.enabled, true);
assert.equal(standard.oppositeLabelEdgeProtection.oppositeEdgeClearanceDeg, 10);
assert.equal(standard.oppositeLabelEdgeProtection.legacyFinalRotationDeg, 80);
assert.equal(standard.oppositeLabelEdgeProtection.protectedFinalRotationDeg, 60);

const minimumGuard = channelPlan({ overWipeDeg: 1, labelEdgeGuardDeg: 3 });
const guardedFinal = minimumGuard.channelMoves.find((move) => move.centerTackStage === "edge-to-opposite-edge-protected");
assert.equal(minimumGuard.oppositeLabelEdgeProtection.oppositeEdgeClearanceDeg, 3);
assert.equal(guardedFinal.rotation, 58, "minimum guard stops three bottle degrees before the opposite edge");

const fullWrap = driver.createBrushChannelPlan({
  channels: [{ id: "full-neck-channel", outerStart: 70, outerEnd: 120, innerStart: 100, innerEnd: 150 }],
  labelDeg: 372,
  overWipeDeg: 10,
  maxRatio: 21,
  safetyFactor: 0.9,
  mapDirection: "ccw",
  wrapPlan: {
    resolvedMode: "full-wrap-overlap",
    overlapEdge: "leading",
    targetOverlapDeg: 12,
    motionWrapAngleDeg: 372,
    seamWipeEnabled: true,
    seamOverWipeDeg: 5
  }
});

assert.equal(fullWrap.overlapWrap, true);
assert.equal(fullWrap.oppositeLabelEdgeProtection.enabled, false);
assert.equal(fullWrap.oppositeLabelEdgeProtection.permittedCrossing, true);
assert.equal(fullWrap.oppositeLabelEdgeProtection.permittedOverlapEdge, "leading");
assert.equal(fullWrap.oppositeLabelEdgeProtection.underlyingEdge, "trailing");
assert.equal(fullWrap.process.reduce((sum, move) => sum + move.rotation, 0), 196,
  "first edge receives half the target wrap plus normal over-wipe");
assert.equal(fullWrap.final.reduce((sum, move) => sum + move.rotation, 0), 387,
  "final wipe covers the circumference, target overlap, and dedicated seam over-wipe");
assert.deepStrictEqual(
  [...new Set(fullWrap.channelMoves.map((move) => move.wrapStage).filter(Boolean))],
  ["first-edge-wipe", "circumference-wipe", "overlap-edge-crossing", "seam-wipe"]
);
const crossing = fullWrap.channelMoves.find((move) => move.wrapStage === "overlap-edge-crossing");
const seam = fullWrap.channelMoves.find((move) => move.wrapStage === "seam-wipe");
assert.equal(crossing.permittedOverlapEdge, "leading");
assert.equal(crossing.rotation, 12);
assert.equal(seam.rotation, 5);
assert.equal(fullWrap.seamWipePlan.fullySeated, true);
assert.equal(fullWrap.issues.length, 0);

const blockedWrap = channelPlan({
  labelDeg: 372,
  wrapPlan: {
    resolvedMode: "full-wrap-overlap",
    overlapEdge: null,
    targetOverlapDeg: 12,
    motionWrapAngleDeg: 372,
    seamWipeEnabled: true,
    seamOverWipeDeg: 5
  }
});
assert.equal(blockedWrap.overlapWrap, false, "an unspecified overlap edge must never be allowed to cross");
assert.equal(blockedWrap.oppositeLabelEdgeProtection.enabled, true);
assert.equal(blockedWrap.issues.some((issue) => issue.code === "neck-wrap-overlap-edge-required"), true);

const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert.doesNotMatch(appSource, /cold-glue-brush-exit-clearance-v24/);
assert.equal(fs.existsSync(path.join(root, "app/cold-glue-brush-exit-clearance-v24.js")), false,
  "the superseded runtime wrapper must be retired after consolidation into the canonical driver");

console.log("Cold Glue standard edge protection and full neck-wrap overlap policy regression passed.");
