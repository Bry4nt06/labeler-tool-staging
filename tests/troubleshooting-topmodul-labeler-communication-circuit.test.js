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
const driveUtilities = require("../app/troubleshooting/topmodul-labeler-drive-utilities-circuit.js")(safety);
const rpc = require("../app/troubleshooting/topmodul-rpc-method-bridge.js")(driveUtilities);
const library = require("../app/troubleshooting/topmodul-labeler-communication-circuit.js")(rpc);

test("Labeler communication layer validates exact K407039 and LB1 PLC paths", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /labeler-communication-circuit-v1/);
  assert.deepEqual([...library.topModulLabelerCommunicationFaults], [160, 161, 162, 164, 193, 224, 230, 241, 242, 243, 244, 245, 246]);
});

test("Fault 160 HMI heartbeat remains separate from Slot 1 ENBT Fault 161", () => {
  const f160 = library.getTopModulFault(160);
  const f161 = library.getTopModulFault(161);
  assert.equal(f160.labelerRungEvidence.logicType, "watchdog-heartbeat");
  assert.ok(f160.labelerRungEvidence.producerSignals.includes("E0901_Watchdog.O_Error"));
  assert.ok(f160.circuitTrace.deviceRows.some((row) => row.device === "A101 / HMI"));
  assert.ok(f160.circuitTrace.deviceRows.some((row) => row.device === "COM232"));
  assert.equal(f161.labelerRungEvidence.logicType, "module-faultcode-gsv");
  assert.ok(f161.circuitTrace.plcSignals.some((signal) => signal.includes("HMI_Communications")));
  assert.match(f160.circuitTrace.summary, /not the same as Fault 161/i);
});

test("local Level 2 and Level 3 ENBT faults bind exact slots, IPs and cables", () => {
  const f162 = library.getTopModulFault(162).circuitTrace;
  const f164 = library.getTopModulFault(164).circuitTrace;
  assert.ok(f162.deviceRows.some((row) => row.device === "COM242" && row.cable === ".0501-W241" && /10\.99\.218\.31/.test(row.terminals)));
  assert.ok(f164.deviceRows.some((row) => row.device === "COM261" && row.cable === ".0501-W261" && /10\.99\.216\.233/.test(row.terminals)));
  assert.ok(f162.plcSignals.some((signal) => signal.includes("EthernetModuleSlot2FaultData")));
  assert.ok(f164.plcSignals.some((signal) => signal.includes("EthernetModuleSlot4FaultData")));
});

test("Fault 193 remote rack is suppressed when the upstream Slot 4 fault is active", () => {
  const f193 = library.getTopModulFault(193);
  assert.ok(f193.labelerRungEvidence.producerSignals.includes("XIO(Faults_LB1[10].4)"));
  assert.ok(f193.circuitTrace.deviceRows.some((row) => /COM262/.test(row.device) && row.cable === ".0501-W262"));
  assert.match(f193.circuitTrace.summary, /only reports 193 while.*164.*not active/i);
});

test("Fault 224 stays a network summary and Fault 230 stays a direct Cisco switch input", () => {
  const f224 = library.getTopModulFault(224);
  const f230 = library.getTopModulFault(230);
  assert.equal(f224.labelerRungEvidence.rootLikelihood, "secondary");
  assert.ok(f224.circuitTrace.plcSignals.includes("Interlock_Faultcode"));
  assert.ok(f224.circuitTrace.plcSignals.includes("Ethernet_IO_Faultcode"));
  assert.match(f224.circuitTrace.summary, /summary, not a single network card/i);
  assert.ok(f230.circuitTrace.plcSignals.includes("I0007.13"));
  assert.ok(f230.circuitTrace.deviceRows.some((row) => row.device === "AIC282"));
  assert.match(f230.circuitTrace.summary, /removes Machine On and Jog enables/i);
});

test("Faults 241-246 bind individual 1756-OB16E slots without pretending the I.Fault word names a channel", () => {
  const expected = new Map([
    [241, [1, "I/O081"]],
    [242, [2, "I/O082"]],
    [243, [3, "I/O101"]],
    [244, [4, "I/O102"]],
    [245, [5, "I/O121"]],
    [246, [6, "I/O122"]]
  ]);
  for (const [fault, [slot, device]] of expected) {
    const trace = library.getTopModulFault(fault).circuitTrace;
    assert.ok(trace.plcSignals.includes(`CP85LB1_Node1:${slot}:I.Fault`));
    assert.ok(trace.plcSignals.includes(`MSG_FuseResetOutputModule${slot}`));
    assert.ok(trace.deviceRows.some((row) => row.device.includes(device) && row.device.includes("1756-OB16E")));
    assert.match(trace.summary, /module-level I\.Fault word/i);
    assert.match(trace.scopeNote, /193\/164/);
  }
});

test("browser loads Labeler communication after RPC bridge and before troubleshooting controller", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const rpcPos = html.indexOf("topmodul-rpc-method-bridge.js");
  const commPos = html.indexOf("topmodul-labeler-communication-circuit.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  assert.ok(rpcPos >= 0 && commPos > rpcPos && appPos > commPos);
});
