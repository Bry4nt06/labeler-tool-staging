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
const gaps = require("../app/troubleshooting/topmodul-labeler-remaining-gaps-trace.js")(operatingState);
const liveBridge = require("../app/troubleshooting/topmodul-live-00067-source-bridge.js")(gaps);
const analyzer = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(liveBridge);
const isolation = require("../app/troubleshooting/topmodul-encoder-isolation.js")(analyzer);
const library = require("../app/troubleshooting/topmodul-encoder-stack-bridge.js")(isolation);

test("v349 encoder-stack bridge validates without changing v348 isolation authority", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /encoder-stack-bridge-v1/);
  assert.equal(library.getTopModulEncoderIsolationPlan("00067").producer, "BaseMachineEncoderAxis.FeedbackFault");
});

test("field HMI 00067 alone retains unknown Station and unknown machine-state observations", () => {
  const result = library.analyzeTopModulEncoderStack("00067");
  assert.equal(result.hasEncoderEvidence, true);
  assert.equal(result.target.entry.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(result.targetSearch, "00067");
  assert.equal(result.stationContext.kind, "unknown");
  assert.equal(result.fieldStationContextAvailable, false);
  assert.deepEqual(result.observationAssumptions, { inferred: false, motion: "unknown", feedback: "unknown", fineClock: "unknown" });
  assert.match(result.guidance, /does not identify which Station/i);
  assert.match(result.guidance, /not inferred from alarm history/i);
});

test("field 00067 plus global 1091 exposes Station 1 context without claiming co-occurrence proves origin", () => {
  const result = library.analyzeTopModulEncoderStack("00067, 1091");
  assert.equal(result.stationContext.kind, "single");
  assert.equal(result.stationContext.station, 1);
  assert.equal(result.fieldStationContextAvailable, true);
  assert.ok(result.observed.some((item) => item.entry.id === "topmodul-00067-labeler-encoder-feedback"));
  assert.ok(result.observed.some((item) => item.entry.number === 1091));
  assert.match(result.guidance, /co-occurrence alone does not prove/i);
});

test("same-Station Feedback Noise and Feedback faults preserve observed chronology and analyzer ranking", () => {
  const result = library.analyzeTopModulEncoderStack("1092, 1091");
  assert.equal(result.stationContext.station, 1);
  assert.deepEqual(result.observed.map((item) => item.entry.number), [1092, 1091]);
  assert.equal(result.stationGroups.length, 1);
  assert.deepEqual(result.stationGroups[0].observed.map((item) => item.localOffset), [68, 67]);
  const expectedTarget = result.stack.recommended.find((item) => library.getTopModulEncoderIsolationPlan(item.entry));
  assert.equal(result.target.entry.id, expectedTarget.entry.id);
});

test("encoder evidence from Station 1 and Station 2 is not collapsed into one Cart diagnosis", () => {
  const result = library.analyzeTopModulEncoderStack("1091, 1171");
  assert.equal(result.stationContext.kind, "multiple");
  assert.deepEqual([...result.stationContext.stations], [1, 2]);
  assert.equal(result.stationGroups.length, 2);
  assert.match(result.guidance, /Do not collapse/i);
});

test("main Labeler Fault 670 and Station Feedback 1091 remain separate encoder scopes", () => {
  const result = library.analyzeTopModulEncoderStack("670, 1091");
  assert.equal(result.crossScope, true);
  assert.deepEqual(new Set(result.scopes), new Set(["Main Labeler encoder / fine clock", "Station / Cart encoder"]));
  assert.match(result.guidance, /Keep those circuits and producers separate/i);
});

test("base PLC Fault 067 Change Mode is excluded while Station global 1091 remains encoder evidence", () => {
  const result = library.analyzeTopModulEncoderStack("067, 1091");
  assert.equal(result.hasEncoderEvidence, true);
  assert.deepEqual(result.observed.map((item) => item.entry.number), [1091]);
  assert.equal(library.getTopModulFault(67).title, "Labeling Station Change Mode Active");
});

test("non-encoder stacks do not produce an encoder bridge target", () => {
  const result = library.analyzeTopModulEncoderStack("673, 674");
  assert.equal(result.hasEncoderEvidence, false);
  assert.equal(result.target, null);
  assert.equal(result.observed.length, 0);
});

test("v349 browser loader and UI bridge preserve alarm-stack and v348 ordering", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const analyzerPos = html.indexOf("topmodul-alarm-stack-analyzer.js");
  const isolationPos = html.indexOf("topmodul-encoder-isolation.js");
  const bridgePos = html.indexOf("topmodul-encoder-stack-bridge.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  const stackUiPos = html.indexOf("topmodul-alarm-stack-ui.js");
  const bridgeUiPos = html.indexOf("topmodul-encoder-stack-bridge-ui.js");
  const isolationUiPos = html.indexOf("topmodul-encoder-isolation-ui.js");
  assert.ok(analyzerPos >= 0 && isolationPos > analyzerPos && bridgePos > isolationPos && appPos > bridgePos);
  assert.ok(stackUiPos > appPos && bridgeUiPos > stackUiPos && isolationUiPos > bridgeUiPos);
  assert.match(html, /data-troubleshooting-version="v349"/);
  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-encoder-stack-bridge-ui.js"), "utf8");
  assert.match(ui, /Alarm stack → encoder isolation/);
  assert.match(ui, /No machine-state inference/);
  assert.match(ui, /Open encoder isolation/);
});
