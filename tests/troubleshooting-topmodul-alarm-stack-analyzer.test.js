"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const base = require("../app/troubleshooting/diagnostic-library.js");
const live = require("../app/troubleshooting/topmodul-live-diagnostics.js")(base);
const data = require("../app/troubleshooting/topmodul-plc-fault-data.js");
const catalog = require("../app/troubleshooting/topmodul-plc-fault-catalog.js")(live, data);
const drill = require("../app/troubleshooting/topmodul-fault-drilldown.js")(catalog);
const scope = require("../app/troubleshooting/topmodul-station-scope.js")(drill);
const transport = require("../app/troubleshooting/topmodul-station-controller-trace.js")(scope);
const stationCause = require("../app/troubleshooting/topmodul-station-cause-model.js")(transport);
const labelerCause = require("../app/troubleshooting/topmodul-labeler-cause-model.js")(stationCause);
const circuit = require("../app/troubleshooting/topmodul-circuit-trace.js")(labelerCause);
const power = require("../app/troubleshooting/topmodul-station-power-circuit.js")(circuit);
const encoder = require("../app/troubleshooting/topmodul-station-encoder-circuit.js")(power);
const servo = require("../app/troubleshooting/topmodul-station-servo-circuit.js")(encoder);
const communication = require("../app/troubleshooting/topmodul-station-communication-circuit.js")(servo);
const stationProcess = require("../app/troubleshooting/topmodul-station-process-trace.js")(communication);
const foundation = require("../app/troubleshooting/topmodul-station-foundation-circuit.js")(stationProcess);
const safety = require("../app/troubleshooting/topmodul-labeler-safety-circuit.js")(foundation);
const driveUtilities = require("../app/troubleshooting/topmodul-labeler-drive-utilities-circuit.js")(safety);
const rpc = require("../app/troubleshooting/topmodul-rpc-method-bridge.js")(driveUtilities);
const labelerCommunication = require("../app/troubleshooting/topmodul-labeler-communication-circuit.js")(rpc);
const containerFlow = require("../app/troubleshooting/topmodul-labeler-container-flow-trace.js")(labelerCommunication);
const protection = require("../app/troubleshooting/topmodul-labeler-electrical-protection.js")(containerFlow);
const lubrication = require("../app/troubleshooting/topmodul-labeler-lubrication-trace.js")(protection);
const inspection = require("../app/troubleshooting/topmodul-labeler-inspection-coder-trace.js")(lubrication);
const operatingState = require("../app/troubleshooting/topmodul-labeler-operating-state-trace.js")(inspection);
const gaps = require("../app/troubleshooting/topmodul-labeler-remaining-gaps-trace.js")(operatingState);
const library = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(gaps);

test("v346 alarm-stack analyzer validates without changing the 515-fault active catalog", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /alarm-stack-analyzer-v1/);
  assert.equal(library.topModulNamedFaultCount, 515);
});

test("observed order is preserved while a stronger verified producer can rank first", () => {
  const result = library.analyzeTopModulFaultStack("663, 1091");
  assert.deepEqual(result.observed.map((item) => item.entry.number), [663, 1091]);
  assert.equal(result.recommended[0].entry.number, 1091);
  assert.equal(result.chronologyAgreement, false);
  assert.match(result.guidance, /Observed HMI order is preserved/i);
});

test("field HMI 00067 stays distinct from PLC Fault 067 inside one alarm stack", () => {
  const result = library.analyzeTopModulFaultStack("00067, 067");
  assert.equal(result.observed.length, 2);
  assert.equal(result.observed[0].entry.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(result.observed[0].entry.plcFault, undefined);
  assert.equal(result.observed[1].entry.number, 67);
  assert.equal(result.observed[1].entry.title, "Labeling Station Change Mode Active");
});

test("source-gap and inactive alarms rank behind verified active producer evidence", () => {
  const result = library.analyzeTopModulFaultStack("489, 641, 697, 719");
  assert.equal(result.recommended[0].entry.number, 719);
  for (const number of [489, 641, 697]) {
    const item = result.recommended.find((row) => row.entry.number === number);
    assert.ok(item);
    assert.ok(["source-gap", "disabled"].includes(item.role));
  }
});

test("duplicate alarm codes collapse without changing first observed position", () => {
  const result = library.analyzeTopModulFaultStack("673, 674, 673, 695");
  assert.deepEqual(result.observed.map((item) => item.entry.number), [673, 674, 695]);
  assert.equal(result.counts.resolved, 3);
});

test("station readiness summary is classified below direct station encoder evidence", () => {
  const result = library.analyzeTopModulFaultStack("1091, 663");
  const encoderFeedback = result.observed.find((item) => item.entry.number === 1091);
  const notReady = result.observed.find((item) => item.entry.number === 663);
  assert.ok(["direct-producer", "verified-producer"].includes(encoderFeedback.role));
  assert.equal(notReady.role, "downstream-summary");
  assert.ok(encoderFeedback.priority < notReady.priority);
});

test("recovered faults 700 and 719 participate in stack analysis", () => {
  const result = library.analyzeTopModulFaultStack("700, 673, 719");
  assert.deepEqual(result.observed.map((item) => item.entry.number), [700, 673, 719]);
  assert.equal(result.observed.find((item) => item.entry.number === 700).entry.plcFault.address, "Faults_LB1[43].12");
  assert.equal(result.observed.find((item) => item.entry.number === 719).entry.plcFault.address, "Faults_LB1[44].15");
});

test("browser loads analyzer after v345 and UI after the main troubleshooting controller", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const gapsPos = html.indexOf("topmodul-labeler-remaining-gaps-trace.js");
  const analyzerPos = html.indexOf("topmodul-alarm-stack-analyzer.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  const uiPos = html.indexOf("topmodul-alarm-stack-ui.js");
  assert.ok(gapsPos >= 0 && analyzerPos > gapsPos && appPos > analyzerPos && uiPos > appPos);
  assert.match(html, /data-troubleshooting-version="v346"/);
  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-alarm-stack-ui.js"), "utf8");
  assert.match(ui, /Alarm stack \/ first-fault analyzer/);
  assert.match(ui, /Observed order/);
  assert.match(ui, /Investigation order/);
  assert.match(ui, /do not replace the chronology with the ranking/i);
});
