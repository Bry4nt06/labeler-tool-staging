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
const library = require("../app/troubleshooting/topmodul-station-communication-circuit.js")(servo);

test("Station communication circuit layer validates on exact K605163 hardware", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /station-communication-circuit-v1/);
  assert.deepEqual([...library.topModulStationCommunicationCircuitOffsets], [11, 12, 13, 14, 15, 16]);
});

test("Faults 011-013 stay separated by physical ENBT slot and cable", () => {
  const f11 = library.getStationFaultTemplate(11).circuitTrace;
  const f12 = library.getStationFaultTemplate(12).circuitTrace;
  const f13 = library.getStationFaultTemplate(13).circuitTrace;
  assert.ok(f11.deviceRows.some((row) => /COM231/.test(row.device) && row.cable === ".0501-W231"));
  assert.ok(f12.deviceRows.some((row) => /COM271/.test(row.device) && row.cable === ".0501-W271"));
  assert.ok(f13.deviceRows.some((row) => /COM291/.test(row.device) && row.cable === ".0501-W291"));
  assert.match(f11.summary, /HMI_Communications.*naming exception/i);
  assert.match(f13.summary, /10\.107\.204\.191/);
  assert.match(f13.summary, /10\.107\.204\.192/);
});

test("Fault 014 is application-level base-machine communication loss, not a Slot 2 GSV fault", () => {
  const f14 = library.getStationFaultTemplate(14).circuitTrace;
  assert.ok(f14.plcSignals.includes("ETH_Com.ReadyForETHConnect_L3"));
  assert.ok(f14.plcSignals.includes("MSG_ReadCyclic"));
  assert.ok(f14.plcSignals.includes("MSG_WriteCyclic"));
  assert.ok(f14.plcSignals.includes("10.99.216.233"));
  assert.ok(f14.deviceRows.some((row) => /COM271/.test(row.device)));
  assert.match(f14.summary, /not a GSV hardware fault/i);
  assert.match(f14.scopeNote, /Fault 012/i);
});

test("Fault 015 preserves the OB16E FuseBlown mask and reset message path", () => {
  const f15 = library.getStationFaultTemplate(15).circuitTrace;
  assert.ok(f15.plcSignals.includes("Local:7:I.FuseBlown"));
  assert.ok(f15.plcSignals.includes("MSG_FuseResetOutputModule"));
  assert.ok(f15.deviceRows.some((row) => /1756-OB16E/.test(row.device)));
  assert.ok(f15.drawingLocations.some((row) => row.pdfPage === 31));
  assert.match(f15.summary, /diagnostic mask/i);
  assert.match(f15.scopeNote, /does not infer the exact failed channel/i);
});

test("Fault 016 stays a group-level synchronization state and points to both motion members", () => {
  const f16 = library.getStationFaultTemplate(16).circuitTrace;
  assert.ok(f16.plcSignals.includes("MotionGroup.GroupSynced"));
  assert.ok(f16.plcSignals.includes("EEP_APL_Slot11:Ch0"));
  assert.ok(f16.plcSignals.includes("EEP_APL_Slot12"));
  assert.ok(f16.deviceRows.some((row) => /1756-M02AE/.test(row.device)));
  assert.ok(f16.deviceRows.some((row) => /1756-M08SE/.test(row.device)));
  assert.match(f16.summary, /does not prove that either device is bad/i);
  assert.match(f16.summary, /064-069/);
  assert.match(f16.summary, /042-054/);
});

test("browser and offline shell load all post-v329 Station circuit layers in order", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const powerPos = html.indexOf("topmodul-station-power-circuit.js");
  const encoderPos = html.indexOf("topmodul-station-encoder-circuit.js");
  const servoPos = html.indexOf("topmodul-station-servo-circuit.js");
  const commPos = html.indexOf("topmodul-station-communication-circuit.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  assert.ok(powerPos >= 0 && encoderPos > powerPos && servoPos > encoderPos && commPos > servoPos && appPos > commPos);

  const worker = fs.readFileSync(path.join(__dirname, "../service-worker.js"), "utf8");
  for (const file of [
    "topmodul-station-power-circuit.js",
    "topmodul-station-encoder-circuit.js",
    "topmodul-station-servo-circuit.js",
    "topmodul-station-communication-circuit.js"
  ]) assert.match(worker, new RegExp(`\\.\\/app\\/troubleshooting\\/${file.replaceAll(".", "\\.")}`));
});
