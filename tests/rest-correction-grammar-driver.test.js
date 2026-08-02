"use strict";

const assert = require("node:assert/strict");
const driver = require("../drivers/servo/rest-correction-grammar-driver.js");

const rows = [
  { hmi: 22, plc: 21, cmd: 7, tableAngle: 220, plateAngle: 0, action: "Turn for Coding" },
  { hmi: 23, plc: 22, cmd: 3, tableAngle: 230, plateAngle: 151.5, action: "Hold for Coding", codingHold: true },
  { hmi: 24, plc: 23, cmd: 7, tableAngle: 240, plateAngle: 0, action: "Continue After Coder" },
  { hmi: 25, plc: 24, cmd: 3, tableAngle: 250, plateAngle: 20, action: "End Curve - Rest", terminalRest: true }
];

const result = driver.reconcile(rows, {
  preserveRestIndexes: [1],
  shouldRepair: () => true
});

assert.equal(result.repairs.length, 1);
assert.equal(result.repairs[0].strategy, "preserve-rest-target");
assert.equal(result.repairs[0].rejectedPlateTravel, -151.5);
assert.equal(result.rows[1].plateAngle, 151.5, "Coding Rest target must remain unchanged.");
assert.equal(result.rows[2].plateAngle, 151.5, "Following motion must start from the held coding angle.");
assert.equal(result.rows[2].plannedRotation, -131.5);
assert.equal(result.rows[2].plannedRatio, 13.15);
assert.equal(result.rows[2].plateAngle - result.rows[1].plateAngle, 0, "CMD 3 must produce zero bottle movement.");

console.log("Rest/Correction grammar driver regression passed.");
