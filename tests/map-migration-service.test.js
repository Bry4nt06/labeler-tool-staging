"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../app/map-migration-service.js"), "utf8");
let loadCount = 0;
const active = { id: "map-a", name: "Active", applicationMode: "apl", objects: [] };
const migrated = {
  maps: [active, { id: "map-blank-apl", name: "Blank APL Map", applicationMode: "apl", objects: [] }],
  activeMapId: active.id,
  activeMap: active,
  forceReload: false
};
const migration = {
  migrateLibrary(input, dependencies) {
    assert.equal(input.activeMapId, "map-a");
    assert.equal(typeof dependencies.createMap, "function");
    assert.equal(typeof dependencies.mapLocationFor, "function");
    assert.equal(typeof dependencies.normalizeAggregateAngles, "function");
    assert.equal(typeof dependencies.normalizeColdGlueObjects, "function");
    return migrated;
  }
};
const schema = { MACHINE_MAP_SCHEMA_VERSION: 11 };
const sandbox = {
  console,
  state: {
    mapLibrary: [active],
    activeMapId: "map-a",
    aplMapObjects: []
  },
  runtimeMachineMapId: "map-a",
  LabelerDriverRegistry: {
    resolve(name) {
      if (name === "map.migration") return migration;
      if (name === "map.schema") return schema;
      return null;
    }
  },
  createMachineMap: (input) => ({ ...input }),
  mapLocationFor: (map) => ({ zone: map.zone || "", site: map.site || "" }),
  normalizeAggregateAngles: (value) => value || {},
  normalizeColdGlueMap: (objects) => objects || [],
  normalizeBuilderObject: (item) => ({ ...item }),
  defaultAplMapObjects: () => [],
  loadMachineMapIntoRuntime() { loadCount += 1; }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

assert.equal(sandbox.ensurePersistentApplicationMaps.mapMigrationInstalled, true);
assert.equal(sandbox.LabelerMapMigrationService.driver, "map.migration");
assert.equal(sandbox.state.mapLibrary, migrated.maps);
assert.equal(loadCount, 0, "matching runtime map must not reload");

sandbox.runtimeMachineMapId = "different";
sandbox.ensurePersistentApplicationMaps();
assert.equal(loadCount, 1, "different runtime map must reload exactly once");

console.log("Map migration service regression passed.");
