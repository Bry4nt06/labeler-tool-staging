"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-dependencies-v5.js"));
const importer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-import-controller-v6.js"));

const fixture = `RSLogix 5000 Export Version 20.01
CONTROLLER Parsed_Controller_Name
  TAG
    InputA : BOOL;
    Faults : DINT[2];
  END_TAG
  PROGRAM MainProgram (MAIN := MainRoutine)
    ROUTINE MainRoutine
      RUNG 0
        N: XIC(InputA)OTL(Faults[0].1);
      END_RUNG
      RUNG 1
        N: XIO(InputA)OTU(Faults[0].1);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER
`;

test("v6 exposes the exact 13-controller intake inventory in requested processing order", () => {
  const controllers = importer.getExpectedControllers();
  assert.equal(controllers.length, 13);
  assert.equal(controllers[0].id, "lb1-labeler-1");
  assert.equal(controllers[0].priority, 1);
  assert.deepEqual(controllers.filter((item) => item.line === "LB1" && item.role === "APL Cart").map((item) => item.station), ["Cart 2", "Cart 3", "Cart 4", "Cart 5", "Cart 6"]);
  assert.equal(controllers.find((item) => item.id === "lb2-labeler-2")?.priority, 3);
  assert.deepEqual(controllers.filter((item) => item.line === "LB2" && item.role === "APL Cart").map((item) => item.station), ["Cart 1", "Cart 2", "Cart 3", "Cart 4", "Cart 5", "Cart 6"]);
});

test("v6 keeps operator-selected physical identity separate from parsed controller/file names", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "whatever-the-export-was-called.L5K" });
  const identity = importer.normalizeControllerIdentity({
    expectedControllerId: "lb1-labeler-1",
    sourceStatus: "current-production",
    controllerRevision: "Rev A",
    firmwareRevision: "20.01",
    exportDate: "2026-09-06",
    notes: "Verified against the production project before export."
  }, project);
  assert.equal(identity.displayName, "LB1 Labeler 1");
  assert.equal(identity.line, "LB1");
  assert.equal(identity.role, "Labeler");
  assert.equal(identity.station, "Labeler 1");
  assert.equal(identity.mappingStatus, "inventory-mapped");
  assert.equal(identity.sourceStatus, "current-production");
  assert.equal(identity.parsedController, "Parsed_Controller_Name");
  assert.equal(identity.sourceFile, "whatever-the-export-was-called.L5K");
  assert.equal(identity.inferredFromFileName, false);
  assert.equal(identity.runtimeProgramProven, false);
});

test("v6 carries controller identity through queue, every candidate draft, and review export", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "lb1-labeler.L5K" });
  const queue = importer.buildImportQueue(project, [], {
    libraryAvailable: true,
    controllerIdentity: {
      expectedControllerId: "lb1-labeler-1",
      sourceStatus: "backup",
      controllerRevision: "saved-copy-01",
      exportDate: "2026-09-06"
    }
  });
  assert.equal(queue.controllerIntakeVersion, "v6");
  assert.equal(queue.controllerIdentity.displayName, "LB1 Labeler 1");
  assert.equal(queue.project.controllerIdentity.sourceStatus, "backup");
  assert.equal(queue.statistics.controllerInventoryMapped, 1);
  assert.equal(queue.statistics.controllerSourceStatusConfirmed, 1);
  assert.ok(queue.candidates.length >= 1);
  assert.ok(queue.candidates.every((candidate) => candidate.controllerIdentity.displayName === "LB1 Labeler 1"));
  assert.ok(queue.candidates.every((candidate) => candidate.draft.controllerIdentity.sourceStatus === "backup"));

  const exported = importer.exportReviewQueue(queue, { generatedAt: "2026-09-06T16:30:00.000Z" });
  assert.equal(exported.schema, "servoforge-plc-import-review-v2");
  assert.equal(exported.controllerIntakeVersion, "v6");
  assert.equal(exported.publicationState, "review-only");
  assert.equal(exported.controllerIdentity.expectedControllerId, "lb1-labeler-1");
  assert.equal(exported.sourceProject.controllerIdentity.controllerRevision, "saved-copy-01");
  assert.ok(exported.candidates.every((draft) => draft.controllerIdentity.displayName === "LB1 Labeler 1"));
});

test("v6 preserves explicit unresolved mapping/status as review fields instead of inferring identity", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "LB2_Cart6_maybe.L5K" });
  const queue = importer.buildImportQueue(project, [], {
    libraryAvailable: true,
    controllerIdentity: { expectedControllerId: "other", sourceStatus: "unknown" }
  });
  assert.equal(queue.controllerIdentity.mappingStatus, "explicit-unresolved");
  assert.equal(queue.controllerIdentity.identityConfidence, "explicitly-unresolved");
  assert.equal(queue.controllerIdentity.line, null);
  assert.equal(queue.controllerIdentity.station, null);
  assert.equal(queue.controllerIdentity.inferredFromFileName, false);
  const unresolved = queue.candidates[0].draft.unresolvedFields.join(" | ");
  assert.match(unresolved, /physical controller mapping remains unresolved/i);
  assert.match(unresolved, /current production program, a backup, or an older revision/i);
  assert.match(queue.candidates[0].draft.sourceBoundary, /does not infer the physical machine from the file name/i);
});

test("v6 sanitizes optional intake metadata and does not accept arbitrary source-status values", () => {
  const identity = importer.normalizeControllerIdentity({
    expectedControllerId: "lb2-apl-cart-4",
    sourceStatus: "definitely-live",
    controllerRevision: "  rev   22  ",
    exportDate: "09/06/2026",
    notes: "  note   with   spacing  "
  }, {});
  assert.equal(identity.sourceStatus, "unknown");
  assert.equal(identity.controllerRevision, "rev 22");
  assert.equal(identity.exportDate, null);
  assert.equal(identity.notes, "note with spacing");
});

test("v6 intake remains present as later portable Import Assistant phases advance", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/import.html"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-import-controller-v6.js"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-import-controller-v6.js"), "utf8");
  const versionMatch = /PLC IMPORT ASSISTANT v(\d+)/.exec(page);
  assert.ok(versionMatch, "Import Assistant version banner missing");
  assert.ok(Number(versionMatch[1]) >= 6, `expected Import Assistant v6 or later, got v${versionMatch?.[1]}`);
  assert.match(page, /id="plcImportControllerSlot"/);
  assert.match(page, /id="plcImportSourceStatus"/);
  assert.match(page, /id="plcImportControllerRevision"/);
  assert.match(page, /id="plcImportFirmwareRevision"/);
  assert.match(page, /id="plcImportExportDate"/);
  assert.match(page, /id="plcImportIdentityNotes"/);
  assert.match(page, /accept="\.l5k,\.L5K,text\/plain"/);
  assert.match(page, /L5X support requires a separate parser path and is not enabled/i);
  assert.doesNotMatch(page, /accept="[^"]*\.l5x/i);

  const baseImport = page.indexOf("l5k-analyzer-import.js?v=3");
  const dependencyImport = page.indexOf("l5k-analyzer-import-dependencies-v5-1.js?v=5.1");
  const intakeEngine = page.indexOf("l5k-analyzer-import-controller-v6.js?v=6");
  const structuralEngine = page.indexOf("l5k-analyzer-import-structural-evidence-v8.js?v=");
  const intakeUi = page.indexOf("plc-analyzer-import-controller-v6.js?v=");
  const structuralOverlay = page.indexOf("plc-analyzer-import-structural-overlay-v8.js?v=");
  const existingUi = page.indexOf("plc-analyzer-import-v5-1.js?v=");
  assert.ok(baseImport >= 0 && baseImport < dependencyImport && dependencyImport < intakeEngine && intakeEngine < intakeUi && intakeUi < existingUi);
  if (structuralEngine >= 0 || structuralOverlay >= 0) {
    assert.ok(structuralEngine > intakeEngine && structuralEngine < intakeUi);
    assert.ok(structuralOverlay > intakeUi && structuralOverlay < existingUi);
  }
  assert.match(ui, /analyzeButton\.disabled = !ready/);
  assert.match(ui, /resetIdentity\(\)/);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.match(page, /review candidate, not proof/i);
  assert.match(page, /Dependency traces[\s\S]*static source/i);
});
