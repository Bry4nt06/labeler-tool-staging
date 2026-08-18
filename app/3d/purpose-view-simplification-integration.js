(function installServoForge3DPurposeViewSimplification(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createAggregateAssembly || !baseFactory?.createEquipmentAssembly) {
    throw new Error("ServoForge purpose-view simplification requires the active 3D hardware factory.");
  }

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v8-purpose-view-simplified";
  const PURPOSE = "functional-placement-reference";
  const PAD_REFERENCE_CENTER_Y = 0.60;

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

  function createRollerOnlyAssembly(THREE, item, geometry) {
    const metrics = bottleMetrics(geometry);
    const ratios = profile("wipe-roller")?.visualRatios || {};
    const rollerDiameter = Math.max(0.12, metrics.diameter * number(ratios.rollerDiameterBottleDiameter, 0.72));
    const rollerHeight = Math.max(0.22, metrics.height * number(ratios.rollerHeightBottleHeight, 0.28));
    const rollerRadius = rollerDiameter / 2;
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
    roller.position.y = PAD_REFERENCE_CENTER_Y;
    roller.castShadow = true;
    group.add(roller);

    group.position.set(number(item?.position?.x), 0, number(item?.position?.z));
    group.rotation.y = number(item?.rotationY);
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
      dimensionalAuthority: false
    });
    return group;
  }

  function simplifyPadAssembly(assembly) {
    if (!assembly) return null;
    assembly.children.forEach((child) => {
      // The measured pad is the nested Group created by the measured pad mesh
      // factory. Mounting posts/crossbar are direct Mesh children of the wrapper.
      if (child?.isMesh) child.visible = false;
    });
    assembly.userData.purposeView = Object.freeze({
      mode: PURPOSE,
      measuredPadVisible: true,
      mountingPostsVisible: false,
      crossbarVisible: false
    });
    return assembly;
  }

  function createEquipmentAssembly(THREE, item, geometry) {
    if (!item) return null;
    if (item.kind === "roller") return createRollerOnlyAssembly(THREE, item, geometry);

    const assembly = baseFactory.createEquipmentAssembly(THREE, item, geometry);
    if (item.kind === "pad") return simplifyPadAssembly(assembly);
    return assembly;
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseFactory,
    FACTORY_VERSION,
    PURPOSE,
    SPENDER_VISIBLE_MESHES,
    createAggregateAssembly,
    createRollerOnlyAssembly,
    createEquipmentAssembly,
    simplifySpenderAssembly,
    simplifyPadAssembly
  });
})(window);
