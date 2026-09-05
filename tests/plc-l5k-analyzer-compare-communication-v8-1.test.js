"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-communication-v8.js"));
const compare = require(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-communication-v8-1.js"));

function fixture(options = {}) {
  const consumedProducer = options.consumedProducer || "RemoteController";
  const remoteTag = options.remoteTag || "RemoteProducedData";
  const consumedRpi = options.consumedRpi || "20";
  const consumedRole = options.consumedRole || "consumed";
  const produceCount = options.produceCount || "2";
  const minRpi = options.minRpi || "2.0";
  const maxRpi = options.maxRpi || "100.0";
  const defaultRpi = options.defaultRpi || "10.0";
  const moduleName = options.moduleName === undefined ? "RemoteController" : options.moduleName;
  const extraCommunication = options.extraCommunication || "";
  const communicationTag = consumedRole === "produced"
    ? `    CommunicationData : DINT (ProduceCount := 1, MinimumRPI := 2.0, MaximumRPI := 50.0, DefaultRPI := 10.0);`
    : `    CommunicationData : DINT (Producer := ${consumedProducer}, RemoteTag := ${remoteTag}, RPI := ${consumedRpi});`;
  const module = moduleName
    ? `\n  MODULE ${moduleName}\n    Parent := Local;\n    Slot := 3;\n    CatalogNumber := "1756-ENBT/A";\n  END_MODULE\n`
    : "";
  return `RSLogix 5000 Export Version 20.01
CONTROLLER Compare_Communication
  TAG
${communicationTag}
    ProducedData : DINT (ProduceCount := ${produceCount}, MinimumRPI := ${minRpi}, MaximumRPI := ${maxRpi}, DefaultRPI := ${defaultRpi});
${extraCommunication}    InputA : BOOL;
    Faults : DINT[1];
  END_TAG
${module}
  PROGRAM P (MAIN := Main)
    ROUTINE Main
      RUNG 0
        N: XIC(InputA)OTL(Faults[0].1);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
  TASK MainTask (Type := CONTINUOUS, Priority := 10)
    P;
  END_TASK
END_CONTROLLER`;
}

function communicationDiffs(result) {
  return (result.differences || []).filter((item) => item.category === "communications");
}

test("v8.1 reports no communication differences for identical exports", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture());
  const result = compare.compareProjects(baseline, current);
  assert.equal(result.version, "l5k-compare-v8.1");
  assert.equal(result.statistics.communicationDifferences, 0);
  assert.equal(communicationDiffs(result).length, 0);
});

test("v8.1 detects consumed producer, remote-tag, and RPI changes as source configuration evidence", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ consumedProducer: "ReplacementController", remoteTag: "ReplacementData", consumedRpi: "40", moduleName: "ReplacementController" }));
  const result = compare.compareProjects(baseline, current);
  const changed = communicationDiffs(result).find((item) => item.communicationKind === "consumed-tag");
  assert.ok(changed);
  assert.equal(changed.baseline.producer, "RemoteController");
  assert.equal(changed.current.producer, "ReplacementController");
  assert.equal(changed.baseline.remoteTag, "RemoteProducedData");
  assert.equal(changed.current.remoteTag, "ReplacementData");
  assert.equal(changed.current.rpi, "40");
  assert.match(changed.summary, /not adjustment recommendations/i);
});

test("v8.1 detects produced ProduceCount and RPI-bound changes without recommending values", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ produceCount: "4", minRpi: "5.0", maxRpi: "200.0", defaultRpi: "20.0" }));
  const result = compare.compareProjects(baseline, current);
  const changed = communicationDiffs(result).find((item) => item.communicationKind === "produced-tag" && /ProducedData/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.baseline.produceCount, "2");
  assert.equal(changed.current.produceCount, "4");
  assert.equal(changed.current.minimumRPI, "5.0");
  assert.equal(changed.current.maximumRPI, "200.0");
  assert.match(changed.summary, /not adjustment recommendations/i);
});

test("v8.1 detects consumed to produced role changes", () => {
  const baseline = analyzer.parseL5K(fixture({ consumedRole: "consumed" }));
  const current = analyzer.parseL5K(fixture({ consumedRole: "produced" }));
  const result = compare.compareProjects(baseline, current);
  const changed = communicationDiffs(result).find((item) => item.communicationKind === "communication-role");
  assert.ok(changed);
  assert.equal(changed.baseline.role, "consumed");
  assert.equal(changed.current.role, "produced");
  assert.match(changed.summary, /does not prove current network state/i);
});

test("v8.1 highlights producer-module resolution changes without calling them network faults", () => {
  const baseline = analyzer.parseL5K(fixture({ moduleName: "RemoteController" }));
  const current = analyzer.parseL5K(fixture({ moduleName: null }));
  const result = compare.compareProjects(baseline, current);
  const changed = communicationDiffs(result).find((item) => item.communicationKind === "consumed-tag");
  assert.ok(changed);
  assert.equal(changed.baseline.producerModulePresent, true);
  assert.equal(changed.current.producerModulePresent, false);
  assert.match(result.communicationComparison.sourceBoundary, /does not prove peer availability/i);
  assert.match(result.communicationComparison.sourceBoundary, /connection health/i);
});

test("v8.1 detects communication tag additions/removals and supports category filtering", () => {
  const extra = `    ExtraConsumed : DINT (Producer := RemoteController, RemoteTag := ExtraData, RPI := 25);\n`;
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ extraCommunication: extra }));
  const result = compare.compareProjects(baseline, current);
  const added = communicationDiffs(result).find((item) => item.changeType === "added" && /ExtraConsumed/.test(item.title));
  assert.ok(added);
  const filtered = compare.filterDifferences(result, { category: "communications" });
  assert.ok(filtered.length >= 1);
  assert.ok(filtered.every((item) => item.category === "communications"));
});

test("v8.1 Compare layer remains local/read-only under the current v10.1 consistency-aware release", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/compare.html"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-compare-v5-2.js"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-communication-v8-1.js"), "utf8");
  const analyzerV8 = page.indexOf("l5k-analyzer-communication-v8.js?v=8");
  const analyzerV9 = page.indexOf("l5k-analyzer-message-v9.js?v=9");
  const consistencyParser = page.indexOf("l5k-analyzer-consistency-v10.js?v=10");
  const taskCompare = page.indexOf("l5k-analyzer-compare-task-schedule-v7-1.js?v=7.1");
  const communicationCompare = page.indexOf("l5k-analyzer-compare-communication-v8-1.js?v=8.1");
  const messageCompare = page.indexOf("l5k-analyzer-compare-message-v9-1.js?v=9.1");
  const consistencyCompare = page.indexOf("l5k-analyzer-compare-consistency-v10-1.js?v=10.1");
  const uiScript = page.indexOf("plc-analyzer-compare-v5-2.js?v=10.1");
  assert.ok(analyzerV8 >= 0 && analyzerV8 < analyzerV9 && analyzerV9 < consistencyParser && consistencyParser < taskCompare && taskCompare < communicationCompare && communicationCompare < messageCompare && messageCompare < consistencyCompare && consistencyCompare < uiScript);
  assert.match(page, /PLC ANALYZER COMPARE v9\.1 — MSG \/ MESSAGE DIFF/);
  assert.match(page, /value="communications"/);
  assert.match(page, /peer availability, route health, packet delivery/i);
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-compare-worker\.js\?v=10\.1"\)/);
  assert.match(worker, /l5k-analyzer-communication-v8\.js\?v=8/);
  assert.match(worker, /l5k-analyzer-compare-communication-v8-1\.js\?v=8\.1/);
  assert.match(worker, /l5k-analyzer-compare-message-v9-1\.js\?v=9\.1/);
  assert.match(worker, /l5k-analyzer-compare-consistency-v10-1\.js\?v=10\.1/);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
});
