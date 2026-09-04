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
const liveBridge = require("../app/troubleshooting/topmodul-live-00067-source-bridge.js")(machineStart);
const analyzer = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(liveBridge);
const encoderIsolation = require("../app/troubleshooting/topmodul-encoder-isolation.js")(analyzer);
const stackBridge = require("../app/troubleshooting/topmodul-encoder-stack-bridge.js")(encoderIsolation);
const verification = require("../app/troubleshooting/topmodul-encoder-verification.js")(stackBridge);
const library = require("../app/troubleshooting/topmodul-main-drive-isolation.js")(verification);

test("v353 machine-start layer validates through the current v352 main-drive runtime", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /machine-start-isolation-v1/);
  assert.match(library.version, /main-drive-isolation-v352/);
  assert.deepEqual([...library.topModulActiveUnnamedAlarmPositions], [699]);
});

test("Fault 699 is active internal evidence without inflating the operator-named alarm count", () => {
  assert.equal(library.topModulNamedFaultCount, 515);
  const entry = library.getTopModulFault(699);
  assert.equal(entry.code, "699");
  assert.match(entry.title, /Internal active Fault 699/i);
  assert.match(entry.title, /no HMI comment/i);
  assert.equal(entry.plcFault.address, "Faults_LB1[43].11");
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "primary");
});

test("Fault 699 retains exact PE171 watchdog logic without inventing engineering units", () => {
  const entry = library.getTopModulFault(699);
  const signals = entry.processTrace.producerSignals;
  assert.ok(signals.includes("BTL_PRES_EYE_TEST = 1"));
  assert.ok(signals.includes("CONT_STP_OPEN_CTR.PRE = 22"));
  assert.ok(signals.includes("Container_Present_PE_Blocked.PRE = 1500"));
  assert.ok(signals.includes("Container_Present_PE_Clear.PRE = 1500"));
  assert.ok(signals.includes("GRT(VSD85LB1_Node3:I.OutputFreq,5000)"));
  assert.ok(signals.includes("OTE(Faults_LB1[43].11)"));
  assert.ok(signals.includes("OTU(Control.EnableMachineOn)"));
  assert.match(entry.processTrace.scopeNote, /raw >5000.*unscaled|unscaled.*5000/i);
});

test("Fault 699 binds PE171 to K407039 page 118 and I0007.02", () => {
  const entry = library.getTopModulFault(699);
  assert.ok(entry.circuitTrace.plcSignals.includes("E1701_PE171_ContainerPresent = Local:7:I.Data.2"));
  assert.ok(entry.circuitTrace.plcSignals.includes("K407039 I0007.02"));
  assert.ok(entry.circuitTrace.deviceRows.some((row) => row.device === "PE171" && /I0007\.02/.test(row.terminals)));
  assert.ok(entry.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 118));
});

test("Fault 699 related alarms stay context evidence instead of asserted causes", () => {
  const related = library.getTopModulFaultRelations(699, 8);
  const gap = related.find((entry) => entry.number === 683);
  const speed = related.find((entry) => entry.number === 679);
  const inspection = related.find((entry) => entry.number === 673);
  assert.ok(gap && /does not produce/i.test(gap.relationReason));
  assert.ok(speed && /producer is separate/i.test(speed.relationReason));
  assert.ok(inspection && /co-occurrence does not prove causality/i.test(inspection.relationReason));
});

test("alarm-stack analyzer recognizes Fault 699 as direct producer evidence", () => {
  const stack = library.analyzeTopModulFaultStack("663, 699", { machineType: "TopModul" });
  const f699 = stack.recommended.find((item) => item.entry.number === 699);
  const f663 = stack.recommended.find((item) => item.entry.number === 663);
  assert.equal(f699.role, "direct-producer");
  assert.ok(f699.investigationScore < f663.investigationScore);
});

test("no-start symptom search resolves one shared StartStop method", () => {
  const result = library.searchEntries("machine won't start", { machineType: "TopModul" }, 4)[0];
  assert.equal(result.id, "topmodul-main-machine-start-chain");
  assert.equal(result.code, "NO-START");
  assert.match(result.summary, /Machine On latches.*controller.*enable.*contactor/i);
  assert.ok(result.checks.some((row) => /ControlOut\.EnableMachineOn/.test(row)));
  assert.ok(result.checks.some((row) => /E2001_AFD101_MainDriveEnable/.test(row)));
  assert.ok(result.checks.some((row) => /E2001_C102_MainDriveContactor/.test(row)));
  assert.ok(result.checks.some((row) => /v352 main-drive\/standstill/i.test(row)));
});

test("no-start route preserves Control to ControlOut snapshot semantics", () => {
  const trace = library.getTopModulProcessTrace("topmodul-main-machine-start-chain");
  assert.ok(trace.producerSignals.includes("CPS(Control,ControlOut,1)"));
  assert.ok(trace.producerSignals.some((row) => /ControlOut\.EnableMachineOn/.test(row)));
  assert.ok(trace.producerSignals.some((row) => /ControlOut\.InhibitControllerEnable/.test(row)));
  const entry = library.getEntry("topmodul-main-machine-start-chain");
  assert.ok(entry.checks.some((row) => /program scan\/snapshot sequence/i.test(row)));
  assert.ok(entry.safety.some((row) => /Do not force Machine On/i.test(row)));
});

test("guided no-start flow isolates MachineOn, drive enable and C102 with one terminal procedure", () => {
  const flow = library.getFlow("topmodul-machine-start");
  assert.ok(flow);
  assert.equal(flow.start, "start-alarm");
  assert.ok(flow.nodes["start-machine-on"]);
  assert.ok(flow.nodes["start-drive-enable"]);
  assert.ok(flow.nodes["start-contactor"]);
  const resultIds = new Set(Object.values(flow.nodes).flatMap((node) => node.choices || []).map((choice) => choice.result).filter(Boolean));
  assert.deepEqual([...resultIds], ["topmodul-main-machine-start-chain"]);
  assert.ok(library.recommendFlows({ machineType: "TopModul" }).some((row) => row.id === flow.id));
});

test("v353 does not collapse existing encoder or main-drive scopes", () => {
  assert.equal(library.searchEntries("00067", { machineType: "TopModul" }, 3)[0].id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(library.getTopModulFault(67).title, "Labeling Station Change Mode Active");
  assert.equal(library.getTopModulFault(670).plcFault.address, "Faults_LB1[41].14");
  assert.equal(library.getTopModulEncoderIsolationPlan(67), null);
  assert.equal(library.getTopModulEncoderIsolationPlan(670).scope, "Main Labeler encoder / fine clock");
  assert.ok(library.getTopModulMainDriveIsolationPlan(480));
  assert.equal(library.getTopModulMainDriveIsolationPlan(670), null);
});

test("browser loads v353 before live/alarm analysis while preserving v352 main-drive layer", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const gapsPos = html.indexOf("topmodul-labeler-remaining-gaps-trace.js");
  const startPos = html.indexOf("topmodul-machine-start-isolation.js");
  const liveBridgePos = html.indexOf("topmodul-live-00067-source-bridge.js");
  const alarmPos = html.indexOf("topmodul-alarm-stack-analyzer.js");
  const mainDrivePos = html.indexOf("topmodul-main-drive-isolation.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  assert.ok(gapsPos >= 0 && startPos > gapsPos && liveBridgePos > startPos && alarmPos > startPos);
  assert.ok(mainDrivePos > alarmPos && appPos > mainDrivePos);
  const match = html.match(/data-troubleshooting-version="v(\d+)"/);
  assert.ok(match && Number(match[1]) >= 353);
});
