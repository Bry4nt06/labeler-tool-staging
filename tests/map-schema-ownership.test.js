"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const driver = read("drivers/map/map-schema-driver.js");
const adapter = read("app/map-schema-adapter-integration.js");
const loader = read("app/simulation-collapsible-integration.js");
const serviceWorker = read("service-worker.js");
const builder = read("app/wipe-down-builder.js");

const driverPath = "drivers/map/map-schema-driver.js";
const adapterPath = "app/map-schema-adapter-integration.js";
assert.match(loader, /drivers\/map\/map-schema-driver\.js/);
assert.match(loader, /app\/map-schema-adapter-integration\.js/);
assert.ok(loader.indexOf(driverPath) < loader.indexOf(adapterPath), "map schema driver must load before its adapter");
assert.match(serviceWorker, /drivers\/map\/map-schema-driver\.js/);
assert.match(serviceWorker, /app\/map-schema-adapter-integration\.js/);
assert.match(serviceWorker, /map-schema-v1/);

[
  "normalizeBuilderObject",
  "normalizeEnabledSlots",
  "normalizeAggregateAngles",
  "normalizeStationAngles",
  "inferAplStationSections",
  "createMachineMap"
].forEach((name) => {
  assert.match(driver, new RegExp(`function ${name}\\(`), `${name} must be implemented by the schema driver`);
  assert.match(adapter, new RegExp(`${name}\\(`), `${name} must be routed through the schema adapter`);
});

assert.match(driver, /direction: input\.machineSettings\?\.direction === "cw" \? "cw" : "ccw"/);
assert.doesNotMatch(driver, /physicalDirection|storedDirection|reverseDirection/);
assert.match(adapter, /LabelerMapSchemaAdapter/);
assert.match(adapter, /driver: "map\.schema"/);
assert.match(builder, /function normalizeBuilderObject\(/, "legacy fallback remains until the physical deletion phase");
assert.match(builder, /function createMachineMap\(/, "legacy fallback remains until the physical deletion phase");

console.log("Map schema ownership regression passed.");