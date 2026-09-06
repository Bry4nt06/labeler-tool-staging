"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const base = require(path.join(root, "app/troubleshooting/diagnostic-library.js"));
const extend = require(path.join(root, "app/troubleshooting/orientation-commissioning-guides.js"));
const library = extend(base);
const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");

const ids = [
  "orientation-high-speed-wrong-plate",
  "orientation-trigger-geometry-baseline",
  "orientation-camera-cpu-replacement",
  "dart-embossed-bottle-commissioning"
];

function text(entry) { return JSON.stringify(entry); }

function startChoiceResults(flowId) {
  const flow = library.getFlow(flowId);
  return flow.nodes[flow.start].choices.map((choice) => choice.result).filter(Boolean);
}

test("v367 adds exactly the four prepared orientation records and preserves the existing orientation authority", () => {
  assert.deepEqual([...library.orientationGuideIds], ids);
  ids.forEach((id) => assert.ok(library.getEntry(id), `missing ${id}`));
  assert.equal(library.entries.length, base.entries.length + 4);
  assert.equal(library.getEntry("orientation-inaccurate").code, "ORIENTATION INACCURATE");
  assert.equal(library.getEntry("orientation-image-sequence").code, "FAULTY IMAGE SEQUENCE");
  assert.equal(library.getEntry("orientation-trigger-can").code, "TRIGGER/CAN");
  assert.equal(library.validate().ok, true, library.validate().errors.join(" | "));
});

test("high-speed wrong-plate path is speed-dependent and does not promote archived geometry values", () => {
  const entry = library.getEntry("orientation-high-speed-wrong-plate");
  const combined = text(entry);
  assert.match(combined, /controlled low speed/i);
  assert.match(combined, /wrong rotary plate|different plate/i);
  assert.match(combined, /distance between rotary plates/i);
  assert.match(combined, /table diameter/i);
  assert.match(combined, /motor number/i);
  assert.match(combined, /result-position|revolution-position/i);
  assert.match(combined, /approved machine baseline/i);
  assert.match(combined, /do not copy values from archived training screenshots/i);
  assert.equal(entry.sourceRefs[0].sourceId, "dartplus-11-en-000-965");
  assert.equal(library.searchEntries("wrong bottle plate", { machineType: "Autocol" }, 8)[0].id, entry.id);
});

test("trigger geometry record keeps read-only comparison separate from calibration and synchronization authority", () => {
  const entry = library.getEntry("orientation-trigger-geometry-baseline");
  const combined = text(entry);
  assert.match(combined, /approved machine baseline/i);
  assert.match(combined, /bottle-present/i);
  assert.match(combined, /recalibration|calibration/i);
  assert.match(combined, /synchronization/i);
  assert.match(combined, /Do not derive geometry from an archived screenshot/i);
  assert.doesNotMatch(combined, /table diameter\s*(?:=|:)\s*\d/i);
  assert.doesNotMatch(combined, /distance between rotary plates\s*(?:=|:)\s*\d/i);
});

test("camera CPU replacement requires verified installed identity and routes remaining faults to existing image/CAN diagnostics", () => {
  const entry = library.getEntry("orientation-camera-cpu-replacement");
  const combined = text(entry);
  assert.match(combined, /began immediately after camera CPU replacement/i);
  assert.match(combined, /installed replacement CPU identity/i);
  assert.match(combined, /DRP Network subsystems/i);
  assert.match(combined, /faulty-image-sequence|faulty-image-sequence and trigger\/CAN/i);
  assert.match(combined, /Do not publish or reuse archived IP or MAC values/i);
  assert.equal(entry.sourceRefs[0].sourceId, "orientation-hardware-rpc");
  assert.ok(entry.related.includes("orientation-image-sequence"));
  assert.ok(entry.related.includes("orientation-trigger-can"));
  assert.doesNotMatch(combined, /\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  assert.doesNotMatch(combined, /(?:[0-9A-F]{2}:){5}[0-9A-F]{2}/i);
});

test("embossed bottle path is qualified commissioning rather than a reset recipe", () => {
  const entry = library.getEntry("dart-embossed-bottle-commissioning");
  const combined = text(entry);
  assert.match(combined, /authorized new-type commissioning/i);
  assert.match(combined, /selected in both the labeler and DARTplus/i);
  assert.match(combined, /image buffer/i);
  assert.match(combined, /Learn the embossing/i);
  assert.match(combined, /correction direction/i);
  assert.match(combined, /backup/i);
  assert.match(combined, /not an operator fault reset/i);
  assert.equal(entry.sourceRefs[0].sourceId, "gop-embossing-orientation");
});

test("v367 extends both orientation guided paths without removing their existing choices", () => {
  const bottleResults = startChoiceResults("bottle-orientation-flow");
  const autocolResults = startChoiceResults("autocol-orientation-flow");
  ids.forEach((id) => {
    assert.ok(bottleResults.includes(id), `bottle orientation flow missing ${id}`);
    assert.ok(autocolResults.includes(id), `autocol orientation flow missing ${id}`);
  });
  assert.ok(bottleResults.includes("autocol-orientation-baseline"));
  assert.ok(bottleResults.includes("orientation-inaccurate"));
  assert.ok(bottleResults.includes("orientation-image-sequence"));
  assert.ok(bottleResults.includes("orientation-trigger-can"));
  assert.ok(autocolResults.includes("orientation-sync-after-encoder"));
  assert.ok(autocolResults.includes("orientation-inaccurate"));
});

test("v367 preserves machine-context guide ranking metadata", () => {
  const ranked = library.recommendFlows({ machineType: "Autocol", applicationMode: "orientation" });
  const bottle = ranked.find((flow) => flow.id === "bottle-orientation-flow");
  const autocol = ranked.find((flow) => flow.id === "autocol-orientation-flow");
  assert.ok(Number(bottle?.contextScore || 0) > 0);
  assert.ok(Number(autocol?.contextScore || 0) > 0);
});

test("staging page keeps v367 loaded before exact-search precedence and application startup on later troubleshooting releases", () => {
  const versionMatch = /data-troubleshooting-version="v(\d+)"/.exec(page);
  assert.ok(versionMatch, "troubleshooting version banner missing");
  assert.ok(Number(versionMatch[1]) >= 367, `expected v367 or later, got v${versionMatch?.[1]}`);
  const baseIndex = page.indexOf("diagnostic-library.js");
  const orientationIndex = page.indexOf("orientation-commissioning-guides.js");
  const precedenceIndex = page.indexOf("troubleshooting-search-precedence.js");
  const appIndex = page.indexOf("troubleshooting-app.js");
  assert.ok(baseIndex >= 0 && orientationIndex > baseIndex);
  assert.ok(precedenceIndex > orientationIndex);
  assert.ok(appIndex > precedenceIndex);
  assert.match(page, /troubleshooting-orientation-v367-20260906&shell=v358/);
  assert.match(page, /troubleshooting-apl-cart-label-supply-v366-20260906&shell=v358/);
});
