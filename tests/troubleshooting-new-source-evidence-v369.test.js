"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const base = require(path.join(root, "app/troubleshooting/diagnostic-library.js"));
const withOrientation = require(path.join(root, "app/troubleshooting/orientation-commissioning-guides.js"))(base);
const library = require(path.join(root, "app/troubleshooting/new-source-evidence-v369.js"))(withOrientation);

const autocolSourceId = "autocol-schematic-k747a69";
const zenonSourceId = "zenon-service-v2433";
const enrichedIds = [
  "orientation-trigger-can",
  "orientation-image-sequence",
  "orientation-sync-after-encoder",
  "autocol-orientation-baseline",
  "schematic-navigation"
];

test("v369 registers the Autocol K747A69 schematic and Zenon service documentation as separate sources", () => {
  const autocol = library.getSource(autocolSourceId);
  const zenon = library.getSource(zenonSourceId);
  assert.ok(autocol);
  assert.ok(zenon);
  assert.equal(autocol.file, "Autocol schematic.pdf");
  assert.equal(zenon.file, "Zenon_Documentation.pdf");
  assert.match(autocol.notes, /machine-specific/i);
  assert.match(zenon.notes, /read-only/i);
  assert.deepEqual(library.newSourceEvidenceV369SourceIds, [autocolSourceId, zenonSourceId]);
});

test("v369 adds one Zenon DiagViewer diagnostic without inventing a second orientation fault family", () => {
  assert.deepEqual(library.newSourceEvidenceV369Ids, ["zenon-diagviewer"]);
  const entry = library.getEntry("zenon-diagviewer");
  assert.ok(entry);
  assert.equal(entry.code, "ZENON DIAGVIEWER");
  assert.match(entry.summary, /read-only evidence path/i);
  assert.ok(entry.sourceRefs.some((ref) => ref.sourceId === zenonSourceId));
  assert.equal(library.searchEntries("diagviewer", {}, 5)[0].id, "zenon-diagviewer");
  assert.equal(library.searchEntries("zenon", {}, 5)[0].id, "zenon-diagviewer");
});

test("v369 enriches existing Autocol orientation and schematic records instead of duplicating them", () => {
  for (const id of enrichedIds) {
    const entry = library.getEntry(id);
    assert.ok(entry, id);
    const refs = entry.sourceRefs.filter((ref) => ref.sourceId === autocolSourceId);
    assert.equal(refs.length, 1, `${id} should have one K747A69 source reference`);
    assert.ok(entry.evidenceLimits.some((limit) => /K747A69|machine-specific|matching installed equipment/i.test(limit)), id);
  }
  assert.equal(library.entries.filter((entry) => entry.id === "orientation-trigger-can").length, 1);
  assert.equal(library.entries.filter((entry) => entry.id === "orientation-image-sequence").length, 1);
});

test("v369 makes the new sources directly searchable in the reference library", () => {
  assert.equal(library.searchSources("autocol schematic", 5)[0].id, autocolSourceId);
  assert.equal(library.searchSources("K747A69", 5)[0].id, autocolSourceId);
  assert.equal(library.searchSources("zenon", 5)[0].id, zenonSourceId);
  assert.equal(library.searchSources("DiagViewer", 5)[0].id, zenonSourceId);
});

test("v369 preserves machine-specific network and wiring boundaries", () => {
  const source = fs.readFileSync(path.join(root, "app/troubleshooting/new-source-evidence-v369.js"), "utf8");
  assert.doesNotMatch(source, /\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  assert.doesNotMatch(source, /\b66\s*(?:hex|h)\b|0x42/i);
  const zenon = library.getEntry("zenon-diagviewer");
  assert.ok(zenon.actions.some((action) => /authorized controls\/service personnel/i.test(action)));
  assert.ok(zenon.evidenceLimits.some((limit) => /No password, IP address, network value/i.test(limit)));
});

test("v369 library validates cleanly", () => {
  const result = library.validate();
  assert.equal(result.ok, true, result.errors?.join("\n"));
  assert.deepEqual(result.errors, []);
});

test("v369 staging manifest loads source evidence after orientation authority and identifies v369", () => {
  const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");
  const orientation = page.indexOf("orientation-commissioning-guides.js");
  const v369 = page.indexOf("new-source-evidence-v369.js");
  const topmodul = page.indexOf("topmodul-live-diagnostics.js");
  assert.ok(orientation >= 0 && v369 > orientation && topmodul > v369);
  assert.match(page, /data-troubleshooting-version="v369"/);
  assert.match(page, /TROUBLESHOOTING v369/);
});
