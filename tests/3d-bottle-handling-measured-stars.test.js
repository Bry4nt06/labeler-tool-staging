"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const presentationSource = read("app/3d/bottle-handling-measured-star-presentation-integration.js");
const sources = [
  "app/3d/bottle-handling-adapter.js",
  "app/3d/bottle-handling-video-reference-integration.js",
  "app/3d/bottle-handling-zero-datum-integration.js",
  "app/3d/bottle-handling-photo-layout-integration.js",
  "app/3d/bottle-handling-dead-zone-anchor-integration.js",
  "app/3d/bottle-handling-16-pocket-integration.js",
  "app/3d/bottle-handling-measured-star-layout-integration.js"
].map(read);

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
      const radius = Number(options.carouselRadius) || 1;
      return { x: Math.cos(radians) * radius, z: Math.sin(radians) * radius, bearingDegrees, radians, threeRotationY: -radians };
    }
  });
  vm.createContext(target);
  sources.forEach((source, index) => vm.runInContext(source, target, { filename: `measured-star-layer-${index}.js` }));
  return target;
}

function geometry() {
  const unitsPerMm = 2.55 / 572.958;
  const centerSpacingMm = 110;
  const headCount = 45;
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

test("bootstrap loads measured star layout before direction authority and presentation after viewport", () => {
  const measuredLayout = bootstrap.indexOf('"app/3d/bottle-handling-measured-star-layout-integration.js"');
  const directionAuthority = bootstrap.indexOf('"app/3d/bottle-handling-direction-authority-integration.js"');
  const viewport = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  const measuredPresentation = bootstrap.indexOf('"app/3d/bottle-handling-measured-star-presentation-integration.js"');
  assert.ok(measuredLayout > 0 && measuredLayout < directionAuthority);
  assert.ok(measuredPresentation > viewport);
});

test("all three 16-pocket stars preserve the derived pitch circle but render at measured 600mm outer diameter", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const layout = adapter.buildLayout(geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });
  const expectedPitchRadiusMm = 110 / (2 * Math.sin(Math.PI / 16));

  assert.equal(adapter.measuredStarGeometryV1, true);
  assert.equal(layout.schemaVersion, "servoforge.3d-bottle-handling.v6-measured-stars");
  assert.equal(layout.measuredStarGeometry.outerDiameterMm, 600);
  assert.ok(Math.abs(layout.measuredStarGeometry.pitchRadiusMm - expectedPitchRadiusMm) < 1e-9);
  assert.ok(Math.abs(layout.measuredStarGeometry.pitchDiameterMm - expectedPitchRadiusMm * 2) < 1e-9);

  Object.values(layout.wheels).forEach((wheel) => {
    assert.equal(wheel.pocketCount, 16);
    assert.equal(wheel.outerDiameterMm, 600);
    assert.ok(Math.abs(wheel.pitchRadiusMm - expectedPitchRadiusMm) < 1e-9);
  });
});

test("intermediate and discharge stars maintain measured 200mm clear gap and 800mm center spacing", () => {
  const target = sandbox();
  const layout = target.Labeler3DBottleHandlingAdapter.buildLayout(geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });
  const unitsPerMm = geometry().renderScale.worldUnitsPerMm;
  const centerDistanceMm = distance(layout.wheels.intermediate.center, layout.wheels.discharge.center) / unitsPerMm;
  const clearGapMm = centerDistanceMm - 600;

  assert.ok(Math.abs(centerDistanceMm - 800) < 1e-7);
  assert.ok(Math.abs(clearGapMm - 200) < 1e-7);
  assert.ok(Math.abs(layout.measuredStarGeometry.renderedCenterDistanceMm - 800) < 1e-7);
  assert.ok(Math.abs(layout.measuredStarGeometry.renderedClearGapMm - 200) < 1e-7);
});

test("measured center spacing still preserves exact 30 and 330 degree pitch-circle handoffs", () => {
  const target = sandbox();
  const layout = target.Labeler3DBottleHandlingAdapter.buildLayout(geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });
  const intermediate = layout.wheels.intermediate;
  const discharge = layout.wheels.discharge;

  assert.equal(intermediate.carouselTransferAngleDegrees, 30);
  assert.equal(discharge.carouselTransferAngleDegrees, 330);
  assert.ok(Math.abs(distance(intermediate.center, intermediate.carouselTransferContact) - intermediate.pitchRadiusWorld) < 1e-8);
  assert.ok(Math.abs(distance(discharge.center, discharge.carouselTransferContact) - discharge.pitchRadiusWorld) < 1e-8);
});

test("measured star dimensions are direction invariant for CW and CCW", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const ccw = adapter.buildLayout(geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });
  const cw = adapter.buildLayout(geometry(), { carouselDirection: "cw", zeroAngleDegrees: 0 });

  [ccw, cw].forEach((layout) => {
    assert.equal(layout.measuredStarGeometry.outerDiameterMm, 600);
    assert.ok(Math.abs(layout.measuredStarGeometry.renderedCenterDistanceMm - 800) < 1e-7);
    assert.ok(Math.abs(layout.measuredStarGeometry.renderedClearGapMm - 200) < 1e-7);
  });
});

test("measured presentation scales only the visible star plate to the 600mm outer-radius authority", () => {
  assert.match(presentationSource, /measuredOuterDiameterMm/);
  assert.match(presentationSource, /targetRadius \/ nominalRadius/);
  assert.match(presentationSource, /plate\.scale\.x = scaleFactor/);
  assert.match(presentationSource, /plate\.scale\.z = scaleFactor/);
  assert.match(presentationSource, /user-measured-600mm-end-to-end/);
});
