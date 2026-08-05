"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const scene = fs.readFileSync(path.join(root, "app", "mechanical-map-scene-renderer.js"), "utf8");
const startup = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(scene));
assert.match(scene, /SENSOR_FIELD_OF_VIEW_DEG\s*=\s*18/);
assert.match(scene, /function sensorConeGeometry/);
assert.match(scene, /function drawSensorFieldOfViewCones/);
assert.match(scene, /sensorAimOffsetDeg/);
assert.match(scene, /data-sensor-field-of-view/);
assert.match(scene, /data-sensor-field-of-view-layer/);
assert.match(scene, /fill: "#55d7ff"/);
assert.match(scene, /stroke: "#a8efff"/);
assert.match(scene, /stroke-dasharray": "6 4"/);
assert.match(scene, /drawConfiguredAssemblies\(add, configuredAssemblyLayer\)[\s\S]*drawSensorFieldOfViewCones\(add, sensorFieldOfViewLayer, activeMap\)/);
assert.match(scene, /renderMap\.sensorFieldOfViewCoreV1\s*=\s*true/);
assert.match(scene, /sensorFieldOfViewCoreV1:\s*true/);

assert.doesNotMatch(
  startup,
  /loadScript\("app\/sensor-field-of-view-integration\.js"/,
  "The field-of-view must be owned by the core map renderer, not a timing-sensitive wrapper."
);
assert.match(startup, /sensor-field-of-view-core-v17/);

const integration = fs.readFileSync(path.join(root, "app", "sensor-field-of-view-integration.js"), "utf8");
assert.doesNotThrow(() => new vm.Script(integration));

console.log("Core sensor field-of-view regression passed.");
