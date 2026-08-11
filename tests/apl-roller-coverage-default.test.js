"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const schemaPath = path.join(root, "drivers/map/map-schema-driver.js");
const migrationPath = path.join(root, "drivers/map/map-migration-driver.js");

delete global.LabelerMapSchemaDriver;
delete global.LabelerMapMigrationDriver;
delete require.cache[require.resolve(schemaPath)];
delete require.cache[require.resolve(migrationPath)];

const schema = require(schemaPath);
const migration = require(migrationPath);

assert.equal(schema.APL_ROLLER_COVERAGE_DEFAULT_DEG, 5);
assert.equal(schema.APL_ROLLER_COVERAGE_DEFAULT_VERSION, 1);

const defaultRoller = schema.normalizeBuilderObject({
  id: "roller-default",
  kind: "roller",
  application: "apl",
  side: "outer",
  start: 72,
  station: 1
}, "apl", 6, { idFactory: () => "roller-default" });
assert.equal(defaultRoller.wipeSpanDeg, 5);
assert.equal(defaultRoller.end, 77);

const customRoller = schema.normalizeBuilderObject({
  id: "roller-custom",
  kind: "roller",
  application: "apl",
  side: "outer",
  start: 72,
  wipeSpanDeg: 8,
  station: 1
}, "apl", 6, { idFactory: () => "roller-custom" });
assert.equal(customRoller.wipeSpanDeg, 8);
assert.equal(customRoller.end, 80);

const legacyMap = {
  applicationMode: "apl",
  objects: [
    { id: "legacy-default", kind: "roller", application: "apl", start: 72, wipeSpanDeg: 10 },
    { id: "legacy-custom", kind: "roller", application: "apl", start: 90, wipeSpanDeg: 8 }
  ]
};
assert.equal(migration.migrateAplRollerCoverageDefault(legacyMap), true);
assert.equal(legacyMap.objects[0].wipeSpanDeg, 5);
assert.equal(legacyMap.objects[1].wipeSpanDeg, 8);
assert.equal(legacyMap.aplRollerCoverageDefaultVersion, 1);

legacyMap.objects[0].wipeSpanDeg = 10;
assert.equal(migration.migrateAplRollerCoverageDefault(legacyMap), false);
assert.equal(legacyMap.objects[0].wipeSpanDeg, 10, "post-migration user edits remain editable");

const defaultsSource = fs.readFileSync(path.join(root, "app/map-defaults-service.js"), "utf8");
assert.match(defaultsSource, /wipeSpanDeg:\s*5/);
assert.doesNotMatch(defaultsSource, /wipeSpanDeg:\s*10/);

const controllerSource = fs.readFileSync(path.join(root, "app/map-builder-controller.js"), "utf8");
assert.match(controllerSource, /rollerCoverageDeg[\s\S]*num\(endControl\?\.value, 5\)/);
assert.match(controllerSource, /wipeSpanDeg:\s*rollerCoverageDeg/);

console.log("APL roller coverage default regression passed.");
