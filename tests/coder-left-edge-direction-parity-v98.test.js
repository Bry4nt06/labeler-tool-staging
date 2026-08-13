"use strict";
const assert = require("node:assert/strict");
const driver = require("../drivers/profile/coder-orientation-driver.js");

function norm(angle) {
  const value = angle % 360;
  return value < 0 ? value + 360 : value;
}

function angularError(a, b) {
  return Math.abs(((norm(a) - norm(b) + 540) % 360) - 180);
}

// Exact Land Shark geometry from the repository catalog.
const circumferenceMm = Math.PI * (60.68 - 2 * 0.3);
const labelWidthDeg = 47.498 / circumferenceMm * 360;
const codeBoxOffsetDeg = 15 / circumferenceMm * 360;
const base = {
  section: "back",
  applicationTarget: 90,
  labelWidthDeg,
  codeBoxOffsetDeg,
  inspectionOffsetDeg: 0,
  currentPlateAngle: -180,
  coderSide: "outer"
};

const physicalClockwise = driver.codeBoxTarget({ ...base, storedDirection: "ccw" });
const physicalCounterClockwise = driver.codeBoxTarget({ ...base, storedDirection: "cw" });

const expectedLocalCodeBox = 180 - labelWidthDeg / 2 + codeBoxOffsetDeg;
assert.ok(Math.abs(physicalClockwise.printedCodeBoxLocalAngle - expectedLocalCodeBox) < 1e-9);
assert.ok(Math.abs(physicalCounterClockwise.printedCodeBoxLocalAngle - expectedLocalCodeBox) < 1e-9);
assert.equal(physicalClockwise.referenceEdge, "left");
assert.equal(physicalCounterClockwise.referenceEdge, "left");
assert.equal(physicalClockwise.coderFacingRay, 0);
assert.equal(physicalCounterClockwise.coderFacingRay, 0);

// Use the exact world transform used by map-animation-renderer.js:
// servoSign*plate + bottleLocalFeature must land on the outer coder radial ray.
assert.ok(angularError(
  physicalClockwise.servoDirectionSign * physicalClockwise.target + expectedLocalCodeBox,
  0
) < 1e-9);
assert.ok(angularError(
  physicalCounterClockwise.servoDirectionSign * physicalCounterClockwise.target + expectedLocalCodeBox,
  0
) < 1e-9);

// Direction changes the servo command, not the printed datum.
assert.ok(Math.abs(physicalClockwise.target - (-163.31289031424907)) < 1e-6);
assert.ok(Math.abs(physicalCounterClockwise.target - (-196.68710968575093)) < 1e-6);
assert.notEqual(physicalClockwise.target, physicalCounterClockwise.target);

// Application hold angle is not the coder-facing reference once the label is on.
const changedApplication = driver.codeBoxTarget({
  ...base,
  applicationTarget: -42,
  storedDirection: "ccw"
});
assert.ok(Math.abs(changedApplication.target - physicalClockwise.target) < 1e-9);
assert.equal(changedApplication.applicationTargetExcludedFromCoderFacing, true);

// The UI stores a physical positive measurement; legacy negative workarounds are
// still normalized to the same measured magnitude.
const legacyNegative = driver.codeBoxTarget({
  ...base,
  codeBoxOffsetDeg: -codeBoxOffsetDeg,
  storedDirection: "cw"
});
assert.ok(Math.abs(legacyNegative.target - physicalCounterClockwise.target) < 1e-9);

// Generalize the same physical equation for a coder mounted toward the center.
const innerCoder = driver.codeBoxTarget({ ...base, coderSide: "inner", storedDirection: "ccw" });
assert.equal(innerCoder.coderFacingRay, 180);
assert.ok(angularError(
  innerCoder.servoDirectionSign * innerCoder.target + expectedLocalCodeBox,
  180
) < 1e-9);

console.log("Coder bottle-local radial alignment v102 regression passed.");
