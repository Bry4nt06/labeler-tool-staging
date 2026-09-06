"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-afi-v14.js"));

const fixture = `RSLogix 5000 Export Version 20.01
CONTROLLER AFI_Test
  TAG
    Start : BOOL;
    OutputA : BOOL;
    OutputB : BOOL;
  END_TAG
  PROGRAM MainProgram (MAIN := Main)
    ROUTINE Main
      RUNG 0
        N: XIC(Start)AFI()OTE(OutputA);
      END_RUNG
      RUNG 1
        N: AFI()
        N: XIC(Start)AFI()OTE(OutputB);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER`;

test("v14 inventories every AFI call with exact program, routine, rung and source line", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "afi-test.L5K" });
  assert.equal(project.statistics.afis, 3);
  assert.equal(project.afiAudit.version, "v14");
  assert.equal(project.afiReferences.length, 3);

  const firstRung = project.rungs.find((rung) => rung.number === 0);
  const secondRung = project.rungs.find((rung) => rung.number === 1);
  assert.ok(firstRung && secondRung);

  assert.deepEqual(project.afiReferences.map((item) => [item.program, item.routine, item.rung]), [
    ["MainProgram", "Main", 0],
    ["MainProgram", "Main", 1],
    ["MainProgram", "Main", 1]
  ]);
  assert.equal(project.afiReferences[0].line, firstRung.startLine + 1);
  assert.equal(project.afiReferences[1].line, secondRung.startLine + 1);
  assert.equal(project.afiReferences[2].line, secondRung.startLine + 2);
  assert.ok(project.afiReferences.every((item) => item.classification === "source-proven" && item.runtimeStateProven === false));
});

test("v14 keeps AFIs as source evidence without declaring a disabled routine or defect", () => {
  const project = analyzer.parseL5K(fixture);
  assert.match(project.afiAudit.sourceBoundary, /does not prove why it was placed there/i);
  assert.match(project.afiAudit.sourceBoundary, /adjacent branches remain active/i);
  assert.doesNotMatch(JSON.stringify(project.afiAudit), /defect|entire routine is disabled|safe to bypass/i);
});

test("v14 reports zero cleanly when an export contains no AFI", () => {
  const project = analyzer.parseL5K(fixture.replaceAll("AFI()", "XIC(Start)"));
  assert.equal(project.statistics.afis, 0);
  assert.deepEqual(project.afiReferences, []);
});

test("v14 AFI-containing rungs remain searchable through the existing source search", () => {
  const project = analyzer.parseL5K(fixture);
  const results = analyzer.searchAnalysis(project, "AFI", 20);
  assert.ok(results.some((item) => item.type === "rung" && /Main rung 0/.test(item.title)));
  assert.ok(results.some((item) => item.type === "rung" && /Main rung 1/.test(item.title)));
});

test("v14 page loads AFI engine in worker and browser and keeps earlier analyzer phase labels", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
  assert.match(page, /PLC ANALYZER v9 — MSG MESSAGE TOPOLOGY/);
  assert.match(page, /v10 INTRA-PROJECT CONSISTENCY REVIEW/);
  assert.match(page, /v11 SEQUENCE TOPOLOGY/);
  assert.match(page, /v12 INTERLOCK \/ PERMISSIVE PATHS/);
  assert.match(page, /v13 RESET \/ RECOVERY TOPOLOGY/);
  assert.match(page, /v14 AFI AUDIT \/ UI FIXES/);
  const v13 = page.indexOf("l5k-analyzer-recovery-v13.js?v=13");
  const v14 = page.indexOf("l5k-analyzer-afi-v14.js?v=14");
  const ui = page.indexOf("plc-analyzer.js?v=13");
  assert.ok(v13 >= 0 && v13 < v14 && v14 < ui);
  assert.match(worker, /l5k-analyzer-recovery-v13\.js\?v=13/);
  assert.match(worker, /l5k-analyzer-afi-v14\.js\?v=14/);
});

test("v14 UI fixes close hiding, routine chip wrapping, worker cache version and AFI location rendering", () => {
  const css = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-v14.css"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-afi-ui-v14.js"), "utf8");
  assert.match(css, /\.plc-detail-panel\[hidden\]\{display:none!important\}/);
  assert.match(css, /\.plc-structure-table td:nth-child\(3\) \.plc-chip\{display:inline-block/);
  assert.match(ui, /l5k-analyzer-worker\.js\?v=11/);
  assert.match(ui, /l5k-analyzer-worker\.js\?v=14/);
  assert.match(ui, /AFI instructions/);
  assert.match(ui, /AFI audit/);
  assert.match(ui, /Open rung evidence/);
  assert.match(ui, /source line/);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
});
