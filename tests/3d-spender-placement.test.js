"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const placementSource = read("app/3d/spender-plate-placement-integration.js");

const baseFactoryIndex = bootstrap.indexOf("app/3d/hardware-mesh-factory.js");
const spenderPlacementIndex = bootstrap.indexOf("app/3d/spender-plate-placement-integration.js");
const equipmentIndex = bootstrap.indexOf("app/3d/equipment-layout-adapter.js");
assert.ok(baseFactoryIndex >= 0, "Base hardware mesh factory must be loaded.");
assert.ok(spenderPlacementIndex > baseFactoryIndex, "Spender placement presenter must load after the base hardware factory.");
assert.ok(equipmentIndex > spenderPlacementIndex, "Equipment layout must load after the spender presenter boundary.");

const sandbox = { window: {}, console, Math, Object, Array, Number, String, Boolean };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("app/3d/scene-adapter.js"), sandbox, { filename: "app/3d/scene-adapter.js" });
vm.runInContext(read("app/3d/equipment-layout-adapter.js"), sandbox, { filename: "app/3d/equipment-layout-adapter.js" });

const adapter = sandbox.Labeler3DEquipmentLayoutAdapter;
const sceneAdapter = sandbox.Labeler3DSceneAdapter;
assert.ok(adapter);
assert.strictEqual(adapter.SCHEMA_VERSION, "servoforge.3d-equipment.v2");
assert.strictEqual(adapter.SPENDER_BOTTLE_CLEARANCE_MM, 2);

const geometry = {
  renderScale: { worldUnitsPerMm: 0.01 },
  machine: { physicalPitchRadiusWorld: 5 },
  bottle: {
    radiusWorld: 0.30,
    diameterWorld: 0.60,
    visualHeightWorld: 2.415,
    bodyStraightHeightMm: 92,
    shoulderTransitionHeightMm: 41.5,
    referenceHeightMm: 241.5,
    finishHeightMm: 17
  }
};

const machineMap = {
  id: "spender-placement-test",
  name: "Spender placement test",
  aggregateCount: 3,
  stationCount: 3,
  enabledAggregates: [true, true, true, false, false, false],
  enabledStations: [true, true, true, false, false, false],
  aggregateAngles: { "1": 0, "2": 90, "3": 180 },
  stationAngles: { "1": 0, "2": 90, "3": 180 },
  stationSections: { "1": "neck", "2": "neck", "3": "body" },
  machineSettings: { radius: 250, direction: "ccw", zeroAngle: 0 },
  objects: []
};

function verifyDirection(direction) {
  const result = adapter.snapshot(machineMap, { direction, radius: 250 }, geometry, {
    carouselDirection: direction,
    zeroAngleDegrees: 0,
    tableY: 0.20,
    bottleLift: 0.155
  });

  assert.strictEqual(result.spenderClearanceMm, 2);
  assert.deepStrictEqual(Array.from(result.spenderNeckAggregates), [1, 2]);
  assert.strictEqual(result.aggregates.length, 3);

  const [agg1, agg2, agg3] = result.aggregates;
  assert.strictEqual(agg1.applicationZone, "neck");
  assert.strictEqual(agg2.applicationZone, "neck");
  assert.strictEqual(agg3.applicationZone, "body");
  assert.ok(agg1.applicationHeightWorld > agg3.applicationHeightWorld, "Aggregate 1 must be above body application height.");
  assert.ok(agg2.applicationHeightWorld > agg3.applicationHeightWorld, "Aggregate 2 must be above body application height.");
  assert.strictEqual(agg1.applicationClearanceMm, 2);
  assert.strictEqual(agg1.clearanceAuthority, "user-specified-2mm");

  result.aggregates.forEach((aggregate) => {
    const radius = Math.hypot(aggregate.position.x, aggregate.position.z);
    assert.ok(Math.abs(radius - 5) < 1e-9, "Aggregate origin must remain on the bottle centerline pitch radius.");

    const start = sceneAdapter.machineOrbit(aggregate.angleDegrees, 5, { carouselDirection: direction, zeroAngleDegrees: 0 });
    const end = sceneAdapter.machineOrbit(aggregate.angleDegrees + adapter.FLOW_SAMPLE_DEGREES, 5, { carouselDirection: direction, zeroAngleDegrees: 0 });
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    const expectedX = dx / length;
    const expectedZ = dz / length;

    // Three.js local +X after a Y rotation is (cos(yaw), 0, -sin(yaw)).
    const actualX = Math.cos(aggregate.flowRotationY);
    const actualZ = -Math.sin(aggregate.flowRotationY);
    const dot = actualX * expectedX + actualZ * expectedZ;
    assert.ok(dot > 0.999999, `${direction} spender plate must point in downstream bottle-flow direction.`);
    assert.ok(Math.abs(aggregate.radialOutSign) === 1);
  });
}

verifyDirection("ccw");
verifyDirection("cw");

assert.match(placementSource, /servoforge\.3d-hardware-mesh\.v3-spender-hardware-shape/);
assert.match(placementSource, /metrics\.radius \+ clearanceWorld/, "Plate contact plane must derive from bottle radius plus clearance.");
assert.match(placementSource, /plateCenterX = -plateLength \/ 2/, "Spender plate must extend upstream from the application edge.");
assert.match(placementSource, /bottleClearanceMm:\s*clearanceMm/);
assert.match(placementSource, /flowAligned:\s*true/);
assert.match(placementSource, /downstreamLocalAxis:\s*"\+X"/);
assert.match(placementSource, /group\.rotation\.y = number\(item\?\.flowRotationY/);

// Photo-reference hardware hierarchy: these are presentation details only and
// must never replace the authoritative placement/clearance calculations above.
assert.match(placementSource, /ServoForgeSpenderSupportPost/);
assert.match(placementSource, /ServoForgeSpenderMountTube/);
assert.match(placementSource, /ServoForgeSpenderClamp/);
assert.match(placementSource, /ServoForgeSpenderBackbone/);
assert.match(placementSource, /ServoForgeSpenderPlateMountBlade/);
assert.match(placementSource, /ServoForgeSpenderGuideRoller/);
assert.match(placementSource, /ServoForgeSpenderGuideRollerAxle/);
assert.match(placementSource, /ServoForgeSpenderGuideRollerCap/);
assert.match(placementSource, /ServoForgeSpenderPlateFastener/);
assert.match(placementSource, /ServoForgeSpenderPlateLabelWeb/);
assert.match(placementSource, /ServoForgeSpenderFeederLabelWeb/);
assert.match(placementSource, /photoDetailLevel:\s*"spender-hardware-v3"/);
assert.match(placementSource, /hardwareShapeAuthority:\s*"photo-referenced-provisional-dimensions"/);
assert.match(placementSource, /guideRollerRendered:\s*true/);
assert.match(placementSource, /clampCollarsRendered:\s*3/);
assert.match(placementSource, /backingSpineRendered:\s*true/);
assert.match(placementSource, /labelWebRendered:\s*true/);

[
  /saveCurrentSettings\s*\(/,
  /state\.program\s*=/,
  /setServoAngleOverride\s*\(/
].forEach((pattern) => assert.doesNotMatch(placementSource, pattern, `Spender presentation must remain read-only: ${pattern}`));

console.log("ServoForge 3D spender placement and hardware-shape regression passed.");
