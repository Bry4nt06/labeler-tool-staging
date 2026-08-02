"use strict";

const assert = require("node:assert/strict");
const driver = require("../drivers/servo/rest-correction-grammar-driver.js");

const rows = [
  { hmi: 22, plc: 21, cmd: 7, tableAngle: 220, plateAngle: 0, action: "Center Back Code Box at Coder", codingMotion: "code-box-centerline" },
  { hmi: 23, plc: 22, cmd: 3, tableAngle: 230, plateAngle: 151.5, action: "Hold Back Code Box Centerline at Coder", codingHold: true },
  { hmi: 24, plc: 23, cmd: 7, tableAngle: 240, plateAngle: 0, action: "Return Bottle to End Curve Reference After Coding", codingRelease: true },
  { hmi: 25, plc: 24, cmd: 3, tableAngle: 250, plateAngle: 20, action: "End Curve - Rest", terminalRest: true }
];

const result = driver.reconcile(rows, {
  shouldRepair: () => false
});

assert.equal(driver.isCodingRelease(rows[2]), true);
assert.equal(result.repairs.length, 1);
assert.equal(result.repairs[0].strategy, "preserve-coding-release-handoff");
assert.equal(result.repairs[0].automaticCodingRelease, true);
assert.equal(result.repairs[0].rejectedPlateTravel, -151.5);
assert.equal(result.rows[1].plateAngle, 151.5, "Coding Rest target must remain unchanged.");
assert.equal(result.rows[2].plateAngle, 151.5, "Coding release must start from the held coding angle.");
assert.equal(result.rows[2].plannedRotation, -131.5);
assert.equal(result.rows[2].plannedRatio, 13.15);
assert.equal(result.rows[2].plateAngle - result.rows[1].plateAngle, 0, "CMD 3 must produce zero bottle movement.");

console.log("Body/back coding-release grammar regression passed.");
