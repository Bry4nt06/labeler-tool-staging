"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const defaults = fs.readFileSync(path.join(root, "app/defaults.js"), "utf8");
const mapController = fs.readFileSync(path.join(root, "app/controllers/map-controller.js"), "utf8");
const builderController = fs.readFileSync(path.join(root, "app/map-builder-controller.js"), "utf8");
const builderHistory = fs.readFileSync(path.join(root, "app/map-builder-history-service.js"), "utf8");
const rowController = fs.readFileSync(path.join(root, "app/controllers/map-builder-row-controller.js"), "utf8");
const eventController = fs.readFileSync(path.join(root, "app/controllers/map-builder-event-controller.js"), "utf8");
const catalogSource = fs.readFileSync(path.join(root, "app/company-default-map-catalog-integration.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));

assert.equal(manifest.buildId, "map-builder-object-add-v123-20260816-0735");
for (const id of ["builderObjectExtension", "builderSensorAssist", "builderSensorVisibility", "addBuilderObject"]) {
  assert.match(defaults, new RegExp(`${id}: document\\.querySelector\\(\"#${id}\"\\)`), `${id} must be registered in els.`);
}
assert.match(mapController, /if \(!els\.addBuilderObject\) throw new Error/);
assert.match(mapController, /refreshAfterBuilderEdit", \{ persist: true, structural: true \}/);
assert.match(builderHistory, /function refreshAfterBuilderEdit\(\{ persist = false, structural = false \} = \{\}\)/);
assert.match(builderHistory, /machineMap\.localStructuralMapOverride = true/);
assert.match(builderController, /refreshAfterBuilderEdit\(\{ persist: true, structural: true \}\)/);
assert.match(rowController, /refreshAfterBuilderEdit\(\{ persist: true, structural: true \}\)/);
assert.match(eventController, /runBuilderAction\("Add map object", \(\) => builder\.addObject\(\)\)/);
assert.match(eventController, /Add map object.*failed/s);

const packaged = {
  id: "map-apl-default",
  name: "Packaged Default",
  objects: [{ id: "packaged-pad", kind: "pad", start: 10, end: 20 }],
  machineSettings: { radius: 250 },
  companyDefaultProgramVersion: 9
};
const editedLocal = {
  ...JSON.parse(JSON.stringify(packaged)),
  name: "Packaged Default",
  objects: [
    { id: "packaged-pad", kind: "pad", start: 10, end: 20 },
    { id: "local-sensor", kind: "sensor", start: 200, end: 203 }
  ],
  localStructuralMapOverride: true
};
const state = {
  mapLibrary: [editedLocal],
  activeMapId: "map-apl-default",
  selectedMapObjectId: "local-sensor",
  builderHistory: { undo: [{ label: "Add map object" }], redo: [] },
  selectedBrand: ""
};
const sandbox = {
  window: null,
  globalThis: null,
  state,
  console,
  setTimeout() {},
  LabelerCompanyDefaultsService: {
    async loadCatalog() {
      return { maps: [packaged, { id: "map-45h-topmodul-3-label-apl-wipe-down-pads", name: "Second", objects: [], companyDefaultProgramVersion: 9 }] };
    },
    async reconcile() { return { changed: false }; }
  },
  saveCurrentSettings() {},
  render() {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(catalogSource, sandbox, { filename: "company-default-map-catalog-integration.js" });

(async () => {
  const result = await sandbox.LabelerApprovedDefaultMapCatalog.enforce({ persist: false, render: false });
  assert.equal(result.official, 2);
  const retained = state.mapLibrary.find((map) => map.id === "map-apl-default");
  assert.ok(retained.objects.some((item) => item.id === "local-sensor"), "locally added object must survive default-map reconciliation");
  assert.equal(retained.localStructuralMapOverride, true);
  assert.equal(retained.protectedDefaultMap, true);
  console.log("Map Builder object-add v123 regression passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
