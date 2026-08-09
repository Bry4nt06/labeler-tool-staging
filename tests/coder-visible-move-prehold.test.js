"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.resolve(__dirname, "../app/topmodul-coder-prehold-finalizer-integration.js"),
  "utf8"
);

const context = {
  console,
  state: {
    applicationMode: "apl",
    program: [],
    motionPlan: { rows: [], termination: {} }
  },
  LabelerProfilePipelineOrchestratorInstalled: true,
  LabelerCoderWindowReferenceHandoff: { installed: true },
  LabelerTopModulCorrectionChainLimit: { installed: true },
  activeMachineMap() {
    return {
      name: "APL 6-Aggregate",
      machineType: "TopModul",
      applicationMode: "apl",
      aggregateCount: 6,
      objects: [
        {
          id: "apl-coding-default",
          name: "Coding",
          kind: "coding",
          start: 304,
          end: 309,
          orientBottle: true,
          orientationTarget: "code-box"
        }
      ]
    };
  },
  applyGeneratedServoProfile() {
    // This reproduces the live failure seen on the map: the real coding move is
    // present, but its destination was left as the 359° terminal Rest instead
    // of a tagged codingHold row. The all-program-moves overlay therefore drew
    // one large brown wedge through the coder.
    const rows = [
      { cmd: 3, tableAngle: 290, plateAngle: 228.5, action: "Wipe Hold Back - Agg 6" },
      {
        cmd: 7,
        tableAngle: 290.5,
        plateAngle: 228.5,
        action: "Orient Back Code Box for Coding",
        codingObjectId: "apl-coding-default",
        mapObjectOrientation: true,
        plannedRotation: -71
      },
      {
        cmd: 3,
        tableAngle: 359,
        plateAngle: 157.5,
        action: "End Curve - Rest",
        terminalRest: true
      }
    ].map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
    context.state.program = rows;
    context.state.motionPlan.rows = rows;
    return rows;
  },
  setTimeout(callback) { callback(); }
};

context.window = context;
context.globalThis = context;
vm.createContext(context);
assert.doesNotThrow(() => new vm.Script(source, { filename: "topmodul-coder-prehold-finalizer-integration.js" }));
vm.runInContext(source, context);

const rows = context.applyGeneratedServoProfile();
assert.equal(context.LabelerTopModulCoderPreholdFinalizer.version, 5);
assert.equal(context.LabelerTopModulCoderPreholdFinalizer.finalCodingHoldIndex(rows), 2);
assert.equal(rows.length, 3);
assert.equal(rows[1].cmd, 7);
assert.equal(rows[1].tableAngle, 290.5);
assert.equal(rows[1].action, "Orient Back Code Box for Coding");
assert.equal(rows[2].cmd, 3);
assert.equal(rows[2].tableAngle, 299, "The visible coding move must terminate at 299°, five degrees before the 304° coder.");
assert.equal(rows[2].plateAngle, 157.5);
assert.equal(rows[2].action, "Hold for Coding");
assert.equal(rows[2].codingHold, true);
assert.equal(rows[2].terminalRest, true);
assert.equal(rows[2].coderStartTableAngle, 304);
assert.equal(rows[2].preCoderMarginDeg, 5);
assert.equal(rows.some((row) => Number(row.tableAngle) === 359), false);

const visibleCodingMove = rows.find((row) => Number(row.cmd) === 7 && /Orient Back Code Box for Coding/.test(row.action));
const visibleCodingMoveIndex = rows.indexOf(visibleCodingMove);
const visibleDestination = rows[visibleCodingMoveIndex + 1];
assert.equal(visibleDestination.tableAngle, 299,
  "The all-program-moves brown wedge must end at the 299° pre-coder line, not at 359°."
);
assert.equal(context.state.motionPlan.termination.tableAngle, 299);

console.log("Visible APL 6-Aggregate coding move now terminates at the 299° pre-coder line.");