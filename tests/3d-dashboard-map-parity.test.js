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
const rendererSource = read("app/3d/three-scene-renderer-v08.js");
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
  const target = { window: {}, console, Math, Object, Array, Number, String, Boolean, Set, Map };
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
        const actual = adapter.machineOrbit(angle, { carouselRadius: radius, carouselDirection: direction, zeroAngleDegrees });
        close(actual.x, expected.x);
        close(actual.z, expected.y);
      }
    }
  }
});

test("canonical renderer owns overhead screen-axis parity without a camera patch", () => {
  assert.match(rendererSource, /camera\.up\.set\(0, 0, -1\)/);
  assert.match(rendererSource, /camera\.up\.set\(0, 1, 0\)/);
  assert.match(rendererSource, /ServoForgePhotoReferencedApplicationAssemblies/);
  assert.match(rendererSource, /ServoForgePhotoReferencedMachineHardware/);
  assert.equal(bootstrap.includes("dashboard-top-view-parity-integration.js"), false);
  assert.doesNotMatch(rendererSource, /PerspectiveCamera\.prototype/);
});

test("machine-map equipment remains sourced from active map angles", () => {
  assert.match(equipmentSource, /machineOrbit/);
  assert.match(equipmentSource, /angleDegrees/);
  assert.match(equipmentSource, /position/);
  assert.match(rendererSource, /snapshot\?\.equipment/);
  assert.match(rendererSource, /createEquipmentAssembly/);
});

test("dashboard parity stays read only", () => {
  [rendererSource, equipmentSource].forEach((source) => {
    [/saveCurrentSettings\s*\(/, /state\.program\s*=/, /setServoAngleOverride\s*\(/, /buildPlannerMotion\s*\(/]
      .forEach((pattern) => assert.doesNotMatch(source, pattern));
  });
});
