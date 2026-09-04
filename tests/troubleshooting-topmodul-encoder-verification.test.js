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
const liveBridge = require("../app/troubleshooting/topmodul-live-00067-source-bridge.js")(gaps);
const analyzer = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(liveBridge);
const isolation = require("../app/troubleshooting/topmodul-encoder-isolation.js")(analyzer);
const stackBridge = require("../app/troubleshooting/topmodul-encoder-stack-bridge.js")(isolation);
const library = require("../app/troubleshooting/topmodul-encoder-verification.js")(stackBridge);

test("v350 read-only encoder verification matrix validates on top of v349", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /encoder-verification-v1/);
  assert.deepEqual([...library.topModulEncoderVerificationOffsets], [64, 65, 66, 67, 68, 69]);
});

test("field HMI 00067 exposes exact FeedbackFault and read-only runtime motion evidence without inventing Station", () => {
  const plan = library.getTopModulEncoderVerification("00067");
  assert.equal(plan.station, null);
  assert.equal(plan.fieldObserved, true);
  assert.equal(plan.directStatus.tag, "BaseMachineEncoderAxis.FeedbackFault");
  assert.equal(plan.directStatus.localFaultBit, "Faults[4].3");
  assert.ok(plan.runtimeWatchPoints.some((row) => row.tag === "BaseMachineEncoderAxis.ActualPosition"));
  assert.ok(plan.runtimeWatchPoints.some((row) => row.tag === "BaseMachineEncoderAxis.ActualVelocity"));
  assert.ok(plan.runtimeWatchPoints.some((row) => row.tag === "BaseMachineEncoderAxis.AverageVelocity"));
  assert.ok(plan.runtimeWatchPoints.some((row) => row.tag === "BaseMachineEncoderAxis.ServoFault"));
});

test("ActualVelocity threshold and AverageVelocity scaling are presented as source relationships, not field acceptance limits", () => {
  const plan = library.getTopModulEncoderVerification(1091);
  const actualVelocity = plan.runtimeWatchPoints.find((row) => row.tag === "BaseMachineEncoderAxis.ActualVelocity");
  const averageVelocity = plan.runtimeWatchPoints.find((row) => row.tag === "BaseMachineEncoderAxis.AverageVelocity");
  assert.match(actualVelocity.caution, /does not establish.*general diagnostic acceptance limit|not redefine 10/i);
  assert.match(averageVelocity.sourceRelationship, /0\.006/);
  assert.match(averageVelocity.sourceRelationship, /Data_To_PV\.Data\[30\]\/\[31\]/);
  assert.match(averageVelocity.caution, /not a recommendation to change scaling/i);
});

test("ServoFault remains aggregate evidence while the six direct status tags remain subtype authority", () => {
  const plan = library.getTopModulEncoderVerification(1091);
  const servoFault = plan.runtimeWatchPoints.find((row) => row.tag === "BaseMachineEncoderAxis.ServoFault");
  assert.match(servoFault.role, /Aggregate axis fault/i);
  assert.match(servoFault.interpretation, /six exact encoder status bits separately/i);
  assert.deepEqual(plan.statusRows.map((row) => row.tag), [
    "BaseMachineEncoderAxis.ModuleFault",
    "BaseMachineEncoderAxis.ModuleHardwareFault",
    "BaseMachineEncoderAxis.ModuleSyncFault",
    "BaseMachineEncoderAxis.FeedbackFault",
    "BaseMachineEncoderAxis.FeedbackNoiseFault",
    "BaseMachineEncoderAxis.TimerEventFault"
  ]);
});

test("exact Slot 11 feedback-only AQB configuration is retained as immutable source evidence", () => {
  const config = library.getTopModulEncoderVerification(1091).configuration;
  assert.equal(config.module, "EEP_APL_Slot11");
  assert.equal(config.catalogNumber, "1756-M02AE");
  assert.equal(config.slot, 11);
  assert.equal(config.motionChannel, "EEP_APL_Slot11:Ch0");
  assert.equal(config.axisType, "Feedback Only");
  assert.equal(config.feedbackType, "AQB - A Quadrature B");
  assert.equal(config.feedbackFaultAction, "Shutdown");
  assert.equal(config.feedbackNoiseFaultAction, "Status Only");
  assert.equal(config.positionUnwind, 20000);
  assert.equal(config.conversionConstant, 2);
});

test("Feedback Noise preserves Status Only axis action and separate application-level Machine Jog/On response", () => {
  const plan = library.getTopModulEncoderVerification(1092);
  assert.equal(plan.directStatus.tag, "BaseMachineEncoderAxis.FeedbackNoiseFault");
  assert.equal(plan.directStatus.axisAction, "FeedbackNoiseFaultAction = Status Only");
  assert.match(plan.directStatus.applicationResponse, /unlatches Control\.EnableMachineJog and Control\.EnableMachineOn/);
  assert.ok(plan.interpretationRules.some((rule) => /Status Only/.test(rule.meaning) && /application/i.test(rule.meaning)));
});

test("one shared verification method substitutes Station destination without cloning internal procedure", () => {
  const station1 = library.getTopModulEncoderVerification(1091);
  const station6 = library.getTopModulEncoderVerification(1491);
  assert.equal(station1.station, 1);
  assert.equal(station6.station, 6);
  assert.equal(station1.directStatus.globalNumber, 1091);
  assert.equal(station6.directStatus.globalNumber, 1491);
  assert.equal(station1.directStatus.tag, station6.directStatus.tag);
  assert.equal(station1.configuration.motionChannel, station6.configuration.motionChannel);
  assert.match(station6.authority, /Carts 2-6 internal projects are not available/i);
});

test("base Labeler Faults 067 and 670 remain outside the Cart encoder verification matrix", () => {
  assert.equal(library.getTopModulEncoderVerification(67), null);
  assert.equal(library.getTopModulEncoderVerification(670), null);
  assert.equal(library.getTopModulFault(67).title, "Labeling Station Change Mode Active");
  assert.equal(library.getTopModulEncoderIsolationPlan(670).scope, "Main Labeler encoder / fine clock");
});

test("v350 browser loader follows v349 and verification UI follows v348 isolation UI", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const stackBridgePos = html.indexOf("topmodul-encoder-stack-bridge.js");
  const verificationPos = html.indexOf("topmodul-encoder-verification.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  const isolationUiPos = html.indexOf("topmodul-encoder-isolation-ui.js");
  const verificationUiPos = html.indexOf("topmodul-encoder-verification-ui.js");
  assert.ok(stackBridgePos >= 0 && verificationPos > stackBridgePos && appPos > verificationPos);
  assert.ok(isolationUiPos > appPos && verificationUiPos > isolationUiPos);
  assert.match(html, /data-troubleshooting-version="v350"/);
  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-encoder-verification-ui.js"), "utf8");
  assert.match(ui, /PLC encoder verification points/);
  assert.match(ui, /Watch these values before hardware replacement/);
  assert.match(ui, /read-only verification/i);
});
