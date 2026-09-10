"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function install(settings = {}, savedScope = null) {
  global.window = global;
  delete global.document;
  const storage = new Map();
  storage.set("labelerToolSettings", JSON.stringify(settings));
  if (savedScope) storage.set("servoforge-troubleshooting-scope-v1", JSON.stringify(savedScope));
  global.localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value))
  };

  const sources = [
    { id: "src-autocol", title: "Autocol RPC reference", topics: ["Autocol", "RPC"] },
    { id: "src-topmodul", title: "TopModul station reference", topics: ["TopModul"] },
    { id: "src-dts4", title: "TopModul DTS4 RPC reference", topics: ["TopModul", "DTS4"] },
    { id: "src-dts3", title: "TopModul DTS3 RPC reference", topics: ["TopModul", "DTS3"] },
    { id: "src-apl", title: "APL common reference", topics: ["APL"] },
    { id: "src-cold", title: "Cold Glue common reference", topics: ["Cold Glue"] },
    { id: "src-universal", title: "Universal encoder reference", topics: ["encoder"] }
  ];
  const entries = [
    { id: "autocol", title: "Autocol encoder", summary: "Autocol machine fault", sourceRefs: [{ sourceId: "src-autocol" }] },
    { id: "topmodul", title: "TopModul encoder", summary: "Generic TopModul machine fault", sourceRefs: [{ sourceId: "src-topmodul" }] },
    { id: "dts4", title: "TopModul DTS4 encoder", summary: "DTS4 machine fault", sourceRefs: [{ sourceId: "src-dts4" }] },
    { id: "dts3", title: "TopModul DTS3 encoder", summary: "DTS3 machine fault", sourceRefs: [{ sourceId: "src-dts3" }] },
    { id: "multimodul", title: "MultiModul encoder", summary: "MultiModul machine fault", sourceRefs: [] },
    { id: "apl", title: "APL label supply", summary: "APL application fault", sourceRefs: [{ sourceId: "src-apl" }] },
    { id: "cold", title: "Cold Glue brush", summary: "Cold Glue application fault", sourceRefs: [{ sourceId: "src-cold" }] },
    { id: "universal", title: "Encoder fault", summary: "Generic encoder diagnostic", sourceRefs: [{ sourceId: "src-universal" }] }
  ];
  const flows = [
    { id: "flow-top", title: "TopModul station", description: "Generic TopModul station diagnosis" },
    { id: "flow-dts4", title: "TopModul DTS4 RPC", description: "DTS4 RPC diagnosis" },
    { id: "flow-dts3", title: "TopModul DTS3 RPC", description: "DTS3 RPC diagnosis" },
    { id: "flow-auto", title: "Autocol RPC", description: "Autocol RPC diagnosis" },
    { id: "flow-general", title: "Electrical power", description: "Universal power diagnosis" }
  ];
  const base = {
    entries,
    sources,
    flows,
    getSource: (id) => sources.find((source) => source.id === id) || null,
    searchEntries: (_query, _context, limit) => entries.slice(0, limit),
    searchSources: (_query, limit) => sources.slice(0, limit),
    recommendFlows: () => flows.slice(),
    normalize: (value) => String(value || "").toLowerCase()
  };
  global.ServoForgeTroubleshootingLibrary = base;
  delete global.ServoForgeTroubleshootingMachineScope;
  delete require.cache[require.resolve("../app/troubleshooting/machine-scope-filter-v375.js")];
  require("../app/troubleshooting/machine-scope-filter-v375.js");
  return { library: global.ServoForgeTroubleshootingLibrary, api: global.ServoForgeTroubleshootingMachineScope, storage };
}

test("Auto machine/application scope follows the active Autocol APL map", () => {
  const { library, api } = install({
    activeMapId: "map-1",
    mapLibrary: [{ id: "map-1", machineType: "Autocol", applicationMode: "apl" }]
  });
  assert.equal(api.getScope({}).machine, "autocol");
  assert.equal(api.getScope({}).application, "apl");
  assert.deepEqual(library.searchEntries("encoder", {}, 20).map((row) => row.id), ["autocol", "apl", "universal"]);
  assert.deepEqual(library.recommendFlows({}).map((row) => row.id), ["flow-auto", "flow-general"]);
  assert.deepEqual(library.searchSources("", 20).map((row) => row.id), ["src-autocol", "src-apl", "src-universal"]);
});

test("explicit scopes override the active map and All Machines removes machine filtering", () => {
  const { library, api } = install({ machineType: "TopModul (DTS4)", applicationMode: "cold-glue" });
  api.setMachineScope("autocol");
  api.setApplicationScope("all");
  assert.deepEqual(library.searchEntries("fault", {}, 20).map((row) => row.id), ["autocol", "apl", "cold", "universal"]);
  api.setMachineScope("all");
  assert.deepEqual(library.searchEntries("fault", {}, 20).map((row) => row.id), ["autocol", "topmodul", "dts4", "dts3", "multimodul", "apl", "cold", "universal"]);
});

test("legacy TopModul context and saved generic scope migrate to DTS4", () => {
  const { api } = install({ machineType: "TopModul", applicationMode: "apl" }, { machine: "topmodul", application: "auto" });
  const scope = api.getScope({});
  assert.equal(scope.selections.machine, "topmodul-dts4");
  assert.equal(scope.machine, "topmodul-dts4");
  assert.equal(api.canonicalMachine("TopModul"), "topmodul-dts4");
  assert.equal(api.canonicalMachine("TopModul (DTS4)"), "topmodul-dts4");
});

test("TopModul DTS3 scope keeps generic TopModul evidence but hides DTS4-specific records", () => {
  const { library, api } = install({
    activeMapId: "map-dts3",
    mapLibrary: [{ id: "map-dts3", machineType: "TopModul (DTS3)", applicationMode: "apl" }]
  });
  assert.equal(api.getScope({}).machine, "topmodul-dts3");
  assert.equal(api.canonicalMachine("TopModul DTS3"), "topmodul-dts3");
  assert.deepEqual(library.searchEntries("encoder", {}, 20).map((row) => row.id), ["topmodul", "dts3", "apl", "universal"]);
  assert.deepEqual(library.recommendFlows({}).map((row) => row.id), ["flow-top", "flow-dts3", "flow-general"]);
  assert.deepEqual(library.searchSources("", 20).map((row) => row.id), ["src-topmodul", "src-dts3", "src-apl", "src-universal"]);
});

test("TopModul DTS4 scope keeps generic TopModul evidence but hides DTS3-specific records", () => {
  const { library, api } = install({ machineType: "TopModul (DTS4)", applicationMode: "apl" });
  assert.equal(api.getScope({}).machine, "topmodul-dts4");
  assert.deepEqual(library.searchEntries("encoder", {}, 20).map((row) => row.id), ["topmodul", "dts4", "apl", "universal"]);
  assert.deepEqual(library.recommendFlows({}).map((row) => row.id), ["flow-top", "flow-dts4", "flow-general"]);
});
