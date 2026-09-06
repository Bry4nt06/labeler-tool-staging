"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const base = require(path.join(rootDir, "app/troubleshooting/diagnostic-library.js"));
const searchExtend = require(path.join(rootDir, "app/troubleshooting/troubleshooting-search-precedence.js"));
const classifyExtend = require(path.join(rootDir, "app/troubleshooting/evidence-classification-v371.js"));
const page = fs.readFileSync(path.join(rootDir, "app/troubleshooting/index.html"), "utf8");
const uiSource = fs.readFileSync(path.join(rootDir, "app/troubleshooting/evidence-classification-ui-v371.js"), "utf8");

function rootWithOverlay(overlay) {
  return {
    sessionStorage: {
      getItem(key) { return key === "servoforge.troubleshooting.plcOverlay.v1" ? JSON.stringify(overlay) : null; },
      removeItem() {}
    },
    setTimeout() {},
    document: null
  };
}

function sampleOverlay() {
  return {
    schema: "servoforge-troubleshooting-plc-overlay-v1",
    authority: "session-site-evidence-only",
    universalLibraryModified: false,
    sourceFile: "OtherSite_Labeler.L5K",
    controllerName: "OtherSite_Labeler",
    siteLabel: "Other Brewery",
    assetLabel: "Labeler 1",
    controllerRole: "labeler",
    candidates: [{
      target: "LocalFaults[12].3",
      writers: [{ program: "Main", routine: "Faults", rung: 42, line: 100, symbols: ["LocalFaults[12].3", "PE_Local"] }],
      resets: [],
      relatedTimers: ["T_Local"],
      relatedCounters: [],
      ioReferences: ["Local:3:I.Data.4"],
      motionReferences: [],
      upstreamSymbols: ["PE_Local"]
    }]
  };
}

test("v371 exposes the three evidence authority classes", () => {
  const library = classifyExtend(searchExtend(base, {}));
  assert.deepEqual(Object.values(library.EVIDENCE_CLASS).map((item) => item.label), [
    "Universal Method",
    "Machine-Family Evidence",
    "Site PLC Evidence"
  ]);
  assert.match(library.version, /evidence-classification-v371/);
});

test("generic symptom flows stay universal while explicitly named machine-family flows stay scoped", () => {
  const library = classifyExtend(searchExtend(base, {}));
  assert.equal(library.getFlowEvidenceClass("encoder-timing-flow").id, "universal-method");
  assert.equal(library.getFlowEvidenceClass("electrical-controls-flow").id, "universal-method");
  assert.equal(library.getFlowEvidenceClass("autocol-orientation-flow").id, "machine-family-evidence");
  assert.equal(library.getFlowEvidenceClass("apl-main-contactor-flow").id, "machine-family-evidence");
  assert.equal(library.getFlowEvidenceClass("controls-diagnostics-flow").id, "machine-family-evidence");
});

test("OEM and schematic references are machine-family evidence rather than universal tag standards", () => {
  const library = classifyExtend(searchExtend(base, {}));
  assert.equal(library.getSourceEvidenceClass("rpc-dts5-2011").id, "machine-family-evidence");
  assert.equal(library.getSourceEvidenceClass("apl-schematic-605576").id, "machine-family-evidence");
  assert.equal(library.getEntryEvidenceClass("servo-power-timeout").id, "machine-family-evidence");
  assert.equal(library.getEntryEvidenceClass("orientation-sync-after-encoder").id, "machine-family-evidence");
});

test("CO85 control-project references are explicitly Site PLC Evidence", () => {
  const library = classifyExtend(searchExtend(base, {}));
  const sourceClass = library.getSourceEvidenceClass("lb1-aplcart-1");
  assert.equal(sourceClass.id, "site-plc-evidence");
  assert.equal(sourceClass.authority, "archived-site-project-evidence");
  assert.equal(sourceClass.activeOverlay, false);
});

test("Analyzer carryover is temporary Site PLC Evidence and does not mutate the permanent library", () => {
  const overlay = sampleOverlay();
  const searchLibrary = searchExtend(base, rootWithOverlay(overlay));
  const library = classifyExtend(searchLibrary);
  const local = library.searchEntries("LocalFaults[12].3", {}, 5)[0];
  assert.ok(local);
  assert.match(local.id, /^uploaded-plc-overlay-/);
  const classification = library.getEntryEvidenceClass(local);
  assert.equal(classification.id, "site-plc-evidence");
  assert.equal(classification.authority, "session-site-evidence-only");
  assert.equal(classification.activeOverlay, true);
  assert.equal(library.uploadedPlcOverlay.universalLibraryModified, false);
  assert.equal(base.entries.some((entry) => entry.id === local.id), false);
  assert.equal(base.searchEntries("LocalFaults[12].3", {}, 5).length, 0);
});

test("v371 validation enforces evidence classification for all entries, flows, sources, and overlays", () => {
  const library = classifyExtend(searchExtend(base, rootWithOverlay(sampleOverlay())));
  const result = library.validate();
  assert.equal(result.ok, true, result.errors.join(" | "));
  assert.deepEqual(result.errors, []);
});

test("v371 UI surfaces classification legend and decorates results without a microtask observer loop", () => {
  assert.match(uiSource, /How to read this troubleshooting result/);
  assert.match(uiSource, /data-evidence-badge/);
  assert.match(uiSource, /getEntryEvidenceClass/);
  assert.match(uiSource, /getFlowEvidenceClass/);
  assert.match(uiSource, /getSourceEvidenceClass/);
  assert.match(uiSource, /MutationObserver/);
  assert.match(uiSource, /global\.setTimeout/);
  assert.doesNotMatch(uiSource, /queueMicrotask/);
});

test("v371 manifest loads classification after v370 search overlay and UI after the main controller", () => {
  const search = page.indexOf("troubleshooting-search-precedence.js");
  const classification = page.indexOf("evidence-classification-v371.js");
  const startup = page.indexOf("troubleshooting-startup-guard.js");
  const app = page.indexOf("troubleshooting-app.js");
  const ui = page.indexOf("evidence-classification-ui-v371.js");
  assert.ok(search >= 0 && classification > search && startup > classification && app > startup && ui > app);
  assert.match(page, /data-troubleshooting-version="v371"/);
  assert.match(page, /TROUBLESHOOTING v371/);
  assert.match(page, /troubleshooting-evidence-classification-v371-20260906&shell=v358/);
  assert.match(page, /troubleshooting-evidence-classification-ui-v371-20260906&shell=v358/);
});
