"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-task-schedule-v7.js"));
const compare = require(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-task-schedule-v7-1.js"));

function fixture(options = {}) {
  const taskName = options.taskName || "MainTask";
  const priority = options.priority || "10";
  const rate = options.rate || null;
  const watchdog = options.watchdog || "500";
  const programOrder = options.programOrder || ["P1", "P2"];
  const includeSecondaryTask = Boolean(options.secondaryTaskPrograms?.length);
  const primaryLines = programOrder.map((program) => `    ${program};`).join("\n");
  const secondary = includeSecondaryTask
    ? `\n  TASK SecondaryTask (Type := PERIODIC, Priority := 8, Rate := 10000)\n${options.secondaryTaskPrograms.map((program) => `    ${program};`).join("\n")}\n  END_TASK`
    : "";
  const rateAttribute = rate ? `, Rate := ${rate}` : "";
  return `RSLogix 5000 Export Version 20.01
CONTROLLER Task_Compare
  TAG
    InputA : BOOL;
    Faults : DINT[2];
  END_TAG
  PROGRAM P1 (MAIN := Main)
    ROUTINE Main
      RUNG 0
        N: XIC(InputA)OTL(Faults[0].1);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
  PROGRAM P2 (MAIN := Main)
    ROUTINE Main
      RUNG 0
        N: XIC(InputA)OTL(Faults[0].2);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
  TASK ${taskName} (Type := CONTINUOUS, Priority := ${priority}${rateAttribute}, Watchdog := ${watchdog}, InhibitTask := No)
${primaryLines}
  END_TASK${secondary}
END_CONTROLLER`;
}

function taskDiffs(result) {
  return (result.differences || []).filter((item) => item.category === "tasks");
}

test("v7.1 reports no task schedule differences for identical exports", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture());
  const result = compare.compareProjects(baseline, current);
  assert.equal(result.version, "l5k-compare-v7.1");
  assert.equal(result.statistics.taskScheduleDifferences, 0);
  assert.equal(taskDiffs(result).length, 0);
});

test("v7.1 detects task addition and removal", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ taskName: "ReplacementTask" }));
  const result = compare.compareProjects(baseline, current);
  assert.ok(taskDiffs(result).some((item) => item.taskKind === "task" && item.changeType === "removed" && /MainTask/.test(item.title)));
  assert.ok(taskDiffs(result).some((item) => item.taskKind === "task" && item.changeType === "added" && /ReplacementTask/.test(item.title)));
  assert.match(result.taskScheduleComparison.sourceBoundary, /not prove current task execution/i);
});

test("v7.1 detects source-visible task attribute changes without recommending values", () => {
  const baseline = analyzer.parseL5K(fixture({ priority: "10", watchdog: "500" }));
  const current = analyzer.parseL5K(fixture({ priority: "7", watchdog: "750" }));
  const result = compare.compareProjects(baseline, current);
  const changed = taskDiffs(result).find((item) => item.taskKind === "task-attributes");
  assert.ok(changed);
  assert.equal(changed.baseline.priority, "10");
  assert.equal(changed.current.priority, "7");
  assert.equal(changed.baseline.watchdog, "500");
  assert.equal(changed.current.watchdog, "750");
  assert.match(changed.summary, /export evidence only/i);
  assert.match(changed.summary, /not adjustment recommendations/i);
});

test("v7.1 detects program order changes when task membership is unchanged", () => {
  const baseline = analyzer.parseL5K(fixture({ programOrder: ["P1", "P2"] }));
  const current = analyzer.parseL5K(fixture({ programOrder: ["P2", "P1"] }));
  const result = compare.compareProjects(baseline, current);
  const changed = taskDiffs(result).find((item) => item.taskKind === "program-order");
  assert.ok(changed);
  assert.deepEqual(changed.baseline.map((item) => item.program), ["P1", "P2"]);
  assert.deepEqual(changed.current.map((item) => item.program), ["P2", "P1"]);
  assert.match(changed.summary, /configuration evidence only/i);
});

test("v7.1 detects a program moved between tasks", () => {
  const baseline = analyzer.parseL5K(fixture({ programOrder: ["P1", "P2"] }));
  const current = analyzer.parseL5K(fixture({ programOrder: ["P1"], secondaryTaskPrograms: ["P2"] }));
  const result = compare.compareProjects(baseline, current);
  const moved = taskDiffs(result).find((item) => item.taskKind === "program-task" && /P2/.test(item.title));
  assert.ok(moved);
  assert.match(moved.summary, /MainTask/);
  assert.match(moved.summary, /SecondaryTask/);
});

test("v7.1 detects scheduled to unscheduled transition", () => {
  const baseline = analyzer.parseL5K(fixture({ programOrder: ["P1", "P2"] }));
  const current = analyzer.parseL5K(fixture({ programOrder: ["P1"] }));
  const result = compare.compareProjects(baseline, current);
  const transition = taskDiffs(result).find((item) => item.taskKind === "scheduled-state" && /P2/.test(item.title));
  assert.ok(transition);
  assert.equal(transition.reviewLevel, "review");
  assert.match(transition.title, /became unscheduled/i);
  assert.match(transition.summary, /may be intentional/i);
});

test("v7.1 detects unscheduled to scheduled transition as informational review evidence", () => {
  const baseline = analyzer.parseL5K(fixture({ programOrder: ["P1"] }));
  const current = analyzer.parseL5K(fixture({ programOrder: ["P1", "P2"] }));
  const result = compare.compareProjects(baseline, current);
  const transition = taskDiffs(result).find((item) => item.taskKind === "scheduled-state" && /P2/.test(item.title));
  assert.ok(transition);
  assert.equal(transition.reviewLevel, "info");
  assert.match(transition.title, /became scheduled/i);
});

test("v7.1 task category works with the existing comparison filter API", () => {
  const baseline = analyzer.parseL5K(fixture({ priority: "10", programOrder: ["P1", "P2"] }));
  const current = analyzer.parseL5K(fixture({ priority: "8", programOrder: ["P2", "P1"] }));
  const result = compare.compareProjects(baseline, current);
  const filtered = compare.filterDifferences(result, { category: "tasks" });
  assert.ok(filtered.length >= 2);
  assert.ok(filtered.every((item) => item.category === "tasks"));
});

test("v7.1 task Compare layer remains local/read-only under the current v11.1 release", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/compare.html"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-compare-v5-2.js"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-task-schedule-v7-1.js"), "utf8");
  const taskParser = page.indexOf("l5k-analyzer-task-schedule-v7.js?v=7");
  const messageParser = page.indexOf("l5k-analyzer-message-v9.js?v=9");
  const consistencyParser = page.indexOf("l5k-analyzer-consistency-v10.js?v=10");
  const sequenceParser = page.indexOf("l5k-analyzer-sequence-v11.js?v=11");
  const baseCompare = page.indexOf("l5k-analyzer-compare.js?v=2");
  const dependencyCompare = page.indexOf("l5k-analyzer-compare-dependencies-v5-2.js?v=5.2");
  const taskCompare = page.indexOf("l5k-analyzer-compare-task-schedule-v7-1.js?v=7.1");
  const communicationCompare = page.indexOf("l5k-analyzer-compare-communication-v8-1.js?v=8.1");
  const messageCompare = page.indexOf("l5k-analyzer-compare-message-v9-1.js?v=9.1");
  const consistencyCompare = page.indexOf("l5k-analyzer-compare-consistency-v10-1.js?v=10.1");
  const sequenceCompare = page.indexOf("l5k-analyzer-compare-sequence-v11-1.js?v=11.1");
  const uiScript = page.indexOf("plc-analyzer-compare-v5-2.js?v=11.1");
  assert.ok(taskParser >= 0 && taskParser < messageParser && messageParser < consistencyParser && consistencyParser < sequenceParser && sequenceParser < baseCompare && baseCompare < dependencyCompare && dependencyCompare < taskCompare && taskCompare < communicationCompare && communicationCompare < messageCompare && messageCompare < consistencyCompare && consistencyCompare < sequenceCompare && sequenceCompare < uiScript);
  assert.match(page, /PLC ANALYZER COMPARE v9\.1 — MSG \/ MESSAGE DIFF/);
  assert.match(page, /v11\.1 SEQUENCE DIFF/);
  assert.match(page, /value="tasks"/);
  assert.match(page, /task inhibit state/i);
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-compare-worker\.js\?v=11\.1"\)/);
  assert.match(worker, /l5k-analyzer-task-schedule-v7\.js\?v=7/);
  assert.match(worker, /l5k-analyzer-compare-task-schedule-v7-1\.js\?v=7\.1/);
  assert.match(worker, /l5k-analyzer-compare-consistency-v10-1\.js\?v=10\.1/);
  assert.match(worker, /l5k-analyzer-compare-sequence-v11-1\.js\?v=11\.1/);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
});
