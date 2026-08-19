(function installServoForge3DRollerSharedBracketRuntimeRecovery(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createEquipmentAssembly) {
    throw new Error("ServoForge roller runtime recovery requires the active hardware factory.");
  }

  const PATCH_VERSION = "servoforge.3d-roller-shared-bracket-runtime-recovery.v1";
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
  const INNER_INSET_MM = 95;
  const FOOT_DIAMETER_MM = 34;
  const FOOT_HEIGHT_MM = 10;

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

  function cylinderBetween(THREE, start, end, radiusValue, meshMaterial, segments = 20) {
    const a = new THREE.Vector3(number(start?.x), number(start?.y), number(start?.z));
    const b = new THREE.Vector3(number(end?.x), number(end?.y), number(end?.z));
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = Math.max(0.000001, delta.length());
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusValue, radiusValue, length, segments), meshMaterial);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }

  function boxBetween(THREE, start, end, height, depth, meshMaterial) {
    const a = new THREE.Vector3(number(start?.x), number(start?.y), number(start?.z));
    const b = new THREE.Vector3(number(end?.x), number(end?.y), number(end?.z));
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = Math.max(0.000001, delta.length());
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, depth), meshMaterial);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
    return mesh;
  }

  function localMemberPosition(THREE, member, masterPosition, y = 0) {
    return new THREE.Vector3(
      number(member?.position?.x) - number(masterPosition?.x),
      y,
      number(member?.position?.z) - number(masterPosition?.z)
    );
  }

  function mountPointForMember(THREE, member, masterPosition, side, y, scale) {
    const local = localMemberPosition(THREE, member, masterPosition, y);
    const direction = radial(member?.position);
    const signedOffsetMm = side === "inner" ? -INNER_INSET_MM : OUTER_OUTSET_MM;
    return new THREE.Vector3(
      local.x + direction.x * signedOffsetMm * scale,
      y,
      local.z + direction.z * signedOffsetMm * scale
    );
  }

  function createRollerHead(THREE, item, geometry, group) {
    const scale = unitsPerMm(geometry);
    const neck = neckReference(geometry);
    const rollerRadius = rollerRadiusWorld(geometry);
    const rollerWidth = ROLLER_WIDTH_MM * scale;
    const rollerCenterY = Number.isFinite(Number(item?.contactHeightWorld))
      ? number(item.contactHeightWorld)
      : bottleBaseYWorld() + number(neck.targetYmm) * scale;

    const rubber = material(THREE, { color: 0x262d30, roughness: 0.88, metalness: 0.01 });
    const metal = material(THREE, { color: 0xa4adb2, roughness: 0.24, metalness: 0.88 });

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

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(SPINDLE_DIAMETER_MM * scale / 2, SPINDLE_DIAMETER_MM * scale / 2, rollerWidth * 1.18, 20),
      metal
    );
    shaft.name = "ServoForgeRollerSpindleShaft";
    roller.add(shaft);

    [-1, 1].forEach((sign) => {
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(HUB_DIAMETER_MM * scale / 2, HUB_DIAMETER_MM * scale / 2, HUB_HEIGHT_MM * scale, 24),
        metal
      );
      hub.name = sign < 0 ? "ServoForgeRollerHubLower" : "ServoForgeRollerHubUpper";
      hub.position.y = sign * (rollerWidth / 2 + HUB_HEIGHT_MM * scale / 2);
      roller.add(hub);
    });

    group.add(roller);
    return Object.freeze({ rollerCenterY, rubber });
  }

  function createSharedBracket(THREE, item, geometry, group, rollerCenterY) {
    const mount = item?.sharedRollerMount;
    if (!mount?.isMaster || !Array.isArray(mount.members) || !mount.members.length) return;

    const scale = unitsPerMm(geometry);
    const side = mount.side === "inner" ? "inner" : "outer";
    const masterPosition = item.position || { x: 0, z: 0 };
    const railY = rollerCenterY - 28 * scale;
    const tableY = TABLE_Y + 6 * scale;
    const railRadius = RAIL_DIAMETER_MM * scale / 2;

    const railMaterial = material(THREE, { color: 0x899399, roughness: 0.27, metalness: 0.82 });
    const bracketMaterial = material(THREE, { color: 0x707b81, roughness: 0.30, metalness: 0.76 });
    const darkMaterial = material(THREE, { color: 0x343b40, roughness: 0.40, metalness: 0.60 });

    const actualMountPoints = mount.members.map((member) => mountPointForMember(THREE, member, masterPosition, side, railY, scale));
    const railPoints = actualMountPoints.map((point) => point.clone());
    if (railPoints.length === 1) {
      const direction = radial(mount.members[0].position);
      const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
      const center = railPoints[0].clone();
      const halfSpan = 55 * scale;
      railPoints.splice(0, 1,
        center.clone().addScaledVector(tangent, -halfSpan),
        center,
        center.clone().addScaledVector(tangent, halfSpan)
      );
    }

    const curve = new THREE.CatmullRomCurve3(railPoints, false, "catmullrom", 0.25);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, railRadius, 12, false), railMaterial);
    rail.name = "ServoForgeSharedRollerMountRail";
    rail.castShadow = true;
    group.add(rail);

    mount.members.forEach((member, index) => {
      const rollerPoint = localMemberPosition(THREE, member, masterPosition, rollerCenterY);
      const mountPoint = mountPointForMember(THREE, member, masterPosition, side, rollerCenterY, scale);
      const arm = boxBetween(
        THREE,
        rollerPoint,
        mountPoint,
        ARM_HEIGHT_MM * scale,
        ARM_DEPTH_MM * scale,
        bracketMaterial
      );
      arm.name = `ServoForgeSharedRollerCarrierArm${index + 1}`;
      arm.userData.threePointRadialAlignment = true;
      arm.castShadow = true;
      group.add(arm);

      const clamp = new THREE.Mesh(
        new THREE.CylinderGeometry(railRadius * 1.45, railRadius * 1.45, 20 * scale, 20),
        darkMaterial
      );
      clamp.name = `ServoForgeSharedRollerClamp${index + 1}`;
      clamp.position.copy(mountPoint);
      group.add(clamp);
    });

    const supportPoint = actualMountPoints.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / actualMountPoints.length);
    const post = cylinderBetween(
      THREE,
      { x: supportPoint.x, y: tableY, z: supportPoint.z },
      { x: supportPoint.x, y: railY, z: supportPoint.z },
      POST_DIAMETER_MM * scale / 2,
      railMaterial,
      20
    );
    post.name = "ServoForgeSharedRollerSupportPost";
    post.castShadow = true;
    group.add(post);

    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(FOOT_DIAMETER_MM * scale / 2, FOOT_DIAMETER_MM * scale / 2, FOOT_HEIGHT_MM * scale, 24),
      darkMaterial
    );
    foot.name = "ServoForgeSharedRollerSupportFoot";
    foot.position.set(supportPoint.x, tableY - FOOT_HEIGHT_MM * scale / 2, supportPoint.z);
    group.add(foot);

    group.userData.sharedRollerBracket = Object.freeze({
      side,
      memberCount: mount.memberCount,
      railDiameterMm: RAIL_DIAMETER_MM,
      supportPostDiameterMm: POST_DIAMETER_MM,
      outsideHardwareRadiallyOutward: side === "outer",
      threePointRadialAlignment: true,
      sharedBracketPerSide: true,
      runtimeRecovery: true
    });
  }

  function createRecoveredRollerAssembly(THREE, item, geometry) {
    const group = new THREE.Group();
    group.name = `ServoForgeRecoveredSharedMountedRoller-${String(item?.id || "roller")}`;
    group.position.set(number(item?.position?.x), 0, number(item?.position?.z));

    const head = createRollerHead(THREE, item, geometry, group);
    createSharedBracket(THREE, item, geometry, group, head.rollerCenterY);

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
      outsideMountingAuthority: item?.side === "outer" ? "hardware-outside-labeler" : "hardware-inside-labeler",
      radialAlignmentAuthority: "carousel-center-bottle-plate-center-bracket-center",
      sharedBracketAuthority: "one-bracket-per-active-side-group",
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
    FACTORY_VERSION: "servoforge.3d-hardware-mesh.v16-roller-runtime-recovery",
    PATCH_VERSION,
    ROLLER_WIDTH_MM,
    createEquipmentAssembly,
    createRecoveredRollerAssembly
  });

  global.Labeler3DRollerSharedBracketRuntimeRecovery = Object.freeze({
    PATCH_VERSION,
    ROLLER_WIDTH_MM,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        rollerRendererRecovered: true,
        mixedEquipmentMapsSupported: true,
        rollerWidthMm: ROLLER_WIDTH_MM,
        sharedBracketPreserved: true,
        readOnly: true
      });
    }
  });
})(window);
