"use strict";

const assert = require("node:assert/strict");

global.window = global;
global.LabelerDriverRegistry = { register() {} };
const driver = require("../drivers/profile/sensor-station-label-driver.js");

assert.equal(driver.sectionForStation(1), "neck");
assert.equal(driver.sectionForStation(2), "neck");
assert.equal(driver.sectionForStation(3), "body");
assert.equal(driver.sectionForStation(4), "body");
assert.equal(driver.sectionForStation(5), "back");
assert.equal(driver.sectionForStation(6), "back");
assert.equal(driver.sectionForStation(7), "none");

const combined = {
  id: "sensor-body",
  kind: "sensor",
  name: "Neck / Body Label Inspection",
  station: 4,
  labelSection: "neck",
  orientationLabelSection: "back"
};
assert.equal(driver.normalizeSensor(combined), true);
assert.equal(combined.name, "Body Label Inspection");
assert.equal(combined.labelSection, "body");
assert.equal(combined.orientationLabelSection, "body");
assert.equal(combined.sensorLabelSource, "station-pair");
assert.equal(combined.sensorLabelLocked, true);

combined.station = 2;
driver.normalizeSensor(combined);
assert.equal(combined.name, "Neck Label Inspection");
assert.equal(combined.labelSection, "neck");
assert.equal(combined.orientationLabelSection, "neck");

const custom = {
  id: "sensor-custom",
  kind: "sensor",
  name: "Camera 12 Verification",
  station: 6,
  orientationLabelSection: "neck"
};
driver.normalizeSensor(custom);
assert.equal(custom.name, "Camera 12 Verification", "Custom sensor names must remain intact.");
assert.equal(custom.labelSection, "back");
assert.equal(custom.orientationLabelSection, "back");

const coder = {
  id: "coder",
  kind: "coding",
  station: null,
  orientationLabelSection: "auto"
};
const map = { objects: [combined, custom, coder] };
assert.equal(driver.normalizeMap(map), false, "Already normalized sensors should not cause repeated changes.");
assert.equal(coder.orientationLabelSection, "auto", "Coder label selection remains independent.");

console.log("Sensor station-label inheritance regression passed.");
