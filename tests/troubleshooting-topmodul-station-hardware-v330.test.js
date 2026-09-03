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
const circuits = require("../app/troubleshooting/topmodul-circuit-trace.js")(labelerCause);
const library = require("../app/troubleshooting/topmodul-station-hardware-v330.js")(circuits);

test("v330 Station hardware extension validates on exact K605163 authority", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /topmodul-station-hardware-v330/);
  for (const offset of [5, 6, 7, 28, 29, 30]) {
    assert.equal(library.getStationFaultTemplate(offset).circuitTrace.source.drawing, "K605163-001");
  }
});

test("Station main contactor fault binds C101 command, complementary check-back and 1500 ms supervision", () => {
  const trace = library.getStationFaultTemplate(5).circuitTrace;
  assert.ok(trace.plcSignals.includes("O0007.11"));
  assert.ok(trace.plcSignals.includes("I0005.22"));
  assert.ok(trace.plcSignals.includes("TON_MonitorMainContactor"));
  assert.ok(trace.deviceRows.some((row) => row.device === "C101"));
  assert.match(trace.summary, /1500 ms/);
  assert.match(trace.scopeNote, /complementary/i);
});

test("servo logic breaker fault 006 is a direct CB104 input loss", () => {
  const trace = library.getStationFaultTemplate(6).circuitTrace;
  assert.equal(trace.deviceRows[0].device, "CB104");
  assert.ok(trace.plcSignals.includes("I0005.20"));
  assert.match(trace.summary, /XIO\(E2001_CB104_FuseServo\)/);
  assert.ok(trace.drawingLocations.some((location) => location.pdfPage === 47));
});

test("feed/rewind breaker fault 007 exposes both CB211 and CB202 in the single PLC health input", () => {
  const trace = library.getStationFaultTemplate(7).circuitTrace;
  assert.ok(trace.plcSignals.includes("I0005.21"));
  assert.ok(trace.deviceRows.some((row) => row.device === "CB211"));
  assert.ok(trace.deviceRows.some((row) => row.device === "CB202"));
  assert.match(trace.summary, /in series/i);
  assert.match(trace.scopeNote, /singular/i);
  assert.ok(trace.drawingLocations.some((location) => location.pdfPage === 26));
});

test("rewinder web jam fault 028 points to P602 analog dancer feedback instead of inventing a jam switch", () => {
  const trace = library.getStationFaultTemplate(28).circuitTrace;
  assert.ok(trace.plcSignals.includes("E5701_P602_RewinderUnitActualValue"));
  assert.ok(trace.plcSignals.includes("Local:9:I.In[0].Data"));
  assert.ok(trace.plcSignals.includes("Rewinder.dx"));
  const p602 = trace.deviceRows.find((row) => row.device === "P602");
  assert.equal(p602.cable, "5701-W602");
  assert.match(p602.terminals, /I\/O051 analog input IN-0/);
  assert.match(trace.summary, /not a dedicated 'web jam switch'/i);
});

test("rewinder web break fault 029 retains the actual PLC analog threshold/time behavior", () => {
  const trace = library.getStationFaultTemplate(29).circuitTrace;
  assert.ok(trace.plcSignals.includes("ComputedRewindUnitActualValue"));
  assert.ok(trace.plcSignals.includes("WebBreakTime"));
  assert.match(trace.summary, /29000/);
  assert.match(trace.summary, /1000/);
  assert.match(trace.scopeNote, /PLC-revision behavior only/i);
});

test("Station Labeler Encoder Fault 030 binds CN131 and OPTO131/132 without conflating the direct trigger", () => {
  const trace = library.getStationFaultTemplate(30).circuitTrace;
  assert.ok(trace.plcSignals.includes("Local:5:I.Data.9"));
  assert.ok(trace.plcSignals.includes("Local:5:I.Data.10"));
  assert.ok(trace.deviceRows.some((row) => row.device === "CN131"));
  assert.ok(trace.deviceRows.some((row) => row.device === "OPTO131"));
  assert.ok(trace.deviceRows.some((row) => row.device === "OPTO132"));
  assert.match(trace.scopeNote, /OPTO131 is explicitly used/i);
  assert.match(trace.scopeNote, /does not claim OPTO132 alone/i);
  assert.ok(trace.drawingLocations.some((location) => location.pdfPage === 50));
});

test("v330 browser order places Station hardware after exact circuit v2 and before troubleshooting controller", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const circuit = html.indexOf("topmodul-circuit-trace.js");
  const v330 = html.indexOf("topmodul-station-hardware-v330.js");
  const app = html.indexOf("troubleshooting-app.js");
  assert.ok(circuit >= 0 && v330 > circuit && app > v330);

  const worker = fs.readFileSync(path.join(__dirname, "../service-worker.js"), "utf8");
  assert.match(worker, /\.\/app\/troubleshooting\/topmodul-station-hardware-v330\.js/);
});
