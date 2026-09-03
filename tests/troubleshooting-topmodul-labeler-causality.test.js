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
const library = require("../app/troubleshooting/topmodul-labeler-cause-model.js")(stationCause);

test("Labeler causality validates without changing shared Station cause evidence", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(library.getTopModulFault(1091).stationRungEvidence.producerSignals[0], "BaseMachineEncoderAxis.FeedbackFault");
  assert.match(library.version, /topmodul-labeler-causality-v1/);
});

test("main drive and contactor faults bind to their actual Labeler producer paths", () => {
  const drive = library.getTopModulFault(480).labelerRungEvidence;
  const contactor = library.getTopModulFault(482).labelerRungEvidence;
  const timer = library.getTopModulFault(490).labelerRungEvidence;
  assert.equal(drive.routine, "SpeedControl_Jumps");
  assert.ok(drive.producerSignals.includes("DriveConETH_01.O_NoFault"));
  assert.equal(contactor.routine, "ContactorMonitor");
  assert.match(contactor.logicSummary, /three invalid command\/feedback states/i);
  assert.match(timer.routine, /ElectrBrake/);
  assert.ok(timer.producerSignals.includes("ElectrBrake.O_HWTimerFault"));
});

test("servo bottle table alarm bits bind to decoded PowerPC message codes", () => {
  const power = library.getTopModulFault(512).labelerRungEvidence;
  const feedback = library.getTopModulFault(515).labelerRungEvidence;
  const encoder = library.getTopModulFault(524).labelerRungEvidence;
  const can = library.getTopModulFault(528).labelerRungEvidence;
  assert.ok(power.producerSignals.includes("DT_PowerPC_Response.LastMessage.Faultcode == 16"));
  assert.ok(feedback.producerSignals.includes("DT_PowerPC_Response.LastMessage.Faultcode == 33"));
  assert.ok(encoder.producerSignals.includes("DT_PowerPC_Response.LastMessage.Faultcode == 120"));
  assert.ok(can.producerSignals.includes("DT_PowerPC_Response.LastMessage.Faultcode == 130"));
  assert.equal(power.evidenceStatus, "message-code-and-bitfield-bound");
});

test("known inactive and catalog-only Labeler alarm paths stay explicitly downgraded", () => {
  assert.equal(library.getTopModulFault(520).labelerRungEvidence.rootLikelihood, "catalog-only");
  assert.equal(library.getTopModulFault(662).labelerRungEvidence.rootLikelihood, "disabled");
  assert.match(library.getTopModulFault(662).labelerRungEvidence.logicSummary, /Logic_1/);
  assert.equal(library.getTopModulFault(649).labelerRungEvidence.rootLikelihood, "disabled");
});

test("fine-clock and machine-stop safety faults remain separate and use fine-clock hardware evidence", () => {
  const stop = library.getTopModulFault(669).labelerRungEvidence;
  const fine = library.getTopModulFault(670).labelerRungEvidence;
  assert.match(stop.logicType, /zero-speed/);
  assert.match(fine.logicType, /fine-pulse/);
  assert.ok(fine.producerSignals.includes("E1701_ENC101_FineClockPulse"));
  assert.ok(fine.producerSignals.includes("ElectrBrake.FinePulseCon"));
  assert.match(fine.logicSummary, /3000 ms/i);
});

test("APL station synchronization summary records that Cart 1 forces the sync transmit bit healthy", () => {
  const sync = library.getTopModulFault(642).labelerRungEvidence;
  assert.equal(sync.rootLikelihood, "supervision");
  assert.match(sync.logicSummary, /not needed in the APL/i);
  assert.match(sync.logicSummary, /Logic_1/i);
});

test("Servo Bottle Table summary ranks decoded message faults ahead of summary-only evidence", () => {
  const candidates = library.getTopModulFirstFaultCandidates(661, 8);
  assert.ok(candidates.some((entry) => entry.number >= 512 && entry.number <= 532 && entry.labelerRungEvidence?.rootLikelihood === "primary"));
  assert.equal(candidates.some((entry) => entry.number === 662), false);
});

test("browser loads Labeler cause model after Station cause model and UI supports both evidence scopes", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const station = html.indexOf("topmodul-station-cause-model.js");
  const labeler = html.indexOf("topmodul-labeler-cause-model.js");
  const app = html.indexOf("troubleshooting-app.js");
  assert.ok(station >= 0 && labeler > station && app > labeler);
  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-fault-drilldown-ui.js"), "utf8");
  assert.match(ui, /entry\.stationRungEvidence \|\| entry\.labelerRungEvidence/);
  assert.match(ui, /PLC cause evidence —/);
});
