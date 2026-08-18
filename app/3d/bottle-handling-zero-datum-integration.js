(function installServoForge3DBottleHandlingZeroDatum(global) {
  "use strict";

  const base = global.Labeler3DBottleHandlingAdapter;
  const sceneAdapter = global.Labeler3DSceneAdapter;
  if (!base?.snapshot || !base?.buildLayout || !base?.pointAtPitch || !sceneAdapter?.machineOrbit) return;

  const PATCH_VERSION = "servoforge.3d-bottle-handling-zero-datum.v1";
  const ZERO_DATUM_SOURCE = "user-marked-labeler-zero-photo-2026-08-18";
  const ENTRY_PITCHES_AFTER_ZERO = 4;
  const EXIT_PITCHES_BEFORE_ZERO = 6;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function normalizeAngle(value) {
    const normalized = number(value, 0) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function signedOffsetFromZero(angleDegrees) {
    const normalized = normalizeAngle(angleDegrees);
    return normalized > 180 ? normalized - 360 : normalized;
  }

  function unit(point) {
    const x = number(point?.x);
    const z = number(point?.z);
    const magnitude = Math.hypot(x, z) || 1;
    return { x: x / magnitude, z: z / magnitude };
  }

  function cross2D(a, b) {
    return number(a?.x) * number(b?.z) - number(a?.z) * number(b?.x);
  }

  function sideLabel(value) {
    if (value > 1e-9) return "positive-angle-side";
    if (value < -1e-9) return "negative-angle-side";
    return "on-zero-datum";
  }

  function resolvedOptions(geometry, options = {}) {
    const headCount = Math.max(8, Math.round(number(geometry?.machine?.headCount, 45)));
    const headPitchDegrees = 360 / headCount;
    return {
      ...options,
      entryAngleDegrees: Number.isFinite(Number(options.entryAngleDegrees))
        ? Number(options.entryAngleDegrees)
        : headPitchDegrees * ENTRY_PITCHES_AFTER_ZERO,
      exitAngleDegrees: Number.isFinite(Number(options.exitAngleDegrees))
        ? Number(options.exitAngleDegrees)
        : normalizeAngle(-headPitchDegrees * EXIT_PITCHES_BEFORE_ZERO)
    };
  }

  function zeroDatumFor(layout) {
    const zeroOrbit = sceneAdapter.machineOrbit(0, {
      carouselRadius: layout.carouselRadius,
      carouselDirection: layout.carouselDirection,
      zeroAngleDegrees: layout.zeroAngleDegrees
    });
    const zeroDirection = unit(zeroOrbit);
    const intermediate = layout?.wheels?.intermediate;
    const discharge = layout?.wheels?.discharge;
    const farthestRadius = Math.max(
      layout.carouselRadius,
      Math.hypot(number(intermediate?.center?.x), number(intermediate?.center?.z)) + number(intermediate?.pitchRadiusWorld),
      Math.hypot(number(discharge?.center?.x), number(discharge?.center?.z)) + number(discharge?.pitchRadiusWorld)
    );

    return freeze({
      machineAngleDegrees: 0,
      source: ZERO_DATUM_SOURCE,
      angularAuthority: true,
      physicalMeaning: "labeler-machine-zero-radial-datum",
      bearingDegrees: number(zeroOrbit?.bearingDegrees),
      radialDirection: zeroDirection,
      line: {
        start: { x: 0, z: 0 },
        end: {
          x: zeroDirection.x * farthestRadius,
          z: zeroDirection.z * farthestRadius
        }
      },
      entryOffsetDegrees: signedOffsetFromZero(layout.entryAngleDegrees),
      exitOffsetDegrees: signedOffsetFromZero(layout.exitAngleDegrees),
      transferGapCrossesZero: signedOffsetFromZero(layout.entryAngleDegrees) > 0
        && signedOffsetFromZero(layout.exitAngleDegrees) < 0,
      intermediateSide: sideLabel(cross2D(zeroDirection, intermediate?.center)),
      dischargeSide: sideLabel(cross2D(zeroDirection, discharge?.center))
    });
  }

  function enhanceLayout(layout) {
    const zeroDatum = zeroDatumFor(layout);
    return freeze({
      ...layout,
      zeroDatum,
      videoObservations: {
        ...(layout.videoObservations || {}),
        machineZeroDatumMarkedByUser: true,
        zeroDatumSeparatesEntryAndDischargeCluster: true
      },
      authority: {
        ...(layout.authority || {}),
        zeroDatum: "user-marked-machine-photo-authoritative-angular-datum",
        transferOffsetsFromZero: "video-referenced-provisional-until-measured"
      }
    });
  }

  function buildLayout(geometry, options = {}) {
    return enhanceLayout(base.buildLayout(geometry, resolvedOptions(geometry, options)));
  }

  function pointAtPitch(layout, pitchDistance) {
    return base.pointAtPitch(layout, pitchDistance);
  }

  function snapshot(machineAngleDegrees, geometry, options = {}) {
    const raw = base.snapshot(machineAngleDegrees, geometry, resolvedOptions(geometry, options));
    const layout = enhanceLayout(raw.layout);
    return freeze({
      ...raw,
      layout,
      zeroDatum: layout.zeroDatum,
      zeroDatumSource: ZERO_DATUM_SOURCE
    });
  }

  global.Labeler3DBottleHandlingAdapter = Object.freeze({
    ...base,
    PATCH_VERSION,
    ZERO_DATUM_SOURCE,
    ENTRY_PITCHES_AFTER_ZERO,
    EXIT_PITCHES_BEFORE_ZERO,
    zeroDatumAnchored: true,
    buildLayout,
    pointAtPitch,
    snapshot
  });
})(window);
