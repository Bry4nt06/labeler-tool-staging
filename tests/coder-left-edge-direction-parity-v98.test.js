"use strict";
const assert = require("node:assert/strict");
const driver = require("../drivers/profile/coder-orientation-driver.js");

const base = {
  section: "back",
  applicationTarget: 90,
  labelWidthDeg: 100,
  codeBoxOffsetDeg: 15,
  inspectionOffsetDeg: 0,
  currentPlateAngle: 90
};

const oneDirection = driver.codeBoxTarget({ ...base, storedDirection: "ccw" });
const oppositeDirection = driver.codeBoxTarget({ ...base, storedDirection: "cw" });

assert.equal(oneDirection.printedCodeBoxDatum, 105);
assert.equal(oppositeDirection.printedCodeBoxDatum, 105);
assert.equal(oneDirection.measuredLocalOffset, 15);
assert.equal(oppositeDirection.measuredLocalOffset, 15);
assert.equal(oneDirection.machineLocalOffset, 15);
assert.equal(oppositeDirection.machineLocalOffset, -15);
assert.equal(oneDirection.rawTarget, 105);
assert.equal(oppositeDirection.rawTarget, 75);
assert.equal(oneDirection.referenceEdge, "left");
assert.equal(oppositeDirection.referenceEdge, "left");
assert.notEqual(oneDirection.physicalDirection, oppositeDirection.physicalDirection);

const legacyNegative = driver.codeBoxTarget({ ...base, codeBoxOffsetDeg: -15, storedDirection: "cw" });
assert.equal(legacyNegative.code, 15);
assert.equal(legacyNegative.rawTarget, 75);

console.log("Coder positive measured input direction transform regression passed.");
