(function installServoForge3DRollerSharedBracketRefinement(global) {
  "use strict";

  const baseEquipmentAdapter = global.Labeler3DEquipmentLayoutAdapter;
  const baseHardwareFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseEquipmentAdapter?.snapshot || !baseHardwareFactory?.createEquipmentAssembly) {
    throw new Error("ServoForge shared roller bracket refinement requires equipment and hardware factories.");
  }

  const PATCH_VERSION = "servoforge.3d-roller-shared-bracket.v1";
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const ROLLER_WIDTH_MM = 80;
  const SHARED_RAIL_DIAMETER_MM = 14;
  const SHARED_POST_DIAMETER_MM = 12;
  const CARRIER_ARM_HEIGHT_MM = 10;
  const CARRIER_ARM_DEPTH_MM = 14;
  const SPINDLE_DIAMETER_MM = 8;
  const HUB_DIAMETER_MM = 18;
  const HUB_HEIGHT_MM = 8;
  const OUTER_MOUNT_OUTSET_MM = 125;
  const INNER_MOUNT_INSET_MM = 95;
  const SUPPORT_FOOT_DIAMETER_MM = 34;
  const SUPPORT_FOOT_HEIGHT_MM = 10;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function unitsPerMm(geometry = {}) {
    return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function bottleBaseYWorld() {
    return TABLE_Y + BOTTLE_LIFT;
  }

  function neckReference(geometry = {}) {
    if (typeof baseHardwareFactory.neckSlopeReference === "function") {
      return baseHardwareFactory.neckSlopeReference(geometry);
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
    const diameter = Math.max(0.10, bottleDiameter * number(ratios.rollerDiameterBottleDiameter, 0.72));
    return diameter / 2;
  }

  function enrichedEquipmentSnapshot(machineMap, stateLike, geometry, options = {}) {
    const base = baseEquipmentAdapter.snapshot(machineMap, stateLike, geometry, options);
    const objects = Array.isArray(base?.objects) ? base.objects : [];
    const rollerGroups = new Map();

    objects.forEach((item) => {
      if (item?.kind !== "roller") return;
      const side = item?.side === "inner" ? "inner" : "outer";
      if (!rollerGroups.has(side)) rollerGroups.set(side, []);
      rollerGroups.get(side).push(item);
    });

    const mountMeta = new Map();
    rollerGroups.forEach((members, side) => {
      const ordered = [...members].sort((a, b) => number(a.angleDegrees) - number(b.angleDegrees));
      const masterId = String(ordered[0]?.id || "");
      const memberData = ordered.map((item) => Object.freeze({
        id: String(item.id),
        side,
        angleDegrees: number(item.angleDegrees),
        position: Object.freeze({
          x: number(item?.position?.x),
          z: number(item?.position?.z)
        }),
        contactHeightWorld: number(item?.contactHeightWorld, NaN)
      }));
      ordered.forEach((item) => {
        mountMeta.set(String(item.id), Object.freeze({
          groupId: `shared-roller-${side}`,
          side,
          masterId,
          isMaster: String(item.id) === masterId,
          memberCount: memberData.length,
          members: Object.freeze(memberData),
          alignmentAuthority: "carousel-center-to-bottle-plate-center-to-bracket-center-radial-line",
          outsideHardwareAuthority: side === "outer" ? "radially-outside-labeler" : "radially-inside-labeler"
        }));
      });
    });

    const corrected = objects.map((item) => {
      if (item?.kind !== "roller") return item;
      return freeze({
        ...item,
        sharedRollerMount: mountMeta.get(String(item.id)) || null
      });
    });

    return freeze({
      ...base,
      schemaVersion: "servoforge.3d-equipment.v4-shared-roller-bracket",
      objects: corrected,
      sharedRollerMounting: Object.freeze({
        groups: [...rollerGroups.keys()],
        rollerWidthMm: ROLLER_WIDTH_MM,
        tubeDiameterMm: SHARED_RAIL_DIAMETER_MM,
        authority: "user-directed-shared-bracket-and-radial-alignment"
      })
    });
  }

  global.Labeler3DEquipmentLayoutAdapter = Object.freeze({
    ...baseEquipmentAdapter,
    SCHEMA_VERSION: "servoforge.3d-equipment.v4-shared-roller-bracket",
    PATCH_VERSION,
    snapshot: enrichedEquipmentSnapshot
  });

  function material(THREE, options) {
    return new THREE.MeshStandardMaterial(options);
  }

  function cylinderBetweenPoints(THREE, start, end, radius, meshMaterial, segments = 24) {
    const a = new THREE.Vector3(number(start?.x), number(start?.y), number(start?.z));
    const b = new THREE.Vector3(number(end?.x), number(end?.y), number(end?.z));
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = Math.max(0.000001, delta.length());
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), meshMaterial);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }

  function boxBetweenPoints(THREE, start, end, height, depth, meshMaterial) {
    const a = new THREE.Vector3(number(start?.x), number(start?.y), number(start?.z));
    const b = new THREE.Vector3(number(end?.x), number(end?.y), number(end?.z));
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = Math.max(0.000001, delta.length());
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, depth), meshMaterial);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
    return mesh;
  }

  function localMemberPosition(member, masterPosition) {
    return new THREE.Vector3(
      number(member?.position?.x) - number(masterPosition?.x),
      0,
      number(member?.position?.z) - number(masterPosition?.z)
    );
  }

  function radialUnitForPosition(position) {
    const x = number(position?.x);
    const z = number(position?.z);
    const magnitude = Math.hypot(x, z) || 1;
    return { x: x / magnitude, z: z / magnitude, radius: magnitude };
  }

  function mountPointForMember(member, masterPosition, side, y, scale) {
    const local = localMemberPosition(member, masterPosition);
    const radial = radialUnitForPosition(member?.position);
    const signedOffsetMm = side === "inner" ? -INNER_MOUNT_INSET_MM : OUTER_MOUNT_OUTSET_MM;
    return new THREE.Vector3(
      local.x + radial.x * signedOffsetMm * scale,
      y,
      local.z + radial.z * signedOffsetMm * scale
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

    const radial = radialUnitForPosition(item?.position);
    const correctedSlope = item?.side === "inner" ? number(neck.radialSlope) : -number(neck.radialSlope);
    const axis = new THREE.Vector3(radial.x * correctedSlope, 1, radial.z * correctedSlope).normalize();
    roller.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    roller.castShadow = true;
    roller.receiveShadow = true;

    const shaftRadius = SPINDLE_DIAMETER_MM * scale / 2;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius, shaftRadius, rollerWidth * 1.18, 20),
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
    return { roller, rollerCenterY, rubber };
  }

  function createSharedBracket(THREE, item, geometry, group, rollerCenterY) {
    const mount = item?.sharedRollerMount;
    if (!mount?.isMaster || !Array.isArray(mount.members) || !mount.members.length) return;

    const scale = unitsPerMm(geometry);
    const side = mount.side === "inner" ? "inner" : "outer";
    const masterPosition = item.position || { x: 0, z: 0 };
    const railY = rollerCenterY - 28 * scale;
    const tableReferenceY = TABLE_Y + 6 * scale;
    const railRadius = SHARED_RAIL_DIAMETER_MM * scale / 2;

    const railMaterial = material(THREE, { color: 0x899399, roughness: 0.27, metalness: 0.82 });
    const bracketMaterial = material(THREE, { color: 0x707b81, roughness: 0.30, metalness: 0.76 });
    const darkMaterial = material(THREE, { color: 0x343b40, roughness: 0.40, metalness: 0.60 });

    const mountPoints = mount.members.map((member) => mountPointForMember(member, masterPosition, side, railY, scale));

    if (mountPoints.length === 1) {
      const radial = radialUnitForPosition(mount.members[0].position);
      const tangent = new THREE.Vector3(-radial.z, 0, radial.x);
      const halfSpan = 55 * scale;
      mountPoints.unshift(mountPoints[0].clone().addScaledVector(tangent, -halfSpan));
      mountPoints.push(mountPoints[1].clone().addScaledVector(tangent, halfSpan));
    }

    const curve = new THREE.CatmullRomCurve3(mountPoints.map((point) => point.clone()), false, "catmullrom", 0.25);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, railRadius, 12, false), railMaterial);
    rail.name = "ServoForgeSharedRollerMountRail";
    rail.castShadow = true;
    group.add(rail);

    // Every carrier arm lies on the same radial line as the corresponding
    // bottle-plate center and the carousel center. This is the requested
    // three-point contact/alignment reference.
    mount.members.forEach((member, index) => {
      const rollerLocal = localMemberPosition(member, masterPosition);
      rollerLocal.y = rollerCenterY;
      const mountPoint = mountPointForMember(member, masterPosition, side, rollerCenterY, scale);
      const arm = boxBetweenPoints(
        THREE,
        rollerLocal,
        mountPoint,
        CARRIER_ARM_HEIGHT_MM * scale,
        CARRIER_ARM_DEPTH_MM * scale,
        bracketMaterial
      );
      arm.name = `ServoForgeSharedRollerCarrierArm${index + 1}`;
      arm.castShadow = true;
      arm.userData.threePointRadialAlignment = true;
      group.add(arm);

      const compactClamp = new THREE.Mesh(
        new THREE.CylinderGeometry(railRadius * 1.45, railRadius * 1.45, 20 * scale, 20),
        darkMaterial
      );
      compactClamp.name = `ServoForgeSharedRollerClamp${index + 1}`;
      compactClamp.position.copy(mountPoint);
      group.add(compactClamp);
    });

    const supportPoint = mountPoints.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / mountPoints.length);
    const post = cylinderBetweenPoints(
      THREE,
      { x: supportPoint.x, y: tableReferenceY, z: supportPoint.z },
      { x: supportPoint.x, y: railY, z: supportPoint.z },
      SHARED_POST_DIAMETER_MM * scale / 2,
      railMaterial,
      20
    );
    post.name = "ServoForgeSharedRollerSupportPost";
    post.castShadow = true;
    group.add(post);

    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(
        SUPPORT_FOOT_DIAMETER_MM * scale / 2,
        SUPPORT_FOOT_DIAMETER_MM * scale / 2,
        SUPPORT_FOOT_HEIGHT_MM * scale,
        24
      ),
      darkMaterial
    );
    foot.name = "ServoForgeSharedRollerSupportFoot";
    foot.position.set(supportPoint.x, tableReferenceY - SUPPORT_FOOT_HEIGHT_MM * scale / 2, supportPoint.z);
    group.add(foot);

    group.userData.sharedRollerBracket = Object.freeze({
      side,
      memberCount: mount.memberCount,
      railDiameterMm: SHARED_RAIL_DIAMETER_MM,
      supportPostDiameterMm: SHARED_POST_DIAMETER_MM,
      carrierArmHeightMm: CARRIER_ARM_HEIGHT_MM,
      carrierArmDepthMm: CARRIER_ARM_DEPTH_MM,
      outsideHardwareRadiallyOutward: side === "outer",
      threePointRadialAlignment: true,
      sharedBracketPerSide: true,
      dimensionalAuthority: "user-directed-functional-presentation"
    });
  }

  function createSharedRollerAssembly(THREE, item, geometry) {
    const group = new THREE.Group();
    group.name = `ServoForgeSharedMountedRoller-${String(item?.id || "roller")}`;
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
      dimensionalAuthority: false
    });
    return group;
  }

  function createEquipmentAssembly(THREE, item, geometry) {
    if (item?.kind === "roller") return createSharedRollerAssembly(THREE, item, geometry);
    return baseHardwareFactory.createEquipmentAssembly(THREE, item, geometry);
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseHardwareFactory,
    FACTORY_VERSION: "servoforge.3d-hardware-mesh.v14-shared-roller-bracket",
    PATCH_VERSION,
    ROLLER_WIDTH_MM,
    SHARED_RAIL_DIAMETER_MM,
    SHARED_POST_DIAMETER_MM,
    createEquipmentAssembly,
    createSharedRollerAssembly
  });

  global.Labeler3DRollerSharedBracketRefinement = Object.freeze({
    PATCH_VERSION,
    ROLLER_WIDTH_MM,
    SHARED_RAIL_DIAMETER_MM,
    SHARED_POST_DIAMETER_MM,
    OUTER_MOUNT_OUTSET_MM,
    INNER_MOUNT_INSET_MM,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        rollerWidthMm: ROLLER_WIDTH_MM,
        railDiameterMm: SHARED_RAIL_DIAMETER_MM,
        postDiameterMm: SHARED_POST_DIAMETER_MM,
        bracketModel: "shared-per-side",
        outsideHardware: "radially-outside-labeler",
        alignment: "carousel-center-bottle-plate-center-bracket-center",
        readOnly: true
      });
    }
  });
})(window);
