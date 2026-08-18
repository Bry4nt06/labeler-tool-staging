(function installServoForge3DBottleHandlingTransferSynchronization(global) {
  "use strict";

  const base = global.Labeler3DBottleHandlingAdapter;
  const sceneAdapter = global.Labeler3DSceneAdapter;
  if (!base?.buildLayout || !base?.pointAtPitch || !base?.snapshot || !sceneAdapter?.machineOrbit) return;

  const PATCH_VERSION = "servoforge.3d-bottle-handling-transfer-sync.v1";
  const AUTHORITY_SOURCE = "shared-star-pocket-and-live-carousel-head-transfer-phase";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalizeAngle(value) {
    const normalized = number(value, 0) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function fraction(value) {
    const numeric = number(value, 0);
    return ((numeric % 1) + 1) % 1;
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function carouselSegment(layout) {
    return (layout?.segments || []).find((segment) => segment?.owner === "carousel") || null;
  }

  function routePhaseOffsetPitch(layout) {
    const segment = carouselSegment(layout);
    const headPitchDegrees = Math.max(0.000001, number(layout?.headPitchDegrees, 1));
    const entryAngleDegrees = number(layout?.entryAngleDegrees, number(segment?.startAngleDegrees, 0));
    const entryHeadPhasePitch = fraction(entryAngleDegrees / headPitchDegrees);
    return fraction(number(segment?.startPitch, 0) - entryHeadPhasePitch);
  }

  function synchronizedRoutePhasePitch(machineAngleDegrees, layout) {
    const headPitchDegrees = Math.max(0.000001, number(layout?.headPitchDegrees, 1));
    const liveHeadPhasePitch = fraction(normalizeAngle(machineAngleDegrees) / headPitchDegrees);
    return fraction(liveHeadPhasePitch + routePhaseOffsetPitch(layout));
  }

  function shortestAngularDistance(a, b) {
    let delta = normalizeAngle(a) - normalizeAngle(b);
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return Math.abs(delta);
  }

  function nearestCarouselHead(tableAngleDegrees, machineAngleDegrees, layout) {
    if (typeof base.nearestCarouselHead === "function") {
      return base.nearestCarouselHead(tableAngleDegrees, machineAngleDegrees, layout);
    }
    const headCount = Math.max(1, Math.round(number(layout?.headCount, 1)));
    const pitchDegrees = number(layout?.headPitchDegrees, 360 / headCount);
    let best = null;
    for (let index = 0; index < headCount; index += 1) {
      const candidateAngle = normalizeAngle(machineAngleDegrees - index * pitchDegrees);
      const errorDegrees = shortestAngularDistance(candidateAngle, tableAngleDegrees);
      if (!best || errorDegrees < best.errorDegrees) {
        best = { head: index + 1, tableAngleDegrees: candidateAngle, errorDegrees };
      }
    }
    return best;
  }

  function centerCarouselPoint(point, machineAngleDegrees, layout) {
    if (point?.owner !== "carousel" || !Number.isFinite(Number(point?.tableAngleDegrees))) return point;
    const nearest = nearestCarouselHead(point.tableAngleDegrees, machineAngleDegrees, layout);
    if (!nearest) return point;
    const orbit = sceneAdapter.machineOrbit(nearest.tableAngleDegrees, {
      carouselRadius: layout.carouselRadius,
      carouselDirection: layout.carouselDirection,
      zeroAngleDegrees: layout.zeroAngleDegrees
    });
    return freeze({
      ...point,
      routeTableAngleDegrees: point.tableAngleDegrees,
      routePosition: point.position ? { x: number(point.position.x), z: number(point.position.z) } : null,
      tableAngleDegrees: nearest.tableAngleDegrees,
      tableAngleUnwrappedDegrees: nearest.tableAngleDegrees,
      position: { x: number(orbit.x), z: number(orbit.z) },
      routeRotationY: number(orbit.threeRotationY, -number(orbit.radians)),
      carrierHead: nearest.head,
      carrierCenterErrorBeforeSnapDegrees: nearest.errorDegrees,
      centeredOnBottleTable: true,
      carrierCenterAuthority: "servoforge-live-carousel-head-lattice",
      transferPhaseLocked: true
    });
  }

  function pointDistance(a, b) {
    return Math.hypot(number(a?.x) - number(b?.x), number(a?.z) - number(b?.z));
  }

  function transferDiagnostics(layout) {
    const segment = carouselSegment(layout);
    const entryContact = layout?.wheels?.intermediate?.carouselTransferContact;
    const dischargeContact = layout?.wheels?.discharge?.carouselTransferContact;
    const entryOrbit = sceneAdapter.machineOrbit(number(layout?.entryAngleDegrees, segment?.startAngleDegrees), {
      carouselRadius: layout.carouselRadius,
      carouselDirection: layout.carouselDirection,
      zeroAngleDegrees: layout.zeroAngleDegrees
    });
    const dischargeOrbit = sceneAdapter.machineOrbit(number(layout?.exitAngleDegrees, segment?.endAngleDegrees), {
      carouselRadius: layout.carouselRadius,
      carouselDirection: layout.carouselDirection,
      zeroAngleDegrees: layout.zeroAngleDegrees
    });
    return freeze({
      entryContactErrorWorld: entryContact ? pointDistance(entryContact, entryOrbit) : null,
      dischargeContactErrorWorld: dischargeContact ? pointDistance(dischargeContact, dischargeOrbit) : null,
      entryTransferAngleDegrees: number(layout?.entryAngleDegrees, segment?.startAngleDegrees),
      dischargeTransferAngleDegrees: number(layout?.exitAngleDegrees, segment?.endAngleDegrees),
      routePhaseOffsetPitch: routePhaseOffsetPitch(layout),
      sharedTransferPointAuthority: true
    });
  }

  function buildLayout(geometry, options = {}) {
    const layout = base.buildLayout(geometry, options);
    return freeze({
      ...layout,
      transferSynchronization: {
        source: AUTHORITY_SOURCE,
        model: "route-phase-locked-to-live-carousel-head-at-star-wheel-contact",
        routePhaseOffsetPitch: routePhaseOffsetPitch(layout),
        ...transferDiagnostics(layout)
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
    const liveHeadPhasePitch = fraction(normalizedMachineAngle / headPitchDegrees);
    const routePhasePitch = synchronizedRoutePhasePitch(normalizedMachineAngle, layout);
    const bottleCount = Math.ceil(number(layout.totalPitchLength, 0)) + 2;
    const bottles = [];

    for (let slot = 0; slot < bottleCount; slot += 1) {
      const pitchDistance = routePhasePitch + slot;
      if (pitchDistance > number(layout.totalPitchLength, 0) + 1e-9) continue;
      const routePoint = pointAtPitch(layout, pitchDistance);
      const point = centerCarouselPoint(routePoint, normalizedMachineAngle, layout);
      bottles.push(freeze({
        id: `handling-bottle-${slot}`,
        slot,
        ...point
      }));
    }

    return freeze({
      ...raw,
      schemaVersion: "servoforge.3d-bottle-handling.v7-transfer-sync",
      patchVersion: PATCH_VERSION,
      layout,
      machineAngleDegrees: normalizedMachineAngle,
      feedPhasePitch: liveHeadPhasePitch,
      routePhasePitch,
      routePhaseOffsetPitch: routePhaseOffsetPitch(layout),
      bottleCount: bottles.length,
      bottles,
      transferSynchronization: {
        source: AUTHORITY_SOURCE,
        phaseLocked: true,
        liveHeadPhasePitch,
        routePhasePitch,
        routePhaseOffsetPitch: routePhaseOffsetPitch(layout),
        ownershipBoundary: "shared-star-pocket-and-carousel-table-center",
        snapCompensation: false,
        interpolationCompensation: false,
        diagnostics: transferDiagnostics(layout)
      },
      bottleIdentityModel: "continuous-pitch-population-phase-locked-to-transfer",
      readOnly: true
    });
  }

  global.Labeler3DBottleHandlingAdapter = Object.freeze({
    ...base,
    PATCH_VERSION,
    AUTHORITY_SOURCE,
    transferSynchronizationV1: true,
    routePhaseOffsetPitch,
    synchronizedRoutePhasePitch,
    nearestCarouselHead,
    buildLayout,
    pointAtPitch,
    snapshot
  });
})(window);
