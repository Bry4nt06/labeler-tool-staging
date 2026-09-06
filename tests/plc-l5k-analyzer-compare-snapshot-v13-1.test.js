"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-interlocks-v12.js"));
const compare = require(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-snapshot-v13-1.js"));

function fixture(controller, rows) {
  return `RSLogix 5000 Export Version 15.02
CONTROLLER ${controller}
  TAG
    A : BOOL;
    B : BOOL;
    C : BOOL;
    Watchdog : TIMER;
    TestTimer : TIMER;
  END_TAG
  PROGRAM MainProgram (MAIN := MainRoutine)
    ROUTINE MainRoutine
${rows.map((source, index) => `      RUNG ${index}\n        N: ${source}\n      END_RUNG`).join("\n")}
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER
`;
}

function parsed(controller, rows, fileName) {
  return analyzer.parseL5K(fixture(controller, rows), { fileName });
}

test("v13.1 same-controller alignment prevents an inserted rung from cascading into false downstream edits", () => {
  const baseline = parsed("Same_Controller", [
    "XIC(A)OTE(B);",
    "MOV(5000,Watchdog.PRE);",
    "XIC(B)OTE(C);"
  ], "earlier.L5K");
  const current = parsed("Same_Controller", [
    "XIC(A)OTE(B);",
    "MOV(15000,Watchdog.PRE);",
    "TON(TestTimer,1000,0);",
    "XIC(B)OTE(C);"
  ], "later.L5K");

  const result = compare.compareProjects(baseline, current);
  const snapshot = result.differences.filter((item) => item.category === "snapshots");
  assert.equal(result.snapshotComparison.sameController, true);
  assert.equal(result.statistics.snapshotAlignedDifferences, 2);
  assert.equal(result.statistics.snapshotRoutinesChanged, 1);
  assert.equal(snapshot.filter((item) => item.changeType === "changed").length, 1);
  assert.equal(snapshot.filter((item) => item.changeType === "added").length, 1);
  assert.equal(result.differences.filter((item) => item.category === "rungs").length, 0);
  assert.ok(snapshot.some((item) => JSON.stringify(item.current).includes("15000")));
  assert.ok(snapshot.some((item) => JSON.stringify(item.current).includes("TestTimer")));
  assert.ok(!snapshot.some((item) => item.changeType !== "added" && JSON.stringify(item.current).includes("XIC(B)OTE(C)")));
});

test("v13.1 retains ordinary positional rung comparison when controller identities differ", () => {
  const baseline = parsed("Controller_A", ["XIC(A)OTE(B);"], "a.L5K");
  const current = parsed("Controller_B", ["XIO(A)OTE(B);"], "b.L5K");
  const result = compare.compareProjects(baseline, current);
  assert.equal(result.snapshotComparison.sameController, false);
  assert.equal(result.statistics.snapshotAlignedDifferences, 0);
  assert.ok(result.differences.some((item) => item.category === "rungs"));
  assert.ok(!result.differences.some((item) => item.category === "snapshots"));
});

test("v13.1 does not call the later snapshot correct and keeps numeric values as review evidence", () => {
  const baseline = parsed("Same_Controller", ["MOV(200,Watchdog.PRE);"], "earlier.L5K");
  const current = parsed("Same_Controller", ["MOV(500,Watchdog.PRE);"], "later.L5K");
  const result = compare.compareProjects(baseline, current);
  assert.match(result.snapshotComparison.sourceBoundary, /not assumed correct/i);
  assert.match(result.snapshotComparison.sourceBoundary, /not adjustment recommendations/i);
  const item = result.differences.find((row) => row.category === "snapshots");
  assert.ok(item);
  assert.match(item.summary, /source evidence only/i);
});

test("v13.1 reports a clean same-controller snapshot when rung source is unchanged", () => {
  const baseline = parsed("Same_Controller", ["XIC(A)OTE(B);", "XIC(B)OTE(C);"], "earlier.L5K");
  const current = parsed("Same_Controller", ["XIC(A)OTE(B);", "XIC(B)OTE(C);"], "later.L5K");
  const result = compare.compareProjects(baseline, current);
  assert.equal(result.snapshotComparison.sameController, true);
  assert.equal(result.statistics.snapshotAlignedDifferences, 0);
  assert.equal(result.statistics.snapshotRoutinesChanged, 0);
});

test("v13.1 page and worker load snapshot alignment with a new cache key", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/compare.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-worker.js"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-compare-v5-2.js"), "utf8");
  const basePosition = page.indexOf("l5k-analyzer-compare-interlocks-v12-1.js");
  const snapshotPosition = page.indexOf("l5k-analyzer-compare-snapshot-v13-1.js");
  const uiPosition = page.indexOf("plc-analyzer-compare-v5-2.js?v=13.1");
  assert.ok(basePosition >= 0 && snapshotPosition > basePosition && uiPosition > snapshotPosition);
  assert.match(page, /v13\.1 SAME-CONTROLLER SNAPSHOT ALIGNMENT/);
  assert.match(page, /value="snapshots"/);
  assert.match(worker, /l5k-analyzer-compare-snapshot-v13-1\.js\?v=13\.1/);
  assert.match(ui, /l5k-analyzer-compare-worker\.js\?v=13\.1/);
  assert.match(ui, /Aligned snapshot differences/);
});
