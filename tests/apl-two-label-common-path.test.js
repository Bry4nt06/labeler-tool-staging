"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const retiredModules = [
  ["app/apl-body-back-two-label-transition-integration.js", "LabelerAplBodyBackTwoLabelTransition"],
  ["app/apl-back-wipe-direction-correction-integration.js", "LabelerAplBackWipeDirectionCorrection"],
  ["app/apl-body-back-opposite-reference-integration.js", "LabelerAplBodyBackOppositeReference"]
];

for (const [relative, marker] of retiredModules) {
  const source = read(relative);
  assert.doesNotThrow(() => new vm.Script(source, { filename: relative }));
  assert.match(source, /retired:\s*true/);
  assert.match(source, /common-apl-active-sections/);
  assert.doesNotMatch(source, /generatedAplMapDrivenProfile\s*=\s*wrapped/,
    `${relative} must not wrap the common APL generator.`);
  assert.doesNotMatch(source, /rebuildProfile\s*\(/,
    `${relative} must not rebuild a separate no-neck servo profile.`);

  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: relative });
  assert.equal(sandbox[marker]?.retired, true);
}

const genericSource = read("app/apl-map-profile-generation.js");
assert.match(genericSource, /selectedLabelApplicationState\(\)\[section\]/,
  "The common generator must skip inactive sections from recipe state.");
assert.match(genericSource, /Wipe Turn 1/);
assert.match(genericSource, /Wipe Turn 2/);
assert.match(genericSource, /Wipe Hold/);

const firstTackSource = read("app/apl-first-tack-datum-flow-integration.js");
assert.match(firstTackSource, /No pre-application turn is permitted/);
assert.match(firstTackSource, /Retrace the previous wipe path/);

const limitSource = read("app/topmodul-correction-chain-limit-integration.js");
assert.doesNotThrow(() => new vm.Script(limitSource, { filename: "topmodul-correction-chain-limit-integration.js" }));
assert.match(limitSource, /MAX_CONSECUTIVE_CORRECTIONS = 2/);

const emptySummary = { bad: 0, warn: 0, ok: 0, total: 0 };
const sandbox = {
  console,
  state: { applicationMode: "apl", program: [] },
  activeMachineMap() { return { machineType: "TopModul", applicationMode: "apl" }; },
  LabelerMachineFamilyGrammarDriver: {
    analyze(rows) {
      return {
        family: "TOPMODUL",
        rule: { id: "TOPMODUL", name: "TopModul correction chain" },
        valid: true,
        status: "PASS",
        summary: { ...emptySummary },
        issues: []
      };
    },
    validate() { return []; }
  },
  LabelerServoCommandDriver: {
    validateGrammar() { return []; },
    validateReferences() { return []; }
  },
  LabelerServoPipelineValidator: {
    analyze() {
      return {
        valid: true,
        status: "PASS",
        summary: { ...emptySummary },
        categories: {},
        issues: []
      };
    }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(limitSource, sandbox, { filename: "topmodul-correction-chain-limit-integration.js" });

const validRows = [
  { hmi: 1, cmd: 3 },
  { hmi: 2, cmd: 7 },
  { hmi: 3, cmd: 7 },
  { hmi: 4, cmd: 3 }
];
const invalidRows = [
  { hmi: 1, cmd: 3 },
  { hmi: 2, cmd: 7 },
  { hmi: 3, cmd: 7 },
  { hmi: 4, cmd: 7 },
  { hmi: 5, cmd: 3 }
];

assert.equal(sandbox.LabelerTopModulCorrectionChainLimit.maxConsecutiveCorrections, 2);
assert.equal(sandbox.LabelerTopModulCorrectionChainLimit.limitIssues(validRows).length, 0,
  "Two consecutive CMD 7 corrections are valid.");
const directIssues = sandbox.LabelerTopModulCorrectionChainLimit.limitIssues(invalidRows);
assert.equal(directIssues.length, 1);
assert.equal(directIssues[0].code, "topmodul-correction-chain-too-long");
assert.equal(directIssues[0].level, "bad");

const grammarResult = sandbox.LabelerMachineFamilyGrammarDriver.analyze(invalidRows, {
  machineType: "TopModul",
  applicationMode: "apl"
});
assert.equal(grammarResult.valid, false);
assert.ok(grammarResult.issues.some((issue) => issue.code === "topmodul-correction-chain-too-long"));

const pipelineResult = sandbox.LabelerServoPipelineValidator.analyze({
  rows: invalidRows,
  machineType: "TopModul",
  applicationMode: "apl"
});
assert.equal(pipelineResult.valid, false);
assert.ok(pipelineResult.issues.some((issue) => issue.code === "topmodul-correction-chain-too-long"));

console.log("Body+Back common APL path and maximum-two-CMD7 regression passed.");
