"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const geometrySource = read("app/3d/label-geometry-adapter.js");
const meshSource = read("app/3d/label-mesh-factory.js");
const bootstrap = read("app/bootstrap.js");
const runtime = read("app/3d/scene-runtime.js");

const geometryIndex = bootstrap.indexOf("app/3d/label-geometry-adapter.js");
const meshIndex = bootstrap.indexOf("app/3d/label-mesh-factory.js");
const runtimeIndex = bootstrap.indexOf("app/3d/scene-runtime.js");
assert.ok(geometryIndex >= 0, "Label geometry adapter must load in bootstrap.");
assert.ok(meshIndex > geometryIndex, "Label mesh factory must load after label geometry.");
assert.ok(runtimeIndex > meshIndex, "3D runtime must load after the label contract and mesh factory.");
assert.match(runtime, /Labeler3DLabelGeometryAdapter/);
assert.match(runtime, /Labeler3DLabelMeshFactory/);
assert.match(runtime, /labels:\s*"active-label-spec-wraps-with-reference-artwork"/);
assert.match(runtime, /labelArtworkAuthority:\s*false/);
assert.match(runtime, /labelBodyBackVerticalAuthority:\s*false/);

const sandbox = { window: {}, console, Math, Object, Array, Number, String, Boolean };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(geometrySource, sandbox, { filename: "app/3d/label-geometry-adapter.js" });

const adapter = sandbox.Labeler3DLabelGeometryAdapter;
assert.ok(adapter, "3D label geometry adapter must register globally.");

const state = {
  selectedBrand: "12oz Mic Family (T6,41,FO,79,BT,87)",
  applicationMode: "apl",
  labelSpecs: [{
    brand: "12oz Mic Family (T6,41,FO,79,BT,87)",
    bottleType: "SSNR - 12 Oz",
    applicationMode: "apl",
    bodyLengthMm: 66.7,
    backLengthMm: 50.8,
    neckHeightMm: 40.001,
    neckLengthMm: 51.96,
    neckBottomCircumferenceMm: 105,
    enabledLabelSections: { neck: true, body: true, back: true }
  }]
};
const geometry = {
  renderScale: { worldUnitsPerMm: 0.00445 },
  bottle: {
    effectiveDiameterMm: 60.7,
    bodyStraightHeightMm: 92,
    shoulderTransitionHeightMm: 41.5
  }
};
const map = {
  stationSections: { "1": "neck", "3": "body", "5": "back" },
  aggregateAngles: { "1": 45, "3": 100, "5": 200 }
};

const labels = adapter.snapshot(state, geometry, map, 150);
assert.equal(labels.schemaVersion, "servoforge.3d-labels.v1");
assert.equal(labels.brand, state.selectedBrand);
assert.deepEqual(Array.from(labels.activeSections), ["neck", "body", "back"]);
assert.deepEqual(Array.from(labels.appliedSections), ["neck", "body"]);
assert.equal(labels.sections.neck.applied, true);
assert.equal(labels.sections.body.applied, true);
assert.equal(labels.sections.back.applied, false);
assert.equal(labels.sections.body.centerAngleDegrees, 0);
assert.equal(labels.sections.back.centerAngleDegrees, 180);
assert.equal(labels.sections.neck.heightMm, 40.001);
assert.equal(labels.sections.neck.heightAuthority, true);
assert.equal(labels.sections.body.heightAuthority, false);
assert.equal(labels.sections.back.heightAuthority, false);
assert.equal(labels.artworkAuthority, false);
assert.ok(labels.sections.body.wrapDegrees > 120 && labels.sections.body.wrapDegrees < 130);
assert.ok(labels.sections.back.wrapDegrees > 90 && labels.sections.back.wrapDegrees < 100);
assert.ok(labels.sections.neck.wrapDegrees > 175 && labels.sections.neck.wrapDegrees < 180);

const afterBack = adapter.snapshot(state, geometry, map, 210);
assert.equal(afterBack.sections.back.applied, true, "Back label must appear after its application aggregate.");

assert.match(meshSource, /servoforge\.3d-label-mesh\.v2/);
assert.match(meshSource, /curvedLabelGeometry/);
assert.match(meshSource, /radiusAtY/);
assert.match(meshSource, /new THREE\.CanvasTexture/);
assert.match(meshSource, /REFERENCE ART/);
assert.match(meshSource, /ServoForgeBottleLabel-/);
assert.match(meshSource, /artworkAuthority:\s*false/);

const meshSandbox = { window: {}, console, Math, Object, Array, Number, String, Boolean };
meshSandbox.window = meshSandbox;
meshSandbox.globalThis = meshSandbox;
vm.createContext(meshSandbox);
assert.doesNotThrow(
  () => vm.runInContext(meshSource, meshSandbox, { filename: "app/3d/label-mesh-factory.js" }),
  "3D label mesh factory must remain valid JavaScript."
);

console.log("ServoForge 3D bottle-label geometry regression passed.");
