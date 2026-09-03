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

test("circuit trace validates on top of Station and Labeler PLC causality", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /topmodul-circuit-trace-v1/);
  assert.equal(library.getTopModulCircuitSource("apl-cart-k605576").drawing, "K605576-001");
});

test("LS143 safety circuit retains archived APL cable and terminal provenance", () => {
  const guard = library.getStationFaultTemplate(3).circuitTrace;
  const reset = library.getStationFaultTemplate(4).circuitTrace;
  assert.equal(guard.source.file, "605576 (APL) Schematic.pdf");
  assert.equal(guard.deviceRows[0].device, "LS143");
  assert.equal(guard.deviceRows[0].cable, "2001-W143");
  assert.match(guard.deviceRows[0].terminals, /TB52 8\/1/);
  assert.ok(guard.drawingLocations.some((location) => location.pdfPage === 68));
  assert.match(reset.summary, /secondary\/reset state/i);
});

test("feed-unit loop-buffer faults bind PE621 and PE622 to the archived terminal routes", () => {
  for (const offset of [26, 27]) {
    const circuit = library.getStationFaultTemplate(offset).circuitTrace;
    const front = circuit.deviceRows.find((row) => row.device === "PE621");
    const rear = circuit.deviceRows.find((row) => row.device === "PE622");
    assert.equal(front.cable, "5701-W621");
    assert.match(front.terminals, /20\/1/);
    assert.equal(rear.cable, "5701-W622");
    assert.match(rear.terminals, /20\/2/);
    assert.equal(circuit.confidence, "high-archive-match");
  }
});

test("carriage, tear verification, and rewind-full sensors keep exact archived device identities", () => {
  assert.equal(library.getStationFaultTemplate(20).circuitTrace.deviceRows[0].device, "P133");
  assert.equal(library.getStationFaultTemplate(20).circuitTrace.deviceRows[0].cable, "1501-W133");
  assert.equal(library.getStationFaultTemplate(23).circuitTrace.deviceRows[0].device, "PE641");
  assert.equal(library.getStationFaultTemplate(23).circuitTrace.deviceRows[0].cable, "5701-W641");
  assert.equal(library.getStationFaultTemplate(60).circuitTrace.deviceRows[0].device, "PE603");
  assert.equal(library.getStationFaultTemplate(60).circuitTrace.deviceRows[0].cable, "5701-W603");
});

test("feed and rewind motor-ready faults retain MTR611 and MTR601 cable paths", () => {
  const feed = library.getStationFaultTemplate(9).circuitTrace;
  const rewind = library.getStationFaultTemplate(10).circuitTrace;
  assert.equal(feed.deviceRows[0].device, "MTR611");
  assert.equal(feed.deviceRows[0].cable, "5701-W611");
  assert.match(feed.deviceRows[0].terminals, /I\/O041 12/);
  assert.equal(rewind.deviceRows[0].device, "MTR601");
  assert.equal(rewind.deviceRows[0].cable, "5701-W601");
  assert.match(rewind.deviceRows[0].terminals, /I\/O041 04/);
});

test("Fault 670 keeps Autocol encoder wiring as corroborative evidence only", () => {
  const circuit = library.getTopModulFault(670).circuitTrace;
  assert.equal(circuit.status, "corroborative-only");
  assert.equal(circuit.source.machineModel, "Autocol");
  assert.equal(circuit.source.drawing, "K747993-001");
  assert.equal(circuit.deviceRows[0].cable, ".1701-W101");
  assert.match(circuit.scopeNote, /not claim an exact terminal\/page/i);
  assert.ok(circuit.drawingLocations.some((location) => location.pdfPage === 135));
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
