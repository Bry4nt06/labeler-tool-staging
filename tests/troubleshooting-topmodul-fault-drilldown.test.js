"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = require("../app/troubleshooting/diagnostic-library.js");
const live = require("../app/troubleshooting/topmodul-live-diagnostics.js")(base);
const data = require("../app/troubleshooting/topmodul-plc-fault-data.js");
const catalog = require("../app/troubleshooting/topmodul-plc-fault-catalog.js")(live, data);
const library = require("../app/troubleshooting/topmodul-fault-drilldown.js")(catalog);

test("TopModul drill-down extension validates on top of the 513-fault catalog", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(library.topModulNamedFaultCount, 513);
  assert.match(library.version, /topmodul-fault-drilldown-v1/);
});

test("station encoder feedback fault drills into same-station encoder supervision", () => {
  const rows = library.getTopModulFaultRelations(1091, 10);
  const sync = rows.find((entry) => entry.number === 1090);
  const noise = rows.find((entry) => entry.number === 1092);
  assert.ok(sync, "Fault 1090 encoder sync should be related to 1091 feedback fault");
  assert.ok(noise, "Fault 1092 feedback-noise should be related to 1091 feedback fault");
  assert.equal(sync.plcFault.station, 1);
  assert.match(sync.relationReason, /encoder/i);
});

test("station not-ready summary exposes underlying station-block fault candidates", () => {
  const drillDown = library.getTopModulFaultDrillDown(663, 12);
  assert.equal(drillDown.station, 1);
  assert.equal(drillDown.family, "Labeling station / readiness");
  assert.ok(drillDown.related.some((entry) => entry.number === 1029), "Station 1 main contactor fault should be a drill-down candidate");
  assert.ok(drillDown.related.some((entry) => entry.number >= 1024 && entry.number < 1104));
  assert.match(drillDown.prompt, /occurred first/i);
});

test("fine-clock monitoring relates to main-drive and machine-stop monitoring faults", () => {
  const numbers = new Set(library.getTopModulFaultRelations(670, 10).map((entry) => entry.number));
  assert.ok(numbers.has(480), "Main Drive Fault should relate to fine-clock monitoring");
  assert.ok(numbers.has(482), "Main Drive Contactor Fault should relate to fine-clock monitoring");
  assert.ok(numbers.has(669), "Machine Stop Monitoring should relate to fine-clock monitoring");
});

test("drill-down does not reinterpret the field-observed 00067 as PLC fault 067", () => {
  assert.equal(library.getTopModulFaultDrillDown("00067")?.entry.number, 67);
  const field = library.searchEntries("00067", { machineType: "TopModul" }, 3)[0];
  assert.equal(field.id, "topmodul-00067-labeler-encoder-feedback");
  assert.equal(field.plcFault, undefined);
});

test("browser loads drill-down engine before controller and drill-down UI after controller", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const catalogIndex = html.indexOf("topmodul-plc-fault-catalog.js");
  const drillIndex = html.indexOf("topmodul-fault-drilldown.js");
  const appIndex = html.indexOf("troubleshooting-app.js");
  const uiIndex = html.indexOf("topmodul-fault-drilldown-ui.js");
  assert.ok(catalogIndex >= 0 && drillIndex > catalogIndex && appIndex > drillIndex && uiIndex > appIndex);
});

test("drill-down UI exposes verified PLC binding and clickable related faults", () => {
  const source = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/topmodul-fault-drilldown-ui.js"), "utf8");
  assert.match(source, /TopModul PLC binding/);
  assert.match(source, /plc\.address/);
  assert.match(source, /data-topmodul-open-fault/);
  assert.match(source, /fault-bit-and-text-bound/);
  assert.match(source, /Rung-level cause and exact schematic page\/component trace are not yet marked verified/);
});
