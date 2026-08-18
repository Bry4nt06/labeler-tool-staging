(function installServoForge3DCarouselLayoutAdapter(global) {
  "use strict";

  const SCHEMA_VERSION = "servoforge.3d-carousel.v1";

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

  function sceneAdapter() {
    const adapter = global.Labeler3DSceneAdapter;
    if (!adapter || typeof adapter.machineOrbit !== "function") {
      throw new Error("ServoForge 3D carousel layout requires Labeler3DSceneAdapter.machineOrbit.");
    }
    return adapter;
  }

  function snapshot(sceneState, geometry, options = {}) {
    if (!sceneState || sceneState.schemaVersion !== "servoforge.3d-scene.v1") {
      throw new Error("ServoForge 3D carousel layout requires a servoforge.3d-scene.v1 scene.");
    }

    const headCount = Math.max(1, Math.round(number(geometry?.machine?.headCount, 1)));
    const pitchDegrees = 360 / headCount;
    const primaryTableAngle = normalizeAngle(sceneState.carousel?.machineAngleDegrees);
    const radius = Math.max(0, number(sceneState.carousel?.radius, number(geometry?.machine?.pitchRadiusWorld, 1)));
    const tableY = number(sceneState.bottleTable?.position?.y, number(options.tableY, 0));
    const carouselDirection = String(options.carouselDirection || "ccw");
    const zeroAngleDegrees = number(options.zeroAngleDegrees, 0);
    const orbitAdapter = sceneAdapter();

    const heads = Array.from({ length: headCount }, (_, index) => {
      const tableAngleDegrees = normalizeAngle(primaryTableAngle - index * pitchDegrees);
      const orbit = orbitAdapter.machineOrbit(tableAngleDegrees, {
        carouselRadius: radius,
        carouselDirection,
        zeroAngleDegrees
      });
      return freeze({
        head: index + 1,
        active: index === 0,
        tableAngleDegrees,
        mapBearingDegrees: orbit.bearingDegrees,
        rotationY: orbit.radians,
        position: {
          x: orbit.x,
          y: tableY,
          z: orbit.z
        }
      });
    });

    return freeze({
      schemaVersion: SCHEMA_VERSION,
      headCount,
      activeHead: 1,
      pitchDegrees,
      primaryTableAngle,
      radius,
      physicalPitchRadiusMm: number(geometry?.machine?.physicalPitchRadiusMm, number(geometry?.machine?.pitchRadiusMm, 0)),
      plannerPitchRadiusMm: number(geometry?.machine?.plannerPitchRadiusMm, 0),
      plateCenterSpacingMm: number(geometry?.bottleTable?.centerSpacingMm, number(geometry?.machine?.plateCenterSpacingMm, 0)),
      plateClearanceMm: number(geometry?.bottleTable?.clearanceMm, 0),
      plateDiameterMm: number(geometry?.bottleTable?.plateDiameterMm, 0),
      source: "scene-machine-angle-and-measured-bottle-table-geometry",
      passiveServoMode: "neutral-no-invented-motion",
      heads
    });
  }

  global.Labeler3DCarouselLayoutAdapter = Object.freeze({
    SCHEMA_VERSION,
    normalizeAngle,
    snapshot
  });
})(window);
