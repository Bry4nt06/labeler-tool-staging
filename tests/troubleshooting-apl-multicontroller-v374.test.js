"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const extend = require(path.join(rootDir, "app/troubleshooting/apl-multicontroller-validation-v374.js"));
const page = fs.readFileSync(path.join(rootDir, "app/troubleshooting/index.html"), "utf8");

const ids = [8, 19, 24, 31, 40, 49, 74].map((number) => `apl-cart-${String(number).padStart(5, "0")}`);
const entries = ids.map((id) => Object.freeze({
  id,
  code: id.slice(-5),
  title: `Cart ${id.slice(-5)}`,
  summary: "Existing source-backed APL Cart diagnostic.",
  checks: Object.freeze(["Existing check"]),
  actions: Object.freeze(["Existing action"]),
  sourceRefs: Object.freeze([{ sourceId: "lb1-aplcart-readable-l5k-v355", locator: "Cart 1 source" }]),
  evidenceLimits: Object.freeze([])
}));

const source = Object.freeze({ id: "lb1-aplcart-readable-l5k-v355", title: "Cart 1", file: "CO85_LB1_APLCart_1.L5K", kind: "PLC/control project", topics: Object.freeze(["APL"]) });
const entryById = new Map(entries.map((entry) => [entry.id, entry]));
const base = Object.freeze({
  version: "test-base",
  SOURCE_KIND: Object.freeze({ CONTROL_PROJECT: "PLC/control project" }),
  entries: Object.freeze(entries),
  sources: Object.freeze([source]),
  normalize: (value) => String(value || "").trim().toLowerCase(),
  getEntry: (id) => entryById.get(String(id || "")) || null,
  getSource: (id) => String(id || "") === source.id ? source : null,
  searchEntries(query, context = {}, limit = 8) {
    const q = String(query || "").toLowerCase();
    return entries.filter((entry) => `${entry.id} ${entry.code} ${entry.title}`.toLowerCase().includes(q)).slice(0, limit);
  },
  searchSources(query, limit = 20) {
    const q = String(query || "").toLowerCase();
    return [source].filter((row) => `${row.id} ${row.title} ${row.file}`.toLowerCase().includes(q)).slice(0, limit);
  },
  validate: () => ({ ok: true, errors: [] })
});

function library() {
  return extend(base);
}

test("v374 registers a bounded twelve-controller CO85 validation source without declaring site values universal", () => {
  const lib = library();
  const validation = lib.getAplCartMultiControllerValidation();
  assert.equal(validation.controllerCount, 12);
  assert.equal(validation.files.length, 12);
  assert.deepEqual(validation.commonStructure, { programs: 16, routines: 53, executableLogicLines: 631, faultWarningLogicLines: 75 });
  assert.equal(validation.logicComparison.baselineEquivalentControllers, 9);
  assert.equal(validation.logicComparison.controllerSpecificVariants, 3);
  assert.equal(validation.fault19.comparisonValueVariesByController, true);
  assert.match(validation.authorityBoundary, /Site PLC Evidence/i);
  const registered = lib.getSource("co85-apl-cart-multicontroller-v374");
  assert.equal(registered.status, "multi-controller-source-validation");
  assert.match(registered.notes, /does not make CO85 tags.*universal/i);
});

test("v374 converts Cart Fault 00019 to mechanism-level family evidence while keeping the comparison value site-specific", () => {
  const lib = library();
  const entry = lib.getEntry("apl-cart-00019");
  assert.equal(entry.multiControllerValidation.controllerCount, 12);
  assert.equal(entry.multiControllerValidation.mechanismValidated, true);
  assert.equal(entry.multiControllerValidation.comparisonValueUniversal, false);
  assert.match(entry.summary, /comparison value is not identical/i);
  assert.match(entry.summary, /matching controller/i);
  assert.match(entry.evidenceLimits.join(" "), /not a universal APL threshold/i);
  assert.doesNotMatch(`${entry.summary} ${entry.checks.join(" ")} ${entry.actions.join(" ")} ${entry.evidenceLimits.join(" ")}`, /\b(?:100|125)\b/);
});

test("v374 preserves unresolved source gaps across all twelve supplied carts instead of inventing producers", () => {
  const lib = library();
  for (const number of [8, 24, 31, 74]) {
    const entry = lib.getEntry(`apl-cart-${String(number).padStart(5, "0")}`);
    assert.equal(entry.multiControllerValidation.controllerCount, 12);
    assert.equal(entry.multiControllerValidation.producerVerified, false);
    assert.match(entry.summary, /same executable-source gap remains present across all twelve/i);
    assert.match(entry.evidenceLimits.join(" "), /different site\/application\/revision can still implement/i);
  }
});

test("v374 records Cart Faults 00040 and 00049 as inactive across this validation set without universalizing that inactivity", () => {
  const lib = library();
  for (const number of [40, 49]) {
    const entry = lib.getEntry(`apl-cart-${String(number).padStart(5, "0")}`);
    assert.equal(entry.multiControllerValidation.inactiveLogic0, true);
    assert.match(entry.summary, /Logic_0 implementation is repeated across all twelve/i);
    assert.match(entry.evidenceLimits.join(" "), /do not assume another site\/revision/i);
  }
});

test("v374 search returns enriched entries and source search exposes only the validation reference", () => {
  const lib = library();
  const hit = lib.searchEntries("00019", {}, 8)[0];
  assert.equal(hit.id, "apl-cart-00019");
  assert.equal(hit.multiControllerValidation.comparisonValueUniversal, false);
  const sourceHit = lib.searchSources("multi-controller", 20).find((row) => row.id === "co85-apl-cart-multicontroller-v374");
  assert.ok(sourceHit);
});

test("v374 validates all bounded multi-controller enrichments", () => {
  const lib = library();
  const result = lib.validate();
  assert.equal(result.ok, true, result.errors.join(" | "));
  assert.deepEqual(result.errors, []);
  assert.match(lib.version, /apl-multicontroller-v374/);
});

test("v374 module remains ordered correctly under the current v375 troubleshooting shell", () => {
  const aplInterface = page.indexOf("apl-interface-reference.js");
  const v374 = page.indexOf("apl-multicontroller-validation-v374.js");
  const search = page.indexOf("troubleshooting-search-precedence.js");
  assert.ok(aplInterface >= 0 && v374 > aplInterface && search > v374);
  assert.match(page, /data-troubleshooting-version="v375"/);
  assert.match(page, /TROUBLESHOOTING v375/);
  assert.match(page, /troubleshooting-apl-multicontroller-v374-20260906/);
});
