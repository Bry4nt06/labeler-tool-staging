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
  "app/3d/bottle-handling-dead-zone-anchor-integration.js"
].map(read);
const presentationSource = read("app/3d/bottle-handling-pocket-phase-presentation-integration.js");

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
  sources.forEach((source, index) => vm.runInContext(source, target, { filename: `handling-${index}.js` }));
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

function polar(from, to) {
  return Math.atan2(Number(to?.z) - Number(from?.z), Number(to?.x) - Number(from?.x));
}

test("bootstrap loads dead-zone anchors before viewport and phase bridge after viewport", () => {
  const photoIndex = bootstrap.indexOf('"app/3d/bottle-handling-photo-layout-integration.js"');
  const anchorIndex = bootstrap.indexOf('"app/3d/bottle-handling-dead-zone-anchor-integration.js"');
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  const phaseIndex = bootstrap.indexOf('"app/3d/bottle-handling-pocket-phase-presentation-integration.js"');
  assert.ok(photoIndex >= 0);
  assert.ok(anchorIndex > photoIndex);
  assert.ok(viewportIndex > anchorIndex);
  assert.ok(phaseIndex > viewportIndex);
});

test("carousel handling contacts are exactly the machine-map 30 and 330 degree boundaries", () => {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const layout = adapter.buildLayout(geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 0 });

  assert.equal(adapter.ENTRY_TRANSFER_ANGLE_DEGREES, 30);
  assert.equal(adapter.DISCHARGE_TRANSFER_ANGLE_DEGREES, 330);
  assert.equal(layout.entryAngleDegrees, 30);
  assert.equal(layout.exitAngleDegrees, 330);
  assert.equal(layout.transferGapDegrees, 60);
  assert.equal(layout.deadZoneTransferAnchors.exactMachineMapBoundaryAuthority, true);
  assert.equal(layout.deadZoneTransferAnchors.pocketCentersPhaseLocked, true);

  const expectedEntry = target.Labeler3DSceneAdapter.machineOrbit(30, {
    carouselRadius: layout.carouselRadius,
    carouselDirection: layout.carouselDirection,
    zeroAngleDegrees: layout.zeroAngleDegrees
  });
  const expectedDischarge = target.Labeler3DSceneAdapter.machineOrbit(330, {
    carouselRadius: layout.carouselRadius,
    carouselDirection: layout.carouselDirection,
    zeroAngleDegrees: layout.zeroAngleDegrees
  });

  assert.ok(distance(layout.wheels.intermediate.carouselTransferContact, expectedEntry) < 1e-10);
  assert.ok(distance(layout.wheels.discharge.carouselTransferContact, expectedDischarge) < 1e-10);
});

test("intermediate and discharge pocket centers are phase-locked to their carousel contacts", () => {
  const target = sandbox();
  const layout = target.Labeler3DBottleHandlingAdapter.buildLayout(geometry(), { carouselDirection: "ccw" });

  [
    ["intermediate", 30],
    ["discharge", 330]
  ].forEach(([key, angle]) => {
    const wheel = layout.wheels[key];
    const phase = (angle / layout.headPitchDegrees) - Math.floor(angle / layout.headPitchDegrees);
    const worldPocketAngle = wheel.referencePocketAngleRadians
      + wheel.routeDirectionSign * phase * wheel.pocketPitchRadians;
    const contactPolar = polar(wheel.center, wheel.carouselTransferContact);
    assert.ok(Math.abs(worldPocketAngle - contactPolar) < 1e-10, `${key} pocket must center on the ${angle} degree transfer contact`);
  });
});

test("phase presentation bridge applies adapter phase references and exposes transfer markers", () => {
  assert.match(presentationSource, /referencePocketAngleRadians/);
  assert.match(presentationSource, /ServoForgeEntryTransfer30DegreeMarker/);
  assert.match(presentationSource, /ServoForgeDischargeTransfer330DegreeMarker/);
  assert.match(presentationSource, /entryTransferAngleDegrees:\s*30/);
  assert.match(presentationSource, /dischargeTransferAngleDegrees:\s*330/);
});

test("dead-zone anchor layer remains read-only", () => {
  const source = sources[sources.length - 1];
  [
    /saveCurrentSettings\s*\(/,
    /state\.program\s*=/,
    /setServoAngleOverride\s*\(/,
    /simulation\.lines\s*=/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
