(function installServoForge3DWipePadGeometryAdapter(global) {
  "use strict";

  const SCHEMA_VERSION = "servoforge.3d-wipe-pad.v1";

  // Physical measurements supplied from the actual machine on 2026-08-17.
  // These values describe the wipe-down pad stack perpendicular to the bottle
  // travel path. The sponge contacts the bottle; the steel backing plate sits
  // behind the sponge, away from the bottle surface.
  const MEASURED_WIPE_PAD = Object.freeze({
    source: "user-measured-machine-2026-08-17",
    heightMm: 70,
    spongeThicknessMm: 18,
    backingPlateThicknessMm: 4,
    totalThicknessMm: 22,
    bottlePenetrationMm: 2
  });

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function positive(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

  function forwardSpanDegrees(startDegrees, endDegrees, fallback = 0.5) {
    const start = normalizeAngle(startDegrees);
    const end = normalizeAngle(endDegrees);
    let span = end - start;
    if (span < 0) span += 360;
    if (span <= 0.000001) span = positive(fallback, 0.5);
    return span;
  }

  function arcLengthMm(radiusMm, spanDegrees) {
    const radius = positive(radiusMm);
    const span = Math.max(0, number(spanDegrees, 0));
    return radius ? 2 * Math.PI * radius * (span / 360) : null;
  }

  function snapshot(item = {}, geometry = {}) {
    const unitsPerMm = positive(geometry?.renderScale?.worldUnitsPerMm, 0.00445);
    const pitchRadiusMm = positive(
      geometry?.machine?.physicalPitchRadiusMm,
      positive(geometry?.machine?.pitchRadiusMm)
    );
    const bottleRadiusMm = positive(geometry?.bottle?.effectiveRadiusMm);
    const side = item?.side === "inner" ? "inner" : "outer";
    const startDegrees = normalizeAngle(number(item?.start, number(item?.angle, 0)));
    const endDegrees = normalizeAngle(number(item?.end, startDegrees));
    const spanDegrees = Math.max(
      0.5,
      number(item?.spanDegrees, forwardSpanDegrees(startDegrees, endDegrees, 0.5))
    );
    const penetrationMm = MEASURED_WIPE_PAD.bottlePenetrationMm;
    const contactCenterOffsetMm = bottleRadiusMm === null
      ? null
      : Math.max(0, bottleRadiusMm - penetrationMm);
    const contactFaceRadiusMm = pitchRadiusMm === null || contactCenterOffsetMm === null
      ? null
      : side === "inner"
        ? pitchRadiusMm - contactCenterOffsetMm
        : pitchRadiusMm + contactCenterOffsetMm;
    const radialSign = side === "inner" ? -1 : 1;
    const spongeCenterRadiusMm = contactFaceRadiusMm === null
      ? null
      : contactFaceRadiusMm + radialSign * (MEASURED_WIPE_PAD.spongeThicknessMm / 2);
    const backingCenterRadiusMm = contactFaceRadiusMm === null
      ? null
      : contactFaceRadiusMm + radialSign * (
        MEASURED_WIPE_PAD.spongeThicknessMm + MEASURED_WIPE_PAD.backingPlateThicknessMm / 2
      );
    const assemblyCenterRadiusMm = contactFaceRadiusMm === null
      ? null
      : contactFaceRadiusMm + radialSign * (MEASURED_WIPE_PAD.totalThicknessMm / 2);
    const tableTravelLengthMm = arcLengthMm(pitchRadiusMm, spanDegrees);
    const contactFaceArcLengthMm = arcLengthMm(contactFaceRadiusMm, spanDegrees);

    const measured = {
      ...MEASURED_WIPE_PAD,
      side,
      startDegrees,
      endDegrees,
      spanDegrees,
      radialSign,
      pitchRadiusMm,
      bottleRadiusMm,
      contactCenterOffsetMm,
      contactFaceRadiusMm,
      spongeCenterRadiusMm,
      backingCenterRadiusMm,
      assemblyCenterRadiusMm,
      tableTravelLengthMm,
      contactFaceArcLengthMm,
      heightWorld: MEASURED_WIPE_PAD.heightMm * unitsPerMm,
      spongeThicknessWorld: MEASURED_WIPE_PAD.spongeThicknessMm * unitsPerMm,
      backingPlateThicknessWorld: MEASURED_WIPE_PAD.backingPlateThicknessMm * unitsPerMm,
      totalThicknessWorld: MEASURED_WIPE_PAD.totalThicknessMm * unitsPerMm,
      penetrationWorld: penetrationMm * unitsPerMm,
      contactFaceRadiusWorld: contactFaceRadiusMm === null ? null : contactFaceRadiusMm * unitsPerMm,
      spongeCenterRadiusWorld: spongeCenterRadiusMm === null ? null : spongeCenterRadiusMm * unitsPerMm,
      backingCenterRadiusWorld: backingCenterRadiusMm === null ? null : backingCenterRadiusMm * unitsPerMm,
      assemblyCenterRadiusWorld: assemblyCenterRadiusMm === null ? null : assemblyCenterRadiusMm * unitsPerMm,
      tableTravelLengthWorld: tableTravelLengthMm === null ? null : tableTravelLengthMm * unitsPerMm,
      contactFaceArcLengthWorld: contactFaceArcLengthMm === null ? null : contactFaceArcLengthMm * unitsPerMm,
      dimensionalAuthority: "user-measured",
      contactAuthority: bottleRadiusMm !== null && pitchRadiusMm !== null,
      penetrationModel: "pad-face-overlaps-nominal-bottle-radius-by-2mm"
    };

    return freeze({
      schemaVersion: SCHEMA_VERSION,
      ...measured
    });
  }

  global.Labeler3DWipePadGeometryAdapter = Object.freeze({
    SCHEMA_VERSION,
    MEASURED_WIPE_PAD,
    normalizeAngle,
    forwardSpanDegrees,
    arcLengthMm,
    snapshot
  });
})(window);
