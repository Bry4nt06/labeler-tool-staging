"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/machine-profile-framing.js"), "utf8");

const context = {
  console,
  activeMachineMap: () => ({ machineType: "Autocol" }),
  window: null
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "machine-profile-framing.js" });

const rows = [
  { cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero" },
  { cmd: 7, tableAngle: 156, plateAngle: 0, action: "Body Rotate After Application to Parallel Brush Entry", postApplicationBrushEntry: true },
  { cmd: 3, tableAngle: 178.2, plateAngle: 90, action: "Body Rotate After Application to Parallel Brush Entry - Reference", postApplicationBrushEntry: true, brushEntryAlignment: true, parallelBrushHold: true, brushHoldUntil: 205.15 },
  { cmd: 3, tableAngle: 205.15, plateAngle: 90, action: "Body Parallel Brush Hold - Equal-Length Channel Exit Hold", parallelBrushHold: true, equalLengthChannel: true, brushHoldUntil: 205.15 },
  { cmd: 7, tableAngle: 205.5, plateAngle: 90, action: "Next Move" },
  { cmd: 3, tableAngle: 359, plateAngle: 180, action: "End of curve", terminalRest: true }
];

const framed = context.LabelerMachineProfileFraming.apply(rows);
const entry = framed.find((row) => row.postApplicationBrushEntry === true && Number(row.cmd) === 3);
assert.ok(entry, "Autocol framing must preserve the Body brush-entry Rest");
assert.equal(entry.tableAngle, 178.2, "the correction must finish at physical brush entry, not at channel exit");
assert.equal(entry.plateAngle, 90);
assert.equal(Number(entry.brushHoldUntil.toFixed(2)), 205.15);

console.log("Autocol Cold Glue brush-entry framing regression passed.");
