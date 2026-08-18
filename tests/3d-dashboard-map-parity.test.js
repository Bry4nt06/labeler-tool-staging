"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const sceneSource = read("app/3d/scene-adapter.js");
const equipmentSource = read("app/3d/equipment-layout-adapter.js");
const paritySource = read("app/3d/dashboard-top-view-parity-integration.js");
const bootstrap = read("app/bootstrap.js");

function close(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) <= epsilon, `${actual} != ${expected}`);
}

function dashboardAngleToXY(angle, radius, direction, zeroAngleDegrees) {
  const signed = direction === "cw" ? -1 : 1;
  const zeroBase = direction === "cw" ? 180 : 0;
  const bearing = (zeroBase + Number(zeroAngleDegrees || 0) + signed * Number(angle || 0)) * Math.PI / 180;
  return { x: Math.cos(bearing) * radius, y: Math.sin(bearing) * radius };
}

function sandbox() {
  const target = {
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
  target.window = target;
  target.globalThis = target;
  vm.createContext(target);
  vm.runInContext(sceneSource, target, { filename: "scene-adapter.js" });
  vm.runInContext(equipmentSource, target, { filename: "equipment-layout-adapter.js" });
  return target;
}

test("3D machine orbit is identical to dashboard angleToXY for CW and CCW", () => {
  const target = sandbox();
  const adapter = target.Labeler3DSceneAdapter;
  for (const direction of ["ccw", "cw"]) {
    for (const zeroAngleDegrees of [0, 17.5, 203.2]) {
      for (const angle of [0, 15, 90, 154.2, 270, 330, 359.95]) {
        const radius = 3.275;
        const expected = dashboardAngleToXY(angle, radius, direction, zeroAngleDegrees);
        const actual = adapter.machineOrbit(angle, {
          carouselRadius: radius,
          carouselDirection: direction,
          zeroAngleDegrees
        });
        close(actual.x, expected.x);
        close(actual.z, expected.y);
      }
    }
  }
});

test("equipment positions come directly from active machine-map angles", () => {
  const target = sandbox();
  const scene = target.Labeler3DSceneAdapter;
  const adapter = target.Labeler3DEquipmentLayoutAdapter;
  const geometry = {
    renderScale: { worldUnitsPerMm: 2.55 / 572.958 },
    machine: { physicalPitchRadiusWorld: 2.55 },
    bottle: { diameterWorld: 0.27, radiusWorld: 0.135, visualHeightWorld: 1.07 }
  };
  const machineMap = {
    id: "parity-map",
    name: "Parity Map",
    applicationMode: "apl",
    aggregateCount: 1,
    stationCount: 1,
    enabledAggregates: [true],
    enabledStations: [true],
    aggregateAngles: { "1": 68.5 },
    stationAngles: { "1": 68.5 },
    machineSettings: { radius: 250, direction: "ccw", zeroAngle: 0 },
    depths: { spender: 12, opRoller: 14, nonOpRoller: -18, wipeInner: -4, wipeOuter: 16 },
    objects: [
      { id: "wipe-before-zero", name: "Wipe Before Zero", kind: "pad", side: "outer", start: 340, end: 350, extension: 20 },
      { id: "wipe-after-zero", name: "Wipe After Zero", kind: "pad", side: "outer", start: 10, end: 20, extension: 20 },
      { id: "roller-map-value", name: "Roller", kind: "roller", side: "outer", start: 92, end: 102, extension: 20 },
      { id: "sensor-map-value", name: "Sensor", kind: "sensor", side: "outer", angle: 138.81236641814212, start: 138.81236641814212, end: 141.81236641814212, extension: 20 }
    ]
  };

  for (const direction of ["ccw", "cw"]) {
    for (const zeroAngleDegrees of [0, 23]) {
      const equipment = adapter.snapshot(machineMap, { direction, zeroAngle: zeroAngleDegrees }, geometry, {
        carouselDirection: direction,
        zeroAngleDegrees
      });

      equipment.objects.forEach((item) => {
        const expected = scene.machineOrbit(item.angleDegrees, {
          carouselRadius: item.radialWorld,
          carouselDirection: direction,
          zeroAngleDegrees
        });
        close(item.position.x, expected.x);
        close(item.position.z, expected.z);
      });

      const aggregate = equipment.aggregates[0];
      const expectedAggregate = scene.machineOrbit(68.5, {
        carouselRadius: geometry.machine.physicalPitchRadiusWorld,
        carouselDirection: direction,
        zeroAngleDegrees
      });
      close(aggregate.position.x, expectedAggregate.x);
      close(aggregate.position.z, expectedAggregate.z);
    }
  }
});

test("machine zero can remain between wipe-down pads because map angles are not hard-coded in 3D", () => {
  const target = sandbox();
  const adapter = target.Labeler3DEquipmentLayoutAdapter;
  assert.equal(adapter.midpointAngle(340, 350), 345);
  assert.equal(adapter.midpointAngle(10, 20), 15);
  assert.equal(adapter.normalizeAngle(360), 0);
  assert.ok(345 > 330 && 15 < 30, "sample wipe pads must flank the 0-degree datum across wrap");
});

test("dashboard parity layer locks overhead screen axes and continuously syncs map equipment", () => {
  assert.match(paritySource, /this\.up\?\.set\?\.\(0, 0, -1\)/);
  assert.match(paritySource, /machine\/world \+X = screen right/);
  assert.match(paritySource, /machine\/world \+Z = screen down/);
  assert.match(paritySource, /ServoForgePhotoReferencedApplicationAssemblies/);
  assert.match(paritySource, /ServoForgePhotoReferencedMachineHardware/);
  assert.match(paritySource, /snapshot\.equipment/);
  assert.match(paritySource, /machineMapAngleDegrees/);
  assert.match(paritySource, /global\.requestAnimationFrame\(loop\)/);
});

test("bootstrap loads dashboard parity after direction parity and before scene runtime", () => {
  const directionIndex = bootstrap.indexOf('"app/3d/three-d-direction-parity-presentation-integration.js"');
  const parityIndex = bootstrap.indexOf('"app/3d/dashboard-top-view-parity-integration.js"');
  const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(directionIndex >= 0);
  assert.ok(parityIndex > directionIndex);
  assert.ok(runtimeIndex > parityIndex);
});

test("dashboard parity integration stays read-only", () => {
  [
    /saveCurrentSettings\s*\(/,
    /state\.program\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /machineMap\.objects\s*=/
  ].forEach((pattern) => assert.doesNotMatch(paritySource, pattern));
});
