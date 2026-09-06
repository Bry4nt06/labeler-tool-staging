"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const base = require(path.join(rootDir, "app/troubleshooting/diagnostic-library.js"));
const searchExtend = require(path.join(rootDir, "app/troubleshooting/troubleshooting-search-precedence.js"));
const handoffExtend = require(path.join(rootDir, "app/troubleshooting/universal-handoff-v372.js"));
const classifyExtend = require(path.join(rootDir, "app/troubleshooting/evidence-classification-v371.js"));
const page = fs.readFileSync(path.join(rootDir, "app/troubleshooting/index.html"), "utf8");
const uiSource = fs.readFileSync(path.join(rootDir, "app/troubleshooting/universal-handoff-ui-v372.js"), "utf8");

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

function overlayWithCandidate(candidate) {
  return {
    schema: "servoforge-troubleshooting-plc-overlay-v1",
    authority: "session-site-evidence-only",
    universalLibraryModified: false,
    sourceFile: "ExampleSite_Labeler.L5K",
    controllerName: "ExampleSite_Labeler",
    siteLabel: "Example Site",
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
      ...candidate
    }]
  };
}

function libraryFor(candidate) {
  const searchLibrary = searchExtend(base, rootWithOverlay(overlayWithCandidate(candidate)));
  return classifyExtend(handoffExtend(searchLibrary));
}

function siteEntry(library, target) {
  const match = library.searchEntries(target, {}, 8).find((entry) => entry.uploadedPlcOverlay);
  assert.ok(match, `site overlay entry missing for ${target}`);
  return match;
}

test("v372 adds nine source-free universal failure-mechanism methods and one router flow", () => {
  const library = classifyExtend(handoffExtend(searchExtend(base, {})));
  assert.equal(library.UNIVERSAL_METHODS.length, 9);
  assert.equal(library.entries.length, base.entries.length + 9);
  assert.equal(library.flows.length, base.flows.length + 1);
  assert.ok(library.getFlow("universal-failure-mechanism-flow"));
  for (const method of library.UNIVERSAL_METHODS) {
    assert.deepEqual(method.sourceRefs, []);
    assert.equal(library.getEntryEvidenceClass(method).id, "universal-method");
  }
  assert.equal(library.getFlowEvidenceClass("universal-failure-mechanism-flow").id, "universal-method");
});

test("motion references route Site PLC Evidence into the universal motion method", () => {
  const target = "BottleTableAxisFault";
  const library = libraryFor({
    target,
    writers: [{ instruction: "MAM", program: "Motion", routine: "BottleTable", rung: 7, line: 120, symbols: [target, "BottleTableAxis"] }],
    motionReferences: ["BottleTableAxis"]
  });
  const entry = siteEntry(library, target);
  const handoff = library.getUniversalHandoff(entry);
  assert.equal(library.getEntryEvidenceClass(entry).id, "site-plc-evidence");
  assert.equal(handoff.primary.domainId, "motion-drive");
  assert.equal(handoff.primary.entryId, "universal-motion-drive-isolation");
  assert.equal(handoff.primary.confidence, "high");
  assert.equal(handoff.authority, "routing-hint-only");
  assert.equal(handoff.sourceAuthority, "session-site-evidence-only");
});

test("site evidence routes by failure mechanism without treating local names as universal definitions", () => {
  const cases = [
    [{ target: "GuardDoorPermissive", upstreamSymbols: ["GuardDoorSwitch"] }, "safety-permissive"],
    [{ target: "EncoderWatchdogFault", relatedTimers: ["EncoderWatchdogTimer"], upstreamSymbols: ["MainEncoderHealthy"] }, "timing-synchronization"],
    [{ target: "LabelerHeartbeatFault", writers: [{ instruction: "MSG", program: "Communications", routine: "Heartbeat", rung: 5, line: 80, symbols: ["LabelerHeartbeatFault"] }] }, "communication"],
    [{ target: "MainContactorFault", upstreamSymbols: ["MainContactorFeedback"] }, "power-supply"],
    [{ target: "PE631_NotSeen", ioReferences: ["Local:3:I.Data.4"], upstreamSymbols: ["PhotoEyeInput"] }, "sensing-feedback"],
    [{ target: "RewindJamFault", upstreamSymbols: ["RewindJam"] }, "mechanical-condition"],
    [{ target: "BottleAirPressureLow", upstreamSymbols: ["BottleAirPressure"] }, "process-condition"],
    [{ target: "PlantFaults[42].7" }, "control-sequence"]
  ];

  for (const [candidate, expected] of cases) {
    const library = libraryFor(candidate);
    const entry = siteEntry(library, candidate.target);
    const handoff = library.getUniversalHandoff(entry);
    assert.equal(handoff.primary.domainId, expected, `${candidate.target} routed to ${handoff.primary.domainId}`);
    assert.match(handoff.boundary, /does not change the universal library/i);
    assert.match(handoff.boundary, /local tags, rungs, addresses, AFIs, timer values, I\/O names/i);
  }
});

test("v372 universal methods contain no carried site tag, rung, address, timer preset, or project identity", () => {
  const target = "SiteOnlyFault[7].3";
  const library = libraryFor({
    target,
    writers: [{ instruction: "OTE", program: "SiteFaultLogic", routine: "SiteOnlyRoutine", rung: 77, line: 1777, symbols: [target, "SiteOnlyPE"] }],
    relatedTimers: ["SiteTimer99"],
    ioReferences: ["Local:7:I.Data.3"],
    upstreamSymbols: ["SiteOnlyPE"]
  });
  const universalText = JSON.stringify(library.UNIVERSAL_METHODS);
  assert.doesNotMatch(universalText, /SiteOnlyFault|SiteFaultLogic|SiteOnlyRoutine|SiteTimer99|Local:7:I\.Data\.3|SiteOnlyPE/);
  assert.equal(base.entries.some((entry) => entry.id === "universal-control-sequence-isolation"), false);
  assert.equal(library.uploadedPlcOverlay.universalLibraryModified, false);
});

test("exact existing fault search remains authoritative while exact universal method codes open v372 methods", () => {
  const library = classifyExtend(handoffExtend(searchExtend(base, {})));
  assert.equal(library.searchEntries("SERVOCOUNT", {}, 8)[0]?.id, "servo-count");
  assert.equal(library.searchEntries("UNIVERSAL MOTION DRIVE", {}, 8)[0]?.id, "universal-motion-drive-isolation");
  assert.equal(library.searchEntries("UNIVERSAL SAFETY PERMISSIVE", {}, 8)[0]?.id, "universal-safety-permissive-isolation");
});

test("v372 validation preserves v370 overlay authority and v371 evidence classification", () => {
  const library = libraryFor({ target: "GuardDoorPermissive", upstreamSymbols: ["GuardDoorSwitch"] });
  const result = library.validate();
  assert.equal(result.ok, true, result.errors.join(" | "));
  assert.deepEqual(result.errors, []);
  assert.match(library.version, /search-precedence-v370/);
  assert.match(library.version, /universal-handoff-v372/);
  assert.match(library.version, /evidence-classification-v371/);
});

test("v372 UI exposes a reversible Site PLC to Universal Method handoff without forcing or bypass guidance", () => {
  assert.match(uiSource, /Continue with Universal Method/);
  assert.match(uiSource, /routing hint—not proof of root cause/);
  assert.match(uiSource, /servoforge\.troubleshooting\.universalHandoff\.v1/);
  assert.match(uiSource, /Back to site PLC evidence/);
  assert.match(uiSource, /data-universal-handoff-entry/);
  assert.match(uiSource, /searchButton\.click\(\)/);
  assert.match(uiSource, /MutationObserver/);
  assert.match(uiSource, /global\.setTimeout/);
  assert.doesNotMatch(uiSource, /queueMicrotask/);
  assert.doesNotMatch(uiSource, /force outputs to prove|bypass .* to continue|jumper .* safety/i);
});

test("v372 manifest loads handoff after v370 search, before v371 classification, and UI after v371 decoration", () => {
  const search = page.indexOf("troubleshooting-search-precedence.js");
  const handoff = page.indexOf("universal-handoff-v372.js");
  const classification = page.indexOf("evidence-classification-v371.js");
  const guard = page.indexOf("troubleshooting-startup-guard.js");
  const app = page.indexOf("troubleshooting-app.js");
  const classificationUi = page.indexOf("evidence-classification-ui-v371.js");
  const handoffUi = page.indexOf("universal-handoff-ui-v372.js");
  assert.ok(search >= 0 && handoff > search && classification > handoff && guard > classification && app > guard && classificationUi > app && handoffUi > classificationUi);
  assert.match(page, /data-troubleshooting-version="v372"/);
  assert.match(page, /TROUBLESHOOTING v372/);
  assert.match(page, /troubleshooting-universal-handoff-v372-20260906&shell=v358/);
  assert.match(page, /troubleshooting-universal-handoff-ui-v372-20260906&shell=v358/);
});
