"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const adapterSource = read("app/3d/bottle-handling-adapter.js");
const viewportSource = read("app/3d/bottle-handling-viewport-integration.js");

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
  target.Labeler3DSceneAdapter = Object.freeze({
    machineOrbit(angleDegrees, options = {}) {
      const angle = Number(angleDegrees) || 0;
      const radius = Number(options.carouselRadius) || 1;
      const signed = String(options.carouselDirection || "ccw") === "cw" ? -1 : 1;
      const zeroBase = String(options.carouselDirection || "ccw") === "cw" ? 180 : 0;
      const bearing = ((zeroBase + (Number(options.zeroAngleDegrees) || 0) + signed * angle) % 360 + 360) % 360;
      const radians = bearing * Math.PI / 180;
      return {
        x: Math.cos(radians) * radius,
        z: Math.sin(radians) * radius,
        bearingDegrees: bearing,
        radians,
        threeRotationY: -radians
      };
    }
  });
  vm.createContext(target);
  vm.runInContext(adapterSource, target, { filename: "app/3d/bottle-handling-adapter.js" });
  return target;
}

function distance(left, right) {
  return Math.hypot(Number(left?.x) - Number(right?.x), Number(left?.z) - Number(right?.z));
}

function geometry() {
  const unitsPerMm = 2.55 / 572.958;
  const headCount = 45;
  const centerSpacingMm = 110;
  const physicalPitchRadiusMm = centerSpacingMm / (2 * Math.sin(Math.PI / headCount));
  return {
    renderScale: { worldUnitsPerMm: unitsPerMm },
    machine: {
      headCount,
      physicalPitchRadiusWorld: physicalPitchRadiusMm * unitsPerMm
    },
    bottleTable: { centerSpacingMm },
    bottle: {
      effectiveDiameterMm: 60.7,
      visualHeightWorld: 1.07,
      finishOuterDiameterMm: 26.6
    }
  };
}

test("bootstrap installs bottle handling before the 3D scene runtime", () => {
  const adapterIndex = bootstrap.indexOf('"app/3d/bottle-handling-adapter.js"');
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(adapterIndex >= 0);
  assert.ok(viewportIndex > adapterIndex);
  assert.ok(runtimeIndex > viewportIndex);
});

test("handling route owns bottles in the required machine sequence", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const handling = adapter.snapshot(110, geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });

  assert.equal(handling.schemaVersion, "servoforge.3d-bottle-handling.v1");
  assert.deepEqual(Array.from(handling.ownershipSequence), [
    "infeed-conveyor",
    "infeed-star",
    "intermediate-star",
    "carousel",
    "discharge-star",
    "outfeed-conveyor"
  ]);
  assert.equal(handling.noSingleBottleZeroReset, true);
  assert.equal(handling.bottleIdentityModel, "continuous-pitch-population");
  assert.ok(handling.bottles.some((bottle) => bottle.owner === "infeed-star"));
  assert.ok(handling.bottles.some((bottle) => bottle.owner === "intermediate-star"));
  assert.ok(handling.bottles.some((bottle) => bottle.owner === "carousel"));
  assert.ok(handling.bottles.some((bottle) => bottle.owner === "discharge-star"));
});

test("every carousel-owned bottle sits on the moving bottle-table head lattice", () => {
  const target = sandbox();
  const handling = target.Labeler3DBottleHandlingAdapter.snapshot(110, geometry(), { carouselDirection: "ccw" });
  const pitch = handling.layout.headPitchDegrees;
  const machineRemainder = ((110 % pitch) + pitch) % pitch;
  const carouselBottles = handling.bottles.filter((bottle) => bottle.owner === "carousel");
  assert.ok(carouselBottles.length > 20);
  carouselBottles.forEach((bottle) => {
    const remainder = ((Number(bottle.tableAngleDegrees) % pitch) + pitch) % pitch;
    assert.ok(Math.abs(remainder - machineRemainder) < 1e-8);
  });
});

test("route handoffs are continuous instead of teleporting between machine owners", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const layout = adapter.buildLayout(geometry(), { carouselDirection: "ccw" });
  const epsilon = 1e-7;

  layout.segments.slice(0, -1).forEach((segment) => {
    const before = adapter.pointAtPitch(layout, Math.max(0, segment.endPitch - epsilon));
    const after = adapter.pointAtPitch(layout, Math.min(layout.totalPitchLength, segment.endPitch + epsilon));
    assert.ok(distance(before.position, after.position) < 1e-5);
  });
});

test("crossing a head-pitch boundary advances the continuous population instead of resetting one bottle", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const before = adapter.snapshot(7.999, geometry(), { carouselDirection: "ccw" });
  const after = adapter.snapshot(8.001, geometry(), { carouselDirection: "ccw" });
  const comparable = Math.min(before.bottles.length, after.bottles.length - 1);

  for (let index = 0; index < comparable; index += 1) {
    assert.ok(distance(before.bottles[index].position, after.bottles[index + 1].position) < 0.001);
  }
});

test("bottle handling viewport is the single starwheel presentation authority", () => {
  assert.match(viewportSource, /servoforge\.3d-bottle-handling-viewport\.v7/);
  assert.match(viewportSource, /ServoForgeBottleHandlingSystem/);
  assert.match(viewportSource, /ServoForgeInfeedStar/);
  assert.match(viewportSource, /ServoForgeIntermediateStar/);
  assert.match(viewportSource, /ServoForgeDischargeStar/);
  assert.match(viewportSource, /ServoForgeInfeedConveyor/);
  assert.match(viewportSource, /ServoForgeOutfeedConveyor/);
  assert.match(viewportSource, /new THREE\.InstancedMesh/);
  assert.match(viewportSource, /headOneIndex/);
  assert.match(viewportSource, /bottlePopulationAuthority: "continuous-handling-route-only"/);
  assert.match(viewportSource, /legacySingleBottlePopulation: false/);
  assert.match(viewportSource, /prototypeSceneHook: false/);
  assert.match(viewportSource, /singleSceneAuthority: true/);
  assert.match(viewportSource, /true-circular-bottle-clearance-arc/);
  assert.doesNotMatch(viewportSource, /requestAnimationFrame\s*\(/);

  [adapterSource, viewportSource].forEach((source) => {
    [/saveCurrentSettings\s*\(/, /state\.program\s*=/, /setServoAngleOverride\s*\(/, /simulation\.lines\s*=/]
      .forEach((pattern) => assert.doesNotMatch(source, pattern));
  });
});
