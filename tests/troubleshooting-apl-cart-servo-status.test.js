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
const stationCause = require(path.join(root, "app/troubleshooting/topmodul-station-cause-model.js"))(transport);
const labelerCause = require(path.join(root, "app/troubleshooting/topmodul-labeler-cause-model.js"))(stationCause);
const exactCircuit = require(path.join(root, "app/troubleshooting/topmodul-circuit-trace.js"))(labelerCause);
const stationPower = require(path.join(root, "app/troubleshooting/topmodul-station-power-circuit.js"))(exactCircuit);
const stationEncoder = require(path.join(root, "app/troubleshooting/topmodul-station-encoder-circuit.js"))(stationPower);
const stationServo = require(path.join(root, "app/troubleshooting/topmodul-station-servo-circuit.js"))(stationEncoder);
const foundation = require(path.join(root, "app/troubleshooting/apl-cart-foundation.js"))(stationServo);
const web = require(path.join(root, "app/troubleshooting/apl-cart-web-handling.js"))(foundation);
const servoLocal = require(path.join(root, "app/troubleshooting/apl-cart-servo-status.js"))(web);
const library = require(path.join(root, "app/troubleshooting/troubleshooting-search-precedence.js"))(servoLocal);
const uiSource = fs.readFileSync(path.join(root, "app/troubleshooting/apl-cart-servo-status-ui.js"), "utf8");
const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");

const supported = Array.from({ length: 23 }, (_, index) => 32 + index);
const active = supported.filter((number) => ![40, 49].includes(number));
const code = (number) => String(number).padStart(5, "0");

test("v362 bridges Cart-local HMI 00032-00054 without cloning the shared Station servo owner", () => {
  assert.deepEqual([...servoLocal.aplCartServoStatusFaults], supported);
  assert.deepEqual([...servoLocal.aplCartServoStatusActiveFaults], active);
  assert.deepEqual([...servoLocal.aplCartServoStatusInactiveFaults], [40, 49]);
  supported.forEach((number) => {
    const entry = servoLocal.getEntry(`apl-cart-${code(number)}`);
    const plan = servoLocal.getAplCartServoStatusPlan(number);
    assert.ok(entry, `missing local entry ${code(number)}`);
    assert.equal(entry.code, code(number));
    assert.ok(plan, `missing local plan ${code(number)}`);
    assert.equal(plan.sharedStationTemplateId, `topmodul-station-template-${number}`);
    assert.equal(plan.localAddress, `Faults[${Math.floor(number / 16)}].${number % 16}`);
    assert.equal(plan.stationGlobalMap.length, 6);
  });
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join(" | "));
});

test("five-digit Cart-local 00032 stays separate from base Labeler Fault 032", () => {
  const local = library.searchEntries("00032", { machineType: "TopModul", applicationMode: "apl" }, 5);
  assert.equal(local[0].id, "apl-cart-00032");
  assert.equal(local[0].title, "Servo Axis / Commutation Fault");
  assert.equal(library.getTopModulFault(32).title, "Door Closed - Push Reset");
  const threeDigitExact = library.getExactSearchMatches("032");
  assert.equal(threeDigitExact.some((entry) => entry.id === "apl-cart-00032"), false);
  assert.equal(threeDigitExact.some((entry) => entry.number === 32 && entry.title === "Door Closed - Push Reset"), true);
});

test("active local servo faults reuse the exact shared MainDriveAxis producer and circuitTrace", () => {
  for (const number of active) {
    const plan = servoLocal.getAplCartServoStatusPlan(number);
    const template = servoLocal.getStationFaultTemplate(number);
    assert.equal(plan.status, "source-proven-direct-servo-status", code(number));
    assert.equal(plan.producer, template.stationControllerTrace.directTriggerTag, code(number));
    assert.equal(plan.circuitTrace, template.circuitTrace, `${code(number)} must reuse shared circuitTrace`);
  }
  assert.equal(servoLocal.getAplCartServoStatusPlan(32).producer, "MainDriveAxis.CommutationFault");
  assert.equal(servoLocal.getAplCartServoStatusPlan(53).producer, "MainDriveAxis.SERCOSRingFault");
});

test("00040 and 00049 remain inactive Logic_0 source positions", () => {
  for (const number of [40, 49]) {
    const plan = servoLocal.getAplCartServoStatusPlan(number);
    assert.equal(plan.status, "inactive-logic0-source-position");
    assert.match(plan.producer, /Logic_0/);
    assert.equal(plan.circuitTrace, null);
    assert.equal(plan.observations.length, 0);
    assert.match(plan.evidence.logicType, /disabled/i);
    const evaluation = servoLocal.evaluateAplCartServoStatus(number, {});
    assert.equal(evaluation.code, "inactive-source-position");
  }
});

test("motor-feedback, power-phase, and SERCOS families retain their existing K605163 routes", () => {
  const feedback = servoLocal.getAplCartServoStatusPlan(45).circuitTrace;
  assert.ok(feedback.deviceRows.some((row) => row.cable === "2001-W121"));
  assert.ok(!feedback.deviceRows.some((row) => row.cable === "2001-W131"));

  const phase = servoLocal.getAplCartServoStatusPlan(52).circuitTrace;
  assert.ok(phase.deviceRows.some((row) => /F101/.test(row.device)));
  assert.ok(phase.drawingLocations.some((row) => row.pdfPage === 46));

  const sercos = servoLocal.getAplCartServoStatusPlan(53).circuitTrace;
  assert.ok(sercos.deviceRows.some((row) => /COM081/.test(row.device)));
  assert.ok(sercos.drawingLocations.some((row) => row.pdfPage === 47));
});

test("Cart-local servo offsets keep all six base-Labeler Station destinations", () => {
  assert.deepEqual(servoLocal.getAplCartServoStatusPlan(32).stationGlobalMap.map((row) => row.globalNumber), [1056, 1136, 1216, 1296, 1376, 1456]);
  assert.deepEqual(servoLocal.getAplCartServoStatusPlan(54).stationGlobalMap.map((row) => row.globalNumber), [1078, 1158, 1238, 1318, 1398, 1478]);
  servoLocal.getAplCartServoStatusPlan(32).stationGlobalMap.forEach((row) => {
    assert.match(row.labelerCopy, /CPS\(DataFromLS/);
    assert.match(row.globalAddress, /Faults_LB1/);
  });
});

test("v362 UI remains idempotent/debounced and exposes local/global/circuit evidence", () => {
  assert.match(uiSource, /data-apl-cart-servo/);
  assert.match(uiSource, /renderQueued/);
  assert.match(uiSource, /global\.setTimeout\(render, 0\)/);
  assert.doesNotMatch(uiSource, /queueMicrotask\(render\)/);
  assert.match(uiSource, /Cart-local → base-Labeler Station destinations/);
  assert.match(uiSource, /Shared Station servo circuit authority/);
});

test("v362 servo-status coverage remains loaded under v363-or-later with v360 exact search and the v358 bootstrap", () => {
  const versionMatch = /data-troubleshooting-version="v(\d+)"/.exec(page);
  assert.ok(versionMatch, "troubleshooting version banner missing");
  assert.ok(Number(versionMatch[1]) >= 363, `expected v363 or later, got v${versionMatch?.[1]}`);
  assert.match(page, /troubleshooting-bootstrap-v358-20260904/);
  const foundationIndex = page.indexOf("apl-cart-foundation.js");
  const webIndex = page.indexOf("apl-cart-web-handling.js");
  const servoIndex = page.indexOf("apl-cart-servo-status.js");
  const tailIndex = page.indexOf("apl-cart-tail-status.js");
  const sourceBridgeIndex = page.indexOf("topmodul-live-00067-source-bridge.js");
  const searchIndex = page.indexOf("troubleshooting-search-precedence.js");
  const appIndex = page.indexOf("troubleshooting-app.js");
  const webUiIndex = page.indexOf("apl-cart-web-handling-ui.js");
  const servoUiIndex = page.indexOf("apl-cart-servo-status-ui.js");
  const tailUiIndex = page.indexOf("apl-cart-tail-status-ui.js");
  assert.ok(foundationIndex >= 0 && webIndex > foundationIndex && servoIndex > webIndex && tailIndex > servoIndex);
  assert.ok(sourceBridgeIndex > tailIndex && searchIndex > sourceBridgeIndex && appIndex > searchIndex);
  assert.ok(servoUiIndex > webUiIndex && tailUiIndex > servoUiIndex);
  assert.match(page, /troubleshooting-apl-cart-servo-status-v362-20260904&shell=v358/);
  assert.match(page, /troubleshooting-apl-cart-tail-v363-20260904&shell=v358/);
});
