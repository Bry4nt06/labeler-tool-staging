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
const stationProcess = require("../app/troubleshooting/topmodul-station-process-trace.js")(communication);
const foundation = require("../app/troubleshooting/topmodul-station-foundation-circuit.js")(stationProcess);
const safety = require("../app/troubleshooting/topmodul-labeler-safety-circuit.js")(foundation);
const driveUtilities = require("../app/troubleshooting/topmodul-labeler-drive-utilities-circuit.js")(safety);
const rpc = require("../app/troubleshooting/topmodul-rpc-method-bridge.js")(driveUtilities);
const labelerCommunication = require("../app/troubleshooting/topmodul-labeler-communication-circuit.js")(rpc);
const containerFlow = require("../app/troubleshooting/topmodul-labeler-container-flow-trace.js")(labelerCommunication);
const protection = require("../app/troubleshooting/topmodul-labeler-electrical-protection.js")(containerFlow);
const library = require("../app/troubleshooting/topmodul-labeler-lubrication-trace.js")(protection);

const faults = [675, 676, 677, 689, 690];

test("TopModul Labeler lubrication phase validates the exact five-fault family", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /labeler-lubrication-v1/);
  assert.deepEqual([...library.topModulLabelerLubricationFaults], faults);
});

test("Fault 675 binds PS103 excess pressure to the first-level lubrication pressure alarm", () => {
  const entry = library.getTopModulFault(675);
  assert.equal(entry.diagnosticScope, "Labeler");
  assert.ok(entry.processTrace.producerSignals.includes("E2801_PS103_CentralLubeOverPressure = I0010.23"));
  assert.ok(entry.processTrace.producerSignals.includes("Faults_LB1[42].3"));
  assert.ok(entry.circuitTrace.deviceRows.some((row) => row.device === "PS103" && /I0010\.23/.test(row.terminals)));
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "primary");
  assert.match(entry.processTrace.summary, /first-level central-lubrication excess-pressure alarm/i);
});

test("Fault 676 keeps the 600-second cycle-duration and P101 cycle-end evidence", () => {
  const entry = library.getTopModulFault(676);
  assert.ok(entry.processTrace.producerSignals.includes("Lube.TimeExc.PRE = 600"));
  assert.ok(entry.processTrace.producerSignals.includes("Pulse._1Hz"));
  assert.ok(entry.processTrace.producerSignals.includes("E2801_P101_CentralLubeEnd = I0010.21"));
  assert.ok(entry.circuitTrace.deviceRows.some((row) => row.device === "P101" && /I0010\.21/.test(row.terminals)));
  assert.match(entry.processTrace.summary, /cycle-duration supervision/i);
  assert.match(entry.processTrace.calculationSteps.map((step) => step.value).join(" "), /600 seconds|10 minutes/i);
});

test("Fault 677 is the independent FS102 low-grease path", () => {
  const entry = library.getTopModulFault(677);
  assert.ok(entry.processTrace.producerSignals.includes("E2801_FS102_CentralLubeLack = I0010.22"));
  assert.ok(entry.circuitTrace.deviceRows.some((row) => row.device === "FS102" && /I0010\.22/.test(row.terminals)));
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "primary");
  assert.match(entry.processTrace.summary, /not a timing or pressure calculation/i);
});

test("Faults 689 and 690 remain retry escalations, not new physical devices", () => {
  const duration = library.getTopModulFault(689);
  const pressure = library.getTopModulFault(690);
  assert.ok(duration.processTrace.producerSignals.includes("Lube.DurationErrors.PRE = 4"));
  assert.ok(pressure.processTrace.producerSignals.includes("Lube.OverpressureErrors.PRE = 4"));
  assert.equal(duration.labelerRungEvidence.rootLikelihood, "secondary");
  assert.equal(pressure.labelerRungEvidence.rootLikelihood, "secondary");
  assert.match(duration.processTrace.summary, /escalation of repeated Fault 676-style duration failures/i);
  assert.match(pressure.processTrace.summary, /excessive-retry escalation of the Fault 675 overpressure family/i);
});

test("retry escalations explicitly drill back to the underlying first-level fault", () => {
  const d689 = library.getTopModulFaultDrillDown(689, 8);
  const d690 = library.getTopModulFaultDrillDown(690, 8);
  assert.equal(d689.firstFaultCandidates[0].number, 676);
  assert.equal(d690.firstFaultCandidates[0].number, 675);
  assert.ok(d689.related.some((entry) => entry.number === 676 && /underlying first-level duration/i.test(entry.relationReason)));
  assert.ok(d690.related.some((entry) => entry.number === 675 && /underlying first-level overpressure/i.test(entry.relationReason)));
});

test("lubrication family retains exact K407039 hardware authority", () => {
  const trace = library.getTopModulFault(675).circuitTrace;
  assert.equal(trace.source.drawing, "K407039-001");
  assert.ok(trace.drawingLocations.some((location) => Number(location.pdfPage) === 167));
  for (const device of ["P101", "FS102", "PS103", "C104 / MTR104"]) {
    assert.ok(trace.deviceRows.some((row) => row.device === device), `Missing ${device} from central-lubrication circuit.`);
  }
});

test("browser keeps the lubrication model after v341 and before later troubleshooting phases", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const protectionPos = html.indexOf("topmodul-labeler-electrical-protection.js");
  const lubePos = html.indexOf("topmodul-labeler-lubrication-trace.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  assert.ok(protectionPos >= 0 && lubePos > protectionPos && appPos > lubePos);
  const phase = html.match(/data-troubleshooting-version="v(\d+)"/);
  assert.ok(phase, "Troubleshooting banner must expose a numeric phase.");
  assert.ok(Number(phase[1]) >= 342, `Lubrication requires troubleshooting phase v342 or later; found v${phase[1]}.`);
});
