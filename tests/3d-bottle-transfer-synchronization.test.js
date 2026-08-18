"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const source = read("app/3d/bottle-handling-transfer-synchronization-integration.js");
const bootstrap = read("app/bootstrap.js");

function normalizeAngle(value) {
  const normalized = Number(value || 0) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function fraction(value) {
  return ((Number(value || 0) % 1) + 1) % 1;
}

function machineOrbit(angleDegrees, options = {}) {
  const direction = String(options.carouselDirection || "ccw");
  const signed = direction === "cw" ? -1 : 1;
  const zeroBase = direction === "cw" ? 180 : 0;
  const bearing = normalizeAngle(zeroBase + Number(options.zeroAngleDegrees || 0) + signed * Number(angleDegrees || 0));
  const radians = bearing * Math.PI / 180;
  const radius = Number(options.carouselRadius || 3);
  return {
    x: Math.cos(radians) * radius,
    z: Math.sin(radians) * radius,
    radians,
    threeRotationY: -radians
  };
}

function nearestCarouselHead(tableAngleDegrees, machineAngleDegrees, layout) {
  let best = null;
  for (let index = 0; index < layout.headCount; index += 1) {
    const candidateAngle = normalizeAngle(machineAngleDegrees - index * layout.headPitchDegrees);
    let delta = candidateAngle - normalizeAngle(tableAngleDegrees);
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    const errorDegrees = Math.abs(delta);
    if (!best || errorDegrees < best.errorDegrees) {
      best = { head: index + 1, tableAngleDegrees: candidateAngle, errorDegrees };
    }
  }
  return best;
}

function makeLayout(direction) {
  const carouselRadius = 3;
  const headCount = 45;
  const headPitchDegrees = 8;
  const entryAngleDegrees = 30;
  const exitAngleDegrees = 330;
  const entry = machineOrbit(entryAngleDegrees, { carouselRadius, carouselDirection: direction });
  const discharge = machineOrbit(exitAngleDegrees, { carouselRadius, carouselDirection: direction });
  return {
    headCount,
    headPitchDegrees,
    carouselRadius,
    carouselDirection: direction,
    zeroAngleDegrees: 0,
    entryAngleDegrees,
    exitAngleDegrees,
    totalPitchLength: 44.5,
    segments: [
      { owner: "intermediate-star", type: "star-arc", startPitch: 4, endPitch: 5.35 },
      {
        owner: "carousel",
        type: "carousel-arc",
        startPitch: 5.35,
        endPitch: 42.85,
        startAngleDegrees: entryAngleDegrees,
        endAngleDegrees: exitAngleDegrees,
        spanDegrees: 300
      },
      { owner: "discharge-star", type: "star-arc", startPitch: 42.85, endPitch: 44.5 }
    ],
    wheels: {
      intermediate: { carouselTransferContact: { x: entry.x, z: entry.z } },
      discharge: { carouselTransferContact: { x: discharge.x, z: discharge.z } }
    }
  };
}

function pointAtPitch(layout, pitchDistance) {
  const d = Number(pitchDistance);
  const entry = layout.wheels.intermediate.carouselTransferContact;
  const discharge = layout.wheels.discharge.carouselTransferContact;
  if (d <= 5.35) {
    const t = Math.max(0, Math.min(1, (d - 4) / 1.35));
    return {
      owner: "intermediate-star",
      segmentId: "intermediate-star",
      pitchDistance: d,
      position: { x: entry.x - (1 - t) * 0.5, z: entry.z },
      routeRotationY: 0,
      tableAngleDegrees: null
    };
  }
  if (d <= 42.85) {
    const tableAngleDegrees = 30 + (d - 5.35) * 8;
    const orbit = machineOrbit(tableAngleDegrees, {
      carouselRadius: layout.carouselRadius,
      carouselDirection: layout.carouselDirection,
      zeroAngleDegrees: layout.zeroAngleDegrees
    });
    return {
      owner: "carousel",
      segmentId: "carousel",
      pitchDistance: d,
      tableAngleDegrees,
      position: { x: orbit.x, z: orbit.z },
      routeRotationY: orbit.threeRotationY
    };
  }
  const t = Math.max(0, Math.min(1, (d - 42.85) / 1.65));
  return {
    owner: "discharge-star",
    segmentId: "discharge-star",
    pitchDistance: d,
    position: { x: discharge.x + t * 0.5, z: discharge.z },
    routeRotationY: 0,
    tableAngleDegrees: null
  };
}

function sandbox(direction) {
  const target = { window: {}, console, Math, Object, Array, Number, String, Boolean };
  target.window = target;
  target.Labeler3DSceneAdapter = Object.freeze({ machineOrbit });
  target.Labeler3DBottleHandlingAdapter = Object.freeze({
    buildLayout() {
      return makeLayout(direction);
    },
    pointAtPitch(layout, pitchDistance) {
      return pointAtPitch(layout, pitchDistance);
    },
    nearestCarouselHead,
    snapshot(machineAngleDegrees) {
      const layout = makeLayout(direction);
      return {
        schemaVersion: "base",
        machineAngleDegrees: normalizeAngle(machineAngleDegrees),
        feedPhasePitch: fraction(normalizeAngle(machineAngleDegrees) / layout.headPitchDegrees),
        layout,
        wheels: {},
        bottles: []
      };
    }
  });
  vm.createContext(target);
  vm.runInContext(source, target, { filename: "bottle-handling-transfer-synchronization-integration.js" });
  return target;
}

function distance(a, b) {
  return Math.hypot(Number(a.x) - Number(b.x), Number(a.z) - Number(b.z));
}

function bottleBySlot(snapshot, slot) {
  return snapshot.bottles.find((bottle) => bottle.slot === slot);
}

function assertTransferContinuity(direction) {
  const target = sandbox(direction);
  const adapter = target.Labeler3DBottleHandlingAdapter;
  const layout = adapter.buildLayout({}, { carouselDirection: direction });

  assert.equal(adapter.transferSynchronizationV1, true);
  assert.ok(Math.abs(adapter.routePhaseOffsetPitch(layout) - 0.6) < 1e-12);

  const epsilon = 0.0001;
  const entryBefore = adapter.snapshot(30 - epsilon, {}, { carouselDirection: direction });
  const entryAfter = adapter.snapshot(30 + epsilon, {}, { carouselDirection: direction });
  const beforeBottle = bottleBySlot(entryBefore, 5);
  const afterBottle = bottleBySlot(entryAfter, 5);
  assert.equal(beforeBottle.owner, "intermediate-star");
  assert.equal(afterBottle.owner, "carousel");
  assert.ok(distance(beforeBottle.position, afterBottle.position) < 0.001, "entry handoff must be position-continuous");
  assert.equal(afterBottle.transferPhaseLocked, true);

  const dischargeBefore = adapter.snapshot(330 - epsilon, {}, { carouselDirection: direction });
  const dischargeAfter = adapter.snapshot(330 + epsilon, {}, { carouselDirection: direction });
  const dischargeBeforeBottle = bottleBySlot(dischargeBefore, 42);
  const dischargeAfterBottle = bottleBySlot(dischargeAfter, 42);
  assert.equal(dischargeBeforeBottle.owner, "carousel");
  assert.equal(dischargeAfterBottle.owner, "discharge-star");
  assert.ok(distance(dischargeBeforeBottle.position, dischargeAfterBottle.position) < 0.001, "discharge handoff must be position-continuous");

  assert.equal(entryAfter.transferSynchronization.phaseLocked, true);
  assert.equal(entryAfter.transferSynchronization.snapCompensation, false);
  assert.equal(entryAfter.transferSynchronization.interpolationCompensation, false);
}

test("bootstrap loads transfer synchronization after table centering and before viewport rendering", () => {
  const centerIndex = bootstrap.indexOf('"app/3d/bottle-handling-carousel-table-center-integration.js"');
  const syncIndex = bootstrap.indexOf('"app/3d/bottle-handling-transfer-synchronization-integration.js"');
  const viewportIndex = bootstrap.indexOf('"app/3d/bottle-handling-viewport-integration.js"');
  assert.ok(syncIndex > centerIndex);
  assert.ok(viewportIndex > syncIndex);
});

test("CCW star-wheel to bottle-table transfers are phase-locked and continuous", () => {
  assertTransferContinuity("ccw");
});

test("CW star-wheel to bottle-table transfers are phase-locked and continuous", () => {
  assertTransferContinuity("cw");
});

test("transfer synchronization remains read-only and does not hide mismatch with interpolation", () => {
  assert.match(source, /shared-star-pocket-and-live-carousel-head-transfer-phase/);
  assert.match(source, /snapCompensation:\s*false/);
  assert.match(source, /interpolationCompensation:\s*false/);
  [
    /state\.program\s*=/,
    /saveCurrentSettings\s*\(/,
    /setServoAngleOverride\s*\(/,
    /simulation\.lines\s*=/,
    /buildPlannerMotion\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
