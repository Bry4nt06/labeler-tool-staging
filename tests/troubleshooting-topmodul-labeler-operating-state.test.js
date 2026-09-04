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
const library = require("../app/troubleshooting/topmodul-labeler-operating-state-trace.js")(inspection);

test("v344 operating-state model validates without weakening prior layers", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /labeler-operating-state-v1/);
  assert.ok(library.topModulLabelerOperatingStateFaults.includes(64));
  assert.ok(library.topModulLabelerOperatingStateFaults.includes(668));
  assert.deepEqual([...library.topModulLabelerOperatingStateSourceGaps], [648, 649, 650, 651, 652, 653, 654]);
});

test("Fault 064 preserves SS501 PLC semantics and the drawing polarity conflict", () => {
  const entry = library.getTopModulFault(64);
  assert.ok(entry.processTrace.producerSignals.includes("E0901_SS501_OperatingMode = I0010.1"));
  assert.ok(entry.processTrace.producerSignals.some((s) => /XIO\(E0901_SS501_OperatingMode\)/.test(s)));
  assert.match(entry.processTrace.status, /conflict/i);
  assert.ok(entry.circuitTrace.deviceRows.some((row) => row.device === "SS501" && /I0010\.01/.test(row.terminals)));
  assert.ok(entry.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 73));
});

test("Fault 067 is an intentional zero-speed station-change mode state", () => {
  const entry = library.getTopModulFault(67);
  assert.ok(entry.processTrace.producerSignals.some((s) => /StartStop\.ZeroSpeed/.test(s)));
  assert.ok(entry.processTrace.producerSignals.some((s) => /OTU\(Control\.EnableMachineOn\)/.test(s)));
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "secondary");
  assert.match(entry.processTrace.summary, /intentional Labeling Station Change Mode/i);
});

test("connector-open faults use one six-station method with exact instance inputs and pages", () => {
  const expectedInputs = [3, 8, 13, 19, 24, 29];
  const expectedPages = [198, 204, 210, 216, 222, 228];
  for (let station = 1; station <= 6; station += 1) {
    const entry = library.getTopModulFault(67 + station);
    assert.ok(entry.processTrace.producerSignals.some((s) => s.includes(`E975${station}_Agg${station}_I4_Connected = I0012.${expectedInputs[station - 1]}`)));
    assert.ok(entry.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === expectedPages[station - 1]));
    assert.equal(entry.labelerRungEvidence.rootLikelihood, "primary");
  }
});

test("inspection, laser and broken-container overrides stay operating-state indicators", () => {
  assert.ok(library.getTopModulFault(80).processTrace.producerSignals.includes("Inspection_01.O_FaultOverrideOn"));
  assert.ok(library.getTopModulFault(81).processTrace.producerSignals.includes("Laser_01.O_FaultOverride"));
  assert.ok(library.getTopModulFault(82).processTrace.producerSignals.includes("ContBroken.O_OverrideOnMMI"));
  for (const number of [80, 81, 82]) assert.equal(library.getTopModulFault(number).labelerRungEvidence.rootLikelihood, "secondary");
});

test("station synchronization summaries preserve Labeler receive logic and Cart 1 caveat", () => {
  for (let station = 1; station <= 6; station += 1) {
    const entry = library.getTopModulFault(641 + station);
    assert.ok(entry.processTrace.producerSignals.some((s) => s.includes(`DataFromLS[${station}].Par1[0].3`)));
    assert.equal(entry.labelerRungEvidence.rootLikelihood, "secondary");
  }
  const station1 = library.getTopModulFault(642);
  assert.match(station1.processTrace.calculationSteps.map((row) => row.value).join(" "), /Logic_1/i);
  assert.match(station1.processTrace.summary, /does not prove a servo synchronization fault/i);
});

test("generic Station faults 649-654 remain HMI-disabled while underlying malfunction state stays real", () => {
  for (let number = 649; number <= 654; number += 1) {
    const entry = library.getTopModulFault(number);
    assert.equal(entry.labelerRungEvidence.rootLikelihood, "disabled");
    assert.match(entry.sourceGap.status, /logic0/i);
    assert.ok(entry.processTrace.producerSignals.some((s) => /XIC\(Logic_0\)/.test(s)));
  }
});

test("magazine-empty and Not Ready groups remain summaries rather than invented single-device causes", () => {
  for (let station = 1; station <= 6; station += 1) {
    const magazine = library.getTopModulFault(654 + station);
    assert.ok(magazine.processTrace.producerSignals.some((s) => s.includes(`DataFromLS[${station}].Par1[0].1`)));
    assert.equal(magazine.labelerRungEvidence.rootLikelihood, "supervision");
    const ready = library.getTopModulFault(662 + station);
    assert.ok(ready.processTrace.producerSignals.includes("Aggregat_xx.T_NotReady.PRE = 10000"));
    assert.ok(ready.processTrace.producerSignals.some((s) => s.includes(`ETH_ComSend[${station}].O_ReadyForETHConnect_L3`)));
    assert.equal(ready.labelerRungEvidence.rootLikelihood, "secondary");
  }
});

test("Fault 648 Glideliner stays searchable without an invented producer", () => {
  const entry = library.getTopModulFault(648);
  assert.ok(entry.sourceGap);
  assert.equal(entry.processTrace, undefined);
  assert.match(entry.sourceGap.reason, /no producer occurrence/i);
});

test("browser keeps v344 loaded after inspection/coder and before later troubleshooting phases", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const inspectionPos = html.indexOf("topmodul-labeler-inspection-coder-trace.js");
  const operatingPos = html.indexOf("topmodul-labeler-operating-state-trace.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  assert.ok(inspectionPos >= 0 && operatingPos > inspectionPos && appPos > operatingPos);
  const version = Number(html.match(/data-troubleshooting-version="v(\d+)"/)?.[1] || 0);
  assert.ok(version >= 344, `Expected troubleshooting version >=344, found v${version}.`);
});
