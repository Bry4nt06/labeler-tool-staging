"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/bottle-handling-zero-position-authority-integration.js");

function sandbox() {
  const target = { window: {}, console, Math, Object, Array, Number, String, Boolean, Set, Map };
  target.window = target;
  target.globalThis = target;
  target.Labeler3DSceneAdapter = Object.freeze({
    machineOrbit(angleDegrees, options = {}) {
      const direction = String(options.carouselDirection || "ccw").toLowerCase();
      const clockwise = direction === "cw" || direction === "clockwise";
      const signed = clockwise ? -1 : 1;
      const zeroBase = clockwise ? 180 : 0;
      const bearingDegrees = zeroBase + (Number(options.zeroAngleDegrees) || 0) + signed * (Number(angleDegrees) || 0);
      const radians = bearingDegrees * Math.PI / 180;
      const radius = Number(options.carouselRadius) || 10;
      return { x: Math.cos(radians) * radius, z: Math.sin(radians) * radius, bearingDegrees, radians, threeRotationY: -radians };
    }
  });

  const layout = {
    schemaVersion: "measured",
    carouselRadius: 10,
    carouselDirection: "ccw",
    zeroAngleDegrees: 0,
    headPitchDegrees: 8,
    entryAngleDegrees: 30,
    exitAngleDegrees: 330,
    transferGapDegrees: 60,
    totalPitchLength: 10,
    segments: [
      { id: "in", owner: "infeed-conveyor", type: "line", start: { x: 12, z: 4 }, end: { x: 11, z: 5 }, routeRotationY: 0, startPitch: 0, endPitch: 1, pitchLength: 1 },
      { id: "intermediate", owner: "intermediate-star", type: "star-arc", center: { x: 11, z: 6 }, radius: 2, startRadians: 0.2, deltaRadians: 1, pocketCount: 16, pocketPitchRadians: Math.PI * 2 / 16, routeDirectionSign: 1, startPitch: 1, endPitch: 2, pitchLength: 1 },
      { id: "carousel", owner: "carousel", type: "carousel-arc", radius: 10, startAngleDegrees: 30, endAngleDegrees: 330, spanDegrees: 300, startPitch: 2, endPitch: 8, pitchLength: 6 },
      { id: "discharge", owner: "discharge-star", type: "star-arc", center: { x: 11, z: -6 }, radius: 2, startRadians: -0.2, deltaRadians: 1, pocketCount: 16, pocketPitchRadians: Math.PI * 2 / 16, routeDirectionSign: 1, startPitch: 8, endPitch: 9, pitchLength: 1 },
      { id: "out", owner: "outfeed-conveyor", type: "line", start: { x: 11, z: -5 }, end: { x: 12, z: -4 }, routeRotationY: 0, startPitch: 9, endPitch: 10, pitchLength: 1 }
    ],
    wheels: {
      intermediate: { center: { x: 11, z: 6 }, referencePocketAngleRadians: 0.5, carouselTransferAngleDegrees: 30, carouselTransferContact: { x: 8.6602540378, z: 5 }, routeDirectionSign: 1, pocketPitchRadians: Math.PI * 2 / 16 },
      discharge: { center: { x: 11, z: -6 }, referencePocketAngleRadians: -0.5, carouselTransferAngleDegrees: 330, carouselTransferContact: { x: 8.6602540378, z: -5 }, routeDirectionSign: 1, pocketPitchRadians: Math.PI * 2 / 16 }
    },
    zeroDatum: { machineAngleDegrees: 0 },
    measuredStarGeometry: { renderedCenterDistanceMm: 800, renderedClearGapMm: 200 },
    authority: { dimensionalAuthority: "partial-user-measured-handling-geometry" },
    deadZoneTransferAnchors: { entryAngleDegrees: 30, dischargeAngleDegrees: 330 }
  };

  target.Labeler3DBottleHandlingAdapter = Object.freeze({
    buildLayout() { return layout; },
    pointAtPitch(nextLayout, pitchDistance) {
      const segment = nextLayout.segments.find((entry) => pitchDistance <= entry.endPitch) || nextLayout.segments[nextLayout.segments.length - 1];
      if (segment.type === "carousel-arc") {
        const span = segment.endPitch - segment.startPitch;
        const progress = (pitchDistance - segment.startPitch) / span;
        const angle = segment.startAngleDegrees + segment.spanDegrees * progress;
        const orbit = target.Labeler3DSceneAdapter.machineOrbit(angle, {
          carouselRadius: nextLayout.carouselRadius,
          carouselDirection: nextLayout.carouselDirection,
          zeroAngleDegrees: nextLayout.zeroAngleDegrees
        });
        return { owner: "carousel", position: { x: orbit.x, z: orbit.z }, tableAngleDegrees: angle, routeRotationY: orbit.threeRotationY };
      }
      return { owner: segment.owner, position: segment.start || segment.center || { x: 0, z: 0 }, routeRotationY: segment.routeRotationY || 0 };
    },
    snapshot() {
      return { machineAngleDegrees: 0, feedPhasePitch: 0, layout, wheels: {} };
    }
  });

  vm.createContext(target);
  vm.runInContext(source, target, { filename: "app/3d/bottle-handling-zero-position-authority-integration.js" });
  return target;
}

function distance(a, b) {
  return Math.hypot(Number(a?.x) - Number(b?.x), Number(a?.z) - Number(b?.z));
}

test("zero-position authority loads after measured stars and before direction authority", () => {
  const measured = bootstrap.indexOf('"app/3d/bottle-handling-measured-star-layout-integration.js"');
  const zero = bootstrap.indexOf('"app/3d/bottle-handling-zero-position-authority-integration.js"');
  const direction = bootstrap.indexOf('"app/3d/bottle-handling-direction-authority-integration.js"');
  assert.ok(measured >= 0);
  assert.ok(zero > measured);
  assert.ok(direction > zero);
  assert.match(bootstrap, /handling-zero-position-v305/);
});

test("measured handling assembly is rigidly moved from 30 degrees to machine zero", () => {
  const target = sandbox();
  const layout = target.Labeler3DBottleHandlingAdapter.buildLayout({}, {});
  assert.equal(layout.entryAngleDegrees, 0);
  assert.equal(layout.exitAngleDegrees, 300);
  assert.equal(layout.transferGapDegrees, 60);
  assert.equal(layout.zeroDatum.entryOffsetDegrees, 0);
  assert.equal(layout.zeroPositionAuthority.previousEntryTransferAngleDegrees, 30);
  assert.equal(layout.zeroPositionAuthority.entireMeasuredHandlingAssemblyRotatedTogether, true);
  assert.equal(layout.zeroPositionAuthority.measuredStarSpacingPreserved, true);
  assert.equal(layout.zeroPositionAuthority.legacyThirtyDegreeEntryRetired, true);

  const entry = target.Labeler3DSceneAdapter.machineOrbit(0, { carouselRadius: 10, carouselDirection: "ccw", zeroAngleDegrees: 0 });
  assert.ok(distance(layout.wheels.intermediate.carouselTransferContact, entry) < 1e-8);
});

test("rigid zero alignment preserves measured intermediate-discharge center spacing", () => {
  const target = sandbox();
  const before = target.Labeler3DBottleHandlingAdapter;
  const layout = before.buildLayout({}, {});
  const centerDistance = distance(layout.wheels.intermediate.center, layout.wheels.discharge.center);
  assert.ok(Math.abs(centerDistance - 12) < 1e-9);
});

test("zero-position authority remains read-only and prototype-free", () => {
  [
    /Object3D\.prototype/,
    /prototype\.add\s*=/,
    /state\.program\s*=/,
    /state\.direction\s*=/,
    /saveCurrentSettings\s*\(/,
    /setServoAngleOverride\s*\(/,
    /simulation\.lines\s*=/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
  assert.match(source, /readOnly: true/);
});
