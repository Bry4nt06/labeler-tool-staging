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
const safety = require("../app/troubleshooting/topmodul-labeler-safety-circuit.js")(foundation);
const library = require("../app/troubleshooting/topmodul-labeler-drive-utilities-circuit.js")(safety);

test("Labeler drive/utilities layer validates without losing earlier circuit authority", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /labeler-drive-utilities-circuit-v1/);
  assert.deepEqual([...library.topModulLabelerDriveUtilityFaults], [480, 486, 500]);
});

test("Fault 480 binds PF700 main drive, Node3 status and MS101 overload permissive separately", () => {
  const trace = library.getTopModulFault(480).circuitTrace;
  assert.ok(trace.plcSignals.includes("VSD85LB1_Node3:I.DriveStatus"));
  assert.ok(trace.plcSignals.includes("DriveConETH_01.O_MotOK"));
  assert.ok(trace.plcSignals.includes("DriveConETH_01.O_NoFault"));
  assert.ok(trace.deviceRows.some((row) => /PF700 Main Drive/.test(row.device)));
  assert.ok(trace.deviceRows.some((row) => row.device === "MS101" && /I0009\.25/.test(row.terminals)));
  assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 127));
  assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 128));
  assert.match(trace.summary, /not directly from the overload input alone/i);
});

test("Fault 486 remains a multi-source overload summary instead of being assigned to one MS101", () => {
  const trace = library.getTopModulFault(486).circuitTrace;
  assert.equal(trace.status, "machine-specific-multi-source-overload-summary-bound");
  for (const signal of [
    "E2001_MS101_MainDriveOverload",
    "E4101_MS101_ConveyorOverload",
    "E2101_MS101_HeightAdjOverload",
    "ServoTable_01.O_Overload"
  ]) assert.ok(trace.plcSignals.includes(signal));
  assert.ok(trace.plcSignals.some((signal) => /Aggregat_01.*Aggregat_06/.test(signal)));
  assert.match(trace.summary, /shared Motor Starter Overload summary/i);
  assert.match(trace.scopeNote, /Do not repeatedly reset a tripped overload/i);
});

test("Fault 500 binds PF70 discharge conveyor, Node4 status, overload input and 3 HP motor", () => {
  const trace = library.getTopModulFault(500).circuitTrace;
  assert.ok(trace.plcSignals.includes("VSD85LB1_Node4:I.DriveStatus"));
  assert.ok(trace.plcSignals.includes("DriveConETH_02.O_MotOK"));
  assert.ok(trace.plcSignals.includes("E4101_MS101_ConveyorOverload"));
  assert.ok(trace.deviceRows.some((row) => /PF70 Discharge Conveyor/.test(row.device)));
  assert.ok(trace.deviceRows.some((row) => /MTR101/.test(row.device) && /3 HP/.test(row.description)));
  assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 169));
  assert.ok(trace.drawingLocations.some((row) => row.pdfPage === 171));
});

test("Fault 641 does not borrow the verified PS101 general-air circuit from Fault 640", () => {
  const general = library.getTopModulFault(640);
  const infeed = library.getTopModulFault(641);
  assert.ok(general.circuitTrace.plcSignals.includes("E1501_PS101_MachineAirPressure"));
  assert.equal(infeed.circuitTrace, undefined);
  assert.equal(infeed.sourceGap.status, "catalog-only-no-producer-in-supplied-lb1");
  assert.match(infeed.sourceGap.reason, /does not reuse that circuit/i);
});

test("browser loads Labeler drive/utilities after Labeler safety and before the main controller", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const safetyPos = html.indexOf("topmodul-labeler-safety-circuit.js");
  const drivePos = html.indexOf("topmodul-labeler-drive-utilities-circuit.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  assert.ok(safetyPos >= 0 && drivePos > safetyPos && appPos > drivePos);
});
