"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const universal = require(path.join(root, "app/shared/universal-troubleshooting-core.js"));
global.ServoForgeUniversalTroubleshooting = universal;

const extendUniversalMethods = require(path.join(root, "app/troubleshooting/universal-methods-v370.js"));
const extendSearchPrecedence = require(path.join(root, "app/troubleshooting/troubleshooting-search-precedence.js"));
const extendAnalyzerOverlay = require(path.join(root, "app/troubleshooting/analyzer-context-overlay-v370.js"));
const troubleshootingPage = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");
const importPage = fs.readFileSync(path.join(root, "app/plc-analyzer/import.html"), "utf8");

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[_./:[\]()-]+/g, " ").replace(/\s+/g, " ").trim();
}

function makeBase() {
  const entries = Object.freeze([
    Object.freeze({
      id: "orientation-trigger-geometry-baseline",
      code: "ORIENTATION TRIGGER GEOMETRY",
      category: "Orientation",
      aliases: ["rotary plate distance", "table diameter", "orientation geometry"],
      title: "Verify orientation trigger geometry against the machine baseline",
      summary: "Machine-specific geometry reference.",
      probableCauses: [], checks: [], actions: [], safety: ["observe"], sourceRefs: []
    }),
    Object.freeze({
      id: "topmodul-plc-fault-670",
      code: "670",
      category: "TopModul PLC",
      aliases: ["fine clock monitoring"],
      title: "Safety Circuit Fault Fine Clock Pulse Monitoring",
      summary: "Machine-specific exact fault.",
      probableCauses: [], checks: [], actions: [], safety: ["observe"], sourceRefs: []
    })
  ]);
  const flows = Object.freeze([]);
  return Object.freeze({
    version: "fake-base",
    entries,
    flows,
    sources: Object.freeze([]),
    normalize,
    getEntry(id) { return entries.find((entry) => entry.id === id) || null; },
    getFlow() { return null; },
    searchEntries(query, _context = {}, limit = 8) {
      const q = normalize(query);
      return entries.filter((entry) => normalize([entry.code, entry.title, ...(entry.aliases || [])].join(" ")).includes(q)).slice(0, limit);
    },
    recommendFlows() { return []; },
    validate() { return { ok: true, errors: [] }; }
  });
}

function buildLibrary() {
  const methods = extendUniversalMethods(makeBase());
  return extendSearchPrecedence(methods);
}

test("universal classifier uses semantic failure meaning, not raw PLC address", () => {
  assert.equal(universal.classifyText("Faults[1].13"), null);
  assert.equal(universal.classifyText("BaseMachineEncoderAxis.FeedbackFault")?.familyId, "encoder-feedback");
  assert.equal(universal.classifyText("StartStop.ForceAutochange LackOfLabel")?.familyId, "label-supply-web");
  assert.equal(universal.classifyText("guard safety interlock open")?.familyId, "safety-interlock");
  assert.equal(universal.classifyText("CAN bus communication node offline")?.familyId, "communication");
  assert.equal(universal.classifyText("orientation camera faulty image sequence")?.familyId, "orientation-vision");
});

test("universal method layer is tag-independent and becomes the primary no-exact-alarm guide", () => {
  const library = buildLibrary();
  assert.equal(library.universalMethods.length, universal.families.length);
  assert.equal(library.getEntry("universal-encoder-feedback")?.methodClass, "universal");
  assert.match(library.getEntry("universal-encoder-feedback").universalBoundary, /tag-, site-, fault-number-, and address-independent/i);
  assert.equal(library.recommendFlows({ machineType: "Anything" })[0].id, "universal-fault-isolation-flow");
  assert.equal(library.getFlow("universal-fault-isolation-flow").nodes.system.choices.length, universal.families.length);
  assert.equal(library.validate().ok, true, library.validate().errors.join(" | "));
});

test("existing exact fault and verified natural alias precedence are preserved", () => {
  const library = buildLibrary();
  assert.equal(library.searchEntries("670", { machineType: "TopModul" }, 8)[0].id, "topmodul-plc-fault-670");
  assert.equal(library.searchEntries("rotary plate distance", { machineType: "TopModul" }, 8)[0].id, "orientation-trigger-geometry-baseline");
  assert.equal(library.searchEntries("encoder feedback missing", {}, 8)[0].id, "universal-encoder-feedback");
});

test("Analyzer handoff preserves site-specific evidence as a temporary overlay only", () => {
  const project = { controller: "SITE_A_LABELER", exportVersion: "v99", source: { fileName: "site-a.L5K" } };
  const queue = {
    project: { sourceFile: "site-a.L5K" },
    statistics: { totalFaultTargets: 2 },
    candidates: [
      {
        target: "Faults[4].3",
        coverageStatus: "review-candidate",
        writers: [{ instruction: "OTE", location: { program: "FaultLogic", routine: "Faults", rung: 5, line: 16620 }, symbols: ["BaseMachineEncoderAxis.FeedbackFault", "Faults[4].3"] }],
        ioReferences: [], motionReferences: [], dependencyEvidence: { upstreamSymbols: [] }
      },
      {
        target: "Faults[9].1",
        coverageStatus: "review-candidate",
        writers: [{ instruction: "OTE", location: { program: "Safety", routine: "Guarding", rung: 2, line: 500 }, symbols: ["GuardCircuitOpen", "Faults[9].1"] }],
        ioReferences: [], motionReferences: [], dependencyEvidence: { upstreamSymbols: [] }
      }
    ]
  };
  const handoff = universal.buildAnalyzerHandoff(project, queue, { expectedControllerId: "other", sourceStatus: "current-production" }, { generatedAt: "2026-09-06T00:00:00.000Z" });
  assert.equal(handoff.schema, universal.HANDOFF_SCHEMA);
  assert.equal(handoff.evidenceScope, "temporary-controller-session-overlay");
  assert.match(handoff.universalizationPolicy, /must never replace the universal troubleshooting method/i);
  assert.equal(handoff.controller.parsedController, "SITE_A_LABELER");
  assert.equal(handoff.bindings.find((row) => row.target === "Faults[4].3")?.familyId, "encoder-feedback");
  assert.equal(handoff.bindings.find((row) => row.target === "Faults[9].1")?.familyId, "safety-interlock");
  assert.equal(handoff.statistics.classifiedTargets, 2);
  assert.ok(!Object.prototype.hasOwnProperty.call(handoff, "libraryEntries"));
});

test("Analyzer overlay maps an attached controller target to a universal method without hijacking numeric exact faults", () => {
  const project = { controller: "SITE_A_LABELER", exportVersion: "v99", source: { fileName: "site-a.L5K" } };
  const queue = {
    statistics: { totalFaultTargets: 1 },
    candidates: [{
      target: "Faults[4].3",
      coverageStatus: "review-candidate",
      writers: [{ instruction: "OTE", location: { program: "FaultLogic", routine: "Faults", rung: 5, line: 16620 }, symbols: ["BaseMachineEncoderAxis.FeedbackFault"] }],
      ioReferences: [], motionReferences: [], dependencyEvidence: { upstreamSymbols: [] }
    }]
  };
  const handoff = universal.buildAnalyzerHandoff(project, queue, { sourceStatus: "current-production" });
  let stored = JSON.stringify(handoff);
  const localStorage = {
    getItem(key) { return key === universal.STORAGE_KEY ? stored : null; },
    setItem(key, value) { if (key === universal.STORAGE_KEY) stored = String(value); },
    removeItem(key) { if (key === universal.STORAGE_KEY) stored = null; }
  };
  const library = buildLibrary();
  const overlay = extendAnalyzerOverlay(library, { localStorage });
  assert.equal(overlay.searchEntries("Faults[4].3", {}, 8)[0].id, "universal-encoder-feedback");
  assert.equal(overlay.searchEntries("670", {}, 8)[0].id, "topmodul-plc-fault-670");
  const encoder = overlay.getEntry("universal-encoder-feedback");
  assert.equal(encoder.analyzerEvidence.familyId, "encoder-feedback");
  assert.equal(encoder.analyzerEvidence.bindings[0].target, "Faults[4].3");
  const permanentCount = overlay.entries.length;
  overlay.clearAnalyzerContext();
  assert.equal(stored, null);
  assert.equal(overlay.getAnalyzerContext(), null);
  assert.equal(overlay.entries.length, permanentCount);
  assert.equal(overlay.getEntry("universal-encoder-feedback").analyzerEvidence, undefined);
});

test("staging manifests make the universal layer explicit and keep Analyzer evidence temporary", () => {
  assert.match(troubleshootingPage, /data-troubleshooting-version="v370"/);
  const core = troubleshootingPage.indexOf("shared/universal-troubleshooting-core.js");
  const methods = troubleshootingPage.indexOf("universal-methods-v370.js");
  const precedence = troubleshootingPage.indexOf("troubleshooting-search-precedence.js");
  const overlay = troubleshootingPage.indexOf("analyzer-context-overlay-v370.js");
  const app = troubleshootingPage.indexOf("troubleshooting-app.js");
  const ui = troubleshootingPage.indexOf("analyzer-context-ui-v370.js");
  assert.ok(core >= 0 && methods > core && precedence > methods && overlay > precedence && app > overlay && ui > app);
  assert.match(troubleshootingPage, /Uploaded controller context/);
  assert.match(troubleshootingPage, /tags, fault targets, rung locations and project naming shown here belong only to the uploaded source/i);

  assert.match(importPage, /PLC IMPORT ASSISTANT v7 — UNIVERSAL HANDOFF/);
  assert.match(importPage, /Use PLC source as context, not as the troubleshooting bible/i);
  assert.match(importPage, /Use Analyzer Context in Troubleshooter/);
  assert.match(importPage, /temporary controller evidence overlay/i);
  assert.ok(importPage.indexOf("universal-troubleshooting-core.js") < importPage.indexOf("plc-analyzer-import-handoff-v7.js"));
  assert.ok(importPage.indexOf("plc-analyzer-import-handoff-v7.js") < importPage.indexOf("plc-analyzer-import-v5-1.js"));
});
