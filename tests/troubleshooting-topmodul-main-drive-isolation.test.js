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
const liveBridge = require("../app/troubleshooting/topmodul-live-00067-source-bridge.js")(gaps);
const analyzer = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(liveBridge);
const encoderIsolation = require("../app/troubleshooting/topmodul-encoder-isolation.js")(analyzer);
const stackBridge = require("../app/troubleshooting/topmodul-encoder-stack-bridge.js")(encoderIsolation);
const verification = require("../app/troubleshooting/topmodul-encoder-verification.js")(stackBridge);
const library = require("../app/troubleshooting/topmodul-main-drive-isolation.js")(verification);

test("v352 source-backed main-drive isolation validates on top of v351/v350 encoder layers", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /main-drive-isolation-v352/);
  assert.deepEqual([...library.topModulMainDriveIsolationFaults], [480, 482, 490, 669]);
  assert.equal(library.topModulMainDriveIsolationSource.file, "CO85_LB1_Labeler_1online.L5K");
});

test("Fault 670 remains exclusively under the stronger v351 main-Labeler fine-clock workflow", () => {
  assert.equal(library.getTopModulMainDriveIsolationPlan(670), null);
  const encoder670 = library.getTopModulEncoderIsolationPlan(670);
  assert.equal(encoder670.scope, "Main Labeler encoder / fine clock");
  assert.equal(encoder670.sourceEvidence.sourceId, "CO85_LB1_Labeler_1online.L5K");
  assert.equal(encoder670.sourceEvidence.rawFineClockInput, "E1701_ENC101_FineClockPulse / Local:7:I.Data.0");
  assert.equal(encoder670.sourceEvidence.faultAddress, "Faults_LB1[41].14");
  assert.ok(encoder670.liveChecks.some((row) => /ElectrBrake\.Counter\.ACC/.test(row.signal)));
});

test("Fault 480 separates open MS101 protection evidence from a direct PF700/Node3 status fault", () => {
  const plan = library.getTopModulMainDriveIsolationPlan(480);
  assert.match(plan.producer, /O_MotOK.*O_NoFault.*E2001_MS101_MainDriveOverload/);
  assert.match(plan.producer, /Faults_LB1\[30\]\.0/);
  assert.ok(plan.watchPoints.some((row) => row.tag === "VSD85LB1_Node3:I.DriveStatus"));
  assert.ok(plan.watchPoints.some((row) => row.tag === "DriveConETH_01.O_MotOK"));
  assert.equal(library.evaluateTopModulMainDriveIsolation(480, { overloadPermissive: "open" }).code, "main-drive-overload-separate");
  assert.equal(library.evaluateTopModulMainDriveIsolation(480, { overloadPermissive: "made", driveHealthy: "no" }).code, "pf700-node3-direct");
  assert.equal(library.evaluateTopModulMainDriveIsolation(480, { overloadPermissive: "made", driveHealthy: "yes" }).code, "drive-status-disagreement");
});

test("Fault 482 preserves all three raw source mismatch states and five-second supervision", () => {
  const plan = library.getTopModulMainDriveIsolationPlan(482);
  assert.match(plan.producer, /5000 ms/);
  assert.match(plan.producer, /Faults_LB1\[30\]\.2/);
  assert.ok(plan.watchPoints.some((row) => /T_ContactorMonitor/.test(row.tag) && /5000/.test(row.relationship)));
  assert.equal(library.evaluateTopModulMainDriveIsolation(482, { contactorCommand: "0", contactorFeedback: "0", timeRelayFault: "clear" }).code, "contactor-state-1");
  assert.equal(library.evaluateTopModulMainDriveIsolation(482, { contactorCommand: "1", contactorFeedback: "1", timeRelayFault: "clear" }).code, "contactor-state-2");
  assert.equal(library.evaluateTopModulMainDriveIsolation(482, { driveEnable: "0", contactorFeedback: "0", mainDriveOffDone: "yes", contactorCommand: "unknown", timeRelayFault: "clear" }).code, "contactor-state-3");
});

test("Fault 490 hardware-delay latch takes precedence over visible Fault 482 and preserves 1 s / 4 s timing", () => {
  const plan = library.getTopModulMainDriveIsolationPlan(490);
  assert.match(plan.producer, /O_HWTimerFault.*E2001_M_ElectrBrakeFaultTimeRelay.*Faults_LB1\[30\]\.10/);
  assert.ok(plan.watchPoints.some((row) => /HWTimerCon/.test(row.tag) && /1000/.test(row.relationship)));
  assert.ok(plan.watchPoints.some((row) => /HWTimerOffDel/.test(row.tag) && /4000/.test(row.relationship)));
  assert.equal(library.evaluateTopModulMainDriveIsolation(490, { timeRelayFault: "active", delayFeedbackAgreement: "mismatch" }).code, "hardware-delay-feedback-direct");
  const precedence = library.evaluateTopModulMainDriveIsolation(482, { timeRelayFault: "active" });
  assert.equal(precedence.code, "time-relay-precedence");
  assert.ok(precedence.related.includes(490));
});

test("Fault 669 keeps StartStop.ZeroSpeed separate from ElectrBrake.ZeroSpeed and uses the 2 s standstill monitor", () => {
  const plan = library.getTopModulMainDriveIsolationPlan(669);
  assert.match(plan.producer, /O_ZeroSpeedFault.*Faults_LB1\[41\]\.13/);
  const startStop = plan.watchPoints.find((row) => row.tag === "StartStop.ZeroSpeed");
  const electricBrake = plan.watchPoints.find((row) => /ElectrBrake\.SpeedActVal/.test(row.tag));
  assert.match(startStop.relationship, /SpeedDetect\.O_ActVal_10,10/);
  assert.match(startStop.caution, /internal software decision threshold/i);
  assert.match(electricBrake.relationship, /SpeedActVal <= 0/);
  assert.ok(plan.watchPoints.some((row) => /ZeroSpeedCon/.test(row.tag) && /2000/.test(row.relationship)));
  assert.equal(library.evaluateTopModulMainDriveIsolation(669, { zeroSpeedOnDelayDone: "yes", electricBrakeZeroSpeed: "no" }).code, "standstill-monitor-direct");
  assert.equal(library.evaluateTopModulMainDriveIsolation(669, { electricBrakeZeroSpeed: "yes" }).code, "standstill-currently-achieved");
});

test("Station encoder no-motion result hands off only to source-backed main-drive/standstill branches", () => {
  const result = library.evaluateTopModulEncoderIsolation("00067", { motion: "no" });
  assert.equal(result.code, "resolve-no-motion-first");
  assert.ok(result.handoff);
  assert.deepEqual(result.handoff.candidates.map((row) => row.number), [480, 482, 490, 669]);
  assert.ok(result.handoff.excluded.some((row) => row.number === 670));
  assert.match(result.handoff.guidance, /do not open the Cart AQB circuit first/i);
});

test("v352 browser loader places engine after v350 verification and UI after existing encoder UI", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const verificationPos = html.indexOf("topmodul-encoder-verification.js");
  const enginePos = html.indexOf("topmodul-main-drive-isolation.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  const encoderUiPos = html.indexOf("topmodul-encoder-isolation-ui.js");
  const verificationUiPos = html.indexOf("topmodul-encoder-verification-ui.js");
  const mainDriveUiPos = html.indexOf("topmodul-main-drive-isolation-ui.js");
  assert.ok(verificationPos >= 0 && enginePos > verificationPos && appPos > enginePos);
  assert.ok(encoderUiPos > appPos && verificationUiPos > encoderUiPos && mainDriveUiPos > verificationUiPos);
  const bannerVersion = Number(/data-troubleshooting-version="v(\d+)"/.exec(html)?.[1] || 0);
  assert.ok(bannerVersion >= 352);
  assert.match(html, /topmodul-main-drive-isolation\.js\?v=0\.9\.10&amp;build=troubleshooting-main-drive-isolation-v352-20260904/);
  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-main-drive-isolation-ui.js"), "utf8");
  assert.match(ui, /Main-drive isolation — source-backed/);
  assert.match(ui, /These choices only interpret observed PLC\/drive states/);
  assert.match(ui, /data-topmodul-no-motion-handoff/);
  assert.match(ui, /data-main-drive-open-fault/);
});
