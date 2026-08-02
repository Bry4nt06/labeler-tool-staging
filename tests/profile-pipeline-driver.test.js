"use strict";

const assert = require("node:assert/strict");
const pipeline = require("../drivers/profile/profile-pipeline-driver.js");

pipeline.reset();
const calls = [];

pipeline.registerStage({
  id: "grammar",
  phase: "grammar",
  order: 600,
  process(rows) {
    calls.push("grammar");
    return [...rows, { cmd: 3, tableAngle: 20, plateAngle: 10 }];
  }
});

pipeline.registerStage({
  id: "orientation",
  phase: "orientation",
  order: 500,
  process(rows) {
    calls.push("orientation");
    return rows.map((row) => ({ ...row, oriented: true }));
  }
});

const result = pipeline.run([{ cmd: 7, tableAngle: 10, plateAngle: 0 }]);
assert.deepEqual(calls, ["orientation", "grammar"]);
assert.deepEqual(result.stageIds, ["orientation", "grammar"]);
assert.equal(result.rows[0].oriented, true);
assert.equal(result.rows[1].cmd, 3);
assert.deepEqual(result.trace.map((entry) => [entry.id, entry.beforeRows, entry.afterRows]), [
  ["orientation", 1, 1],
  ["grammar", 1, 2]
]);

pipeline.registerStage({
  id: "orientation",
  phase: "orientation",
  order: 550,
  process(rows) {
    return rows.map((row) => ({ ...row, replacement: true }));
  }
});
assert.equal(pipeline.listStages()[0].order, 550);
assert.equal(pipeline.run([{ cmd: 3 }]).rows[0].replacement, true);

assert.throws(() => pipeline.registerStage({ id: "invalid" }), /process function/);
assert.throws(
  () => {
    pipeline.registerStage({ id: "bad-return", order: 700, process: () => null });
    pipeline.run([]);
  },
  /did not return a row array/
);

console.log("Ordered profile pipeline regression passed.");
