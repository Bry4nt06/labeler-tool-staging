"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const base = require(path.join(rootDir, "app/troubleshooting/diagnostic-library.js"));
const searchExtend = require(path.join(rootDir, "app/troubleshooting/troubleshooting-search-precedence.js"));
const handoffExtend = require(path.join(rootDir, "app/troubleshooting/universal-handoff-v372.js"));
const structuralExtend = require(path.join(rootDir, "app/troubleshooting/site-plc-structural-routing-v373.js"));
const classifyExtend = require(path.join(rootDir, "app/troubleshooting/evidence-classification-v371.js"));
const page = fs.readFileSync(path.join(rootDir, "app/troubleshooting/index.html"), "utf8");

function boundedStructural(overrides = {}) {
  return {
    version: "v8",
    authority: "static-site-structure-only",
    interlock: null,
    recovery: null,
    afi: null,
    sourceBoundary: "Static structure only.",
    ...overrides
  };
}

function overlayWithCandidate(candidate) {
  return {
    schema: "servoforge-troubleshooting-plc-overlay-v1",
    overlayVersion: "v2-structural-v8",
    structuralEvidenceVersion: "v8",
    authority: "session-site-evidence-only",
    universalLibraryModified: false,
    sourceFile: "OtherSite_Labeler.L5K",
    controllerName: "OtherSite_Labeler",
    siteLabel: "Other Site",
    assetLabel: "Labeler 1",
    controllerRole: "labeler",
    candidates: [{
      target: "PlantFaults[42].7",
      writers: [{ instruction: "OTE", program: "FaultLogic", routine: "Faults", rung: 12, line: 900, symbols: ["PlantFaults[42].7"] }],
      resets: [],
      relatedTimers: [],
      relatedCounters: [],
      ioReferences: [],
      motionReferences: [],
      upstreamSymbols: [],
      structuralEvidence: boundedStructural(),
      ...candidate
    }]
  };
}

function rootWithOverlay(overlay) {
  return {
    sessionStorage: { getItem(key) { return key === "servoforge.troubleshooting.plcOverlay.v1" ? JSON.stringify(overlay) : null; }, removeItem() {} },
    setTimeout() {},
    document: null
  };
}

function libraryFor(candidate) {
  const root = rootWithOverlay(overlayWithCandidate(candidate));
  const search = searchExtend(base, root);
  const handoff = handoffExtend(search);
  const structural = structuralExtend(handoff, root);
  return classifyExtend(structural);
}

function siteEntry(library, target) {
  const entry = library.searchEntries(target, {}, 8).find((item) => item.uploadedPlcOverlay);
  assert.ok(entry, `site entry missing for ${target}`);
  return entry;
}

test("source-visible guard/permissive gate symbols can refine an ambiguous local target toward universal safety/permissive isolation", () => {
  const target = "PlantFaults[42].7";
  const library = libraryFor({
    target,
    structuralEvidence: boundedStructural({
      interlock: {
        version: "v12",
        pathCount: 1,
        gateCount: 1,
        gateSymbols: ["GuardDoorClosed"],
        paths: [{ gateSymbols: ["GuardDoorClosed"] }],
        runtimeGateStateProven: false,
        booleanBranchSemanticsProven: false
      }
    })
  });
  const entry = siteEntry(library, target);
  const handoff = library.getUniversalHandoff(entry);
  assert.equal(handoff.primary.domainId, "safety-permissive");
  assert.equal(handoff.primary.entryId, "universal-safety-permissive-isolation");
  assert.match(handoff.primary.signals.join(" "), /gate symbols/i);
  assert.match(handoff.boundary, /does not prove current interlock\/permissive gate state/i);
  assert.equal(entry.uploadedPlcOverlay.structuralEvidence.interlock.runtimeGateStateProven, false);
  assert.equal(entry.uploadedPlcOverlay.structuralEvidence.interlock.booleanBranchSemanticsProven, false);
});

test("AFI on the same source writer rung strengthens control-sequence routing without claiming AFI causality", () => {
  const target = "PlantFaults[45].0";
  const library = libraryFor({
    target,
    structuralEvidence: boundedStructural({
      afi: {
        version: "v14",
        sameWriterRungCount: 1,
        locations: [{ instruction: "AFI", program: "FaultLogic", routine: "FaultLogic_Jumps", rung: 9, line: 16620, runtimeStateProven: false }],
        runtimeStateProven: false,
        causeProven: false,
        wholeRoutineDisabledProven: false
      }
    })
  });
  const entry = siteEntry(library, target);
  const handoff = library.getUniversalHandoff(entry);
  assert.equal(handoff.primary.domainId, "control-sequence");
  assert.match(handoff.primary.signals.join(" "), /AFI appears on the same source rung/i);
  assert.match(handoff.primary.signals.join(" "), /causality not proven/i);
  assert.doesNotMatch(handoff.primary.signals.join(" "), /AFI caused|routine is disabled/i);
  assert.equal(entry.uploadedPlcOverlay.structuralEvidence.afi.causeProven, false);
  assert.equal(entry.uploadedPlcOverlay.structuralEvidence.afi.wholeRoutineDisabledProven, false);
});

test("recovery structure stays control-sequence-first without manufacturing a physical diagnosis from a static gate name", () => {
  const target = "LocalLatchedState";
  const library = libraryFor({
    target,
    structuralEvidence: boundedStructural({
      recovery: {
        version: "v13",
        relationshipCount: 1,
        pathCount: 1,
        sourcePairLocated: true,
        gateSymbols: ["MainContactorFeedback"],
        relationships: [{ target, latchWriterCount: 1, unlatchPathCount: 1, sourcePairLocated: true, runtimeStateProven: false, causeClearedProven: false, safeToResetProven: false }],
        paths: [{ instruction: "OTU", gateSymbols: ["MainContactorFeedback"], runtimeExecutionProven: false, causeClearedProven: false, safeToResetProven: false }],
        runtimeStateProven: false,
        causeClearedProven: false,
        safeToResetProven: false
      }
    })
  });
  const entry = siteEntry(library, target);
  const handoff = library.getUniversalHandoff(entry);
  assert.equal(handoff.authority, "routing-hint-only");
  assert.equal(handoff.primary.domainId, "control-sequence");
  assert.match(handoff.primary.signals.join(" "), /latch\/unlatch relationship is paired/i);
  assert.equal(entry.uploadedPlcOverlay.structuralEvidence.recovery.gateSymbols[0], "MainContactorFeedback");
  const powerAlternative = handoff.alternatives.find((item) => item.domainId === "power-supply");
  if (powerAlternative) assert.match(powerAlternative.signals.join(" "), /recovery-path gate symbols/i);
  assert.equal(entry.uploadedPlcOverlay.structuralEvidence.recovery.causeClearedProven, false);
  assert.equal(entry.uploadedPlcOverlay.structuralEvidence.recovery.safeToResetProven, false);
  assert.match(handoff.boundary, /cause-clear\/reset safety/i);
  assert.doesNotMatch(JSON.stringify(handoff), /reset now|perform reset|safe to reset/i);
});

test("v373 structural site evidence never enters the permanent universal method definitions", () => {
  const target = "SiteOnlyFault[77].3";
  const library = libraryFor({
    target,
    structuralEvidence: boundedStructural({
      interlock: { version: "v12", pathCount: 1, gateCount: 1, gateSymbols: ["SiteOnlyGuard_991"], paths: [], runtimeGateStateProven: false, booleanBranchSemanticsProven: false },
      afi: { version: "v14", sameWriterRungCount: 1, locations: [], runtimeStateProven: false, causeProven: false, wholeRoutineDisabledProven: false }
    })
  });
  const universal = JSON.stringify(library.UNIVERSAL_METHODS);
  assert.doesNotMatch(universal, /SiteOnlyFault|SiteOnlyGuard_991|OtherSite_Labeler/);
  assert.equal(library.uploadedPlcOverlay.universalLibraryModified, false);
  assert.equal(library.sitePlcStructuralRouting.universalLibraryModified, false);
  assert.equal(library.getEntryEvidenceClass(siteEntry(library, target)).id, "site-plc-evidence");
});

test("existing exact fault authority remains unchanged with v373 active", () => {
  const library = libraryFor({ target: "LocalState", structuralEvidence: boundedStructural() });
  assert.equal(library.searchEntries("SERVOCOUNT", {}, 8)[0]?.id, "servo-count");
  assert.equal(library.searchEntries("UNIVERSAL MOTION DRIVE", {}, 8)[0]?.id, "universal-motion-drive-isolation");
});

test("v373 validation enforces static structural boundaries", () => {
  const library = libraryFor({
    target: "PlantFaults[42].7",
    structuralEvidence: boundedStructural({
      afi: { version: "v14", sameWriterRungCount: 1, locations: [], runtimeStateProven: false, causeProven: false, wholeRoutineDisabledProven: false }
    })
  });
  const result = library.validate();
  assert.equal(result.ok, true, result.errors.join(" | "));
  assert.deepEqual(result.errors, []);
  assert.match(library.version, /search-precedence-v370/);
  assert.match(library.version, /universal-handoff-v372/);
  assert.match(library.version, /site-plc-structural-routing-v373/);
  assert.match(library.version, /evidence-classification-v371/);
});

test("v373 manifest loads after v372 routing and before v371 evidence classification", () => {
  const search = page.indexOf("troubleshooting-search-precedence.js");
  const handoff = page.indexOf("universal-handoff-v372.js");
  const structural = page.indexOf("site-plc-structural-routing-v373.js");
  const classification = page.indexOf("evidence-classification-v371.js");
  const app = page.indexOf("troubleshooting-app.js");
  assert.ok(search >= 0 && handoff > search && structural > handoff && classification > structural && app > classification);
  assert.match(page, /data-troubleshooting-version="v373"/);
  assert.match(page, /TROUBLESHOOTING v373/);
  assert.match(page, /troubleshooting-site-plc-structural-routing-v373-20260906/);
});
