"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../drivers/geometry/label-geometry-driver.js"), "utf8");
const sandbox = { console, window: null, ServoForgeStartupProgress: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "label-geometry-driver.js" });
const geometry = sandbox.LabelerGeometryDriver;

assert.equal(geometry.neckWrapPlan({ labelLengthMm: 90, circumferenceMm: 100 }).detection, "standard");
assert.equal(geometry.neckWrapPlan({ labelLengthMm: 98, circumferenceMm: 100 }).detection, "near-full");

const detected = geometry.neckWrapPlan({
  labelLengthMm: 104,
  circumferenceMm: 100,
  wrapType: "auto",
  overlapEdge: null,
  seamWipeEnabled: true,
  seamOverWipeDeg: 5
});
assert.ok(Math.abs(detected.calculatedWrapAngleDeg - 374.4) < 1e-9);
assert.equal(detected.calculatedOverlapMm, 4);
assert.ok(Math.abs(detected.calculatedOverlapDeg - 14.4) < 1e-9);
assert.equal(detected.resolvedMode, "full-wrap-overlap");
assert.equal(detected.fullWrapReady, false);
assert.equal(detected.issues.some((issue) => issue.code === "neck-wrap-overlap-edge-required"), true);

const ready = geometry.neckWrapPlan({
  labelLengthMm: 104,
  circumferenceMm: 100,
  wrapType: "auto",
  overlapEdge: "Leading Edge",
  overlapTargetMm: 5,
  seamWipeEnabled: true,
  seamOverWipeDeg: 6
});
assert.equal(ready.overlapEdge, "leading");
assert.equal(ready.underlyingEdge, "trailing");
assert.equal(ready.hasOverlapTargetOverride, true);
assert.equal(ready.targetOverlapMm, 5);
assert.equal(ready.targetOverlapDeg, 18);
assert.equal(ready.motionWrapAngleDeg, 378);
assert.equal(ready.seamOverWipeDeg, 6);
assert.equal(ready.fullWrapReady, true);

const toleranceOverride = geometry.neckWrapPlan({
  labelLengthMm: 99,
  circumferenceMm: 100,
  wrapType: "full-wrap-overlap",
  overlapEdge: "trailing",
  overlapTargetMm: 2,
  seamOverWipeDeg: 100
});
assert.equal(toleranceOverride.fullWrapReady, true, "a deliberate measured target may override nominal geometry");
assert.equal(toleranceOverride.seamOverWipeDeg, 45, "seam over-wipe must retain its safety range after import or direct calls");
assert.equal(toleranceOverride.issues.some((issue) => issue.code === "neck-wrap-target-exceeds-nominal"), true,
  "an overlap target beyond the nominal material must remain visible for operator confirmation");

const forcedStandard = geometry.neckWrapPlan({
  labelLengthMm: 104,
  circumferenceMm: 100,
  wrapType: "standard"
});
assert.equal(forcedStandard.resolvedMode, "standard");
assert.equal(forcedStandard.issues.some((issue) => issue.code === "neck-wrap-standard-overlength"), true);

console.log("Neck-wrap geometry detection and overlap calculation regression passed.");
