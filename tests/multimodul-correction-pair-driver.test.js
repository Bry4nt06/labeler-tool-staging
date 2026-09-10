"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const driver = require("../drivers/servo/multimodul-correction-pair-driver.js");

global.window = global;
require("../drivers/validation/machine-family-grammar-driver.js");
const grammar = global.LabelerMachineFamilyGrammarDriver;

function correctionProgram() {
  return [
    { hmi: 1, plc: 0, cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
    { hmi: 2, plc: 1, cmd: 7, tableAngle: 10, plateAngle: 0, action: "Wipe Turn 1 Body - Agg 1", stage: "set-down", plannedRotation: 30, plannedRatio: 3 },
    { hmi: 3, plc: 2, cmd: 7, tableAngle: 20, plateAngle: 30, action: "Wipe Turn 2 Body - Agg 1", stage: "wipe", plannedRotation: 30, plannedRatio: 3 },
    { hmi: 4, plc: 3, cmd: 3, tableAngle: 30, plateAngle: 60, action: "End Curve Rest", terminalRest: true }
  ];
}

test("MultiModul adjacent CMD 7 moves are converted to Autocol-style 3-7-3 correction pairs", () => {
  const result = driver.normalize(correctionProgram());

  assert.deepEqual(result.rows.map((row) => row.cmd), [3, 7, 3, 7, 3]);
  assert.equal(result.repairs.length, 1);
  assert.equal(result.repairs[0].strategy, "insert-cmd3-between-cmd7");

  const inserted = result.rows[2];
  assert.equal(inserted.machineGrammarInsertedReference, true);
  assert.equal(inserted.tableAngle, 20);
  assert.equal(inserted.plateAngle, 30);
  assert.match(inserted.action, /Wipe Turn 1 Body - Agg 1 - Reference/);

  const secondTurn = result.rows[3];
  assert.equal(secondTurn.tableAngle, 20.5);
  assert.equal(secondTurn.plateAngle, 30);
  assert.equal(secondTurn.machineGrammarReferenceStart, true);
  assert.equal(secondTurn.plannedRatio, 30 / 9.5);

  result.rows.forEach((row, index, rows) => {
    if (Number(row.cmd) !== 7) return;
    assert.equal(rows[index - 1]?.cmd, 3, `HMI ${index + 1} CMD 7 must have a leading CMD 3 reference`);
    assert.equal(rows[index + 1]?.cmd, 3, `HMI ${index + 1} CMD 7 must have a trailing CMD 3 reference`);
  });

  const validation = grammar.analyze(result.rows, { family: "MultiModul" });
  assert.equal(validation.valid, true, JSON.stringify(validation.issues, null, 2));
});

test("already isolated correction pairs remain unchanged", () => {
  const source = [
    { cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
    { cmd: 7, tableAngle: 10, plateAngle: 0, action: "Turn 1" },
    { cmd: 3, tableAngle: 20, plateAngle: 30, action: "Reference 1" },
    { cmd: 7, tableAngle: 20.5, plateAngle: 30, action: "Turn 2" },
    { cmd: 3, tableAngle: 30, plateAngle: 60, action: "End Curve Rest", terminalRest: true }
  ];

  const result = driver.normalize(source);
  assert.equal(result.repairs.length, 0);
  assert.deepEqual(result.rows.map((row) => row.cmd), [3, 7, 3, 7, 3]);
  assert.deepEqual(result.rows.map((row) => row.tableAngle), [0, 10, 20, 20.5, 30]);
});

test("reference spacing contracts when the remaining motion window is short", () => {
  const source = correctionProgram();
  source[3] = { ...source[3], tableAngle: 20.4 };

  const result = driver.normalize(source);
  assert.equal(result.rows[2].tableAngle, 20);
  assert.equal(result.rows[3].tableAngle, 20.2);
  assert.ok(result.rows[3].tableAngle < result.rows[4].tableAngle);
});
