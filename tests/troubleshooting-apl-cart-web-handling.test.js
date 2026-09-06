"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const base = require(path.join(root, "app/troubleshooting/diagnostic-library.js"));
const extendFoundation = require(path.join(root, "app/troubleshooting/apl-cart-foundation.js"));
const extendWeb = require(path.join(root, "app/troubleshooting/apl-cart-web-handling.js"));
const extendSearch = require(path.join(root, "app/troubleshooting/troubleshooting-search-precedence.js"));
const foundation = extendFoundation(base);
const web = extendWeb(foundation);
const library = extendSearch(web);
const uiSource = fs.readFileSync(path.join(root, "app/troubleshooting/apl-cart-web-handling-ui.js"), "utf8");
const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");

const supported = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
const code = (number) => String(number).padStart(5, "0");

test("v361 adds the exact APL Cart 00021-00030 family from the readable Cart 1 export", () => {
  assert.deepEqual([...web.aplCartWebHandlingFaults], supported);
  supported.forEach((number) => {
    const entry = web.getEntry(`apl-cart-${code(number)}`);
    const plan = web.getAplCartWebHandlingPlan(number);
    assert.ok(entry, `missing entry ${code(number)}`);
    assert.equal(entry.code, code(number));
    assert.ok(plan, `missing plan ${code(number)}`);
    assert.equal(plan.source.file, "CO85_LB1_APLCart_1.L5K");
    assert.match(plan.scope, /LB1 APL Cart 1/);
  });
  assert.equal(library.validate().ok, true, library.validate().errors.join(" | "));
});

test("00024 remains catalog-only because Faults[1].8 has no executable producer in the supplied export", () => {
  const entry = web.getEntry("apl-cart-00024");
  const plan = web.getAplCartWebHandlingPlan(24);
  assert.equal(plan.status, "catalog-only-no-producer");
  assert.match(plan.producer, /No executable reference to Faults\[1\]\.8/i);
  assert.match(entry.summary, /no executable reference/i);
  assert.equal(plan.observations.length, 0);
});

test("00023 and 00027 preserve the exact sensor/timer producers", () => {
  const tear = web.getAplCartWebHandlingPlan(23);
  assert.match(tear.producer, /PE641/i);
  assert.match(tear.producer, /20 ms/i);
  assert.match(tear.producer, /Faults\[1\]\.7/);

  const plausibility = web.getAplCartWebHandlingPlan(27);
  assert.match(plausibility.producer, /PE621/i);
  assert.match(plausibility.producer, /PE622/i);
  assert.match(plausibility.producer, /100 ms/i);
  assert.match(plausibility.producer, /Faults\[1\]\.11/);
});

test("00025 keeps end-of-reel routing configuration and active recipe counters machine-specific", () => {
  const plan = web.getAplCartWebHandlingPlan(25);
  const text = JSON.stringify(plan);
  assert.match(text, /ParLS_Actual\.Par1\[27\]/);
  assert.match(text, /InputDetectEndOfReel1/);
  assert.match(text, /InputDetectEndOfReel2/);
  assert.match(text, /CtuEndOfReel1/);
  assert.match(text, /CtuEndOfReel2/);
  assert.match(text, /RunWithoutLabels/);
  assert.match(text, /machine-specific|recipe/i);
});

test("00026 preserves PLC scan-count semantics instead of converting thresholds to milliseconds", () => {
  const plan = web.getAplCartWebHandlingPlan(26);
  const text = JSON.stringify(plan);
  assert.match(plan.producer, /CountRearCovered >20/);
  assert.match(plan.producer, /CountFrontFree >4/);
  assert.match(text, /PLC scan counters/i);
  assert.match(text, /not milliseconds/i);
});

test("00028 keeps both rewinder-jam producer branches separate", () => {
  const plan = web.getAplCartWebHandlingPlan(28);
  const text = JSON.stringify(plan);
  assert.match(plan.producer, /Rewinder timeout\/two-cycle/i);
  assert.match(plan.producer, /FixedArm\.DN/);
  assert.match(text, /RewinderTimeout/i);
  assert.match(text, /PLC-cycle/i);
});

test("00029 preserves source decision value and PLC-cycle counter semantics", () => {
  const entry = web.getEntry("apl-cart-00029");
  const plan = web.getAplCartWebHandlingPlan(29);
  const text = JSON.stringify(plan);
  assert.match(plan.producer, />29000/);
  assert.match(plan.producer, /WebBreakTime PLC-cycle count >1000/i);
  assert.match(entry.summary, /1000 PLC cycles/i);
  assert.match(text, /not a 1000 ms timer/i);
  assert.match(text, /internal source decision value/i);
});

test("00030 stays separate from Station 00067 and main Labeler 670", () => {
  const plan = web.getAplCartWebHandlingPlan(30);
  const text = JSON.stringify(plan);
  assert.match(plan.producer, /DelayFaultEncoderMon 50 ms/);
  assert.match(plan.producer, /OPTO131/i);
  assert.match(text, /00067/);
  assert.match(text, /670/);
  assert.match(text, /not Station 00067/i);
  assert.match(text, /not main Labeler Fault 670/i);
});

test("v360 exact-search precedence remains authoritative over APL context after v361 imports", () => {
  const exact = library.searchEntries("00025", { machineType: "TopModul", applicationMode: "apl" }, 8);
  assert.equal(exact[0].id, "apl-cart-00025");

  const unrelated = web.searchEntries("600", { machineType: "TopModul", applicationMode: "apl" }, 8);
  assert.equal(unrelated.some((entry) => /^apl-cart-0002[1-9]$|^apl-cart-00030$/.test(entry.id)), false, "APL context alone must not create v361 text matches");
});

test("v361 UI is idempotent/debounced and does not recreate the earlier microtask observer loop", () => {
  assert.match(uiSource, /data-apl-cart-web/);
  assert.match(uiSource, /renderQueued/);
  assert.match(uiSource, /global\.setTimeout\(render, 0\)/);
  assert.doesNotMatch(uiSource, /queueMicrotask\(render\)/);
});

test("v361 web handling remains loaded under v363-or-later with v362 tail adjacency, v360 exact search, and the v358 bootstrap", () => {
  const versionMatch = /data-troubleshooting-version="v(\d+)"/.exec(page);
  assert.ok(versionMatch, "troubleshooting version banner missing");
  assert.ok(Number(versionMatch[1]) >= 363, `expected v363 or later, got v${versionMatch?.[1]}`);
  assert.match(page, /troubleshooting-bootstrap-v358-20260904/);
  const foundationIndex = page.indexOf("apl-cart-foundation.js");
  const webIndex = page.indexOf("apl-cart-web-handling.js");
  const servoIndex = page.indexOf("apl-cart-servo-status.js");
  const tailIndex = page.indexOf("apl-cart-tail-status.js");
  const exactSearchIndex = page.indexOf("troubleshooting-search-precedence.js");
  const guardIndex = page.indexOf("troubleshooting-startup-guard.js");
  const appIndex = page.indexOf("troubleshooting-app.js");
  const foundationUiIndex = page.indexOf("apl-cart-foundation-ui.js");
  const webUiIndex = page.indexOf("apl-cart-web-handling-ui.js");
  const servoUiIndex = page.indexOf("apl-cart-servo-status-ui.js");
  const tailUiIndex = page.indexOf("apl-cart-tail-status-ui.js");
  assert.ok(foundationIndex >= 0 && webIndex > foundationIndex && servoIndex > webIndex && tailIndex > servoIndex);
  assert.ok(exactSearchIndex > tailIndex && guardIndex > exactSearchIndex && appIndex > guardIndex);
  assert.ok(webUiIndex > foundationUiIndex && servoUiIndex > webUiIndex && tailUiIndex > servoUiIndex);
});
