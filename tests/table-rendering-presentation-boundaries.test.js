"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readApp = (name) => fs.readFileSync(path.join(root, "app", name), "utf8");

const legacy = readApp("table-rendering.js");
const specs = readApp("specification-table-renderer.js");
const build = readApp("build-inputs-renderer.js");
const manifest = readApp("simulation-collapsible-integration.js");
const delegatedEvents = readApp(path.join("controllers", "setup-event-controller-integration.js"));
const specsController = readApp(path.join("controllers", "specs-controller.js"));
const buildController = readApp(path.join("controllers", "build-inputs-controller.js"));

[
  "renderBottleSpecs",
  "renderLabelSpecs"
].forEach((name) => {
  assert.match(specs, new RegExp(`function ${name}\\(`), `${name} must be owned by the specification table renderer.`);
});
assert.match(build, /function renderBuildInputs\(/, "Build Inputs must be owned by its focused renderer.");

[specs, build].forEach((source) => {
  assert.doesNotMatch(source, /addEventListener\(/, "Presentation modules must not attach row-level event handlers.");
  assert.doesNotMatch(source, /saveCurrentSettings\(/, "Presentation modules must not own persistence.");
  assert.doesNotMatch(source, /\brender\(\)/, "Presentation modules must not recursively own the application render cycle.");
});

assert.match(specs, /id="addBottleSpec"/, "Bottle add control ID must remain stable for delegated events.");
assert.match(specs, /id="addLabelSpec"/, "Label add control ID must remain stable for delegated events.");
assert.match(specs, /label-specs-table/, "Label specification table styling contract must remain stable.");
assert.match(build, /id="zoneSelect"/, "Zone selector ID must remain stable.");
assert.match(build, /id="brandSelect"/, "Brand selector ID must remain stable.");
assert.match(build, /id="programMaxMoveRatio"/, "Calculated Build Input IDs must remain stable.");
assert.match(build, /Workbook Feed Check/, "Workbook summary presentation must remain present.");

assert.match(specsController, /function addBottle\(/, "Specs controller must own bottle creation.");
assert.match(specsController, /function updateLabel\(/, "Specs controller must own label mutation.");
assert.match(buildController, /function updateCalculatedField\(/, "Build Inputs controller must own calculated field mutation.");
assert.match(delegatedEvents, /handleSpecChange/, "Delegated event integration must own specification changes.");
assert.match(delegatedEvents, /calculatedBuildFields/, "Delegated event integration must own calculated Build Input changes.");

const specIndex = manifest.indexOf("app/specification-table-renderer.js");
const buildIndex = manifest.indexOf("app/build-inputs-renderer.js");
const coordinatorIndex = manifest.indexOf("app/rendering-coordinator-integration.js");
const diagnosticsIndex = manifest.indexOf("app/validation-diagnostics-integration.js");
assert.ok(specIndex >= 0, "Specification renderer must be present in the feature manifest.");
assert.ok(buildIndex > specIndex, "Build Inputs renderer must load after the shared specification renderer.");
assert.ok(coordinatorIndex > buildIndex, "Render coordinator must install after focused presentation owners.");
assert.ok(diagnosticsIndex > coordinatorIndex, "Diagnostics must remain the final feature stage.");

assert.match(legacy, /function renderBottleSpecs\(/, "The source-level Specs fallback remains for this browser-verification phase.");
assert.match(legacy, /function renderBuildInputs\(/, "The source-level Build Inputs fallback remains for this browser-verification phase.");
assert.ok(specs.split(/\r?\n/).length < 60, "Specification renderer must remain focused.");
assert.ok(build.split(/\r?\n/).length < 110, "Build Inputs renderer must remain focused.");

console.log("Table rendering presentation ownership regression passed.");
