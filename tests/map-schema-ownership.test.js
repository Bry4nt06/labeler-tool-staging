"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const driver = read("drivers/map/map-schema-driver.js");
const migration = read("drivers/map/map-migration-driver.js");
const adapter = read("app/map-schema-adapter-integration.js");
const migrationService = read("app/map-migration-service.js");
const loader = read("app/simulation-collapsible-integration.js");
const serviceWorker = read("service-worker.js");
const builder = read("app/wipe-down-builder.js");

const driverPath = "drivers/map/map-schema-driver.js";
const migrationPath = "drivers/map/map-migration-driver.js";
const adapterPath = "app/map-schema-adapter-integration.js";
const migrationServicePath = "app/map-migration-service.js";

[driverPath, migrationPath, adapterPath, migrationServicePath].forEach((modulePath) => {
  assert.match(loader, new RegExp(modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(serviceWorker, new RegExp(modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
assert.ok(loader.indexOf(driverPath) < loader.indexOf(migrationPath), "map schema must load before map migration");
assert.ok(loader.indexOf(migrationPath) < loader.indexOf(adapterPath), "map migration must load before browser adapters");
assert.ok(loader.indexOf(adapterPath) < loader.indexOf(migrationServicePath), "schema adapter must load before migration service");
assert.match(serviceWorker, /map-migration-v1/);

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

assert.match(migration, /function migrateLibrary\(/);
assert.match(migration, /function repairBlankAplMap\(/);
assert.match(migration, /function calibrateStella330Map\(/);
assert.match(migration, /dependencies: \["map\.schema"\]/);
assert.match(migrationService, /ensurePersistentApplicationMapsWithMigrationService/);
assert.match(migrationService, /mapMigrationInstalled = true/);
assert.match(migrationService, /driver: "map\.migration"/);

assert.match(driver, /direction: input\.machineSettings\?\.direction === "cw" \? "cw" : "ccw"/);
assert.doesNotMatch(driver, /physicalDirection|storedDirection|reverseDirection/);
assert.match(adapter, /LabelerMapSchemaAdapter/);
assert.match(adapter, /driver: "map\.schema"/);
assert.match(builder, /function normalizeBuilderObject\(/, "legacy schema fallback remains until the physical deletion phase");
assert.match(builder, /function createMachineMap\(/, "legacy map creation fallback remains until the physical deletion phase");
assert.match(builder, /function ensurePersistentApplicationMaps\(/, "legacy migration fallback remains until browser verification");

console.log("Map schema and migration ownership regression passed.");
