"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-discrepancies-v6.js"));

function projectFixture(options = {}) {
  const mainName = options.mainName || "MainRoutine";
  const mainRoutineDeclaration = options.omitDeclaredMainRoutine
    ? ""
    : `    ROUTINE MainRoutine\n      RUNG 0\n        N: JSR(FaultRoutine);${options.missingJsr ? " JSR(MissingRoutine);" : ""}\n      END_RUNG\n    END_ROUTINE`;
  const faultCall = options.cycle ? " JSR(MainRoutine);" : "";
  const unreachableFault = options.unreachableFault
    ? `\n    ROUTINE UnusedFaultRoutine\n      RUNG 0\n        N: XIC(InputA)OTL(Faults[0].2);\n      END_RUNG\n    END_ROUTINE`
    : "";
  const unused = options.includeUnused
    ? `\n    ROUTINE SpareRoutine\n      RUNG 0\n        N: XIC(InputA)OTE(OutputA);\n      END_RUNG\n    END_ROUTINE`
    : "";
  return `RSLogix 5000 Export Version 20.01
CONTROLLER CallGraph_Test
  TAG
    InputA : BOOL;
    OutputA : BOOL;
    Faults : DINT[2];
  END_TAG
  PROGRAM P (MAIN := ${mainName})
${mainRoutineDeclaration}
    ROUTINE FaultRoutine
      RUNG 0
        N: XIC(InputA)OTL(Faults[0].1);${faultCall}
      END_RUNG
    END_ROUTINE${unreachableFault}${unused}
  END_PROGRAM
END_CONTROLLER
`;
}

function v6Findings(project) {
  return (project.findings || []).filter((finding) => finding.sourceRule === "plc-callgraph-discrepancies-v6");
}

test("v6 does not report MAIN/JSR reachability problems for a simple valid call graph", () => {
  const project = analyzer.parseL5K(projectFixture());
  const findings = v6Findings(project);
  assert.equal(findings.some((finding) => /main-target-missing|jsr-target-missing|call-cycle|fault-writers-not-main-reachable/.test(finding.id)), false);
  assert.equal(project.dependencies.discrepancyAnalysis.version, "v6");
  assert.equal(project.statistics.callGraphFindings, findings.length);
});

test("v6 reports PROGRAM MAIN target absent from the supplied export without calling it a machine defect", () => {
  const project = analyzer.parseL5K(projectFixture({ mainName: "MissingMain", omitDeclaredMainRoutine: false }));
  const finding = v6Findings(project).find((item) => item.id === "v6:main-target-missing:P:MissingMain");
  assert.ok(finding);
  assert.equal(finding.classification, "source-proven");
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /supplied export/i);
  assert.match(finding.summary, /verify project completeness/i);
});

test("v6 reports JSR targets not present in the same program", () => {
  const project = analyzer.parseL5K(projectFixture({ missingJsr: true }));
  const finding = v6Findings(project).find((item) => item.id.includes("v6:jsr-target-missing") && item.title.includes("MissingRoutine"));
  assert.ok(finding);
  assert.equal(finding.classification, "source-proven");
  assert.equal(finding.severity, "review");
  assert.equal(finding.evidence.call.calleeRoutine, "MissingRoutine");
});

test("v6 detects a source-visible JSR call cycle as static inference", () => {
  const project = analyzer.parseL5K(projectFixture({ cycle: true }));
  const finding = v6Findings(project).find((item) => item.id.startsWith("v6:call-cycle:"));
  assert.ok(finding);
  assert.equal(finding.classification, "static-inference");
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /not proof of an executing recursion fault/i);
  assert.ok(finding.evidence.cycle.path.some((value) => value === "P/MainRoutine"));
  assert.ok(finding.evidence.cycle.path.some((value) => value === "P/FaultRoutine"));
});

test("v6 groups routines that are not source-reachable from identified MAIN as informational review cues", () => {
  const project = analyzer.parseL5K(projectFixture({ includeUnused: true }));
  const finding = v6Findings(project).find((item) => item.id === "v6:routines-not-main-reachable:P");
  assert.ok(finding);
  assert.equal(finding.classification, "static-inference");
  assert.equal(finding.severity, "info");
  assert.ok(finding.evidence.routines.some((routine) => routine.name === "SpareRoutine"));
  assert.match(finding.summary, /review cue, not a defect finding/i);
});

test("v6 escalates a fault writer outside the source-visible MAIN graph to review without calling it dead logic", () => {
  const project = analyzer.parseL5K(projectFixture({ unreachableFault: true }));
  const finding = v6Findings(project).find((item) => item.id === "v6:fault-writers-not-main-reachable");
  assert.ok(finding);
  assert.equal(finding.classification, "static-inference");
  assert.equal(finding.severity, "review");
  assert.ok(finding.evidence.writers.some((writer) => writer.target === "Faults[0].2" && writer.writer.routine === "UnusedFaultRoutine"));
  assert.match(finding.summary, /does not prove the faults are dead/i);
});

test("v6 detects AOI instance type mismatch only when both invocation and declaration are source-visible", () => {
  const source = `RSLogix 5000 Export Version 20.01
CONTROLLER AOI_Mismatch
  ADD_ON_INSTRUCTION_DEFINITION DemoAOI
    PARAMETERS
      Enable : BOOL (Usage := Input);
    END_PARAMETERS
  END_ADD_ON_INSTRUCTION_DEFINITION
  TAG
    WrongInstance : DINT;
    InputA : BOOL;
  END_TAG
  PROGRAM P (MAIN := Main)
    ROUTINE Main
      RUNG 0
        N: DemoAOI(WrongInstance,InputA);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER`;
  const project = analyzer.parseL5K(source);
  const finding = v6Findings(project).find((item) => item.id.startsWith("v6:aoi-instance-type:"));
  assert.ok(finding);
  assert.equal(finding.classification, "source-proven");
  assert.equal(finding.evidence.declaredType, "DINT");
  assert.equal(finding.evidence.expectedType, "DemoAOI");
});

test("v6 remains compatible with legacy neutral N rungs and preserves v5 dependencies", () => {
  const legacy = `Version := RSLogix 5000 v15.02
CONTROLLER Legacy_V6
TAG
InputA : BOOL;
Faults : DINT[1];
END_TAG
PROGRAM P (MAIN := Main)
ROUTINE Main
N: JSR(FaultRoutine);
END_ROUTINE
ROUTINE FaultRoutine
N: XIC(InputA)OTL(Faults[0].1);
END_ROUTINE
END_PROGRAM
END_CONTROLLER`;
  const project = analyzer.parseL5K(legacy);
  assert.equal(project.exportVersion, "15.02");
  assert.equal(project.source.ladderEncoding, "legacy-neutral-N");
  assert.equal(project.statistics.rungs, 2);
  assert.equal(project.dependencies.version, "v5");
  assert.equal(project.dependencies.routineCalls.length, 1);
  assert.equal(v6Findings(project).some((finding) => finding.id === "v6:fault-writers-not-main-reachable"), false);
});

test("v6 page and worker preserve local/read-only source-review boundaries", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-discrepancies-v6.js"), "utf8");
  assert.match(page, /PLC ANALYZER v6 — CALL-GRAPH REVIEW/);
  assert.match(page, /l5k-analyzer-discrepancies-v6\.js\?v=6/);
  assert.match(worker, /l5k-analyzer-discrepancies-v6\.js\?v=6/);
  assert.match(page, /Call-graph reachability uses source-visible PROGRAM MAIN and JSR relationships only/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(page, /connect to PLC|write to PLC|force PLC/i);
});
