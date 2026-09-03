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
const exactCircuit = require("../app/troubleshooting/topmodul-circuit-trace.js")(labelerCause);
const stationPower = require("../app/troubleshooting/topmodul-station-power-circuit.js")(exactCircuit);
const library = require("../app/troubleshooting/topmodul-station-encoder-circuit.js")(stationPower);

test("Station encoder circuit layer validates on top of Station power tracing", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /station-encoder-circuit-v1/);
  assert.deepEqual([...library.topModulStationEncoderCircuitOffsets], [21, 30, 64, 65, 66, 67, 68, 69]);
});

test("Fault 021 binds reference-run failure to P141 and AFD101 registration input", () => {
  const trace = library.getStationFaultTemplate(21).circuitTrace;
  assert.ok(trace.deviceRows.some((row) => row.device === "P141"));
  assert.ok(trace.deviceRows.some((row) => row.device === "AFD101"));
  assert.ok(trace.plcSignals.includes("MainDriveAxis.Registration1Position"));
  assert.match(trace.summary, /reference\/homing move/i);
  assert.match(trace.summary, /base-machine clock encoder/i);
  assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 51));
});

test("Fault 030 uses OPTO131 clock monitoring instead of collapsing into module feedback faults", () => {
  const trace = library.getStationFaultTemplate(30).circuitTrace;
  assert.ok(trace.deviceRows.some((row) => row.device === "OPTO131"));
  assert.ok(trace.plcSignals.includes("I0005.09"));
  assert.ok(trace.plcSignals.includes("FaultEncoderMonitoring"));
  assert.match(trace.summary, /064-069 family/i);
  assert.match(trace.scopeNote, /OPTO132 at I0005\.10/i);
});

test("Fault 067 binds the feedback fault to Slot 11 1756-M02AE AQB hardware and W131", () => {
  const trace = library.getStationFaultTemplate(67).circuitTrace;
  assert.ok(trace.plcSignals.includes("BaseMachineEncoderAxis.FeedbackFault"));
  assert.ok(trace.plcSignals.includes("EEP_APL_Slot11:Ch0"));
  assert.ok(trace.plcSignals.includes("1756-M02AE"));
  assert.ok(trace.deviceRows.some((row) => row.device.includes("1756-M02AE")));
  assert.ok(trace.deviceRows.some((row) => row.device.includes("CN131")));
  assert.match(trace.deviceRows[0].terminals, /CHA\.0 26\/28/);
  assert.match(trace.deviceRows[0].terminals, /CHB\.0 30\/32/);
  assert.match(trace.deviceRows[0].terminals, /CHZ\.0 34\/36/);
});

test("module, hardware, sync, noise and timer faults retain their distinct axis status producers", () => {
  const expected = new Map([
    [64, "BaseMachineEncoderAxis.ModuleFault"],
    [65, "BaseMachineEncoderAxis.ModuleHardwareFault"],
    [66, "BaseMachineEncoderAxis.ModuleSyncFault"],
    [68, "BaseMachineEncoderAxis.FeedbackNoiseFault"],
    [69, "BaseMachineEncoderAxis.TimerEventFault"]
  ]);
  for (const [offset, signal] of expected) {
    const trace = library.getStationFaultTemplate(offset).circuitTrace;
    assert.ok(trace.plcSignals.includes(signal), `Fault ${offset} lost ${signal}`);
    assert.equal(trace.source.drawing, "K605163-001");
  }
});

test("Fault 024 remains separate because the supplied Cart revision has no verified producer", () => {
  const trace = library.getStationFaultTemplate(24)?.circuitTrace;
  assert.ok(!trace || !/P141/.test(trace.summary || ""));
});

test("browser loads Station encoder layer after Station power and before controller UI", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const power = html.indexOf("topmodul-station-power-circuit.js");
  const encoder = html.indexOf("topmodul-station-encoder-circuit.js");
  const app = html.indexOf("troubleshooting-app.js");
  assert.ok(power >= 0 && encoder > power && app > encoder);
});
