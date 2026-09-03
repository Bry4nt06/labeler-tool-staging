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
const library = require("../app/troubleshooting/topmodul-station-cause-model.js")(trace);

test("station rung causality validates the shared 62-position station model", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(library.topModulStationRungLocatedCount, 58);
  assert.equal(library.topModulStationActiveCauseCount, 56);
  assert.equal(library.topModulStationCatalogOnlyCount, 4);
  assert.equal(library.topModulStationDisabledPlaceholderCount, 2);
});

test("exact encoder feedback fault carries direct station-controller cause evidence", () => {
  const fault = library.getTopModulFault(1091);
  assert.equal(fault.diagnosticScope, "Station");
  assert.equal(fault.stationTemplateOffset, 67);
  assert.equal(fault.stationRungEvidence.rootLikelihood, "primary");
  assert.equal(fault.stationRungEvidence.logicType, "direct-controller-status");
  assert.deepEqual(fault.stationRungEvidence.producerSignals, ["BaseMachineEncoderAxis.FeedbackFault"]);
});

test("feed-unit and encoder-monitoring faults point to their real producing routines", () => {
  const loopBuffer = library.getStationFaultTemplate(26);
  const encoderMonitor = library.getStationFaultTemplate(30);
  assert.equal(loopBuffer.stationRungEvidence.routine, "FeedUnit");
  assert.match(loopBuffer.stationRungEvidence.logicSummary, /rear-covered count exceeds 20|front-free count exceeds 4/i);
  assert.equal(encoderMonitor.stationRungEvidence.routine, "BaseMachine_Encoder");
  assert.match(encoderMonitor.stationRungEvidence.logicSummary, /clock-pulse|registration-difference/i);
});

test("secondary, disabled, and catalog-only station alarms are not treated as primary root causes", () => {
  assert.equal(library.getStationFaultTemplate(4).stationRungEvidence.rootLikelihood, "secondary");
  assert.equal(library.getStationFaultTemplate(40).stationRungEvidence.rootLikelihood, "disabled");
  assert.deepEqual(library.getStationFaultTemplate(40).stationRungEvidence.producerSignals, ["Logic_0"]);
  assert.equal(library.getStationFaultTemplate(8).stationRungEvidence.rootLikelihood, "catalog-only");
  assert.equal(library.getStationFaultTemplate(8).stationRungEvidence.evidenceStatus, "alarm-table-only");
});

test("first-fault ranking promotes PLC-proven station producers ahead of summary alarms", () => {
  const rows = library.getTopModulFirstFaultCandidates(663, 8);
  assert.ok(rows.length >= 3);
  assert.ok(rows.some((entry) => entry.plcFault.station === 1 && entry.stationRungEvidence?.rootLikelihood === "primary"));
  assert.equal(rows.some((entry) => entry.causalRole === "downstream-summary"), false);
  assert.equal(rows.some((entry) => entry.stationRungEvidence?.rootLikelihood === "disabled"), false);
});

test("browser loads cause model after station transport and UI exposes cause/first-fault panels", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const transport = html.indexOf("topmodul-station-controller-trace.js");
  const cause = html.indexOf("topmodul-station-cause-model.js");
  const app = html.indexOf("troubleshooting-app.js");
  assert.ok(transport >= 0 && cause > transport && app > cause);
  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-fault-drilldown-ui.js"), "utf8");
  assert.match(ui, /PLC cause evidence/);
  assert.match(ui, /Start here — first-fault candidates/);
  assert.match(ui, /stationRungEvidence/);
});
