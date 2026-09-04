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
const process = require("../app/troubleshooting/topmodul-station-process-trace.js")(stationComm);
const foundation = require("../app/troubleshooting/topmodul-station-foundation-circuit.js")(process);
const safety = require("../app/troubleshooting/topmodul-labeler-safety-circuit.js")(foundation);
const driveUtilities = require("../app/troubleshooting/topmodul-labeler-drive-utilities-circuit.js")(safety);
const rpc = require("../app/troubleshooting/topmodul-rpc-method-bridge.js")(driveUtilities);
const labelerComm = require("../app/troubleshooting/topmodul-labeler-communication-circuit.js")(rpc);
const library = require("../app/troubleshooting/topmodul-labeler-container-flow-trace.js")(labelerComm);

test("Labeler container-flow layer validates only PLC-supported paths", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /labeler-container-flow-v1/);
  assert.deepEqual([...library.topModulLabelerContainerFlowFaults], [678, 679, 683, 684, 685, 686, 694, 695, 710]);
  assert.deepEqual([...library.topModulLabelerContainerFlowSourceGaps], [693, 696]);
});

test("Fault 678 binds three separate broken-container sensors to tracked bottle positions", () => {
  const trace = library.getTopModulFault(678).processTrace;
  assert.ok(trace.producerSignals.includes("E1701_P181_BrokenContainer1 = Local:7:I.Data.3"));
  assert.ok(trace.producerSignals.includes("E1701_P182_BrokenContainer2 = Local:7:I.Data.4"));
  assert.ok(trace.producerSignals.includes("E1701_P183_BrokenContainer3 = Local:7:I.Data.5"));
  assert.ok(trace.hardwareRows.some((row) => row.device === "P181" && /I0007\.03/.test(row.terminals)));
  assert.ok(trace.hardwareRows.some((row) => row.device === "P182" && /I0007\.04/.test(row.terminals)));
  assert.ok(trace.hardwareRows.some((row) => row.device === "P183" && /I0007\.05/.test(row.terminals)));
  assert.match(trace.summary, /tracked three-sensor/i);
});

test("Fault 679 follows actual container-stop speed mismatch rather than alarm-name clutch assumption", () => {
  const trace = library.getTopModulFault(679).processTrace;
  assert.ok(trace.producerSignals.includes("SpeedRange.O_InRange1"));
  assert.ok(trace.producerSignals.includes("ContStop.DelSpeedFault.PRE = 15000"));
  assert.ok(trace.producerSignals.includes("ContStop.I_ClutchEnable = Logic_0"));
  assert.ok(trace.producerSignals.includes("ContStop.I_SensorClutch = Logic_0"));
  assert.match(trace.summary, /15-second speed\/state mismatch/i);
  assert.match(trace.summary, /clutch-enable and clutch-sensor inputs are disabled/i);
});

test("Fault 683 separates PE101 primary infeed-gap fault from PE103 prewarning", () => {
  const trace = library.getTopModulFault(683).processTrace;
  assert.ok(trace.hardwareRows.some((row) => row.device === "PE101" && row.cable === ".3901-W101" && /I0010\.24/.test(row.terminals)));
  assert.ok(trace.hardwareRows.some((row) => row.device === "PE103" && row.cable === ".3901-W103" && /I0010\.25/.test(row.terminals)));
  assert.ok(trace.hardwareRows.some((row) => row.device === "PB102" && /I0010\.12/.test(row.terminals)));
  assert.match(trace.summary, /PE103 is an upstream early-warning sensor/i);
});

test("Faults 684 and 685 bind the exact local infeed/discharge sensors", () => {
  const f684 = library.getTopModulFault(684).processTrace;
  const f685 = library.getTopModulFault(685).processTrace;
  assert.ok(f684.hardwareRows.some((row) => row.device === "P131" && row.cable === ".1501-W131" && /I0010\.19/.test(row.terminals)));
  assert.ok(f685.hardwareRows.some((row) => row.device === "PE202" && row.cable === ".1501-W202" && /I0010\.20/.test(row.terminals)));
  assert.ok(f685.producerSignals.includes("Data_To_HMI_Labeler85_1[389]"));
  assert.match(f685.summary, /timed discharge-backup/i);
});

test("Faults 686 and 694 preserve the Full Bottle Conveyor PLC boundary", () => {
  const f686 = library.getTopModulFault(686).processTrace;
  const f694 = library.getTopModulFault(694).processTrace;
  assert.ok(f686.producerSignals.includes("Consumed_FullBottle85_B.Interlock_Data_Bit[33]"));
  assert.equal(f686.hardwareRows.length, 0);
  assert.match(f686.summary, /does not originate from a locally named reject-conveyor sensor/i);
  assert.ok(f694.producerSignals.includes("Consumed_FullBottle85_B.Interlock_Data_Bit[27]"));
  assert.ok(f694.producerSignals.includes("Interlocks_FullBottle85_B = 1756-ENBT/A / 10.99.218.28"));
  assert.equal(f694.hardwareRows.length, 0);
  assert.match(f694.scopeNote, /Full Bottle Conveyor controller/i);
});

test("Heuft paths keep direct reject fault, disabled air-pressure alarm and custom jam tracker distinct", () => {
  const f695 = library.getTopModulFault(695);
  const f696 = library.getTopModulFault(696);
  const f710 = library.getTopModulFault(710);
  assert.ok(f695.processTrace.hardwareRows.some((row) => /Heuft/.test(row.device) && /I0011\.21/.test(row.terminals)));
  assert.match(f695.processTrace.summary, /direct Heuft reject-system fault input/i);
  assert.ok(f696.sourceGap);
  assert.equal(f696.processTrace, undefined);
  assert.match(f696.sourceGap.reason, /AFI\(\)/);
  assert.ok(f710.processTrace.producerSignals.includes("Heuft_Jam_Test_Bit = 1 in supplied export"));
  assert.ok(f710.processTrace.producerSignals.includes("I0010.26"));
  assert.ok(f710.processTrace.producerSignals.includes("I0010.27"));
  assert.match(f710.processTrace.summary, /does not invent physical sensor names/i);
});

test("Fault 693 remains searchable but has no invented producer", () => {
  const entry = library.getTopModulFault(693);
  assert.ok(entry);
  assert.ok(entry.sourceGap);
  assert.equal(entry.processTrace, undefined);
  assert.match(entry.sourceGap.reason, /no producer occurrence anywhere/i);
});

test("browser loads v340 model after Labeler communication and before controller; existing process/source-gap UIs can render it", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const commPos = html.indexOf("topmodul-labeler-communication-circuit.js");
  const flowPos = html.indexOf("topmodul-labeler-container-flow-trace.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  const processUiPos = html.indexOf("topmodul-process-trace-ui.js");
  const sourceGapUiPos = html.indexOf("topmodul-source-gap-ui.js");
  assert.ok(commPos >= 0 && flowPos > commPos && appPos > flowPos && processUiPos > appPos && sourceGapUiPos > appPos);
});
