(function installServoForge3DRollerSharedBracketRuntimeRecovery(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createEquipmentAssembly) {
    throw new Error("ServoForge roller runtime recovery requires the active hardware factory.");
  }

  const PATCH_VERSION = "servoforge.3d-roller-runtime.v3-reference-only-mounting";
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const ROLLER_WIDTH_MM = 80;
  const RAIL_DIAMETER_MM = 14;
  const POST_DIAMETER_MM = 12;
  const ARM_HEIGHT_MM = 10;
  const ARM_DEPTH_MM = 14;
  const SPINDLE_DIAMETER_MM = 8;
  const HUB_DIAMETER_MM = 18;
  const HUB_HEIGHT_MM = 8;
  const OUTER_OUTSET_MM = 125;
  const INNER_INSET_MM = 125;

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

  function neckReference(geometry = {}) {
    if (typeof baseFactory.neckSlopeReference === "function") {
      return baseFactory.neckSlopeReference(geometry);
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

  function createRollerHead(THREE, item, geometry, group) {
    const scale = unitsPerMm(geometry);
    const neck = neckReference(geometry);
    const rollerRadius = rollerRadiusWorld(geometry);
    const rollerWidth = ROLLER_WIDTH_MM * scale;
    const rollerCenterY = Number.isFinite(Number(item?.contactHeightWorld))
      ? number(item.contactHeightWorld)
      : bottleBaseYWorld() + number(neck.targetYmm) * scale;

    const rubber = material(THREE, {
      color: 0x262d30,
      roughness: 0.88,
      metalness: 0.01
    });
    const metal = material(THREE, {
      color: 0xa4adb2,
      roughness: 0.24,
      metalness: 0.88
    });

    const roller = new THREE.Mesh(
      new THREE.CylinderGeometry(rollerRadius, rollerRadius, rollerWidth, 40),
      rubber
    );
    roller.name = "ServoForgePurposeViewRoller";
    roller.position.y = rollerCenterY;

    const direction = radial(item?.position);
    const slope = item?.side === "inner" ? number(neck.radialSlope) : -number(neck.radialSlope);
    const axis = new THREE.Vector3(direction.x * slope, 1, direction.z * slope).normalize();
    roller.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    roller.castShadow = true;
    roller.receiveShadow = true;

    // Keep only the functional roller core visible. The spindle and end hubs
    // are part of the roller itself, not the station mounting structure.
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(
        SPINDLE_DIAMETER_MM * scale / 2,
        SPINDLE_DIAMETER_MM * scale / 2,
        rollerWidth * 1.18,
        20
      ),
      metal
    );
    shaft.name = "ServoForgeRollerSpindleShaft";
    roller.add(shaft);

    [-1, 1].forEach((sign) => {
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(
          HUB_DIAMETER_MM * scale / 2,
          HUB_DIAMETER_MM * scale / 2,
          HUB_HEIGHT_MM * scale,
          24
        ),
        metal
      );
      hub.name = sign < 0 ? "ServoForgeRollerHubLower" : "ServoForgeRollerHubUpper";
      hub.position.y = sign * (rollerWidth / 2 + HUB_HEIGHT_MM * scale / 2);
      roller.add(hub);
    });

    group.add(roller);
    return Object.freeze({ rollerCenterY, rubber });
  }

  function retainMountingReference(item, group) {
    const side = item?.side === "inner" ? "inner" : "outer";
    const mount = item?.sharedRollerMount || null;
    const standOffMm = side === "inner" ? INNER_INSET_MM : OUTER_OUTSET_MM;

    // These values intentionally remain available for later restoration of the
    // TopModul support system, but no mounting meshes are created in this build.
    group.userData.rollerMountReference = Object.freeze({
      referenceOnly: true,
      rendered: false,
      railRendered: false,
      carrierArmsRendered: false,
      clampsRendered: false,
      supportPostRendered: false,
      supportFootRendered: false,
      side,
      groupId: String(mount?.groupId || `shared-roller-${side}`),
      memberCount: Math.max(1, number(mount?.memberCount, 1)),
      railDiameterMm: RAIL_DIAMETER_MM,
      supportPostDiameterMm: POST_DIAMETER_MM,
      carrierArmHeightMm: ARM_HEIGHT_MM,
      carrierArmDepthMm: ARM_DEPTH_MM,
      mountStandOffMm: standOffMm,
      outsideReferenceRadiallyOutward: side === "outer",
      insideReferenceRadiallyInward: side === "inner",
      threePointRadialAlignment: true,
      radialAlignmentAuthority: "carousel-center-bottle-plate-center-bracket-center",
      railReferenceAuthority: "retained-not-rendered",
      mountingHardwareAuthority: "retained-reference-only-not-rendered"
    });
  }

  function createRecoveredRollerAssembly(THREE, item, geometry) {
    const group = new THREE.Group();
    group.name = `ServoForgeRollerOnly-${String(item?.id || "roller")}`;
    group.position.set(number(item?.position?.x), 0, number(item?.position?.z));

    const head = createRollerHead(THREE, item, geometry, group);
    retainMountingReference(item, group);

    group.userData.kind = "roller";
    group.userData.station = item?.station;
    group.userData.section = item?.section;
    group.userData.highlightMaterials = [head.rubber];
    group.userData.hardwareReference = Object.freeze({
      profileId: "wipe-roller",
      rollerWidthMm: ROLLER_WIDTH_MM,
      rollerWidthAuthority: "user-specified-80mm",
      activeStationAuthority: "active-machine-map-only",
      positionAuthority: "servoforge-machine-map-neck-contact",
      mountingHardwareRendered: false,
      railsRendered: false,
      railsRetainedAsReference: true,
      mountingHardwareRetainedAsReference: true,
      radialAlignmentAuthority: "carousel-center-bottle-plate-center-bracket-center",
      presentationAuthority: "roller-only-mounting-reference-hidden",
      runtimeRecoveryAuthority: true,
      dimensionalAuthority: false
    });
    return group;
  }

  function createEquipmentAssembly(THREE, item, geometry) {
    if (item?.kind === "roller") return createRecoveredRollerAssembly(THREE, item, geometry);
    return baseFactory.createEquipmentAssembly(THREE, item, geometry);
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseFactory,
    FACTORY_VERSION: "servoforge.3d-hardware-mesh.v18-roller-only-reference-mounts",
    PATCH_VERSION,
    ROLLER_WIDTH_MM,
    ROLLER_OUTER_MOUNT_STANDOFF_MM: OUTER_OUTSET_MM,
    ROLLER_INNER_MOUNT_STANDOFF_MM: INNER_INSET_MM,
    createEquipmentAssembly,
    createRecoveredRollerAssembly
  });

  global.Labeler3DRollerSharedBracketRuntimeRecovery = Object.freeze({
    PATCH_VERSION,
    ROLLER_WIDTH_MM,
    OUTER_OUTSET_MM,
    INNER_INSET_MM,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        rollerRendererRecovered: true,
        mixedEquipmentMapsSupported: true,
        rollerWidthMm: ROLLER_WIDTH_MM,
        rollerOnlyRender: true,
        mountingHardwareRendered: false,
        railsRendered: false,
        railsRetainedAsReference: true,
        mirroredMountReferencesPreserved: true,
        readOnly: true
      });
    }
  });
})(window);
