"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const importer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-import-structural-evidence-v8.js"));
const importHtml = fs.readFileSync(path.join(root, "app/plc-analyzer/import.html"), "utf8");
const overlaySource = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-import-structural-overlay-v8.js"), "utf8");

function syntheticProject() {
  return {
    controller: "Example_Controller",
    exportVersion: "RSLogix 5000 v15.02",
    source: { fileName: "Example_Controller.L5K" },
    faultWriters: [{
      target: "PlantFaults[43].12",
      writers: [{
        instruction: "OTE",
        program: "FaultLogic",
        routine: "FaultLogic_Jumps",
        rung: 5,
        startLine: 100,
        source: "AFI() XIC(GuardDoorClosed) OTE(PlantFaults[43].12);",
        symbols: ["GuardDoorClosed", "PlantFaults[43].12"]
      }],
      resets: []
    }],
    timers: [],
    counters: [],
    motionReferences: [],
    axes: [],
    dependencies: {
      interlockTopology: {
        actionPaths: [{
          target: "PlantFaults[43].12",
          actionInstruction: "OTE",
          actionKind: "output-write",
          program: "FaultLogic",
          routine: "FaultLogic_Jumps",
          rung: 5,
          line: 100,
          gates: [{ kind: "contact", instruction: "XIC", symbol: "GuardDoorClosed", sense: "true-required", args: ["GuardDoorClosed"] }],
          selfHoldCandidate: false,
          taskRootReachable: true
        }]
      },
      resetRecoveryTopology: {
        paths: [{
          target: "PlantFaults[43].12",
          instruction: "OTU",
          recoveryKind: "unlatch",
          targetClass: "unlatch",
          program: "FaultLogic",
          routine: "FaultReset",
          rung: 2,
          line: 220,
          gates: [{ kind: "contact", instruction: "XIC", symbol: "ResetPB", sense: "true-required-source-condition", args: ["ResetPB"] }],
          taskRootReachable: true
        }],
        relationships: [{
          target: "PlantFaults[43].12",
          latchWriterCount: 1,
          unlatchPathCount: 1,
          sourcePairLocated: true
        }]
      }
    },
    afiReferences: [{
      instruction: "AFI",
      program: "FaultLogic",
      routine: "FaultLogic_Jumps",
      rung: 5,
      line: 100,
      classification: "source-proven",
      runtimeStateProven: false
    }]
  };
}

test("Import v8 enriches a fault candidate with bounded v12/v13/v14 structural evidence", () => {
  const queue = importer.buildImportQueue(syntheticProject(), [], { libraryAvailable: false, controllerIdentity: { expectedControllerId: "other", sourceStatus: "backup" } });
  assert.equal(queue.importEvidenceVersion, "v8");
  assert.equal(queue.candidates.length, 1);
  const candidate = queue.candidates[0];
  assert.equal(candidate.structuralEvidence.authority, "static-site-structure-only");
  assert.equal(candidate.structuralEvidence.interlock.pathCount, 1);
  assert.equal(candidate.structuralEvidence.interlock.gateSymbols[0], "GuardDoorClosed");
  assert.equal(candidate.structuralEvidence.interlock.runtimeGateStateProven, false);
  assert.equal(candidate.structuralEvidence.interlock.booleanBranchSemanticsProven, false);
  assert.equal(candidate.structuralEvidence.recovery.sourcePairLocated, true);
  assert.equal(candidate.structuralEvidence.recovery.causeClearedProven, false);
  assert.equal(candidate.structuralEvidence.recovery.safeToResetProven, false);
  assert.equal(candidate.structuralEvidence.afi.sameWriterRungCount, 1);
  assert.equal(candidate.structuralEvidence.afi.causeProven, false);
  assert.equal(candidate.structuralEvidence.afi.wholeRoutineDisabledProven, false);
  assert.equal(queue.statistics.interlockEnriched, 1);
  assert.equal(queue.statistics.recoveryEnriched, 1);
  assert.equal(queue.statistics.afiWriterRungCandidates, 1);
});

test("AFI evidence is only associated when program, routine, and rung match a candidate writer", () => {
  const project = syntheticProject();
  project.afiReferences = [{ instruction: "AFI", program: "FaultLogic", routine: "DifferentRoutine", rung: 5, line: 100, classification: "source-proven" }];
  const queue = importer.buildImportQueue(project, [], { libraryAvailable: false });
  assert.equal(queue.candidates[0].structuralEvidence?.afi || null, null);
  assert.equal(queue.statistics.afiWriterRungCandidates, 0);
});

test("v8 draft boundary never promotes static gates, recovery, or AFI evidence to runtime truth", () => {
  const queue = importer.buildImportQueue(syntheticProject(), [], { libraryAvailable: false });
  const text = JSON.stringify(queue.candidates[0].draft);
  assert.match(text, /does not prove current gate values|does not prove live gate state/i);
  assert.match(text, /reset.*safe|reset safety/i);
  assert.match(text, /AFI.*caus/i);
  assert.doesNotMatch(text, /GuardDoorClosed is false|reset is safe|AFI caused/i);
});

test("v8 structural overlay preserves nested import writer locations and structural evidence", () => {
  const listeners = {};
  const window = {
    addEventListener(name, handler) { listeners[name] = handler; },
    sessionStorage: { setItem() {}, getItem() { return null; } },
    location: { href: "" },
    ServoForgePLCImportControllerIntake: { getLastQueue() { return null; }, readIdentity() { return {}; } }
  };
  const document = { addEventListener() {} };
  vm.runInNewContext(overlaySource, { window, document, console });
  const api = window.ServoForgePLCImportStructuralOverlay;
  assert.ok(api);
  const compact = api.compactCandidate({
    target: "PlantFaults[43].12",
    writers: [{ instruction: "OTE", location: { program: "FaultLogic", routine: "FaultLogic_Jumps", rung: 5, line: 100 }, symbols: ["GuardDoorClosed"] }],
    structuralEvidence: importer.buildImportQueue(syntheticProject(), [], { libraryAvailable: false }).candidates[0].structuralEvidence
  });
  assert.equal(compact.writers[0].program, "FaultLogic");
  assert.equal(compact.writers[0].routine, "FaultLogic_Jumps");
  assert.equal(compact.writers[0].rung, 5);
  assert.equal(compact.writers[0].line, 100);
  assert.equal(compact.structuralEvidence.afi.sameWriterRungCount, 1);
  assert.equal(compact.structuralEvidence.recovery.safeToResetProven, false);
});

test("Import Assistant v8 loads structural enrichment before carryover and preserves the v14 worker path", () => {
  const engine = importHtml.indexOf("l5k-analyzer-import-structural-evidence-v8.js");
  const controllerUi = importHtml.indexOf("plc-analyzer-import-controller-v6.js");
  const overlay = importHtml.indexOf("plc-analyzer-import-structural-overlay-v8.js");
  const importUi = importHtml.indexOf("plc-analyzer-import-v5-1.js");
  assert.ok(engine >= 0 && controllerUi > engine && overlay > controllerUi && importUi > overlay);
  assert.match(importHtml, /PLC IMPORT ASSISTANT v8 — STRUCTURAL SITE EVIDENCE • UNIVERSAL ROUTING/);
  assert.match(importHtml, /embeddedCoverageBridge=v373/);
  assert.match(importHtml, /v12–v14 structural evidence/);
  assert.match(overlaySource, /v2-structural-v8/);
  assert.match(overlaySource, /static-site-structure-only/);
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
  assert.match(worker, /l5k-analyzer-interlocks-v12\.js/);
  assert.match(worker, /l5k-analyzer-recovery-v13\.js/);
  assert.match(worker, /l5k-analyzer-afi-v14\.js/);
});
