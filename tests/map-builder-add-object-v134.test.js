"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const controllerSource = fs.readFileSync(path.join(__dirname, "../app/map-builder-controller.js"), "utf8");
const loaderSource = fs.readFileSync(path.join(__dirname, "../app/wipe-down-builder.js"), "utf8");
const actionSource = fs.readFileSync(path.join(__dirname, "../app/controllers/map-builder-action-controller.js"), "utf8");

assert.match(loaderSource, /app\/controllers\/map-builder-action-controller\.js/,
  "Map Builder action ownership must load with the builder");
assert.match(loaderSource, /app\/controllers\/map-builder-event-controller\.js/,
  "Map Builder event ownership must load with the builder");
assert.match(loaderSource, /map-builder-add-authority-v134/,
  "Map Builder loader must use the v134 cache boundary");
assert.match(actionSource, /dynamicWorkspaceActionResolutionV134:\s*true/,
  "early-bound Map Builder actions must resolve the workspace service dynamically");

const machineMap = {
  id: "cold-glue-test-map",
  applicationMode: "cold-glue",
  stationCount: 1,
  objects: []
};

const controls = {
  builderObjectType: { value: "brush-channel" },
  builderObjectSide: { value: "outer" },
  builderObjectStation: { value: "1" },
  builderObjectStart: { value: "0" },
  builderObjectEnd: { value: "30" },
  builderObjectName: { value: "test" },
  builderObjectExtension: { value: "20" },
  builderSensorAssist: { checked: false },
  builderSensorVisibility: { value: "50" }
};

let refreshed = 0;
let rendered = 0;

const sandbox = {
  console,
  builderExpandedStation: null,
  state: {
    applicationMode: "cold-glue",
    coldGlueMap: []
  },
  els: {
    configuredMapObjectsSection: { open: false }
  },
  document: {
    querySelector(selector) {
      return controls[String(selector || "").replace(/^#/, "")] || null;
    }
  },
  window: null,
  recordBuilderHistory() {},
  editableMachineMap: () => machineMap,
  activeMachineMap: () => machineMap,
  num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  nextAplStation: () => 1,
  uniqueMapId: () => "cold-glue-test-object",
  normalizeBuilderObject(item) {
    return {
      ...item,
      application: "cold-glue",
      station: Number(item.station || 1),
      start: Number(item.start || 0),
      end: Number(item.end || 0),
      outerStart: Number(item.outerStart || 0),
      outerEnd: Number(item.outerEnd || 0),
      innerStart: Number(item.innerStart || 0),
      innerEnd: Number(item.innerEnd || 0)
    };
  },
  normalizeColdGlueMap(items) {
    return (Array.isArray(items) ? items : [])
      .filter((item) => ["brush", "brush-channel", "wipe", "roller", "gripper"].includes(item?.kind))
      .map((item) => ({ ...item, kind: item.kind === "wipe" ? "brush" : item.kind }));
  },
  refreshAfterBuilderEdit() { refreshed += 1; },
  renderWipeDownBuilder() { rendered += 1; },
  // Definitions below are referenced by other functions in the controller but
  // are not exercised by this regression.
  deepClone: (value) => JSON.parse(JSON.stringify(value)),
  mapLibraryLocation: () => ({ zone: "", site: "" }),
  activeSlotNumbers: () => [1],
  saveCurrentSettings() {},
  render() {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(controllerSource, sandbox);

const added = sandbox.LabelerMapBuilderDomainActions.addBuilderObjectFromControls();
assert.ok(added, "Add to Map must return the created object");
assert.equal(machineMap.objects.length, 1, "Add to Map must append one object to the active machine map");
assert.equal(machineMap.objects[0].kind, "brush-channel");
assert.equal(machineMap.objects[0].application, "cold-glue");
assert.equal(machineMap.objects[0].start, 0);
assert.equal(machineMap.objects[0].end, 30);
assert.equal(sandbox.state.coldGlueMap.length, 1, "Cold Glue compatibility mirror must update after add");
assert.equal(refreshed, 1, "Add to Map must refresh the map runtime once");
assert.equal(rendered, 1, "Add to Map must rerender the builder once");
assert.equal(sandbox.els.configuredMapObjectsSection.open, true,
  "Map Objects must open after a successful add");

console.log("Map Builder Add to Map v134 regression passed.");
