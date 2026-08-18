(function installServoForge3DBottleHandlingCarouselTableCenter(global) {
  "use strict";

  const base = global.Labeler3DBottleHandlingAdapter;
  const sceneAdapter = global.Labeler3DSceneAdapter;
  if (!base?.snapshot || !base?.buildLayout || !sceneAdapter?.machineOrbit) return;

  const PATCH_VERSION = "servoforge.3d-bottle-handling-carousel-table-center.v1";
  const AUTHORITY_SOURCE = "servoforge-live-carousel-head-lattice";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeAngle(value) {
    const normalized = number(value, 0) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function shortestAngularDistance(a, b) {
    let delta = normalizeAngle(a) - normalizeAngle(b);
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return Math.abs(delta);
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function nearestCarouselHead(tableAngleDegrees, machineAngleDegrees, layout) {
    const headCount = Math.max(1, Math.round(number(layout?.headCount, 1)));
    const pitchDegrees = number(layout?.headPitchDegrees, 360 / headCount);
    let best = null;

    for (let index = 0; index < headCount; index += 1) {
      const candidateAngle = normalizeAngle(machineAngleDegrees - index * pitchDegrees);
      const errorDegrees = shortestAngularDistance(candidateAngle, tableAngleDegrees);
      if (!best || errorDegrees < best.errorDegrees) {
        best = {
          head: index + 1,
          tableAngleDegrees: candidateAngle,
          errorDegrees
        };
      }
    }
    return best;
  }

  function centerCarouselBottle(point, raw, layout) {
    if (point?.owner !== "carousel" || !Number.isFinite(Number(point?.tableAngleDegrees))) return point;

    const nearest = nearestCarouselHead(
      point.tableAngleDegrees,
      raw.machineAngleDegrees,
      layout
    );
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
      carrierCenterAuthority: AUTHORITY_SOURCE
    });
  }

  function buildLayout(geometry, options = {}) {
    return base.buildLayout(geometry, options);
  }

  function pointAtPitch(layout, pitchDistance) {
    return base.pointAtPitch(layout, pitchDistance);
  }

  function snapshot(machineAngleDegrees, geometry, options = {}) {
    const raw = base.snapshot(machineAngleDegrees, geometry, options);
    const layout = raw.layout;
    const bottles = (raw.bottles || []).map((point) => centerCarouselBottle(point, raw, layout));
    const centeredCount = bottles.filter((point) => point?.centeredOnBottleTable).length;

    return freeze({
      ...raw,
      bottles,
      carouselBottleCentering: {
        source: AUTHORITY_SOURCE,
        centeredBottleCount: centeredCount,
        tableCenterAuthority: true,
        servoReplayUsesCenteredTableAngle: true,
        appliesTo: "carousel-owned-bottles-only",
        starPocketAndConveyorPathsUntouched: true
      },
      carouselBottleTableCenteringEnabled: true
    });
  }

  global.Labeler3DBottleHandlingAdapter = Object.freeze({
    ...base,
    PATCH_VERSION,
    AUTHORITY_SOURCE,
    carouselBottleTableCenteringV1: true,
    nearestCarouselHead,
    buildLayout,
    pointAtPitch,
    snapshot
  });
})(window);
