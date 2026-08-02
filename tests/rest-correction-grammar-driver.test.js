"use strict";

const assert = require("node:assert/strict");
const driver = require("../drivers/servo/rest-correction-grammar-driver.js");

// Reproduces the LandShark/body-and-back failure observed in staging:
// three consecutive CMD 3 rows at the wipe hold, coding hold and coding
// release, with the coding hold incorrectly appearing to move 151.5 degrees.
const rows = [
  { hmi: 21, plc: 20, cmd: 7, tableAngle: 210, plateAngle: 0, action: "Final Back Wipe Turn" },
  { hmi: 22, plc: 21, cmd: 3, tableAngle: 220, plateAngle: 151.5, action: "Wipe Hold Back - Agg 6", wipeReference: true },
  { hmi: 23, plc: 22, cmd: 3, tableAngle: 230, plateAngle: 151.5, action: "Hold Back Code Box Centerline at Coder", codingHold: true },
  { hmi: 24, plc: 23, cmd: 3, tableAngle: 240, plateAngle: 0, action: "Return Bottle to End Curve Reference After Coding", codingRelease: true },
  { hmi: 25, plc: 24, cmd: 3, tableAngle: 359, plateAngle: 0, action: "End Curve - Rest", terminalRest: true }
];

const result = driver.reconcile(rows, {
  shouldRepair: () => false
});

assert.equal(driver.isCodingRelease(rows[3]), true, "A coding-release marker remains authoritative even if its command was downgraded to CMD 3.");
assert.deepEqual(result.rows.map((row) => row.cmd), [7, 3, 7, 3], "The malformed 3-3-3 block must become Correction-Rest-Correction-Rest.");
assert.equal(result.rows.length, 4, "Duplicate same-angle Rest rows must be merged.");
assert.equal(result.rows[1].plateAngle, 151.5, "The coding hold target must remain unchanged.");
assert.equal(result.rows[1].codingHold, true, "Merged Rest must retain coding-hold metadata.");
assert.equal(result.rows[1].wipeReference, true, "Merged Rest must retain the completed wipe reference.");
assert.equal(result.rows[2].codingRelease, true, "The release row identity must remain intact.");
assert.equal(result.rows[2].plateAngle, 151.5, "The restored CMD 7 release must start from the held coding angle.");
assert.equal(result.rows[2].plannedRotation, -151.5);
assert.ok(Math.abs(result.rows[2].plannedRatio - (151.5 / 119)) < 1e-9);
assert.equal(result.rows[2].plateAngle - result.rows[1].plateAngle, 0, "The coding Rest must produce zero bottle movement.");
assert.equal(result.rows.some((row, index) => Number(row.cmd) === 3 && Number(result.rows[index + 1]?.cmd) === 3), false, "No consecutive Rest commands may remain in the coding-release block.");
assert.equal(result.repairs.some((repair) => repair.strategy === "merge-duplicate-rest-before-coding-release"), true);
assert.equal(result.repairs.some((repair) => repair.strategy === "restore-coding-release-correction"), true);

console.log("LandShark three-Rest coding block regression passed.");
