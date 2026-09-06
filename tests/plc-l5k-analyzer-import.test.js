"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-core.js"));
const importer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-import.js"));

const fixture = `
RSLogix 5000 Export Version 15.02
CONTROLLER Import_Test
  TAG
    StartCondition : BOOL := 0;
    ResetGeneral : BOOL := 0;
    TON_Verify : TIMER;
    CountPseudo : DINT := 0;
    AxisOne : AXIS_SERVO;
  END_TAG
  PROGRAM FaultLogic
    ROUTINE Main (Type := RLL)
      RUNG 0
        N: XIC(StartCondition)TON(TON_Verify,250,0)XIC(TON_Verify.DN)OTL(Faults[1].13);
      END_RUNG
      RUNG 1
        N: XIC(ResetGeneral)OTU(Faults[1].13);
      END_RUNG
      RUNG 2
        N: XIC(AxisOne.FeedbackFault)OTE(Faults[4].3);
      END_RUNG
      RUNG 3
        N: ADD(CountPseudo,1,CountPseudo)GRT(CountPseudo,500)OTE(Faults[5].1);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER
`;

test("v3 exact PLC target references are marked covered without fuzzy inference", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "import.L5K" });
  const library = [
    { id: "existing-record", code: "123", title: "Existing", source: { producer: "Faults[1].13" } },
    { id: "unrelated", title: "Feedback help", summary: "generic feedback fault wording" }
  ];
  const queue = importer.buildImportQueue(project, library, { libraryAvailable: true });
  const covered = queue.candidates.find((candidate) => candidate.target === "Faults[1].13");
  const unmatched = queue.candidates.find((candidate) => candidate.target === "Faults[4].3");
  assert.equal(covered.coverageStatus, "covered-exact-source-reference");
  assert.equal(covered.coverageMatches[0].id, "existing-record");
  assert.equal(unmatched.coverageStatus, "review-candidate");
  assert.equal(unmatched.coverageMatches.length, 0);
});

test("v3 does not call unmatched source targets definitively missing", () => {
  const project = analyzer.parseL5K(fixture);
  const queue = importer.buildImportQueue(project, [], { libraryAvailable: true });
  assert.ok(queue.candidates.every((candidate) => candidate.coverageStatus === "review-candidate"));
  assert.doesNotMatch(JSON.stringify(queue), /definitively missing|confirmed missing/i);
});

test("v3 marks coverage unverified when the current library bridge is unavailable", () => {
  const project = analyzer.parseL5K(fixture);
  const queue = importer.buildImportQueue(project, [], { libraryAvailable: false });
  assert.equal(queue.statistics.coverageUnverified, queue.statistics.totalFaultTargets);
  assert.ok(queue.candidates.every((candidate) => candidate.coverageStatus === "coverage-unverified"));
});

test("v3 draft preserves producer/reset/timer/motion evidence and leaves alarm identity unresolved", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "import.L5K" });
  const queue = importer.buildImportQueue(project, [], { libraryAvailable: true });
  const candidate = queue.candidates.find((item) => item.target === "Faults[1].13");
  assert.ok(candidate);
  assert.equal(candidate.writers[0].instruction, "OTL");
  assert.equal(candidate.resets[0].instruction, "OTU");
  assert.ok(candidate.relatedTimers.some((timer) => timer.tag === "TON_Verify" && timer.presetValues.includes("250")) || candidate.relatedTimers.some((timer) => timer.tag === "TON_Verify" && timer.presetValues.includes(250)));
  assert.equal(candidate.draft.alarmCode, null);
  assert.equal(candidate.draft.alarmText, null);
  assert.equal(candidate.draft.title, null);
  assert.match(candidate.draft.sourceBoundary, /SME verifies alarm identity/i);

  const motion = queue.candidates.find((item) => item.target === "Faults[4].3");
  assert.ok(motion.motionReferences.length >= 1);
});

test("v3 review export excludes already-covered records by default and remains review-only", () => {
  const project = analyzer.parseL5K(fixture);
  const library = [{ id: "existing", source: "Faults[1].13" }];
  const queue = importer.buildImportQueue(project, library, { libraryAvailable: true });
  const exported = importer.exportReviewQueue(queue, { generatedAt: "2026-09-05T00:00:00.000Z" });
  assert.equal(exported.schema, "servoforge-plc-import-review-v1");
  assert.equal(exported.publicationState, "review-only");
  assert.ok(exported.candidates.every((draft) => draft.exactPlcTarget !== "Faults[1].13"));
  assert.ok(exported.candidates.every((draft) => draft.status === "draft-sme-review-required"));
});

test("v3 filters review queue without changing source evidence", () => {
  const project = analyzer.parseL5K(fixture);
  const queue = importer.buildImportQueue(project, [{ source: "Faults[1].13" }], { libraryAvailable: true });
  const review = importer.filterImportQueue(queue, { coverageStatus: "review-candidate", search: "faults[4].3" });
  assert.equal(review.length, 1);
  assert.equal(review[0].target, "Faults[4].3");
});

test("v3 UI keeps L5K parsing local and uses the same-origin Troubleshooting bridge", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/import.html"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-import.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-import.js"), "utf8");
  assert.match(page, /src="\.\.\/troubleshooting\/index\.html\?embeddedCoverageBridge=v[0-9.]+"/);
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-worker\.js\?v=1"\)/);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.match(page, /unmatched PLC target is a review candidate, not proof/i);
});
