"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");

[
  "drivers/simulation/three-d-simulation-frame-driver.js",
  "app/3d/scene-adapter.js",
  "app/3d/physical-geometry-adapter.js",
  "app/3d/carousel-layout-adapter.js",
  "app/3d/equipment-layout-adapter.js",
  "app/3d/scene-runtime.js"
].forEach((modulePath) => {
  assert.ok(bootstrap.includes(modulePath), `${modulePath} must be loaded by the ServoForge bootstrap.`);
});

const sandbox = {
  window: {},
  console,
  Math,
  Object,
  Array,
  Number,
  String,
  Boolean,
  Set,
  Map
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

[
  "drivers/servo/servo-command-driver.js",
  "drivers/simulation/servo-replay-driver.js",
  "drivers/simulation/three-d-simulation-frame-driver.js",
  "app/3d/scene-adapter.js",
  "app/3d/physical-geometry-adapter.js",
  "app/3d/carousel-layout-adapter.js",
  "app/3d/equipment-layout-adapter.js",
  "app/3d/scene-runtime.js"
].forEach((relative) => vm.runInContext(read(relative), sandbox, { filename: relative }));

const rows = [
  { hmi: 1, plc: 0, cmd: 3, tableAngle: 90, plateAngle: 0, action: "Initial hold" },
  { hmi: 2, plc: 1, cmd: 7, tableAngle: 100, plateAngle: 0, action: "First correction" },
  { hmi: 3, plc: 2, cmd: 3, tableAngle: 120, plateAngle: 95.6, action: "Application hold" },
  { hmi: 4, plc: 3, cmd: 7, tableAngle: 145, plateAngle: 95.6, action: "Second correction" },
  { hmi: 5, plc: 4, cmd: 3, tableAngle: 170, plateAngle: 180, action: "Final hold" }
];
const originalRows = JSON.stringify(rows);

const machineMap = {
  id: "test-map",
  name: "Test APL Map",
  machineType: "TopModul",
  applicationMode: "apl",
  aggregateCount: 2,
  stationCount: 2,
  enabledAggregates: [true, true, false, false, false, false],
  enabledStations: [true, true, false, false, false, false],
  aggregateAngles: { "1": 68.5, "2": 108.5 },
  stationAngles: { "1": 68.5, "2": 108.5 },
  stationSections: { "1": "neck", "2": "body" },
  machineSettings: { direction: "ccw", radius: 250, referencePitchRadiusMm: 572.958, zeroAngle: 0 },
  depths: { spender: 12, opRoller: 14, nonOpRoller: -18, wipeInner: -4, wipeOuter: 16, sensor: 21, coding: 14 },
  objects: [
    { id: "roller-1", name: "Outside Roller", kind: "roller", application: "apl", station: 1, side: "outer", start: 72, end: 82, extension: 20 },
    { id: "pad-1", name: "Body Wipe Pad", kind: "pad", application: "apl", station: 2, side: "outer", start: 149, end: 169, extension: 20 },
    { id: "sensor-1", name: "Neck Sensor", kind: "sensor", application: "apl", station: 1, side: "outer", angle: 138.8, start: 138.8, end: 141.8, servoAssist: true, sensorFieldOfViewDeg: 18 },
    { id: "coder-1", name: "Coding", kind: "coding", application: "apl", side: "outer", start: 304, end: 309, orientationTarget: "code-box" }
  ]
};

const driver = sandbox.Labeler3DSimulationFrameDriver;
const sceneAdapter = sandbox.Labeler3DSceneAdapter;
const geometryAdapter = sandbox.Labeler3DPhysicalGeometryAdapter;
const carouselAdapter = sandbox.Labeler3DCarouselLayoutAdapter;
const equipmentAdapter = sandbox.Labeler3DEquipmentLayoutAdapter;

assert.ok(driver && sceneAdapter && geometryAdapter && carouselAdapter && equipmentAdapter);
assert.strictEqual(driver.SCHEMA_VERSION, "servoforge.3d-frame.v1");
assert.strictEqual(geometryAdapter.SCHEMA_VERSION, "servoforge.3d-geometry.v1");
assert.strictEqual(carouselAdapter.SCHEMA_VERSION, "servoforge.3d-carousel.v1");
assert.strictEqual(equipmentAdapter.SCHEMA_VERSION, "servoforge.3d-equipment.v1");

let frame = driver.snapshot(rows, 95, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(frame.flags.hold, true, "CMD 3 must remain a physical hold.");
assert.strictEqual(frame.container.servoAngleUnwrapped, 0, "CMD 3 may not interpolate toward the next waypoint.");

frame = driver.snapshot(rows, 110, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(frame.servo.command, 7);
assert.ok(Math.abs(frame.container.servoAngleUnwrapped - 47.8) < 1e-6, "CMD 7 must interpolate the commanded rotation exactly.");

frame = driver.snapshot(rows, 157.5, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.ok(Math.abs(frame.container.servoAngleUnwrapped - 137.8) < 1e-6, "Subsequent CMD 7 motion must preserve servo parity.");

const geometry = geometryAdapter.snapshot({
  tablePitchRadiusMm: 572.958,
  referencePitchRadiusMm: 572.958,
  headCount: 45,
  selectedBottle: "LNNR - 12 Oz",
  bottleSpecs: [{ bottleType: "LNNR - 12 Oz", diameterTargetMm: 61.52, radiusReductionMm: 0.41 }]
});
assert.ok(Math.abs(geometry.bottle.effectiveDiameterMm - 60.7) < 1e-6);
assert.strictEqual(geometry.bottleTable.centerSpacingMm, 110);
assert.strictEqual(geometry.bottleTable.clearanceMm, 16);
assert.strictEqual(geometry.bottleTable.plateDiameterMm, 94);
const expectedPhysicalRadius = 110 / (2 * Math.sin((8 * Math.PI / 180) / 2));
assert.ok(Math.abs(geometry.machine.physicalPitchRadiusMm - expectedPhysicalRadius) < 1e-6, "Physical pitch radius must derive from the measured 110 mm chord.");
assert.strictEqual(geometry.machine.plannerPitchRadiusMm, 572.958, "Planner/map pitch radius must remain isolated from physical 3D geometry.");
assert.strictEqual(geometry.bottle.referenceHeightMm, 241.5);

const sceneFrame = driver.snapshot(rows, 120, { commandDriver: sandbox.LabelerServoCommandDriver });
const scene = sceneAdapter.toSceneState(sceneFrame, {
  carouselRadius: geometry.machine.physicalPitchRadiusWorld,
  carouselDirection: "ccw",
  zeroAngleDegrees: 0,
  tableY: 0.2
});
assert.ok(Math.abs(scene.bottle.servoAngleDegrees - 95.6) < 1e-6);

const carousel = carouselAdapter.snapshot(scene, geometry, { carouselDirection: "ccw", zeroAngleDegrees: 0, tableY: 0.2 });
assert.strictEqual(carousel.headCount, 45);
assert.strictEqual(carousel.heads.length, 45);
assert.ok(Math.abs(carousel.pitchDegrees - 8) < 1e-6);
assert.strictEqual(carousel.passiveServoMode, "neutral-no-invented-motion");
carousel.heads.forEach((head) => {
  assert.ok(Math.abs(Math.hypot(head.position.x, head.position.z) - geometry.machine.physicalPitchRadiusWorld) < 1e-6);
});

const equipment = equipmentAdapter.snapshot(machineMap, {
  direction: "ccw",
  zeroAngle: 0,
  radius: 250,
  depths: machineMap.depths
}, geometry, { carouselDirection: "ccw", zeroAngleDegrees: 0 });
assert.strictEqual(equipment.mapId, "test-map");
assert.strictEqual(equipment.aggregates.length, 2);
assert.strictEqual(equipment.objects.length, 4);
assert.strictEqual(equipment.counts.rollers, 1);
assert.strictEqual(equipment.counts.pads, 1);
assert.strictEqual(equipment.counts.sensors, 1);
assert.strictEqual(equipment.counts.coding, 1);
assert.ok(Math.abs(equipment.objects.find((item) => item.id === "pad-1").angleDegrees - 159) < 1e-6, "Pad placement must use the map start/end midpoint.");
assert.ok(Math.abs(equipment.objects.find((item) => item.id === "sensor-1").angleDegrees - 138.8) < 1e-6, "Sensor placement must use its explicit map angle.");
assert.strictEqual(equipment.objects.find((item) => item.id === "sensor-1").servoAssist, true);
assert.strictEqual(equipment.objects.find((item) => item.id === "coder-1").orientationTarget, "code-box");
assert.ok(equipment.objects.every((item) => item.radialCadAuthority === false), "Map-derived radial positions may not be labeled CAD-authoritative.");
assert.ok(Object.isFrozen(equipment));

sandbox.state = {
  program: rows,
  previewAngle: 110,
  direction: "ccw",
  zeroAngle: 0,
  radius: 250,
  tablePitchRadiusMm: 572.958,
  referencePitchRadiusMm: 572.958,
  headCount: 45,
  selectedBottle: "LNNR - 12 Oz",
  selectedBrand: "Test Brand",
  bottleSpecs: [{ bottleType: "LNNR - 12 Oz", diameterTargetMm: 61.52, radiusReductionMm: 0.41 }],
  labelSpecs: [{ brand: "Test Brand", bottleType: "LNNR - 12 Oz" }],
  activeMapId: "test-map",
  mapLibrary: [machineMap],
  depths: machineMap.depths
};

const runtimeSnapshot = sandbox.Labeler3DSceneRuntime.snapshot({ commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(runtimeSnapshot.readOnly, true);
assert.strictEqual(runtimeSnapshot.carousel.headCount, 45);
assert.strictEqual(runtimeSnapshot.equipment.schemaVersion, "servoforge.3d-equipment.v1");
assert.strictEqual(runtimeSnapshot.equipment.mapId, "test-map");
assert.strictEqual(runtimeSnapshot.equipment.objects.length, 4);
assert.ok(Math.abs(runtimeSnapshot.frame.container.servoAngleUnwrapped - 47.8) < 1e-6);
assert.strictEqual(JSON.stringify(rows), originalRows, "3D runtime must not mutate Servo Program rows.");
assert.ok(Object.isFrozen(runtimeSnapshot.frame));
assert.ok(Object.isFrozen(runtimeSnapshot.geometry));
assert.ok(Object.isFrozen(runtimeSnapshot.carousel));
assert.ok(Object.isFrozen(runtimeSnapshot.equipment));
assert.ok(Object.isFrozen(runtimeSnapshot.scene));

console.log("ServoForge 3D servo, measured geometry, full-carousel, and equipment parity regression passed.");
