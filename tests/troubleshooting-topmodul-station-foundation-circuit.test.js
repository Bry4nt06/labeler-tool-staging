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
const process = require("../app/troubleshooting/topmodul-station-process-trace.js")(communication);
const library = require("../app/troubleshooting/topmodul-station-foundation-circuit.js")(process);

test("Station foundation layer validates exact safety/controller faults and source gaps", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /station-foundation-circuit-v1/);
  assert.deepEqual([...library.topModulStationFoundationCircuitOffsets], [1, 2]);
});

test("Fault 001 preserves both direct and delayed main-machine E-stop feedback paths", () => {
  const trace = library.getStationFaultTemplate(1).circuitTrace;
  assert.ok(trace.plcSignals.includes("E1101_CR202_EStop"));
  assert.ok(trace.plcSignals.includes("I0005.04"));
  assert.ok(trace.plcSignals.includes("E1101_CR204_EStopDelayed"));
  assert.ok(trace.plcSignals.includes("I0005.05"));
  assert.ok(trace.deviceRows.some((row) => row.device === "CR202"));
  assert.ok(trace.deviceRows.some((row) => row.device === "CR204"));
  assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 42));
  assert.match(trace.safetyBoundary, /Never jumper, bypass, force, or defeat/i);
});

test("Fault 002 stays a controller LED-status diagnostic without inventing the value-3 definition", () => {
  const trace = library.getStationFaultTemplate(2).circuitTrace;
  assert.ok(trace.plcSignals.includes("GSV(MODULE,?,LedStatus,LEDStatus)"));
  assert.ok(trace.plcSignals.includes("NEQ(LEDStatus,3)"));
  assert.ok(trace.deviceRows.some((row) => /1756-L61/.test(row.device)));
  assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 29));
  assert.match(trace.summary, /does not itself decode the numeric LedStatus value 3/i);
});

test("unimplemented alarm-table positions remain searchable but explicitly unpromoted", () => {
  for (const offset of [0, 8, 24, 31, 55, 56, 57, 58, 59, 61, 62, 63]) {
    const entry = library.getStationFaultTemplate(offset);
    assert.equal(entry.sourceGap.status, "not-promoted-no-producer");
    assert.match(entry.sourceGap.reason, /no producer|placeholder|Blank/i);
  }
  assert.equal(library.getStationFaultTemplate(8).circuitTrace, undefined);
  assert.equal(library.getStationFaultTemplate(31).processTrace, undefined);
});

test("browser loads foundation model before app and source-gap UI after other diagnostic UIs", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const processModel = html.indexOf("topmodul-station-process-trace.js");
  const foundation = html.indexOf("topmodul-station-foundation-circuit.js");
  const app = html.indexOf("troubleshooting-app.js");
  const processUi = html.indexOf("topmodul-process-trace-ui.js");
  const gapUi = html.indexOf("topmodul-source-gap-ui.js");
  assert.ok(processModel >= 0 && foundation > processModel && app > foundation && processUi > app && gapUi > processUi);

  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-source-gap-ui.js"), "utf8");
  assert.match(ui, /Source status — no producer promoted/);
  assert.match(ui, /will not invent a rung, device, cable, or corrective path/);
});
