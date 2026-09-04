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
const bridge = require("../app/troubleshooting/topmodul-live-00067-source-bridge.js")(gaps);
const analyzer = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(bridge);
const isolation = require("../app/troubleshooting/topmodul-encoder-isolation.js")(analyzer);
const library = require("../app/troubleshooting/topmodul-encoder-evidence.js")(isolation);

test("v349 encoder evidence synthesizer validates on top of chronology and isolation layers", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /encoder-evidence-v1/);
  assert.deepEqual([...library.topModulEncoderEvidenceOffsets], [64, 65, 66, 67, 68, 69]);
});

test("intermittent/noisy feedback ranks Feedback Noise ahead of Feedback Fault", () => {
  const result = library.analyzeTopModulEncoderEvidence("1092, 1091", { motion: "yes", feedback: "intermittent" });
  const group = result.stationGroups[0];
  assert.equal(group.station, 1);
  assert.equal(group.strongest.offset, 68);
  assert.equal(group.strongest.number, 1092);
  assert.match(group.strongest.reasons.join(" "), /intermittent.*Feedback Noise|Feedback Noise.*intermittent/i);
  assert.equal(group.chronologyAgreement, true);
});

test("changing AQB feedback de-emphasizes Feedback Fault when a Sync fault is observed", () => {
  const result = library.analyzeTopModulEncoderEvidence("1091, 1090", { motion: "yes", feedback: "changing" });
  const group = result.stationGroups[0];
  assert.equal(group.firstObserved.offset, 67);
  assert.equal(group.strongest.offset, 66);
  assert.equal(group.strongest.number, 1090);
  assert.equal(group.chronologyAgreement, false);
  assert.match(group.ranked.find((row) => row.offset === 67).reasons.join(" "), /counts.*changing|changing AQB/i);
});

test("no-motion evidence holds AQB hardware isolation and surfaces earlier same-station upstream fault", () => {
  const result = library.analyzeTopModulEncoderEvidence("1029, 1091", { motion: "no" });
  const group = result.stationGroups[0];
  assert.equal(group.station, 1);
  assert.equal(group.holdPhysicalFeedback, true);
  assert.equal(group.recommendedUpstream.number, 1029);
  assert.match(group.guidance, /resolve.*no-motion|no-motion.*before opening/i);
});

test("field HMI 00067 stays Station-unknown unless station context is explicitly supplied", () => {
  const unknown = library.analyzeTopModulEncoderEvidence("00067", { motion: "yes", feedback: "frozen" });
  assert.equal(unknown.stationGroups[0].station, null);
  assert.equal(unknown.stationGroups[0].strongest.offset, 67);
  assert.equal(unknown.stationGroups[0].strongest.number, null);
  assert.ok(unknown.warnings.some((warning) => /does not identify a Station number/i.test(warning)));

  const explicit = library.analyzeTopModulEncoderEvidence("00067", { motion: "yes", feedback: "frozen" }, { station: 3 });
  assert.equal(explicit.stationGroups[0].station, 3);
  assert.equal(explicit.stationGroups[0].strongest.number, 1251);
});

test("mixed Station encoder alarms remain separate evidence groups", () => {
  const result = library.analyzeTopModulEncoderEvidence("1091, 1172", { motion: "yes", feedback: "intermittent" });
  assert.equal(result.multiStation, true);
  assert.deepEqual(result.stationGroups.map((group) => group.station), [1, 2]);
  assert.ok(result.warnings.some((warning) => /more than one Station/i.test(warning)));
  assert.ok(result.stationGroups[0].ranked.every((row) => row.number == null || (row.number >= 1088 && row.number <= 1093)));
  assert.ok(result.stationGroups[1].ranked.every((row) => row.number == null || (row.number >= 1168 && row.number <= 1173)));
});

test("base Labeler Fault 670 is analyzed separately from Station encoder subtype rankings", () => {
  const result = library.analyzeTopModulEncoderEvidence("670, 1091", { motion: "yes", feedback: "frozen" }, { mainObservation: { motion: "yes", fineClock: "changing" } });
  assert.ok(result.mainLabeler);
  assert.equal(result.mainLabeler.entry.number, 670);
  assert.equal(result.mainLabeler.evaluation.code, "main-supervision-timing");
  assert.equal(result.stationGroups.length, 1);
  assert.ok(result.stationGroups[0].ranked.every((row) => row.number !== 670));
  assert.ok(result.warnings.some((warning) => /separate encoder systems/i.test(warning)));
});

test("field 00067 and base PLC Fault 067 remain distinct when both are in chronology", () => {
  const result = library.analyzeTopModulEncoderEvidence("00067, 067", { motion: "yes", feedback: "frozen" });
  assert.equal(result.stackAnalysis.observed[0].entry.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(result.stackAnalysis.observed[1].entry.number, 67);
  assert.equal(result.stackAnalysis.observed[1].entry.title, "Labeling Station Change Mode Active");
  assert.equal(result.stationGroups.length, 1);
  assert.equal(result.stationGroups[0].station, null);
});

test("browser loads v349 engine after v348 and evidence UI after the encoder-isolation UI", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const isolationPos = html.indexOf("topmodul-encoder-isolation.js");
  const evidencePos = html.indexOf("topmodul-encoder-evidence.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  const isolationUiPos = html.indexOf("topmodul-encoder-isolation-ui.js");
  const evidenceUiPos = html.indexOf("topmodul-encoder-evidence-ui.js");
  assert.ok(isolationPos >= 0 && evidencePos > isolationPos && appPos > evidencePos && isolationUiPos > appPos && evidenceUiPos > isolationUiPos);
  assert.match(html, /data-troubleshooting-version="v349"/);
  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-encoder-evidence-ui.js"), "utf8");
  assert.match(ui, /Encoder evidence ranking/);
  assert.match(ui, /servoforge:encoder-observation/);
  assert.match(ui, /diagnostic relevance.*not.*causality/i);
});
