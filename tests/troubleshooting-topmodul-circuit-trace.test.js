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
const trace = require("../app/troubleshooting/topmodul-station-controller-trace.js")(scope);
const stationCause = require("../app/troubleshooting/topmodul-station-cause-model.js")(trace);
const labelerCause = require("../app/troubleshooting/topmodul-labeler-cause-model.js")(stationCause);
const library = require("../app/troubleshooting/topmodul-circuit-trace.js")(labelerCause);

test("circuit trace validates with exact TopModul Labeler and APL Cart drawing authority", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /topmodul-circuit-trace-v2/);
  assert.equal(library.getTopModulCircuitSource("topmodul-k407039").drawing, "K407039-001");
  assert.equal(library.getTopModulCircuitSource("apl-cart-k605163").drawing, "K605163-001");
});

test("LS143 safety circuit uses supplied K605163 machine-set drawing", () => {
  const guard = library.getStationFaultTemplate(3).circuitTrace;
  const reset = library.getStationFaultTemplate(4).circuitTrace;
  assert.equal(guard.source.file, "605-163 Electrical Schematic.pdf");
  assert.equal(guard.source.drawing, "K605163-001");
  assert.equal(guard.deviceRows[0].device, "LS143");
  assert.equal(guard.deviceRows[0].cable, "2001-W143");
  assert.ok(guard.plcSignals.includes("I0005.08"));
  assert.ok(guard.drawingLocations.some((location) => location.pdfPage === 47));
  assert.match(reset.summary, /reset\/secondary state/i);
});

test("feed-unit loop-buffer faults bind PE621 and PE622 to K605163 and PLC aliases", () => {
  for (const offset of [26, 27]) {
    const circuit = library.getStationFaultTemplate(offset).circuitTrace;
    const front = circuit.deviceRows.find((row) => row.device === "PE621");
    const rear = circuit.deviceRows.find((row) => row.device === "PE622");
    assert.equal(circuit.source.drawing, "K605163-001");
    assert.equal(front.cable, "5701-W621");
    assert.match(front.terminals, /I0005\.28/);
    assert.equal(rear.cable, "5701-W622");
    assert.match(rear.terminals, /I0005\.29/);
    assert.ok(circuit.drawingLocations.some((location) => location.pdfPage === 54));
  }
});

test("end-of-reel fault 025 binds PE631 and PE632 while preserving selector designation mismatch", () => {
  const circuit = library.getStationFaultTemplate(25).circuitTrace;
  assert.equal(circuit.source.drawing, "K605163-001");
  assert.equal(circuit.deviceRows.find((row) => row.device === "PE631").cable, "5701-W631");
  assert.match(circuit.deviceRows.find((row) => row.device === "PE631").terminals, /I0005\.17/);
  assert.equal(circuit.deviceRows.find((row) => row.device === "PE632").cable, "5701-W632");
  assert.match(circuit.deviceRows.find((row) => row.device === "PE632").terminals, /I0005\.11/);
  assert.ok(circuit.plcSignals.includes("E5701_SS631_SelSwitchEndOfReel"));
  assert.match(circuit.scopeNote, /SS631/);
  assert.match(circuit.scopeNote, /SS633/);
  assert.ok(circuit.drawingLocations.some((location) => location.pdfPage === 55));
});

test("carriage, tear verification, rewind-full, feed and rewind hardware keep exact K605163 paths", () => {
  assert.equal(library.getStationFaultTemplate(20).circuitTrace.deviceRows[0].device, "P133");
  assert.equal(library.getStationFaultTemplate(20).circuitTrace.deviceRows[0].cable, "1501-W133");
  assert.ok(library.getStationFaultTemplate(20).circuitTrace.plcSignals.includes("I0005.27"));

  assert.equal(library.getStationFaultTemplate(23).circuitTrace.deviceRows[0].device, "PE641");
  assert.equal(library.getStationFaultTemplate(23).circuitTrace.deviceRows[0].cable, "5701-W641");
  assert.ok(library.getStationFaultTemplate(23).circuitTrace.plcSignals.includes("I0005.03"));

  assert.equal(library.getStationFaultTemplate(60).circuitTrace.deviceRows[0].device, "PE603");
  assert.equal(library.getStationFaultTemplate(60).circuitTrace.deviceRows[0].cable, "5701-W603");
  assert.ok(library.getStationFaultTemplate(60).circuitTrace.plcSignals.includes("I0005.18"));

  assert.equal(library.getStationFaultTemplate(9).circuitTrace.deviceRows[0].device, "MTR611");
  assert.equal(library.getStationFaultTemplate(9).circuitTrace.deviceRows[0].cable, "5701-W611");
  assert.ok(library.getStationFaultTemplate(9).circuitTrace.plcSignals.includes("I0005.07"));

  assert.equal(library.getStationFaultTemplate(10).circuitTrace.deviceRows[0].device, "MTR601");
  assert.equal(library.getStationFaultTemplate(10).circuitTrace.deviceRows[0].cable, "5701-W601");
  assert.ok(library.getStationFaultTemplate(10).circuitTrace.plcSignals.includes("I0005.06"));
});

test("Fault 670 is promoted from Autocol analogy to exact K407039 encoder circuit", () => {
  const circuit = library.getTopModulFault(670).circuitTrace;
  assert.equal(circuit.status, "machine-specific-plc-io-circuit-bound");
  assert.equal(circuit.source.machineModel, "Topmodul/Labeller");
  assert.equal(circuit.source.drawing, "K407039-001");
  assert.ok(circuit.plcSignals.includes("Local:7:I.Data.0"));
  const encoder = circuit.deviceRows.find((row) => row.device === "ENC101");
  const converter = circuit.deviceRows.find((row) => row.device === "CVTR101");
  assert.equal(encoder.cable, ".1701-W091");
  assert.match(converter.terminals, /I0007\.00/);
  assert.ok(circuit.drawingLocations.some((location) => location.pdfPage === 114));
  assert.ok(circuit.drawingLocations.some((location) => location.pdfPage === 126));
  assert.match(circuit.summary, /exact TopModul PLC-to-I\/O-to-device trace/i);
});

test("Fault 669 shares the exact main encoder hardware while retaining separate PLC supervision", () => {
  const circuit = library.getTopModulFault(669).circuitTrace;
  assert.equal(circuit.source.drawing, "K407039-001");
  assert.match(circuit.summary, /Machine Stop Monitoring/);
  assert.ok(circuit.deviceRows.some((row) => row.device === "CVTR101"));
});

test("main drive contactor and safety time-relay faults bind C101/C102 physical I/O", () => {
  const contactor = library.getTopModulFault(482).circuitTrace;
  const timer = library.getTopModulFault(490).circuitTrace;
  for (const circuit of [contactor, timer]) {
    assert.equal(circuit.source.drawing, "K407039-001");
    assert.ok(circuit.plcSignals.includes("O0103.00"));
    assert.ok(circuit.plcSignals.includes("I0009.26"));
    assert.ok(circuit.plcSignals.includes("I0009.27"));
    assert.ok(circuit.drawingLocations.some((location) => location.pdfPage === 127));
  }
  assert.ok(contactor.deviceRows.some((row) => row.device === "C101"));
  assert.ok(contactor.deviceRows.some((row) => row.device === "C102"));
});

test("low machine-air fault binds PS101 to I0010.18 in K407039", () => {
  const circuit = library.getTopModulFault(640).circuitTrace;
  assert.equal(circuit.source.drawing, "K407039-001");
  assert.equal(circuit.deviceRows[0].device, "PS101");
  assert.equal(circuit.deviceRows[0].cable, ".1501-W101");
  assert.ok(circuit.plcSignals.includes("I0010.18"));
  assert.ok(circuit.drawingLocations.some((location) => location.pdfPage === 111));
});

test("browser and offline shell load the circuit layer after PLC cause models", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const labeler = html.indexOf("topmodul-labeler-cause-model.js");
  const circuit = html.indexOf("topmodul-circuit-trace.js");
  const app = html.indexOf("troubleshooting-app.js");
  assert.ok(labeler >= 0 && circuit > labeler && app > circuit);

  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-fault-drilldown-ui.js"), "utf8");
  assert.match(ui, /data-topmodul-circuit-trace/);
  assert.match(ui, /Electrical circuit evidence/);

  const worker = fs.readFileSync(path.join(__dirname, "../service-worker.js"), "utf8");
  assert.match(worker, /\.\/app\/troubleshooting\/topmodul-circuit-trace\.js/);
});
