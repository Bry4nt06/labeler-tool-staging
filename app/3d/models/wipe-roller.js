(function installServoForge3DWipeRollerModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.wipe-roller.v7-flipped-sides-rail-extension";
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
  const MOUNT_RAIL_DIAMETER_MM = 14;
  const MOUNT_RISER_DIAMETER_MM = 12;
  const MOUNT_STANDOFF_MM = 125;
  const MOUNT_RAIL_DROP_MM = 72;
  const EXTENSION_BAR_HEIGHT_MM = 10;
  const EXTENSION_BAR_DEPTH_MM = 14;
  const RAIL_ARC_PADDING_DEGREES = 4;
  const SINGLE_RAIL_HALF_SPAN_DEGREES = 6;

  const STANDING_RULES = Object.freeze({
    source: "user-machine-rule-2026-08-19",
    appliesToBothSides: true,
    rollerIsBottleFacingTerminal: true,
    mountingHardwareExtendsAwayFromBottle: true,
    mountingSidesFlippedFromV204: true,
    innerHardwareUsesOutwardHalfLine: true,
    outerHardwareUsesInwardHalfLine: true,
    everyHardwareCenterlineCollinearWithCarouselCenter: true,
    directHeadHardwareOnSingleCarouselRadialCenterline: true,
    radialCenterlineAuthority: "exact-carousel-center-through-roller-station-center",
    radialTarget: "exact-carousel-center-0-0",
    sideOnlySelectsHalfLineDirection: true,
    rollerTiltIndependentFromHardwareAzimuth: true,
    sharedCurvedRailIsCircumferentialBackbone: true,
    sharedCurvedRailRendered: true,
    extensionRodsConnectToCurvedRail: true,
    extensionRodsStayOnStationRadialLine: true
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
    directRollerHeadBoundary: Object.freeze([
      "black-sponge-roller",
      "vertical-spindle",
      "upper-lower-hubs",
      "u-shaped-top-bottom-yoke",
      "rear-yoke-bridge",
      "immediate-swivel-pivot-block",
      "pivot-pin"
    ]),
    visibleStationMountBoundary: Object.freeze([
      "rectangular-horizontal-link-arm",
      "vertical-round-riser",
      "curved-round-carousel-mounting-rail"
    ]),
    hiddenStationMountBoundary: Object.freeze([
      "detailed-split-rail-clamps",
      "rail-level-adjustment-handle",
      "secondary-fasteners"
    ]),
    layoutRules: Object.freeze({
      commonRailBackbone: true,
      eachRollerHeadIndividuallyAdjustable: true,
      insideAndOutsideUseSameHardwareFamily: true,
      insideOutsideRelationship: "same-hardware-family-opposite-half-lines-on-one-carousel-radial-axis",
      rollerAxis: "approximately-vertical",
      mountingRailFollowsCarouselArc: true,
      rollerIsBottleFacingTerminal: true,
      mountingHardwareExtendsAwayFromBottle: true,
      everyHardwareCenterlineCollinearWithCarouselCenter: true,
      rollerTiltIndependentFromHardwareAzimuth: true,
      mountingSidesFlippedFromV204: true,
      extensionRodsTerminateAtCurvedRail: true
    }),
    notes: Object.freeze([
      "The roller station position does not move when mounting sides are corrected.",
      "Inner and outer hardware use the opposite radial half-lines from v204 so the bracket no longer intersects the bottle path.",
      "A straight line drawn from the exact carousel center through a roller station remains the hardware centerline for that station.",
      "The extension arm and riser connect each roller head back to the shared curved mounting rail.",
      "Roller neck tilt is applied only to the roller/spindle core and is not allowed to yaw the mounting hardware off the radial line in top view.",
      "Rail, riser, and extension dimensions remain photo-proportional until direct measurements are supplied."
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

  function halfLineSignForSide(side) {
    return side === "inner" ? 1 : -1;
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
    const halfLineSign = halfLineSignForSide(item?.side);
    const xAxis = new THREE.Vector3(
      outward.x * halfLineSign,
      0,
      outward.z * halfLineSign
    ).normalize();
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

  function cylinderBetweenPoints(THREE, start, end, radius, meshMaterial, segments = 24) {
    const a = start.clone();
    const b = end.clone();
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = Math.max(0.000001, delta.length());
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), meshMaterial);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }

  function boxBetweenPoints(THREE, start, end, height, depth, meshMaterial) {
    const a = start.clone();
    const b = end.clone();
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = Math.max(0.000001, delta.length());
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, depth), meshMaterial);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
    return mesh;
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
      plate.userData.radialCenterlineMember = true;
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
    pivotBlock.userData.radialCenterlineMember = true;
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
    root.add(pivotCap);

    return Object.freeze({
      backX,
      hardwareEndX: pivotBlock.position.x + PIVOT_BLOCK_RADIAL_MM * scale / 2
    });
  }

  function sharedMountMembers(item) {
    const mount = item?.sharedRollerMount;
    if (mount && mount.isMaster === false) return null;
    if (mount?.isMaster && Array.isArray(mount.members) && mount.members.length) {
      return Object.freeze({ side: mount.side === "inner" ? "inner" : "outer", members: mount.members });
    }
    return Object.freeze({
      side: item?.side === "inner" ? "inner" : "outer",
      members: Object.freeze([Object.freeze({
        id: String(item?.id || "roller"),
        side: item?.side === "inner" ? "inner" : "outer",
        position: Object.freeze({ x: number(item?.position?.x), z: number(item?.position?.z) }),
        contactHeightWorld: number(item?.contactHeightWorld, NaN)
      })])
    });
  }

  function unwrapAngle(angle, anchor) {
    let value = angle;
    while (value - anchor > Math.PI) value -= Math.PI * 2;
    while (value - anchor < -Math.PI) value += Math.PI * 2;
    return value;
  }

  function addSharedRailAndExtensions(THREE, item, geometry, group, rollerCenterY, materials) {
    const mount = sharedMountMembers(item);
    if (!mount) return;

    const scale = unitsPerMm(geometry);
    const masterPosition = {
      x: number(item?.position?.x),
      z: number(item?.position?.z)
    };
    const side = mount.side;
    const halfLineSign = halfLineSignForSide(side);
    const railY = rollerCenterY - MOUNT_RAIL_DROP_MM * scale;
    const railRadiusWorld = MOUNT_RAIL_DIAMETER_MM * scale / 2;
    const riserRadiusWorld = MOUNT_RISER_DIAMETER_MM * scale / 2;
    const headBackOffsetWorld = rollerRadiusWorld(geometry)
      + (YOKE_BACK_CLEARANCE_MM + PIVOT_BLOCK_RADIAL_MM + 2) * scale;

    const memberPositions = mount.members.map((member) => ({
      member,
      x: number(member?.position?.x),
      z: number(member?.position?.z)
    }));
    const anchorAngle = Math.atan2(masterPosition.z, masterPosition.x);
    const memberAngles = memberPositions.map((position) => unwrapAngle(Math.atan2(position.z, position.x), anchorAngle));
    let minAngle = Math.min(...memberAngles);
    let maxAngle = Math.max(...memberAngles);
    if (memberAngles.length === 1) {
      const halfSpan = SINGLE_RAIL_HALF_SPAN_DEGREES * Math.PI / 180;
      minAngle -= halfSpan;
      maxAngle += halfSpan;
    } else {
      const padding = RAIL_ARC_PADDING_DEGREES * Math.PI / 180;
      minAngle -= padding;
      maxAngle += padding;
    }

    const memberRailRadii = memberPositions.map((position) => {
      const baseRadius = Math.hypot(position.x, position.z);
      return Math.max(0.05, baseRadius + halfLineSign * MOUNT_STANDOFF_MM * scale);
    });
    const railRadiusFromCenter = memberRailRadii.reduce((sum, value) => sum + value, 0) / memberRailRadii.length;
    const arcPoints = [];
    const arcSegments = Math.max(12, Math.ceil(Math.abs(maxAngle - minAngle) / (Math.PI / 90)));
    for (let index = 0; index <= arcSegments; index += 1) {
      const ratio = index / arcSegments;
      const angle = minAngle + (maxAngle - minAngle) * ratio;
      arcPoints.push(new THREE.Vector3(
        Math.cos(angle) * railRadiusFromCenter - masterPosition.x,
        railY,
        Math.sin(angle) * railRadiusFromCenter - masterPosition.z
      ));
    }

    const railCurve = new THREE.CatmullRomCurve3(arcPoints, false, "catmullrom", 0.15);
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, Math.max(24, arcSegments * 2), railRadiusWorld, 16, false),
      materials.railMetal
    );
    rail.name = `ServoForgeWipeRollerCurvedMountingRail-${side}`;
    rail.castShadow = true;
    rail.receiveShadow = true;
    rail.userData.circumferentialBackbone = true;
    group.add(rail);

    memberPositions.forEach((position, index) => {
      const memberSide = position.member?.side === "inner" ? "inner" : side;
      const memberSign = halfLineSignForSide(memberSide);
      const memberRadial = radial(position);
      const memberY = Number.isFinite(Number(position.member?.contactHeightWorld))
        ? number(position.member.contactHeightWorld)
        : rollerCenterY;
      const localCenter = new THREE.Vector3(
        position.x - masterPosition.x,
        memberY,
        position.z - masterPosition.z
      );
      const direction = new THREE.Vector3(memberRadial.x * memberSign, 0, memberRadial.z * memberSign);
      const armStart = localCenter.clone().addScaledVector(direction, headBackOffsetWorld);
      const railMountTop = localCenter.clone().addScaledVector(direction, MOUNT_STANDOFF_MM * scale);
      const railMountBottom = railMountTop.clone();
      railMountBottom.y = railY;

      const extensionArm = boxBetweenPoints(
        THREE,
        armStart,
        railMountTop,
        EXTENSION_BAR_HEIGHT_MM * scale,
        EXTENSION_BAR_DEPTH_MM * scale,
        materials.mountMetal
      );
      extensionArm.name = `ServoForgeWipeRollerExtensionArm${index + 1}`;
      extensionArm.castShadow = true;
      extensionArm.userData.radialCenterlineMember = true;
      extensionArm.userData.connectsRollerHeadToRail = true;
      group.add(extensionArm);

      const riser = cylinderBetweenPoints(
        THREE,
        railMountBottom,
        railMountTop,
        riserRadiusWorld,
        materials.railMetal,
        20
      );
      riser.name = `ServoForgeWipeRollerRailRiser${index + 1}`;
      riser.castShadow = true;
      riser.userData.connectsExtensionToCurvedRail = true;
      group.add(riser);

      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(railRadiusWorld * 1.55, railRadiusWorld * 1.55, 18 * scale, 20),
        materials.darkMetal
      );
      collar.name = `ServoForgeWipeRollerRailCollar${index + 1}`;
      collar.position.copy(railMountBottom);
      collar.userData.railJunction = true;
      group.add(collar);
    });

    group.userData.renderedRollerMount = Object.freeze({
      side,
      railRendered: true,
      extensionArmsRendered: true,
      risersRendered: true,
      detailedClampsRendered: false,
      mountingSidesFlippedFromV204: true,
      railDiameterMm: MOUNT_RAIL_DIAMETER_MM,
      riserDiameterMm: MOUNT_RISER_DIAMETER_MM,
      railStandOffMm: MOUNT_STANDOFF_MM,
      railVerticalDropMm: MOUNT_RAIL_DROP_MM,
      dimensionalAuthority: false,
      authority: "user-machine-photo-backed-proportional"
    });
  }

  function retainStationMountReference(item, group) {
    group.userData.rollerMountReference = Object.freeze({
      source: PHOTO_MOUNT_REFERENCE.source,
      referenceOnly: false,
      rendered: true,
      longLinkArmRendered: true,
      riserRendered: true,
      railClampRendered: false,
      mountingRailRendered: true,
      railAdjustmentHandleRendered: false,
      side: item?.side === "inner" ? "inner" : "outer",
      rollerIsBottleFacingTerminal: true,
      mountingHardwareExtendsAwayFromBottle: true,
      mountingSidesFlippedFromV204: true,
      everyHardwareCenterlineCollinearWithCarouselCenter: true,
      sideOnlySelectsHalfLineDirection: true,
      rollerTiltIndependentFromHardwareAzimuth: true,
      extensionRodsConnectToCurvedRail: true,
      radialCenterlineAuthority: STANDING_RULES.radialCenterlineAuthority,
      radialTarget: STANDING_RULES.radialTarget,
      railReferenceAuthority: "photo-backed-rendered-reference"
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
      darkMetal: material(THREE, { color: 0x4d5559, roughness: 0.30, metalness: 0.82 }),
      mountMetal: material(THREE, { color: 0x9fa8ac, roughness: 0.26, metalness: 0.86 }),
      railMetal: material(THREE, { color: 0x8d979c, roughness: 0.25, metalness: 0.88 })
    });

    const group = new THREE.Group();
    group.name = `ServoForgeWipeRollerHead-${String(item?.id || "roller")}`;
    group.position.set(number(item?.position?.x), 0, number(item?.position?.z));

    const hardwareRoot = new THREE.Group();
    hardwareRoot.name = "ServoForgeWipeRollerHardwareRadialRoot";
    hardwareRoot.position.y = rollerCenterY;
    hardwareRoot.quaternion.copy(hardwareRadialQuaternion(THREE, item));
    hardwareRoot.userData.radialCenterlineAuthority = STANDING_RULES.radialCenterlineAuthority;
    hardwareRoot.userData.sideOnlySelectsHalfLineDirection = true;
    hardwareRoot.userData.mountingSidesFlippedFromV204 = true;
    group.add(hardwareRoot);

    const rollerRoot = new THREE.Group();
    rollerRoot.name = "ServoForgeWipeRollerTiltRoot";
    rollerRoot.position.y = rollerCenterY;
    rollerRoot.quaternion.copy(rollerTiltQuaternion(THREE, item, neck));
    rollerRoot.userData.tiltIndependentFromHardwareAzimuth = true;
    group.add(rollerRoot);

    const core = addRollerCore(THREE, rollerRoot, geometry, materials);
    addDirectHeadHardware(THREE, hardwareRoot, geometry, core, materials);
    addSharedRailAndExtensions(THREE, item, geometry, group, rollerCenterY, materials);
    retainStationMountReference(item, group);

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
      orientationAuthority: "exact-carousel-radial-line-with-user-verified-flipped-side-placement",
      tiltAuthority: "section-aware-neck-slope-independent-from-hardware-azimuth",
      directHeadHardwareAuthority: "user-machine-photo-backed-proportional",
      directHeadHardwareRendered: true,
      extensionHardwareRendered: true,
      mountingRailRendered: true,
      detailedStationMountingHardwareRendered: false,
      mountingReferenceRetained: true,
      rollerIsBottleFacingTerminal: true,
      mountingHardwareExtendsAwayFromBottle: true,
      mountingSidesFlippedFromV204: true,
      everyHardwareCenterlineCollinearWithCarouselCenter: true,
      sideOnlySelectsHalfLineDirection: true,
      rollerTiltIndependentFromHardwareAzimuth: true,
      extensionRodsConnectToCurvedRail: true,
      radialCenterlineAuthority: STANDING_RULES.radialCenterlineAuthority,
      radialTarget: STANDING_RULES.radialTarget,
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
      directRollerHardwareVisible: true,
      extensionHardwareVisible: true,
      mountingRailVisible: true,
      detailedClampsVisible: false,
      railAdjustmentHandleVisible: false,
      referenceGeometryRetained: true
    }),
    authority: Object.freeze({
      widthMm: ROLLER_WIDTH_MM,
      contact: "section-aware-neck-contact",
      mountingReference: "user-machine-photo-backed",
      mountingDimensionalAuthority: false,
      rollerIsBottleFacingTerminal: true,
      mountingHardwareExtendsAwayFromBottle: true,
      mountingSidesFlippedFromV204: true,
      everyHardwareCenterlineCollinearWithCarouselCenter: true,
      sideOnlySelectsHalfLineDirection: true,
      rollerTiltIndependentFromHardwareAzimuth: true,
      extensionRodsConnectToCurvedRail: true,
      radialCenterlineAuthority: STANDING_RULES.radialCenterlineAuthority,
      radialTarget: STANDING_RULES.radialTarget,
      renderOwnership: "models/wipe-roller.js",
      migrationState: "native-model-geometry"
    })
  });
})(window);
