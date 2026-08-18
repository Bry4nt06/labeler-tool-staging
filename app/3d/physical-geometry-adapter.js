(function installServoForge3DPhysicalGeometryAdapter(global) {
  "use strict";

  const SCHEMA_VERSION = "servoforge.3d-geometry.v1";
  const DEFAULT_WORLD_UNITS_PER_MM = 2.55 / 572.958;

  // User-measured bottle-table geometry. These dimensions are intentionally
  // isolated to the 3D mechanical model so existing planner/map pitch-radius
  // calculations remain unchanged.
  const MEASURED_BOTTLE_TABLE = Object.freeze({
    source: "user-measured-machine-2026-08-17",
    centerSpacingMm: 110,
    edgeClearanceMm: 16
  });

  // User-supplied 330 ml longneck drawing. The body diameter from this drawing
  // is intentionally NOT authoritative: ServoForge's active Bottle Spec remains
  // the source of truth for body diameter. These dimensions only fill the
  // vertical/neck silhouette until bottle-specific CAD dimensions are stored.
  const LONGNECK_REFERENCE = Object.freeze({
    source: "user-provided-330ml-longneck-reference",
    overallHeightMm: 241.5,
    drawingBodyDiameterMm: 60.3,
    baseDiameterMm: 61,
    finishOuterDiameterMm: 26.6,
    mouthInnerDiameterMm: 17.5,
    shoulderNeckDiameterMm: 37,
    bodyStraightHeightMm: 92,
    shoulderTransitionHeightMm: 41.5,
    finishHeightMm: 17,
    shoulderRadiusMm: 108
  });

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function positive(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function selectedBottleSpec(stateLike = {}) {
    const specs = Array.isArray(stateLike.bottleSpecs) ? stateLike.bottleSpecs : [];
    const selected = String(stateLike.selectedBottle || "").trim();
    const selectedBrand = String(stateLike.selectedBrand || "").trim();
    const labels = Array.isArray(stateLike.labelSpecs) ? stateLike.labelSpecs : [];
    const labelBottle = labels.find((label) => String(label?.brand || "").trim() === selectedBrand)?.bottleType;
    const requested = selected || String(labelBottle || "").trim();
    return specs.find((spec) => String(spec?.bottleType || "").trim() === requested) || specs[0] || null;
  }

  function effectiveDiameterMm(spec) {
    const geometryDriver = global.LabelerGeometryDriver;
    if (typeof geometryDriver?.effectiveDiameterMm === "function") {
      const calculated = positive(geometryDriver.effectiveDiameterMm(spec));
      if (calculated) return calculated;
    }
    const target = positive(spec?.diameterTargetMm);
    if (!target) return null;
    return Math.max(1, target - Math.max(0, number(spec?.radiusReductionMm, 0)) * 2);
  }

  function pitchRadiusFromChordSpacing(centerSpacingMm, headCount) {
    const chord = positive(centerSpacingMm);
    const count = Math.max(2, Math.round(positive(headCount, 2)));
    if (!chord) return null;
    return chord / (2 * Math.sin(Math.PI / count));
  }

  function referenceProfilePointsMm(bodyDiameterMm) {
    const bodyRadius = positive(bodyDiameterMm, LONGNECK_REFERENCE.drawingBodyDiameterMm) / 2;
    const finishRadius = LONGNECK_REFERENCE.finishOuterDiameterMm / 2;
    const shoulderNeckRadius = LONGNECK_REFERENCE.shoulderNeckDiameterMm / 2;
    const bodyBottom = 10;
    const bodyTop = bodyBottom + LONGNECK_REFERENCE.bodyStraightHeightMm;
    const shoulderTop = bodyTop + LONGNECK_REFERENCE.shoulderTransitionHeightMm;
    const finishStart = LONGNECK_REFERENCE.overallHeightMm - LONGNECK_REFERENCE.finishHeightMm;
    const points = [
      { radiusMm: bodyRadius * 0.94, yMm: 0 },
      { radiusMm: bodyRadius * 0.985, yMm: 3 },
      { radiusMm: bodyRadius, yMm: bodyBottom },
      { radiusMm: bodyRadius, yMm: bodyTop }
    ];

    const shoulderSteps = 8;
    for (let index = 1; index <= shoulderSteps; index += 1) {
      const t = index / shoulderSteps;
      const eased = Math.cos(t * Math.PI / 2);
      points.push({
        radiusMm: shoulderNeckRadius + (bodyRadius - shoulderNeckRadius) * eased,
        yMm: bodyTop + LONGNECK_REFERENCE.shoulderTransitionHeightMm * t
      });
    }

    const neckSteps = 7;
    for (let index = 1; index <= neckSteps; index += 1) {
      const t = index / neckSteps;
      const smooth = t * t * (3 - 2 * t);
      points.push({
        radiusMm: shoulderNeckRadius + (finishRadius - shoulderNeckRadius) * smooth,
        yMm: shoulderTop + (finishStart - shoulderTop) * t
      });
    }

    points.push(
      { radiusMm: finishRadius, yMm: finishStart },
      { radiusMm: finishRadius * 1.035, yMm: finishStart + 2.4 },
      { radiusMm: finishRadius * 1.035, yMm: finishStart + 5.0 },
      { radiusMm: finishRadius, yMm: finishStart + 6.2 },
      { radiusMm: finishRadius * 1.045, yMm: finishStart + 10.3 },
      { radiusMm: finishRadius * 1.045, yMm: finishStart + 13.0 },
      { radiusMm: finishRadius, yMm: LONGNECK_REFERENCE.overallHeightMm }
    );

    return points;
  }

  function snapshot(stateLike = {}, options = {}) {
    const worldUnitsPerMm = positive(options.worldUnitsPerMm, DEFAULT_WORLD_UNITS_PER_MM);
    const plannerPitchRadiusMm = positive(stateLike.tablePitchRadiusMm, positive(stateLike.referencePitchRadiusMm, 572.958));
    const headCount = Math.max(2, Math.round(positive(stateLike.headCount, 2)));
    const angularPitchDegrees = 360 / headCount;

    const centerSpacingMm = positive(stateLike.bottlePlateCenterSpacingMm, MEASURED_BOTTLE_TABLE.centerSpacingMm);
    const plateClearanceMm = Math.max(0, number(stateLike.bottlePlateClearanceMm, MEASURED_BOTTLE_TABLE.edgeClearanceMm));
    const plateDiameterMm = Math.max(1, centerSpacingMm - plateClearanceMm);
    const physicalPitchRadiusMm = pitchRadiusFromChordSpacing(centerSpacingMm, headCount);
    const arcPitchMm = (2 * Math.PI * physicalPitchRadiusMm) / headCount;

    const bottleSpec = selectedBottleSpec(stateLike);
    const diameterMm = effectiveDiameterMm(bottleSpec);
    const profilePointsMm = referenceProfilePointsMm(diameterMm);
    const profilePointsWorld = profilePointsMm.map((point) => Object.freeze({
      radius: point.radiusMm * worldUnitsPerMm,
      y: point.yMm * worldUnitsPerMm
    }));
    const visualHeightMm = LONGNECK_REFERENCE.overallHeightMm;

    const bottle = {
      bottleType: String(bottleSpec?.bottleType || stateLike.selectedBottle || "Unknown bottle"),
      diameterTargetMm: positive(bottleSpec?.diameterTargetMm),
      radiusReductionMm: Math.max(0, number(bottleSpec?.radiusReductionMm, 0)),
      effectiveDiameterMm: diameterMm,
      effectiveRadiusMm: diameterMm ? diameterMm / 2 : null,
      diameterWorld: diameterMm ? diameterMm * worldUnitsPerMm : null,
      radiusWorld: diameterMm ? diameterMm * worldUnitsPerMm / 2 : null,
      physicalDiameterAuthority: Boolean(diameterMm),
      physicalHeightMm: null,
      physicalHeightAuthority: false,
      referenceHeightMm: visualHeightMm,
      visualHeightMm,
      visualHeightWorld: visualHeightMm * worldUnitsPerMm,
      finishOuterDiameterMm: LONGNECK_REFERENCE.finishOuterDiameterMm,
      mouthInnerDiameterMm: LONGNECK_REFERENCE.mouthInnerDiameterMm,
      shoulderNeckDiameterMm: LONGNECK_REFERENCE.shoulderNeckDiameterMm,
      shoulderRadiusMm: LONGNECK_REFERENCE.shoulderRadiusMm,
      bodyStraightHeightMm: LONGNECK_REFERENCE.bodyStraightHeightMm,
      shoulderTransitionHeightMm: LONGNECK_REFERENCE.shoulderTransitionHeightMm,
      finishHeightMm: LONGNECK_REFERENCE.finishHeightMm,
      profilePointsMm,
      profilePointsWorld,
      verticalShapeSource: LONGNECK_REFERENCE.source,
      bodyDiameterSource: "active-servoforge-bottle-spec",
      referenceDrawingBodyDiameterIgnored: true
    };

    // The user supplied the true adjacent plate-center spacing and edge gap.
    // Plate diameter is therefore a direct geometric consequence: 110 - 16 = 94 mm.
    // The physical pitch-circle radius is derived from the measured chord spacing,
    // while plannerPitchRadiusMm remains untouched for existing ServoForge math.
    const baseDiameterMm = plateDiameterMm;
    const carouselOuterRadiusMm = physicalPitchRadiusMm + plateDiameterMm / 2 + 20;

    return freeze({
      schemaVersion: SCHEMA_VERSION,
      units: "mm",
      renderScale: {
        worldUnitsPerMm,
        mmPerWorldUnit: 1 / worldUnitsPerMm
      },
      machine: {
        headCount,
        angularPitchDegrees,
        pitchRadiusMm: physicalPitchRadiusMm,
        pitchRadiusWorld: physicalPitchRadiusMm * worldUnitsPerMm,
        physicalPitchRadiusMm,
        physicalPitchRadiusWorld: physicalPitchRadiusMm * worldUnitsPerMm,
        plannerPitchRadiusMm,
        plannerPitchRadiusWorld: plannerPitchRadiusMm * worldUnitsPerMm,
        plateCenterSpacingMm: centerSpacingMm,
        plateCenterSpacingWorld: centerSpacingMm * worldUnitsPerMm,
        headPitchMm: centerSpacingMm,
        headPitchWorld: centerSpacingMm * worldUnitsPerMm,
        chordPitchMm: centerSpacingMm,
        arcPitchMm,
        arcPitchWorld: arcPitchMm * worldUnitsPerMm,
        carouselOuterRadiusMm,
        carouselOuterRadiusWorld: carouselOuterRadiusMm * worldUnitsPerMm,
        pitchRadiusAuthority: true,
        pitchRadiusSource: "derived-from-user-measured-plate-center-chord",
        plannerPitchRadiusAuthority: Boolean(positive(stateLike.tablePitchRadiusMm) || positive(stateLike.referencePitchRadiusMm)),
        carouselOuterRadiusAuthority: false
      },
      bottle,
      bottleTable: {
        centerSpacingMm,
        centerSpacingWorld: centerSpacingMm * worldUnitsPerMm,
        clearanceMm: plateClearanceMm,
        clearanceWorld: plateClearanceMm * worldUnitsPerMm,
        plateDiameterMm,
        plateDiameterWorld: plateDiameterMm * worldUnitsPerMm,
        baseDiameterMm,
        baseDiameterWorld: baseDiameterMm * worldUnitsPerMm,
        dimensionalAuthority: "user-measured-spacing-and-clearance",
        plateDiameterAuthority: "derived-from-measured-center-spacing-minus-clearance",
        derivedFromHeadPitch: false
      },
      reference: {
        longneck: LONGNECK_REFERENCE,
        bottleTableMeasurement: MEASURED_BOTTLE_TABLE
      },
      authority: {
        bottleDiameter: Boolean(diameterMm),
        bottleHeight: false,
        bottleVerticalProfile: "reference-drawing",
        machinePitchRadius: true,
        machinePitchRadiusSource: "derived-from-user-measured-plate-center-chord",
        plannerPitchRadius: Boolean(positive(stateLike.tablePitchRadiusMm) || positive(stateLike.referencePitchRadiusMm)),
        bottleTableCad: false,
        bottleTableMeasurement: "user-measured"
      }
    });
  }

  global.Labeler3DPhysicalGeometryAdapter = Object.freeze({
    SCHEMA_VERSION,
    DEFAULT_WORLD_UNITS_PER_MM,
    MEASURED_BOTTLE_TABLE,
    LONGNECK_REFERENCE,
    selectedBottleSpec,
    effectiveDiameterMm,
    pitchRadiusFromChordSpacing,
    referenceProfilePointsMm,
    snapshot
  });
})(window);
