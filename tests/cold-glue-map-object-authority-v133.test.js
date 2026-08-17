"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../app/cold-glue-map-service.js"), "utf8");

const machineMap = {
  id: "cold-glue-map",
  applicationMode: "cold-glue",
  stationCount: 1,
  objects: [
    { id: "brush-1", name: "Outside Brush", kind: "brush", side: "outer", station: 1, start: 80, end: 100 }
  ]
};

const state = {
  activeMapId: machineMap.id,
  mapLibrary: [machineMap],
  coldGlueMap: []
};

function normalizeBuilderObject(item) {
  const singlePoint = item.kind === "roller" || item.kind === "gripper";
  const start = Number(singlePoint ? (item.angle ?? item.start ?? 0) : (item.start ?? 0));
  const end = Number(singlePoint ? start : (item.end ?? start + 10));
  return {
    ...item,
    application: item.application === "cold-glue" ? "cold-glue" : "apl",
    start,
    end,
    angle: singlePoint ? start : item.angle,
    station: Number(item.station || 1),
    extension: Number(item.extension || 20),
    outerStart: Number(item.outerStart ?? start),
    outerEnd: Number(item.outerEnd ?? end),
    innerStart: Number(item.innerStart ?? start),
    innerEnd: Number(item.innerEnd ?? end)
  };
}

const sandbox = {
  console,
  state,
  activeMachineMap: () => machineMap,
  inferredMachineMapApplicationMode: (map) => map.applicationMode,
  normalizeBuilderObject,
  num: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  applicationMapPointRows: () => [],
  window: null
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

let objects = sandbox.coldGlueMapObjects();
assert.equal(objects.length, 1, "renderer-facing Cold Glue objects must come from active map.objects even when the legacy mirror is empty");
assert.equal(objects[0].id, "brush-1");
assert.equal(objects[0].application, "cold-glue");
assert.equal(state.coldGlueMap.length, 1, "legacy mirror should be refreshed from the canonical map");

machineMap.objects.push({
  id: "roller-1",
  name: "Roller",
  kind: "roller",
  side: "outer",
  station: 1,
  angle: 105
});
state.coldGlueMap = [];
objects = sandbox.coldGlueMapObjects();
assert.equal(objects.length, 2, "newly added map objects must be immediately visible through the canonical Cold Glue accessor");
assert.equal(objects.find((item) => item.id === "roller-1")?.application, "cold-glue", "Cold Glue rollers without a legacy application flag must stay Cold Glue");

machineMap.objects = [];
state.coldGlueMap = [{ id: "ghost", kind: "brush", application: "cold-glue", start: 1, end: 2 }];
objects = sandbox.coldGlueMapObjects();
assert.equal(objects.length, 0, "deleted active-map objects must not be resurrected from a stale legacy mirror");
assert.equal(state.coldGlueMap.length, 0, "legacy mirror must clear when the canonical map is empty");

machineMap.objects = [{
  id: "channel-1",
  name: "Brush Channel",
  kind: "brush-channel",
  station: 1,
  outerStart: 83.9,
  outerEnd: 100,
  innerStart: 83.9,
  innerEnd: 113.9
}];
const rows = sandbox.coldGlueMapRows();
assert.equal(rows.length, 4);
rows[1].update(101.5);
assert.equal(machineMap.objects[0].outerEnd, 101.5, "legacy map-point editing must mutate the canonical machine-map object");

sandbox.resetColdGlueMap();
assert.equal(machineMap.objects.length, 0, "reset must clear the canonical Cold Glue map");
assert.equal(state.coldGlueMap.length, 0, "reset must clear the compatibility mirror");
assert.equal(sandbox.LabelerColdGlueMapService.activeMapAuthorityV133, true);

console.log("Cold Glue map object authority v133 regression passed.");