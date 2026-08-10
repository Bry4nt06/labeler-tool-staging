"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const driverSource = fs.readFileSync(path.join(root, "drivers/profile/coder-orientation-driver.js"), "utf8");
const coderSource = fs.readFileSync(path.join(root, "app/apl-coder-codebox-orientation-integration.js"), "utf8");
const terminalSource = fs.readFileSync(path.join(root, "app/apl-final-aggregate-terminal-integration.js"), "utf8");

const map = {
  machineType: "TopModul",
  applicationMode: "apl",
  aggregateCount: 6,
  aggregateAngles: { 1: 68.5, 2: 108.5, 3: 148.5, 4: 188.5, 5: 229.5, 6: 269.5 },
  machineSettings: { direction: "ccw", maxMoveRatio: 21 },
  objects: [{ id: "default-back-coding", kind: "coding", application: "apl", start: 304, end: 315, enabled: true }]
};

const neckBodyRows = [
  { cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
  { cmd: 3, tableAngle: 61, plateAngle: 0, action: "Hold for Neck Application - Agg 1", station: 1, section: "neck" },
  { cmd: 3, tableAngle: 129, plateAngle: 15, action: "Wipe Hold Neck - Agg 2", station: 2, section: "neck", stage: "complete" },
  { cmd: 3, tableAngle: 141, plateAngle: 90, action: "Hold for Body Application - Agg 3", station: 3, section: "body" },
  { cmd: 3, tableAngle: 209, plateAngle: 63.5, action: "Wipe Hold Body - Agg 4", station: 4, section: "body", stage: "complete" },
  { cmd: 3, tableAngle: 359, plateAngle: 63.5, action: "End Curve - Rest", terminalRest: true }
];

const context = {
  console,
  Promise: { resolve() { return { catch() { return this; }, finally(callback) { callback(); return this; } }; } },
  state: {
    applicationMode: "apl",
    selectedBrand: "12oz Bud Zero",
    selectedBottle: "LNNR - 12 Oz",
    maxMoveRatio: 21,
    motionPlan: {},
    labelSpecs: [{ brand: "12oz Bud Zero", application: "apl", neckLengthMm: 65, neckBottomCircumferenceMm: 105, bodyLengthMm: 107.9, backLengthMm: 0, codeBoxCenterMm: 25 }],
    bottleSpecs: [{ bottleType: "LNNR - 12 Oz", bodyBackCircumferenceMm: 190.695 }]
  },
  activeMachineMap() { return map; },
  selectedLabelApplicationState() { return { neck: true, body: true, back: false }; },
  selectedLabelSpec() { return context.state.labelSpecs[0]; },
  selectedBottleSpec() { return context.state.bottleSpecs[0]; },
  bodyCircumference() { return 190.695; },
  degFromMm(mm, circumference) { return Number(mm) / Number(circumference) * 360; },
  finishAngle(value) { return Math.round(Number(value) * 10) / 10; },
  generatedServoProfile() { return neckBodyRows.map((row) => ({ ...row })); },
  LabelerProfileRouter: {},
  ServoForgeProfileGenerationReady: Promise.resolve(),
  setTimeout(callback) { callback(); }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(driverSource, context);
vm.runInContext(coderSource, context);

const coder = context.LabelerAplCoderCodeBoxOrientation;
assert.ok(coder?.installed);
assert.equal(coder.activeCodingSection(), "body");
assert.equal(coder.finalAggregateNumber(map, neckBodyRows), 4);
assert.equal(coder.finalAggregateHoldIndex(neckBodyRows, map), 4);

const planned = coder.appendCoderOrientation(map, neckBodyRows);
assert.equal(planned.some((row) => Number(row.tableAngle) === 359), false);
assert.equal(planned.at(-2).cmd, 7);
assert.equal(planned.at(-2).tableAngle, 209.5);
assert.match(planned.at(-2).action, /Orient Body Code Box for Coding/);
assert.equal(planned.at(-1).cmd, 3);
assert.equal(planned.at(-1).tableAngle, 299);
assert.match(planned.at(-1).action, /Hold Body Code Box for Coding/);

const terminalContext = {
  console,
  state: { applicationMode: "apl", program: [], motionPlan: {} },
  activeMachineMap() { return map; },
  applyGeneratedServoProfile() {
    terminalContext.state.program = [
      ...planned.map((row) => ({ ...row, terminalRest: false })),
      { cmd: 3, tableAngle: 359, plateAngle: planned.at(-1).plateAngle, action: "End Curve - Rest", terminalRest: true }
    ];
    return terminalContext.state.program;
  },
  render() {},
  renderValidation() {},
  setTimeout(callback) { callback(); }
};
terminalContext.window = terminalContext;
terminalContext.globalThis = terminalContext;
vm.createContext(terminalContext);
vm.runInContext(terminalSource, terminalContext);

const terminal = terminalContext.LabelerAplFinalAggregateTerminal;
assert.ok(terminal?.installed);
assert.equal(terminal.finalAggregateNumber(map, terminalContext.state.program), 4);
const canonical = terminal.canonicalRows(terminalContext.state.program, map);
assert.equal(canonical.at(-1).tableAngle, 299);
assert.equal(canonical.at(-1).codingTerminal, true);
assert.equal(canonical.some((row) => Number(row.tableAngle) === 359), false);

console.log("Neck + Body coder regression passed: Aggregate 4 is the active terminal and coding holds at 299 degrees.");
