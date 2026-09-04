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
const foundation = require("../app/troubleshooting/topmodul-station-foundation-circuit.js")(process);
const library = require("../app/troubleshooting/topmodul-labeler-safety-circuit.js")(foundation);

test("Labeler safety layer validates against exact K407039 authority", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /labeler-safety-circuit-v1/);
  assert.ok(library.topModulLabelerSafetyFaults.includes(680));
  assert.ok(library.topModulLabelerSafetyFaults.includes(681));
});

test("specific Labeler E-stop faults bind directly to device inputs", () => {
  const infeed = library.getTopModulFault(1).circuitTrace;
  const ocp = library.getTopModulFault(5).circuitTrace;
  const station6 = library.getTopModulFault(13).circuitTrace;
  assert.equal(infeed.deviceRows[0].device, "PB152");
  assert.ok(infeed.plcSignals.includes("I0009.01"));
  assert.equal(ocp.deviceRows[0].device, "PB151");
  assert.ok(ocp.plcSignals.includes("I0009.00"));
  assert.ok(station6.plcSignals.includes("E1101_Agg6_EStop"));
  assert.ok(station6.plcSignals.includes("I0009.14"));
  assert.equal(infeed.source.drawing, "K407039-001");
});

test("specific guard faults keep exact switch/relay instances", () => {
  const door1 = library.getTopModulFault(33).circuitTrace;
  const door7 = library.getTopModulFault(39).circuitTrace;
  const agg6 = library.getTopModulFault(53).circuitTrace;
  assert.equal(door1.deviceRows[0].device, "LS101");
  assert.equal(door1.deviceRows[0].cable, ".1201-W101");
  assert.ok(door1.plcSignals.includes("I0008.00"));
  assert.equal(door7.deviceRows[0].device, "LS111");
  assert.equal(door7.deviceRows[0].cable, ".1201-W111");
  assert.equal(agg6.deviceRows[0].device, "CR212");
  assert.ok(agg6.plcSignals.includes("I0008.13"));
});

test("Fault 680 is safety-chain feedback mismatch, not just a pressed E-stop", () => {
  const trace = library.getTopModulFault(680).circuitTrace;
  assert.ok(trace.plcSignals.includes("E1101.M_EStopFaultSafetyCircuit"));
  assert.ok(trace.plcSignals.includes("E1101_C201_EStopToEM_FB"));
  assert.ok(trace.plcSignals.includes("E1101_CR211_EStopChainFB"));
  assert.ok(trace.plcSignals.includes("E1101_C223_EStopToLabelingStationsFB"));
  assert.ok(trace.deviceRows.some((row) => row.device === "C201"));
  assert.ok(trace.deviceRows.some((row) => row.device === "CR211"));
  assert.ok(trace.deviceRows.some((row) => row.device === "C223"));
  assert.match(trace.summary, /2000 ms/);
  assert.match(trace.summary, /3500 ms/);
  assert.match(trace.summary, /specific Fault 001\/002\/005-013/i);
});

test("Fault 681 is guard safety feedback mismatch and remains separate from open-door faults", () => {
  const trace = library.getTopModulFault(681).circuitTrace;
  assert.ok(trace.plcSignals.includes("E1201.M_GuardFaultSafetyCircuit"));
  assert.ok(trace.plcSignals.includes("E1201_CR231_GuardChainFB"));
  assert.ok(trace.plcSignals.includes("E1201.T_GuardRelayDelay"));
  assert.ok(trace.plcSignals.includes("E1201.T_GuardSafetyCircuit"));
  assert.match(trace.summary, /3500 ms/);
  assert.match(trace.summary, /2000 ms/);
  assert.match(trace.summary, /Faults 033-039 or 048-053/i);
});

test("named Laser E-stop Fault 014 remains unpromoted for this Labeler revision", () => {
  const entry = library.getTopModulFault(14);
  assert.ok(entry);
  assert.equal(entry.circuitTrace, undefined);
  assert.equal(entry.sourceGap.status, "named-but-producer-inactive-in-this-revision");
  assert.match(entry.sourceGap.reason, /XIC\(Laser_01\.O_LaserEStop\).*XIO\(Laser_01\.O_LaserEStop\)/i);
});

test("browser loads Labeler safety after Station foundation and before app", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const foundation = html.indexOf("topmodul-station-foundation-circuit.js");
  const labelerSafety = html.indexOf("topmodul-labeler-safety-circuit.js");
  const app = html.indexOf("troubleshooting-app.js");
  assert.ok(foundation >= 0 && labelerSafety > foundation && app > labelerSafety);
});
