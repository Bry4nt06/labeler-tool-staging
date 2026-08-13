"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const driver = require("../drivers/profile/coder-orientation-driver.js");

function norm(value) {
  let angle = Number(value) % 360;
  if (angle < 0) angle += 360;
  return angle;
}

function worldAngle(storedAngle, storedDirection) {
  const signed = storedDirection === "cw" ? -1 : 1;
  const zeroBase = storedDirection === "cw" ? 180 : 0;
  return norm(zeroBase + signed * Number(storedAngle));
}

function circularDistance(a, b) {
  const delta = Math.abs(norm(a) - norm(b));
  return Math.min(delta, 360 - delta);
}

const generic = {
  section: "back",
  applicationTarget: 0,
  labelWidthDeg: 100,
  codeBoxOffsetDeg: 20,
  inspectionOffsetDeg: 0,
  currentPlateAngle: 20
};
const ccw = driver.codeBoxTarget({ ...generic, storedDirection: "ccw" });
const cw = driver.codeBoxTarget({ ...generic, storedDirection: "cw" });
assert.equal(ccw.rawTarget, 20, "20° from the printed left edge must remain 20° logically.");
assert.equal(cw.rawTarget, 20, "Changing machine direction must not swap to the opposite printed edge.");
assert.equal(ccw.target, cw.target);
assert.equal(ccw.referenceEdge, "left");
assert.equal(cw.referenceEdge, "left");
assert.equal(ccw.directionInvariantLeftEdge, true);
assert.equal(cw.directionInvariantLeftEdge, true);
assert.notEqual(ccw.physicalDirection, cw.physicalDirection, "Physical machine direction metadata still changes.");

// LandShark back-label values from the shipped catalog. The old calculation
// separated CW/CCW by ~33°, which is large enough to produce the photographed
// mismatch at the coder. v98 keeps the exact printed code-box datum identical.
const circumferenceMm = 188.747;
const labelWidthDeg = 47.498 / circumferenceMm * 360;
const codeBoxOffsetDeg = 15 / circumferenceMm * 360;
const landshark = {
  section: "back",
  applicationTarget: 90,
  labelWidthDeg,
  codeBoxOffsetDeg,
  inspectionOffsetDeg: 0,
  currentPlateAngle: 120
};
const landCcw = driver.codeBoxTarget({ ...landshark, storedDirection: "ccw" });
const landCw = driver.codeBoxTarget({ ...landshark, storedDirection: "cw" });
assert.ok(Math.abs(landCcw.rawTarget - landCw.rawTarget) < 1e-9);
assert.ok(Math.abs(landCcw.rawTarget - (90 + codeBoxOffsetDeg)) < 1e-9);

// Default coder window is 304°–309°. CMD 3 starts holding at 299° and remains
// stationary through the 306.5° coder center. World mirroring must preserve
// that same 7.5° physical table separation in both directions.
const ready = 299;
const coderCenter = 306.5;
assert.equal(circularDistance(worldAngle(ready, "ccw"), worldAngle(coderCenter, "ccw")), 7.5);
assert.equal(circularDistance(worldAngle(ready, "cw"), worldAngle(coderCenter, "cw")), 7.5);

const integration = fs.readFileSync(path.join(__dirname, "..", "app", "apl-coder-codebox-orientation-integration.js"), "utf8");
assert.match(integration, /codingWindowCenter:\s*finish\(coderCenter\)/);
assert.match(integration, /const readyTable = coderStart - PRE_CODER_MARGIN_DEG/);
console.log("Coder left-edge direction parity v98 regression passed.");
