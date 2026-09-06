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
const stationPower = require(path.join(root, "app/troubleshooting/topmodul-station-power-circuit.js"))(circuit);
const stationEncoder = require(path.join(root, "app/troubleshooting/topmodul-station-encoder-circuit.js"))(stationPower);
const stationServo = require(path.join(root, "app/troubleshooting/topmodul-station-servo-circuit.js"))(stationEncoder);
const stationComms = require(path.join(root, "app/troubleshooting/topmodul-station-communication-circuit.js"))(stationServo);
const stationProcess = require(path.join(root, "app/troubleshooting/topmodul-station-process-trace.js"))(stationComms);
const stationFoundation = require(path.join(root, "app/troubleshooting/topmodul-station-foundation-circuit.js"))(stationProcess);
const aplFoundation = require(path.join(root, "app/troubleshooting/apl-cart-foundation.js"))(stationFoundation);
const web = require(path.join(root, "app/troubleshooting/apl-cart-web-handling.js"))(aplFoundation);
const servo = require(path.join(root, "app/troubleshooting/apl-cart-servo-status.js"))(web);
const tail = require(path.join(root, "app/troubleshooting/apl-cart-tail-status.js"))(servo);
const core = require(path.join(root, "app/troubleshooting/apl-cart-core-status.js"))(tail);
const warnings = require(path.join(root, "app/troubleshooting/apl-cart-warning-status.js"))(core);
const chronology = require(path.join(root, "app/troubleshooting/apl-cart-label-supply-chronology.js"))(warnings);
const library = require(path.join(root, "app/troubleshooting/apl-interface-reference.js"))(chronology);
const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");

function text(value) { return JSON.stringify(value); }

test("v368 adds one interface reference without duplicating the existing APL fault procedures", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join(" | "));
  assert.match(library.version, /apl-interface-v368/);
  assert.equal(library.entries.length, chronology.entries.length + 1);
  assert.equal(library.aplInterfaceReferenceId, "apl-aggregate-interface-reference");
  assert.equal(library.entries.filter((entry) => entry.id === "apl-aggregate-interface-reference").length, 1);
  assert.equal(library.entries.filter((entry) => entry.id === "apl-aggregate-connection").length, 1);
  assert.equal(library.entries.filter((entry) => entry.id === "apl-main-contactor").length, 1);
  assert.equal(library.entries.filter((entry) => entry.id === "apl-rewind-servo-binding").length, 1);
});

test("v368 makes the drawing-specific CN101/CN131/Harting/LS164 interface reference directly searchable", () => {
  const entry = library.getEntry("apl-aggregate-interface-reference");
  assert.equal(library.searchEntries("harting sections", { machineType: "TopModul", applicationMode: "apl" }, 8)[0].id, entry.id);
  assert.equal(library.searchEntries("CN101", { machineType: "TopModul", applicationMode: "apl" }, 8)[0].id, entry.id);
  assert.equal(library.searchEntries("LS164", { machineType: "TopModul", applicationMode: "apl" }, 8)[0].id, entry.id);
  assert.match(text(entry), /CN131/);
  assert.match(text(entry), /K605576 p\.15/);
  assert.match(text(entry), /K605576 p\.16/);
  assert.match(text(entry), /K605576 p\.42/);
  assert.match(text(entry), /K605576 p\.47/);
});

test("v368 corrects the archived field-figure identities instead of preserving the old mislabeled metadata", () => {
  const f2 = library.getSource("apl-contactor-figure-2");
  const f3 = library.getSource("apl-contactor-figure-3");
  const f4 = library.getSource("apl-contactor-figure-4");
  const f5 = library.getSource("apl-contactor-figure-5");
  assert.match(`${f2.title} ${f2.notes}`, /servo.drive guard safety switch/i);
  assert.match(`${f2.title} ${f2.notes}`, /PLC monitoring/i);
  assert.match(`${f3.title} ${f3.notes}`, /Aggregate Functions/i);
  assert.match(`${f3.title} ${f3.notes}`, /Change Labeling Station/i);
  assert.match(`${f4.title} ${f4.notes}`, /Harting connector/i);
  assert.match(`${f4.title} ${f4.notes}`, /connector cover/i);
  assert.match(`${f5.title} ${f5.notes}`, /section map/i);
  assert.match(text(f5), /emergency stop/i);
  assert.match(text(f5), /digital signals/i);
  assert.match(text(f5), /aggregate power/i);
});

test("existing APL main-contactor and docking diagnostics gain exact schematic bridges without losing their original identities", () => {
  const contactor = library.getEntry("apl-main-contactor");
  const aggregate = library.getEntry("apl-aggregate-connection");
  assert.equal(contactor.code, chronology.getEntry("apl-main-contactor").code);
  assert.equal(aggregate.code, chronology.getEntry("apl-aggregate-connection").code);
  assert.match(text(contactor), /K605576 p\.47/);
  assert.match(text(contactor), /O0007\.11/);
  assert.match(text(contactor), /I0005\.22/);
  assert.match(text(contactor), /LS143/);
  assert.match(text(contactor), /CR204/);
  assert.match(text(aggregate), /CN131/);
  assert.match(text(aggregate), /CN101/);
  assert.match(text(aggregate), /LS164/);
  assert.match(text(aggregate), /pp\.15-16/);
  assert.ok(contactor.related.includes("apl-aggregate-interface-reference"));
  assert.ok(aggregate.related.includes("apl-aggregate-interface-reference"));
});

test("v368 keeps Cart 00005 and Cart 00001 PLC producer authority unchanged", () => {
  const before5 = chronology.getAplCartFoundationPlan(5);
  const after5 = library.getAplCartFoundationPlan(5);
  assert.equal(after5.producer, before5.producer);
  assert.match(after5.producer, /1500/);
  assert.match(text(after5), /O0007\.11/);
  assert.match(text(after5), /I0005\.22/);

  const before1 = chronology.getAplCartCorePlan(1);
  const after1 = library.getAplCartCorePlan(1);
  assert.equal(after1.producer, before1.producer);
  assert.match(after1.producer, /CR202/);
  assert.match(after1.producer, /CR204/);
  assert.match(text(after1), /I0005\.04/);
  assert.match(text(after1), /I0005\.05/);
});

test("v368 interface guidance retains the no-bypass boundary and drawing-revision applicability limit", () => {
  const entry = library.getEntry("apl-aggregate-interface-reference");
  const combined = text(entry);
  assert.match(combined, /Never fabricate, add, or substitute a jumper/i);
  assert.match(combined, /Do not force, bypass, jumper, or defeat/i);
  assert.match(combined, /2005\/2006 APL Cart drawing/i);
  assert.match(combined, /active machine drawing\/revision/i);
  assert.match(combined, /not a universal pinout/i);
  assert.doesNotMatch(combined, /install (?:a )?jumper/i);
  assert.doesNotMatch(combined, /bypass (?:the )?(?:guard|emergency.stop|e.stop|safety)/i);
});

test("v368 stages after v366 and before final search precedence/application startup", () => {
  const versionMatch = /data-troubleshooting-version="v(\d+)"/.exec(page);
  assert.ok(versionMatch, "troubleshooting version banner missing");
  assert.ok(Number(versionMatch[1]) >= 368, `expected v368 or later, got v${versionMatch?.[1]}`);
  const v366Index = page.indexOf("apl-cart-label-supply-chronology.js");
  const v368Index = page.indexOf("apl-interface-reference.js");
  const precedenceIndex = page.indexOf("troubleshooting-search-precedence.js");
  const appIndex = page.indexOf("troubleshooting-app.js");
  assert.ok(v366Index >= 0 && v368Index > v366Index);
  assert.ok(precedenceIndex > v368Index);
  assert.ok(appIndex > precedenceIndex);
  assert.match(page, /troubleshooting-apl-interface-v368-20260906&shell=v358/);
});
