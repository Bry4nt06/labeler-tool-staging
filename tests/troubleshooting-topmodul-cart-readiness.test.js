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
const cartReadiness = require("../app/troubleshooting/topmodul-cart-readiness-isolation.js")(servoTable);
const liveBridge = require("../app/troubleshooting/topmodul-live-00067-source-bridge.js")(cartReadiness);
const analyzer = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(liveBridge);
const encoderIsolation = require("../app/troubleshooting/topmodul-encoder-isolation.js")(analyzer);
const stackBridge = require("../app/troubleshooting/topmodul-encoder-stack-bridge.js")(encoderIsolation);
const verification = require("../app/troubleshooting/topmodul-encoder-verification.js")(stackBridge);
const library = require("../app/troubleshooting/topmodul-main-drive-isolation.js")(verification);

test("v355 APL Cart readiness chain validates through the current troubleshooting runtime", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /cart-readiness-v355/);
  assert.equal(library.topModulCartReadinessSource.file, "CO85_LB1_APLCart_1.L5K");
  assert.equal(library.topModulCartReadinessStation, 1);
  assert.equal(library.getTopModulCartReadinessPlan().stages.length, 11);
});

test("v355 preserves Cart-local numbered fault authority in Station scope", () => {
  const cart005 = library.getStationFaultVariant(5, 1);
  const cart016 = library.getStationFaultVariant(16, 1);
  const cart017 = library.getStationFaultVariant(17, 1);
  const cart020 = library.getStationFaultVariant(20, 1);
  assert.equal(cart005.number, 1029);
  assert.equal(cart005.stationTemplateOffset, 5);
  assert.equal(cart005.diagnosticScope, "Station");
  assert.match(cart005.title, /Main Contactor fault$/i);
  assert.equal(cart016.number, 1040);
  assert.match(cart016.title, /Motion group not synchronized$/i);
  assert.equal(cart017.number, 1041);
  assert.match(cart017.title, /Feedback on fault main drive$/i);
  assert.equal(cart020.number, 1044);
  assert.match(cart020.title, /Carriage not in front position/i);
  assert.notEqual(library.getTopModulFault(5).title, cart005.title, "Main Labeler Fault 005 must remain separate from Cart-local Fault 005.");
});

test("readiness plan preserves exact timing and raw-polarity boundaries", () => {
  const plan = library.getTopModulCartReadinessPlan();
  const stages = plan.stages;
  const contactor = stages.find((row) => row.signal === "E2001_C101_ServoPowerSupply");
  const monitor = stages.find((row) => /TON_MonitorMainContactor/.test(row.signal));
  const release = stages.find((row) => row.signal === "StartStop.ReleaseFeedbackOn");
  const ready = stages.find((row) => row.signal === "MainDrive.SData.Status.ReadyForFeedbackON");
  const command = stages.find((row) => /Cmd\.FeedbackON/.test(row.signal));
  const feedback = stages.find((row) => row.signal === "MainDrive.SData.Status.Feedback_Is_ON");
  assert.match(contactor.sourceLogic, /400 ms/);
  assert.match(monitor.sourceLogic, /both true OR both false/);
  assert.match(monitor.sourceLogic, /1500 ms/);
  assert.deepEqual([...monitor.handoff], [1029]);
  assert.match(release.sourceLogic, /XIO\(E2001_CB101_ServoPowerSupply\)/);
  assert.match(release.meaning, /raw C101 feedback bit must be false/i);
  assert.match(ready.sourceLogic, /MotionGroup\.GroupSynced/);
  assert.match(ready.sourceLogic, /EnableInputStatus/);
  assert.deepEqual([...ready.handoff], [1040, 1041]);
  assert.match(command.sourceLogic, /750 ms/);
  assert.match(feedback.sourceLogic, /20 ms/);
  assert.deepEqual([...plan.upstreamEnableFaults], [1025, 1026, 1027, 1028, 1029, 1030, 1031, 1033, 1034, 1036, 1037, 1038, 1039, 1040, 1041, 1042, 1043, 1044]);
});

test("v355 isolates the first missing stage and returns Station-instance handoffs", () => {
  assert.equal(library.evaluateTopModulCartReadiness({ enableMachineOn: "no", enableMachineJog: "no" }).code, "cart-enable-inhibited");
  assert.equal(library.evaluateTopModulCartReadiness({ enableMachineOn: "yes", powerAndFeedbackOn: "no" }).code, "power-feedback-permissive-blocked");
  const contactor = library.evaluateTopModulCartReadiness({ contactorCommand: "1", contactorFeedback: "1" });
  assert.equal(contactor.code, "contactor-raw-state-mismatch");
  assert.deepEqual([...contactor.related], [1029]);
  const release = library.evaluateTopModulCartReadiness({ powerAndFeedbackOn: "yes", releaseFeedbackOn: "no" });
  assert.equal(release.code, "feedback-release-blocked");
  assert.deepEqual([...release.related], [1029]);
  const axisReady = library.evaluateTopModulCartReadiness({ releaseFeedbackOn: "yes", readyForFeedbackOn: "no" });
  assert.equal(axisReady.code, "axis-ready-permissive-blocked");
  assert.deepEqual([...axisReady.related], [1040, 1041]);
  assert.equal(library.evaluateTopModulCartReadiness({ readyForFeedbackOn: "yes", feedbackCommand: "no" }).code, "feedback-command-delay");
  const feedback = library.evaluateTopModulCartReadiness({ feedbackCommand: "yes", feedbackIsOn: "no" });
  assert.equal(feedback.code, "mso-feedback-not-on");
  assert.deepEqual([...feedback.related], [1041]);
  assert.equal(library.evaluateTopModulCartReadiness({ feedbackIsOn: "yes", stationAutoOn: "no" }).code, "station-auto-not-latched");
  const baseReady = library.evaluateTopModulCartReadiness({ stationAutoOn: "yes", baseReady: "no" });
  assert.equal(baseReady.code, "base-ready-output-blocked");
  assert.deepEqual([...baseReady.related], [1044]);
  assert.equal(library.evaluateTopModulCartReadiness({ baseReady: "yes", noFaultOutput: "no" }).code, "hardware-ready-output-blocked");
});

test("station-ready and hardware-ready stages keep ambiguous/dead branches explicit", () => {
  const stages = library.getTopModulCartReadinessPlan().stages;
  const baseReady = stages.find((row) => row.signal === "DataFromLS.Par1[0].0");
  const hardwareReady = stages.find((row) => row.signal === "E9706_OPTO233_NoFault");
  assert.match(baseReady.sourceLogic, /XIO\(E1501_P133_CarriageFront\)/);
  assert.match(baseReady.meaning, /raw input polarity/i);
  assert.match(hardwareReady.sourceLogic, /Logic_0/);
  assert.match(hardwareReady.meaning, /final Labeler-to-base-machine hardware readiness output/i);
});

test("APL Cart readiness is searchable and exposes a guided flow without inventing an alarm number", () => {
  const match = library.searchEntries("APL cart not ready", { machineType: "TopModul", applicationMode: "APL" }, 5)[0];
  assert.equal(match.id, "topmodul-apl-cart-readiness");
  assert.equal(match.code, "APL-READY");
  assert.equal(match.number, undefined);
  assert.match(match.processTrace.scopeNote, /main Labeler faults with the same short numbers are a separate scope/i);
  const flow = library.getFlow("topmodul-apl-cart-readiness");
  assert.ok(flow);
  assert.equal(flow.start, "cart-alarm");
  assert.ok(flow.nodes["cart-base-ready"]);
});

test("v355 browser loader places Cart readiness before live alarm/encoder analysis and exposes v355 banner", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const servoTablePos = html.indexOf("topmodul-servo-table-internal-status.js");
  const readinessPos = html.indexOf("topmodul-cart-readiness-isolation.js");
  const liveBridgePos = html.indexOf("topmodul-live-00067-source-bridge.js");
  assert.ok(servoTablePos >= 0 && readinessPos > servoTablePos && liveBridgePos > readinessPos);
  const bannerVersion = Number(/data-troubleshooting-version="v(\d+)"/.exec(html)?.[1] || 0);
  assert.ok(bannerVersion >= 355);
  assert.match(html, /topmodul-cart-readiness-isolation\.js\?v=0\.9\.10&amp;build=troubleshooting-cart-readiness-v355-20260904/);
});
