(function installServoForge3DPurposeViewSimplification(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createAggregateAssembly || !baseFactory?.createEquipmentAssembly) {
    throw new Error("ServoForge purpose-view simplification requires the active 3D hardware factory.");
  }

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v10-mounted-roller-system";
  const PURPOSE = "functional-placement-reference";
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const WIPE_PAD_BOTTOM_MM = 28;
  const WIPE_PAD_HEIGHT_MM = 70;

  // Roller mounting dimensions are drawing-proportional presentation values
  // until measured machine dimensions are supplied. Mechanical hierarchy is
  // based on the user-supplied TopModul sponge-roller/support-bracket drawing.
  const ROLLER_RAIL_OUTSET_MM = 150;
  const ROLLER_RAIL_DIAMETER_MM = 30;
  const ROLLER_RAIL_ARC_DEGREES = 16;
  const ROLLER_SUPPORT_POST_DIAMETER_MM = 28;
  const ROLLER_SUPPORT_FOOT_DIAMETER_MM = 62;
  const ROLLER_SUPPORT_FOOT_HEIGHT_MM = 18;
  const ROLLER_ARM_HEIGHT_MM = 24;
  const ROLLER_ARM_DEPTH_MM = 30;
  const ROLLER_SHAFT_DIAMETER_MM = 14;
  const ROLLER_RAIL_VERTICAL_OFFSET_MM = 35;

  const SPENDER_VISIBLE_MESHES = new Set([
    "ServoForgeSpenderPlate",
    "ServoForgeSpenderPlatePeelEdge",
    "ServoForgeSpenderRefinedRedPivotDial",
    "ServoForgeSpenderRefinedPivotWasher",
    "ServoForgeSpenderRefinedPivotBolt",
    "ServoForgeSpenderRefinedBlackAdjustmentLink",
    "ServoForgeSpenderRefinedHingeFork",
    "ServoForgeSpenderRefinedHingePin",
    "ServoForgeSpenderRefinedPlateAdjustmentArm",
    "ServoForgeSpenderPlateSupportEar",
    "ServoForgeSpenderRefinedPlateMountPin",
    "ServoForgeSpenderRefinedAngleHandle",
    "ServoForgeSpenderRefinedHandleKnob"
  ]);

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function material(THREE, options) {
    return new THREE.MeshStandardMaterial(options);
  }

  function bottleMetrics(geometry = {}) {
    const diameter = Math.max(0.10, number(geometry?.bottle?.diameterWorld, 0.27));
    const height = Math.max(0.35, number(geometry?.bottle?.visualHeightWorld, 1.05));
    return Object.freeze({ diameter, height });
  }

  function worldUnitsPerMm(geometry = {}) {
    return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.004450588));
  }

  function bottleBaseYWorld() {
    return TABLE_Y + BOTTLE_LIFT;
  }

  function profile(id) {
    return global.Labeler3DHardwareReferenceCatalog?.profile?.(id) || null;
  }

  function meshIsPrimarySpenderPiece(mesh) {
    return SPENDER_VISIBLE_MESHES.has(String(mesh?.name || ""));
  }

  function simplifySpenderAssembly(assembly) {
    const visibleMaterials = [];
    assembly?.traverse?.((child) => {
      if (!child?.isMesh) return;
      child.visible = meshIsPrimarySpenderPiece(child);
      if (child.visible && child.material) {
        if (Array.isArray(child.material)) visibleMaterials.push(...child.material);
        else visibleMaterials.push(child.material);
      }
    });

    assembly.userData.purposeView = Object.freeze({
      mode: PURPOSE,
      spenderPlateVisible: true,
      knuckleVisible: true,
      mountingArmVisible: false,
      mainArmKnuckleLinkVisible: false,
      supportHardwareVisible: false,
      guideRollerVisible: false,
      labelWebVisible: false,
      approvedPlacementPreserved: true
    });
    assembly.userData.highlightMaterials = visibleMaterials;
    return assembly;
  }

  function createAggregateAssembly(THREE, item, geometry) {
    const assembly = baseFactory.createAggregateAssembly(THREE, item, geometry);
    if (!assembly) return null;
    return simplifySpenderAssembly(assembly);
  }

  function neckSlopeReference(geometry = {}) {
    const bottle = geometry?.bottle || {};
    const points = Array.isArray(bottle.profilePointsMm) ? bottle.profilePointsMm : [];
    const bodyTopMm = 10 + Math.max(1, number(bottle.bodyStraightHeightMm, 92));
    const shoulderTopMm = bodyTopMm + Math.max(1, number(bottle.shoulderTransitionHeightMm, 41.5));
    const finishStartMm = Math.max(
      shoulderTopMm + 1,
      number(bottle.referenceHeightMm, 241.5) - Math.max(1, number(bottle.finishHeightMm, 17))
    );
    const targetYmm = (shoulderTopMm + finishStartMm) / 2;

    let lower = null;
    let upper = null;
    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      if (number(a?.yMm) <= targetYmm && number(b?.yMm) >= targetYmm) {
        lower = a;
        upper = b;
        break;
      }
    }

    const deltaY = Math.max(0.000001, number(upper?.yMm, finishStartMm) - number(lower?.yMm, shoulderTopMm));
    const radialSlope = (number(upper?.radiusMm, bottle.finishOuterDiameterMm / 2) - number(lower?.radiusMm, bottle.shoulderNeckDiameterMm / 2)) / deltaY;
    const tiltRadians = Math.atan(Math.abs(radialSlope));

    return Object.freeze({
      targetYmm,
      radialSlope,
      tiltRadians,
      tiltDegrees: tiltRadians * 180 / Math.PI,
      authority: "reference-bottle-profile-neck-slope-midpoint"
    });
  }

  function cylinderBetweenPoints(THREE, start, end, radius, meshMaterial, segments = 24) {
    const a = new THREE.Vector3(number(start?.x), number(start?.y), number(start?.z));
    const b = new THREE.Vector3(number(end?.x), number(end?.y), number(end?.z));
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = Math.max(0.000001, delta.length());
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, segments),
      meshMaterial
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }

  function boxBetweenPoints(THREE, start, end, height, depth, meshMaterial) {
    const a = new THREE.Vector3(number(start?.x), number(start?.y), number(start?.z));
    const b = new THREE.Vector3(number(end?.x), number(end?.y), number(end?.z));
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = Math.max(0.000001, delta.length());
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(length, height, depth),
      meshMaterial
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
    return mesh;
  }

  function createCurvedRail(THREE, item, rollerCenterY, geometry, railMaterial) {
    const scale = worldUnitsPerMm(geometry);
    const worldX = number(item?.position?.x);
    const worldZ = number(item?.position?.z);
    const stationRadius = Math.max(scale, Math.hypot(worldX, worldZ));
    const stationAngle = Math.atan2(worldZ, worldX);
    const railRadiusFromCenter = stationRadius + ROLLER_RAIL_OUTSET_MM * scale;
    const railY = rollerCenterY - ROLLER_RAIL_VERTICAL_OFFSET_MM * scale;
    const halfSpan = ROLLER_RAIL_ARC_DEGREES * Math.PI / 360;
    const points = [];

    for (let index = 0; index <= 10; index += 1) {
      const t = index / 10;
      const angle = stationAngle - halfSpan + (halfSpan * 2) * t;
      points.push(new THREE.Vector3(
        Math.cos(angle) * railRadiusFromCenter - worldX,
        railY,
        Math.sin(angle) * railRadiusFromCenter - worldZ
      ));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const railTubeRadius = ROLLER_RAIL_DIAMETER_MM * scale / 2;
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, railTubeRadius, 14, false),
      railMaterial
    );
    rail.name = "ServoForgeRollerCurvedMountRail";
    rail.castShadow = true;
    rail.receiveShadow = true;

    const mountPoint = new THREE.Vector3(
      Math.cos(stationAngle) * railRadiusFromCenter - worldX,
      railY,
      Math.sin(stationAngle) * railRadiusFromCenter - worldZ
    );
    const radialUnit = new THREE.Vector3(worldX / stationRadius, 0, worldZ / stationRadius);
    const tangentUnit = new THREE.Vector3(-radialUnit.z, 0, radialUnit.x);

    return { rail, mountPoint, radialUnit, tangentUnit, railTubeRadius, railY };
  }

  function createRollerOnlyAssembly(THREE, item, geometry) {
    const metrics = bottleMetrics(geometry);
    const ratios = profile("wipe-roller")?.visualRatios || {};
    const rollerDiameter = Math.max(0.12, metrics.diameter * number(ratios.rollerDiameterBottleDiameter, 0.72));
    const rollerHeight = Math.max(0.22, metrics.height * number(ratios.rollerHeightBottleHeight, 0.28));
    const rollerRadius = rollerDiameter / 2;
    const unitsPerMm = worldUnitsPerMm(geometry);
    const neck = neckSlopeReference(geometry);
    const rollerCenterY = bottleBaseYWorld() + neck.targetYmm * unitsPerMm;

    const rubberMaterial = material(THREE, {
      color: 0x2a3033,
      roughness: 0.88,
      metalness: 0.02,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    const railMaterial = material(THREE, {
      color: 0x8d979c,
      roughness: 0.27,
      metalness: 0.82
    });
    const bracketMaterial = material(THREE, {
      color: 0x6f7b81,
      roughness: 0.31,
      metalness: 0.76
    });
    const darkHardwareMaterial = material(THREE, {
      color: 0x30383d,
      roughness: 0.42,
      metalness: 0.60
    });
    const hubMaterial = material(THREE, {
      color: 0xa2abb0,
      roughness: 0.24,
      metalness: 0.88
    });

    const group = new THREE.Group();
    group.name = `ServoForgeMountedRollerStation-${String(item?.id || "roller")}`;

    const roller = new THREE.Mesh(
      new THREE.CylinderGeometry(rollerRadius, rollerRadius, rollerHeight, 40),
      rubberMaterial
    );
    roller.name = "ServoForgePurposeViewRoller";
    roller.position.y = rollerCenterY;

    const radialMagnitude = Math.hypot(number(item?.position?.x), number(item?.position?.z)) || 1;
    const radialX = number(item?.position?.x) / radialMagnitude;
    const radialZ = number(item?.position?.z) / radialMagnitude;
    const slope = number(neck.radialSlope, 0);
    const contactAxis = new THREE.Vector3(radialX * slope, 1, radialZ * slope).normalize();
    roller.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), contactAxis);
    roller.castShadow = true;
    roller.receiveShadow = true;

    // Shaft and hub pieces are children of the roller so any later neck-contact
    // tilt correction applied to ServoForgePurposeViewRoller also carries the
    // mechanical spindle with it.
    const shaftRadius = ROLLER_SHAFT_DIAMETER_MM * unitsPerMm / 2;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius, shaftRadius, rollerHeight * 1.28, 24),
      hubMaterial
    );
    shaft.name = "ServoForgeRollerSpindleShaft";
    roller.add(shaft);

    const hubRadius = Math.max(shaftRadius * 1.8, rollerRadius * 0.34);
    [-1, 1].forEach((sign) => {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(hubRadius, hubRadius, Math.max(unitsPerMm * 10, rollerHeight * 0.045), 28),
        hubMaterial
      );
      cap.name = sign < 0 ? "ServoForgeRollerHubLower" : "ServoForgeRollerHubUpper";
      cap.position.y = sign * (rollerHeight / 2 + Math.max(unitsPerMm * 5, rollerHeight * 0.0225));
      roller.add(cap);
    });
    group.add(roller);

    const railData = createCurvedRail(THREE, item, rollerCenterY, geometry, railMaterial);
    group.add(railData.rail);

    const tableReferenceY = TABLE_Y + unitsPerMm * 8;
    const postRadius = ROLLER_SUPPORT_POST_DIAMETER_MM * unitsPerMm / 2;
    const post = cylinderBetweenPoints(
      THREE,
      { x: railData.mountPoint.x, y: tableReferenceY, z: railData.mountPoint.z },
      railData.mountPoint,
      postRadius,
      railMaterial,
      28
    );
    post.name = "ServoForgeRollerVerticalSupportPost";
    post.castShadow = true;
    group.add(post);

    const footHeight = ROLLER_SUPPORT_FOOT_HEIGHT_MM * unitsPerMm;
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(
        ROLLER_SUPPORT_FOOT_DIAMETER_MM * unitsPerMm / 2,
        ROLLER_SUPPORT_FOOT_DIAMETER_MM * unitsPerMm / 2,
        footHeight,
        30
      ),
      darkHardwareMaterial
    );
    foot.name = "ServoForgeRollerSupportFoot";
    foot.position.set(railData.mountPoint.x, tableReferenceY - footHeight / 2, railData.mountPoint.z);
    group.add(foot);

    const tangentSpan = Math.max(unitsPerMm * 52, railData.railTubeRadius * 3.4);
    const clamp = cylinderBetweenPoints(
      THREE,
      {
        x: railData.mountPoint.x - railData.tangentUnit.x * tangentSpan / 2,
        y: railData.mountPoint.y,
        z: railData.mountPoint.z - railData.tangentUnit.z * tangentSpan / 2
      },
      {
        x: railData.mountPoint.x + railData.tangentUnit.x * tangentSpan / 2,
        y: railData.mountPoint.y,
        z: railData.mountPoint.z + railData.tangentUnit.z * tangentSpan / 2
      },
      railData.railTubeRadius * 1.42,
      darkHardwareMaterial,
      24
    );
    clamp.name = "ServoForgeRollerRailClamp";
    group.add(clamp);

    const carrierEndRadius = Math.max(rollerRadius * 1.12, unitsPerMm * 40);
    const armEnd = new THREE.Vector3(
      railData.radialUnit.x * carrierEndRadius,
      rollerCenterY,
      railData.radialUnit.z * carrierEndRadius
    );
    const armStart = new THREE.Vector3(
      railData.mountPoint.x,
      rollerCenterY,
      railData.mountPoint.z
    );
    const arm = boxBetweenPoints(
      THREE,
      armStart,
      armEnd,
      ROLLER_ARM_HEIGHT_MM * unitsPerMm,
      ROLLER_ARM_DEPTH_MM * unitsPerMm,
      bracketMaterial
    );
    arm.name = "ServoForgeRollerCarrierArm";
    arm.castShadow = true;
    group.add(arm);

    const railKnuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(
        Math.max(unitsPerMm * 22, railData.railTubeRadius * 1.55),
        Math.max(unitsPerMm * 22, railData.railTubeRadius * 1.55),
        Math.max(unitsPerMm * 34, ROLLER_ARM_DEPTH_MM * unitsPerMm * 1.2),
        28
      ),
      bracketMaterial
    );
    railKnuckle.name = "ServoForgeRollerRailKnuckle";
    railKnuckle.position.copy(armStart);
    group.add(railKnuckle);

    const rollerKnuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(
        Math.max(unitsPerMm * 18, shaftRadius * 2.2),
        Math.max(unitsPerMm * 18, shaftRadius * 2.2),
        Math.max(unitsPerMm * 30, ROLLER_ARM_DEPTH_MM * unitsPerMm),
        28
      ),
      bracketMaterial
    );
    rollerKnuckle.name = "ServoForgeRollerHeadKnuckle";
    rollerKnuckle.position.copy(armEnd);
    group.add(rollerKnuckle);

    const forkOffset = Math.max(unitsPerMm * 18, rollerRadius * 0.42);
    [-1, 1].forEach((sign) => {
      const forkEnd = new THREE.Vector3(
        railData.radialUnit.x * rollerRadius * 0.30 + railData.tangentUnit.x * forkOffset * sign,
        rollerCenterY,
        railData.radialUnit.z * rollerRadius * 0.30 + railData.tangentUnit.z * forkOffset * sign
      );
      const fork = boxBetweenPoints(
        THREE,
        armEnd,
        forkEnd,
        Math.max(unitsPerMm * 12, ROLLER_ARM_HEIGHT_MM * unitsPerMm * 0.54),
        Math.max(unitsPerMm * 10, ROLLER_ARM_DEPTH_MM * unitsPerMm * 0.46),
        bracketMaterial
      );
      fork.name = sign < 0 ? "ServoForgeRollerForkLeft" : "ServoForgeRollerForkRight";
      group.add(fork);
    });

    const adjustmentStem = cylinderBetweenPoints(
      THREE,
      {
        x: railData.mountPoint.x,
        y: railData.mountPoint.y,
        z: railData.mountPoint.z
      },
      {
        x: railData.mountPoint.x,
        y: railData.mountPoint.y + unitsPerMm * 90,
        z: railData.mountPoint.z
      },
      unitsPerMm * 6,
      hubMaterial,
      18
    );
    adjustmentStem.name = "ServoForgeRollerAdjustmentStem";
    group.add(adjustmentStem);

    const adjustmentKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(unitsPerMm * 18, unitsPerMm * 18, unitsPerMm * 16, 24),
      darkHardwareMaterial
    );
    adjustmentKnob.name = "ServoForgeRollerAdjustmentKnob";
    adjustmentKnob.position.set(
      railData.mountPoint.x,
      railData.mountPoint.y + unitsPerMm * 98,
      railData.mountPoint.z
    );
    group.add(adjustmentKnob);

    group.position.set(number(item?.position?.x), 0, number(item?.position?.z));
    group.userData.kind = item?.kind;
    group.userData.station = item?.station;
    group.userData.section = item?.section;
    group.userData.highlightMaterials = [rubberMaterial];
    group.userData.hardwareReference = Object.freeze({
      profileId: "wipe-roller",
      purposeView: PURPOSE,
      rollerBodyVisible: true,
      shaftVisible: true,
      hubVisible: true,
      mountingArmVisible: true,
      supportPostVisible: true,
      curvedRailVisible: true,
      railClampVisible: true,
      adjustmentHardwareVisible: true,
      activeStationAuthority: "active-machine-map-only",
      positionAuthority: "servoforge-machine-map",
      verticalAuthority: neck.authority,
      contactHeightMm: neck.targetYmm,
      surfaceTiltDegrees: neck.tiltDegrees,
      surfaceParallelContact: true,
      stationRotationY: number(item?.rotationY),
      mechanicalHierarchyAuthority: "user-supplied-topmodul-sponge-roller-support-bracket-drawing",
      dimensionalAuthority: false,
      mountingDimensionsAuthority: "drawing-proportional-until-measured"
    });
    group.userData.rollerMountingSystem = Object.freeze({
      components: Object.freeze([
        "sponge-roller",
        "spindle-shaft",
        "upper-lower-hubs",
        "roller-head-knuckle",
        "fork-bracket",
        "carrier-arm",
        "rail-knuckle",
        "curved-support-rail",
        "rail-clamp",
        "vertical-support-post",
        "support-foot",
        "adjustment-stem",
        "adjustment-knob"
      ]),
      extraInactiveRollersCreated: false,
      activeRollerCountAuthority: "active-machine-map",
      mechanicalReference: "user-supplied-roller-unit-drawing-2026-08-18",
      dimensionalAuthority: false
    });
    return group;
  }

  function wipePadCenterYWorld(item, geometry) {
    const unitsPerMm = worldUnitsPerMm(geometry);
    const padHeightMm = Math.max(1, number(item?.wipePad?.heightMm, WIPE_PAD_HEIGHT_MM));
    return bottleBaseYWorld() + (WIPE_PAD_BOTTOM_MM + padHeightMm / 2) * unitsPerMm;
  }

  function simplifyPadAssembly(assembly, item, geometry) {
    if (!assembly) return null;
    const centerY = wipePadCenterYWorld(item, geometry);
    assembly.children.forEach((child) => {
      // The measured pad is the nested Group created by the measured pad mesh
      // factory. Mounting posts/crossbar are direct Mesh children of the wrapper.
      if (child?.isMesh) child.visible = false;
      if (child?.isGroup && String(child?.name || "").startsWith("ServoForgeMeasuredWipePad-")) {
        child.position.y = centerY;
      }
    });
    assembly.userData.purposeView = Object.freeze({
      mode: PURPOSE,
      measuredPadVisible: true,
      mountingPostsVisible: false,
      crossbarVisible: false,
      bodyPanelBottomMm: WIPE_PAD_BOTTOM_MM,
      padHeightMm: Math.max(1, number(item?.wipePad?.heightMm, WIPE_PAD_HEIGHT_MM)),
      padCenterYWorld: centerY,
      verticalAuthority: "user-specified-body-panel-bottom-28mm-plus-measured-70mm-pad-height"
    });
    return assembly;
  }

  function createEquipmentAssembly(THREE, item, geometry) {
    if (!item) return null;
    if (item.kind === "roller") return createRollerOnlyAssembly(THREE, item, geometry);

    const assembly = baseFactory.createEquipmentAssembly(THREE, item, geometry);
    if (item.kind === "pad") return simplifyPadAssembly(assembly, item, geometry);
    return assembly;
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseFactory,
    FACTORY_VERSION,
    PURPOSE,
    TABLE_Y,
    BOTTLE_LIFT,
    WIPE_PAD_BOTTOM_MM,
    WIPE_PAD_HEIGHT_MM,
    SPENDER_VISIBLE_MESHES,
    neckSlopeReference,
    wipePadCenterYWorld,
    createAggregateAssembly,
    createRollerOnlyAssembly,
    createEquipmentAssembly,
    simplifySpenderAssembly,
    simplifyPadAssembly
  });
})(window);
