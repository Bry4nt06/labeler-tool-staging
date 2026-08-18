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
  vm.runInContext(baseSource, target, { filename: "app/3d/bottle-handling-adapter.js" });
  vm.runInContext(videoSource, target, { filename: "app/3d/bottle-handling-video-reference-integration.js" });
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

function distance(left, right) {
  return Math.hypot(Number(left?.x) - Number(right?.x), Number(left?.z) - Number(right?.z));
}

test("bootstrap applies video handling reference after the base adapter and before the viewport", () => {
  const baseIndex = bootstrap.indexOf('"app/3d/bottle-handling-adapter.js"');
  const videoIndex = bootstrap.indexOf('"app/3d/bottle-handling-video-reference-integration.js"');
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  assert.ok(baseIndex >= 0);
  assert.ok(videoIndex > baseIndex);
  assert.ok(viewportIndex > videoIndex);
});

test("running-machine video refines the transfer cluster without claiming dimensional authority", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const handling = adapter.snapshot(110, geometry(), { carouselDirection: "ccw" });
  const layout = handling.layout;

  assert.equal(adapter.videoReferenceV2, true);
  assert.equal(handling.schemaVersion, "servoforge.3d-bottle-handling.v2-video-reference");
  assert.equal(handling.referenceSource, "user-supplied-running-topmodul-video-2026-08-18");
  assert.equal(layout.authority.dimensionalAuthority, false);
  assert.equal(layout.authority.visualLayout, "user-supplied-running-topmodul-video-2026-08-18");
  assert.equal(layout.authority.synchronizationPitch, "user-measured-bottle-table-center-spacing-110mm");
  assert.equal(layout.authority.timingScrew, "video-observed-not-yet-modeled");
  assert.equal(layout.videoObservations.continuousBottlePopulationObserved, true);

  assert.equal(layout.entryAngleDegrees, 32);
  assert.equal(layout.exitAngleDegrees, 312);
  assert.equal(layout.transferGapDegrees, 80);
  assert.equal(layout.wheels.infeed.pocketCount, 10);
  assert.equal(layout.wheels.intermediate.pocketCount, 10);
  assert.equal(layout.wheels.discharge.pocketCount, 8);
  assert.ok(Math.abs(layout.wheels.infeed.pitchRadiusWorld - layout.wheels.intermediate.pitchRadiusWorld) < 1e-12);
  assert.ok(layout.wheels.discharge.pitchRadiusWorld < layout.wheels.infeed.pitchRadiusWorld);
  assert.ok(layout.wheels.discharge.videoRelativeWorkingDiameter < 0.85);
  assert.equal(layout.wheels.infeed.routeDirectionSign, -layout.wheels.intermediate.routeDirectionSign,
    "touching infeed/intermediate stars must counter-rotate through the bottle handoff");
});

test("video-backed wheel centers form a compact tangent transfer cluster", () => {
  const target = sandbox();
  const layout = target.Labeler3DBottleHandlingAdapter.buildLayout(geometry(), { carouselDirection: "ccw" });
  const infeed = layout.wheels.infeed;
  const intermediate = layout.wheels.intermediate;
  const discharge = layout.wheels.discharge;

  assert.ok(Math.abs(distance(infeed.center, intermediate.center) - (infeed.pitchRadiusWorld + intermediate.pitchRadiusWorld)) < 1e-9,
    "infeed and intermediate pitch circles must remain tangent");
  assert.ok(distance(intermediate.center, { x: 0, z: 0 }) > layout.carouselRadius,
    "intermediate wheel belongs outside the carousel and transfers inward to the bottle tables");
  assert.ok(distance(discharge.center, { x: 0, z: 0 }) > layout.carouselRadius,
    "discharge wheel belongs outside the carousel at release");
});

test("video refinement preserves continuous bottle ownership and carousel servo authority", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const handling = adapter.snapshot(127.3, geometry(), { carouselDirection: "ccw" });
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
  assert.equal(handling.carouselServoAuthority, "ServoForge replay frame at each occupied bottle-table angle");
  assert.ok(handling.bottles.some((bottle) => bottle.owner === "infeed-star"));
  assert.ok(handling.bottles.some((bottle) => bottle.owner === "intermediate-star"));
  assert.ok(handling.bottles.some((bottle) => bottle.owner === "carousel"));
  assert.ok(handling.bottles.some((bottle) => bottle.owner === "discharge-star"));

  const epsilon = 1e-7;
  handling.layout.segments.slice(0, -1).forEach((segment) => {
    const before = adapter.pointAtPitch(handling.layout, Math.max(0, segment.endPitch - epsilon));
    const after = adapter.pointAtPitch(handling.layout, Math.min(handling.layout.totalPitchLength, segment.endPitch + epsilon));
    assert.ok(distance(before.position, after.position) < 1e-5, `${segment.owner} handoff must remain position-continuous`);
  });
});

test("video-reference layer remains presentation-only", () => {
  assert.match(videoSource, /timingScrewObserved:\s*true/);
  assert.match(videoSource, /approximately-similar/);
  assert.match(videoSource, /visibly-smaller/);
  assert.match(videoSource, /provisional-video-cadence-not-measured/);
  [
    /saveCurrentSettings\s*\(/,
    /state\.program\s*=/,
    /setServoAngleOverride\s*\(/,
    /simulation\.lines\s*=/
  ].forEach((pattern) => assert.doesNotMatch(videoSource, pattern, `video reference must remain read-only: ${pattern}`));
});
