"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const baseSource = read("app/3d/bottle-handling-adapter.js");
const videoSource = read("app/3d/bottle-handling-video-reference-integration.js");
const zeroSource = read("app/3d/bottle-handling-zero-datum-integration.js");
const photoSource = read("app/3d/bottle-handling-photo-layout-integration.js");
const presentationSource = read("app/3d/bottle-handling-photo-presentation-integration.js");

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
      return { x: Math.cos(radians) * radius, z: Math.sin(radians) * radius, bearingDegrees: bearing, radians, threeRotationY: -radians };
    }
  });
  vm.createContext(target);
  [baseSource, videoSource, zeroSource, photoSource].forEach((source, index) => {
    vm.runInContext(source, target, { filename: `handling-layer-${index}.js` });
  });
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

function dot(a, b) {
  return Number(a?.x) * Number(b?.x) + Number(a?.z) * Number(b?.z);
}

test("bootstrap loads photo layout after zero datum and before viewport", () => {
  const zeroIndex = bootstrap.indexOf('"app/3d/bottle-handling-zero-datum-integration.js"');
  const photoIndex = bootstrap.indexOf('"app/3d/bottle-handling-photo-layout-integration.js"');
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  const presentationIndex = bootstrap.indexOf('"app/3d/bottle-handling-photo-presentation-integration.js"');
  const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(photoIndex > zeroIndex);
  assert.ok(viewportIndex > photoIndex);
  assert.ok(presentationIndex > viewportIndex);
  assert.ok(runtimeIndex > presentationIndex);
});

test("photo calibration produces the real three-wheel cluster around machine zero", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const handling = adapter.snapshot(120, geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });
  const layout = handling.layout;
  const zero = layout.zeroDatum.radialDirection;
  const infeed = layout.wheels.infeed;
  const intermediate = layout.wheels.intermediate;
  const discharge = layout.wheels.discharge;

  assert.equal(adapter.photoLayoutCalibrated, true);
  assert.equal(handling.schemaVersion, "servoforge.3d-bottle-handling.v3-photo-layout");
  assert.equal(layout.referenceSource, "user-machine-photo-with-marked-zero-datum-2026-08-18");
  assert.equal(layout.authority.dimensionalAuthority, false);
  assert.equal(layout.photoCalibration.infeedPosition, "lower-right-outboard");
  assert.equal(layout.photoCalibration.intermediatePosition, "upper-right-near-carousel");
  assert.equal(layout.photoCalibration.dischargePosition, "left-near-carousel");

  assert.ok(distance(infeed.center, { x: 0, z: 0 }) > distance(intermediate.center, { x: 0, z: 0 }),
    "infeed star must sit farther outward than the intermediate star");
  assert.ok(Math.abs(distance(infeed.center, intermediate.center) - (infeed.pitchRadiusWorld + intermediate.pitchRadiusWorld)) < 1e-9,
    "infeed/intermediate pitch circles must remain tangent");

  const intermediateSide = zero.x * intermediate.center.z - zero.z * intermediate.center.x;
  const dischargeSide = zero.x * discharge.center.z - zero.z * discharge.center.x;
  assert.ok(intermediateSide * dischargeSide < 0,
    "intermediate/infeed cluster and discharge star must occupy opposite sides of the 0-degree datum");

  const outwardVector = {
    x: infeed.center.x - intermediate.center.x,
    z: infeed.center.z - intermediate.center.z
  };
  assert.ok(dot(outwardVector, zero) > 0,
    "infeed star must be displaced primarily outward along the marked 0-degree direction");
});

test("photo route remains continuous through all owner handoffs", () => {
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

test("photo presentation shows the real zero datum and hides only the generic hub", () => {
  assert.match(presentationSource, /ServoForgeBottleHandlingZeroDatumLine/);
  assert.match(presentationSource, /0xff2b18/);
  assert.match(presentationSource, /ServoForgeGenericCarouselHubHiddenForHandling/);
  assert.match(presentationSource, /hiddenForBottleHandlingPurposeView/);
  assert.match(presentationSource, /color === 0x10191e/);
  assert.match(presentationSource, /Math\.abs\(y - 0\.34\)/);
});

test("photo calibration remains read-only", () => {
  [photoSource, presentationSource].forEach((source) => {
    [
      /saveCurrentSettings\s*\(/,
      /state\.program\s*=/,
      /setServoAngleOverride\s*\(/,
      /simulation\.lines\s*=/
    ].forEach((pattern) => assert.doesNotMatch(source, pattern));
  });
});
