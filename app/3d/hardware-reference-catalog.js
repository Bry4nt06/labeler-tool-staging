(function installServoForge3DHardwareReferenceCatalog(global) {
  "use strict";

  const CATALOG_VERSION = "servoforge.3d-hardware-reference.v2";
  const REFERENCE_SOURCE = "user-supplied-machine-photos-2026-08-18";
  const REFERENCE_SET = "labeler-hardware-photo-set-2";

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function evidence(observedFeatures, pendingMeasurements = [], confidence = "photo-confirmed") {
    return freeze({
      source: REFERENCE_SOURCE,
      referenceSet: REFERENCE_SET,
      confidence,
      observedFeatures: [...observedFeatures],
      pendingMeasurements: [...pendingMeasurements]
    });
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
      notes: "Photo-confirmed adjustable application arm with tubular supports/clamps, flat spender plate, peel edge, vertical guide roller, and label web path. Exact CAD dimensions remain provisional.",
      evidence: evidence([
        "flat rectangular spender/application plate",
        "plate mounted to adjustable tubular application arm",
        "multiple clamp-and-pivot adjustment joints",
        "vertical guide roller adjacent to label web",
        "peel/application edge faces bottle-table path",
        "label web travels across the plate toward the bottle path"
      ], [
        "spender plate length mm",
        "spender plate height mm",
        "spender plate thickness mm",
        "guide roller diameter mm",
        "guide roller height mm",
        "application-arm tube diameter mm",
        "arm pivot-to-plate distance mm",
        "plate face to bottle-table centerline distance mm"
      ]),
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
      notes: "Measured sponge/backing stack is authoritative. Photos confirm curved pad face, steel backing plate, dual-post mounting, crossbar support, and tangent placement beside the bottle-table path.",
      measuredFields: ["heightMm", "spongeThicknessMm", "backingPlateThicknessMm", "bottlePenetrationMm"],
      evidence: evidence([
        "curved orange/brown sponge contact face",
        "steel backing plate follows pad curvature",
        "pad follows bottle-table travel arc",
        "dual vertical support posts",
        "horizontal crossbar/adjustment structure",
        "pad face mounted tangent to bottle-table path"
      ], [
        "support post diameter mm",
        "support post center spacing mm",
        "crossbar diameter mm",
        "crossbar offset from pad face mm",
        "pad mounting center height relative to bottle table mm"
      ], "measured-contact-photo-confirmed-mounting"),
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
      notes: "Photos confirm vertical dark-rubber contact rollers with central shaft/hub, radial mounting arm, clamp hardware, and support post. Exact roller and mount dimensions remain unmeasured.",
      evidence: evidence([
        "vertical cylindrical dark-rubber contact roller",
        "central metal shaft/hub",
        "roller positioned directly beside bottle-table orbit",
        "radial mounting arm",
        "adjustable post-and-clamp support",
        "multiple roller stations distributed along the carousel"
      ], [
        "roller outside diameter mm",
        "roller contact height mm",
        "shaft diameter mm",
        "roller centerline to bottle-table centerline distance mm",
        "mounting arm length mm",
        "support post diameter mm"
      ]),
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
      notes: "Photos confirm a rigid coder head/enclosure beside the carousel with adjustable mounting hardware and a directed coding face toward the bottle path. Any visible beam remains presentation-only and never changes coder timing/orientation logic.",
      evidence: evidence([
        "coder head/enclosure mounted outside bottle-table path",
        "coding face aimed radially toward passing bottle",
        "rigid support bracket and adjustment hardware",
        "coder occupies a fixed machine-map station",
        "coder trigger/orientation remains a ServoForge runtime concern"
      ], [
        "coder housing width mm",
        "coder housing height mm",
        "coder housing depth mm",
        "coding aperture diameter/size mm",
        "coding face to bottle surface distance mm",
        "mount bracket offsets mm"
      ]),
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
      notes: "Photos confirm compact rectangular sensors on adjustable brackets/posts with visible status indication and a defined aim toward the bottle/label path. Existing ServoForge sensor/FOV data remains authoritative.",
      evidence: evidence([
        "compact rectangular sensor body",
        "front sensing face/lens",
        "visible status LED",
        "adjustable bracket/post mounting",
        "sensor aimed toward bottle/label path",
        "sensor placement tied to a fixed machine-map location"
      ], [
        "sensor body width mm",
        "sensor body height mm",
        "sensor body depth mm",
        "lens diameter mm",
        "sensor face to bottle surface distance mm",
        "mounting bracket length mm",
        "support post diameter mm"
      ]),
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
      evidence: evidence([], [
        "brush channel length mm",
        "brush channel height mm",
        "brush projection/extension mm",
        "mounting geometry"
      ], "reference-only"),
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

  function measurementBacklog() {
    return freeze(Object.fromEntries(Object.values(PROFILES).map((item) => [
      item.id,
      [...(item.evidence?.pendingMeasurements || [])]
    ])));
  }

  function status() {
    const values = Object.values(PROFILES);
    const photoProfiles = values.filter((item) => String(item.evidence?.confidence || "").includes("photo"));
    const measuredProfiles = values.filter((item) => item.dimensionalAuthority);
    return freeze({
      catalogVersion: CATALOG_VERSION,
      referenceSource: REFERENCE_SOURCE,
      referenceSet: REFERENCE_SET,
      profileCount: values.length,
      profiles: Object.keys(PROFILES),
      measuredProfiles: measuredProfiles.map((item) => item.id),
      photoReferenceProfiles: photoProfiles.map((item) => item.id),
      measuredProfileCount: measuredProfiles.length,
      photoReferenceProfileCount: photoProfiles.length,
      pendingMeasurementCount: values.reduce((total, item) => total + (item.evidence?.pendingMeasurements?.length || 0), 0),
      measurementBacklog: measurementBacklog()
    });
  }

  global.Labeler3DHardwareReferenceCatalog = freeze({
    CATALOG_VERSION,
    REFERENCE_SOURCE,
    REFERENCE_SET,
    PROFILES,
    KIND_TO_PROFILE,
    profile,
    profileIdForKind,
    resolve,
    measurementBacklog,
    status
  });
})(window);
