(function installServoForge3DLabelGeometryAdapter(global) {
  "use strict";

  const SCHEMA_VERSION = "servoforge.3d-labels.v1";
  const SECTION_ORDER = Object.freeze(["neck", "body", "back"]);
  const CENTER_ANGLES = Object.freeze({ neck: 0, body: 0, back: 180 });
  const REFERENCE_VERTICALS = Object.freeze({
    bodyBottomMm: 24,
    bodyHeightMm: 54,
    backBottomMm: 27,
    backHeightMm: 48
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

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function selectedLabelSpec(stateLike = {}) {
    const specs = Array.isArray(stateLike.labelSpecs) ? stateLike.labelSpecs : [];
    const brand = String(stateLike.selectedBrand || "").trim();
    return specs.find((spec) => String(spec?.brand || "").trim() === brand) || specs[0] || null;
  }

  function sectionLengthMm(spec, section) {
    if (section === "neck") return positive(spec?.neckLengthMm);
    if (section === "body") return positive(spec?.bodyLengthMm);
    if (section === "back") return positive(spec?.backLengthMm);
    return null;
  }

  function sectionEnabled(spec, section) {
    const explicit = spec?.enabledLabelSections?.[section];
    if (explicit === false) return false;
    return Boolean(sectionLengthMm(spec, section));
  }

  function applicationAngleForSection(machineMap, section) {
    const map = machineMap && typeof machineMap === "object" ? machineMap : {};
    const sections = map.stationSections && typeof map.stationSections === "object" ? map.stationSections : {};
    const aggregateAngles = map.aggregateAngles && typeof map.aggregateAngles === "object" ? map.aggregateAngles : {};
    const stationAngles = map.stationAngles && typeof map.stationAngles === "object" ? map.stationAngles : {};
    const candidates = Object.entries(sections)
      .filter(([, value]) => String(value || "").toLowerCase() === section)
      .map(([station]) => ({
        station: Number(station),
        angle: Number.isFinite(Number(aggregateAngles[station]))
          ? Number(aggregateAngles[station])
          : Number(stationAngles[station])
      }))
      .filter((entry) => Number.isFinite(entry.station) && Number.isFinite(entry.angle))
      .sort((left, right) => left.station - right.station);
    if (candidates.length) return normalizeAngle(candidates[0].angle);

    const fallbackStation = section === "neck" ? 1 : section === "body" ? 3 : 5;
    const fallback = Number.isFinite(Number(aggregateAngles[String(fallbackStation)]))
      ? Number(aggregateAngles[String(fallbackStation)])
      : Number(stationAngles[String(fallbackStation)]);
    return Number.isFinite(fallback) ? normalizeAngle(fallback) : null;
  }

  function wrapDegrees(spec, section, geometry) {
    const length = sectionLengthMm(spec, section);
    if (!length) return 0;
    if (section === "neck") {
      const circumference = positive(spec?.neckBottomCircumferenceMm);
      if (circumference) return clamp((length / circumference) * 360, 8, 330);
    }
    const diameter = positive(geometry?.bottle?.effectiveDiameterMm);
    if (!diameter) return 90;
    return clamp((length / (Math.PI * diameter)) * 360, 8, 330);
  }

  function verticalPlacement(spec, section, geometry) {
    const bodyTop = number(geometry?.bottle?.bodyStraightHeightMm, 92) + 10;
    const shoulderTop = bodyTop + number(geometry?.bottle?.shoulderTransitionHeightMm, 41.5);
    if (section === "neck") {
      const storedHeight = positive(spec?.neckHeightMm);
      const heightMm = storedHeight || 36;
      return {
        bottomMm: shoulderTop,
        topMm: shoulderTop + heightMm,
        heightMm,
        heightAuthority: Boolean(storedHeight),
        verticalPlacementAuthority: false,
        verticalSource: storedHeight ? "stored-neck-height-reference-bottom" : "reference-neck-height-and-bottom"
      };
    }
    const bottomMm = section === "back" ? REFERENCE_VERTICALS.backBottomMm : REFERENCE_VERTICALS.bodyBottomMm;
    const heightMm = section === "back" ? REFERENCE_VERTICALS.backHeightMm : REFERENCE_VERTICALS.bodyHeightMm;
    return {
      bottomMm,
      topMm: bottomMm + heightMm,
      heightMm,
      heightAuthority: false,
      verticalPlacementAuthority: false,
      verticalSource: "reference-until-body-back-label-height-is-stored"
    };
  }

  function bottleHasPassedApplication(tableAngle, applicationAngle) {
    if (!Number.isFinite(Number(applicationAngle))) return true;
    return normalizeAngle(tableAngle) + 0.001 >= normalizeAngle(applicationAngle);
  }

  function snapshot(stateLike = {}, geometry = {}, machineMap = null, tableAngle = 0) {
    const spec = selectedLabelSpec(stateLike);
    const unitsPerMm = positive(geometry?.renderScale?.worldUnitsPerMm, 0.00445);
    const sections = {};

    SECTION_ORDER.forEach((section) => {
      const enabled = sectionEnabled(spec, section);
      const vertical = verticalPlacement(spec, section, geometry);
      const applicationAngleDegrees = applicationAngleForSection(machineMap, section);
      sections[section] = freeze({
        section,
        enabled,
        applied: enabled && bottleHasPassedApplication(tableAngle, applicationAngleDegrees),
        centerAngleDegrees: CENTER_ANGLES[section],
        wrapDegrees: enabled ? wrapDegrees(spec, section, geometry) : 0,
        sourceLengthMm: sectionLengthMm(spec, section),
        applicationAngleDegrees,
        applicationAngleAuthority: Number.isFinite(Number(applicationAngleDegrees)),
        bottomMm: vertical.bottomMm,
        topMm: vertical.topMm,
        heightMm: vertical.heightMm,
        bottomWorld: vertical.bottomMm * unitsPerMm,
        topWorld: vertical.topMm * unitsPerMm,
        heightWorld: vertical.heightMm * unitsPerMm,
        heightAuthority: vertical.heightAuthority,
        verticalPlacementAuthority: vertical.verticalPlacementAuthority,
        verticalSource: vertical.verticalSource,
        wrapAuthority: enabled ? "active-servoforge-label-spec" : "none",
        artworkAuthority: false
      });
    });

    return freeze({
      schemaVersion: SCHEMA_VERSION,
      brand: String(spec?.brand || stateLike.selectedBrand || "Active label"),
      bottleType: String(spec?.bottleType || geometry?.bottle?.bottleType || ""),
      applicationMode: String(spec?.applicationMode || stateLike.applicationMode || "apl"),
      activeSections: SECTION_ORDER.filter((section) => sections[section].enabled),
      appliedSections: SECTION_ORDER.filter((section) => sections[section].applied),
      tableAngleDegrees: normalizeAngle(tableAngle),
      sectionCenterAuthority: "servoforge-front-datum-neck-body-back-opposite",
      wrapAuthority: "active-label-spec-length",
      artworkAuthority: false,
      bodyBackVerticalAuthority: false,
      neckHeightAuthority: Boolean(positive(spec?.neckHeightMm)),
      sections
    });
  }

  global.Labeler3DLabelGeometryAdapter = Object.freeze({
    SCHEMA_VERSION,
    SECTION_ORDER,
    CENTER_ANGLES,
    REFERENCE_VERTICALS,
    selectedLabelSpec,
    applicationAngleForSection,
    wrapDegrees,
    verticalPlacement,
    bottleHasPassedApplication,
    snapshot
  });
})(window);
