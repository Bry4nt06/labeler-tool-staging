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
const stationEncoder = require("../app/troubleshooting/topmodul-station-encoder-circuit.js")(stationPower);
const library = require("../app/troubleshooting/topmodul-station-servo-circuit.js")(stationEncoder);

test("Station servo circuit layer validates and exposes 21 active direct-status faults", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /station-servo-circuit-v1/);
  assert.equal(library.topModulStationServoCircuitOffsets.length, 21);
});

test("motor-feedback faults use MTR101 W121 rather than base-machine encoder W131", () => {
  for (const offset of [32, 45, 46, 48]) {
    const trace = library.getStationFaultTemplate(offset).circuitTrace;
    assert.ok(trace.deviceRows.some((row) => row.cable === "2001-W121"), `Fault ${offset} lost W121`);
    assert.ok(!trace.deviceRows.some((row) => row.cable === "2001-W131"), `Fault ${offset} must not use base-machine W131`);
  }
  assert.ok(library.getStationFaultTemplate(45).circuitTrace.plcSignals.includes("MainDriveAxis.MotFeedbackFault"));
  assert.ok(library.getStationFaultTemplate(46).circuitTrace.plcSignals.includes("MainDriveAxis.MotFeedbackNoiseFault"));
});

test("SERCOS ring and sync faults route to COM081, Slot 12 and AFD101 fiber path", () => {
  for (const offset of [44, 53, 54]) {
    const trace = library.getStationFaultTemplate(offset).circuitTrace;
    assert.ok(trace.plcSignals.includes("1756-M08SE"));
    assert.ok(trace.plcSignals.includes("2094-BC02-M02"));
    assert.ok(trace.deviceRows.some((row) => /COM081/.test(row.device)));
    assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 47));
  }
});

test("power-phase and voltage faults retain the station drive power circuit", () => {
  const phase = library.getStationFaultTemplate(52).circuitTrace;
  assert.ok(phase.plcSignals.includes("MainDriveAxis.PowerPhaseLossFault"));
  assert.ok(phase.deviceRows.some((row) => /F101/.test(row.device)));
  assert.ok(phase.deviceRows.some((row) => /AFD101/.test(row.device)));
  for (const offset of [33, 38, 39]) {
    assert.ok(library.getStationFaultTemplate(offset).circuitTrace.drawingLocations.some((row) => row.pdfPage === 46));
  }
});

test("motion-performance faults keep direct MainDriveAxis producers", () => {
  assert.ok(library.getStationFaultTemplate(50).circuitTrace.plcSignals.includes("MainDriveAxis.OverSpeedFault"));
  assert.ok(library.getStationFaultTemplate(51).circuitTrace.plcSignals.includes("MainDriveAxis.PositionErrorFault"));
});

test("generic Fault 040 and out-of-position Fault 049 remain inactive placeholders in this revision", () => {
  for (const offset of [40, 49]) {
    const entry = library.getStationFaultTemplate(offset);
    assert.ok(entry);
    assert.notEqual(entry.circuitTrace?.status, "machine-specific-direct-servo-status-and-hardware-bound");
    assert.match(entry.stationRungEvidence?.logicType || "", /inactive|disabled|logic/i);
  }
});

test("browser loads Station servo layer after encoder layer", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const encoder = html.indexOf("topmodul-station-encoder-circuit.js");
  const servo = html.indexOf("topmodul-station-servo-circuit.js");
  const app = html.indexOf("troubleshooting-app.js");
  assert.ok(encoder >= 0 && servo > encoder && app > servo);
});
