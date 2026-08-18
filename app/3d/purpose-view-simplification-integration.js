(function installServoForge3DPurposeViewSimplification(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createAggregateAssembly || !baseFactory?.createEquipmentAssembly) {
    throw new Error("ServoForge purpose-view simplification requires the active 3D hardware factory.");
  }

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v9-functional-heights";
  const PURPOSE = "functional-placement-reference";
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const WIPE_PAD_BOTTOM_MM = 28;
  const WIPE_PAD_HEIGHT_MM = 70;

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

    const group = new THREE.Group();
    group.name = `ServoForgeRollerOnly-${String(item?.id || "roller")}`;
    const roller = new THREE.Mesh(
      new THREE.CylinderGeometry(rollerRadius, rollerRadius, rollerHeight, 36),
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
    group.add(roller);

    // With roller-only purpose view there is no mounting geometry whose yaw must
    // be preserved. Leaving the group unrotated allows the roller quaternion to
    // express the bottle-surface tangent directly in world coordinates.
    group.position.set(number(item?.position?.x), 0, number(item?.position?.z));
    group.userData.kind = item?.kind;
    group.userData.station = item?.station;
    group.userData.section = item?.section;
    group.userData.highlightMaterials = [rubberMaterial];
    group.userData.hardwareReference = Object.freeze({
      profileId: "wipe-roller",
      purposeView: PURPOSE,
      rollerBodyVisible: true,
      shaftVisible: false,
      hubVisible: false,
      mountingArmVisible: false,
      supportPostVisible: false,
      positionAuthority: "servoforge-machine-map",
      verticalAuthority: neck.authority,
      contactHeightMm: neck.targetYmm,
      surfaceTiltDegrees: neck.tiltDegrees,
      surfaceParallelContact: true,
      stationRotationY: number(item?.rotationY),
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
