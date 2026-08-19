(function installServoForge3DWipeRollerModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.wipe-roller.v3-direct-head-hardware";
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const ROLLER_WIDTH_MM = 80;
  const SPINDLE_DIAMETER_MM = 8;
  const HUB_DIAMETER_MM = 18;
  const HUB_HEIGHT_MM = 8;
  const YOKE_PLATE_THICKNESS_MM = 4;
  const YOKE_TANGENTIAL_WIDTH_MM = 24;
  const YOKE_BACK_CLEARANCE_MM = 14;
  const PIVOT_BLOCK_RADIAL_MM = 18;
  const PIVOT_BLOCK_HEIGHT_MM = 26;
  const PIVOT_BLOCK_TANGENTIAL_MM = 24;
  const PIVOT_PIN_DIAMETER_MM = 8;
  const PIVOT_PIN_LENGTH_MM = 32;

  const PHOTO_MOUNT_REFERENCE = Object.freeze({
    source: "user-supplied-topmodul-roller-photos-2026-08-19",
    sourceImageCount: 7,
    dimensionalAuthority: false,
    rollerWidthMm: ROLLER_WIDTH_MM,
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
    directRollerHeadBoundary: Object.freeze([
      "black-sponge-roller",
      "vertical-spindle",
      "upper-lower-hubs",
      "u-shaped-top-bottom-yoke",
      "rear-yoke-bridge",
      "immediate-swivel-pivot-block",
      "pivot-pin"
    ]),
    hiddenStationMountBoundary: Object.freeze([
      "long-horizontal-link-arm",
      "vertical-riser-stanchion",
      "rail-clamp",
      "curved-mounting-rail",
      "rail-level-adjustment-handle"
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
      "The direct roller-head hardware ends at the swivel/pivot block immediately behind the yoke.",
      "The long linkage arm, riser, clamps, and curved rail remain reference-only in the current render.",
      "Photo proportions are reference-only until direct yoke, pivot-block, spindle, and roller-diameter measurements are supplied."
    ])
  });

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function unitsPerMm(geometry = {}) {
    return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
  }

  function bottleBaseYWorld() {
    return TABLE_Y + BOTTLE_LIFT;
  }

  function radial(position) {
    const x = number(position?.x);
    const z = number(position?.z);
    const magnitude = Math.hypot(x, z) || 1;
    return Object.freeze({ x: x / magnitude, z: z / magnitude });
  }

  function neckReference(geometry = {}, context = {}) {
    if (typeof context?.legacyFactory?.neckSlopeReference === "function") {
      return context.legacyFactory.neckSlopeReference(geometry);
    }
    const bottle = geometry?.bottle || {};
    const bodyTopMm = 10 + Math.max(1, number(bottle.bodyStraightHeightMm, 92));
    const shoulderTopMm = bodyTopMm + Math.max(1, number(bottle.shoulderTransitionHeightMm, 41.5));
    const finishStartMm = Math.max(
      shoulderTopMm + 1,
      number(bottle.referenceHeightMm, 241.5) - Math.max(1, number(bottle.finishHeightMm, 17))
    );
    return Object.freeze({
      targetYmm: (shoulderTopMm + finishStartMm) / 2,
      radialSlope: -0.12
    });
  }

  function rollerRadiusWorld(geometry = {}) {
    const bottleDiameter = Math.max(0.10, number(geometry?.bottle?.diameterWorld, 0.27));
    const ratios = global.Labeler3DHardwareReferenceCatalog?.profile?.("wipe-roller")?.visualRatios || {};
    return Math.max(0.10, bottleDiameter * number(ratios.rollerDiameterBottleDiameter, 0.72)) / 2;
  }

  function material(THREE, options) {
    return new THREE.MeshStandardMaterial(options);
  }

  function rollerHeadQuaternion(THREE, item, neck) {
    const outward = radial(item?.position);
    const slope = item?.side === "inner" ? number(neck.radialSlope) : -number(neck.radialSlope);
    const yAxis = new THREE.Vector3(outward.x * slope, 1, outward.z * slope).normalize();
    const mountSign = item?.side === "inner" ? -1 : 1;
    const mountRadial = new THREE.Vector3(outward.x * mountSign, 0, outward.z * mountSign);
    const xAxis = mountRadial.clone().addScaledVector(yAxis, -mountRadial.dot(yAxis)).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    return new THREE.Quaternion().setFromRotationMatrix(basis);
  }

  function addRollerCore(THREE, root, geometry, materials) {
    const scale = unitsPerMm(geometry);
    const rollerRadius = rollerRadiusWorld(geometry);
    const rollerWidth = ROLLER_WIDTH_MM * scale;

    const roller = new THREE.Mesh(
      new THREE.CylinderGeometry(rollerRadius, rollerRadius, rollerWidth, 48),
      materials.rubber
    );
    roller.name = "ServoForgeWipeRollerSponge";
    roller.castShadow = true;
    roller.receiveShadow = true;
    root.add(roller);

    const spindle = new THREE.Mesh(
      new THREE.CylinderGeometry(
        SPINDLE_DIAMETER_MM * scale / 2,
        SPINDLE_DIAMETER_MM * scale / 2,
        rollerWidth + 2 * (HUB_HEIGHT_MM + 8) * scale,
        24
      ),
      materials.metal
    );
    spindle.name = "ServoForgeWipeRollerSpindle";
    root.add(spindle);

    [-1, 1].forEach((sign) => {
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(
          HUB_DIAMETER_MM * scale / 2,
          HUB_DIAMETER_MM * scale / 2,
          HUB_HEIGHT_MM * scale,
          28
        ),
        materials.metal
      );
      hub.name = sign < 0 ? "ServoForgeWipeRollerHubLower" : "ServoForgeWipeRollerHubUpper";
      hub.position.y = sign * (rollerWidth / 2 + HUB_HEIGHT_MM * scale / 2);
      root.add(hub);
    });

    return Object.freeze({ rollerRadius, rollerWidth, roller });
  }

  function addDirectHeadHardware(THREE, root, geometry, core, materials) {
    const scale = unitsPerMm(geometry);
    const plateThickness = YOKE_PLATE_THICKNESS_MM * scale;
    const yokeWidth = YOKE_TANGENTIAL_WIDTH_MM * scale;
    const backX = core.rollerRadius + YOKE_BACK_CLEARANCE_MM * scale;
    const frontX = -core.rollerRadius * 0.15;
    const plateDepth = backX - frontX;
    const plateCenterX = (backX + frontX) / 2;
    const plateY = core.rollerWidth / 2 + HUB_HEIGHT_MM * scale + plateThickness / 2 + 1.5 * scale;

    [-1, 1].forEach((sign) => {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(plateDepth, plateThickness, yokeWidth),
        materials.metal
      );
      plate.name = sign < 0 ? "ServoForgeWipeRollerYokeLower" : "ServoForgeWipeRollerYokeUpper";
      plate.position.set(plateCenterX, sign * plateY, 0);
      plate.castShadow = true;
      root.add(plate);
    });

    const bridgeHeight = plateY * 2 + plateThickness;
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(plateThickness, bridgeHeight, yokeWidth),
      materials.metal
    );
    bridge.name = "ServoForgeWipeRollerYokeRearBridge";
    bridge.position.set(backX, 0, 0);
    bridge.castShadow = true;
    root.add(bridge);

    const pivotBlock = new THREE.Mesh(
      new THREE.BoxGeometry(
        PIVOT_BLOCK_RADIAL_MM * scale,
        PIVOT_BLOCK_HEIGHT_MM * scale,
        PIVOT_BLOCK_TANGENTIAL_MM * scale
      ),
      materials.castMetal
    );
    pivotBlock.name = "ServoForgeWipeRollerImmediatePivotBlock";
    pivotBlock.position.set(backX + (PIVOT_BLOCK_RADIAL_MM * scale) / 2 + 2 * scale, 0, 0);
    pivotBlock.castShadow = true;
    root.add(pivotBlock);

    const pivotPin = new THREE.Mesh(
      new THREE.CylinderGeometry(
        PIVOT_PIN_DIAMETER_MM * scale / 2,
        PIVOT_PIN_DIAMETER_MM * scale / 2,
        PIVOT_PIN_LENGTH_MM * scale,
        24
      ),
      materials.darkMetal
    );
    pivotPin.name = "ServoForgeWipeRollerPivotPin";
    pivotPin.rotation.x = Math.PI / 2;
    pivotPin.position.copy(pivotBlock.position);
    root.add(pivotPin);

    const pivotCap = new THREE.Mesh(
      new THREE.CylinderGeometry(7 * scale, 7 * scale, 3 * scale, 24),
      materials.metal
    );
    pivotCap.name = "ServoForgeWipeRollerPivotCap";
    pivotCap.rotation.x = Math.PI / 2;
    pivotCap.position.set(pivotBlock.position.x, pivotBlock.position.y, -PIVOT_PIN_LENGTH_MM * scale / 2 - 1.5 * scale);
    root.add(pivotCap);
  }

  function retainHiddenStationMountReference(item, group) {
    group.userData.rollerMountReference = Object.freeze({
      source: PHOTO_MOUNT_REFERENCE.source,
      referenceOnly: true,
      rendered: false,
      longLinkArmRendered: false,
      riserRendered: false,
      railClampRendered: false,
      mountingRailRendered: false,
      railAdjustmentHandleRendered: false,
      side: item?.side === "inner" ? "inner" : "outer",
      radialMirrorAuthority: "same-hardware-family-mirrored-by-side",
      railReferenceAuthority: "retained-not-rendered"
    });
  }

  function matches(item = {}) {
    return String(item?.kind || "").toLowerCase() === "roller";
  }

  function create(THREE, item, geometry, context = {}) {
    if (!THREE?.Group || !THREE?.Mesh) return null;

    const neck = neckReference(geometry, context);
    const scale = unitsPerMm(geometry);
    const rollerCenterY = Number.isFinite(Number(item?.contactHeightWorld))
      ? number(item.contactHeightWorld)
      : bottleBaseYWorld() + number(neck.targetYmm) * scale;

    const materials = Object.freeze({
      rubber: material(THREE, { color: 0x22282b, roughness: 0.92, metalness: 0.01 }),
      metal: material(THREE, { color: 0xb7bec1, roughness: 0.22, metalness: 0.90 }),
      castMetal: material(THREE, { color: 0x949da1, roughness: 0.34, metalness: 0.76 }),
      darkMetal: material(THREE, { color: 0x4d5559, roughness: 0.30, metalness: 0.82 })
    });

    const group = new THREE.Group();
    group.name = `ServoForgeWipeRollerHead-${String(item?.id || "roller")}`;
    group.position.set(number(item?.position?.x), 0, number(item?.position?.z));

    const headRoot = new THREE.Group();
    headRoot.name = "ServoForgeWipeRollerHeadRoot";
    headRoot.position.y = rollerCenterY;
    headRoot.quaternion.copy(rollerHeadQuaternion(THREE, item, neck));
    group.add(headRoot);

    const core = addRollerCore(THREE, headRoot, geometry, materials);
    addDirectHeadHardware(THREE, headRoot, geometry, core, materials);
    retainHiddenStationMountReference(item, group);

    group.userData.kind = "roller";
    group.userData.station = item?.station;
    group.userData.section = item?.section;
    group.userData.highlightMaterials = [materials.rubber];
    group.userData.hardwareReference = Object.freeze({
      profileId: "wipe-roller",
      modelVersion: MODEL_VERSION,
      rollerWidthMm: ROLLER_WIDTH_MM,
      rollerWidthAuthority: "user-specified-80mm",
      positionAuthority: "servoforge-machine-map-neck-contact",
      tiltAuthority: "existing-section-aware-neck-slope",
      directHeadHardwareAuthority: "user-machine-photo-backed-proportional",
      directHeadHardwareRendered: true,
      stationMountingHardwareRendered: false,
      mountingRailRendered: false,
      mountingReferenceRetained: true,
      dimensionalAuthority: false
    });
    return group;
  }

  global.Labeler3DWipeRollerModel = Object.freeze({
    id: "wipe-roller",
    MODEL_VERSION,
    matches,
    create,
    mountReference: PHOTO_MOUNT_REFERENCE,
    renderPolicy: Object.freeze({
      rollerVisible: true,
      spindleVisible: true,
      hubsVisible: true,
      yokeVisible: true,
      immediatePivotVisible: true,
      directRollerHardwareVisible: true,
      stationMountingHardwareVisible: false,
      mountingRailVisible: false,
      referenceGeometryRetained: true
    }),
    authority: Object.freeze({
      widthMm: ROLLER_WIDTH_MM,
      contact: "section-aware-neck-contact",
      mountingReference: "user-machine-photo-backed",
      mountingDimensionalAuthority: false,
      renderOwnership: "models/wipe-roller.js",
      migrationState: "native-model-geometry"
    })
  });
})(window);
