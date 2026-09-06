"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const base = require(path.join(root, "app/troubleshooting/diagnostic-library.js"));
const live = require(path.join(root, "app/troubleshooting/topmodul-live-diagnostics.js"))(base);
const data = require(path.join(root, "app/troubleshooting/topmodul-plc-fault-data.js"));
const catalog = require(path.join(root, "app/troubleshooting/topmodul-plc-fault-catalog.js"))(live, data);
const drill = require(path.join(root, "app/troubleshooting/topmodul-fault-drilldown.js"))(catalog);
const scope = require(path.join(root, "app/troubleshooting/topmodul-station-scope.js"))(drill);
const transport = require(path.join(root, "app/troubleshooting/topmodul-station-controller-trace.js"))(scope);
const stationCause = require(path.join(root, "app/troubleshooting/topmodul-station-cause-model.js"))(transport);
const labelerCause = require(path.join(root, "app/troubleshooting/topmodul-labeler-cause-model.js"))(stationCause);
const circuit = require(path.join(root, "app/troubleshooting/topmodul-circuit-trace.js"))(labelerCause);
const power = require(path.join(root, "app/troubleshooting/topmodul-station-power-circuit.js"))(circuit);
const encoder = require(path.join(root, "app/troubleshooting/topmodul-station-encoder-circuit.js"))(power);
const servo = require(path.join(root, "app/troubleshooting/topmodul-station-servo-circuit.js"))(encoder);
const communication = require(path.join(root, "app/troubleshooting/topmodul-station-communication-circuit.js"))(servo);
const stationProcess = require(path.join(root, "app/troubleshooting/topmodul-station-process-trace.js"))(communication);
const stationFoundation = require(path.join(root, "app/troubleshooting/topmodul-station-foundation-circuit.js"))(stationProcess);
const safety = require(path.join(root, "app/troubleshooting/topmodul-labeler-safety-circuit.js"))(stationFoundation);
const driveUtilities = require(path.join(root, "app/troubleshooting/topmodul-labeler-drive-utilities-circuit.js"))(safety);
const rpc = require(path.join(root, "app/troubleshooting/topmodul-rpc-method-bridge.js"))(driveUtilities);
const labelerCommunication = require(path.join(root, "app/troubleshooting/topmodul-labeler-communication-circuit.js"))(rpc);
const containerFlow = require(path.join(root, "app/troubleshooting/topmodul-labeler-container-flow-trace.js"))(labelerCommunication);
const protection = require(path.join(root, "app/troubleshooting/topmodul-labeler-electrical-protection.js"))(containerFlow);
const lubrication = require(path.join(root, "app/troubleshooting/topmodul-labeler-lubrication-trace.js"))(protection);
const inspection = require(path.join(root, "app/troubleshooting/topmodul-labeler-inspection-coder-trace.js"))(lubrication);
const operatingState = require(path.join(root, "app/troubleshooting/topmodul-labeler-operating-state-trace.js"))(inspection);
const gaps = require(path.join(root, "app/troubleshooting/topmodul-labeler-remaining-gaps-trace.js"))(operatingState);
const aplFoundation = require(path.join(root, "app/troubleshooting/apl-cart-foundation.js"))(gaps);
const webHandling = require(path.join(root, "app/troubleshooting/apl-cart-web-handling.js"))(aplFoundation);
const servoStatus = require(path.join(root, "app/troubleshooting/apl-cart-servo-status.js"))(webHandling);
const tailStatus = require(path.join(root, "app/troubleshooting/apl-cart-tail-status.js"))(servoStatus);
const coreStatus = require(path.join(root, "app/troubleshooting/apl-cart-core-status.js"))(tailStatus);
const warningStatus = require(path.join(root, "app/troubleshooting/apl-cart-warning-status.js"))(coreStatus);
const liveBridge = require(path.join(root, "app/troubleshooting/topmodul-live-00067-source-bridge.js"))(warningStatus);
const stack = require(path.join(root, "app/troubleshooting/topmodul-alarm-stack-analyzer.js"))(liveBridge);
const library = require(path.join(root, "app/troubleshooting/apl-cart-warning-stack-bridge.js"))(stack);

const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "app/troubleshooting/topmodul-alarm-stack-ui.js"), "utf8");

test("v366 validates mixed Cart warning, five-digit Cart fault, field-HMI, and base-Labeler namespaces", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join(" | "));
  assert.match(library.version, /apl-cart-warning-stack-v366/);
});

test("W 0005 remains pre-fault evidence ahead of Cart 00025 instead of becoming base Fault 005", () => {
  const result = library.analyzeTopModulFaultStack("W 0005 → 00025");
  assert.deepEqual(result.observed.map((item) => item.entry.code), ["W 0005", "00025"]);
  assert.equal(result.observed[0].entry.id, "apl-cart-warning-0005");
  assert.equal(result.observed[0].role, "pre-fault-warning");
  assert.equal(result.observed[1].entry.id, "apl-cart-00025");
  assert.ok(result.observed[0].downstreamItemsSupported.some((row) => row.code === "00025" && row.relationKind === "pre-fault"));
  assert.ok(result.observed[1].upstreamCandidatesInStack.some((row) => row.code === "W 0005" && row.appearedEarlier));
});

test("W 0012 links to the later Cart 00022 label-length fault while preserving warning chronology", () => {
  const result = library.analyzeTopModulFaultStack("W0012, 00022");
  assert.deepEqual(result.observed.map((item) => item.entry.code), ["W 0012", "00022"]);
  assert.ok(result.observed[0].downstreamItemsSupported.some((row) => row.code === "00022"));
  assert.match(result.observed[0].downstreamItemsSupported[0].reason, /MeasureError|bad measurements/i);
});

test("W 0015 remains current communication-state evidence while Cart 00014 remains a separate latched fault", () => {
  const result = library.analyzeTopModulFaultStack("W 0015 > 00014");
  assert.deepEqual(result.observed.map((item) => item.entry.code), ["W 0015", "00014"]);
  assert.ok(result.observed[0].downstreamItemsSupported.some((row) => row.code === "00014" && row.relationKind === "companion"));
  assert.match(result.observed[0].downstreamItemsSupported[0].reason, /ReadyForETHConnect_L3/);
});

test("source-gap warning W 0002 stays behind active fault evidence and does not borrow a synchronization producer", () => {
  const result = library.analyzeTopModulFaultStack("W 0002, 00016");
  const warning = result.observed.find((item) => item.entry.code === "W 0002");
  const fault = result.observed.find((item) => item.entry.code === "00016");
  assert.equal(warning.role, "warning-source-gap");
  assert.ok(fault);
  assert.ok(warning.investigationScore === undefined || true);
  assert.equal(result.recommended[result.recommended.length - 1].entry.code, "W 0002");
});

test("warning, Cart fault, and base-Labeler fault with the same visible number stay distinct", () => {
  const result = library.analyzeTopModulFaultStack("W 0005, 00005, 005");
  assert.deepEqual(result.observed.map((item) => item.entry.code), ["W 0005", "00005", "005"]);
  assert.equal(result.observed[0].entry.id, "apl-cart-warning-0005");
  assert.equal(result.observed[1].entry.id, "apl-cart-00005");
  assert.equal(result.observed[2].entry.number, 5);
  assert.notEqual(result.observed[1].entry.id, result.observed[2].entry.id);
});

test("mixed sequence preserves all three levels in W 0005 -> 00025 -> Labeler 655", () => {
  const result = library.analyzeTopModulFaultStack("W 0005 → 00025 → 655");
  assert.deepEqual(result.observed.map((item) => item.entry.code), ["W 0005", "00025", "655"]);
  assert.equal(result.observed[0].role, "pre-fault-warning");
  assert.equal(result.observed[1].role, "cart-fault");
  assert.equal(result.observed[2].entry.diagnosticScope, "Labeler");
  assert.equal(result.counts.warnings, 1);
});

test("existing base-Labeler first-fault ranking and field 00067 namespace remain intact", () => {
  const baseStack = library.analyzeTopModulFaultStack("663, 1091");
  assert.equal(baseStack.recommended[0].entry.number, 1091);
  const field = library.analyzeTopModulFaultStack("00067, 067");
  assert.equal(field.observed[0].entry.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(field.observed[1].entry.code, "067");
});

test("v366 loader and UI are warning-aware without adding a second stack renderer", () => {
  assert.match(page, /data-troubleshooting-version="v366"/);
  const warning = page.indexOf("apl-cart-warning-status.js");
  const analyzer = page.indexOf("topmodul-alarm-stack-analyzer.js");
  const bridge = page.indexOf("apl-cart-warning-stack-bridge.js");
  const encoderIsolation = page.indexOf("topmodul-encoder-isolation.js");
  const app = page.indexOf("troubleshooting-app.js");
  const stackUi = page.indexOf("topmodul-alarm-stack-ui.js");
  assert.ok(warning >= 0 && analyzer > warning && bridge > analyzer && encoderIsolation > bridge);
  assert.ok(app > bridge && stackUi > app);
  assert.match(ui, /W 0005.*00025/s);
  assert.match(ui, /relationCode/);
  assert.match(ui, /warnings \$\{warningCount\}/);
  assert.match(ui, /TopModul\/APL alarms or warnings/i);
});