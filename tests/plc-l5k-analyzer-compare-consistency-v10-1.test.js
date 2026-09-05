"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-consistency-v10.js"));
const compare = require(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-consistency-v10-1.js"));

function program(name, options = {}) {
  const timer = options.timer ?? 100;
  const counter = options.counter ?? 5;
  const threshold = options.threshold ?? 20;
  return `  PROGRAM ${name} (MAIN := Main)
    TAG
      DelayTimer : TIMER;
      PulseCounter : COUNTER;
      CycleCount : DINT;
    END_TAG
    ROUTINE Main
      RUNG 0
        N: TON(DelayTimer,${timer});
      END_RUNG
      RUNG 1
        N: CTU(PulseCounter,${counter});
      END_RUNG
      RUNG 2
        N: ADD(CycleCount,1,CycleCount)LES(CycleCount,${threshold});
      END_RUNG
    END_ROUTINE
  END_PROGRAM`;
}

function fixture(options = {}) {
  const p1 = options.P1 || {};
  const p2 = options.P2 || {};
  const p3 = options.P3 || {};
  const includeP3 = options.includeP3 !== false;
  const p3Block = includeP3 ? `\n${program("P3", p3)}` : "";
  const p3Task = includeP3 ? "    P3;\n" : "";
  return `RSLogix 5000 Export Version 20.01
CONTROLLER Consistency_Compare
  TAG
    SharedTimer : TIMER;
  END_TAG
${program("P1", p1)}
${program("P2", p2)}${p3Block}
  TASK MainTask (Type := CONTINUOUS, Priority := 10)
    P1;
    P2;
${p3Task}  END_TASK
END_CONTROLLER`;
}

function consistencyDiffs(result) {
  return (result.differences || []).filter((item) => item.category === "consistency");
}

test("v10.1 reports no consistency-state differences for identical exports", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture());
  const result = compare.compareProjects(baseline, current);
  assert.equal(result.version, "l5k-compare-v10.1");
  assert.equal(result.statistics.consistencyDifferences, 0);
  assert.equal(consistencyDiffs(result).length, 0);
});

test("v10.1 detects a timer peer family changing from uniform to divergent", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ P3: { timer: 250 } }));
  const result = compare.compareProjects(baseline, current);
  const changed = consistencyDiffs(result).find((item) => item.consistencyKind === "timer-preset" && /DelayTimer/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.baseline.state, "uniform");
  assert.equal(changed.current.state, "divergent");
  assert.equal(changed.evidence.becameDivergent, true);
  assert.equal(changed.reviewLevel, "review");
  assert.match(changed.title, /became divergent/i);
  assert.match(changed.summary, /no value is identified as correct/i);
});

test("v10.1 detects a divergent timer peer family becoming uniform", () => {
  const baseline = analyzer.parseL5K(fixture({ P3: { timer: 250 } }));
  const current = analyzer.parseL5K(fixture());
  const result = compare.compareProjects(baseline, current);
  const changed = consistencyDiffs(result).find((item) => item.consistencyKind === "timer-preset" && /DelayTimer/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.baseline.state, "divergent");
  assert.equal(changed.current.state, "uniform");
  assert.equal(changed.evidence.becameUniform, true);
  assert.equal(changed.reviewLevel, "info");
  assert.match(changed.title, /became uniform/i);
  assert.match(changed.summary, /does not prove the current value is correct/i);
});

test("v10.1 detects an outlier moving between peer programs while remaining divergent", () => {
  const baseline = analyzer.parseL5K(fixture({ P3: { timer: 250 } }));
  const current = analyzer.parseL5K(fixture({ P2: { timer: 250 } }));
  const result = compare.compareProjects(baseline, current);
  const changed = consistencyDiffs(result).find((item) => item.consistencyKind === "timer-preset" && /DelayTimer/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.baseline.state, "divergent");
  assert.equal(changed.current.state, "divergent");
  assert.match(changed.title, /peer consistency changed/i);
  const beforeP3 = changed.baseline.peers.find((peer) => peer.program === "P3");
  const afterP2 = changed.current.peers.find((peer) => peer.program === "P2");
  assert.deepEqual(beforeP3.values, ["250"]);
  assert.deepEqual(afterP2.values, ["250"]);
});

test("v10.1 detects peer membership changes without treating them as a confirmed defect", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ includeP3: false }));
  const result = compare.compareProjects(baseline, current);
  const changed = consistencyDiffs(result).find((item) => item.consistencyKind === "timer-preset" && /DelayTimer/.test(item.title));
  assert.ok(changed);
  assert.deepEqual(changed.baseline.programs, ["P1", "P2", "P3"]);
  assert.deepEqual(changed.current.programs, ["P1", "P2"]);
  assert.match(changed.summary, /same-name program-scoped tags are inferred peers only/i);
});

test("v10.1 compares counter PRE consistency state", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ P3: { counter: 9 } }));
  const result = compare.compareProjects(baseline, current);
  const changed = consistencyDiffs(result).find((item) => item.consistencyKind === "counter-preset" && /PulseCounter/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.baseline.state, "uniform");
  assert.equal(changed.current.state, "divergent");
});

test("v10.1 preserves the PLC-cycle no-ms boundary for threshold consistency changes", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ P3: { threshold: 40 } }));
  const result = compare.compareProjects(baseline, current);
  const changed = consistencyDiffs(result).find((item) => item.consistencyKind === "threshold" && /CycleCount/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.evidence.cycleStyle, true);
  assert.match(changed.summary, /must not be converted to milliseconds without runtime scan-time evidence/i);
});

test("v10.1 consistency category works with the existing filter API", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ P3: { timer: 250, counter: 9, threshold: 40 } }));
  const result = compare.compareProjects(baseline, current);
  const filtered = compare.filterDifferences(result, { category: "consistency" });
  assert.ok(filtered.length >= 3);
  assert.ok(filtered.every((item) => item.category === "consistency"));
});

test("v10.1 Compare loads v10 analysis and comparison layers locally/read-only", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/compare.html"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-compare-v5-2.js"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-consistency-v10-1.js"), "utf8");
  const analyzerV10 = page.indexOf("l5k-analyzer-consistency-v10.js?v=10");
  const messageCompare = page.indexOf("l5k-analyzer-compare-message-v9-1.js?v=9.1");
  const consistencyCompare = page.indexOf("l5k-analyzer-compare-consistency-v10-1.js?v=10.1");
  const uiScript = page.indexOf("plc-analyzer-compare-v5-2.js?v=10.1");
  assert.ok(analyzerV10 >= 0 && analyzerV10 < messageCompare && messageCompare < consistencyCompare && consistencyCompare < uiScript);
  assert.match(page, /PLC ANALYZER COMPARE v9\.1 — MSG \/ MESSAGE DIFF/);
  assert.match(page, /v10\.1 CONSISTENCY STATE DIFF/);
  assert.match(page, /value="consistency"/);
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-compare-worker\.js\?v=10\.1"\)/);
  assert.match(ui, /item\.consistencyKind/);
  assert.match(worker, /l5k-analyzer-consistency-v10\.js\?v=10/);
  assert.match(worker, /l5k-analyzer-compare-consistency-v10-1\.js\?v=10\.1/);
  assert.match(page, /not adjustment recommendations/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
});
