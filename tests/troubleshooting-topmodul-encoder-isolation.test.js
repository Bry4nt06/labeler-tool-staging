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
const bridge = require("../app/troubleshooting/topmodul-live-00067-source-bridge.js")(gaps);
const analyzer = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(bridge);
const library = require("../app/troubleshooting/topmodul-encoder-isolation.js")(analyzer);

test("v350 encoder isolation validates on top of source-proven 00067 and alarm-stack layers", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /encoder-isolation-v2/);
  assert.deepEqual([...library.topModulEncoderIsolationOffsets], [64, 65, 66, 67, 68, 69]);
});

test("field HMI 00067 opens the Station/Cart feedback workflow and never base PLC Fault 067", () => {
  const plan = library.getTopModulEncoderIsolationPlan("00067");
  assert.equal(plan.scope, "Station / Cart encoder");
  assert.equal(plan.localOffset, 67);
  assert.equal(plan.producer, "BaseMachineEncoderAxis.FeedbackFault");
  assert.equal(plan.entry.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(library.getTopModulEncoderIsolationPlan(67), null);
  assert.equal(library.getTopModulFault(67).title, "Labeling Station Change Mode Active");
});

test("global Station encoder alarms use one shared six-subtype method with station-specific destinations", () => {
  const s1 = library.getTopModulEncoderIsolationPlan(1091);
  const s6 = library.getTopModulEncoderIsolationPlan(1491);
  assert.equal(s1.station, 1);
  assert.equal(s6.station, 6);
  assert.equal(s1.localOffset, 67);
  assert.equal(s6.localOffset, 67);
  assert.ok(s1.siblings.some((row) => row.number === 1088 && row.offset === 64));
  assert.ok(s1.siblings.some((row) => row.number === 1093 && row.offset === 69));
  assert.ok(s6.siblings.some((row) => row.number === 1488 && row.offset === 64));
  assert.ok(s6.siblings.some((row) => row.number === 1493 && row.offset === 69));
});

test("motion absent holds the encoder hardware route while motion-present frozen feedback promotes AQB isolation", () => {
  const noMotion = library.evaluateTopModulEncoderIsolation("00067", { motion: "no" });
  assert.equal(noMotion.code, "resolve-no-motion-first");
  assert.match(noMotion.summary, /upstream no-motion/i);
  const frozen = library.evaluateTopModulEncoderIsolation(1091, { motion: "yes", feedback: "frozen" });
  assert.equal(frozen.code, "direct-aqb-feedback-path");
  assert.match(frozen.summary, /1756-M02AE.*CN131.*2001-W131/i);
});

test("intermittent feedback routes toward feedback-noise and signal-integrity evidence", () => {
  const result = library.evaluateTopModulEncoderIsolation(1171, { motion: "yes", feedback: "intermittent" });
  assert.equal(result.code, "feedback-signal-integrity");
  assert.match(result.next, /offset-068 Feedback Noise/i);
});

test("non-feedback Station encoder subtypes keep their direct motion-axis status producer", () => {
  const moduleFault = library.getTopModulEncoderIsolationPlan(1088);
  const hardwareFault = library.getTopModulEncoderIsolationPlan(1089);
  const syncFault = library.getTopModulEncoderIsolationPlan(1090);
  const noiseFault = library.getTopModulEncoderIsolationPlan(1092);
  const timerFault = library.getTopModulEncoderIsolationPlan(1093);
  assert.equal(moduleFault.producer, "BaseMachineEncoderAxis.ModuleFault");
  assert.equal(hardwareFault.producer, "BaseMachineEncoderAxis.ModuleHardwareFault");
  assert.equal(syncFault.producer, "BaseMachineEncoderAxis.ModuleSyncFault");
  assert.equal(noiseFault.producer, "BaseMachineEncoderAxis.FeedbackNoiseFault");
  assert.equal(timerFault.producer, "BaseMachineEncoderAxis.TimerEventFault");
});

test("Fault 670 receives the exact main-Labeler fine-clock source chain", () => {
  const plan = library.getTopModulEncoderIsolationPlan(670);
  assert.equal(plan.scope, "Main Labeler encoder / fine clock");
  assert.match(plan.producer, /ElectrBrake\.O_FinePulseFault.*Faults_LB1\[41\]\.14/);
  assert.ok(plan.siblings.some((row) => row.number === 480));
  assert.ok(plan.siblings.some((row) => row.number === 482));
  assert.ok(plan.siblings.some((row) => row.number === 669));
  const attachedCircuit = JSON.stringify({ source: plan.circuitTrace?.source?.id || plan.circuitTrace?.sourceId || "", devices: plan.circuitTrace?.deviceRows || [] });
  assert.doesNotMatch(attachedCircuit, /1756-M02AE|CN131/);
  assert.match(plan.steps.map((row) => row.detail).join(" "), /Do not borrow the K605163 1756-M02AE\/CN131 Station path/);
  assert.equal(plan.sourceEvidence.sourceId, "CO85_LB1_Labeler_1online.L5K");
  assert.equal(plan.sourceEvidence.rawFineClockInput, "E1701_ENC101_FineClockPulse / Local:7:I.Data.0");
  assert.equal(plan.sourceEvidence.faultAddress, "Faults_LB1[41].14");
  assert.match(plan.sourceEvidence.sampleWindow, />= 1000 ms/);
  assert.match(plan.sourceEvidence.supervision, /FinePulseCon 3000 ms/);
  assert.match(plan.sourceEvidence.reset, /E1101_PB201_ResetSafetyCircuitFault/);
  assert.ok(plan.liveChecks.some((row) => /E1701_ENC101_FineClockPulse/.test(row.signal)));
  assert.ok(plan.liveChecks.some((row) => /Counter\.ACC/.test(row.signal)));
  assert.ok(plan.liveChecks.some((row) => /SpeedActVal.*ZeroSpeed/.test(row.signal)));
  assert.ok(plan.liveChecks.some((row) => /FinePulseCon\.ACC/.test(row.signal)));
  assert.ok(plan.liveChecks.some((row) => /Faults_LB1\[41\]\.14/.test(row.signal)));
  const noMotion = library.evaluateTopModulEncoderIsolation(670, { motion: "no" });
  assert.equal(noMotion.code, "main-no-motion-first");
  const pulses = library.evaluateTopModulEncoderIsolation(670, { motion: "yes", fineClock: "changing" });
  assert.equal(pulses.code, "main-supervision-timing");
  assert.match(pulses.summary, />=1000 ms/i);
  assert.match(pulses.summary, /3000 ms/i);
  assert.match(pulses.next, /Counter\.ACC.*SpeedActVal.*ZeroSpeed.*FinePulseCon.*O_FinePulseFault.*E2001_M_ElectrBrakeFaultEncoder/i);
  const frozen = library.evaluateTopModulEncoderIsolation(670, { motion: "yes", fineClock: "absent" });
  assert.equal(frozen.code, "main-fine-clock-path");
  assert.match(frozen.summary, /Local:7:I\.Data\.0/);
  assert.match(frozen.next, /E1701_ENC101_FineClockPulse.*ElectrBrake\.Counter\.ACC/);
});

test("Station local Fault 030 clock monitoring is not collapsed into the 064-069 isolation workflow", () => {
  assert.equal(library.getTopModulEncoderIsolationPlan(1054), null);
  const template = library.getStationFaultTemplate(30);
  assert.ok(template.circuitTrace.plcSignals.includes("I0005.09"));
});

test("browser loads v350 engine after source bridge/analyzer and interactive UI after the app", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const bridgePos = html.indexOf("topmodul-live-00067-source-bridge.js");
  const analyzerPos = html.indexOf("topmodul-alarm-stack-analyzer.js");
  const enginePos = html.indexOf("topmodul-encoder-isolation.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  const uiPos = html.indexOf("topmodul-encoder-isolation-ui.js");
  assert.ok(bridgePos >= 0 && analyzerPos > bridgePos && enginePos > analyzerPos && appPos > enginePos && uiPos > appPos);
  const bannerVersion = Number(/data-troubleshooting-version="v(\d+)"/.exec(html)?.[1] || 0);
  assert.ok(bannerVersion >= 350);
  assert.match(html, /topmodul-encoder-isolation\.js\?v=0\.9\.10&amp;build=troubleshooting-fault-670-source-chain-v350-20260904/);
  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-encoder-isolation-ui.js"), "utf8");
  assert.match(ui, /Observed machine state/);
  assert.match(ui, /data-encoder-open-fault/);
  assert.match(ui, /These buttons do not write to the PLC/);
});
