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
const encoderCircuit = require("../app/troubleshooting/topmodul-station-encoder-circuit.js")(power);
const servo = require("../app/troubleshooting/topmodul-station-servo-circuit.js")(encoderCircuit);
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
const machineStart = require("../app/troubleshooting/topmodul-machine-start-isolation.js")(gaps);
const servoTable = require("../app/troubleshooting/topmodul-servo-table-internal-status.js")(machineStart);
const liveBridge = require("../app/troubleshooting/topmodul-live-00067-source-bridge.js")(servoTable);
const analyzer = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(liveBridge);
const encoderIsolation = require("../app/troubleshooting/topmodul-encoder-isolation.js")(analyzer);
const stackBridge = require("../app/troubleshooting/topmodul-encoder-stack-bridge.js")(encoderIsolation);
const verification = require("../app/troubleshooting/topmodul-encoder-verification.js")(stackBridge);
const library = require("../app/troubleshooting/topmodul-main-drive-isolation.js")(verification);

test("v354 Servo Bottle Table internal-status layer validates through current runtime", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /servo-table-internal-status-v1/);
  assert.match(library.version, /machine-start-isolation-v1/);
  assert.equal(library.topModulNamedFaultCount, 515);
  assert.deepEqual([...library.topModulActiveUnnamedAlarmPositions], [699, 721, 722, 723]);
  assert.deepEqual([...library.topModulDisabledUnnamedAlarmPositions], [720]);
});

test("Fault 720 remains disabled by AFI and is not promoted as a live machine fault", () => {
  const entry = library.getTopModulFault(720);
  assert.equal(entry.plcFault.address, "Faults_LB1[45].0");
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "disabled");
  assert.equal(entry.sourceGap.status, "internal-output-disabled-by-afi");
  assert.ok(entry.processTrace.producerSignals.includes("AFI()"));
  assert.match(entry.title, /disabled/i);
  assert.match(entry.title, /no HMI comment/i);
  const stack = library.analyzeTopModulFaultStack("720", { machineType: "TopModul" });
  assert.equal(stack.observed[0].role, "disabled");
});

test("Fault 721 preserves the exact inverted simulation/status semantic conflict", () => {
  const entry = library.getTopModulFault(721);
  assert.equal(entry.plcFault.address, "Faults_LB1[45].1");
  assert.ok(entry.processTrace.producerSignals.includes("E2301_IO0102_O1_EncoderSimulationOff = I0011.0"));
  assert.ok(entry.processTrace.producerSignals.includes("XIO(E2301_IO0102_O1_EncoderSimulationOff) OTE(DataExchangeStation.OutServoPowerOnline)"));
  assert.ok(entry.processTrace.producerSignals.includes("XIC(DataExchangeStation.OutServoPowerOnline) OTE(Faults_LB1[45].1)"));
  assert.match(entry.processTrace.status, /semantic-conflict/i);
  assert.ok(entry.checks.some((row) => /do not infer a power-terminal failure/i.test(row)));
  assert.match(entry.title, /no HMI comment/i);
});

test("Fault 722 binds System Online missing to I0011.03 and K407039 page 142", () => {
  const entry = library.getTopModulFault(722);
  assert.equal(entry.plcFault.address, "Faults_LB1[45].2");
  assert.ok(entry.processTrace.producerSignals.includes("E2301_IO0102_O4_SystemOnline = I0011.3"));
  assert.ok(entry.processTrace.producerSignals.includes("XIO(DataExchangeStation.OutSystemOnline) OTE(Faults_LB1[45].2)"));
  assert.equal(entry.circuitTrace.deviceRows[0].terminals, "I/O061 I0011.03");
  assert.ok(entry.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 142));
  const stack = library.analyzeTopModulFaultStack("722", { machineType: "TopModul" });
  assert.equal(stack.observed[0].role, "direct-producer");
});

test("Fault 723 requires Servo Ready missing while the executable operating-mode bit is true", () => {
  const entry = library.getTopModulFault(723);
  assert.equal(entry.plcFault.address, "Faults_LB1[45].3");
  assert.ok(entry.processTrace.producerSignals.includes("E2301_IO0102_O5_ServoReady = I0011.4"));
  assert.ok(entry.processTrace.producerSignals.includes("XIO(DataExchangeStation.OutServoReady) XIC(E0901_SS501_OperatingMode) OTE(Faults_LB1[45].3)"));
  assert.equal(entry.circuitTrace.deviceRows[0].terminals, "I/O061 I0011.04");
  assert.match(entry.processTrace.scopeNote, /no operator-facing COMMENT name/i);
});

test("internal Servo Table status search is useful without inventing operator alarm names", () => {
  const online = library.searchEntries("servo table system online", { machineType: "TopModul" }, 5)[0];
  assert.equal(online.number, 722);
  assert.match(online.title, /Internal active Fault 722/i);
  assert.match(online.title, /no HMI comment/i);
  const ready = library.searchEntries("servo ready", { machineType: "TopModul" }, 5);
  assert.ok(ready.some((entry) => entry.number === 723));
  const related = library.getTopModulFaultRelations(722, 5);
  assert.ok(related.some((entry) => entry.number === 721));
  assert.ok(related.every((entry) => /no causal direction is asserted/i.test(entry.relationReason)));
});

test("v354 browser loader places internal statuses before live/alarm analysis and exposes v354 banner", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const machineStartPos = html.indexOf("topmodul-machine-start-isolation.js");
  const servoTablePos = html.indexOf("topmodul-servo-table-internal-status.js");
  const liveBridgePos = html.indexOf("topmodul-live-00067-source-bridge.js");
  const analyzerPos = html.indexOf("topmodul-alarm-stack-analyzer.js");
  assert.ok(machineStartPos >= 0 && servoTablePos > machineStartPos && liveBridgePos > servoTablePos && analyzerPos > liveBridgePos);
  const bannerVersion = Number(/data-troubleshooting-version="v(\d+)"/.exec(html)?.[1] || 0);
  assert.ok(bannerVersion >= 354);
  assert.match(html, /topmodul-servo-table-internal-status\.js\?v=0\.9\.10&build=troubleshooting-servo-table-internal-status-v354-20260904&shell=v358/);
});
