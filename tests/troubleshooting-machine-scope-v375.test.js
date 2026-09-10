"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function install(settings = {}) {
  global.window = global;
  delete global.document;
  const storage = new Map();
  storage.set("labelerToolSettings", JSON.stringify(settings));
  global.localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value))
  };

  const sources = [
    { id: "src-autocol", title: "Autocol RPC reference", topics: ["Autocol", "RPC"] },
    { id: "src-topmodul", title: "TopModul station reference", topics: ["TopModul"] },
    { id: "src-apl", title: "APL common reference", topics: ["APL"] },
    { id: "src-cold", title: "Cold Glue common reference", topics: ["Cold Glue"] },
    { id: "src-universal", title: "Universal encoder reference", topics: ["encoder"] }
  ];
  const entries = [
    { id: "autocol", title: "Autocol encoder", summary: "Autocol machine fault", sourceRefs: [{ sourceId: "src-autocol" }] },
    { id: "topmodul", title: "TopModul encoder", summary: "TopModul machine fault", sourceRefs: [{ sourceId: "src-topmodul" }] },
    { id: "multimodul", title: "MultiModul encoder", summary: "MultiModul machine fault", sourceRefs: [] },
    { id: "apl", title: "APL label supply", summary: "APL application fault", sourceRefs: [{ sourceId: "src-apl" }] },
    { id: "cold", title: "Cold Glue brush", summary: "Cold Glue application fault", sourceRefs: [{ sourceId: "src-cold" }] },
    { id: "universal", title: "Encoder fault", summary: "Generic encoder diagnostic", sourceRefs: [{ sourceId: "src-universal" }] }
  ];
  const flows = [
    { id: "flow-top", title: "TopModul station", description: "TopModul station diagnosis" },
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
  return { library: global.ServoForgeTroubleshootingLibrary, api: global.ServoForgeTroubleshootingMachineScope };
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
  const { library, api } = install({ machineType: "TopModul", applicationMode: "cold-glue" });
  api.setMachineScope("autocol");
  api.setApplicationScope("all");
  assert.deepEqual(library.searchEntries("fault", {}, 20).map((row) => row.id), ["autocol", "apl", "cold", "universal"]);
  api.setMachineScope("all");
  assert.deepEqual(library.searchEntries("fault", {}, 20).map((row) => row.id), ["autocol", "topmodul", "multimodul", "apl", "cold", "universal"]);
});
