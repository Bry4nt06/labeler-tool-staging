"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const contactSource = fs.readFileSync(path.join(root, "app", "optimizer-map-contact-integration.js"), "utf8");
const fallbackSource = fs.readFileSync(path.join(root, "app", "optimizer-post-wipe-coverage-fix-integration.js"), "utf8");
const startup = fs.readFileSync(path.join(root, "app.js"), "utf8");
const labelSpecs = JSON.parse(fs.readFileSync(path.join(root, "config", "default-programs", "label-specs.json"), "utf8"));

assert.doesNotThrow(() => new vm.Script(contactSource));
assert.doesNotThrow(() => new vm.Script(fallbackSource));
assert.match(contactSource, /function physicalContactFrame/);
assert.match(contactSource, /wipe\\s\+turn/);
assert.match(contactSource, /\^\\s\*orient/);
assert.match(contactSource, /\.filter\(physicalContactFrame\)/);
assert.match(contactSource, /mapAwareCoverageV3/);
assert.match(fallbackSource, /version:\s*4/);
assert.match(fallbackSource, /function isWipeHoldCoverageDiagnostic/);
assert.match(fallbackSource, /function isNonContactOrientationCoverageDiagnostic/);
assert.doesNotMatch(fallbackSource, /analyzeWithMapAwareCoverage/);
assert.match(startup, /mic-sensor-continuity-v52/);

const landshark = labelSpecs.find((spec) => /LandShark/i.test(spec.brand));
const micFamily = labelSpecs.find((spec) => /Mic Family/i.test(spec.brand));
assert.ok(landshark, "Landshark recipe must remain in the repository catalog.");
assert.ok(micFamily, "MIC family recipe must remain in the repository catalog.");
assert.equal(landshark.enabledLabelSections.neck, false);
assert.equal(micFamily.enabledLabelSections.neck, true);
assert.equal(landshark.enabledLabelSections.back, true);
assert.equal(micFamily.enabledLabelSections.back, true);

const contactContext = {
  console,
  document: { readyState: "complete", addEventListener() {} },
  setTimeout() {},
  LabelerProgramOptimizerDriver: {
    analyze(rows) {
      return {
        sourceRows: rows,
        diagnostics: [{
          level: "bad",
          code: "optimizer-wipe-contact",
          category: "coverage",
          hmi: 23,
          message: "legacy coverage diagnostic"
        }],
        status: "ACTION"
      };
    },
    buildFrames(rows) {
      return rows.map((row, index) => ({
        hmi: row.hmi || index + 1,
        command: row.replayCommand ?? row.cmd,
        action: row.action,
        aggregate: row.station,
        section: row.section,
        tableStart: row.tableAngle,
        tableEnd: rows[index + 1]?.tableAngle ?? row.tableAngle,
        row
      }));
    },
    calculateMetrics(rows, options, diagnostics) {
      return { rowCount: rows.length, diagnosticCount: diagnostics.length };
    }
  }
};
contactContext.window = contactContext;
vm.runInNewContext(contactSource, contactContext);

assert.equal(contactContext.LabelerProgramOptimizerDriver.mapAwareCoverageV3, true);
assert.equal(contactContext.LabelerProgramOptimizerDriver.physicalContactFrame({
  command: 7,
  action: "Wipe Hold Back - Agg 6"
}), false, "Wipe Hold must never be classified as an active physical wipe.");
assert.equal(contactContext.LabelerProgramOptimizerDriver.physicalContactFrame({
  command: 7,
  action: "Orient Body for Re-Wipe - Agg 4"
}), false, "Re-wipe positioning is free-space orientation, not pad-contact motion.");
assert.equal(contactContext.LabelerProgramOptimizerDriver.physicalContactFrame({
  command: 7,
  action: "Orient Back for Re-Wipe - Agg 6"
}), false, "A later re-wipe orientation must not inherit wipe-contact validation from its name.");
assert.equal(contactContext.LabelerProgramOptimizerDriver.physicalContactFrame({
  command: 7,
  action: "Wipe Turn 2 Back - Agg 6"
}), true, "Actual wipe turns must remain subject to pad coverage validation.");

const map = {
  applicationMode: "apl",
  stationSections: { "6": "back" },
  objects: [{
    id: "default-pad-a6",
    name: "Agg 6 Back Wipe-Down Pad",
    kind: "pad",
    station: 6,
    labelSection: "back",
    start: 270,
    end: 290
  }]
};

const landsharkRows = [
  {
    hmi: 23,
    cmd: 3,
    replayCommand: 7,
    tableAngle: 290,
    plateAngle: 234.5,
    action: "Wipe Hold Back - Agg 6",
    station: 6,
    section: "back"
  },
  {
    hmi: 24,
    cmd: 3,
    tableAngle: 299,
    plateAngle: 197.5,
    action: "Hold Back Label Through Back Label Inspection",
    station: 6,
    section: "back"
  }
];
const landsharkResult = contactContext.LabelerProgramOptimizerDriver.analyze(landsharkRows, { map });
assert.equal(
  landsharkResult.diagnostics.some((item) => item.code === "optimizer-wipe-contact"),
  false,
  "Replay metadata must not turn Wipe Hold into a pad-coverage failure."
);
assert.equal(landsharkResult.status, "HEALTHY");

const reWipeRows = [
  {
    hmi: 29,
    cmd: 7,
    tableAngle: 250.5,
    plateAngle: 93,
    action: "Orient Back for Re-Wipe - Agg 6",
    station: 6,
    section: "back"
  },
  {
    hmi: 30,
    cmd: 3,
    tableAngle: 268.5,
    plateAngle: -164,
    action: "Orient Back for Re-Wipe - Agg 6 - Reference",
    station: 6,
    section: "back"
  }
];
const reWipeResult = contactContext.LabelerProgramOptimizerDriver.analyze(reWipeRows, { map });
assert.equal(
  reWipeResult.diagnostics.some((item) => item.code === "optimizer-wipe-contact"),
  false,
  "An Orient-for-Re-Wipe command outside the pad must not produce a physical-contact coverage fault."
);

const genuineFailureRows = [
  {
    ...landsharkRows[0],
    cmd: 7,
    replayCommand: 7,
    action: "Wipe Turn 2 Back - Agg 6"
  },
  landsharkRows[1]
];
const genuineFailure = contactContext.LabelerProgramOptimizerDriver.analyze(genuineFailureRows, { map });
assert.equal(
  genuineFailure.diagnostics.some((item) => item.code === "optimizer-wipe-contact"),
  true,
  "A real wipe turn outside the mapped pad must continue to fail coverage validation."
);
assert.equal(genuineFailure.status, "ACTION");

const fallbackRows = [
  { hmi: 17, cmd: 7, tableAngle: 169.5, plateAngle: 120, action: "Orient Body for Re-Wipe - Agg 4", station: 4, section: "body" },
  { hmi: 23, cmd: 3, tableAngle: 209, plateAngle: 63.5, action: "Wipe Hold Body - Agg 4", station: 4, section: "body" },
  { hmi: 29, cmd: 7, tableAngle: 250.5, plateAngle: 93, action: "Orient Back for Re-Wipe - Agg 6", station: 6, section: "back" },
  { hmi: 30, cmd: 7, tableAngle: 270, plateAngle: -164, action: "Wipe Turn 1 Back - Agg 6", station: 6, section: "back" }
];
const fallbackContext = {
  console,
  document: { readyState: "complete", addEventListener() {} },
  state: { programOptimization: { lastSignature: "stale", result: {} } },
  setTimeout(callback) { callback(); },
  renderProgram() {},
  renderValidation() {},
  LabelerProgramOptimizerDriver: {
    analyze: function analyzeWithOtherOptimizerLayer(rows) {
      return {
        sourceRows: rows,
        diagnostics: [
          { level: "bad", code: "optimizer-wipe-contact", hmi: 17, message: "Orient Body for Re-Wipe - Agg 4 overlaps its mapped wipe-down surface for only 0% of the command window." },
          { level: "bad", code: "optimizer-wipe-contact", hmi: 23, message: "Wipe Hold Body - Agg 4 overlaps its mapped wipe-down surface for only 0% of the command window." },
          { level: "bad", code: "optimizer-wipe-contact", hmi: 29, message: "Orient Back for Re-Wipe - Agg 6 overlaps its mapped wipe-down surface for only 0% of the command window." },
          { level: "bad", code: "optimizer-wipe-contact", hmi: 30, message: "Wipe Turn 1 Back - Agg 6 overlaps its mapped wipe-down surface for only 0% of the command window." }
        ],
        status: "ACTION"
      };
    },
    calculateMetrics(rows, options, diagnostics) {
      return { rowCount: rows.length, diagnosticCount: diagnostics.length };
    }
  }
};
fallbackContext.window = fallbackContext;
vm.runInNewContext(fallbackSource, fallbackContext);
assert.equal(fallbackContext.LabelerPostWipeCoveragePolicy.version, 4);
assert.equal(fallbackContext.LabelerProgramOptimizerDriver.postWipeCoveragePolicyV4, true);
const fallbackResult = fallbackContext.LabelerProgramOptimizerDriver.analyze(fallbackRows, { map });
assert.equal(fallbackResult.diagnostics.some((item) => item.hmi === 17), false);
assert.equal(fallbackResult.diagnostics.some((item) => item.hmi === 23), false);
assert.equal(fallbackResult.diagnostics.some((item) => item.hmi === 29), false);
assert.equal(
  fallbackResult.diagnostics.some((item) => item.hmi === 30),
  true,
  "The defensive filter must retain genuine Wipe Turn coverage faults."
);
assert.equal(fallbackResult.status, "ACTION");
assert.equal(fallbackResult.currentMetrics.diagnosticCount, 1);
assert.equal(fallbackContext.state.programOptimization.lastSignature, "");
assert.equal(fallbackContext.state.programOptimization.result, null);

console.log("Post-wipe coverage classification regression passed for holds, re-wipe positioning, and true contact turns.");
