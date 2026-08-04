"use strict";

const assert = require("node:assert/strict");
const map = require("../config/default-programs/map-45h-topmodul-3-label-apl-wipe-down-pads.json");

assert.equal(map.id, "map-45h-topmodul-3-label-apl-wipe-down-pads");
assert.equal(map.name, "Standard 45H TopModul Wipe-Down Pads");
assert.equal(map.companyDefaultProgram, true);
assert.equal(map.protectedDefaultMap, true);
assert.equal(map.defaultCatalogVersion, 6);
assert.equal(map.companyDefaultProgramVersion, 6);
assert.equal(map.objects.length, 11);

const byId = new Map(map.objects.map((object) => [object.id, object]));
assert.deepEqual(
  [byId.get("default-pad-a1").start, byId.get("default-pad-a1").end],
  [69, 89]
);
assert.deepEqual(
  [byId.get("default-pad-a2").start, byId.get("default-pad-a2").end],
  [109, 129]
);

const innerPads = map.objects.filter((object) => object.kind === "pad" && object.side === "inner");
assert.deepEqual(
  innerPads.map((object) => [object.station, object.start, object.end]),
  [
    [1, 88.04416389449341, 98.04416389449341],
    [2, 128, 138]
  ]
);

assert.equal(byId.get("default-neck-body-inspection").orientationLabelSection, "auto");
assert.equal(byId.get("default-back-inspection").orientationLabelSection, "auto");
assert.equal(byId.get("default-back-coding").orientationLabelSection, "auto");
assert.equal(byId.get("default-back-coding").orientBottle, true);

console.log("Standard 45H wipe-down default regression passed.");
