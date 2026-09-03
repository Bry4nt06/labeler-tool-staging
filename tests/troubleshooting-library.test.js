"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const library = require("../app/troubleshooting/diagnostic-library.js");

test("troubleshooting library graph and source references are internally valid", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
});

test("the supplied troubleshooting archive is completely represented", () => {
  assert.equal(library.sources.length, 36);
  const expectedFiles = [
    "0001_RPC-DTS5_622_2011_EN_ppt.pdf",
    "11-EN-000-965.pdf",
    "605576 (APL) Schematic.pdf",
    "747-993 Electrical Schematic.pdf",
    "APL Main Contactor Faults/How to Remedy APL Main Contactor Faults.doc",
    "Allen Bradley Kinetix 6000 Multi-Axis Servo Drive Manual.pdf.lnk",
    "CO85_LB1_Labeler_1.ACD",
    "CO85_LB2_Labeler_2.ACD",
    "Labeler Danfoss Servo  How to Trouble servo bottle table fault messages.doc",
    "Labeler Danfoss servo bottle plate system.doc",
    "TM223TRE.25-ENG.pdf"
  ];
  const actual = new Set(library.sources.map((source) => source.file));
  expectedFiles.forEach((file) => assert.equal(actual.has(file), true, `Missing ${file}`));
});

test("exact RPC fault text resolves directly to the matching diagnostic", () => {
  const matches = library.searchEntries("SERVOCOUNT");
  assert.equal(matches[0]?.id, "servo-count");
  assert.ok(matches[0].searchScore >= 100);

  const encoder = library.searchEntries("ENCODERCONTINUITY");
  assert.equal(encoder[0]?.id, "encoder-continuity");
});

test("symptom search finds APL contactor and orientation guidance", () => {
  assert.equal(library.searchEntries("main contactor fault")[0]?.id, "apl-main-contactor");
  const orientationMatches = library.searchEntries("bottle orientation inconsistent");
  assert.equal(orientationMatches.some((entry) => entry.id === "orientation-inaccurate"), true);
});

test("Cold Glue context does not promote APL-only results without a matching query", () => {
  const results = library.searchEntries("contactor", { applicationMode: "cold-glue" });
  assert.equal(results[0]?.id, "apl-main-contactor");
  assert.ok(results[0].searchScore > 0, "Exact symptom should still find the APL reference when explicitly requested");
});

test("guided flows resolve only to valid diagnostic entries", () => {
  for (const flow of library.flows) {
    for (const node of Object.values(flow.nodes)) {
      for (const choice of node.choices) {
        if (choice.result) assert.ok(library.getEntry(choice.result), `${flow.id} points to ${choice.result}`);
      }
    }
  }
});

test("diagnostic entries retain safety guidance and source provenance", () => {
  for (const entry of library.entries) {
    assert.ok(entry.safety.length > 0, `${entry.id} missing safety guidance`);
    assert.ok(entry.sourceRefs.length > 0, `${entry.id} missing source references`);
  }
});

test("Phase 2 adds machine-aware Autocol, encoder-sync and APL aggregate diagnostics", () => {
  assert.equal(library.version, "troubleshooting-library-v2");
  assert.ok(library.getEntry("autocol-orientation-baseline"));
  assert.ok(library.getEntry("orientation-sync-after-encoder"));
  assert.ok(library.getEntry("apl-aggregate-connection"));
  assert.ok(library.getEntry("apl-rewind-servo-binding"));
  assert.ok(library.getFlow("autocol-orientation-flow"));
});

test("machine context ranks the most relevant guided path without hiding other paths", () => {
  const autocol = library.recommendFlows({ machineType: "Autocol", applicationMode: "apl" });
  assert.equal(autocol[0]?.id, "autocol-orientation-flow");
  assert.ok(autocol.some((flow) => flow.id === "apl-main-contactor-flow"));

  const apl = library.recommendFlows({ applicationMode: "apl" });
  assert.equal(apl[0]?.id, "apl-main-contactor-flow");

  const coldGlue = library.recommendFlows({ applicationMode: "cold-glue" });
  assert.notEqual(coldGlue[0]?.id, "apl-main-contactor-flow");
});

test("Autocol and encoder symptom searches resolve to dedicated Phase 2 outcomes", () => {
  const orientation = library.searchEntries("orientation", { machineType: "Autocol" });
  assert.equal(orientation[0]?.id, "autocol-orientation-baseline");

  const encoder = library.searchEntries("encoder replacement orientation", { machineType: "Autocol" });
  assert.equal(encoder[0]?.id, "orientation-sync-after-encoder");

  const rewind = library.searchEntries("rewind binding", { applicationMode: "apl" });
  assert.equal(rewind[0]?.id, "apl-rewind-servo-binding");
});

test("explicit APL fault intent stays authoritative even in Cold Glue context", () => {
  const results = library.searchEntries("APL main contactor", { applicationMode: "cold-glue", machineType: "Autocol" });
  assert.equal(results[0]?.id, "apl-main-contactor");
});

test("Phase 2 browser controller retains local resolution history, guided trail, and printable reports", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/troubleshooting-app.js"), "utf8");
  assert.match(source, /servoforge-troubleshooting-resolutions-v1/);
  assert.match(source, /recommendFlows\(state\.context\)/);
  assert.match(source, /data-save-resolution/);
  assert.match(source, /Resolution saved\. It will be suggested on matching future faults\./);
  assert.match(source, /data-print-diagnosis/);
  assert.match(source, /global\.print\(\)/);
  assert.match(source, /Guided path:/);
  assert.match(source, /Safety boundary:/);
});
