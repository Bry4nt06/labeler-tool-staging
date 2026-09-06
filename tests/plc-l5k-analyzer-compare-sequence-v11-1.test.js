"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-sequence-v11.js"));
const compare = require(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-sequence-v11-1.js"));

function fixture(options = {}) {
  const firstTarget = options.firstTarget ?? 20;
  const secondTarget = options.secondTarget ?? 30;
  const timerPreset = options.timerPreset ?? 500;
  const timerSense = options.timerSense || "XIC";
  const includeBranch = Boolean(options.includeBranch);
  const scheduleProgram = options.scheduleProgram !== false;
  const branch = includeBranch
    ? `      RUNG 3\n        N: EQU(Step,30)XIC(BranchRequest)MOV(40,Step);\n      END_RUNG\n`
    : "";
  return `RSLogix 5000 Export Version 20.01
CONTROLLER Sequence_Compare
  PROGRAM P (MAIN := Main)
    TAG
      Step : DINT;
      DelayTimer : TIMER;
      Start : BOOL;
      BranchRequest : BOOL;
    END_TAG
    ROUTINE Main
      RUNG 0
        N: EQU(Step,10)XIC(Start)MOV(${firstTarget},Step);
      END_RUNG
      RUNG 1
        N: EQU(Step,${firstTarget})TON(DelayTimer,${timerPreset});
      END_RUNG
      RUNG 2
        N: EQU(Step,${firstTarget})${timerSense}(DelayTimer.DN)MOV(${secondTarget},Step);
      END_RUNG
${branch}    END_ROUTINE
  END_PROGRAM
  TASK MainTask (Type := CONTINUOUS, Priority := 10)
${scheduleProgram ? "    P;\n" : ""}  END_TASK
END_CONTROLLER`;
}

function sequenceDiffs(result) {
  return (result.differences || []).filter((item) => item.category === "sequences");
}

test("v11.1 reports no sequence differences for identical exports", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture());
  const result = compare.compareProjects(baseline, current);
  assert.equal(result.version, "l5k-compare-v11.1");
  assert.equal(result.statistics.sequenceDifferences, 0);
  assert.equal(sequenceDiffs(result).length, 0);
});

test("v11.1 detects a changed source-visible state set and transition edge", () => {
  const baseline = analyzer.parseL5K(fixture({ secondTarget: 30 }));
  const current = analyzer.parseL5K(fixture({ secondTarget: 35 }));
  const result = compare.compareProjects(baseline, current);
  const stateSet = sequenceDiffs(result).find((item) => item.sequenceKind === "state-set");
  assert.ok(stateSet);
  assert.ok(stateSet.evidence.removedStates.includes("30"));
  assert.ok(stateSet.evidence.addedStates.includes("35"));
  assert.ok(sequenceDiffs(result).some((item) => item.sequenceKind === "transition" && item.changeType === "removed" && /20->30/.test(item.title)));
  assert.ok(sequenceDiffs(result).some((item) => item.sequenceKind === "transition" && item.changeType === "added" && /20->35/.test(item.title)));
});

test("v11.1 detects a new branch without declaring the branch defective", () => {
  const baseline = analyzer.parseL5K(fixture({ includeBranch: false }));
  const current = analyzer.parseL5K(fixture({ includeBranch: true }));
  const result = compare.compareProjects(baseline, current);
  const added = sequenceDiffs(result).find((item) => item.sequenceKind === "transition" && item.changeType === "added" && /30->40/.test(item.title));
  assert.ok(added);
  assert.equal(added.classification, "static-inference");
  assert.match(added.summary, /does not prove the transition executes at runtime/i);
  assert.doesNotMatch(added.summary, /defect|wrong|failure/i);
});

test("v11.1 detects timer-gate context changes without recommending PRE values", () => {
  const baseline = analyzer.parseL5K(fixture({ timerPreset: 500, timerSense: "XIC" }));
  const current = analyzer.parseL5K(fixture({ timerPreset: 750, timerSense: "XIO" }));
  const result = compare.compareProjects(baseline, current);
  const changed = sequenceDiffs(result).find((item) => item.sequenceKind === "timer-gated-transition" && /20->30/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.evidence.timerContextChanged, true);
  assert.ok(changed.evidence.baselineTimerEvidence.some((item) => /500/.test(item)));
  assert.ok(changed.evidence.currentTimerEvidence.some((item) => /750/.test(item)));
  assert.match(changed.summary, /PRE values are comparison evidence only, not adjustment recommendations/i);
});

test("v11.1 carries task-root reachability changes as transition context only", () => {
  const baseline = analyzer.parseL5K(fixture({ scheduleProgram: true }));
  const current = analyzer.parseL5K(fixture({ scheduleProgram: false }));
  const result = compare.compareProjects(baseline, current);
  const changed = sequenceDiffs(result).find((item) => item.sequenceKind === "transition-context" || item.sequenceKind === "timer-gated-transition");
  assert.ok(changed);
  const before = changed.baseline.find((item) => item.from === "10" && item.to === "20") || changed.baseline[0];
  const after = changed.current.find((item) => item.from === "10" && item.to === "20") || changed.current[0];
  assert.equal(before.taskRootReachable, true);
  assert.equal(after.taskRootReachable, false);
  assert.match(result.sequenceComparison.sourceBoundary, /not prove current state, runtime execution/i);
});

test("v11.1 sequence category works with the existing filter API", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ secondTarget: 35, includeBranch: true }));
  const result = compare.compareProjects(baseline, current);
  const filtered = compare.filterDifferences(result, { category: "sequences" });
  assert.ok(filtered.length >= 3);
  assert.ok(filtered.every((item) => item.category === "sequences"));
});

test("v11.1 Compare loads v11 analyzer and sequence comparison locally/read-only", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/compare.html"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-compare-v5-2.js"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-sequence-v11-1.js"), "utf8");
  const analyzerV11 = page.indexOf("l5k-analyzer-sequence-v11.js?v=11");
  const consistencyCompare = page.indexOf("l5k-analyzer-compare-consistency-v10-1.js?v=10.1");
  const sequenceCompare = page.indexOf("l5k-analyzer-compare-sequence-v11-1.js?v=11.1");
  const uiScript = page.indexOf("plc-analyzer-compare-v5-2.js?v=11.1");
  assert.ok(analyzerV11 >= 0 && analyzerV11 < consistencyCompare && consistencyCompare < sequenceCompare && sequenceCompare < uiScript);
  assert.match(page, /v11\.1 SEQUENCE DIFF/);
  assert.match(page, /value="sequences"/);
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-compare-worker\.js\?v=11\.1"\)/);
  assert.match(ui, /item\.sequenceKind/);
  assert.match(worker, /l5k-analyzer-sequence-v11\.js\?v=11/);
  assert.match(worker, /l5k-analyzer-compare-sequence-v11-1\.js\?v=11\.1/);
  assert.match(page, /does not prove live state, current sequence state, transition order/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
});
