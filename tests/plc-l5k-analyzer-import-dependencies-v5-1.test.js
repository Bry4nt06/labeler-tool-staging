"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-dependencies-v5.js"));
const baseAnalyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-core.js"));
const importer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-import-dependencies-v5-1.js"));

const fixture = `RSLogix 5000 Export Version 20.01
CONTROLLER Import_Dependency_Test
  DATATYPE DeviceState
    BOOL Ready;
  END_DATATYPE
  TAG
    InputA : BOOL;
    Intermediate : BOOL;
    Device : DeviceState;
    Faults : DINT[2];
  END_TAG
  PROGRAM MainProgram (MAIN := MainRoutine)
    ROUTINE MainRoutine
      RUNG 0
        N: JSR(FaultRoutine);
      END_RUNG
    END_ROUTINE
    ROUTINE FaultRoutine
      RUNG 0
        N: XIC(InputA)OTE(Intermediate);
      END_RUNG
      RUNG 1
        N: XIC(Intermediate)XIC(Device.Ready)OTL(Faults[0].1);
      END_RUNG
      RUNG 2
        N: XIC(InputA)OTE(Faults[0].2);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER
`;

test("v5.1 attaches bounded dependency evidence without changing exact coverage status", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "dependency-import.L5K" });
  const library = [{ id: "covered", source: { producer: "Faults[0].1" } }];
  const queue = importer.buildImportQueue(project, library, { libraryAvailable: true });
  const covered = queue.candidates.find((candidate) => candidate.target === "Faults[0].1");
  const review = queue.candidates.find((candidate) => candidate.target === "Faults[0].2");

  assert.equal(covered.coverageStatus, "covered-exact-source-reference");
  assert.equal(review.coverageStatus, "review-candidate");
  assert.equal(queue.dependencyEvidenceVersion, "v5.1");
  assert.equal(queue.statistics.dependencyTraced, 2);
  assert.ok(covered.dependencyEvidence);
  assert.equal(covered.dependencyEvidence.runtimeStateProven, false);
  assert.equal(covered.dependencyEvidence.classification, "static-inference");
});

test("v5.1 draft includes upstream intermediate tags and UDT member typing", () => {
  const project = analyzer.parseL5K(fixture);
  const queue = importer.buildImportQueue(project, [], { libraryAvailable: true });
  const candidate = queue.candidates.find((item) => item.target === "Faults[0].1");
  assert.ok(candidate);

  const intermediate = candidate.dependencyEvidence.upstreamSymbols.find((node) => node.symbol === "Intermediate");
  assert.ok(intermediate);
  assert.ok(intermediate.depth >= 1);

  const udt = candidate.dependencyEvidence.upstreamSymbols.find((node) => node.symbol === "Device.Ready");
  assert.ok(udt);
  assert.equal(udt.kind, "udt-member");
  assert.equal(udt.dataTypeDefinition, "DeviceState");
  assert.equal(udt.memberDataType, "BOOL");

  assert.deepEqual(candidate.draft.dependencyEvidence, candidate.dependencyEvidence);
  assert.equal(candidate.draft.alarmCode, null);
  assert.equal(candidate.draft.alarmText, null);
  assert.equal(candidate.draft.title, null);
});

test("v5.1 draft carries source-visible JSR path toward MAIN while preserving runtime boundary", () => {
  const project = analyzer.parseL5K(fixture);
  const queue = importer.buildImportQueue(project, [], { libraryAvailable: true });
  const candidate = queue.candidates.find((item) => item.target === "Faults[0].1");
  const paths = candidate.dependencyEvidence.executionPaths.flatMap((group) => group.paths || []);
  assert.ok(paths.some((pathItems) => pathItems.some((step) => step.routine === "MainRoutine" && step.main)));
  assert.ok(paths.some((pathItems) => pathItems.some((step) => step.routine === "FaultRoutine")));
  assert.match(candidate.dependencyEvidence.sourceBoundary, /does not prove live tag values/i);
  assert.ok(candidate.draft.unresolvedFields.includes("live values/states for dependency symbols"));
});

test("v5.1 review export retains dependency evidence and remains review-only", () => {
  const project = analyzer.parseL5K(fixture);
  const queue = importer.buildImportQueue(project, [{ source: "Faults[0].1" }], { libraryAvailable: true });
  const exported = importer.exportReviewQueue(queue, { generatedAt: "2026-09-05T02:00:00.000Z" });
  assert.equal(exported.publicationState, "review-only");
  assert.ok(exported.candidates.every((candidate) => candidate.exactPlcTarget !== "Faults[0].1"));
  const review = exported.candidates.find((candidate) => candidate.exactPlcTarget === "Faults[0].2");
  assert.ok(review);
  assert.ok(review.dependencyEvidence);
  assert.equal(review.dependencyEvidence.runtimeStateProven, false);
  assert.equal(review.status, "draft-sme-review-required");
});

test("v5.1 remains compatible with a project parsed before dependency enrichment", () => {
  const project = baseAnalyzer.parseL5K(fixture);
  assert.equal(project.dependencies, undefined);
  const queue = importer.buildImportQueue(project, [], { libraryAvailable: true });
  assert.ok(queue.candidates.length >= 2);
  assert.equal(queue.statistics.dependencyTraced, 0);
  assert.ok(queue.candidates.every((candidate) => candidate.dependencyEvidence === undefined));
  assert.ok(queue.candidates.every((candidate) => candidate.coverageStatus === "review-candidate"));
});

test("v5.1 Import Assistant loads dependency parser before wrapper and keeps analysis local", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/import.html"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-import-v5-1.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-import-dependencies-v5-1.js"), "utf8");

  const dependencies = page.indexOf("l5k-analyzer-dependencies-v5.js?v=5");
  const baseImport = page.indexOf("l5k-analyzer-import.js?v=3");
  const wrapper = page.indexOf("l5k-analyzer-import-dependencies-v5-1.js?v=5.1");
  const uiScript = page.indexOf("plc-analyzer-import-v5-1.js?v=5.1");
  assert.ok(dependencies >= 0 && dependencies < baseImport && baseImport < wrapper && wrapper < uiScript);
  assert.match(page, /PLC IMPORT ASSISTANT v5\.1 — DEPENDENCY EVIDENCE/);
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-worker\.js\?v=5"\)/);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.match(page, /Dependency traces are static source inference/i);
});
