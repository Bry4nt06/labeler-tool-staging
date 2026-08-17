(function installServoForge3DPhysicalGeometryAdapter(global) {
  "use strict";

  const SCHEMA_VERSION = "servoforge.3d-geometry.v1";
  const DEFAULT_WORLD_UNITS_PER_MM = 2.55 / 572.958;
  const REFERENCE_BOTTLE_HEIGHT_TO_DIAMETER = 1.95 / 0.62;

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

  function snapshot(stateLike = {}, options = {}) {
    const worldUnitsPerMm = positive(options.worldUnitsPerMm, DEFAULT_WORLD_UNITS_PER_MM);
    const pitchRadiusMm = positive(stateLike.tablePitchRadiusMm, positive(stateLike.referencePitchRadiusMm, 572.958));
    const headCount = Math.max(1, Math.round(positive(stateLike.headCount, 1)));
    const headPitchMm = (2 * Math.PI * pitchRadiusMm) / headCount;
    const bottleSpec = selectedBottleSpec(stateLike);
    const diameterMm = effectiveDiameterMm(bottleSpec);
    const visualHeightMm = diameterMm ? diameterMm * REFERENCE_BOTTLE_HEIGHT_TO_DIAMETER : null;

    // ServoForge currently stores bottle diameter but not full bottle CAD height,
    // shoulder, heel, neck, or finish dimensions. The vertical silhouette remains
    // a reference proportion until those dimensions are added to Bottle Specs.
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
      visualHeightMm,
      visualHeightWorld: visualHeightMm ? visualHeightMm * worldUnitsPerMm : null,
      verticalShapeSource: "reference-proportion-until-bottle-cad-dimensions-exist"
    };

    // Bottle-table diameters are layout envelopes derived from pitch spacing so
    // adjacent tables remain mechanically plausible in the preview. They are not
    // asserted as factory CAD dimensions until ServoForge stores those values.
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
      authority: {
        bottleDiameter: Boolean(diameterMm),
        bottleHeight: false,
        machinePitchRadius: Boolean(positive(stateLike.tablePitchRadiusMm) || positive(stateLike.referencePitchRadiusMm)),
        bottleTableCad: false
      }
    });
  }

  global.Labeler3DPhysicalGeometryAdapter = Object.freeze({
    SCHEMA_VERSION,
    DEFAULT_WORLD_UNITS_PER_MM,
    REFERENCE_BOTTLE_HEIGHT_TO_DIAMETER,
    selectedBottleSpec,
    effectiveDiameterMm,
    snapshot
  });
})(window);
