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
const library = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(bridge);

test("v347 bridges HMI 00067 to the exact Cart local fault without changing base PLC 067", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /live-00067-source-bridge-v1/);
  const field = library.searchEntries("00067", { machineType: "TopModul" }, 3)[0];
  assert.equal(field.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(field.plcFault, undefined);
  assert.equal(field.stationLocalFault.localNumber, 67);
  assert.equal(field.stationLocalFault.localAddress, "Faults[4].3");
  assert.equal(field.stationLocalFault.producer, "BaseMachineEncoderAxis.FeedbackFault");
  assert.equal(field.stationLocalFault.hmiMessage, "00067 LABELER ENCODER FEEDBACK FAULT");
  assert.equal(library.getTopModulFault(67).title, "Labeling Station Change Mode Active");
});

test("HMI 00067 maps one shared local method into six exact Labeler global destinations", () => {
  const field = library.getEntry("topmodul-00067-labeler-encoder-feedback");
  const expected = [
    [1, 1091, "Faults_LB1[68].3"],
    [2, 1171, "Faults_LB1[73].3"],
    [3, 1251, "Faults_LB1[78].3"],
    [4, 1331, "Faults_LB1[83].3"],
    [5, 1411, "Faults_LB1[88].3"],
    [6, 1491, "Faults_LB1[93].3"]
  ];
  assert.deepEqual(field.stationLocalFault.globalByStation.map((row) => [row.station, row.globalNumber, row.globalAddress]), expected);
  for (const [station, globalNumber, address] of expected) {
    const variant = library.getLive00067StationVariant(station);
    assert.equal(variant.number, globalNumber);
    assert.equal(variant.plcFault.address, address);
    assert.equal(variant.stationTemplateOffset, 67);
  }
});

test("HMI 00067 reuses the exact K605163 AQB feedback circuit already validated for Station Fault 067", () => {
  const field = library.getEntry("topmodul-00067-labeler-encoder-feedback");
  assert.ok(field.circuitTrace.deviceRows.some((row) => /1756-M02AE/.test(row.device)));
  assert.ok(field.circuitTrace.deviceRows.some((row) => /CN131/.test(row.device) && /W131/.test(`${row.device} ${row.cable}`)));
  assert.ok(field.circuitTrace.plcSignals.includes("BaseMachineEncoderAxis.FeedbackFault"));
  assert.ok(field.circuitTrace.plcSignals.includes("EEP_APL_Slot11:Ch0"));
  assert.ok(field.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 33));
  assert.ok(field.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 50));
});

test("HMI 00067 process trace proves Cart producer and Cart-to-Labeler transport", () => {
  const field = library.getEntry("topmodul-00067-labeler-encoder-feedback");
  assert.ok(field.processTrace.producerSignals.includes("BaseMachineEncoderAxis.FeedbackFault → Faults[4].3"));
  assert.ok(field.processTrace.producerSignals.includes("MOV(TempFaults[4],DataFromLS.Par1[42])"));
  assert.ok(field.processTrace.producerSignals.some((signal) => /CPS\(DataFromLS\[1\]\.Par1\[40\],Faults_LB1\[64\],5\).*Faults_LB1\[68\]\.3.*1091/.test(signal)));
  assert.ok(field.processTrace.producerSignals.some((signal) => /CPS\(DataFromLS\[6\]\.Par1\[40\],Faults_LB1\[89\],5\).*Faults_LB1\[93\]\.3.*1491/.test(signal)));
});

test("source-proven 00067 is not misrouted to main fine clock, ENC101, or OPTO131 producer logic", () => {
  const field = library.getEntry("topmodul-00067-labeler-encoder-feedback");
  const producerText = field.processTrace.producerSignals.join(" ");
  assert.doesNotMatch(producerText, /ENC101/);
  assert.doesNotMatch(producerText, /Faults_LB1\[41\]\.14/);
  assert.doesNotMatch(producerText, /OPTO131.*OTE\(Faults\[4\]\.3\)/);
  assert.match(field.processTrace.calculationSteps.map((row) => row.value).join(" "), /local Fault 030.*OPTO131/i);
});

test("field source note now separates observation evidence from PLC mapping evidence", () => {
  const source = library.getSource("field-topmodul-00067-20260903");
  assert.match(source.notes, /field image remains an observation source/i);
  assert.match(source.notes, /BaseMachineEncoderAxis\.FeedbackFault/i);
  const field = library.getEntry("topmodul-00067-labeler-encoder-feedback");
  assert.ok(field.sourceRefs.some((ref) => ref.sourceId === "topmodul-co85-lb1-aplcart1-l5k"));
  assert.ok(field.sourceRefs.some((ref) => ref.sourceId === "topmodul-k605163-apl-electrical"));
});

test("alarm-stack analyzer retains three separate identities for 00067, base 067, and global 1091", () => {
  const result = library.analyzeTopModulFaultStack("00067, 067, 1091");
  assert.equal(result.observed.length, 3);
  assert.equal(result.observed[0].entry.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(result.observed[1].entry.number, 67);
  assert.equal(result.observed[1].entry.title, "Labeling Station Change Mode Active");
  assert.equal(result.observed[2].entry.number, 1091);
  assert.equal(result.observed[2].entry.stationTemplateOffset, 67);
});

test("browser loads source bridge after v345 and before alarm-stack analyzer", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const gapsPos = html.indexOf("topmodul-labeler-remaining-gaps-trace.js");
  const bridgePos = html.indexOf("topmodul-live-00067-source-bridge.js");
  const analyzerPos = html.indexOf("topmodul-alarm-stack-analyzer.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  assert.ok(gapsPos >= 0 && bridgePos > gapsPos && analyzerPos > bridgePos && appPos > analyzerPos);
  const bannerVersion = Number(/data-troubleshooting-version="v(\d+)"/.exec(html)?.[1] || 0);
  assert.ok(bannerVersion >= 347);
});
