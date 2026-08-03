"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = (name) => fs.readFileSync(path.join(root, "app", name), "utf8");
const core = source("assemblies.js");
const editor = source("assembly-editor-controller.js");
const renderer = source("assembly-map-renderer.js");
const manifest = source("simulation-collapsible-integration.js");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

const editorOwners = [
  "configureSetupDialogMode",
  "renderAssemblyEditor",
  "renderObjectLocationEditor",
  "applyApplicationPreset"
];
const rendererOwners = [
  "drawMapObjectLabel",
  "activeAggregateDefinitions",
  "aggregateCenterlineGaps",
  "drawIndependentAggregates",
  "labelSensorMapStatus",
  "labelSensorMapColor",
  "drawConfiguredAssemblies"
];

for (const name of editorOwners) {
  assert.match(editor, new RegExp(`function ${name}\\(`), `${name} must be owned by the assembly editor/controller module.`);
  assert.doesNotMatch(core, new RegExp(`function ${name}\\(`), `${name} must not return to assemblies.js.`);
  assert.doesNotMatch(renderer, new RegExp(`function ${name}\\(`), `${name} must not be duplicated in the renderer.`);
}

for (const name of rendererOwners) {
  assert.match(renderer, new RegExp(`function ${name}\\(`), `${name} must be owned by the assembly renderer module.`);
  assert.doesNotMatch(core, new RegExp(`function ${name}\\(`), `${name} must not return to assemblies.js.`);
  assert.doesNotMatch(editor, new RegExp(`function ${name}\\(`), `${name} must not be duplicated in the editor/controller.`);
}

assert.match(core, /function normalizeAssembly\(/, "The temporary model fallback remains in assemblies.js for this phase.");
assert.match(core, /function assemblyStatus\(/, "The temporary geometry/status fallback remains in assemblies.js for this phase.");
assert.ok(core.split(/\r?\n/).length < 200, "assemblies.js must remain below 200 lines after the physical split.");
assert.ok(editor.split(/\r?\n/).length < 300, "The editor/controller module must remain focused.");
assert.ok(renderer.split(/\r?\n/).length < 220, "The map renderer module must remain focused.");

const adapterIndex = manifest.indexOf("app/assembly-driver-adapter.js");
const editorIndex = manifest.indexOf("app/assembly-editor-controller.js");
const rendererIndex = manifest.indexOf("app/assembly-map-renderer.js");
const nextFeatureIndex = manifest.indexOf("app/simulation-collapsible-core.js");
assert.ok(adapterIndex >= 0, "Assembly driver adapter must be present in the feature manifest.");
assert.ok(editorIndex > adapterIndex, "Assembly editor/controller must load after the driver adapter.");
assert.ok(rendererIndex > editorIndex, "Assembly renderer must load after the editor/controller.");
assert.ok(nextFeatureIndex > rendererIndex, "Assembly ownership modules must finish before unrelated workspace features.");

[
  "./drivers/assembly/assembly-model-driver.js",
  "./drivers/assembly/assembly-geometry-driver.js",
  "./app/assembly-driver-adapter.js",
  "./app/assembly-editor-controller.js",
  "./app/assembly-map-renderer.js"
].forEach((asset) => {
  assert.ok(serviceWorker.includes(`"${asset}"`), `${asset} must be included in the offline asset manifest.`);
});
assert.match(serviceWorker, /assembly-ui-split-v1/, "The service-worker cache identity must change for the assembly split.");

console.log("Assembly UI and renderer boundary regression passed.");
