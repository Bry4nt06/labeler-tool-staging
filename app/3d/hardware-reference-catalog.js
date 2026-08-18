(function installServoForge3DHardwareReferenceCatalog(global) {
  "use strict";

  const CATALOG_VERSION = "servoforge.3d-hardware-reference.v1";
  const REFERENCE_SOURCE = "user-supplied-machine-photos-2026-08-18";

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  const PROFILES = freeze({
    "application-spender": {
      id: "application-spender",
      label: "Application arm / spender plate",
      family: "application",
      mapKinds: ["aggregate", "gripper"],
      visualSource: REFERENCE_SOURCE,
      dimensionalAuthority: false,
      mechanicalHierarchyAuthority: true,
      notes: "Photo-referenced support post, adjustable arm, pivot clamps, plate body, peel edge, and label web. Exact CAD dimensions remain provisional.",
      visualRatios: {
        armLengthBottleDiameters: 2.0,
        plateLengthBottleDiameters: 1.65,
        plateHeightBottleHeights: 0.43,
        plateThicknessBottleDiameters: 0.10,
        clampDiameterBottleDiameters: 0.48,
        supportPostBottleDiameters: 0.42
      }
    },
    "wipe-pad": {
      id: "wipe-pad",
      label: "Curved wipe-down pad",
      family: "wipe",
      mapKinds: ["pad"],
      visualSource: "user-measured-machine-2026-08-17-plus-user-supplied-machine-photos-2026-08-18",
      dimensionalAuthority: true,
      mechanicalHierarchyAuthority: true,
      notes: "Measured sponge/backing stack is authoritative. Mounting posts and crossbars remain photo-reference proportions.",
      measuredFields: ["heightMm", "spongeThicknessMm", "backingPlateThicknessMm", "bottlePenetrationMm"],
      visualRatios: {
        supportPostDiameterPadHeight: 0.12,
        supportPostHeightPadHeight: 1.7,
        crossbarDiameterPadHeight: 0.11,
        crossbarLengthPadArc: 0.72
      }
    },
    "wipe-roller": {
      id: "wipe-roller",
      label: "Bottle wipe roller assembly",
      family: "wipe",
      mapKinds: ["roller"],
      visualSource: REFERENCE_SOURCE,
      dimensionalAuthority: false,
      mechanicalHierarchyAuthority: true,
      notes: "Photo-referenced rubber roller, center hub/shaft, mounting arm, clamp, and support post. Exact roller diameter and shaft dimensions are not yet measured.",
      visualRatios: {
        rollerDiameterBottleDiameter: 0.72,
        rollerHeightBottleHeight: 0.28,
        shaftDiameterRollerDiameter: 0.22,
        supportPostDiameterRollerDiameter: 0.26,
        supportPostHeightRollerHeight: 1.65,
        armLengthRollerDiameter: 1.25
      }
    },
    "laser-coder": {
      id: "laser-coder",
      label: "Laser coder / coding head",
      family: "coding",
      mapKinds: ["coding"],
      visualSource: REFERENCE_SOURCE,
      dimensionalAuthority: false,
      mechanicalHierarchyAuthority: true,
      notes: "Photo-referenced enclosure/head, emitter face, mounting bracket, and aiming beam. The beam is presentation-only and does not change coder timing or orientation logic.",
      visualRatios: {
        housingWidthBottleDiameters: 1.45,
        housingDepthBottleDiameters: 1.05,
        housingHeightBottleHeights: 0.58,
        emitterDiameterBottleDiameter: 0.26,
        emitterProjectionBottleDiameter: 0.48,
        bracketLengthBottleDiameters: 1.1
      }
    },
    "label-sensor": {
      id: "label-sensor",
      label: "Label / registration sensor",
      family: "sensor",
      mapKinds: ["sensor"],
      visualSource: REFERENCE_SOURCE,
      dimensionalAuthority: false,
      mechanicalHierarchyAuthority: true,
      notes: "Photo-referenced compact sensor body, lens, status LED, slotted bracket, and aim indicator. Existing ServoForge sensor/FOV data remains authoritative.",
      visualRatios: {
        bodyWidthBottleDiameter: 0.46,
        bodyDepthBottleDiameter: 0.36,
        bodyHeightBottleDiameter: 0.62,
        lensDiameterBodyWidth: 0.34,
        bracketLengthBottleDiameter: 0.82,
        postDiameterBottleDiameter: 0.12
      }
    },
    "brush-channel": {
      id: "brush-channel",
      label: "Brush / brush channel",
      family: "wipe",
      mapKinds: ["brush", "brush-channel"],
      visualSource: "servoforge-reference-geometry",
      dimensionalAuthority: false,
      mechanicalHierarchyAuthority: false,
      notes: "Reference-only until dedicated Cold Glue hardware measurements and photos are captured.",
      visualRatios: {}
    }
  });

  const KIND_TO_PROFILE = freeze({
    pad: "wipe-pad",
    roller: "wipe-roller",
    coding: "laser-coder",
    sensor: "label-sensor",
    brush: "brush-channel",
    "brush-channel": "brush-channel",
    gripper: "application-spender"
  });

  function profile(id) {
    return PROFILES[String(id || "")] || null;
  }

  function profileIdForKind(kind) {
    return KIND_TO_PROFILE[String(kind || "")] || null;
  }

  function resolve(item = {}) {
    const profileId = item?.hardwareProfileId
      || (item?.aggregate ? "application-spender" : profileIdForKind(item?.kind));
    return profile(profileId);
  }

  function status() {
    return freeze({
      catalogVersion: CATALOG_VERSION,
      referenceSource: REFERENCE_SOURCE,
      profileCount: Object.keys(PROFILES).length,
      profiles: Object.keys(PROFILES),
      measuredProfiles: Object.values(PROFILES).filter((item) => item.dimensionalAuthority).map((item) => item.id),
      photoReferenceProfiles: Object.values(PROFILES).filter((item) => item.visualSource === REFERENCE_SOURCE).map((item) => item.id)
    });
  }

  global.Labeler3DHardwareReferenceCatalog = freeze({
    CATALOG_VERSION,
    REFERENCE_SOURCE,
    PROFILES,
    KIND_TO_PROFILE,
    profile,
    profileIdForKind,
    resolve,
    status
  });
})(window);
