"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const finalizerSource = fs.readFileSync(path.join(root, "app", "apl-final-aggregate-terminal-integration.js"), "utf8");
const generatorSource = fs.readFileSync(path.join(root, "app", "apl-map-profile-generation.js"), "utf8");
const seedSource = fs.readFileSync(path.join(root, "app", "apl-seed-profile.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const featureSource = fs.readFileSync(path.join(root, "app", "simulation-collapsible-integration.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(finalizerSource, { filename: "apl-final-aggregate-terminal-integration.js" }));
assert.doesNotMatch(generatorSource, /Direct Turn for Coding|Hold for Coding|codingWindow|codingObject/);
assert.doesNotMatch(seedSource, /Turn for Coding|Hold for Coding|codingWindow|codingObject/);
assert.doesNotMatch(appSource, /coder-window-reference-handoff-integration\.js/);
assert.doesNotMatch(bootstrapSource, /coding-cycle-normalization-controller\.js|topmodul-coder-prehold-finalizer-integration\.js/);
assert.match(bootstrapSource, /apl-final-aggregate-terminal-integration\.js/);
assert.doesNotMatch(featureSource, /coder-orientation-driver|coder-handoff-driver|map-object-coder-after-wipe|clockwise-code-box-orientation|coder-rest-grammar-repair/);

let timeoutCallback = null;
const context = {
  console,
  state: { applicationMode: "apl", program: [] },
  activeMachineMap() {
    return { applicationMode: "apl", aggregateCount: 6, aggregateAngles: { 1: 10, 2: 50, 3: 100, 4: 150, 5: 200, 6: 250 } };
  },
  applyGeneratedServoProfile() {},
  LabelerProfilePipelineOrchestratorInstalled: true,
  LabelerOrientationConstraintPlannerInstalled: true,
  LabelerTopModulCorrectionChainLimit: { installed: true },
  setTimeout(callback) { timeoutCallback = callback; }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(finalizerSource, context);
if (!context.LabelerAplFinalAggregateTerminal?.installed && timeoutCallback) timeoutCallback();
const policy = context.LabelerAplFinalAggregateTerminal;
assert.equal(policy?.installed, true);

const sourceRows = [
  { hmi: 1, plc: 0, cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
  { hmi: 2, plc: 1, cmd: 7, tableAngle: 250.5, plateAngle: 287, station: 6, section: "back", action: "Wipe Turn 2 Back - Agg 6" },
  { hmi: 3, plc: 2, cmd: 3, tableAngle: 290, plateAngle: 287, station: 6, section: "back", stage: "complete", action: "Wipe Hold Back - Agg 6" },
  { hmi: 4, plc: 3, cmd: 7, tableAngle: 290.5, plateAngle: 287, action: "obsolete post-aggregate move" },
  { hmi: 5, plc: 4, cmd: 3, tableAngle: 304, plateAngle: 180, action: "obsolete post-aggregate hold" },
  { hmi: 6, plc: 5, cmd: 7, tableAngle: 320, plateAngle: 180, station: 6, section: "back", sensorId: "late-sensor", action: "Orient Back Label for Sensor - Station 6" }
];
const rows = policy.canonicalRows(sourceRows, context.activeMachineMap());
assert.equal(rows.length, 3);
assert.equal(rows.at(-1).action, "Wipe Hold Back - Agg 6");
assert.equal(rows.at(-1).cmd, 3);
assert.equal(rows.at(-1).tableAngle, 290);
assert.equal(rows.at(-1).terminalRest, true);
assert.equal(rows.at(-1).aggregateTerminal, true);
assert.equal(rows.at(-1).terminalAggregate, 6);
assert.equal(rows.some((row) => Number(row.tableAngle) > 290), false);

console.log("APL final Aggregate 6 terminal regression passed.");
