"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const extendSearch = require("../app/troubleshooting/troubleshooting-search-precedence.js");

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function makeStorage(overlay) {
  const values = new Map();
  if (overlay) values.set("servoforge.troubleshooting.plcOverlay.v1", JSON.stringify(overlay));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function makeBase() {
  const entries = Object.freeze([
    Object.freeze({
      id: "universal-bearing-symptom",
      code: "BEARING SYMPTOM",
      title: "Bearing / rotating-element symptom",
      category: "Universal / Mechanical",
      aliases: ["bearing vibration", "bearing noise", "rotating element vibration"],
      contextHints: [],
      probableCauses: [], checks: [], actions: [], safety: []
    }),
    Object.freeze({
      id: "universal-fault-1050",
      code: "1050",
      title: "Universal example fault",
      category: "Universal / Example",
      aliases: ["fault 1050"],
      contextHints: [],
      probableCauses: [], checks: [], actions: [], safety: []
    })
  ]);
  return Object.freeze({
    version: "test-base",
    entries,
    normalize,
    searchEntries(query, _context, limit = 8) {
      const q = normalize(query);
      return entries.filter((entry) => normalize([entry.code, entry.title, ...(entry.aliases || [])].join(" ")).includes(q)).slice(0, limit);
    },
    getEntry(id) { return entries.find((entry) => entry.id === id) || null; },
    validate() { return { ok: true, errors: [] }; }
  });
}

const overlay = Object.freeze({
  schema: "servoforge-troubleshooting-plc-overlay-v1",
  authority: "session-site-evidence-only",
  universalLibraryModified: false,
  siteLabel: "Example Site",
  assetLabel: "Local Labeler",
  controllerRole: "labeler",
  controllerName: "SITE_LABELER_PLC",
  sourceFile: "Site_Labeler.L5K",
  candidates: [
    {
      target: "PlantFaults[42].7",
      writers: [{ instruction: "OTE", program: "FaultLogic", routine: "LocalFaults", rung: 12, line: 900, symbols: ["LocalEncoderHealthy", "PlantFaults[42].7"] }],
      resets: [],
      relatedTimers: ["LocalDelay"],
      relatedCounters: [],
      ioReferences: ["Local:3:I.Data.5"],
      motionReferences: [],
      upstreamSymbols: ["LocalEncoderHealthy"]
    }
  ]
});

test("site PLC target is searchable as temporary overlay evidence", () => {
  const base = makeBase();
  const root = { sessionStorage: makeStorage(overlay) };
  const library = extendSearch(base, root);
  const results = library.searchEntries("PlantFaults[42].7", {}, 8);
  assert.equal(results[0]?.category, "Uploaded PLC / Site overlay");
  assert.equal(results[0]?.uploadedPlcOverlay?.sourceFile, "Site_Labeler.L5K");
  assert.match(results[0]?.summary || "", /not a universal ServoForge fault definition/i);
  assert.equal(library.uploadedPlcOverlay.authority, "session-site-evidence-only");
  assert.equal(library.uploadedPlcOverlay.universalLibraryModified, false);
});

test("uploaded controller does not mutate permanent universal entries", () => {
  const base = makeBase();
  const originalCount = base.entries.length;
  const library = extendSearch(base, { sessionStorage: makeStorage(overlay) });
  assert.equal(base.entries.length, originalCount);
  assert.equal(base.entries.some((entry) => entry.category === "Uploaded PLC / Site overlay"), false);
  assert.equal(library.entries.length, originalCount + 1);
  assert.equal(library.getEntry("universal-bearing-symptom"), base.entries[0]);
});

test("unrelated universal symptom search remains universal", () => {
  const library = extendSearch(makeBase(), { sessionStorage: makeStorage(overlay) });
  const results = library.searchEntries("bearing vibration", {}, 8);
  assert.equal(results[0]?.id, "universal-bearing-symptom");
  assert.notEqual(results[0]?.category, "Uploaded PLC / Site overlay");
});

test("no overlay is present after the session evidence is absent", () => {
  const library = extendSearch(makeBase(), { sessionStorage: makeStorage(null) });
  assert.equal(library.uploadedPlcOverlay.active, false);
  assert.equal(library.entries.length, 2);
  assert.equal(library.searchEntries("PlantFaults[42].7", {}, 8).length, 0);
});

test("overlay guidance preserves universal troubleshooting and safety boundaries", () => {
  const library = extendSearch(makeBase(), { sessionStorage: makeStorage(overlay) });
  const entry = library.searchEntries("PlantFaults[42].7", {}, 8)[0];
  const text = JSON.stringify(entry);
  assert.match(text, /matching universal troubleshooting path/i);
  assert.match(text, /another site may implement/i);
  assert.match(text, /do not modify PLC logic/i);
  assert.match(text, /do not force outputs/i);
  assert.doesNotMatch(text, /jumper .*safety|bypass .*to keep|force .*true/i);
  assert.deepEqual(library.validate(), { ok: true, errors: [] });
});
