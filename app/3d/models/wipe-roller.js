(function installServoForge3DWipeRollerModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.wipe-roller.v2-photo-mount-reference";

  const PHOTO_MOUNT_REFERENCE = Object.freeze({
    source: "user-supplied-topmodul-roller-photos-2026-08-19",
    sourceImageCount: 7,
    dimensionalAuthority: false,
    rollerWidthMm: 80,
    renderedForNow: false,
    observedHierarchy: Object.freeze([
      "curved-round-carousel-mounting-rail",
      "split-clamps-on-curved-rail",
      "vertical-round-stanchions-risers",
      "individually-adjustable-roller-head-links",
      "rectangular-horizontal-link-arms",
      "cast-swivel-knuckle-blocks",
      "u-shaped-top-bottom-roller-yoke",
      "vertical-roller-spindle",
      "black-sponge-roller",
      "rail-level-adjustment-handle-lever"
    ]),
    layoutRules: Object.freeze({
      commonRailBackbone: true,
      eachRollerHeadIndividuallyAdjustable: true,
      insideAndOutsideUseSameHardwareFamily: true,
      insideOutsideRelationship: "same-hardware-family-mirrored-radially-across-bottle-path",
      rollerAxis: "approximately-vertical",
      mountingRailFollowsCarouselArc: true,
      preserveAsReferenceEvenWhenHidden: true
    }),
    notes: Object.freeze([
      "The curved round tube is the common mounting backbone visible around the carousel.",
      "Each roller head is supported by its own riser/link/knuckle chain from the common rail rather than by a single rigid multi-roller bracket.",
      "The roller is captured by a yoke around its upper and lower faces with an approximately vertical spindle.",
      "Photo proportions are reference-only until direct rail, post, arm, yoke, spindle, and roller-diameter measurements are supplied."
    ])
  });

  function matches(item = {}) {
    return String(item?.kind || "").toLowerCase() === "roller";
  }

  function create(THREE, item, geometry, context = {}) {
    return context.legacyFactory?.createEquipmentAssembly?.(THREE, item, geometry) || null;
  }

  global.Labeler3DWipeRollerModel = Object.freeze({
    id: "wipe-roller",
    MODEL_VERSION,
    matches,
    create,
    mountReference: PHOTO_MOUNT_REFERENCE,
    renderPolicy: Object.freeze({
      rollerVisible: true,
      mountingHardwareVisible: false,
      mountingRailVisible: false,
      referenceGeometryRetained: true
    }),
    authority: Object.freeze({
      widthMm: 80,
      contact: "section-aware-neck-contact",
      mountingReference: "user-machine-photo-backed-stored-but-hidden",
      mountingDimensionalAuthority: false,
      renderOwnership: "models/wipe-roller.js",
      migrationState: "registry-routed-legacy-backed"
    })
  });
})(window);
