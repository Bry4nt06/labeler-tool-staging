"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "app", "locked-map-brand-selector-integration.js"),
  "utf8"
);

assert.match(source, /const VIEWER_ID = "machineMapViewer";/,
  "The active Machine Map selector must use a dedicated viewer instead of sharing the legacy locked-map viewer.");
assert.match(source, /const SELECT_ID = "machineMapViewerSelect";/,
  "The active Machine Map selector must use its own stable select element.");
assert.match(source, /const LEGACY_VIEWER_ID = "lockedMapViewer";/,
  "The legacy locked-map viewer must remain identifiable for retirement.");
assert.match(source, /data-machine-map-selector-retired/,
  "The legacy viewer must be retired so two integrations cannot rewrite the same options.");
assert.match(source, /function ensureViewer\(\)/,
  "The selector must recreate its own viewer when required.");
assert.match(source, /function maps\(\)/,
  "Selector must use the full map library.");
assert.match(
  source,
  /library\.forEach\(\(map\) => fragment\.appendChild\(optionFor\(map, lockedIds\)\)\)/,
  "Every map must be rendered in library order."
);
assert.match(
  source,
  /loadMachineMapIntoRuntime\(map, false\)/,
  "Selecting a map must load it into runtime as a single transaction before rendering."
);
assert.match(source, /Machine Map/,
  "The control must be labeled as a map selector.");
assert.match(source, /Map Locked • Specs & Inputs Editable/,
  "Locked state copy must remain clear.");
assert.match(source, /Map Editable/,
  "Unlocked maps must show an editable state.");
assert.match(source, /observer\.observe\(mapHead, \{[\s\S]*childList: true,[\s\S]*subtree: false/,
  "Selector observation must be scoped to direct map-header structure changes only.");
assert.doesNotMatch(source, /observer\.observe\(document\.documentElement/,
  "The selector must not watch the entire dashboard DOM because unrelated renders can reset an open selection.");
assert.doesNotMatch(
  source,
  /compatibleBrandSpecs|applySelectedBrand|dataset\.brand/,
  "The map selector must not contain label-spec selection logic."
);

console.log("Machine-map selector ownership regression passed.");
