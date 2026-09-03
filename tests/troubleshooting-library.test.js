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

test("Cold Glue context does not hide an explicitly requested APL reference", () => {
  const results = library.searchEntries("contactor", { applicationMode: "cold-glue" });
  assert.equal(results[0]?.id, "apl-main-contactor");
  assert.ok(results[0].searchScore > 0);
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
