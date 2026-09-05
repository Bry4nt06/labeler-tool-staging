"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-consistency-v10.js"));

function programBlock(name, options = {}) {
  const timerPreset = options.timerPreset ?? 100;
  const timerType = options.timerType || "TON";
  const counterPreset = options.counterPreset ?? 5;
  const cycleThreshold = options.cycleThreshold ?? 20;
  const decisionThreshold = options.decisionThreshold ?? 50;
  const sharedPreset = options.sharedPreset ?? 500;
  return `  PROGRAM ${name} (MAIN := Main)
    TAG
      DelayTimer : TIMER;
      PulseCounter : COUNTER;
      CycleCount : DINT;
      DecisionValue : DINT;
    END_TAG
    ROUTINE Main
      RUNG 0
        N: ${timerType}(DelayTimer,${timerPreset});
      END_RUNG
      RUNG 1
        N: CTU(PulseCounter,${counterPreset});
      END_RUNG
      RUNG 2
        N: ADD(CycleCount,1,CycleCount)LES(CycleCount,${cycleThreshold});
      END_RUNG
      RUNG 3
        N: GRT(DecisionValue,${decisionThreshold});
      END_RUNG
      RUNG 4
        N: TON(SharedTimer,${sharedPreset});
      END_RUNG
    END_ROUTINE
  END_PROGRAM`;
}

function fixture(overrides = {}) {
  const p1 = { ...(overrides.P1 || {}) };
  const p2 = { ...(overrides.P2 || {}) };
  const p3 = { ...(overrides.P3 || {}) };
  return `RSLogix 5000 Export Version 20.01
CONTROLLER Consistency_Test
  TAG
    SharedTimer : TIMER;
    MsgControl : MESSAGE (MessageType := CIP Data Table Read, RemoteElement := RemoteData, RequestedLength := 1, ConnectionPath := "ENBT,2,192.168.1.20", LocalElement := SharedData);
    SharedData : DINT;
  END_TAG
${programBlock("P1", p1)}
${programBlock("P2", p2)}
${programBlock("P3", p3)}
  TASK MainTask (Type := CONTINUOUS, Priority := 10)
    P1;
    P2;
    P3;
  END_TASK
END_CONTROLLER`;
}

function v10Findings(project) {
  return (project.findings || []).filter((finding) => finding.sourceRule === "plc-intra-project-consistency-v10");
}

test("v10 produces no peer consistency findings when program-scoped peers agree", () => {
  const project = analyzer.parseL5K(fixture());
  assert.equal(project.dependencies.consistencyReview.version, "v10");
  assert.equal(v10Findings(project).length, 0);
  assert.equal(project.statistics.consistencyFindings, 0);
});

test("v10 detects a peer timer PRE difference without declaring a correct value", () => {
  const project = analyzer.parseL5K(fixture({ P3: { timerPreset: 250 } }));
  const finding = v10Findings(project).find((item) => item.id === "v10:timer-preset-peer:DelayTimer");
  assert.ok(finding);
  assert.equal(finding.classification, "static-inference");
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /does not establish which value is correct/i);
  assert.match(finding.summary, /not a recommendation/i);
  assert.equal(finding.evidence.majority.signature, "100");
  assert.equal(finding.evidence.majority.count, 2);
  assert.equal(finding.evidence.majority.total, 3);
});

test("v10 detects timer instruction family differences across program-scoped peers", () => {
  const project = analyzer.parseL5K(fixture({ P3: { timerType: "TOF" } }));
  const finding = v10Findings(project).find((item) => item.id === "v10:timer-instruction-peer:DelayTimer");
  assert.ok(finding);
  assert.match(finding.summary, /same-name program tags are treated only as inferred peers/i);
  const p3 = finding.evidence.peers.find((peer) => peer.program === "P3");
  assert.deepEqual(p3.instructionTypes, ["TOF"]);
});

test("v10 detects counter preset differences across source-proven program scopes", () => {
  const project = analyzer.parseL5K(fixture({ P2: { counterPreset: 9 } }));
  const finding = v10Findings(project).find((item) => item.id === "v10:counter-preset-peer:PulseCounter");
  assert.ok(finding);
  assert.match(finding.summary, /not adjustment recommendations/i);
  assert.ok(finding.evidence.peers.some((peer) => peer.program === "P2" && peer.presets.includes("9")));
});

test("v10 detects numeric decision threshold differences and preserves PLC-cycle warning", () => {
  const project = analyzer.parseL5K(fixture({ P3: { cycleThreshold: 40 } }));
  const finding = v10Findings(project).find((item) => item.id === "v10:threshold-peer:CycleCount");
  assert.ok(finding);
  assert.equal(finding.evidence.cycleStyle, true);
  assert.match(finding.summary, /must not be converted to milliseconds without scan-time\/runtime evidence/i);
});

test("v10 detects ordinary numeric comparison differences without inventing time units", () => {
  const project = analyzer.parseL5K(fixture({ P3: { decisionThreshold: 75 } }));
  const finding = v10Findings(project).find((item) => item.id === "v10:threshold-peer:DecisionValue");
  assert.ok(finding);
  assert.equal(finding.evidence.cycleStyle, false);
  assert.match(finding.summary, /does not establish the correct threshold/i);
  assert.doesNotMatch(finding.summary, /milliseconds/i);
});

test("v10 excludes a shared controller-scoped timer from peer-outlier classification", () => {
  const project = analyzer.parseL5K(fixture({ P1: { sharedPreset: 500 }, P2: { sharedPreset: 750 }, P3: { sharedPreset: 1000 } }));
  assert.equal(v10Findings(project).some((item) => /SharedTimer/.test(item.id) || /SharedTimer/.test(item.title)), false);
  const shared = project.dependencies.consistencyReview.timers.find((item) => item.family === "SharedTimer");
  assert.ok(shared);
  assert.equal(shared.scopeKind, "controller-proven");
});

test("v10 preserves v9 MESSAGE topology, v8 communication topology and v7 task topology", () => {
  const project = analyzer.parseL5K(fixture());
  assert.equal(project.dependencies.taskScheduling.version, "v7");
  assert.equal(project.dependencies.communicationTopology.version, "v8");
  assert.equal(project.dependencies.messageTopology.version, "v9");
  assert.equal(project.dependencies.consistencyReview.version, "v10");
  assert.ok(project.dependencies.messageTopology.messageTags.some((item) => item.name === "MsgControl"));
});

test("v10 preserves legacy v15 neutral-N parsing while adding consistency metadata", () => {
  const legacy = `Version := RSLogix 5000 v15.02
CONTROLLER LegacyConsistency
PROGRAM P1 (MAIN := Main)
TAG
DelayTimer : TIMER;
END_TAG
ROUTINE Main
N: TON(DelayTimer,100);
END_ROUTINE
END_PROGRAM
PROGRAM P2 (MAIN := Main)
TAG
DelayTimer : TIMER;
END_TAG
ROUTINE Main
N: TON(DelayTimer,200);
END_ROUTINE
END_PROGRAM
END_CONTROLLER`;
  const project = analyzer.parseL5K(legacy);
  assert.equal(project.exportVersion, "15.02");
  assert.equal(project.source.ladderEncoding, "legacy-neutral-N");
  assert.equal(project.dependencies.consistencyReview.version, "v10");
  assert.ok(v10Findings(project).some((item) => item.id === "v10:timer-preset-peer:DelayTimer"));
});

test("v10 page and worker remain browser-local/read-only and load after v9", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-consistency-v10.js"), "utf8");
  assert.match(page, /PLC ANALYZER v10 — INTRA-PROJECT CONSISTENCY REVIEW/);
  assert.match(page, /l5k-analyzer-message-v9\.js\?v=9/);
  assert.match(page, /l5k-analyzer-consistency-v10\.js\?v=10/);
  assert.match(worker, /l5k-analyzer-message-v9\.js\?v=9/);
  assert.match(worker, /l5k-analyzer-consistency-v10\.js\?v=10/);
  assert.match(page, /same-name program-scoped peers/i);
  assert.match(page, /not adjustment recommendations/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(page, /connect to PLC|write to PLC|force PLC/i);
});
