"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const overlayApi = require("../app/plc-analyzer/l5k-analyzer-troubleshooting-overlay-v7.js");

const uiPath = path.join(__dirname, "..", "app", "plc-analyzer", "plc-analyzer-import-controller-v6.js");
const uiSource = fs.readFileSync(uiPath, "utf8");
const importHtml = fs.readFileSync(path.join(__dirname, "..", "app", "plc-analyzer", "import.html"), "utf8");
const troubleshootingHtml = fs.readFileSync(path.join(__dirname, "..", "app", "troubleshooting", "index.html"), "utf8");

function makeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

const queue = {
  controllerIdentity: {
    parsedController: "LOCAL_LABELER_CONTROLLER",
    sourceFile: "Local_Labeler.L5K",
    sourceStatus: "unknown",
    sourceStatusLabel: "Unknown / not confirmed"
  },
  candidates: [
    {
      target: "SiteFaultArray[12].3",
      coverageStatus: "review",
      writers: [{ instruction: "OTE", program: "FaultLogic", routine: "Faults", rung: 4, startLine: 120, symbols: ["SiteSensor", "SiteFaultArray[12].3"] }],
      resets: [],
      relatedTimers: [{ tag: "SiteTimer" }],
      relatedCounters: [],
      ioReferences: ["Local:1:I.Data.2"],
      motionReferences: [],
      dependencyEvidence: { upstreamSymbols: ["SiteSensor"] }
    }
  ]
};

test("portable overlay engine marks PLC evidence as session/site-only", () => {
  const overlay = overlayApi.buildOverlay(queue, {
    siteLabel: "Different Brewery",
    assetLabel: "Labeler A",
    controllerRole: "labeler"
  });
  assert.equal(overlay.schema, "servoforge-troubleshooting-plc-overlay-v1");
  assert.equal(overlay.authority, "session-site-evidence-only");
  assert.equal(overlay.universalLibraryModified, false);
  assert.equal(overlay.controllerName, "LOCAL_LABELER_CONTROLLER");
  assert.equal(overlay.candidates[0].target, "SiteFaultArray[12].3");
  assert.match(overlay.sourceBoundary, /not universal ServoForge troubleshooting rules/i);
});

test("portable overlay is session-storable and clearable", () => {
  const storage = makeStorage();
  const overlay = overlayApi.buildOverlay(queue, { siteLabel: "Different Brewery" });
  overlayApi.saveOverlay(overlay, storage);
  assert.equal(overlayApi.loadOverlay(storage)?.sourceFile, "Local_Labeler.L5K");
  overlayApi.clearOverlay(storage);
  assert.equal(overlayApi.loadOverlay(storage), null);
});

test("Import Assistant no longer requires CO85 controller mapping for portable analysis", () => {
  assert.match(uiSource, /Site-specific \/ not in ServoForge reference inventory/);
  assert.match(uiSource, /controller\.value = "other"/);
  assert.match(uiSource, /const ready = hasFile && sourceStatusSelected/);
  assert.doesNotMatch(uiSource, /const ready = hasFile && controllerSelected && sourceStatusSelected/);
  assert.match(uiSource, /Known reference mapping \(optional\)/);
});

test("Import Assistant exposes explicit carryover and boundary", () => {
  assert.match(uiSource, /Use this controller in Troubleshooter/);
  assert.match(uiSource, /servoforge-troubleshooting-plc-overlay-v1/);
  assert.match(uiSource, /session-site-evidence-only/);
  assert.match(uiSource, /universalLibraryModified: false/);
  assert.match(uiSource, /Local tag names, addresses, rung locations, AFIs, timing values, I\/O references, and dependencies do not become permanent ServoForge troubleshooting rules/);
  assert.match(uiSource, /\.\.\/troubleshooting\/index\.html\?plcOverlay=1/);
});

test("v370 portable architecture remains present in later Import Assistant and Troubleshooting builds", () => {
  const importVersion = /PLC IMPORT ASSISTANT v(\d+) —/.exec(importHtml);
  assert.ok(importVersion, "Import Assistant version banner missing");
  assert.ok(Number(importVersion[1]) >= 7, `expected Import Assistant v7 or later, got v${importVersion?.[1]}`);
  assert.match(importHtml, /plc-analyzer-import-controller-v6\.js\?v=7-portable-20260906/);
  assert.doesNotMatch(importHtml, /plc-analyzer-import-controller-v6\.js\?v=6[\"']/);
  const versionMatch = /data-troubleshooting-version="v(\d+)"/.exec(troubleshootingHtml);
  assert.ok(versionMatch, "troubleshooting version banner missing");
  assert.ok(Number(versionMatch[1]) >= 370, `expected Troubleshooting v370 or later, got v${versionMatch?.[1]}`);
  const bannerMatch = /STAGING \/ TEST BUILD — TROUBLESHOOTING v(\d+) — ServoForge 0\.9\.10 — NOT PRODUCTION/.exec(troubleshootingHtml);
  assert.ok(bannerMatch, "troubleshooting staging banner missing");
  assert.ok(Number(bannerMatch[1]) >= 370, `expected staging banner v370 or later, got v${bannerMatch?.[1]}`);
  assert.match(troubleshootingHtml, /Universal guided fault isolation/);
  assert.match(troubleshootingHtml, /troubleshooting-search-precedence-v370-20260906/);
  assert.doesNotMatch(troubleshootingHtml, /troubleshooting-search-precedence-v360\.1-20260906/);
});
