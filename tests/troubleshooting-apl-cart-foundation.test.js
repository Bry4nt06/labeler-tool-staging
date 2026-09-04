"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const base = require("../app/troubleshooting/diagnostic-library.js");
const library = require("../app/troubleshooting/apl-cart-foundation.js")(base);

test("v355 APL Cart foundation layer validates and registers the readable Cart 1 source", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /apl-cart-foundation-v355/);
  assert.deepEqual([...library.aplCartFoundationFaults], [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.equal(library.aplCartFoundationSource.file, "CO85_LB1_APLCart_1.L5K");
  assert.equal(library.aplCartFoundationSource.controller, "CO85_LB1_APLCart_1_V35");
  assert.equal(library.getSource("lb1-aplcart-readable-l5k-v355").status, "indexed-readable-export");
});

test("exact APL Cart HMI numbers resolve to the new source-backed entries", () => {
  for (const number of library.aplCartFoundationFaults) {
    const code = String(number).padStart(5, "0");
    const first = library.searchEntries(code, { applicationMode: "apl" }, 4)[0];
    assert.equal(first.code, code, `Expected ${code} to be the exact first search result`);
    assert.match(first.category, /APL Cart/);
  }
});

test("Fault 00005 preserves the source's equal-state timer semantics and 1500 ms monitor", () => {
  const plan = library.getAplCartFoundationPlan("00005");
  assert.match(plan.producer, /both=0/);
  assert.match(plan.producer, /1500 ms/);
  assert.ok(plan.watchPoints.some((row) => /O0007\.11/.test(row.tag)));
  assert.ok(plan.watchPoints.some((row) => /I0005\.22/.test(row.tag) && /polarity/i.test(row.caution)));
  assert.equal(library.evaluateAplCartFoundation(5, { command: "1", feedback: "1", timerDone: "yes" }).code, "main-contactor-source-condition");
  assert.equal(library.evaluateAplCartFoundation(5, { command: "1", feedback: "0", timerDone: "yes" }).code, "main-contactor-condition-not-current");
});

test("Fault 00008 remains catalog-visible without an invented producer", () => {
  const plan = library.getAplCartFoundationPlan(8);
  assert.equal(plan.status, "catalog-only-no-producer");
  assert.match(plan.producer, /No executable reference to Faults\[0\]\.8/);
  assert.ok(plan.watchPoints.some((row) => /I0005\.27/.test(row.tag) && /not bound/i.test(row.caution)));
  assert.equal(library.evaluateAplCartFoundation(8).code, "catalog-only-no-producer");
});

test("Faults 00009 and 00010 preserve installation-phase Ready-bit compatibility inputs", () => {
  const feed = library.getAplCartFoundationPlan(9);
  const rewind = library.getAplCartFoundationPlan(10);
  assert.match(feed.producer, /1000 ms/);
  assert.match(rewind.producer, /1000 ms/);
  assert.ok(feed.watchPoints.some((row) => row.tag === "I0005.7 / I0005.25" && /installation/i.test(row.caution)));
  assert.ok(rewind.watchPoints.some((row) => row.tag === "I0005.6 / I0005.24" && /installation/i.test(row.caution)));
  assert.equal(library.evaluateAplCartFoundation(9, { ready: "0", contactorInput: "0", timerDone: "yes" }).code, "unit-ready-timer-direct");
  assert.equal(library.evaluateAplCartFoundation(10, { ready: "0", contactorInput: "0", timerDone: "yes" }).code, "unit-ready-timer-direct");
});

test("Faults 00011-00013 bind the GSV producers to local 1756-ENBT/A Slots 1, 2 and 4", () => {
  for (const [number, slot] of [[11, 1], [12, 2], [13, 4]]) {
    const plan = library.getAplCartFoundationPlan(number);
    assert.match(plan.producer, /GSV\(MODULE/);
    assert.match(plan.sourceRefs.join(" "), new RegExp(`Slot ${slot}`));
    assert.match(plan.sourceRefs.join(" "), /1756-ENBT\/A/);
    assert.equal(library.evaluateAplCartFoundation(number, { moduleFault: "nonzero" }).code, "ethernet-module-faultcode-direct");
  }
});

test("Fault 00014 preserves the latched Level-3 readiness and HMI state branches", () => {
  const plan = library.getAplCartFoundationPlan(14);
  assert.match(plan.producer, /ReadyForETHConnect_L3/);
  assert.match(plan.producer, /100\/101/);
  assert.equal(library.evaluateAplCartFoundation(14, { readyL3: "0", pvState: "other" }).code, "base-machine-comms-direct");
  assert.equal(library.evaluateAplCartFoundation(14, { readyL3: "1", pvState: "100or101" }).code, "base-machine-comms-direct");
});

test("Faults 00015-00019 retain exact module, motion, and calculated producer conditions", () => {
  const f15 = library.getAplCartFoundationPlan(15);
  assert.match(f15.producer, /Local:7:I\.FuseBlown/);
  assert.match(f15.sourceRefs.join(" "), /1756-OB16E/);
  assert.equal(library.evaluateAplCartFoundation(15, { fuseBlown: "nonzero" }).code, "output-fuse-direct");

  assert.match(library.getAplCartFoundationPlan(16).producer, /MotionGroup\.GroupSynced/);
  assert.equal(library.evaluateAplCartFoundation(16, { groupSynced: "0", powerOnReset: "1" }).code, "motion-group-direct");

  assert.match(library.getAplCartFoundationPlan(17).producer, /MSO\[0\]\.ER/);
  assert.equal(library.evaluateAplCartFoundation(17, { msoError: "1", msoEnable: "1", readyFeedback: "1" }).code, "mso-feedback-on-direct");

  assert.match(library.getAplCartFoundationPlan(18).producer, /Sync_Distance,0/);
  assert.equal(library.evaluateAplCartFoundation(18, { syncDistance: "negative" }).code, "sync-distance-direct");

  const f19 = library.getAplCartFoundationPlan(19);
  assert.match(f19.producer, /OverallMovementPercent,125/);
  assert.ok(f19.watchPoints.some((row) => /125/.test(row.caution) && /not a field acceptance target/i.test(row.caution)));
  assert.equal(library.evaluateAplCartFoundation(19, { movementPercent: "over125" }).code, "movement-percent-direct");
});

test("v355 browser loader and UI are registered after the current v354 diagnostic engine", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const v354Pos = html.indexOf("topmodul-servo-table-internal-status.js");
  const enginePos = html.indexOf("apl-cart-foundation.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  const uiPos = html.indexOf("apl-cart-foundation-ui.js");
  assert.ok(v354Pos >= 0 && enginePos > v354Pos && appPos > enginePos && uiPos > appPos);
  const bannerVersion = Number(/data-troubleshooting-version="v(\d+)"/.exec(html)?.[1] || 0);
  assert.ok(bannerVersion >= 355);
  assert.match(html, /apl-cart-foundation\.js\?v=0\.9\.10&build=troubleshooting-apl-cart-foundation-v355-20260904&shell=v358/);
  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/apl-cart-foundation-ui.js"), "utf8");
  assert.match(ui, /APL Cart source isolation/);
  assert.match(ui, /interpret observed PLC states only/);
  assert.match(ui, /Do not assume another Cart\/controller revision is identical/);
});
