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
const library = require("../app/troubleshooting/topmodul-station-power-circuit.js")(circuit);

test("Station power circuit layer validates on top of exact K605163 tracing", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /station-power-circuit-v1/);
  assert.deepEqual([...library.topModulStationPowerCircuitOffsets], [5, 6, 7, 9, 10]);
});

test("Fault 005 traces C101 command and feedback without hiding the PLC/drawing naming mismatch", () => {
  const trace = library.getStationFaultTemplate(5).circuitTrace;
  assert.equal(trace.source.drawing, "K605163-001");
  assert.ok(trace.plcSignals.includes("O0007.11"));
  assert.ok(trace.plcSignals.includes("I0005.22"));
  assert.ok(trace.deviceRows.some((row) => row.device === "C101"));
  assert.match(trace.summary, /1500 ms/i);
  assert.match(trace.summary, /alias calls that feedback E2001_CB101/i);
});

test("Fault 006 keeps CB104 supply protection and CR104 I/O status as separate drawing evidence", () => {
  const trace = library.getStationFaultTemplate(6).circuitTrace;
  assert.ok(trace.deviceRows.some((row) => row.device === "CB104"));
  assert.ok(trace.deviceRows.some((row) => row.device === "CR104"));
  assert.ok(trace.plcSignals.includes("I0005.20"));
  assert.match(trace.summary, /breaker handle alone/i);
  assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 47));
});

test("Fault 007 expands the single PLC alias into the two-breaker series chain", () => {
  const trace = library.getStationFaultTemplate(7).circuitTrace;
  const devices = trace.deviceRows.map((row) => row.device);
  assert.ok(devices.includes("CB211"));
  assert.ok(devices.includes("CB202"));
  assert.ok(trace.plcSignals.includes("I0005.21"));
  assert.match(trace.summary, /series/i);
  assert.match(trace.summary, /either breaker/i);
  assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 26));
});

test("Fault 009 is revision-aware for feed-unit ready inputs while preferring drawing-backed I0005.07", () => {
  const trace = library.getStationFaultTemplate(9).circuitTrace;
  assert.ok(trace.plcSignals.includes("I0005.07"));
  assert.ok(trace.plcSignals.includes("I0005.25"));
  assert.ok(trace.plcSignals.includes("O0007.09"));
  assert.ok(trace.deviceRows.some((row) => row.device === "MTR611"));
  assert.match(trace.summary, /installation-transition rung/i);
  assert.match(trace.summary, /drawing-backed channel/i);
});

test("Fault 010 is revision-aware for rewind-unit ready inputs while preferring drawing-backed I0005.06", () => {
  const trace = library.getStationFaultTemplate(10).circuitTrace;
  assert.ok(trace.plcSignals.includes("I0005.06"));
  assert.ok(trace.plcSignals.includes("I0005.24"));
  assert.ok(trace.plcSignals.includes("O0007.03"));
  assert.ok(trace.deviceRows.some((row) => row.device === "MTR601"));
  assert.match(trace.summary, /final alias was intended to move to I0005\.06/i);
});

test("browser and offline shell load Station power circuit after exact circuit tracing", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const exactCircuit = html.indexOf("topmodul-circuit-trace.js");
  const stationPower = html.indexOf("topmodul-station-power-circuit.js");
  const app = html.indexOf("troubleshooting-app.js");
  assert.ok(exactCircuit >= 0 && stationPower > exactCircuit && app > stationPower);

  const worker = fs.readFileSync(path.join(__dirname, "../service-worker.js"), "utf8");
  assert.match(worker, /\.\/app\/troubleshooting\/topmodul-station-power-circuit\.js/);
});
