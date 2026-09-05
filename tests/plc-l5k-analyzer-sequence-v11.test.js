"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-sequence-v11.js"));

function fixture(options = {}) {
  const branches = options.branches
    ? `      RUNG 3
        N: EQU(Step,30)XIC(BranchA)MOV(40,Step);
      END_RUNG
      RUNG 4
        N: EQU(Step,30)XIC(BranchB)MOV(50,Step);
      END_RUNG
`
    : "";
  const unanchored = options.unanchored === false ? "" : `      RUNG 5
        N: XIC(ResetRequest)CLR(Step);
      END_RUNG
`;
  const entryGate = options.entryGate
    ? `      RUNG 6
        N: EQU(Step,5)XIC(Start)MOV(10,Step);
      END_RUNG
`
    : "";
  return `RSLogix 5000 Export Version 20.01
CONTROLLER Sequence_Test
  PROGRAM P (MAIN := Main)
    TAG
      Step : DINT;
      DelayTimer : TIMER;
      Start : BOOL;
      BranchA : BOOL;
      BranchB : BOOL;
      ResetRequest : BOOL;
    END_TAG
    ROUTINE Main
      RUNG 0
        N: EQU(Step,10)XIC(Start)MOV(20,Step);
      END_RUNG
      RUNG 1
        N: EQU(Step,20)TON(DelayTimer,500);
      END_RUNG
      RUNG 2
        N: EQU(Step,20)XIC(DelayTimer.DN)MOV(30,Step);
      END_RUNG
${branches}${unanchored}${entryGate}    END_ROUTINE
  END_PROGRAM
  TASK MainTask (Type := CONTINUOUS, Priority := 10)
    P;
  END_TASK
END_CONTROLLER`;
}

function sequenceFindings(project) {
  return (project.findings || []).filter((finding) => finding.sourceRule === "plc-sequence-v11");
}

test("v11 extracts exact numeric state transitions from EQU plus numeric assignments", () => {
  const project = analyzer.parseL5K(fixture({ unanchored: false }));
  const topology = project.dependencies.sequenceTopology;
  assert.equal(topology.version, "v11");
  assert.equal(topology.variables.length, 1);
  const step = topology.variables[0];
  assert.equal(step.symbol, "Step");
  assert.equal(step.scopeKind, "program-proven");
  assert.equal(step.scope, "P");
  assert.deepEqual(step.states, ["10", "20", "30"]);
  assert.deepEqual(step.transitions.map((item) => [item.from, item.to]), [["10", "20"], ["20", "30"]]);
  assert.equal(project.statistics.sequenceVariables, 1);
  assert.equal(project.statistics.sequenceTransitions, 2);
});

test("v11 attaches timer .DN and task-root context without proving timer completion or execution", () => {
  const project = analyzer.parseL5K(fixture({ unanchored: false }));
  const step = project.dependencies.sequenceTopology.variables[0];
  const transition = step.transitions.find((item) => item.from === "20" && item.to === "30");
  assert.ok(transition);
  assert.equal(transition.timerDoneGates.length, 1);
  assert.equal(transition.timerDoneGates[0].tag, "DelayTimer");
  assert.equal(transition.timerDoneGates[0].sense, "done-true");
  assert.ok(transition.timerDoneGates[0].numericPresetEvidence.includes(500));
  assert.equal(transition.timerDoneGates[0].runtimeDoneStateProven, false);
  assert.equal(transition.taskRootReachable, true);
  assert.equal(transition.runtimeExecutionProven, false);
  assert.equal(transition.runtimeStateProven, false);
  assert.match(project.dependencies.sequenceTopology.sourceBoundary, /does not simulate the PLC/i);
});

test("v11 preserves unanchored numeric state assignments without inventing a source state", () => {
  const project = analyzer.parseL5K(fixture());
  const step = project.dependencies.sequenceTopology.variables[0];
  assert.equal(step.unanchoredAssignments.length, 1);
  assert.equal(step.unanchoredAssignments[0].instruction, "CLR");
  assert.equal(step.unanchoredAssignments[0].state, "0");
  assert.equal(step.transitions.some((item) => item.to === "0"), false);
  const finding = sequenceFindings(project).find((item) => item.id.includes("unanchored-state-assignments"));
  assert.ok(finding);
  assert.equal(finding.severity, "info");
  assert.match(finding.summary, /does not invent a source state/i);
});

test("v11 reports multiple source-visible targets from one state only as a review cue", () => {
  const project = analyzer.parseL5K(fixture({ branches: true, unanchored: false }));
  const finding = sequenceFindings(project).find((item) => item.id.includes("multiple-targets") && /:30$/.test(item.id));
  assert.ok(finding);
  assert.equal(finding.classification, "static-inference");
  assert.equal(finding.severity, "review");
  assert.deepEqual(finding.evidence.targets.sort(), ["40", "50"]);
  assert.match(finding.summary, /branching can be intentional/i);
  assert.match(finding.summary, /rather than treating this as a defect/i);
});

test("v11 identifies source-visible gated/assigned state gaps without declaring dead states", () => {
  const project = analyzer.parseL5K(fixture({ entryGate: true, unanchored: false }));
  const findings = sequenceFindings(project);
  const assignedNotGated = findings.find((item) => item.id.includes("assigned-state-not-gated"));
  const gatedNotAssigned = findings.find((item) => item.id.includes("gated-state-not-assigned"));
  assert.ok(assignedNotGated);
  assert.ok(gatedNotAssigned);
  assert.ok(assignedNotGated.evidence.states.includes("30"));
  assert.ok(gatedNotAssigned.evidence.states.includes("5"));
  assert.match(assignedNotGated.summary, /terminal\/reset states|other languages|external writes/i);
  assert.match(gatedNotAssigned.summary, /startup values|external writes|protected logic/i);
  assert.doesNotMatch(`${assignedNotGated.summary} ${gatedNotAssigned.summary}`, /dead state/i);
});

test("v11 normalizes Rockwell radix numeric state literals for matching", () => {
  const text = `RSLogix 5000 Export Version 20.01
CONTROLLER RadixSequence
PROGRAM P (MAIN := Main)
TAG
Step : DINT;
END_TAG
ROUTINE Main
RUNG 0
N: EQU(Step,16#0A)MOV(16#14,Step);
END_RUNG
END_ROUTINE
END_PROGRAM
TASK MainTask (Type := CONTINUOUS)
P;
END_TASK
END_CONTROLLER`;
  const project = analyzer.parseL5K(text);
  const step = project.dependencies.sequenceTopology.variables[0];
  assert.ok(step);
  assert.deepEqual(step.transitions.map((item) => [item.from, item.to]), [["10", "20"]]);
  assert.equal(step.transitions[0].fromLiteral, "16#0A");
  assert.equal(step.transitions[0].toLiteral, "16#14");
});

test("v11 search exposes sequence transitions as openable rung evidence", () => {
  const project = analyzer.parseL5K(fixture({ unanchored: false }));
  const results = analyzer.searchAnalysis(project, "Step", 30);
  const sequence = results.find((item) => item.type === "rung" && /state 10 → 20/.test(item.title));
  assert.ok(sequence);
  assert.equal(sequence.key, "P/Main/0");
  assert.match(sequence.source, /EQU\(Step,10\).*MOV\(20,Step\)/);
});

test("v11 preserves legacy neutral-N parsing while adding sequence topology", () => {
  const legacy = `Version := RSLogix 5000 v15.02
CONTROLLER LegacySequence
PROGRAM P (MAIN := Main)
TAG
Step : DINT;
END_TAG
ROUTINE Main
N: EQU(Step,10)MOV(20,Step);
N: EQU(Step,20)MOV(30,Step);
END_ROUTINE
END_PROGRAM
TASK MainTask (Type := Continuous)
P;
END_TASK
END_CONTROLLER`;
  const project = analyzer.parseL5K(legacy);
  assert.equal(project.exportVersion, "15.02");
  assert.equal(project.source.ladderEncoding, "legacy-neutral-N");
  assert.equal(project.dependencies.sequenceTopology.version, "v11");
  assert.deepEqual(project.dependencies.sequenceTopology.variables[0].transitions.map((item) => [item.from, item.to]), [["10", "20"], ["20", "30"]]);
});

test("v11 page and worker remain browser-local/read-only and load after v10", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-sequence-v11.js"), "utf8");
  const v10 = page.indexOf("l5k-analyzer-consistency-v10.js?v=10");
  const v11 = page.indexOf("l5k-analyzer-sequence-v11.js?v=11");
  assert.ok(v10 >= 0 && v11 > v10);
  assert.match(page, /v11 SEQUENCE TOPOLOGY/);
  assert.match(page, /static sequence graph/i);
  assert.match(worker, /l5k-analyzer-consistency-v10\.js\?v=10/);
  assert.match(worker, /l5k-analyzer-sequence-v11\.js\?v=11/);
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-worker\.js\?v=11"\)/);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(page, /connect to PLC|write to PLC|force PLC/i);
});
