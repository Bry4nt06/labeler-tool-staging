"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

global.window = global;
require("../drivers/servo/multimodul-correction-pair-driver.js");
require("../drivers/validation/machine-family-grammar-driver.js");

const sourceRows = () => [
  { hmi: 1, plc: 0, cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
  { hmi: 2, plc: 1, cmd: 7, tableAngle: 10, plateAngle: 0, action: "Wipe Turn 1 Body - Agg 1", stage: "set-down", plannedRotation: 30 },
  { hmi: 3, plc: 2, cmd: 7, tableAngle: 20, plateAngle: 30, action: "Wipe Turn 2 Body - Agg 1", stage: "wipe", plannedRotation: 30 },
  { hmi: 4, plc: 3, cmd: 3, tableAngle: 30, plateAngle: 60, action: "End Curve Rest", terminalRest: true }
];

test("selected MultiModul maps pass through the correction-pair wrapper before grammar validation", async () => {
  const machineMap = {
    name: "MultiModul APL 6-Aggregate",
    machineType: "MultiModul",
    applicationMode: "apl"
  };

  global.state = {
    applicationMode: "apl",
    motionPlan: { mapDriven: true, rows: sourceRows(), termination: { section: "body" } }
  };
  global.selectedLabelApplicationState = () => ({ neck: true, body: true, back: true });
  global.activeMachineMap = () => machineMap;
  global.LabelerAplMapProfileGenerator = Object.freeze({ generate: () => sourceRows() });

  delete global.ServoForgeMultiModulCorrectionPairReady;
  delete require.cache[require.resolve("../app/multimodul-correction-pair-integration.js")];
  require("../app/multimodul-correction-pair-integration.js");
  await global.ServoForgeMultiModulCorrectionPairReady;

  delete require.cache[require.resolve("../app/profile-routing.js")];
  require("../app/profile-routing.js");
  const rows = global.LabelerProfileRouter.generate();

  assert.deepEqual(rows.map((row) => Number(row.cmd)), [3, 7, 3, 7, 3]);
  rows.forEach((row, index) => {
    if (Number(row.cmd) !== 7) return;
    assert.equal(Number(rows[index - 1]?.cmd), 3, `HMI ${index + 1} must have a leading CMD 3`);
    assert.equal(Number(rows[index + 1]?.cmd), 3, `HMI ${index + 1} must have a trailing CMD 3`);
  });

  const validation = global.LabelerMachineFamilyGrammarDriver.analyze(rows, {
    family: "MultiModul",
    machineType: "MultiModul",
    applicationMode: "apl"
  });
  assert.equal(validation.valid, true, JSON.stringify(validation.issues, null, 2));
  assert.equal(global.state.multiModulCorrectionPairRepairs.length, 1);
  assert.deepEqual(global.state.motionPlan.rows.map((row) => Number(row.cmd)), [3, 7, 3, 7, 3]);
});
