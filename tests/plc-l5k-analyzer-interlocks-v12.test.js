"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-interlocks-v12.js"));

const fixture = `RSLogix 5000 Export Version 20.01
CONTROLLER Interlock_Test
  TAG
    StartPB : BOOL;
    Ready : BOOL;
    ReadySource : BOOL;
    Faulted : BOOL;
    MotorRun : BOOL;
    Alternate : BOOL;
    Mode : DINT;
  END_TAG
  PROGRAM P (MAIN := Main)
    ROUTINE Main
      RUNG 0
        N: XIC(ReadySource)OTE(Ready);
      END_RUNG
      RUNG 1
        N: XIC(StartPB)XIC(Ready)XIO(Faulted)EQU(Mode,1)XIC(MotorRun)OTE(MotorRun);
      END_RUNG
      RUNG 2
        N: XIC(Alternate)XIO(Faulted)OTE(MotorRun);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
  TASK MainTask (Type := CONTINUOUS, Priority := 10)
    P;
  END_TASK
END_CONTROLLER`;

test("v12 inventories XIC/XIO/comparison evidence before an output action", () => {
  const project = analyzer.parseL5K(fixture);
  const topology = project.dependencies.interlockTopology;
  assert.equal(topology.version, "v12");
  const pathItem = topology.actionPaths.find((item) => item.target === "MotorRun" && item.rung === 1);
  assert.ok(pathItem);
  assert.deepEqual(pathItem.trueRequiredContacts.map((item) => item.symbol), ["StartPB", "Ready", "MotorRun"]);
  assert.deepEqual(pathItem.falseRequiredContacts.map((item) => item.symbol), ["Faulted"]);
  assert.equal(pathItem.comparisons.length, 1);
  assert.equal(pathItem.comparisons[0].instruction, "EQU");
  assert.deepEqual(pathItem.comparisons[0].args, ["Mode", "1"]);
  assert.equal(pathItem.runtimeGateStateProven, false);
  assert.equal(pathItem.booleanBranchSemanticsProven, false);
});

test("v12 identifies same-target XIC as a self-hold candidate only", () => {
  const project = analyzer.parseL5K(fixture);
  const pathItem = project.dependencies.interlockTopology.actionPaths.find((item) => item.target === "MotorRun" && item.rung === 1);
  assert.equal(pathItem.selfHoldCandidate, true);
  const finding = project.findings.find((item) => item.sourceRule === "plc-interlocks-v12" && /Self-hold/.test(item.title));
  assert.ok(finding);
  assert.equal(finding.classification, "static-inference");
  assert.match(finding.summary, /candidate only/i);
  assert.match(finding.summary, /live contact state are not proven/i);
});

test("v12 flags multiple writers with different same-rung gate evidence for review", () => {
  const project = analyzer.parseL5K(fixture);
  const finding = project.findings.find((item) => item.id === "v12:multiple-permissive-paths:MotorRun");
  assert.ok(finding);
  assert.equal(finding.severity, "review");
  assert.equal(finding.evidence.paths.length, 2);
  assert.match(finding.summary, /Multiple paths can be intentional/i);
  assert.match(finding.summary, /does not prove conflicting live logic or a defect/i);
});

test("v12 trace attaches source-visible producer relations for gate symbols", () => {
  const project = analyzer.parseL5K(fixture);
  const trace = analyzer.traceTarget(project, "MotorRun", { maxDepth: 5 });
  assert.equal(trace.permissiveStateProven, false);
  assert.equal(trace.booleanBranchSemanticsProven, false);
  const context = trace.interlockContexts.find((item) => item.rung === 1);
  assert.ok(context);
  const ready = context.gates.find((gate) => gate.symbol === "Ready");
  assert.ok(ready);
  assert.ok(ready.producerRelations.some((relation) => relation.destination === "Ready" && relation.rung === 0));
  assert.match(trace.note, /does not prove which contacts are currently true\/false/i);
});

test("v12 XIO gate is source condition evidence, not proof of a live blocker", () => {
  const project = analyzer.parseL5K(fixture);
  const pathItem = project.dependencies.interlockTopology.actionPaths.find((item) => item.target === "MotorRun" && item.rung === 1);
  const faultGate = pathItem.falseRequiredContacts.find((gate) => gate.symbol === "Faulted");
  assert.ok(faultGate);
  assert.equal(faultGate.sense, "false-required");
  assert.equal(faultGate.runtimeStateProven, false);
  assert.match(project.dependencies.interlockTopology.sourceBoundary, /not as proof that a condition is currently permitting or blocking an action/i);
});

test("v12 search can locate an action by a gate symbol", () => {
  const project = analyzer.parseL5K(fixture);
  const results = analyzer.searchAnalysis(project, "Faulted", 20);
  assert.ok(results.some((item) => /MotorRun.*permissive path/i.test(item.title)));
});

test("v12 preserves legacy neutral-N source and routine context", () => {
  const legacy = `Version := RSLogix 5000 v15.02\nCONTROLLER LegacyInterlock\nTAG\nPermit : BOOL;\nTrip : BOOL;\nRunCmd : BOOL;\nEND_TAG\nPROGRAM P (MAIN := Main)\nROUTINE Main\nN: XIC(Permit)XIO(Trip)OTE(RunCmd);\nEND_ROUTINE\nEND_PROGRAM\nTASK MainTask (Type := Continuous, Priority := 10)\nP;\nEND_TASK\nEND_CONTROLLER`;
  const project = analyzer.parseL5K(legacy);
  assert.equal(project.exportVersion, "15.02");
  assert.equal(project.source.ladderEncoding, "legacy-neutral-N");
  const pathItem = project.dependencies.interlockTopology.actionPaths.find((item) => item.target === "RunCmd");
  assert.ok(pathItem);
  assert.equal(pathItem.program, "P");
  assert.equal(pathItem.routine, "Main");
  assert.deepEqual(pathItem.gates.map((item) => item.symbol), ["Permit", "Trip"]);
});

test("v12 layer remains local/read-only under the current v13 analyzer release", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-interlocks-v12.js"), "utf8");
  const v11 = page.indexOf("l5k-analyzer-sequence-v11.js?v=11");
  const v12 = page.indexOf("l5k-analyzer-interlocks-v12.js?v=12");
  const v13 = page.indexOf("l5k-analyzer-recovery-v13.js?v=13");
  const ui = page.indexOf("plc-analyzer.js?v=13");
  assert.ok(v11 >= 0 && v11 < v12 && v12 < v13 && v13 < ui);
  assert.match(page, /v12 INTERLOCK \/ PERMISSIVE/);
  assert.match(page, /v13 RESET \/ RECOVERY TOPOLOGY/);
  assert.match(page, /does not prove.*current permissive|does not prove live.*permissive/i);
  assert.match(worker, /l5k-analyzer-sequence-v11\.js\?v=11/);
  assert.match(worker, /l5k-analyzer-interlocks-v12\.js\?v=12/);
  assert.match(worker, /l5k-analyzer-recovery-v13\.js\?v=13/);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(page, /force interlock|bypass interlock/i);
});
