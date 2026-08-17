(function installServoForge3DPhysicalGeometryAdapter(global) {
  "use strict";

  const SCHEMA_VERSION = "servoforge.3d-geometry.v1";
  const DEFAULT_WORLD_UNITS_PER_MM = 2.55 / 572.958;

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

    // Smooth R108-style shoulder approximation. We preserve the drawing's
    // shoulder span and neck datum diameter while the active ServoForge body
    // diameter remains unchanged.
    const shoulderSteps = 8;
    for (let index = 1; index <= shoulderSteps; index += 1) {
      const t = index / shoulderSteps;
      const eased = Math.cos(t * Math.PI / 2);
      points.push({
        radiusMm: shoulderNeckRadius + (bodyRadius - shoulderNeckRadius) * eased,
        yMm: bodyTop + LONGNECK_REFERENCE.shoulderTransitionHeightMm * t
      });
    }

    // Long neck taper from the ø37 shoulder datum to the ø26.6 crown finish.
    const neckSteps = 7;
    for (let index = 1; index <= neckSteps; index += 1) {
      const t = index / neckSteps;
      const smooth = t * t * (3 - 2 * t);
      points.push({
        radiusMm: shoulderNeckRadius + (finishRadius - shoulderNeckRadius) * smooth,
        yMm: shoulderTop + (finishStart - shoulderTop) * t
      });
    }

    // Crown finish rings. Small radial changes make the finish readable in 3D
    // without asserting a complete factory thread/bead profile.
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
    const pitchRadiusMm = positive(stateLike.tablePitchRadiusMm, positive(stateLike.referencePitchRadiusMm, 572.958));
    const headCount = Math.max(1, Math.round(positive(stateLike.headCount, 1)));
    const headPitchMm = (2 * Math.PI * pitchRadiusMm) / headCount;
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

    const minimumPlateDiameterMm = diameterMm ? diameterMm + 4 : headPitchMm * 0.70;
    const plateDiameterMm = Math.min(headPitchMm * 0.86, Math.max(headPitchMm * 0.70, minimumPlateDiameterMm));
    const baseDiameterMm = Math.min(headPitchMm * 0.94, Math.max(plateDiameterMm + 5, headPitchMm * 0.82));
    const carouselOuterRadiusMm = pitchRadiusMm + headPitchMm * 0.88;

    return freeze({
      schemaVersion: SCHEMA_VERSION,
      units: "mm",
      renderScale: {
        worldUnitsPerMm,
        mmPerWorldUnit: 1 / worldUnitsPerMm
      },
      machine: {
        headCount,
        pitchRadiusMm,
        pitchRadiusWorld: pitchRadiusMm * worldUnitsPerMm,
        headPitchMm,
        headPitchWorld: headPitchMm * worldUnitsPerMm,
        carouselOuterRadiusMm,
        carouselOuterRadiusWorld: carouselOuterRadiusMm * worldUnitsPerMm,
        pitchRadiusAuthority: Boolean(positive(stateLike.tablePitchRadiusMm) || positive(stateLike.referencePitchRadiusMm)),
        carouselOuterRadiusAuthority: false
      },
      bottle,
      bottleTable: {
        plateDiameterMm,
        plateDiameterWorld: plateDiameterMm * worldUnitsPerMm,
        baseDiameterMm,
        baseDiameterWorld: baseDiameterMm * worldUnitsPerMm,
        dimensionalAuthority: "derived-layout-envelope",
        derivedFromHeadPitch: true
      },
      reference: {
        longneck: LONGNECK_REFERENCE
      },
      authority: {
        bottleDiameter: Boolean(diameterMm),
        bottleHeight: false,
        bottleVerticalProfile: "reference-drawing",
        machinePitchRadius: Boolean(positive(stateLike.tablePitchRadiusMm) || positive(stateLike.referencePitchRadiusMm)),
        bottleTableCad: false
      }
    });
  }

  global.Labeler3DPhysicalGeometryAdapter = Object.freeze({
    SCHEMA_VERSION,
    DEFAULT_WORLD_UNITS_PER_MM,
    LONGNECK_REFERENCE,
    selectedBottleSpec,
    effectiveDiameterMm,
    referenceProfilePointsMm,
    snapshot
  });
})(window);
