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
const stationComm = require("../app/troubleshooting/topmodul-station-communication-circuit.js")(servo);
const stationProcess = require("../app/troubleshooting/topmodul-station-process-trace.js")(stationComm);
const foundation = require("../app/troubleshooting/topmodul-station-foundation-circuit.js")(stationProcess);
const safety = require("../app/troubleshooting/topmodul-labeler-safety-circuit.js")(foundation);
const driveUtilities = require("../app/troubleshooting/topmodul-labeler-drive-utilities-circuit.js")(safety);
const rpc = require("../app/troubleshooting/topmodul-rpc-method-bridge.js")(driveUtilities);
const labelerComm = require("../app/troubleshooting/topmodul-labeler-communication-circuit.js")(rpc);
const containerFlow = require("../app/troubleshooting/topmodul-labeler-container-flow-trace.js")(labelerComm);
const library = require("../app/troubleshooting/topmodul-labeler-electrical-protection.js")(containerFlow);

test("Labeler electrical-protection layer validates source-supported and source-gap paths", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /labeler-electrical-protection-v1/);
  assert.deepEqual([...library.topModulLabelerElectricalProtectionFaults], [134, 682]);
  assert.deepEqual([...library.topModulLabelerElectricalProtectionSourceGaps], [130, 131, 132, 133]);
});

test("Fault 682 isolates four monitored 24 V control-voltage breakers", () => {
  const entry = library.getTopModulFault(682);
  const trace = entry.circuitTrace;
  assert.ok(trace.plcSignals.includes("E0301_CB202_Overload_B = I0009.20"));
  assert.ok(trace.plcSignals.includes("E0301_CB211_Overload_C = I0009.21"));
  assert.ok(trace.plcSignals.includes("E0301_CB212_Overload_D = I0009.22"));
  assert.ok(trace.plcSignals.includes("E0301_CB221_Overload_E = I0009.23"));
  assert.equal(trace.deviceRows.length, 4);
  assert.ok(trace.deviceRows.some((row) => row.device === "CB202" && /6 A/.test(row.description)));
  assert.ok(trace.deviceRows.some((row) => row.device === "CB221" && /I0009\.23/.test(row.terminals)));
  assert.deepEqual(trace.drawingLocations.map((row) => row.pdfPage), [40, 41, 42]);
  assert.match(trace.summary, /distinct from Fault 486/i);
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "primary");
});

test("Fault 134 remains an external Full Bottle Conveyor readiness interlock", () => {
  const entry = library.getTopModulFault(134);
  const trace = entry.processTrace;
  assert.ok(trace.producerSignals.includes("Consumed_FullBottle85_B.Interlock_Data_Bit[31]"));
  assert.ok(trace.producerSignals.includes("XIO(Consumed_FullBottle85_B.Interlock_Data_Bit[31])"));
  assert.ok(trace.producerSignals.includes("Interlocks_FullBottle85_B = 1756-ENBT/A / 10.99.218.28"));
  assert.match(trace.summary, /not a local motor-disconnect input/i);
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "secondary");
});

test("Faults 130-133 stay searchable without borrowing overload or drive circuits", () => {
  for (const number of [130, 131, 132, 133]) {
    const entry = library.getTopModulFault(number);
    assert.ok(entry);
    assert.ok(entry.sourceGap);
    assert.equal(entry.circuitTrace, undefined);
    assert.equal(entry.processTrace, undefined);
    assert.match(entry.sourceGap.reason, /no producer occurrence anywhere/i);
  }
  assert.match(library.getTopModulFault(132).sourceGap.reason, /I0009\.28.*Fault 486/i);
  assert.match(library.getTopModulFault(133).sourceGap.reason, /discharge-conveyor overload and PF70 drive faults are separate/i);
});

test("browser loads v341 electrical-protection model after container flow and before controller", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const flowPos = html.indexOf("topmodul-labeler-container-flow-trace.js");
  const protectionPos = html.indexOf("topmodul-labeler-electrical-protection.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  assert.ok(flowPos >= 0 && protectionPos > flowPos && appPos > protectionPos);
});
