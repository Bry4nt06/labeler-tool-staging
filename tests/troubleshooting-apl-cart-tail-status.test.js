"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const base = require(path.join(root, "app/troubleshooting/diagnostic-library.js"));
const live = require(path.join(root, "app/troubleshooting/topmodul-live-diagnostics.js"))(base);
const data = require(path.join(root, "app/troubleshooting/topmodul-plc-fault-data.js"));
const catalog = require(path.join(root, "app/troubleshooting/topmodul-plc-fault-catalog.js"))(live, data);
const drill = require(path.join(root, "app/troubleshooting/topmodul-fault-drilldown.js"))(catalog);
const scope = require(path.join(root, "app/troubleshooting/topmodul-station-scope.js"))(drill);
const transport = require(path.join(root, "app/troubleshooting/topmodul-station-controller-trace.js"))(scope);
const cause = require(path.join(root, "app/troubleshooting/topmodul-station-cause-model.js"))(transport);
const labelerCause = require(path.join(root, "app/troubleshooting/topmodul-labeler-cause-model.js"))(cause);
const circuit = require(path.join(root, "app/troubleshooting/topmodul-circuit-trace.js"))(labelerCause);
const power = require(path.join(root, "app/troubleshooting/topmodul-station-power-circuit.js"))(circuit);
const encoder = require(path.join(root, "app/troubleshooting/topmodul-station-encoder-circuit.js"))(power);
const servo = require(path.join(root, "app/troubleshooting/topmodul-station-servo-circuit.js"))(encoder);
const tail = require(path.join(root, "app/troubleshooting/apl-cart-tail-status.js"))(servo);
const library = require(path.join(root, "app/troubleshooting/troubleshooting-search-precedence.js"))(tail);
const uiSource = fs.readFileSync(path.join(root, "app/troubleshooting/apl-cart-tail-status-ui.js"), "utf8");
const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");

const supported = [60, 64, 65, 66, 67, 68, 69, 74];
const code = (number) => String(number).padStart(5, "0");

test("v363 registers the remaining high-number Cart-local tail without duplicating field 00067", () => {
  assert.deepEqual([...tail.aplCartTailFaults], supported);
  assert.deepEqual([...tail.aplCartTailNewEntryNumbers], [60, 64, 65, 66, 68, 69, 74]);
  assert.equal(tail.getEntry("apl-cart-00067"), null);
  assert.ok(tail.getEntry("topmodul-00067-labeler-encoder-feedback"));
  for (const number of supported) assert.ok(tail.getAplCartTailPlan(number), `missing plan ${code(number)}`);
  assert.equal(tail.validate().ok, true, tail.validate().errors.join(" | "));
});

test("00060 preserves PE603 rewind-full supervision and K605163 hardware authority", () => {
  const plan = tail.getAplCartTailPlan(60);
  assert.equal(plan.status, "source-proven-timed-rewind-full");
  assert.match(plan.producer, /ParLS_Actual\.Par1\[30\]/);
  assert.match(plan.producer, /PE603/);
  assert.match(plan.producer, /I0005\.18/);
  assert.match(plan.producer, /DiameterSensorTimer\.DN/);
  assert.equal(plan.localAddress, "Faults[3].12");
  assert.ok(plan.circuitTrace.deviceRows.some((row) => row.device === "PE603"));
  assert.ok(plan.circuitTrace.drawingLocations.some((row) => row.pdfPage === 52));
});

test("00064-00069 keep direct BaseMachineEncoderAxis producers and Slot 11 AQB circuit", () => {
  const producers = {
    64: "BaseMachineEncoderAxis.ModuleFault",
    65: "BaseMachineEncoderAxis.ModuleHardwareFault",
    66: "BaseMachineEncoderAxis.ModuleSyncFault",
    67: "BaseMachineEncoderAxis.FeedbackFault",
    68: "BaseMachineEncoderAxis.FeedbackNoiseFault",
    69: "BaseMachineEncoderAxis.TimerEventFault"
  };
  for (const [numberText, producer] of Object.entries(producers)) {
    const number = Number(numberText);
    const plan = tail.getAplCartTailPlan(number);
    assert.equal(plan.producer, producer);
    assert.ok(plan.circuitTrace.deviceRows.some((row) => String(row.device).includes("1756-M02AE")), `${number} lost 1756-M02AE`);
    assert.ok(plan.circuitTrace.deviceRows.some((row) => String(row.device).includes("CN131")), `${number} lost CN131/W131`);
    assert.ok(plan.circuitTrace.drawingLocations.some((row) => row.pdfPage === 50), `${number} lost encoder drawing page`);
  }
});

test("00067 reuses the existing field/source-backed authority instead of adding a second exact entry", () => {
  const exact = library.searchEntries("00067", { machineType: "TopModul", applicationMode: "apl" }, 8);
  assert.equal(exact[0].id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(exact.some((entry) => entry.id === "apl-cart-00067"), false);
  const plan = tail.getAplCartTailPlan("00067 LABELER ENCODER FEEDBACK FAULT");
  assert.equal(plan.status, "source-proven-existing-00067-authority");
  assert.match(plan.namespaceBoundary, /does not create a duplicate 00067 entry/i);
});

test("00064 remains separate from base Labeler Fault 064 Setup Mode Switch Active", () => {
  const plan = tail.getAplCartTailPlan(64);
  assert.match(plan.namespaceBoundary, /not base Labeler Fault 064/i);
  assert.match(plan.namespaceBoundary, /Setup Mode Switch Active/i);
  const exact = library.searchEntries("00064", { machineType: "TopModul", applicationMode: "apl" }, 8);
  assert.equal(exact[0].id, "apl-cart-00064");
});

test("00074 remains catalog-only with no invented height-adjustment breaker producer", () => {
  const entry = tail.getEntry("apl-cart-00074");
  const plan = tail.getAplCartTailPlan(74);
  assert.equal(plan.status, "catalog-only-no-producer");
  assert.match(plan.producer, /No executable producer/i);
  assert.equal(plan.circuitTrace, null);
  assert.match(entry.summary, /no executable producer/i);
  assert.match(JSON.stringify(plan.watchPoints), /Producer unresolved/i);
});

test("encoder tail explicitly separates module AQB faults from Cart 00030 and main Labeler 670", () => {
  const plan = tail.getAplCartTailPlan(68);
  const text = JSON.stringify(plan.watchPoints);
  assert.match(text, /Cart Fault 030 OPTO131/i);
  assert.match(text, /main Labeler Fault 670/i);
  assert.match(text, /Do not collapse these encoder namespaces/i);
});

test("v363 UI is debounced/idempotent and does not add a self-triggering microtask loop", () => {
  assert.match(uiSource, /data-apl-cart-tail/);
  assert.match(uiSource, /renderQueued/);
  assert.match(uiSource, /global\.setTimeout\(render, 0\)/);
  assert.doesNotMatch(uiSource, /queueMicrotask\(render\)/);
});

test("v363 loader order is preserved inside v363-or-later troubleshooting builds", () => {
  const versionMatch = /data-troubleshooting-version="v(\d+)"/.exec(page);
  assert.ok(versionMatch, "troubleshooting version banner missing");
  assert.ok(Number(versionMatch[1]) >= 363, `expected v363 or later, got v${versionMatch?.[1]}`);
  assert.match(page, /troubleshooting-bootstrap-v358-20260904/);
  const servoIndex = page.indexOf("apl-cart-servo-status.js");
  const tailIndex = page.indexOf("apl-cart-tail-status.js");
  const sourceBridgeIndex = page.indexOf("topmodul-live-00067-source-bridge.js");
  const exactSearchIndex = page.indexOf("troubleshooting-search-precedence.js");
  const appIndex = page.indexOf("troubleshooting-app.js");
  const servoUiIndex = page.indexOf("apl-cart-servo-status-ui.js");
  const tailUiIndex = page.indexOf("apl-cart-tail-status-ui.js");
  assert.ok(servoIndex >= 0 && tailIndex > servoIndex && sourceBridgeIndex > tailIndex);
  assert.ok(exactSearchIndex > sourceBridgeIndex && appIndex > exactSearchIndex);
  assert.ok(tailUiIndex > servoUiIndex);
});
