"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const sources = [
  "app/3d/bottle-handling-adapter.js",
  "app/3d/bottle-handling-video-reference-integration.js",
  "app/3d/bottle-handling-zero-datum-integration.js",
  "app/3d/bottle-handling-photo-layout-integration.js",
  "app/3d/bottle-handling-dead-zone-anchor-integration.js",
  "app/3d/bottle-handling-16-pocket-integration.js"
].map(read);
const sixteenSource = sources[sources.length - 1];

function sandbox() {
  const target = { window: {}, console, Math, Object, Array, Number, String, Boolean, Set, Map };
  target.window = target;
  target.globalThis = target;
  target.Labeler3DSceneAdapter = Object.freeze({
    machineOrbit(angleDegrees, options = {}) {
      const angle = Number(angleDegrees) || 0;
      const radius = Number(options.carouselRadius) || 1;
      const direction = String(options.carouselDirection || "ccw");
      const signed = direction === "cw" ? -1 : 1;
      const zeroBase = direction === "cw" ? 180 : 0;
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
  sources.forEach((source, index) => vm.runInContext(source, target, { filename: `handling-16-layer-${index}.js` }));
  return target;
}

function geometry() {
  const unitsPerMm = 2.55 / 572.958;
  const headCount = 45;
  const centerSpacingMm = 110;
  const physicalPitchRadiusMm = centerSpacingMm / (2 * Math.sin(Math.PI / headCount));
  return {
    renderScale: { worldUnitsPerMm: unitsPerMm },
    machine: { headCount, physicalPitchRadiusWorld: physicalPitchRadiusMm * unitsPerMm },
    bottleTable: { centerSpacingMm },
    bottle: { effectiveDiameterMm: 60.7, visualHeightWorld: 1.07, finishOuterDiameterMm: 26.6 }
  };
}

function distance(a, b) {
  return Math.hypot(Number(a?.x) - Number(b?.x), Number(a?.z) - Number(b?.z));
}

test("bootstrap applies the 16-pocket set after dead-zone anchors and before viewport rendering", () => {
  const deadZoneIndex = bootstrap.indexOf('"app/3d/bottle-handling-dead-zone-anchor-integration.js"');
  const sixteenIndex = bootstrap.indexOf('"app/3d/bottle-handling-16-pocket-integration.js"');
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  assert.ok(deadZoneIndex >= 0);
  assert.ok(sixteenIndex > deadZoneIndex);
  assert.ok(viewportIndex > sixteenIndex);
});

test("all handling stars use the user-confirmed 16-pocket pitch set", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const handling = adapter.snapshot(120, geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });
  const layout = handling.layout;
  const expectedRadiusMm = 110 / (2 * Math.sin(Math.PI / 16));
  const expectedDiameterMm = expectedRadiusMm * 2;

  assert.equal(adapter.sixteenPocketHandlingSet, true);
  assert.equal(adapter.STAR_POCKET_COUNT, 16);
  assert.equal(handling.sixteenPocketHandlingSet, true);
  assert.equal(layout.schemaVersion, "servoforge.3d-bottle-handling.v5-16-pocket");
  assert.equal(layout.starWheelSet.pocketCount, 16);
  assert.equal(layout.starWheelSet.centerSpacingMm, 110);
  assert.ok(Math.abs(layout.starWheelSet.pitchRadiusMm - expectedRadiusMm) < 1e-9);
  assert.ok(Math.abs(layout.starWheelSet.pitchDiameterMm - expectedDiameterMm) < 1e-9);

  ["infeed", "intermediate", "discharge"].forEach((key) => {
    const wheel = layout.wheels[key];
    assert.equal(wheel.pocketCount, 16, `${key} must have 16 pockets`);
    assert.ok(Math.abs(wheel.pitchRadiusMm - expectedRadiusMm) < 1e-9);
    assert.ok(Math.abs(wheel.pitchDiameterMm - expectedDiameterMm) < 1e-9);
    assert.ok(Math.abs(wheel.pocketPitchRadians - Math.PI * 2 / 16) < 1e-12);
  });

  assert.ok(Math.abs(layout.wheels.infeed.pitchRadiusWorld - layout.wheels.intermediate.pitchRadiusWorld) < 1e-12);
  assert.ok(Math.abs(layout.wheels.intermediate.pitchRadiusWorld - layout.wheels.discharge.pitchRadiusWorld) < 1e-12);
});

test("larger 16-pocket stars stay aligned to the 30 and 330 degree carousel contacts", () => {
  const target = sandbox();
  const layout = target.Labeler3DBottleHandlingAdapter.buildLayout(geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });
  const scene = target.Labeler3DSceneAdapter;
  const entry = scene.machineOrbit(30, {
    carouselRadius: layout.carouselRadius,
    carouselDirection: layout.carouselDirection,
    zeroAngleDegrees: layout.zeroAngleDegrees
  });
  const discharge = scene.machineOrbit(330, {
    carouselRadius: layout.carouselRadius,
    carouselDirection: layout.carouselDirection,
    zeroAngleDegrees: layout.zeroAngleDegrees
  });

  assert.equal(layout.entryAngleDegrees, 30);
  assert.equal(layout.exitAngleDegrees, 330);
  assert.equal(layout.deadZoneTransferAnchors.pocketCentersPhaseLocked, true);
  assert.ok(distance(layout.wheels.intermediate.carouselTransferContact, entry) < 1e-10);
  assert.ok(distance(layout.wheels.discharge.carouselTransferContact, discharge) < 1e-10);
  assert.match(layout.wheels.intermediate.pocketPhaseAuthority, /30-degree/);
  assert.match(layout.wheels.discharge.pocketPhaseAuthority, /330-degree/);
});

test("16-pocket wheel enlargement preserves continuous ownership handoffs", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const layout = adapter.buildLayout(geometry(), { carouselDirection: "ccw" });
  const epsilon = 1e-7;

  layout.segments.slice(0, -1).forEach((segment) => {
    const before = adapter.pointAtPitch(layout, Math.max(0, segment.endPitch - epsilon));
    const after = adapter.pointAtPitch(layout, Math.min(layout.totalPitchLength, segment.endPitch + epsilon));
    assert.ok(distance(before.position, after.position) < 1e-5, `${segment.owner} handoff must remain continuous`);
  });
});

test("16-pocket integration remains read-only", () => {
  assert.match(sixteenSource, /STAR_POCKET_COUNT = 16/);
  assert.match(sixteenSource, /centerSpacingWorld\) \/ \(2 \* Math\.sin\(Math\.PI \/ STAR_POCKET_COUNT\)\)/);
  assert.match(sixteenSource, /pitchDiameterMm/);
  [
    /saveCurrentSettings\s*\(/,
    /state\.program\s*=/,
    /setServoAngleOverride\s*\(/,
    /simulation\.lines\s*=/
  ].forEach((pattern) => assert.doesNotMatch(sixteenSource, pattern));
});
