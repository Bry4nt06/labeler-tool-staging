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
const lubrication = require("../app/troubleshooting/topmodul-labeler-lubrication-trace.js")(protection);
const library = require("../app/troubleshooting/topmodul-labeler-inspection-coder-trace.js")(lubrication);

test("v343 inspection/coder model validates without weakening prior layers", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /labeler-inspection-coder-v1/);
  assert.deepEqual([...library.topModulLabelerInspectionCoderFaults], [672, 673, 674, 687, 688, 691]);
  assert.deepEqual([...library.topModulLabelerInspectionCoderSourceGaps], [671, 688]);
});

test("Fault 671 stays searchable but has no invented producer or coder route", () => {
  const entry = library.getTopModulFault(671);
  assert.ok(entry);
  assert.match(entry.title, /Front Label Dating/i);
  assert.equal(entry.processTrace, undefined);
  assert.equal(entry.circuitTrace, undefined);
  assert.match(entry.sourceGap.reason, /no producer occurrence/i);
});

test("Fault 672 binds Laser Ready I0011.11 to the A999 interface on K407039 page 174", () => {
  const entry = library.getTopModulFault(672);
  assert.ok(entry.processTrace.producerSignals.includes("E5101_A999_02_LaserCoderReady = I0011.11"));
  assert.ok(entry.processTrace.producerSignals.includes("Faults_LB1[42].0"));
  assert.ok(entry.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 174));
  assert.ok(entry.circuitTrace.deviceRows.some((row) => /Laser coder interface/.test(row.device)));
});

test("Faults 673, 674 and 691 retain distinct Heuft inputs on the same interface", () => {
  const label = library.getTopModulFault(673);
  const ready = library.getTopModulFault(674);
  const sonic = library.getTopModulFault(691);
  assert.ok(label.processTrace.producerSignals.includes("E9712_HeuftLabelFault = I0011.19"));
  assert.ok(ready.processTrace.producerSignals.includes("E9712_HeuftReady = I0011.18"));
  assert.ok(sonic.processTrace.producerSignals.includes("E9712_HeuftSonicFault = I0011.20"));
  for (const entry of [label, ready, sonic]) {
    assert.ok(entry.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 193));
  }
  assert.match(label.processTrace.calculationSteps.map((step) => step.value).join(" "), /200 ms/i);
  assert.match(sonic.processTrace.calculationSteps.map((step) => step.value).join(" "), /200 ms/i);
  assert.match(ready.processTrace.summary, /not reporting Ready/i);
});

test("Fault 687 selects laser air pressure by APL mode and preserves mixed source confidence", () => {
  const entry = library.getTopModulFault(687);
  assert.ok(entry.processTrace.producerSignals.includes("Laser_01.DelayAirPressureFault.PRE = 2000"));
  assert.ok(entry.processTrace.producerSignals.some((s) => /PS131.*I0011\.9/.test(s)));
  assert.ok(entry.processTrace.producerSignals.some((s) => /PS134.*I0011\.17/.test(s)));
  assert.ok(entry.circuitTrace.deviceRows.some((row) => row.device === "PS131" && /exact K407039/.test(row.terminals)));
  assert.ok(entry.circuitTrace.deviceRows.some((row) => row.device === "PS134" && /PLC alias verified/.test(row.terminals)));
  assert.match(entry.circuitTrace.summary, /PS134.*not located|not located.*PS134/i);
});

test("Fault 688 exposes the real internal air-flow detector but marks the HMI output impossible", () => {
  const entry = library.getTopModulFault(688);
  assert.ok(entry.processTrace.producerSignals.includes("Laser_01.DelayAirFlowFault.PRE = 2000"));
  assert.ok(entry.processTrace.producerSignals.some((s) => /PS132.*I0011\.10/.test(s)));
  assert.ok(entry.processTrace.producerSignals.some((s) => /PS133.*I0011\.15/.test(s)));
  assert.match(entry.sourceGap.status, /self-contradictory/);
  assert.match(entry.sourceGap.reason, /XIC\(Laser_01\.O_AirFlowFault\).*XIO\(Laser_01\.O_AirFlowFault\)/);
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "disabled");
});

test("inspection readiness prioritizes specific Heuft faults and laser readiness prioritizes pressure", () => {
  const inspection = library.getTopModulFaultDrillDown(674, 8);
  const laser = library.getTopModulFaultDrillDown(672, 8);
  assert.ok(inspection.firstFaultCandidates.some((entry) => entry.number === 673));
  assert.ok(inspection.firstFaultCandidates.some((entry) => entry.number === 691));
  assert.ok(inspection.firstFaultCandidates.some((entry) => entry.number === 695));
  assert.equal(laser.firstFaultCandidates[0].number, 687);
  assert.ok(!laser.firstFaultCandidates.some((entry) => entry.number === 688));
});

test("existing disabled Heuft low-air path remains unpromoted", () => {
  const entry = library.getTopModulFault(696);
  assert.ok(entry.sourceGap || entry.labelerRungEvidence?.rootLikelihood === "disabled");
});

test("browser keeps v343 loaded after lubrication and before later troubleshooting phases", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const lubePos = html.indexOf("topmodul-labeler-lubrication-trace.js");
  const inspectionPos = html.indexOf("topmodul-labeler-inspection-coder-trace.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  assert.ok(lubePos >= 0 && inspectionPos > lubePos && appPos > inspectionPos);
  const version = Number(html.match(/data-troubleshooting-version="v(\d+)"/)?.[1] || 0);
  assert.ok(version >= 343, `Expected troubleshooting version >=343, found v${version}.`);
});
