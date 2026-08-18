"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const wipeSource = read("app/3d/wipe-pad-geometry-adapter.js");
const equipmentSource = read("app/3d/equipment-layout-adapter.js");

const wipeIndex = bootstrap.indexOf("app/3d/wipe-pad-geometry-adapter.js");
const equipmentIndex = bootstrap.indexOf("app/3d/equipment-layout-adapter.js");
assert.ok(wipeIndex >= 0, "Measured wipe pad geometry must load in the ServoForge bootstrap.");
assert.ok(equipmentIndex > wipeIndex, "Equipment layout must load after measured wipe pad geometry.");

const sandbox = { window: {}, console, Math, Object, Array, Number, String, Boolean };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.Labeler3DSceneAdapter = {
  machineOrbit(angle, options = {}) {
    const radians = Number(angle) * Math.PI / 180;
    const radius = Number(options.carouselRadius) || 0;
    return { x: Math.cos(radians) * radius, z: Math.sin(radians) * radius, radians };
  }
};
vm.createContext(sandbox);
vm.runInContext(wipeSource, sandbox, { filename: "app/3d/wipe-pad-geometry-adapter.js" });
vm.runInContext(equipmentSource, sandbox, { filename: "app/3d/equipment-layout-adapter.js" });

const wipe = sandbox.Labeler3DWipePadGeometryAdapter;
assert.ok(wipe, "Measured wipe pad adapter must register globally.");
assert.equal(wipe.MEASURED_WIPE_PAD.heightMm, 70);
assert.equal(wipe.MEASURED_WIPE_PAD.spongeThicknessMm, 18);
assert.equal(wipe.MEASURED_WIPE_PAD.backingPlateThicknessMm, 4);
assert.equal(wipe.MEASURED_WIPE_PAD.totalThicknessMm, 22);
assert.equal(wipe.MEASURED_WIPE_PAD.bottlePenetrationMm, 2);
assert.equal(
  wipe.MEASURED_WIPE_PAD.spongeThicknessMm + wipe.MEASURED_WIPE_PAD.backingPlateThicknessMm,
  wipe.MEASURED_WIPE_PAD.totalThicknessMm,
  "Sponge plus backing must equal the measured total wipe-pad stack."
);

const worldUnitsPerMm = 0.00445;
const geometry = {
  renderScale: { worldUnitsPerMm },
  machine: { physicalPitchRadiusMm: 788.5, physicalPitchRadiusWorld: 788.5 * worldUnitsPerMm },
  bottle: { effectiveRadiusMm: 30.35 }
};

const outer = wipe.snapshot({ kind: "pad", side: "outer", start: 189, end: 209, spanDegrees: 20 }, geometry);
assert.equal(outer.schemaVersion, "servoforge.3d-wipe-pad.v1");
assert.equal(outer.contactCenterOffsetMm, 28.35, "2 mm penetration must reduce nominal bottle radius by exactly 2 mm.");
assert.ok(Math.abs(outer.contactFaceRadiusMm - 816.85) < 1e-9);
assert.ok(Math.abs(outer.spongeCenterRadiusMm - 825.85) < 1e-9);
assert.ok(Math.abs(outer.backingCenterRadiusMm - 836.85) < 1e-9);
assert.ok(Math.abs(outer.assemblyCenterRadiusMm - 827.85) < 1e-9);
assert.ok(Math.abs(outer.heightWorld - 70 * worldUnitsPerMm) < 1e-12);
assert.ok(Math.abs(outer.totalThicknessWorld - 22 * worldUnitsPerMm) < 1e-12);
assert.ok(Math.abs(outer.penetrationWorld - 2 * worldUnitsPerMm) < 1e-12);
assert.ok(outer.contactFaceArcLengthMm > outer.tableTravelLengthMm, "Outer wipe face arc is physically outside the bottle-center pitch circle.");

const inner = wipe.snapshot({ kind: "pad", side: "inner", start: 230, end: 250, spanDegrees: 20 }, geometry);
assert.ok(Math.abs(inner.contactFaceRadiusMm - 760.15) < 1e-9);
assert.ok(Math.abs(inner.spongeCenterRadiusMm - 751.15) < 1e-9);
assert.ok(Math.abs(inner.backingCenterRadiusMm - 740.15) < 1e-9);
assert.ok(inner.contactFaceArcLengthMm < inner.tableTravelLengthMm, "Inner wipe face arc is physically inside the bottle-center pitch circle.");

const map = {
  id: "map-1",
  name: "Measured wipe test",
  machineSettings: { radius: 250, direction: "ccw", zeroAngle: 0 },
  depths: { wipeOuter: 16, wipeInner: -4, spender: 12 },
  aggregateCount: 1,
  stationCount: 1,
  enabledAggregates: [true, false, false, false, false, false],
  enabledStations: [true, false, false, false, false, false],
  aggregateAngles: { "1": 188.5 },
  objects: [{ id: "pad-1", name: "Body outside wipe", kind: "pad", side: "outer", station: 1, start: 189, end: 209 }]
};
const equipment = sandbox.Labeler3DEquipmentLayoutAdapter.snapshot(map, { radius: 250, direction: "ccw" }, geometry);
assert.equal(equipment.wipePadAuthority, "user-measured");
assert.equal(equipment.counts.measuredPads, 1);
assert.equal(equipment.objects[0].wipePad.heightMm, 70);
assert.equal(equipment.objects[0].wipePad.totalThicknessMm, 22);
assert.equal(equipment.objects[0].wipePad.bottlePenetrationMm, 2);
assert.equal(equipment.objects[0].placementAuthority, "machine-map-angle-plus-user-measured-wipe-contact-geometry");
assert.equal(equipment.objects[0].radialCadAuthority, true);

console.log("ServoForge measured wipe-pad geometry regression passed.");
