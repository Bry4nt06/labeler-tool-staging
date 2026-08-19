(function installServoForge3DWipeRollerModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.wipe-roller.v8-clamp-only-away-from-bottles";
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const ROLLER_WIDTH_MM = 80;
  const SPINDLE_DIAMETER_MM = 8;
  const HUB_DIAMETER_MM = 18;
  const HUB_HEIGHT_MM = 8;
  const YOKE_PLATE_THICKNESS_MM = 4;
  const YOKE_TANGENTIAL_WIDTH_MM = 24;
  const YOKE_RADIAL_LENGTH_MM = 28;
  const YOKE_ROLLER_CLEARANCE_MM = 2;
  const PIVOT_BLOCK_RADIAL_MM = 18;
  const PIVOT_BLOCK_HEIGHT_MM = 26;
  const PIVOT_BLOCK_TANGENTIAL_MM = 24;
  const PIVOT_PIN_DIAMETER_MM = 8;
  const PIVOT_PIN_LENGTH_MM = 32;

  const STANDING_RULES = Object.freeze({
    source: "user-machine-rule-2026-08-19",
    appliesToBothSides: true,
    rollerIsBottleFacingTerminal: true,
    immediateClampHardwareOnly: true,
    mountingRailRendered: false,
    longExtensionHardwareRendered: false,
    mountingReferenceRetained: true,
    immediateHardwareExtendsAwayFromBottle: true,
    hardwareNeverBetweenBottleAndRoller: true,
    everyImmediateHardwareCenterlineCollinearWithCarouselCenter: true,
    radialCenterlineAuthority: "exact-carousel-center-through-roller-station-center",
    radialTarget: "exact-carousel-center-0-0",
    innerHardwareDirection: "radially-inward-toward-carousel-center-away-from-inner-bottle-side",
    outerHardwareDirection: "radially-outward-away-from-carousel-center-away-from-outer-bottle-side",
    rollerTiltIndependentFromHardwareAzimuth: true
  });

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
    visibleBoundary: Object.freeze([
      "black-sponge-roller",
      "vertical-spindle",
      "upper-lower-hubs",
      "u-shaped-top-bottom-roller-yoke",
      "rear-yoke-bridge",
      "immediate-swivel-pivot-block",
      "pivot-pin"
    ]),
    referenceOnlyBoundary: Object.freeze([
      "long-horizontal-link-arm",
      "vertical-riser-stanchion",
      "rail-clamp",
      "curved-mounting-rail",
      "rail-level-adjustment-handle"
    ]),
    layoutRules: Object.freeze({
      eachRollerHeadIndividuallyAdjustable: true,
      insideAndOutsideUseSameHardwareFamily: true,
      rollerAxis: "approximately-vertical",
      rollerIsBottleFacingTerminal: true,
      immediateHardwareExtendsAwayFromBottle: true,
      hardwareNeverBetweenBottleAndRoller: true,
      immediateHardwareOnSingleCarouselRadialCenterline: true,
      railAndLongMountingHardwareReferenceOnly: true
    }),
    notes: Object.freeze([
      "Only the roller core and immediate clamp/yoke/pivot hardware render in this build.",
      "The rail, risers, long linkage arms, and rail clamps remain stored as machine-reference authority but do not render.",
      "For an inner roller, the bottle is radially outward of the roller, so immediate hardware extends radially inward toward carousel center.",
      "For an outer roller, the bottle is radially inward of the roller, so immediate hardware extends radially outward away from carousel center.",
      "The roller remains the bottle-facing terminal piece on both sides."
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
    return Object.freeze({ x: x / magnitude, z: z / magnitude, radius: magnitude });
  }

  function hardwareDirectionSignForSide(side) {
    // Neck-contact placement puts inner rollers radially inside the bottle center
    // and outer rollers radially outside the bottle center. Hardware must always
    // leave the roller on the opposite side from the bottle:
    // inner -> farther inward (-radial), outer -> farther outward (+radial).
    return side === "inner" ? -1 : 1;
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

  function hardwareRadialQuaternion(THREE, item) {
    const outward = radial(item?.position);
    const sign = hardwareDirectionSignForSide(item?.side);
    const xAxis = new THREE.Vector3(outward.x * sign, 0, outward.z * sign).normalize();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
    );
  }

  function rollerTiltQuaternion(THREE, item, neck) {
    const outward = radial(item?.position);
    const slope = item?.side === "inner" ? number(neck.radialSlope) : -number(neck.radialSlope);
    const rollerAxis = new THREE.Vector3(
      outward.x * slope,
      1,
      outward.z * slope
    ).normalize();
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      rollerAxis
    );
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

  function addImmediateClampHardware(THREE, root, geometry, core, materials) {
    const scale = unitsPerMm(geometry);
    const plateThickness = YOKE_PLATE_THICKNESS_MM * scale;
    const yokeWidth = YOKE_TANGENTIAL_WIDTH_MM * scale;

    // Local +X is guaranteed to point away from the bottle. Start the yoke just
    // behind the roller's away-side tangent so no clamp geometry can appear
    // between the bottle and the roller.
    const frontX = core.rollerRadius + YOKE_ROLLER_CLEARANCE_MM * scale;
    const backX = frontX + YOKE_RADIAL_LENGTH_MM * scale;
    const plateDepth = backX - frontX;
    const plateCenterX = (frontX + backX) / 2;
    const plateY = core.rollerWidth / 2 + HUB_HEIGHT_MM * scale + plateThickness / 2 + 1.5 * scale;

    [-1, 1].forEach((sign) => {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(plateDepth, plateThickness, yokeWidth),
        materials.metal
      );
      plate.name = sign < 0 ? "ServoForgeWipeRollerYokeLower" : "ServoForgeWipeRollerYokeUpper";
      plate.position.set(plateCenterX, sign * plateY, 0);
      plate.castShadow = true;
      plate.userData.radialCenterlineMember = true;
      plate.userData.hardwareSide = "away-from-bottle";
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
    bridge.userData.radialCenterlineMember = true;
    bridge.userData.hardwareSide = "away-from-bottle";
    root.add(bridge);

    const pivotBlockCenterX = backX + (PIVOT_BLOCK_RADIAL_MM * scale) / 2 + 2 * scale;
    const pivotBlock = new THREE.Mesh(
      new THREE.BoxGeometry(
        PIVOT_BLOCK_RADIAL_MM * scale,
        PIVOT_BLOCK_HEIGHT_MM * scale,
        PIVOT_BLOCK_TANGENTIAL_MM * scale
      ),
      materials.castMetal
    );
    pivotBlock.name = "ServoForgeWipeRollerImmediatePivotBlock";
    pivotBlock.position.set(pivotBlockCenterX, 0, 0);
    pivotBlock.castShadow = true;
    pivotBlock.userData.radialCenterlineMember = true;
    pivotBlock.userData.hardwareSide = "away-from-bottle";
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
    pivotPin.userData.radialCenterlineMember = true;
    pivotPin.userData.hardwareSide = "away-from-bottle";
    root.add(pivotPin);

    const pivotCap = new THREE.Mesh(
      new THREE.CylinderGeometry(7 * scale, 7 * scale, 3 * scale, 24),
      materials.metal
    );
    pivotCap.name = "ServoForgeWipeRollerPivotCap";
    pivotCap.rotation.x = Math.PI / 2;
    pivotCap.position.set(
      pivotBlock.position.x,
      pivotBlock.position.y,
      -PIVOT_PIN_LENGTH_MM * scale / 2 - 1.5 * scale
    );
    pivotCap.userData.radialCenterlineMember = true;
    pivotCap.userData.hardwareSide = "away-from-bottle";
    root.add(pivotCap);
  }

  function retainMountingReference(item, group) {
    group.userData.rollerMountReference = Object.freeze({
      source: PHOTO_MOUNT_REFERENCE.source,
      referenceOnly: true,
      rendered: false,
      mountingRailRendered: false,
      longExtensionArmRendered: false,
      riserRendered: false,
      railClampRendered: false,
      railAdjustmentHandleRendered: false,
      immediateClampHardwareRendered: true,
      side: item?.side === "inner" ? "inner" : "outer",
      hardwareDirectionSign: hardwareDirectionSignForSide(item?.side),
      hardwareDirectionAuthority: "opposite-bottle-side-of-roller",
      radialCenterlineAuthority: STANDING_RULES.radialCenterlineAuthority,
      photoReferenceRetained: true
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

    const rollerTiltRoot = new THREE.Group();
    rollerTiltRoot.name = "ServoForgeWipeRollerTiltRoot";
    rollerTiltRoot.position.y = rollerCenterY;
    rollerTiltRoot.quaternion.copy(rollerTiltQuaternion(THREE, item, neck));
    group.add(rollerTiltRoot);

    const core = addRollerCore(THREE, rollerTiltRoot, geometry, materials);

    const hardwareRoot = new THREE.Group();
    hardwareRoot.name = "ServoForgeWipeRollerHardwareRadialRoot";
    hardwareRoot.position.y = rollerCenterY;
    hardwareRoot.quaternion.copy(hardwareRadialQuaternion(THREE, item));
    hardwareRoot.userData.radialCenterlineAuthority = STANDING_RULES.radialCenterlineAuthority;
    hardwareRoot.userData.hardwareDirection = "away-from-bottle";
    group.add(hardwareRoot);

    addImmediateClampHardware(THREE, hardwareRoot, geometry, core, materials);
    retainMountingReference(item, group);

    group.userData.kind = "roller";
    group.userData.station = item?.station;
    group.userData.section = item?.section;
    group.userData.highlightMaterials = [materials.rubber];
    group.userData.standingRules = STANDING_RULES;
    group.userData.hardwareReference = Object.freeze({
      profileId: "wipe-roller",
      modelVersion: MODEL_VERSION,
      rollerWidthMm: ROLLER_WIDTH_MM,
      rollerWidthAuthority: "user-specified-80mm",
      positionAuthority: "servoforge-machine-map-neck-contact",
      tiltAuthority: "existing-section-aware-neck-slope",
      immediateClampAuthority: "user-machine-photo-backed-proportional",
      immediateClampHardwareRendered: true,
      mountingRailRendered: false,
      longExtensionHardwareRendered: false,
      mountingReferenceRetained: true,
      rollerIsBottleFacingTerminal: true,
      immediateHardwareExtendsAwayFromBottle: true,
      hardwareNeverBetweenBottleAndRoller: true,
      hardwareDirectionSign: hardwareDirectionSignForSide(item?.side),
      radialCenterlineAuthority: STANDING_RULES.radialCenterlineAuthority,
      dimensionalAuthority: false
    });
    return group;
  }

  global.Labeler3DWipeRollerModel = Object.freeze({
    id: "wipe-roller",
    MODEL_VERSION,
    matches,
    create,
    standingRules: STANDING_RULES,
    mountReference: PHOTO_MOUNT_REFERENCE,
    renderPolicy: Object.freeze({
      rollerVisible: true,
      spindleVisible: true,
      hubsVisible: true,
      yokeVisible: true,
      immediatePivotVisible: true,
      immediateClampHardwareVisible: true,
      extensionHardwareVisible: false,
      stationMountingHardwareVisible: false,
      mountingRailVisible: false,
      detailedClampsVisible: false,
      referenceGeometryRetained: true
    }),
    authority: Object.freeze({
      widthMm: ROLLER_WIDTH_MM,
      contact: "section-aware-neck-contact",
      mountingReference: "user-machine-photo-backed-reference-only",
      mountingDimensionalAuthority: false,
      rollerIsBottleFacingTerminal: true,
      immediateHardwareExtendsAwayFromBottle: true,
      hardwareDirectionAuthority: "opposite-bottle-side-of-roller",
      radialCenterlineAuthority: STANDING_RULES.radialCenterlineAuthority,
      renderOwnership: "models/wipe-roller.js",
      migrationState: "native-model-geometry"
    })
  });
})(window);
