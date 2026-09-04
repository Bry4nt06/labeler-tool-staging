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
const library = require("../app/troubleshooting/topmodul-station-process-trace.js")(communication);

test("Station process trace validates and only promotes verified producers", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /station-process-trace-v1/);
  assert.deepEqual([...library.topModulStationProcessTraceOffsets], [17, 18, 19, 22, 28, 29]);
  assert.equal(library.getStationFaultTemplate(31).processTrace, undefined);
});

test("Fault 017 is a Motion Servo On instruction error state, not a generic feedback-cable alarm", () => {
  const trace = library.getStationFaultTemplate(17).processTrace;
  assert.ok(trace.producerSignals.includes("MainDrive.MTags.MSO[0].ER"));
  assert.ok(trace.producerSignals.includes("MainDrive.SData.Status.ReadyForFeedbackON"));
  assert.match(trace.summary, /not a physical 'feedback wire open'/i);
  assert.match(trace.summary, /032-054/);
});

test("Fault 018 preserves the exact negative synchronization-distance equation", () => {
  const trace = library.getStationFaultTemplate(18).processTrace;
  assert.ok(trace.producerSignals.includes("LabelingData.Sync_Distance"));
  assert.ok(trace.calculationSteps.some((row) => /ParLS_Actual\.Par1\[12\] \/ 100/.test(row.value)));
  assert.ok(trace.calculationSteps.some((row) => /ParLS_Actual\.Par1\[14\] × 1000/.test(row.value)));
  assert.ok(trace.calculationSteps.some((row) => /Sync_Distance = LabelLength - ACC_Distance - ACC_Distance/.test(row.value)));
  assert.match(trace.summary, /calculated motion-profile feasibility/i);
});

test("Fault 019 preserves the 125 percent cycle-utilization threshold", () => {
  const trace = library.getStationFaultTemplate(19).processTrace;
  assert.ok(trace.calculationSteps.some((row) => /OverallMovementPercent = 100 × Move_Time \/ TimeOneCycle/.test(row.value)));
  assert.ok(trace.calculationSteps.some((row) => /> 125/.test(row.value)));
  assert.equal(trace.hardwareRows.length, 0);
});

test("Fault 022 captures repeated label-length measurement logic and P141 hardware authority", () => {
  const trace = library.getStationFaultTemplate(22).processTrace;
  assert.ok(trace.producerSignals.includes("CountLabelLengthBad"));
  assert.ok(trace.producerSignals.includes("ParLS_Actual.Par1[22]"));
  assert.ok(trace.calculationSteps.some((row) => /±20%/.test(row.value)));
  assert.ok(trace.hardwareRows.some((row) => row.device.includes("P141") && row.cable === "2001-W141"));
  assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 51));
});

test("Faults 028 and 029 share P602 hardware but keep different PLC supervision methods", () => {
  const jam = library.getStationFaultTemplate(28).processTrace;
  const webBreak = library.getStationFaultTemplate(29).processTrace;
  assert.ok(jam.hardwareRows.some((row) => row.device === "P602" && row.cable === "5701-W602"));
  assert.ok(webBreak.hardwareRows.some((row) => row.device === "P602" && row.cable === "5701-W602"));
  assert.ok(jam.producerSignals.includes("FixedArm"));
  assert.ok(jam.producerSignals.includes("StorePulseTwoCycWithWebJam"));
  assert.ok(webBreak.calculationSteps.some((row) => /> 29000/.test(row.value)));
  assert.ok(webBreak.calculationSteps.some((row) => /> 1000/.test(row.value)));
  assert.match(webBreak.summary, /web break after head/i);
});

test("browser loads process model before app and process UI after drilldown UI", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const communication = html.indexOf("topmodul-station-communication-circuit.js");
  const processModel = html.indexOf("topmodul-station-process-trace.js");
  const app = html.indexOf("troubleshooting-app.js");
  const drillUi = html.indexOf("topmodul-fault-drilldown-ui.js");
  const processUi = html.indexOf("topmodul-process-trace-ui.js");
  assert.ok(communication >= 0 && processModel > communication && app > processModel && drillUi > app && processUi > drillUi);

  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-process-trace-ui.js"), "utf8");
  assert.match(ui, /Process \/ calculation evidence/);
  assert.match(ui, /data-topmodul-process-trace/);
});
