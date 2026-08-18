"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const source = read("app/3d/bottle-handling-carousel-table-center-integration.js");
const bootstrap = read("app/bootstrap.js");

function machineOrbit(angleDegrees, options = {}) {
  const direction = String(options.carouselDirection || "ccw");
  const signed = direction === "cw" ? -1 : 1;
  const zeroBase = direction === "cw" ? 180 : 0;
  const bearing = ((zeroBase + (Number(options.zeroAngleDegrees) || 0) + signed * Number(angleDegrees)) % 360 + 360) % 360;
  const radians = bearing * Math.PI / 180;
  const radius = Number(options.carouselRadius) || 3;
  return {
    x: Math.cos(radians) * radius,
    z: Math.sin(radians) * radius,
    bearingDegrees: bearing,
    radians,
    threeRotationY: -radians
  };
}

function sandbox() {
  const target = { window: {}, console, Math, Object, Array, Number, String, Boolean };
  target.window = target;
  target.Labeler3DSceneAdapter = Object.freeze({ machineOrbit });
  target.Labeler3DBottleHandlingAdapter = Object.freeze({
    buildLayout(_geometry, options = {}) {
      return {
        headCount: 45,
        headPitchDegrees: 8,
        carouselRadius: 3,
        carouselDirection: options.carouselDirection || "ccw",
        zeroAngleDegrees: Number(options.zeroAngleDegrees) || 0
      };
    },
    pointAtPitch(_layout, pitchDistance) {
      return { pitchDistance };
    },
    snapshot(machineAngleDegrees, _geometry, options = {}) {
      const layout = this.buildLayout(null, options);
      return {
        machineAngleDegrees: Number(machineAngleDegrees),
        layout,
        bottles: [
          {
            id: "carousel-a",
            owner: "carousel",
            segmentId: "carousel",
            tableAngleDegrees: 65.6,
            position: { x: 99, z: 99 },
            routeRotationY: 0
          },
          {
            id: "carousel-b",
            owner: "carousel",
            segmentId: "carousel",
            tableAngleDegrees: 57.6,
            position: { x: 98, z: 98 },
            routeRotationY: 0
          },
          {
            id: "infeed-a",
            owner: "infeed-star",
            segmentId: "infeed-star",
            tableAngleDegrees: null,
            position: { x: 4.25, z: -1.5 },
            routeRotationY: 1.25
          }
        ]
      };
    }
  });
  vm.createContext(target);
  vm.runInContext(source, target, { filename: "bottle-handling-carousel-table-center-integration.js" });
  return target;
}

function assertCentered(direction) {
  const target = sandbox();
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const result = adapter.snapshot(67.2, {}, { carouselDirection: direction, zeroAngleDegrees: 0 });
  const first = result.bottles[0];
  const second = result.bottles[1];
  const infeed = result.bottles[2];

  assert.equal(adapter.carouselBottleTableCenteringV1, true);
  assert.equal(result.carouselBottleTableCenteringEnabled, true);
  assert.equal(result.carouselBottleCentering.centeredBottleCount, 2);

  assert.equal(first.tableAngleDegrees, 67.2);
  assert.equal(first.carrierHead, 1);
  assert.equal(second.tableAngleDegrees, 59.2);
  assert.equal(second.carrierHead, 2);
  assert.equal(first.centeredOnBottleTable, true);
  assert.equal(first.carrierCenterAuthority, "servoforge-live-carousel-head-lattice");

  const expectedFirst = machineOrbit(67.2, {
    carouselRadius: 3,
    carouselDirection: direction,
    zeroAngleDegrees: 0
  });
  const expectedSecond = machineOrbit(59.2, {
    carouselRadius: 3,
    carouselDirection: direction,
    zeroAngleDegrees: 0
  });
  assert.ok(Math.abs(first.position.x - expectedFirst.x) < 1e-12);
  assert.ok(Math.abs(first.position.z - expectedFirst.z) < 1e-12);
  assert.ok(Math.abs(second.position.x - expectedSecond.x) < 1e-12);
  assert.ok(Math.abs(second.position.z - expectedSecond.z) < 1e-12);

  assert.deepEqual(
    JSON.parse(JSON.stringify(infeed.position)),
    { x: 4.25, z: -1.5 },
    "non-carousel handling positions must remain untouched"
  );
  assert.equal(infeed.centeredOnBottleTable, undefined);

  return first.position;
}

test("bootstrap centers carousel bottles after direction authority and before viewport rendering", () => {
  const directionIndex = bootstrap.indexOf('"app/3d/bottle-handling-direction-authority-integration.js"');
  const centerIndex = bootstrap.indexOf('"app/3d/bottle-handling-carousel-table-center-integration.js"');
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  assert.ok(centerIndex > directionIndex);
  assert.ok(viewportIndex > centerIndex);
});

test("CCW carousel-owned bottles are centered on the live table lattice", () => {
  assertCentered("ccw");
});

test("CW carousel-owned bottles are centered on the mirrored live table lattice", () => {
  const ccw = assertCentered("ccw");
  const cw = assertCentered("cw");
  assert.notEqual(cw.x, ccw.x);
  assert.notEqual(cw.z, ccw.z);
});

test("centering preserves route diagnostics but replaces the servo table angle with the carrier table angle", () => {
  assert.match(source, /routeTableAngleDegrees/);
  assert.match(source, /routePosition/);
  assert.match(source, /servoReplayUsesCenteredTableAngle:\s*true/);
  assert.match(source, /appliesTo:\s*"carousel-owned-bottles-only"/);
  assert.match(source, /starPocketAndConveyorPathsUntouched:\s*true/);
});

test("centering integration remains read-only", () => {
  [
    /state\.program\s*=/,
    /saveCurrentSettings\s*\(/,
    /setServoAngleOverride\s*\(/,
    /simulation\.lines\s*=/,
    /buildPlannerMotion\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
