"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-recovery-v13.js"));

const fixture = `RSLogix 5000 Export Version 20.01
CONTROLLER Recovery_Test
  PROGRAM P (MAIN := Main)
    TAG
      Start : BOOL;
      ResetPB : BOOL;
      MotionActive : BOOL;
      LatchedNoReset : BOOL;
      OrphanUnlatch : BOOL;
      VerifyTimer : TIMER;
      PartCount : COUNTER;
      Faults : DINT[1];
    END_TAG
    ROUTINE Main
      RUNG 0
        N: XIC(Start)OTL(Faults[0].1);
      END_RUNG
      RUNG 1
        N: XIC(ResetPB)XIO(MotionActive)OTU(Faults[0].1);
      END_RUNG
      RUNG 2
        N: TON(VerifyTimer,100,0);
      END_RUNG
      RUNG 3
        N: XIC(ResetPB)RES(VerifyTimer);
      END_RUNG
      RUNG 4
        N: CTU(PartCount,5,0);
      END_RUNG
      RUNG 5
        N: XIC(ResetPB)RES(PartCount);
      END_RUNG
      RUNG 6
        N: XIC(Start)OTL(LatchedNoReset);
      END_RUNG
      RUNG 7
        N: XIC(ResetPB)OTU(OrphanUnlatch);
      END_RUNG
      RUNG 8
        N: XIC(ResetPB)RES(CustomControl);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
  TASK MainTask (Type := CONTINUOUS, Priority := 10)
    P;
  END_TASK
END_CONTROLLER`;

function findings(project) {
  return (project.findings || []).filter((item) => item.sourceRule === "plc-reset-recovery-v13");
}

test("v13 builds exact OTL to OTU relationships without claiming runtime reset state", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "recovery.L5K", byteLength: fixture.length });
  assert.equal(analyzer.version, "l5k-analyzer-v13");
  const topology = project.dependencies.resetRecoveryTopology;
  assert.equal(topology.version, "v13");
  const fault = topology.relationships.find((item) => item.target === "Faults[0].1");
  assert.ok(fault);
  assert.equal(fault.latchWriterCount, 1);
  assert.equal(fault.unlatchPathCount, 1);
  assert.equal(fault.sourcePairLocated, true);
  assert.equal(fault.runtimeStateProven, false);
  assert.equal(fault.causeClearedProven, false);
});

test("v13 preserves reset gate evidence and task-root reachability", () => {
  const project = analyzer.parseL5K(fixture);
  const path = project.dependencies.resetRecoveryTopology.unlatchPaths.find((item) => item.target === "Faults[0].1");
  assert.ok(path);
  assert.deepEqual(path.gates.map((gate) => [gate.instruction, gate.symbol]), [["XIC", "ResetPB"], ["XIO", "MotionActive"]]);
  assert.equal(path.taskRootReachable, true);
  assert.equal(path.runtimeExecutionProven, false);
  assert.equal(path.causeClearedProven, false);
  assert.equal(path.safeToResetProven, false);
});

test("v13 classifies RES paths against source-visible native timers and counters", () => {
  const project = analyzer.parseL5K(fixture);
  const paths = project.dependencies.resetRecoveryTopology.resPaths;
  assert.equal(paths.find((item) => item.target === "VerifyTimer")?.targetClass, "timer");
  assert.equal(paths.find((item) => item.target === "PartCount")?.targetClass, "counter");
  assert.equal(paths.find((item) => item.target === "CustomControl")?.targetClass, "unresolved-res-target");
  assert.equal(project.statistics.resPaths, 3);
});

test("v13 reports a visible latch with no OTU only as a static review cue", () => {
  const project = analyzer.parseL5K(fixture);
  const finding = findings(project).find((item) => item.id === "v13:latch-without-unlatch:LatchedNoReset");
  assert.ok(finding);
  assert.equal(finding.classification, "static-inference");
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /does not prove the target cannot be cleared/i);
  assert.match(finding.summary, /Do not add or force a reset/i);
});

test("v13 reports an OTU with no visible OTL as informational source-scope evidence", () => {
  const project = analyzer.parseL5K(fixture);
  const finding = findings(project).find((item) => item.id === "v13:unlatch-without-latch:OrphanUnlatch");
  assert.ok(finding);
  assert.equal(finding.severity, "info");
  assert.match(finding.summary, /can be intentional/i);
  assert.match(finding.summary, /not proof of invalid reset logic/i);
});

test("v13 keeps unresolved RES targets conservative", () => {
  const project = analyzer.parseL5K(fixture);
  const finding = findings(project).find((item) => /res-target-unresolved/.test(item.id));
  assert.ok(finding);
  assert.equal(finding.severity, "info");
  assert.match(finding.summary, /other control structures or source may be incomplete/i);
});

test("v13 search returns recovery paths by reset gate symbol", () => {
  const project = analyzer.parseL5K(fixture);
  const matches = analyzer.searchAnalysis(project, "ResetPB", 50);
  assert.ok(matches.some((item) => item.type === "recovery-path" && /Faults\[0\]\.1/.test(item.title)));
  assert.ok(matches.some((item) => item.type === "recovery-path" && /VerifyTimer/.test(item.title)));
});

test("v13 traceTarget carries reset contexts but does not prove reset safety", () => {
  const project = analyzer.parseL5K(fixture);
  const trace = analyzer.traceTarget(project, "Faults[0].1", { maxDepth: 5 });
  assert.equal(trace.resetStateProven, false);
  assert.equal(trace.resetSafetyProven, false);
  assert.ok(trace.resetRecoveryContexts.some((item) => item.target === "Faults[0].1" && item.sourcePairLocated));
  assert.match(trace.note, /does not prove that a reset executes, clears the originating cause, or is safe to perform/i);
});

test("v13 preserves legacy neutral-N reset/unlatch parsing", () => {
  const legacy = `Version := RSLogix 5000 v15.02\nCONTROLLER LegacyRecovery\nPROGRAM P (MAIN := Main)\nTAG\nResetPB : BOOL;\nFaults : DINT[1];\nEND_TAG\nROUTINE Main\nN: XIC(Start)OTL(Faults[0].1);\nN: XIC(ResetPB)OTU(Faults[0].1);\nEND_ROUTINE\nEND_PROGRAM\nTASK MainTask (Type := Continuous, Priority := 10)\nP;\nEND_TASK\nEND_CONTROLLER`;
  const project = analyzer.parseL5K(legacy);
  assert.equal(project.exportVersion, "15.02");
  assert.equal(project.source.ladderEncoding, "legacy-neutral-N");
  const relationship = project.dependencies.resetRecoveryTopology.relationships.find((item) => item.target === "Faults[0].1");
  assert.ok(relationship?.sourcePairLocated);
});

test("v13 page and worker remain local/read-only and load recovery after v12", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-recovery-v13.js"), "utf8");
  const v12 = page.indexOf("l5k-analyzer-interlocks-v12.js?v=12");
  const v13 = page.indexOf("l5k-analyzer-recovery-v13.js?v=13");
  const ui = page.indexOf("plc-analyzer.js?v=13");
  assert.ok(v12 >= 0 && v12 < v13 && v13 < ui);
  assert.match(page, /v13 RESET \/ RECOVERY TOPOLOGY/);
  assert.match(page, /does not prove a reset rung executes, the originating cause has cleared, the machine is safe to restart/i);
  assert.match(worker, /l5k-analyzer-interlocks-v12\.js\?v=12/);
  assert.match(worker, /l5k-analyzer-recovery-v13\.js\?v=13/);
  assert.match(engine, /Never use this analysis to force, bypass, or automatically reset machine or safety logic/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
});
