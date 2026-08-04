"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const manifest = JSON.parse(read("config/company-default-settings.json"));
assert.strictEqual(manifest.companyDefaultsVersion, 4);
assert.deepStrictEqual(manifest.fragments.mapLibrary, [
  "./config/default-programs/map-blank-apl.json",
  "./config/default-programs/map-l85-workbook-reference-3-label-apl.json",
  "./config/default-programs/map-45h-topmodul-3-label-apl-wipe-down-pads.json"
]);
assert.deepStrictEqual(manifest.fragments.labelSpecs, []);
assert.strictEqual(manifest.settings.selectedBrand, "");

const expectedNames = [
  "Blank APL Map",
  "45H TopModul 3 Label APL",
  "45H TopModul 3 Label APL Wipe-Down Pads"
];
manifest.fragments.mapLibrary.forEach((source, index) => {
  const map = JSON.parse(read(source.replace(/^\.\//, "")));
  assert.strictEqual(map.name, expectedNames[index]);
  assert.strictEqual(map.headCount, 45);
  assert.strictEqual(map.applicationMode, "apl");
});

const defaultsSource = read("app/company-default-programs-integration.js");
assert.doesNotThrow(() => new vm.Script(defaultsSource));
[
  "hasSavedWorkspace",
  "addMissing",
  "retireOldPackagedMaps",
  "retirePackagedLabelSpecs",
  "LEGACY_LABEL_CATALOG",
  "legacySnapshots",
  "labelSnapshot",
  "companyDefaultProgram",
  "companyDefaultSpecVersion",
  "resetToDefaults",
  "clearApplicationStorage"
].forEach((token) => assert.ok(defaultsSource.includes(token), `Missing defaults behavior: ${token}`));
assert.ok(defaultsSource.includes("return !legacySnapshots.has(labelSnapshot(spec))"));
assert.ok(!defaultsSource.includes("result[index] = entry"), "Existing user catalog entries must not be overwritten by defaults.");

const resetSource = read("app/controllers/settings-reset-controller.js");
assert.doesNotThrow(() => new vm.Script(resetSource));
assert.ok(resetSource.includes("Reset All Settings"));
assert.ok(resetSource.includes("LabelerCompanyDefaultsService"));
assert.ok(resetSource.includes("resetToDefaults"));

const bootstrap = read("app/bootstrap.js");
assert.ok(bootstrap.includes("app/controllers/settings-reset-controller.js"));

console.log("Default catalog preservation, cleanup, and reset regression passed.");
