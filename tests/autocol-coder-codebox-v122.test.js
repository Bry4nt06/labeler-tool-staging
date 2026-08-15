"use strict";

const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");
global.window = global;

global.finishAngle = (value) => Math.round(Number(value) * 10) / 10;
global.sectionLabel = (section) => ({ neck: "Neck", body: "Body", back: "Back" }[section] || "Label");
global.degFromMm = (mm, circumference) => Number(mm) / Number(circumference) * 360;
global.bodyCircumference = () => Math.PI * 100;
global.sectionWipePlan = () => ({ labelDeg: 100 / (Math.PI * 100) * 360, overWipeDeg: 0 });
global.selectedLabelApplicationState = () => ({ neck: false, body: true, back: false });
global.selectedLabelSpec = () => ({ bodyLengthMm: 100, codeBoxCenterMm: 10 });
global.selectedBottleSpec = () => ({ bottleType: "test" });

global.LabelerMachineFamilyGrammarDriver = {
  resolveFamily: () => "AUTOCOL"
};

global.state = {
  applicationMode: "cold-glue",
  maxMoveRatio: 21,
  coldGlueAggregateSettings: {
    machineSettings: { direction: "ccw" }
  },
  motionPlan: null
};

const map = {
  machineType: "Autocol",
  applicationMode: "cold-glue",
  machineSettings: { direction: "ccw", maxMoveRatio: 21 },
  objects: [{
    id: "coder-1",
    name: "Coder",
    kind: "coding",
    side: "outer",
    start: 300,
    end: 305,
    orientationLabelSection: "body",
    orientationTarget: "code-box"
  }]
};
global.activeMachineMap = () => map;

require(path.join(root, "drivers/profile/coder-orientation-driver.js"));
require(path.join(root, "drivers/servo/servo-command-driver.js"));

function baseRows() {
  return [
    { hmi: 1, plc: 0, cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
    { hmi: 2, plc: 1, cmd: 7, tableAngle: 220, plateAngle: 0, action: "Final Brush Turn" },
    { hmi: 3, plc: 2, cmd: 3, tableAngle: 250, plateAngle: 20, action: "Final Brush Rest" },
    { hmi: 4, plc: 3, cmd: 3, tableAngle: 305, plateAngle: 20, action: "End Curve - Rest", terminalRest: true, motionSource: "terminal-end-curve-rest" }
  ];
}

global.generatedColdGlueFixedProfile = function generatedColdGlueFixedProfileFixture() {
  const rows = baseRows();
  global.state.motionPlan = {
    rows: rows.map((row) => ({ ...row })),
    issues: [],
    finalPlateAngle: rows.at(-1).plateAngle,
    termination: { tableAngle: rows.at(-1).tableAngle, command: "Rest" }
  };
  return rows;
};

const v122 = require(path.join(root, "app/autocol-coder-codebox-generation-v122.js"));
assert.strictEqual(v122.buildId, "autocol-codebox-orientation-v122-20260815-0001");
assert.strictEqual(v122.operatorFacingLeftEdge, true);
assert.strictEqual(v122.printedArtworkDirectionInvariant, true);

const first = global.generatedColdGlueFixedProfile();
const turn = first.find((row) => row.autocolCoderV122 && row.codingMotion);
const hold = first.find((row) => row.autocolCoderV122 && row.codingHold);
const terminal = first.find((row) => row.terminalRest === true);

assert(turn, "Autocol coder should insert a CMD 7 orientation turn");
assert(hold, "Autocol coder should insert a CMD 3 coding hold");
assert.strictEqual(turn.cmd, 7);
assert.strictEqual(hold.cmd, 3);
assert.strictEqual(hold.tableAngle, 300);
assert.strictEqual(hold.autocolBoundary, "motion-end-rest");
assert.strictEqual(hold.operatorFacingLeftEdge, true);
assert.strictEqual(hold.printedArtworkDirectionInvariant, true);
assert.strictEqual(hold.codingTargetMode, "code-box");
assert.strictEqual(hold.codeBoxCenterMm, 10);
assert.strictEqual(terminal.plateAngle, hold.plateAngle, "terminal hold must retain the coder target plate angle");
assert.strictEqual(terminal.autocolBoundary, "end-curve");
assert(first.indexOf(turn) < first.indexOf(hold));
assert(first.indexOf(hold) < first.indexOf(terminal));

const localCodeBoxCcw = hold.printedCodeBoxLocalAngle;
const plateTargetCcw = hold.plateAngle;
const expectedWidth = 100 / (Math.PI * 100) * 360;
const expectedCode = 10 / (Math.PI * 100) * 360;
const expectedLocal = expectedWidth / 2 - expectedCode;
assert(Math.abs(localCodeBoxCcw - expectedLocal) < 1e-9, "code-box target must measure inward from printed left edge");
assert(Math.abs(plateTargetCcw + expectedLocal) <= 0.11, "CCW stored direction should use the matching servo-coordinate transform");

map.machineSettings.direction = "cw";
global.state.coldGlueAggregateSettings.machineSettings.direction = "cw";
const second = global.generatedColdGlueFixedProfile();
const holdCw = second.find((row) => row.autocolCoderV122 && row.codingHold);
assert(holdCw, "CW Autocol run should retain coder hold");
assert(Math.abs(holdCw.printedCodeBoxLocalAngle - localCodeBoxCcw) < 1e-9, "printed artwork position must not mirror with machine direction");
assert(Math.abs(holdCw.plateAngle - expectedLocal) <= 0.11, "CW stored direction should mirror only the servo command");

require(path.join(root, "app/machine-profile-framing.js"));
const framed = global.LabelerMachineProfileFraming.apply(second);
const framedHold = framed.find((row) => row.autocolCoderV122 && row.codingHold);
const framedTerminal = framed.at(-1);
assert(framedHold, "Autocol framing must retain the coder hold");
assert.strictEqual(framedTerminal.cmd, 3);
assert.strictEqual(framedTerminal.tableAngle, 359);
assert.strictEqual(framedTerminal.autocolBoundary, "end-curve");
assert.strictEqual(framedTerminal.plateAngle, framedHold.plateAngle, "359 degree end-of-curve must hold the achieved coder target");

const grammarIssues = global.LabelerServoCommandDriver.validateGrammar(framed);
assert.deepStrictEqual(grammarIssues, [], `framed Autocol coder sequence should satisfy 3/7 grammar: ${JSON.stringify(grammarIssues)}`);

console.log("Autocol coder Code Box Ctr v122 regression passed.");
