(function installServoForge3DBottleHandlingZeroPositionAuthority(global) {
  "use strict";

  const base = global.Labeler3DBottleHandlingAdapter;
  const sceneAdapter = global.Labeler3DSceneAdapter;
  if (!base?.buildLayout || !base?.pointAtPitch || !base?.snapshot || !sceneAdapter?.machineOrbit) return;

  const PATCH_VERSION = "servoforge.3d-bottle-handling-zero-position.v1";
  const AUTHORITY_SOURCE = "user-confirmed-machine-zero-position-2026-08-31";
  const ENTRY_TRANSFER_ANGLE_DEGREES = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeAngle(value) {
    const normalized = number(value, 0) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function subtract(a, b) {
    return { x: number(a?.x) - number(b?.x), z: number(a?.z) - number(b?.z) };
  }

  function unit(vector) {
    const magnitude = Math.hypot(number(vector?.x), number(vector?.z)) || 1;
    return { x: number(vector?.x) / magnitude, z: number(vector?.z) / magnitude };
  }

  function routeRotationY(direction) {
    const tangent = unit(direction);
    return Math.atan2(-tangent.z, tangent.x);
  }

  function rotatePoint(point, deltaRadians) {
    if (!point) return point;
    const cosine = Math.cos(deltaRadians);
    const sine = Math.sin(deltaRadians);
    const x = number(point.x);
    const z = number(point.z);
    return {
      ...point,
      x: x * cosine - z * sine,
      z: x * sine + z * cosine
    };
  }

  function signedOffsetFromZero(angleDegrees) {
    const normalized = normalizeAngle(angleDegrees);
    return normalized > 180 ? normalized - 360 : normalized;
  }

  function rotationToZero(layout) {
    const entryAngle = number(layout?.entryAngleDegrees, 0);
    const orbitOptions = {
      carouselRadius: number(layout?.carouselRadius, 1),
      carouselDirection: String(layout?.carouselDirection || "ccw"),
      zeroAngleDegrees: number(layout?.zeroAngleDegrees, 0)
    };
    const current = sceneAdapter.machineOrbit(entryAngle, orbitOptions);
    const target = sceneAdapter.machineOrbit(ENTRY_TRANSFER_ANGLE_DEGREES, orbitOptions);
    const currentRadians = Math.atan2(number(current?.z), number(current?.x));
    const targetRadians = Math.atan2(number(target?.z), number(target?.x));
    let delta = targetRadians - currentRadians;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  function transformSegment(segment, deltaRadians, entryAngleDegrees) {
    if (!segment) return segment;
    if (segment.type === "line") {
      const start = rotatePoint(segment.start, deltaRadians);
      const end = rotatePoint(segment.end, deltaRadians);
      return freeze({
        ...segment,
        start,
        end,
        routeRotationY: routeRotationY(subtract(end, start))
      });
    }
    if (segment.type === "star-arc") {
      return freeze({
        ...segment,
        center: rotatePoint(segment.center, deltaRadians),
        startRadians: number(segment.startRadians) + deltaRadians
      });
    }
    if (segment.type === "carousel-arc") {
      const span = Math.max(0, number(segment.spanDegrees, number(segment.endAngleDegrees) - number(segment.startAngleDegrees)));
      return freeze({
        ...segment,
        startAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
        endAngleDegrees: normalizeAngle(number(segment.endAngleDegrees) - entryAngleDegrees),
        spanDegrees: span
      });
    }
    return segment;
  }

  function transformWheel(wheel, deltaRadians, entryAngleDegrees) {
    if (!wheel) return wheel;
    const transformed = {
      ...wheel,
      center: rotatePoint(wheel.center, deltaRadians)
    };
    if (wheel.carouselTransferContact) {
      transformed.carouselTransferContact = rotatePoint(wheel.carouselTransferContact, deltaRadians);
    }
    if (Number.isFinite(Number(wheel.referencePocketAngleRadians))) {
      transformed.referencePocketAngleRadians = number(wheel.referencePocketAngleRadians) + deltaRadians;
    }
    if (Number.isFinite(Number(wheel.carouselTransferAngleDegrees))) {
      transformed.carouselTransferAngleDegrees = normalizeAngle(number(wheel.carouselTransferAngleDegrees) - entryAngleDegrees);
    }
    return freeze(transformed);
  }

  function buildLayout(geometry, options = {}) {
    const source = base.buildLayout(geometry, options);
    const originalEntryAngleDegrees = number(source.entryAngleDegrees, 0);
    const deltaRadians = rotationToZero(source);
    const exitAngleDegrees = normalizeAngle(number(source.exitAngleDegrees, 0) - originalEntryAngleDegrees);
    const segments = (source.segments || []).map((segment) => transformSegment(segment, deltaRadians, originalEntryAngleDegrees));
    const wheels = freeze(Object.fromEntries(
      Object.entries(source.wheels || {}).map(([key, wheel]) => [
        key,
        transformWheel(wheel, deltaRadians, originalEntryAngleDegrees)
      ])
    ));
    const zeroDatum = freeze({
      ...(source.zeroDatum || {}),
      machineAngleDegrees: 0,
      source: AUTHORITY_SOURCE,
      angularAuthority: true,
      physicalMeaning: "labeler-machine-zero-radial-datum-and-handling-entry-transfer",
      entryOffsetDegrees: 0,
      exitOffsetDegrees: signedOffsetFromZero(exitAngleDegrees),
      transferGapCrossesZero: true
    });

    return freeze({
      ...source,
      schemaVersion: "servoforge.3d-bottle-handling.v8-zero-position",
      patchVersion: PATCH_VERSION,
      entryAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
      exitAngleDegrees,
      transferGapDegrees: 360 - exitAngleDegrees,
      segments,
      wheels,
      zeroDatum,
      zeroPositionAuthority: {
        source: AUTHORITY_SOURCE,
        entryTransferAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
        dischargeTransferAngleDegrees: exitAngleDegrees,
        previousEntryTransferAngleDegrees: originalEntryAngleDegrees,
        appliedRigidRotationDegrees: deltaRadians * 180 / Math.PI,
        entireMeasuredHandlingAssemblyRotatedTogether: true,
        measuredStarSpacingPreserved: true,
        starPocketPhasePreserved: true,
        routeContinuityPreserved: true,
        legacyThirtyDegreeEntryRetired: true
      },
      deadZoneTransferAnchors: {
        ...(source.deadZoneTransferAnchors || {}),
        source: AUTHORITY_SOURCE,
        zeroAngleDegrees: 0,
        entryAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
        dischargeAngleDegrees: exitAngleDegrees,
        entrySignedOffsetFromZero: 0,
        dischargeSignedOffsetFromZero: signedOffsetFromZero(exitAngleDegrees),
        exactMachineMapBoundaryAuthority: false,
        supersededByZeroPositionAuthority: true
      },
      authority: {
        ...(source.authority || {}),
        zeroDatum: "user-confirmed-machine-zero-position",
        transferAngles: "measured-handling-layout-rigidly-aligned-to-machine-zero",
        legacyThirtyDegreeEntry: "retired",
        dimensionalAuthority: source.authority?.dimensionalAuthority || "partial-user-measured-handling-geometry"
      }
    });
  }

  function pointAtPitch(layout, pitchDistance) {
    return base.pointAtPitch(layout, pitchDistance);
  }

  function snapshot(machineAngleDegrees, geometry, options = {}) {
    const raw = base.snapshot(machineAngleDegrees, geometry, options);
    const layout = buildLayout(geometry, options);
    const normalizedMachineAngle = normalizeAngle(number(raw?.machineAngleDegrees, machineAngleDegrees));
    const headPitchDegrees = Math.max(0.000001, number(layout.headPitchDegrees, 1));
    const feedPitchAbsolute = normalizedMachineAngle / headPitchDegrees;
    const feedPhasePitch = feedPitchAbsolute - Math.floor(feedPitchAbsolute);
    const bottleCount = Math.ceil(number(layout.totalPitchLength, 0)) + 2;
    const bottles = [];

    for (let slot = 0; slot < bottleCount; slot += 1) {
      const pitchDistance = feedPhasePitch + slot;
      if (pitchDistance > number(layout.totalPitchLength, 0) + 1e-9) continue;
      bottles.push(freeze({
        id: `handling-bottle-${slot}`,
        slot,
        ...pointAtPitch(layout, pitchDistance)
      }));
    }

    const wheels = Object.fromEntries(Object.entries(layout.wheels || {}).map(([key, wheel]) => [key, freeze({
      ...wheel,
      rotationY: Number.isFinite(Number(raw?.wheels?.[key]?.rotationY))
        ? Number(raw.wheels[key].rotationY)
        : number(wheel.routeDirectionSign, 1) * feedPhasePitch * number(wheel.pocketPitchRadians, 0)
    })]));

    return freeze({
      ...raw,
      schemaVersion: layout.schemaVersion,
      patchVersion: PATCH_VERSION,
      layout,
      machineAngleDegrees: normalizedMachineAngle,
      feedPhasePitch,
      bottleCount: bottles.length,
      bottles,
      wheels,
      zeroDatum: layout.zeroDatum,
      zeroPositionAuthority: layout.zeroPositionAuthority,
      deadZoneTransferAnchors: layout.deadZoneTransferAnchors,
      readOnly: true
    });
  }

  global.Labeler3DBottleHandlingAdapter = Object.freeze({
    ...base,
    PATCH_VERSION,
    AUTHORITY_SOURCE,
    ENTRY_TRANSFER_ANGLE_DEGREES,
    zeroPositionAuthorityV1: true,
    buildLayout,
    pointAtPitch,
    snapshot
  });
})(window);
