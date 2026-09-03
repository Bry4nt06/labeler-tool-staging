"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = require("../app/troubleshooting/diagnostic-library.js");
const live = require("../app/troubleshooting/topmodul-live-diagnostics.js")(base);
const data = require("../app/troubleshooting/topmodul-plc-fault-data.js");
const catalog = require("../app/troubleshooting/topmodul-plc-fault-catalog.js")(live, data);
const drilldown = require("../app/troubleshooting/topmodul-fault-drilldown.js")(catalog);
const scoped = require("../app/troubleshooting/topmodul-station-scope.js")(drilldown);
const library = require("../app/troubleshooting/topmodul-station-controller-trace.js")(scoped);

test("station-controller trace validates on top of the shared Station scope", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(library.topModulSharedStationMethodCount, 62);
  assert.equal(library.topModulStationDirectTriggerCount, 27);
  assert.ok(library.getSource("topmodul-co85-lb1-aplcart1-l5k"));
});

test("station fault 067 is bound from Cart 1 encoder feedback into the shared station transport", () => {
  const template = library.getStationFaultTemplate(67);
  assert.equal(template.stationControllerTrace.localFaultAddress, "Faults[4].3");
  assert.equal(template.stationControllerTrace.directTriggerTag, "BaseMachineEncoderAxis.FeedbackFault");
  assert.equal(template.stationControllerTrace.cartDataWord, "DataFromLS.Par1[42]");
  assert.match(template.summary, /BaseMachineEncoderAxis\.FeedbackFault/);
  assert.ok(template.sourceRefs.some((ref) => ref.sourceId === "topmodul-co85-lb1-aplcart1-l5k"));
});

test("exact Station 1 and Station 2 instances use the same local fault and different Labeler destinations", () => {
  const s1 = library.getStationFaultVariant(67, 1);
  const s2 = library.getStationFaultVariant(67, 2);
  assert.equal(s1.stationControllerTrace.localFaultAddress, "Faults[4].3");
  assert.equal(s2.stationControllerTrace.localFaultAddress, "Faults[4].3");
  assert.equal(s1.stationControllerTrace.labelerReceiveWord, "DataFromLS[1].Par1[42]");
  assert.equal(s2.stationControllerTrace.labelerReceiveWord, "DataFromLS[2].Par1[42]");
  assert.equal(s1.stationControllerTrace.labelerFaultAddress, "Faults_LB1[68].3");
  assert.equal(s2.stationControllerTrace.labelerFaultAddress, "Faults_LB1[73].3");
});

test("servo-axis station faults bind direct Cart 1 drive tags where the L5K is explicit", () => {
  const commutation = library.getStationFaultTemplate(32);
  const feedback = library.getStationFaultTemplate(45);
  assert.equal(commutation.stationControllerTrace.directTriggerTag, "MainDriveAxis.CommutationFault");
  assert.equal(feedback.stationControllerTrace.directTriggerTag, "MainDriveAxis.MotFeedbackFault");
  assert.equal(commutation.stationControllerTrace.traceStatus, "station-local-trigger-and-transport-bound");
});

test("generic station faults without a direct one-tag binding still retain the verified transport path", () => {
  const contactor = library.getStationFaultTemplate(5);
  assert.equal(contactor.stationControllerTrace.directTriggerTag, null);
  assert.equal(contactor.stationControllerTrace.localFaultAddress, "Faults[0].5");
  assert.equal(contactor.stationControllerTrace.cartDataWord, "DataFromLS.Par1[40]");
  assert.equal(contactor.stationControllerTrace.traceStatus, "station-local-fault-and-transport-bound");
});

test("browser loads station-controller trace after scope normalization and before main controller", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const scopeIndex = html.indexOf("topmodul-station-scope.js");
  const traceIndex = html.indexOf("topmodul-station-controller-trace.js");
  const appIndex = html.indexOf("troubleshooting-app.js");
  assert.ok(scopeIndex >= 0 && traceIndex > scopeIndex && appIndex > traceIndex);
});

test("drill-down UI renders the station-controller-to-Labeler transport path", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-fault-drilldown-ui.js"), "utf8");
  assert.match(source, /Station controller → Labeler fault path/);
  assert.match(source, /data-topmodul-station-controller-trace/);
  assert.match(source, /directTriggerTag/);
  assert.match(source, /labelerReceiveWord/);
  assert.match(source, /labelerCopy/);
});
