"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");

[
  "drivers/simulation/three-d-simulation-frame-driver.js",
  "app/3d/scene-adapter.js",
  "app/3d/physical-geometry-adapter.js",
  "app/3d/carousel-layout-adapter.js",
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
const driver = sandbox.Labeler3DSimulationFrameDriver;
const adapter = sandbox.Labeler3DSceneAdapter;
const geometryAdapter = sandbox.Labeler3DPhysicalGeometryAdapter;
const carouselAdapter = sandbox.Labeler3DCarouselLayoutAdapter;

assert.ok(driver, "3D simulation frame driver must register globally.");
assert.ok(adapter, "3D scene adapter must register globally.");
assert.ok(geometryAdapter, "3D physical geometry adapter must register globally.");
assert.ok(carouselAdapter, "3D carousel layout adapter must register globally.");
assert.strictEqual(driver.SCHEMA_VERSION, "servoforge.3d-frame.v1");
assert.strictEqual(geometryAdapter.SCHEMA_VERSION, "servoforge.3d-geometry.v1");
assert.strictEqual(carouselAdapter.SCHEMA_VERSION, "servoforge.3d-carousel.v1");

let frame = driver.snapshot(rows, 95, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(frame.flags.hold, true, "CMD 3 must remain a physical hold in the 3D contract.");
assert.strictEqual(frame.container.servoAngleUnwrapped, 0, "CMD 3 may not interpolate toward the following waypoint.");

frame = driver.snapshot(rows, 110, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(frame.servo.command, 7);
assert.strictEqual(frame.flags.executesRotation, true);
assert.ok(Math.abs(frame.container.servoAngleUnwrapped - 47.8) < 0.000001, "CMD 7 must interpolate the commanded bottle rotation exactly.");

frame = driver.snapshot(rows, 130, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(frame.servo.command, 3);
assert.ok(Math.abs(frame.container.servoAngleUnwrapped - 95.6) < 0.000001, "The next Rest stage must hold the completed correction angle.");

frame = driver.snapshot(rows, 157.5, { commandDriver: sandbox.LabelerServoCommandDriver });
assert.ok(Math.abs(frame.container.servoAngleUnwrapped - 137.8) < 0.000001, "The second correction must preserve numerical servo parity.");
assert.ok(Math.abs(frame.container.cumulativeNetRotation - 137.8) < 0.000001, "Cumulative net rotation must be deterministic.");

const sceneFrame = driver.snapshot(rows, 120, { commandDriver: sandbox.LabelerServoCommandDriver });
const scene = adapter.toSceneState(sceneFrame, { carouselRadius: 2, carouselDirection: "cw", zeroAngleDegrees: 0 });
assert.strictEqual(scene.schemaVersion, "servoforge.3d-scene.v1");
assert.strictEqual(scene.world.mapCoordinateParity, true);
assert.ok(Math.abs(scene.bottleTable.position.x - 1) < 0.000001, "Clockwise 120 degree table position must mirror ServoForge angleToXY X coordinates.");
assert.ok(Math.abs(scene.bottleTable.position.z - Math.sqrt(3)) < 0.000001, "Clockwise 120 degree table position must mirror ServoForge angleToXY Y coordinates on the XZ plane.");
assert.ok(Math.abs(scene.bottle.servoAngleDegrees - 95.6) < 0.000001, "Scene bottle rotation must use the exact servo angle from the frame contract.");
const expectedWorldBottleRotation = adapter.degToRad(60 - 95.6);
assert.ok(Math.abs(scene.bottle.rotation.y - expectedWorldBottleRotation) < 0.000001, "Bottle world orientation must equal ServoForge map bearing plus the signed servo turn.");
assert.ok(Math.abs(scene.bottleTable.servoPlateRotationY - expectedWorldBottleRotation) < 0.000001, "The visible servo plate must share the bottle's commanded rotational datum.");

const geometry = geometryAdapter.snapshot({
  tablePitchRadiusMm: 572.958,
  referencePitchRadiusMm: 572.958,
  headCount: 45,
  selectedBottle: "LNNR - 12 Oz",
  bottleSpecs: [{ bottleType: "LNNR - 12 Oz", diameterTargetMm: 61.52, radiusReductionMm: 0.41 }]
});
const expectedPhysicalPitchRadiusMm = 110 / (2 * Math.sin(Math.PI / 45));
const expectedPhysicalPitchRadiusWorld = expectedPhysicalPitchRadiusMm * geometry.renderScale.worldUnitsPerMm;
assert.ok(Math.abs(geometry.bottle.effectiveDiameterMm - 60.7) < 0.000001, "3D bottle diameter must use ServoForge effective bottle diameter math.");
assert.strictEqual(geometry.machine.plateCenterSpacingMm, 110, "Measured adjacent bottle-plate centers must remain 110 mm.");
assert.strictEqual(geometry.bottleTable.centerSpacingMm, 110, "Bottle-table contract must publish measured 110 mm center spacing.");
assert.strictEqual(geometry.bottleTable.clearanceMm, 16, "Measured plate edge clearance must remain 16 mm.");
assert.strictEqual(geometry.bottleTable.plateDiameterMm, 94, "Plate diameter must resolve to 110 - 16 = 94 mm.");
assert.ok(Math.abs(geometry.machine.physicalPitchRadiusMm - expectedPhysicalPitchRadiusMm) < 0.000001, "Physical pitch radius must derive from the 110 mm chord measurement and 45 heads.");
assert.ok(Math.abs(geometry.machine.pitchRadiusWorld - expectedPhysicalPitchRadiusWorld) < 0.000001, "3D pitch circle must use the measured mechanical spacing.");
assert.strictEqual(geometry.machine.plannerPitchRadiusMm, 572.958, "Existing ServoForge planner/map pitch radius must remain isolated and unchanged.");
assert.strictEqual(geometry.machine.headPitchMm, 110, "3D head pitch must report measured center-to-center chord spacing.");
assert.ok(Math.abs(geometry.machine.arcPitchMm - 110.08940527791218) < 0.000001, "Arc pitch should be derived from the physical pitch circle, not confused with measured chord spacing.");
assert.strictEqual(geometry.authority.machinePitchRadiusSource, "derived-from-user-measured-plate-center-chord");
assert.strictEqual(geometry.bottleTable.dimensionalAuthority, "user-measured-spacing-and-clearance");
assert.strictEqual(geometry.authority.bottleDiameter, true);
assert.strictEqual(geometry.authority.bottleHeight, false, "Reference drawing height must not be misrepresented as bottle-specific CAD authority.");
assert.strictEqual(geometry.authority.bottleVerticalProfile, "reference-drawing");
assert.strictEqual(geometry.bottle.verticalShapeSource, "user-provided-330ml-longneck-reference");
assert.strictEqual(geometry.bottle.referenceDrawingBodyDiameterIgnored, true, "The supplied drawing body diameter must not override ServoForge Bottle Specs.");
assert.strictEqual(geometry.bottle.referenceHeightMm, 241.5);
assert.strictEqual(geometry.bottle.finishOuterDiameterMm, 26.6);
assert.strictEqual(geometry.bottle.mouthInnerDiameterMm, 17.5);
assert.strictEqual(geometry.bottle.shoulderNeckDiameterMm, 37);
assert.strictEqual(geometry.bottle.bodyStraightHeightMm, 92);
assert.strictEqual(geometry.bottle.shoulderTransitionHeightMm, 41.5);
assert.strictEqual(geometry.bottle.finishHeightMm, 17);
assert.strictEqual(geometry.bottle.shoulderRadiusMm, 108);
assert.ok(Array.isArray(geometry.bottle.profilePointsMm) && geometry.bottle.profilePointsMm.length > 15, "Reference drawing must generate a detailed lathe profile.");
assert.ok(Math.abs(Math.max(...geometry.bottle.profilePointsMm.map((point) => point.radiusMm)) * 2 - 60.7) < 0.000001, "The rendered bottle profile maximum diameter must remain the active ServoForge effective diameter.");
assert.ok(Math.abs(geometry.bottle.profilePointsMm.at(-1).yMm - 241.5) < 0.000001, "Reference bottle profile must terminate at the supplied 241.5 mm height.");

const carouselScene = adapter.toSceneState(sceneFrame, {
  carouselRadius: geometry.machine.pitchRadiusWorld,
  carouselDirection: "ccw",
  zeroAngleDegrees: 0,
  tableY: 0.2
});
const carouselLayout = carouselAdapter.snapshot(carouselScene, geometry, {
  carouselDirection: "ccw",
  zeroAngleDegrees: 0,
  tableY: 0.2
});
assert.strictEqual(carouselLayout.headCount, 45, "Full-carousel layout must use the machine head count.");
assert.strictEqual(carouselLayout.heads.length, 45, "Full-carousel layout must publish every bottle table.");
assert.strictEqual(carouselLayout.activeHead, 1, "Head 1 must remain the live servo head in v0.3.");
assert.ok(Math.abs(carouselLayout.pitchDegrees - 8) < 0.000001, "45-head carousel spacing must equal 8 degrees per bottle table.");
assert.strictEqual(carouselLayout.plateCenterSpacingMm, 110);
assert.strictEqual(carouselLayout.plateClearanceMm, 16);
assert.strictEqual(carouselLayout.plateDiameterMm, 94);
assert.ok(Math.abs(carouselLayout.physicalPitchRadiusMm - expectedPhysicalPitchRadiusMm) < 0.000001);
assert.strictEqual(carouselLayout.plannerPitchRadiusMm, 572.958);
assert.ok(Math.abs(carouselLayout.heads[0].tableAngleDegrees - 120) < 0.000001, "Head 1 must align with the live preview table angle.");
assert.ok(Math.abs(carouselLayout.heads[1].tableAngleDegrees - 112) < 0.000001, "Head 2 must trail Head 1 by one table pitch.");
assert.strictEqual(carouselLayout.heads[0].active, true);
assert.strictEqual(carouselLayout.heads[1].active, false);
assert.strictEqual(carouselLayout.passiveServoMode, "neutral-no-invented-motion");
carouselLayout.heads.forEach((head) => {
  const radialDistance = Math.hypot(head.position.x, head.position.z);
  assert.ok(Math.abs(radialDistance - geometry.machine.pitchRadiusWorld) < 0.000001, `Head ${head.head} must remain on the measured physical pitch circle.`);
});
const firstCenterDistance = Math.hypot(
  carouselLayout.heads[0].position.x - carouselLayout.heads[1].position.x,
  carouselLayout.heads[0].position.z - carouselLayout.heads[1].position.z
) / geometry.renderScale.worldUnitsPerMm;
assert.ok(Math.abs(firstCenterDistance - 110) < 0.000001, "Adjacent rendered bottle-table centers must be exactly 110 mm apart.");

sandbox.state = {
  program: rows,
  previewAngle: 110,
  direction: "ccw",
  zeroAngle: 0,
  tablePitchRadiusMm: 572.958,
  referencePitchRadiusMm: 572.958,
  headCount: 45,
  selectedBottle: "LNNR - 12 Oz",
  selectedBrand: "Test Brand",
  bottleSpecs: [{ bottleType: "LNNR - 12 Oz", diameterTargetMm: 61.52, radiusReductionMm: 0.41 }],
  labelSpecs: [{ brand: "Test Brand", bottleType: "LNNR - 12 Oz" }]
};
const runtimeSnapshot = sandbox.Labeler3DSceneRuntime.snapshot({ commandDriver: sandbox.LabelerServoCommandDriver });
assert.strictEqual(runtimeSnapshot.readOnly, true, "3D runtime must remain read-only.");
assert.ok(Math.abs(runtimeSnapshot.frame.container.servoAngleUnwrapped - 47.8) < 0.000001, "Runtime must source the generated Servo Program and current preview angle.");
assert.strictEqual(runtimeSnapshot.geometry.schemaVersion, "servoforge.3d-geometry.v1");
assert.strictEqual(runtimeSnapshot.carousel.schemaVersion, "servoforge.3d-carousel.v1");
assert.strictEqual(runtimeSnapshot.carousel.headCount, 45, "Runtime must publish the complete 45-head carousel layout.");
assert.strictEqual(runtimeSnapshot.carousel.heads.length, 45, "Runtime must expose every bottle-table carrier.");
assert.strictEqual(runtimeSnapshot.geometry.bottleTable.centerSpacingMm, 110);
assert.strictEqual(runtimeSnapshot.geometry.bottleTable.clearanceMm, 16);
assert.strictEqual(runtimeSnapshot.geometry.bottleTable.plateDiameterMm, 94);
assert.ok(Math.abs(runtimeSnapshot.geometry.bottle.effectiveDiameterMm - 60.7) < 0.000001, "Runtime must carry active Bottle Specs into the 3D geometry contract.");
assert.strictEqual(runtimeSnapshot.geometry.bottle.referenceHeightMm, 241.5, "Runtime must carry the longneck reference height into the 3D viewport contract.");
assert.ok(Math.abs(runtimeSnapshot.scene.carousel.radius - expectedPhysicalPitchRadiusWorld) < 0.000001, "Scene orbit radius must default to the measured physical bottle-table pitch circle.");
assert.strictEqual(runtimeSnapshot.geometry.machine.plannerPitchRadiusMm, 572.958, "3D geometry must not overwrite planner/map pitch radius.");
assert.strictEqual(JSON.stringify(rows), originalRows, "3D frame generation must not mutate Servo Program rows.");
assert.ok(Object.isFrozen(runtimeSnapshot.frame), "Published 3D frames must be immutable.");
assert.ok(Object.isFrozen(runtimeSnapshot.geometry), "Published 3D geometry must be immutable.");
assert.ok(Object.isFrozen(runtimeSnapshot.carousel), "Published 3D carousel layouts must be immutable.");
assert.ok(Object.isFrozen(runtimeSnapshot.scene), "Published 3D scene states must be immutable.");

console.log("ServoForge 3D measured plate-spacing, servo, geometry, and full-carousel parity regression passed.");
