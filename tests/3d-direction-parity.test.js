"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const presentationSource = read("app/3d/three-d-direction-parity-presentation-integration.js");

const handlingLayers = [
  "app/3d/bottle-handling-adapter.js",
  "app/3d/bottle-handling-video-reference-integration.js",
  "app/3d/bottle-handling-zero-datum-integration.js",
  "app/3d/bottle-handling-photo-layout-integration.js",
  "app/3d/bottle-handling-dead-zone-anchor-integration.js",
  "app/3d/bottle-handling-16-pocket-integration.js",
  "app/3d/bottle-handling-direction-authority-integration.js"
].map(read);

function sandbox(direction) {
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
    Map,
    state: { direction, zeroAngle: 0 }
  };
  target.window = target;
  target.globalThis = target;
  target.Labeler3DSceneAdapter = Object.freeze({
    machineOrbit(angleDegrees, options = {}) {
      const angle = Number(angleDegrees) || 0;
      const radius = Number(options.carouselRadius) || 1;
      const normalized = String(options.carouselDirection || "ccw").toLowerCase();
      const clockwise = normalized === "cw" || normalized === "clockwise";
      const signed = clockwise ? -1 : 1;
      const zeroBase = clockwise ? 180 : 0;
      const bearing = zeroBase + (Number(options.zeroAngleDegrees) || 0) + signed * angle;
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
  handlingLayers.forEach((source, index) => vm.runInContext(source, target, { filename: `direction-layer-${index}.js` }));
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

test("bootstrap loads direction authority after 16-pocket geometry and presentation sync after viewport phase logic", () => {
  const sixteenIndex = bootstrap.indexOf('"app/3d/bottle-handling-16-pocket-integration.js"');
  const authorityIndex = bootstrap.indexOf('"app/3d/bottle-handling-direction-authority-integration.js"');
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  const phaseIndex = bootstrap.indexOf('"app/3d/bottle-handling-pocket-phase-presentation-integration.js"');
  const parityIndex = bootstrap.indexOf('"app/3d/three-d-direction-parity-presentation-integration.js"');
  const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(authorityIndex > sixteenIndex);
  assert.ok(viewportIndex > authorityIndex);
  assert.ok(parityIndex > phaseIndex);
  assert.ok(runtimeIndex > parityIndex);
});

test("authoritative application state overrides stale window-style direction options for both CW and CCW", () => {
  const cw = sandbox("cw");
  const cwAdapter = cw.Labeler3DBottleHandlingAdapter;
  const cwLayout = cwAdapter.buildLayout(geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 99 });
  const cwSnapshot = cwAdapter.snapshot(120, geometry(), { carouselDirection: "ccw", zeroAngleDegrees: 99 });
  assert.equal(cwAdapter.directionAuthorityV1, true);
  assert.equal(cwLayout.carouselDirection, "cw");
  assert.equal(cwSnapshot.carouselDirection, "cw");
  assert.equal(cwLayout.zeroAngleDegrees, 0);
  assert.equal(cwSnapshot.directionParityEnabled, true);

  const ccw = sandbox("ccw");
  const ccwAdapter = ccw.Labeler3DBottleHandlingAdapter;
  const ccwLayout = ccwAdapter.buildLayout(geometry(), { carouselDirection: "cw", zeroAngleDegrees: 99 });
  const ccwSnapshot = ccwAdapter.snapshot(120, geometry(), { carouselDirection: "cw", zeroAngleDegrees: 99 });
  assert.equal(ccwLayout.carouselDirection, "ccw");
  assert.equal(ccwSnapshot.carouselDirection, "ccw");
  assert.equal(ccwLayout.zeroAngleDegrees, 0);

  assert.ok(distance(cwLayout.wheels.intermediate.center, ccwLayout.wheels.intermediate.center) > 0.5,
    "changing machine direction must reposition the handling cluster, not only bottle orientation");
  assert.ok(distance(cwLayout.wheels.discharge.center, ccwLayout.wheels.discharge.center) > 0.5,
    "discharge handling geometry must follow machine direction");
});

test("CW and CCW keep the confirmed 16-pocket set and 30/330 transfer anchors", () => {
  ["cw", "ccw"].forEach((direction) => {
    const target = sandbox(direction);
    const layout = target.Labeler3DBottleHandlingAdapter.buildLayout(geometry());
    assert.equal(layout.entryAngleDegrees, 30);
    assert.equal(layout.exitAngleDegrees, 330);
    assert.equal(layout.wheels.infeed.pocketCount, 16);
    assert.equal(layout.wheels.intermediate.pocketCount, 16);
    assert.equal(layout.wheels.discharge.pocketCount, 16);
    assert.equal(layout.directionAuthority.carouselDirection, direction);
  });
});

test("direction presentation synchronizes stars conveyors bottle tables and carousel top", () => {
  assert.match(presentationSource, /typeof state !== "undefined"/);
  assert.match(presentationSource, /ServoForgeBottleTablePopulation/);
  assert.match(presentationSource, /group\.position\.x = number\(wheel\.center\?\.x\)/);
  assert.match(presentationSource, /group\.rotation\.y = -worldPocketAngle/);
  assert.match(presentationSource, /ServoForgeInfeedConveyor/);
  assert.match(presentationSource, /ServoForgeOutfeedConveyor/);
  assert.match(presentationSource, /group\.rotation\.y = Math\.atan2\(-dz, dx\)/);
  assert.match(presentationSource, /carouselTop\.rotation\.y = mechanicalRotationY/);
  assert.match(presentationSource, /assembly\.position\.set/);
  assert.match(presentationSource, /ServoForgeCarouselTopDirectionReference/);
});

test("direction parity remains read-only", () => {
  const authoritySource = read("app/3d/bottle-handling-direction-authority-integration.js");
  [authoritySource, presentationSource].forEach((source) => {
    [
      /state\.program\s*=/,
      /state\.direction\s*=/,
      /saveCurrentSettings\s*\(/,
      /setServoAngleOverride\s*\(/,
      /simulation\.lines\s*=/
    ].forEach((pattern) => assert.doesNotMatch(source, pattern));
  });
});
