"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-interlocks-v12.js"));
const compare = require(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-interlocks-v12-1.js"));

function fixture(options = {}) {
  const readyInstruction = options.readyInstruction || "XIC";
  const modeValue = options.modeValue ?? 1;
  const includeSelfHold = Boolean(options.includeSelfHold);
  const includeAlternatePath = Boolean(options.includeAlternatePath);
  const scheduleProgram = options.scheduleProgram !== false;
  const selfHold = includeSelfHold ? "XIC(MotorRun)" : "";
  const alternate = includeAlternatePath
    ? `      RUNG 1\n        N: XIC(ManualRequest)XIO(Faulted)OTE(MotorRun);\n      END_RUNG\n`
    : "";
  return `RSLogix 5000 Export Version 20.01
CONTROLLER Interlock_Compare
  PROGRAM P (MAIN := Main)
    TAG
      Start : BOOL;
      Ready : BOOL;
      Faulted : BOOL;
      ManualRequest : BOOL;
      MotorRun : BOOL;
      Mode : DINT;
    END_TAG
    ROUTINE Main
      RUNG 0
        N: XIC(Start)${readyInstruction}(Ready)XIO(Faulted)EQU(Mode,${modeValue})${selfHold}OTE(MotorRun);
      END_RUNG
${alternate}    END_ROUTINE
  END_PROGRAM
  TASK MainTask (Type := CONTINUOUS, Priority := 10)
${scheduleProgram ? "    P;\n" : ""}  END_TASK
END_CONTROLLER`;
}

function interlockDiffs(result) {
  return (result.differences || []).filter((item) => item.category === "interlocks");
}

test("v12.1 reports no interlock/permissive differences for identical exports", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture());
  const result = compare.compareProjects(baseline, current);
  assert.equal(result.version, "l5k-compare-v12.1");
  assert.equal(result.statistics.interlockDifferences, 0);
  assert.equal(interlockDiffs(result).length, 0);
});

test("v12.1 detects XIC to XIO polarity changes as static gate evidence", () => {
  const baseline = analyzer.parseL5K(fixture({ readyInstruction: "XIC" }));
  const current = analyzer.parseL5K(fixture({ readyInstruction: "XIO" }));
  const result = compare.compareProjects(baseline, current);
  const changed = interlockDiffs(result).find((item) => item.changeType === "changed" && /MotorRun/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.interlockKind, "gate-evidence");
  assert.equal(changed.evidence.gatesChanged, true);
  assert.ok(changed.evidence.baselineGateEvidence.some((item) => item === "XIC:Ready"));
  assert.ok(changed.evidence.currentGateEvidence.some((item) => item === "XIO:Ready"));
  assert.match(changed.summary, /does not prove Boolean branch semantics/i);
});

test("v12.1 detects comparison-threshold changes without recommending a field value", () => {
  const baseline = analyzer.parseL5K(fixture({ modeValue: 1 }));
  const current = analyzer.parseL5K(fixture({ modeValue: 2 }));
  const result = compare.compareProjects(baseline, current);
  const changed = interlockDiffs(result).find((item) => /MotorRun/.test(item.title));
  assert.ok(changed);
  assert.ok(changed.evidence.baselineGateEvidence.some((item) => item === "EQU:Mode,1"));
  assert.ok(changed.evidence.currentGateEvidence.some((item) => item === "EQU:Mode,2"));
  assert.doesNotMatch(changed.summary, /set .* to 2|change .* to 2|recommended/i);
});

test("v12.1 detects an added alternate permissive writer path", () => {
  const baseline = analyzer.parseL5K(fixture({ includeAlternatePath: false }));
  const current = analyzer.parseL5K(fixture({ includeAlternatePath: true }));
  const result = compare.compareProjects(baseline, current);
  const changed = interlockDiffs(result).find((item) => /MotorRun/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.changeType, "changed");
  assert.ok(changed.current.length > changed.baseline.length);
  assert.match(changed.summary, /offline same-rung source evidence/i);
});

test("v12.1 detects self-hold candidate evidence changes", () => {
  const baseline = analyzer.parseL5K(fixture({ includeSelfHold: false }));
  const current = analyzer.parseL5K(fixture({ includeSelfHold: true }));
  const result = compare.compareProjects(baseline, current);
  const changed = interlockDiffs(result).find((item) => /MotorRun/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.interlockKind, "self-hold");
  assert.equal(changed.evidence.selfHoldChanged, true);
  assert.equal(changed.evidence.baselineSelfHold.length, 0);
  assert.ok(changed.evidence.currentSelfHold.length >= 1);
});

test("v12.1 carries task-root reachability changes as source context only", () => {
  const baseline = analyzer.parseL5K(fixture({ scheduleProgram: true }));
  const current = analyzer.parseL5K(fixture({ scheduleProgram: false }));
  const result = compare.compareProjects(baseline, current);
  const changed = interlockDiffs(result).find((item) => /MotorRun/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.interlockKind, "task-reachability");
  assert.equal(changed.evidence.taskReachabilityChanged, true);
  assert.match(result.interlockComparison.sourceBoundary, /does not prove branch semantics, live contact values, current permissive state/i);
});

test("v12.1 interlock category works with the existing filter API", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ readyInstruction: "XIO", includeAlternatePath: true }));
  const result = compare.compareProjects(baseline, current);
  const filtered = compare.filterDifferences(result, { category: "interlocks" });
  assert.ok(filtered.length >= 1);
  assert.ok(filtered.every((item) => item.category === "interlocks"));
});

test("v12.1 Compare loads v12 analyzer and interlock comparison locally/read-only", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/compare.html"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-compare-v5-2.js"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-interlocks-v12-1.js"), "utf8");
  const analyzerV12 = page.indexOf("l5k-analyzer-interlocks-v12.js?v=12");
  const sequenceCompare = page.indexOf("l5k-analyzer-compare-sequence-v11-1.js?v=11.1");
  const interlockCompare = page.indexOf("l5k-analyzer-compare-interlocks-v12-1.js?v=12.1");
  const uiScript = page.indexOf("plc-analyzer-compare-v5-2.js?v=12.1");
  assert.ok(analyzerV12 >= 0 && analyzerV12 < sequenceCompare && sequenceCompare < interlockCompare && interlockCompare < uiScript);
  assert.match(page, /v12\.1 INTERLOCK \/ PERMISSIVE DIFF/);
  assert.match(page, /value="interlocks"/);
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-compare-worker\.js\?v=12\.1"\)/);
  assert.match(ui, /item\.interlockKind/);
  assert.match(worker, /l5k-analyzer-interlocks-v12\.js\?v=12/);
  assert.match(worker, /l5k-analyzer-compare-interlocks-v12-1\.js\?v=12\.1/);
  assert.match(page, /Never use an offline comparison as justification to force or bypass machine or safety interlocks/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
});
