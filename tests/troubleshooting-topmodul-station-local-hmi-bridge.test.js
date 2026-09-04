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
const live67 = require("../app/troubleshooting/topmodul-live-00067-source-bridge.js")(gaps);
const localHmi = require("../app/troubleshooting/topmodul-station-local-hmi-bridge.js")(live67);
const library = require("../app/troubleshooting/topmodul-alarm-stack-analyzer.js")(localHmi);

test("v348 indexes exactly the 62 Cart-local named HMI positions against the shared Station template", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.match(library.version, /station-local-hmi-bridge-v1/);
  assert.equal(library.topModulStationLocalHmiOffsets.length, 62);
  assert.equal(new Set(library.topModulStationLocalHmiOffsets).size, 62);
  for (const offset of library.topModulStationLocalHmiOffsets) assert.ok(library.getStationFaultTemplate(offset), `Missing Station template ${offset}`);
});

test("exact local HMI 00025 reuses the existing End of Reel Station method", () => {
  const entry = library.searchEntries("00025", { machineType: "TopModul" }, 3)[0];
  assert.equal(entry.id, "topmodul-station-local-hmi-00025");
  assert.equal(entry.code, "00025");
  assert.equal(entry.title, "NO LABELS / END OF REEL");
  assert.equal(entry.stationTemplateOffset, 25);
  assert.equal(entry.canonicalFaultId, "topmodul-station-template-25");
  assert.equal(entry.plcFault, undefined);
  assert.equal(entry.localHmiFault.localAddress, "Faults[1].9");
  assert.match(entry.summary, /reuses the existing Station/i);
  assert.ok(entry.sourceRefs.some((ref) => ref.sourceId === "topmodul-co85-lb1-aplcart1-l5k" && /00025 NO LABELS \/ END OF REEL/.test(ref.locator)));
});

test("local HMI 00025 exposes six exact global Labeler destinations without six duplicate methods", () => {
  const entry = library.getStationLocalHmiFault("00025 NO LABELS / END OF REEL");
  const expected = [1049, 1129, 1209, 1289, 1369, 1449];
  assert.deepEqual(entry.localHmiFault.globalByStation.map((row) => row.globalNumber), expected);
  assert.equal(entry.localHmiFault.globalByStation[0].globalAddress, "Faults_LB1[65].9");
  assert.equal(entry.localHmiFault.globalByStation[5].globalAddress, "Faults_LB1[90].9");
  assert.equal(entry.stationVariants.length, 6);
});

test("local HMI 00030 stays the shared encoder-monitoring method and not encoder-feedback 00067", () => {
  const entry = library.getStationLocalHmiFault("00030");
  assert.equal(entry.title, "LABELER ENCODER FAULT");
  assert.equal(entry.stationTemplateOffset, 30);
  assert.equal(entry.localHmiFault.localAddress, "Faults[1].14");
  assert.equal(entry.stationControllerTrace.localFaultNumber, "030");
  assert.notEqual(entry.stationTemplateOffset, 67);
  assert.match(entry.circuitTrace.summary, /OPTO131/i);
});

test("local HMI 00067 preserves the source-proven live field entry instead of synthesizing a duplicate", () => {
  const entry = library.getStationLocalHmiFault("00067");
  assert.equal(entry.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(entry.stationLocalFault.localAddress, "Faults[4].3");
  assert.equal(entry.stationLocalFault.producer, "BaseMachineEncoderAxis.FeedbackFault");
  assert.equal(entry.plcFault, undefined);
  assert.equal(library.searchEntries("00067", { machineType: "TopModul" }, 3)[0].id, entry.id);
});

test("local HMI 00064-00069 keep separate Station encoder status subtypes", () => {
  const expected = new Map([
    [64, "BaseMachineEncoderAxis.ModuleFault"],
    [65, "BaseMachineEncoderAxis.ModuleHardwareFault"],
    [66, "BaseMachineEncoderAxis.ModuleSyncFault"],
    [67, "BaseMachineEncoderAxis.FeedbackFault"],
    [68, "BaseMachineEncoderAxis.FeedbackNoiseFault"],
    [69, "BaseMachineEncoderAxis.TimerEventFault"]
  ]);
  for (const [offset, producer] of expected) {
    const entry = library.getStationLocalHmiFault(String(offset).padStart(5, "0"));
    const actual = entry.stationLocalFault?.producer || entry.localHmiFault?.directProducer;
    assert.equal(actual, producer, `Local HMI ${offset} lost encoder subtype producer`);
  }
});

test("unassigned Cart local positions do not create fake diagnostics", () => {
  for (const code of ["00055", "00056", "00057", "00058", "00059", "00061", "00062", "00063", "00070", "00071", "00072", "00073", "00075"]) {
    assert.equal(library.getStationLocalHmiFault(code), null, `${code} should remain unassigned in the supplied Cart 1 HMI table`);
  }
});

test("alarm-stack analyzer accepts arbitrary five-digit Station-local HMI codes", () => {
  const result = library.analyzeTopModulFaultStack("00025, 00067, 1091");
  assert.equal(result.observed.length, 3);
  assert.equal(result.observed[0].entry.id, "topmodul-station-local-hmi-00025");
  assert.equal(result.observed[1].entry.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(result.observed[2].entry.number, 1091);
});

test("browser loads v348 bridge after v347 and before alarm-stack analysis; UI loads after controller", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const live67Pos = html.indexOf("topmodul-live-00067-source-bridge.js");
  const localPos = html.indexOf("topmodul-station-local-hmi-bridge.js");
  const analyzerPos = html.indexOf("topmodul-alarm-stack-analyzer.js");
  const appPos = html.indexOf("troubleshooting-app.js");
  const uiPos = html.indexOf("topmodul-station-local-hmi-ui.js");
  assert.ok(live67Pos >= 0 && localPos > live67Pos && analyzerPos > localPos && appPos > analyzerPos && uiPos > appPos);
  assert.match(html, /data-troubleshooting-version="v348"/);
  const ui = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-station-local-hmi-ui.js"), "utf8");
  assert.match(ui, /Station-local HMI mapping/);
  assert.match(ui, /Cross-cart confidence/);
  assert.match(ui, /data-open-global-fault/);
});
