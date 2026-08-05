"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
global.window = global;
delete global.document;

require("../app/sensor-field-of-view-integration.js");

const api = global.LabelerSensorFieldOfView;
assert.ok(api?.installed, "The sensor field-of-view integration must install.");
assert.equal(api.VERSION, 2);
assert.equal(api.DEFAULT_FIELD_OF_VIEW_DEG, 18);
assert.equal(api.fieldOfViewDeg({}), 18);
assert.equal(api.fieldOfViewDeg({ sensorFieldOfViewDeg: 2 }), 4);
assert.equal(api.fieldOfViewDeg({ sensorFieldOfViewDeg: 90 }), 60);

const cone = api.coneGeometry(100, 20);
assert.equal(cone.fieldOfViewDeg, 20);
assert.equal(cone.halfAngleDeg, 10);
assert.ok(Math.abs(cone.edgeX - 98.4807753012208) < 1e-9);
assert.ok(Math.abs(cone.edgeY - 17.364817766693033) < 1e-9);
assert.match(cone.path, /^M 0 0 L /);
assert.match(cone.path, / A 100 100 0 0 1 /);
assert.match(cone.path, / Z$/);

const svgRotation = (placement) => Number(placement) - 90;
assert.equal(
  api.sensorRotation(40, 30, "ccw", svgRotation),
  160,
  "A positive counterclockwise sensor rotation must rotate the cone with the sensor aim."
);
assert.equal(
  api.sensorRotation(40, 30, "cw", svgRotation),
  100,
  "Clockwise machines must mirror the rotational sensor adjustment."
);

const source = fs.readFileSync(path.join(root, "app/sensor-field-of-view-integration.js"), "utf8");
assert.match(source, /data-sensor-field-of-view-layer/);
assert.match(source, /data-sensor-field-of-view/);
assert.match(source, /sensorAimOffsetDeg/);
assert.match(source, /Configured wipe-down assemblies/);
assert.match(source, /new global\.MutationObserver/);
assert.match(source, /fill-opacity", selected \? "0\.32" : "0\.18"/);
assert.match(source, /stroke-dasharray", "6 4"/);
assert.doesNotMatch(source, /objectLayer\.insertBefore\(group, objectLayer\.firstChild\)/);

const startup = fs.readFileSync(path.join(root, "app.js"), "utf8");
const coneLoad = startup.indexOf('loadScript("app/sensor-field-of-view-integration.js"');
const centerlineLoad = startup.indexOf('loadScript("app/sensor-editor-compact-interaction-integration.js"');
assert.ok(coneLoad >= 0, "The field-of-view integration must load at startup.");
assert.ok(centerlineLoad > coneLoad, "The cone must load before the centerline interaction module.");
assert.match(startup, /sensor-field-of-view-v16/);

console.log("Sensor field-of-view regression passed.");
