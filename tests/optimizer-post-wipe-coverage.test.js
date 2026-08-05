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
assert.match(contactSource, /wipe\\s\+hold/);
assert.match(contactSource, /\.filter\(physicalContactFrame\)/);
assert.match(contactSource, /mapAwareCoverageV2/);
assert.match(fallbackSource, /version:\s*2/);
assert.doesNotMatch(fallbackSource, /Number\(row\.cmd\) !== 7/);
assert.doesNotMatch(fallbackSource, /stage\s*=\s*key/);
assert.match(startup, /optimizer-wipe-hold-classification-v21/);

const landshark = labelSpecs.find((spec) => /LandShark/i.test(spec.brand));
const micFamily = labelSpecs.find((spec) => /Mic Family/i.test(spec.brand));
assert.ok(landshark, "Landshark recipe must remain in the repository catalog.");
assert.ok(micFamily, "MIC family recipe must remain in the repository catalog.");
assert.equal(landshark.enabledLabelSections.neck, false);
assert.equal(micFamily.enabledLabelSections.neck, true);
assert.equal(landshark.enabledLabelSections.back, true);
assert.equal(micFamily.enabledLabelSections.back, true);

const context = {
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
context.window = context;
vm.runInNewContext(contactSource, context);

assert.equal(context.LabelerProgramOptimizerDriver.mapAwareCoverageV2, true);
assert.equal(context.LabelerProgramOptimizerDriver.physicalContactFrame({
  command: 7,
  action: "Wipe Hold Back - Agg 6"
}), false, "Wipe Hold must never be classified as an active physical wipe.");
assert.equal(context.LabelerProgramOptimizerDriver.physicalContactFrame({
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
const landsharkResult = context.LabelerProgramOptimizerDriver.analyze(landsharkRows, { map });
assert.equal(
  landsharkResult.diagnostics.some((item) => item.code === "optimizer-wipe-contact"),
  false,
  "Landshark replay metadata must not turn Wipe Hold into a pad-coverage failure."
);
assert.equal(landsharkResult.status, "HEALTHY");

const genuineFailureRows = [
  {
    ...landsharkRows[0],
    cmd: 7,
    replayCommand: 7,
    action: "Wipe Turn 2 Back - Agg 6"
  },
  landsharkRows[1]
];
const genuineFailure = context.LabelerProgramOptimizerDriver.analyze(genuineFailureRows, { map });
assert.equal(
  genuineFailure.diagnostics.some((item) => item.code === "optimizer-wipe-contact"),
  true,
  "A real wipe turn outside the mapped pad must continue to fail coverage validation."
);
assert.equal(genuineFailure.status, "ACTION");

console.log("Landshark and MIC wipe-hold coverage regression passed.");
