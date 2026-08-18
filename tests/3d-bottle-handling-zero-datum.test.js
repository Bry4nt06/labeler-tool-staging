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
  vm.runInContext(zeroSource, target, { filename: "app/3d/bottle-handling-zero-datum-integration.js" });
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

test("bootstrap applies user zero datum after video reference and before bottle handling viewport", () => {
  const videoIndex = bootstrap.indexOf('"app/3d/bottle-handling-video-reference-integration.js"');
  const zeroIndex = bootstrap.indexOf('"app/3d/bottle-handling-zero-datum-integration.js"');
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  assert.ok(videoIndex >= 0, "video reference must load");
  assert.ok(zeroIndex > videoIndex, "zero datum must refine the video-backed layout");
  assert.ok(viewportIndex > zeroIndex, "viewport must consume the zero-anchored layout");
});

test("user-marked red line is the authoritative 0 degree radial datum", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const handling = adapter.snapshot(110, geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });
  const datum = handling.layout.zeroDatum;

  assert.equal(adapter.zeroDatumAnchored, true);
  assert.equal(adapter.ZERO_DATUM_SOURCE, "user-marked-labeler-zero-photo-2026-08-18");
  assert.equal(datum.machineAngleDegrees, 0);
  assert.equal(datum.angularAuthority, true);
  assert.equal(datum.physicalMeaning, "labeler-machine-zero-radial-datum");
  assert.equal(datum.entryOffsetDegrees, 32);
  assert.equal(datum.exitOffsetDegrees, -48);
  assert.equal(datum.transferGapCrossesZero, true);
  assert.equal(datum.intermediateSide, "positive-angle-side");
  assert.equal(datum.dischargeSide, "negative-angle-side");
  assert.equal(handling.layout.authority.zeroDatum, "user-marked-machine-photo-authoritative-angular-datum");
  assert.equal(handling.layout.authority.transferOffsetsFromZero, "video-referenced-provisional-until-measured");
});

test("zero datum rotates with ServoForge map zero without changing machine-angle offsets", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const base = adapter.buildLayout(geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });
  const rotated = adapter.buildLayout(geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 90 });

  assert.equal(base.zeroDatum.entryOffsetDegrees, rotated.zeroDatum.entryOffsetDegrees);
  assert.equal(base.zeroDatum.exitOffsetDegrees, rotated.zeroDatum.exitOffsetDegrees);
  assert.ok(Math.abs(base.zeroDatum.radialDirection.x - 1) < 1e-12);
  assert.ok(Math.abs(base.zeroDatum.radialDirection.z) < 1e-12);
  assert.ok(Math.abs(rotated.zeroDatum.radialDirection.x) < 1e-12);
  assert.ok(Math.abs(rotated.zeroDatum.radialDirection.z - 1) < 1e-12);
});

test("zero datum layer remains read-only", () => {
  assert.match(zeroSource, /user-marked-labeler-zero-photo-2026-08-18/);
  assert.match(zeroSource, /labeler-machine-zero-radial-datum/);
  assert.match(zeroSource, /transferGapCrossesZero/);
  [
    /saveCurrentSettings\s*\(/,
    /state\.program\s*=/,
    /setServoAngleOverride\s*\(/,
    /simulation\.lines\s*=/
  ].forEach((pattern) => assert.doesNotMatch(zeroSource, pattern, `zero datum integration must remain read-only: ${pattern}`));
});
