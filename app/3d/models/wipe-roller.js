(function installServoForge3DWipeRollerModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.wipe-roller.v9-yoke-free";
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const ROLLER_WIDTH_MM = 80;
  const SPINDLE_DIAMETER_MM = 8;
  const HUB_DIAMETER_MM = 18;
  const HUB_HEIGHT_MM = 8;
  const PIVOT_BLOCK_RADIAL_MM = 18;
  const PIVOT_BLOCK_HEIGHT_MM = 26;
  const PIVOT_BLOCK_TANGENTIAL_MM = 24;
  const PIVOT_BLOCK_CLEARANCE_MM = 4;
  const PIVOT_PIN_DIAMETER_MM = 8;
  const PIVOT_PIN_LENGTH_MM = 32;

  const STANDING_RULES = Object.freeze({
    source: "user-machine-rule-2026-08-19",
    appliesToBothSides: true,
    rollerIsBottleFacingTerminal: true,
    yokesRendered: false,
    yokesReferenceOnly: true,
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
      "u-shaped-top-bottom-roller-yoke-reference-only",
      "vertical-roller-spindle",
      "black-sponge-roller",
      "rail-level-adjustment-handle-lever"
    ]),
    visibleBoundary: Object.freeze([
      "black-sponge-roller",
      "vertical-spindle",
      "upper-lower-hubs",
      "immediate-swivel-pivot-block",
      "pivot-pin"
    ]),
    referenceOnlyBoundary: Object.freeze([
      "upper-lower-roller-yokes",
      "rear-yoke-bridge",
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
      yokesDoNotRender: true,
      immediateHardwareExtendsAwayFromBottle: true,
      hardwareNeverBetweenBottleAndRoller: true,
      immediateHardwareOnSingleCarouselRadialCenterline: true,
      railAndLongMountingHardwareReferenceOnly: true
    }),
    notes: Object.freeze([
      "Roller yokes are retained only as photo/mechanical reference and are intentionally not rendered.",
      "The visible roller head is the sponge roller, spindle, hubs, and immediate pivot block/pin only.",
      "The rail, risers, long linkage arms, rail clamps, and yokes remain stored as machine-reference authority but do not render.",
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

  function addImmediatePivotHardware(THREE, root, geometry, core, materials) {
    const scale = unitsPerMm(geometry);
    const pivotBlockCenterX = core.rollerRadius
      + PIVOT_BLOCK_CLEARANCE_MM * scale
      + (PIVOT_BLOCK_RADIAL_MM * scale) / 2;

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
      yokesRendered: false,
      mountingRailRendered: false,
      longExtensionArmRendered: false,
      riserRendered: false,
      railClampRendered: false,
      railAdjustmentHandleRendered: false,
      immediatePivotHardwareRendered: true,
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

    addImmediatePivotHardware(THREE, hardwareRoot, geometry, core, materials);
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
      yokesRendered: false,
      immediatePivotAuthority: "user-machine-photo-backed-proportional",
      immediatePivotHardwareRendered: true,
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
      yokeVisible: false,
      rearYokeBridgeVisible: false,
      immediatePivotVisible: true,
      extensionHardwareVisible: false,
      stationMountingHardwareVisible: false,
      mountingRailVisible: false,
      referenceGeometryRetained: true
    }),
    authority: Object.freeze({
      widthMm: ROLLER_WIDTH_MM,
      contact: "section-aware-neck-contact",
      mountingReference: "user-machine-photo-backed-reference-only",
      mountingDimensionalAuthority: false,
      yokeRenderAuthority: "removed-from-entire-rendering-by-user-direction",
      rollerIsBottleFacingTerminal: true,
      immediateHardwareExtendsAwayFromBottle: true,
      hardwareDirectionAuthority: "opposite-bottle-side-of-roller",
      radialCenterlineAuthority: STANDING_RULES.radialCenterlineAuthority,
      renderOwnership: "models/wipe-roller.js",
      migrationState: "native-model-geometry"
    })
  });
})(window);
