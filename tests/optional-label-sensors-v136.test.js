"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const catalogSource = fs.readFileSync(path.join(root, "app/company-default-map-catalog-integration.js"), "utf8");
const controlsSource = fs.readFileSync(path.join(root, "app/map-builder-controls.js"), "utf8");
const controllerSource = fs.readFileSync(path.join(root, "app/map-builder-controller.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(catalogSource, { filename: "company-default-map-catalog-integration.js" }));
assert.match(catalogSource, /servoforgeOptionalLabelSensorsV136/,
  "the one-time saved-workspace sensor migration must have its own marker");
assert.match(catalogSource, /stripLabelSensorsFromMap/,
  "approved maps must strip packaged sensor objects");
assert.match(controlsSource, /\[\s*["']sensor["']\s*,\s*["']Label Sensor["']\s*\]/,
  "Label Sensor must remain available as an optional Map Builder object");
assert.match(controllerSource, /type\s*===\s*["']sensor["']/,
  "Map Builder must retain sensor creation behavior");
assert.match(controllerSource, /refreshAfterBuilderEdit\(\{\s*persist:\s*true,\s*structural:\s*true\s*\}\)/,
  "adding an optional object must persist a structural map override");

const packagedMaps = [
  {
    id: "map-apl-default",
    name: "APL 6-Aggregate",
    applicationMode: "apl",
    companyDefaultProgramVersion: 12,
    objects: [
      { id: "packaged-sensor-a", kind: "sensor", station: 2 },
      { id: "packaged-pad-a", kind: "pad", station: 1 }
    ]
  },
  {
    id: "map-45h-topmodul-3-label-apl-wipe-down-pads",
    name: "Standard 45H TopModul Wipe-Down Pads",
    applicationMode: "apl",
    companyDefaultProgramVersion: 12,
    objects: [
      { id: "packaged-sensor-b", kind: "sensor", station: 2 },
      { id: "packaged-pad-b", kind: "pad", station: 1 }
    ]
  }
];

const state = {
  activeMapId: "map-apl-default",
  selectedMapObjectId: "old-default-sensor",
  selectedBrand: "",
  builderHistory: { undo: [], redo: [] },
  mapLibrary: [
    {
      id: "map-apl-default",
      name: "APL 6-Aggregate",
      applicationMode: "apl",
      companyDefaultProgram: true,
      protectedDefaultMap: true,
      objects: [
        { id: "old-default-sensor", kind: "sensor", station: 2 },
        { id: "old-default-pad", kind: "pad", station: 1 }
      ]
    },
    {
      id: "operator-map",
      name: "Operator Map",
      applicationMode: "apl",
      objects: [
        { id: "old-custom-sensor", kind: "sensor", station: 1 },
        { id: "custom-pad", kind: "pad", station: 1 }
      ]
    }
  ],
  aplMapObjects: [
    { id: "legacy-sensor", kind: "sensor", station: 1 },
    { id: "legacy-pad", kind: "pad", station: 1 }
  ]
};

const storage = new Map();
let saveCount = 0;
let renderCount = 0;
let runtimeLoadCount = 0;

const baseService = {
  async reconcile() {
    return { changed: false, version: 12 };
  },
  async loadCatalog() {
    return {
      maps: JSON.parse(JSON.stringify(packagedMaps)),
      base: { activeMapId: "map-apl-default" },
      version: 12
    };
  }
};

const sandbox = {
  console,
  Promise,
  JSON,
  Object,
  Array,
  Set,
  Map,
  Number,
  String,
  state,
  LabelerCompanyDefaultsService: baseService,
  localStorage: {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  loadMachineMapIntoRuntime(map, shouldRender) {
    assert.ok(map);
    assert.equal(shouldRender, false);
    runtimeLoadCount += 1;
  },
  saveCurrentSettings() { saveCount += 1; },
  render() { renderCount += 1; },
  setTimeout(callback) { callback(); return 1; },
  window: null
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(catalogSource, sandbox, { filename: "company-default-map-catalog-integration.js" });
assert.ok(sandbox.LabelerApprovedDefaultMapCatalog?.installed,
  "approved map catalog integration must install");
assert.equal(sandbox.LabelerCompanyDefaultsService.optionalLabelSensorsV136, true);

function sensorsIn(map) {
  return (Array.isArray(map?.objects) ? map.objects : []).filter((item) => item?.kind === "sensor");
}

(async () => {
  const first = await sandbox.LabelerCompanyDefaultsService.reconcile();
  assert.equal(first.optionalLabelSensorsV136, true);
  assert.equal(first.labelSensorMigrationApplied, true,
    "the upgrade must remove sensors from previously saved maps once");
  assert.equal(first.labelSensorsRemoved, 3,
    "two saved map sensors plus the legacy APL mirror sensor must be removed");
  assert.equal(storage.get("servoforgeOptionalLabelSensorsV136"), "1");
  assert.equal(state.selectedMapObjectId, "",
    "a selected sensor removed by migration must be cleared");
  assert.equal(state.aplMapObjects.some((item) => item.kind === "sensor"), false,
    "legacy APL compatibility state must also become sensor-free");
  state.mapLibrary.forEach((map) => {
    assert.equal(sensorsIn(map).length, 0, `${map.name} must be sensor-free after migration`);
  });
  assert.ok(state.mapLibrary.some((map) => map.id === "operator-map"),
    "custom maps must remain in the library");
  assert.equal(saveCount, 1);
  assert.equal(renderCount, 1);
  assert.equal(runtimeLoadCount, 1);

  const official = state.mapLibrary.find((map) => map.id === "map-apl-default");
  official.localStructuralMapOverride = true;
  official.objects.push({
    id: "user-added-label-sensor",
    kind: "sensor",
    station: 2,
    angle: 220,
    requiredVisibilityPercent: 50
  });

  const second = await sandbox.LabelerCompanyDefaultsService.reconcile();
  assert.equal(second.labelSensorMigrationApplied, false,
    "the sensor cleanup must never repeat after the upgrade migration");
  const officialAfterSecond = state.mapLibrary.find((map) => map.id === "map-apl-default");
  assert.equal(sensorsIn(officialAfterSecond).length, 1,
    "a Label Sensor explicitly added through Map Builder must persist");
  assert.equal(sensorsIn(officialAfterSecond)[0].id, "user-added-label-sensor");

  const packagedProjection = sandbox.LabelerApprovedDefaultMapCatalog.approvedMaps({ maps: packagedMaps });
  packagedProjection.forEach((map) => {
    assert.equal(sensorsIn(map).length, 0,
      "packaged default maps must project into the workspace without Label Sensors");
  });

  console.log("Optional Label Sensors v136 regression passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
