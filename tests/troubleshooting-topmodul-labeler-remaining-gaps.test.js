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
const inspection = require("../app/troubleshooting/topmodul-labeler-inspection-coder-trace.js")(lubrication);
const operatingState = require("../app/troubleshooting/topmodul-labeler-operating-state-trace.js")(inspection);
const library = require("../app/troubleshooting/topmodul-labeler-remaining-gaps-trace.js")(operatingState);

test("v345 source audit validates and recovers two real named alarms", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /labeler-remaining-gaps-v1/);
  assert.equal(library.topModulNamedFaultCount, 515);
  assert.deepEqual([...library.topModulSupplementalNamedFaults], [700, 719]);
  assert.deepEqual([...library.topModulSupplementalAlarmPositions], [697, 700, 719]);
  assert.deepEqual([...library.topModulLabelerRemainingSourceGaps], [489, 641, 697]);
});

test("Fault 489 stays unproduced while preserving the real Fumex Warning 32 interface", () => {
  const entry = library.getTopModulFault(489);
  assert.ok(entry.sourceGap);
  assert.equal(entry.processTrace, undefined);
  assert.match(entry.sourceGap.reason, /no producer occurrence/i);
  assert.ok(entry.circuitTrace.plcSignals.includes("E5101_A999_FumexRunning = I0011.16"));
  assert.ok(entry.circuitTrace.plcSignals.includes("Warnings_LB1[2].0 = Warning 32 Fumex Not Ready"));
  assert.ok(entry.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 172));
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "disabled");
});

test("Fault 641 cannot borrow general-air PS101 or infeed-worm clutch P131", () => {
  const entry = library.getTopModulFault(641);
  assert.ok(entry.sourceGap);
  assert.equal(entry.processTrace, undefined);
  assert.equal(entry.circuitTrace, undefined);
  assert.match(entry.sourceGap.reason, /PS101.*Fault 640/i);
  assert.match(entry.sourceGap.reason, /P131.*Fault 684/i);
  assert.match(entry.sourceGap.reason, /no distinct infeed-worm pressure-switch/i);
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "disabled");
});

test("Fault 697 is searchable only as an unassigned source-gap position", () => {
  const entry = library.searchEntries("697", { machineType: "TopModul" }, 3)[0];
  assert.equal(entry.number, 697);
  assert.match(entry.title, /unassigned/i);
  assert.ok(entry.sourceGap);
  assert.equal(entry.processTrace, undefined);
  assert.equal(entry.plcFault.address, "Faults_LB1[43].9");
});

test("Fault 700 is the raw Heuft sequential-label latch and remains distinct from Fault 673", () => {
  const entry = library.searchEntries("700", { machineType: "TopModul" }, 3)[0];
  assert.equal(entry.number, 700);
  assert.equal(entry.plcFault.address, "Faults_LB1[43].12");
  assert.ok(entry.processTrace.producerSignals.includes("E9712_HeuftLabelFault = I0011.19"));
  assert.ok(entry.processTrace.producerSignals.includes("OTE(Faults_LB1[43].12)"));
  assert.ok(entry.processTrace.producerSignals.includes("OTE(Produced_Labeler85_1.Interlock_Data_Bit[38])"));
  assert.ok(entry.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 193));
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "primary");
  const relation = library.getTopModulFaultRelations(700, 8).find((row) => row.number === 673);
  assert.ok(relation);
  assert.equal(relation.causalRole, "parallel-evidence");
  assert.match(relation.relationReason, /raw-event latch.*processed Inspection output/i);
});

test("Fault 719 is consecutive missing Good Shot supervision, not a direct encoder-input alarm", () => {
  const entry = library.searchEntries("719", { machineType: "TopModul" }, 3)[0];
  assert.equal(entry.number, 719);
  assert.equal(entry.plcFault.address, "Faults_LB1[44].15");
  assert.ok(entry.processTrace.producerSignals.includes("LaserGoodShot.FaultCounter.PRE = 150"));
  assert.ok(entry.processTrace.producerSignals.includes("GoodShot_Max_Failures = 154 (counter saturation cap, not DN threshold)"));
  assert.ok(entry.processTrace.producerSignals.includes("Head1OK I0011.13 OR Head2OK I0011.14 -> LaserGoodShot.GoodShot"));
  assert.ok(entry.processTrace.producerSignals.includes("LaserGoodShot.Fault -> Faults_LB1[44].15"));
  assert.ok(entry.circuitTrace.plcSignals.includes("XIC(Logic_1) OTE(E5101_A999_26_EncoderOK)"));
  assert.ok(entry.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 174));
  assert.ok(entry.circuitTrace.drawingLocations.some((row) => Number(row.pdfPage) === 176));
  assert.match(entry.processTrace.summary, /not.*direct TopModul encoder feedback fault/i);
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "primary");
});

test("Fault 719 drill-down keeps coder readiness/air contextual and blocks encoder misrouting", () => {
  const drillDown = library.getTopModulFaultDrillDown(719, 8);
  assert.equal(drillDown.entry.number, 719);
  assert.match(drillDown.prompt, /Good Shot/i);
  assert.match(drillDown.prompt, /before treating.*Enchoder.*direct encoder fault/i);
  assert.ok(drillDown.related.some((row) => row.number === 672));
  assert.ok(drillDown.related.some((row) => row.number === 687));
  assert.doesNotMatch(drillDown.prompt, /main-machine encoder circuit as the first step/i);
});

test("legacy field 00067 separation remains intact after supplemental fault recovery", () => {
  const field = library.searchEntries("00067", { machineType: "TopModul" }, 3)[0];
  assert.equal(field.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(field.plcFault, undefined);
  assert.equal(library.getTopModulFault(67).title, "Labeling Station Change Mode Active");
});

test("browser keeps v345 after operating-state and before later troubleshooting phases", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const operatingPos = html.indexOf("topmodul-labeler-operating-state-trace.js");
  const gapsPos = html.indexOf("topmodul-labeler-remaining-gaps-trace.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  assert.ok(operatingPos >= 0 && gapsPos > operatingPos && appPos > gapsPos);
  const version = Number(html.match(/data-troubleshooting-version="v(\d+)"/)?.[1] || 0);
  assert.ok(version >= 345, `Expected troubleshooting version >=345, found v${version}.`);
});
