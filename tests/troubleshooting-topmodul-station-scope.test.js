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
const library = require("../app/troubleshooting/topmodul-station-scope.js")(drilldown);

test("station alarm blocks validate as one shared six-station diagnostic template", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(library.topModulSharedStationMethodCount, 62);
  assert.equal(library.stationTemplateValidation.stationCount, 6);
  assert.equal(library.stationTemplateValidation.namedFaultsPerStation, 62);
  assert.equal(library.stationTemplateValidation.exactTextTemplates, 60);
  assert.equal(library.stationTemplateValidation.templatesWithTextOverrides, 2);
});

test("generic station symptom search collapses duplicate station instances", () => {
  const results = library.searchEntries("labeler encoder feedback fault", { machineType: "TopModul" }, 12);
  const stationRows = results.filter((entry) => entry.id === "topmodul-station-template-67");
  assert.equal(stationRows.length, 1);
  assert.equal(stationRows[0].diagnosticScope, "Station");
  assert.equal(stationRows[0].stationVariants.length, 6);
  assert.deepEqual(stationRows[0].stationVariants.map((row) => row.number), [1091, 1171, 1251, 1331, 1411, 1491]);
});

test("exact PLC fault search still resolves the physical station instance", () => {
  const station1 = library.searchEntries("1091", { machineType: "TopModul" }, 4)[0];
  const station2 = library.searchEntries("1171", { machineType: "TopModul" }, 4)[0];
  assert.equal(station1.number, 1091);
  assert.equal(station1.diagnosticScope, "Station");
  assert.equal(station1.plcFault.station, 1);
  assert.equal(station1.stationTemplateOffset, 67);
  assert.equal(station1.canonicalFaultId, "topmodul-station-template-67");
  assert.equal(station2.plcFault.station, 2);
  assert.equal(station2.stationTemplateOffset, 67);
  assert.equal(station2.canonicalFaultId, station1.canonicalFaultId);
});

test("labeler faults remain a separate diagnostic scope", () => {
  const fineClock = library.searchEntries("670", { machineType: "TopModul" }, 4)[0];
  assert.equal(fineClock.number, 670);
  assert.equal(fineClock.diagnosticScope, "Labeler");
  assert.match(fineClock.category, /TopModul PLC \/ Labeler/);
});

test("station wording exceptions are retained without cloning the troubleshooting method", () => {
  const feedTemplate = library.getStationFaultTemplate(26);
  const encoderHardwareTemplate = library.getStationFaultTemplate(65);
  assert.equal(feedTemplate.stationVariants.length, 6);
  assert.ok(feedTemplate.stationTextExceptions.some((row) => row.station === 3 && /Web Fault Feed Unit/i.test(row.title)));
  assert.ok(encoderHardwareTemplate.stationTextExceptions.some((row) => row.station === 2 && /EncoderModule/i.test(row.title)));
});

test("browser loads station-scope normalization after drill-down and before the main controller", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const drillIndex = html.indexOf("topmodul-fault-drilldown.js");
  const scopeIndex = html.indexOf("topmodul-station-scope.js");
  const appIndex = html.indexOf("troubleshooting-app.js");
  assert.ok(drillIndex >= 0 && scopeIndex > drillIndex && appIndex > scopeIndex);
});
