(function installServoForge3DRollerPairMountAuthority(global) {
  "use strict";

  const baseModel = global.Labeler3DWipeRollerModel;
  if (!baseModel?.create) {
    throw new Error("ServoForge roller pair mount authority requires the wipe roller model.");
  }

  const MODEL_VERSION = "servoforge.3d-model.wipe-roller.v8-pair-mounted-concentric-rails";
  const ROLLER_WIDTH_MM = 80;
  const MOUNT_RAIL_DIAMETER_MM = 14;
  const MOUNT_RISER_DIAMETER_MM = 12;
  const MOUNT_STANDOFF_MM = 125;
  const MOUNT_RAIL_DROP_MM = 72;
  const EXTENSION_BAR_HEIGHT_MM = 10;
  const EXTENSION_BAR_DEPTH_MM = 14;
  const RAIL_ARC_PADDING_DEGREES = 3;
  const SINGLE_RAIL_HALF_SPAN_DEGREES = 5;
  const YOKE_BACK_CLEARANCE_MM = 14;
  const PIVOT_BLOCK_RADIAL_MM = 18;

  const PAIR_MOUNT_RULES = Object.freeze({
    source: "user-machine-rule-2026-08-19-roller-pair-mounting",
    eachRollerPairHasDedicatedMountingSystem: true,
    pairMembers: 2,
    pairSelection: "adjacent-rollers-on-same-side-by-carousel-angle",
    railIsConcentricWithCarousel: true,
    railCenterAuthority: "exact-carousel-center-0-0",
    railRadiusAuthority: "physical-bottle-table-pitch-radius-plus-side-standoff",
    outerPairRailDirection: "radially-outward-from-bottle-table-pitch-circle",
    innerPairRailDirection: "radially-inward-from-bottle-table-pitch-circle",
    extensionArmsStayOnMemberRadialCenterline: true,
    everyMountMemberPointsToCarouselCenter: true,
    rollerIsBottleFacingTerminal: true,
    mountingHardwareExtendsAwayFromBottle: true,
    pairRailDoesNotAverageAcrossWholeSide: true
  });

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function unitsPerMm(geometry = {}) {
    return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
  }

  function radial(position) {
    const x = number(position?.x);
    const z = number(position?.z);
    const magnitude = Math.hypot(x, z) || 1;
    return Object.freeze({ x: x / magnitude, z: z / magnitude, radius: magnitude });
  }

  // Mechanical truth from the machine photos: outer roller mounts continue
  // outward from the bottle path; inner roller mounts continue inward.
  function mountSign(side) {
    return side === "inner" ? -1 : 1;
  }

  function material(THREE, options) {
    return new THREE.MeshStandardMaterial(options);
  }

  function boxBetweenPoints(THREE, start, end, height, depth, meshMaterial) {
    const delta = new THREE.Vector3().subVectors(end, start);
    const length = Math.max(0.000001, delta.length());
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, depth), meshMaterial);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
    return mesh;
  }

  function cylinderBetweenPoints(THREE, start, end, radius, meshMaterial, segments = 24) {
    const delta = new THREE.Vector3().subVectors(end, start);
    const length = Math.max(0.000001, delta.length());
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), meshMaterial);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }

  function correctedHardwareQuaternion(THREE, item) {
    const outward = radial(item?.position);
    const sign = mountSign(item?.side);
    const xAxis = new THREE.Vector3(outward.x * sign, 0, outward.z * sign).normalize();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
  }

  function removeLegacySideWideMount(group) {
    const prefixes = [
      "ServoForgeWipeRollerCurvedMountingRail",
      "ServoForgeWipeRollerExtensionArm",
      "ServoForgeWipeRollerRailRiser",
      "ServoForgeWipeRollerRailCollar"
    ];
    [...group.children].forEach((child) => {
      if (prefixes.some((prefix) => String(child?.name || "").startsWith(prefix))) {
        group.remove(child);
      }
    });
  }

  function correctDirectHeadDirection(THREE, group, item) {
    const root = group.getObjectByName?.("ServoForgeWipeRollerHardwareRadialRoot");
    if (!root) return;
    root.quaternion.copy(correctedHardwareQuaternion(THREE, item));
    root.userData.radialCenterlineAuthority = "exact-carousel-center-through-roller-station-center";
    root.userData.mountingHalfLineAuthority = item?.side === "inner" ? "radially-inward" : "radially-outward";
  }

  function unwrapAngle(angle, anchor) {
    let value = angle;
    while (value - anchor > Math.PI) value -= Math.PI * 2;
    while (value - anchor < -Math.PI) value += Math.PI * 2;
    return value;
  }

  function mountMembers(item) {
    const mount = item?.sharedRollerMount;
    if (mount && mount.isMaster === false) return null;
    const source = mount?.isMaster && Array.isArray(mount.members) && mount.members.length
      ? mount.members
      : [{
          id: String(item?.id || "roller"),
          side: item?.side === "inner" ? "inner" : "outer",
          position: { x: number(item?.position?.x), z: number(item?.position?.z) },
          contactHeightWorld: number(item?.contactHeightWorld, NaN)
        }];
    const anchor = Math.atan2(number(item?.position?.z), number(item?.position?.x));
    return [...source]
      .map((member) => ({
        ...member,
        _angle: unwrapAngle(Math.atan2(number(member?.position?.z), number(member?.position?.x)), anchor)
      }))
      .sort((a, b) => a._angle - b._angle);
  }

  function pairMembers(members) {
    const pairs = [];
    for (let index = 0; index < members.length; index += 2) {
      pairs.push(members.slice(index, index + 2));
    }
    return pairs;
  }

  function physicalPitchRadiusWorld(geometry = {}, members = []) {
    const explicit = number(
      geometry?.machine?.physicalPitchRadiusWorld,
      number(geometry?.machine?.pitchRadiusWorld, NaN)
    );
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const radii = members
      .map((member) => Math.hypot(number(member?.position?.x), number(member?.position?.z)))
      .filter((value) => Number.isFinite(value) && value > 0);
    return radii.length ? radii.reduce((sum, value) => sum + value, 0) / radii.length : 1;
  }

  function rollerRadiusWorld(geometry = {}) {
    const bottleDiameter = Math.max(0.10, number(geometry?.bottle?.diameterWorld, 0.27));
    const ratios = global.Labeler3DHardwareReferenceCatalog?.profile?.("wipe-roller")?.visualRatios || {};
    return Math.max(0.10, bottleDiameter * number(ratios.rollerDiameterBottleDiameter, 0.72)) / 2;
  }

  function addPairMountingSystems(THREE, item, geometry, group, rollerCenterY) {
    const members = mountMembers(item);
    if (!members) return;

    const scale = unitsPerMm(geometry);
    const masterX = number(item?.position?.x);
    const masterZ = number(item?.position?.z);
    const pairs = pairMembers(members);
    const railMaterial = material(THREE, { color: 0x8d979c, roughness: 0.25, metalness: 0.88 });
    const mountMaterial = material(THREE, { color: 0x9fa8ac, roughness: 0.26, metalness: 0.86 });
    const darkMaterial = material(THREE, { color: 0x4d5559, roughness: 0.30, metalness: 0.82 });
    const railTubeRadius = MOUNT_RAIL_DIAMETER_MM * scale / 2;
    const riserRadius = MOUNT_RISER_DIAMETER_MM * scale / 2;
    const headBackOffset = rollerRadiusWorld(geometry) + (YOKE_BACK_CLEARANCE_MM + PIVOT_BLOCK_RADIAL_MM + 2) * scale;
    const pitchRadius = physicalPitchRadiusWorld(geometry, members);
    const renderedPairs = [];

    pairs.forEach((pair, pairIndex) => {
      if (!pair.length) return;
      const side = pair[0]?.side === "inner" ? "inner" : (item?.side === "inner" ? "inner" : "outer");
      const sign = mountSign(side);
      const railRadius = Math.max(0.05, pitchRadius + sign * MOUNT_STANDOFF_MM * scale);
      const pairAngles = pair.map((member) => number(member._angle));
      let minAngle = Math.min(...pairAngles);
      let maxAngle = Math.max(...pairAngles);
      if (pair.length === 1) {
        const halfSpan = SINGLE_RAIL_HALF_SPAN_DEGREES * Math.PI / 180;
        minAngle -= halfSpan;
        maxAngle += halfSpan;
      } else {
        const padding = RAIL_ARC_PADDING_DEGREES * Math.PI / 180;
        minAngle -= padding;
        maxAngle += padding;
      }

      const pairContactYs = pair
        .map((member) => number(member?.contactHeightWorld, NaN))
        .filter((value) => Number.isFinite(value));
      const pairCenterY = pairContactYs.length
        ? pairContactYs.reduce((sum, value) => sum + value, 0) / pairContactYs.length
        : rollerCenterY;
      const railY = pairCenterY - MOUNT_RAIL_DROP_MM * scale;

      const arcPoints = [];
      const arcSegments = Math.max(12, Math.ceil(Math.abs(maxAngle - minAngle) / (Math.PI / 120)));
      for (let segment = 0; segment <= arcSegments; segment += 1) {
        const ratio = segment / arcSegments;
        const angle = minAngle + (maxAngle - minAngle) * ratio;
        arcPoints.push(new THREE.Vector3(
          Math.cos(angle) * railRadius - masterX,
          railY,
          Math.sin(angle) * railRadius - masterZ
        ));
      }

      const railCurve = new THREE.CatmullRomCurve3(arcPoints, false, "catmullrom", 0.05);
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(railCurve, Math.max(24, arcSegments * 2), railTubeRadius, 16, false),
        railMaterial
      );
      rail.name = `ServoForgeWipeRollerPairMountRail${pairIndex + 1}-${side}`;
      rail.castShadow = true;
      rail.receiveShadow = true;
      rail.userData.concentricWithCarousel = true;
      rail.userData.pairMountId = `roller-pair-${side}-${pairIndex + 1}`;
      group.add(rail);

      pair.forEach((member, memberIndex) => {
        const memberX = number(member?.position?.x);
        const memberZ = number(member?.position?.z);
        const memberAngle = number(member._angle);
        const memberRadial = radial(member?.position);
        const memberY = Number.isFinite(Number(member?.contactHeightWorld))
          ? number(member.contactHeightWorld)
          : pairCenterY;
        const localCenter = new THREE.Vector3(memberX - masterX, memberY, memberZ - masterZ);
        const direction = new THREE.Vector3(memberRadial.x * sign, 0, memberRadial.z * sign);
        const armStart = localCenter.clone().addScaledVector(direction, headBackOffset);
        const railMountTop = new THREE.Vector3(
          Math.cos(memberAngle) * railRadius - masterX,
          memberY,
          Math.sin(memberAngle) * railRadius - masterZ
        );
        const railMountBottom = railMountTop.clone();
        railMountBottom.y = railY;

        const arm = boxBetweenPoints(
          THREE,
          armStart,
          railMountTop,
          EXTENSION_BAR_HEIGHT_MM * scale,
          EXTENSION_BAR_DEPTH_MM * scale,
          mountMaterial
        );
        arm.name = `ServoForgeWipeRollerPairExtensionArm${pairIndex + 1}-${memberIndex + 1}`;
        arm.castShadow = true;
        arm.userData.radialCenterlineMember = true;
        arm.userData.pairMountId = `roller-pair-${side}-${pairIndex + 1}`;
        group.add(arm);

        const riser = cylinderBetweenPoints(THREE, railMountBottom, railMountTop, riserRadius, railMaterial, 20);
        riser.name = `ServoForgeWipeRollerPairRiser${pairIndex + 1}-${memberIndex + 1}`;
        riser.castShadow = true;
        riser.userData.pairMountId = `roller-pair-${side}-${pairIndex + 1}`;
        group.add(riser);

        const collar = new THREE.Mesh(
          new THREE.CylinderGeometry(railTubeRadius * 1.55, railTubeRadius * 1.55, 18 * scale, 20),
          darkMaterial
        );
        collar.name = `ServoForgeWipeRollerPairRailCollar${pairIndex + 1}-${memberIndex + 1}`;
        collar.position.copy(railMountBottom);
        collar.userData.pairMountId = `roller-pair-${side}-${pairIndex + 1}`;
        group.add(collar);
      });

      renderedPairs.push(Object.freeze({
        pairMountId: `roller-pair-${side}-${pairIndex + 1}`,
        side,
        memberIds: Object.freeze(pair.map((member) => String(member?.id || "roller"))),
        railRadiusWorld: railRadius,
        railRadiusAuthority: PAIR_MOUNT_RULES.railRadiusAuthority,
        concentricWithCarousel: true
      }));
    });

    group.userData.rollerPairMounting = Object.freeze({
      rules: PAIR_MOUNT_RULES,
      pairCount: renderedPairs.length,
      pairs: Object.freeze(renderedPairs),
      railDiameterMm: MOUNT_RAIL_DIAMETER_MM,
      riserDiameterMm: MOUNT_RISER_DIAMETER_MM,
      standOffMm: MOUNT_STANDOFF_MM,
      dimensionalAuthority: false
    });
  }

  function create(THREE, item, geometry, context = {}) {
    const group = baseModel.create(THREE, item, geometry, context);
    if (!group) return group;

    removeLegacySideWideMount(group);
    correctDirectHeadDirection(THREE, group, item);

    const rollerRoot = group.getObjectByName?.("ServoForgeWipeRollerTiltRoot");
    const rollerCenterY = number(rollerRoot?.position?.y, number(item?.contactHeightWorld, 0));
    addPairMountingSystems(THREE, item, geometry, group, rollerCenterY);

    group.userData.standingRules = Object.freeze({
      ...(baseModel.standingRules || {}),
      ...PAIR_MOUNT_RULES
    });
    group.userData.hardwareReference = Object.freeze({
      ...(group.userData.hardwareReference || {}),
      modelVersion: MODEL_VERSION,
      pairMounted: true,
      pairMountAuthority: PAIR_MOUNT_RULES,
      railConcentricWithCarousel: true,
      sideWideRailRemoved: true,
      outerMountDirection: "radially-outward",
      innerMountDirection: "radially-inward"
    });
    return group;
  }

  global.Labeler3DWipeRollerModel = Object.freeze({
    ...baseModel,
    MODEL_VERSION,
    create,
    standingRules: Object.freeze({
      ...(baseModel.standingRules || {}),
      ...PAIR_MOUNT_RULES
    }),
    pairMountRules: PAIR_MOUNT_RULES,
    authority: Object.freeze({
      ...(baseModel.authority || {}),
      pairMounted: true,
      pairMountAuthority: PAIR_MOUNT_RULES,
      railConcentricWithCarousel: true,
      railRadiusAuthority: PAIR_MOUNT_RULES.railRadiusAuthority,
      renderOwnership: "models/wipe-roller.js + models/wipe-roller-pair-mount-authority.js"
    })
  });
})(window);
