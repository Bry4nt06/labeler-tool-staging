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
const library = require("../app/troubleshooting/topmodul-rpc-method-bridge.js")(driveUtilities);

const bridged = [512, 513, 514, 515, 516, 517, 518, 521, 522, 523, 524, 525, 528, 529];
const decoderOnly = [519, 526, 527, 532];

test("TopModul RPC bridge validates only source-supported method mappings", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /topmodul-rpc-method-bridge-v1/);
  assert.deepEqual([...library.topModulRpcMethodFaults], bridged);
  assert.deepEqual([...library.topModulRpcMethodGapFaults], decoderOnly);
});

test("PowerPC decoded TopModul alarms inherit the matching archived Danfoss method", () => {
  const expected = new Map([
    [512, [16, "SERVOPOWER_TIMEOUT"]],
    [515, [33, "SERVOFEEDBACK"]],
    [524, [120, "ENCODERCONTINUITY"]],
    [528, [130, "IOBOXCOMM"]],
    [529, [101, "SERVOVERSION"]]
  ]);
  for (const [fault, [powerPcCode, rpcCode]] of expected) {
    const entry = library.getTopModulFault(fault);
    assert.equal(entry.rpcMethod.powerPcMessageCode, powerPcCode);
    assert.equal(entry.rpcMethod.code, rpcCode);
    assert.ok(entry.rpcMethod.checks.length > 0);
    assert.ok(entry.rpcMethod.safety.length > 0);
    assert.match(entry.rpcMethod.sourceDiscipline, new RegExp(`TopModul Fault ${fault}`));
  }
});

test("Scan, Internal Fault, Test Message and Lag Error keep decoder evidence without borrowed procedures", () => {
  for (const fault of decoderOnly) {
    const entry = library.getTopModulFault(fault);
    assert.equal(entry.rpcMethod, undefined);
    assert.equal(entry.rpcMethodGap.status, "decoder-bound-rpc-method-not-promoted");
    assert.equal(entry.rpcMethodGap.topModulFault, fault);
    assert.ok(Number.isInteger(entry.rpcMethodGap.powerPcMessageCode));
    assert.match(entry.rpcMethodGap.reason, /does not|not|no |without/i);
  }
  assert.match(library.getTopModulFault(519).rpcMethodGap.reason, /does not identify.*Scan|does not.*equate.*SERVOCOUNT/i);
  assert.match(library.getTopModulFault(532).rpcMethodGap.reason, /does not contain a LAG ERROR procedure/i);
});

test("Fault 520 remains governed by its Labeler PLC source truth rather than the RPC bridge", () => {
  const entry = library.getTopModulFault(520);
  assert.equal(entry.rpcMethod, undefined);
  assert.equal(entry.rpcMethodGap, undefined);
  assert.equal(entry.labelerRungEvidence.rootLikelihood, "catalog-only");
  assert.match(entry.labelerRungEvidence.logicSummary, /not set anywhere in the readable LB1 L5K/i);
});

test("Fault 661 still drills down into decoded specific Servo Bottle Table faults first", () => {
  const drillDown = library.getTopModulFaultDrillDown(661, 20);
  assert.ok(drillDown);
  assert.equal(drillDown.entry.number, 661);
  assert.equal(drillDown.entry.labelerRungEvidence.rootLikelihood, "secondary");
  const decoded = drillDown.firstFaultCandidates.filter((entry) => entry.number >= 512 && entry.number <= 532);
  assert.ok(decoded.length >= 10, "Fault 661 should expose decoded Servo Bottle Table candidates.");
  assert.ok(decoded.some((entry) => entry.number === 512));
  assert.ok(decoded.some((entry) => entry.number === 524));
});

test("browser loads RPC model before controller and RPC UI after the diagnostic UIs", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const drivePos = html.indexOf("topmodul-labeler-drive-utilities-circuit.js");
  const modelPos = html.indexOf("topmodul-rpc-method-bridge.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  const drillUiPos = html.indexOf("topmodul-fault-drilldown-ui.js");
  const rpcUiPos = html.indexOf("topmodul-rpc-method-ui.js");
  assert.ok(drivePos >= 0 && modelPos > drivePos && appPos > modelPos && drillUiPos > appPos && rpcUiPos > drillUiPos);

  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-rpc-method-ui.js"), "utf8");
  assert.match(ui, /RPC \/ Danfoss fault method/);
  assert.match(ui, /decoder bound, procedure not promoted/);
});
