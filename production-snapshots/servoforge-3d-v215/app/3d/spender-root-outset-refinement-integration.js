(function installServoForge3DSpenderRootOutsetRefinement(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createAggregateAssembly || !baseFactory?.createSpenderPlateAssembly) {
    throw new Error("ServoForge spender root-outset refinement requires the active 3D hardware factory.");
  }

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v11-spender-root-outset";
  const ADDITIONAL_ROOT_OUTSET_MM = 7;
  const ADDITIONAL_DOWNSTREAM_OFFSET_MM = 0;
  const ADDITIONAL_CENTER_OUTSET_MM = (ADDITIONAL_ROOT_OUTSET_MM + ADDITIONAL_DOWNSTREAM_OFFSET_MM) / 2;
  const TOTAL_ROOT_OUTSET_MM = Number(baseFactory.SPENDER_ROOT_OUTSET_MM || 2) + ADDITIONAL_ROOT_OUTSET_MM;
  const TOTAL_DOWNSTREAM_INSET_MM = Number(baseFactory.SPENDER_DOWNSTREAM_INSET_MM || 2);

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function unitsPerMm(geometry = {}) {
    return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.004450588));
  }

  function findFirst(root, name) {
    let found = null;
    root?.traverse?.((child) => {
      if (!found && child?.name === name) found = child;
    });
    return found;
  }

  function geometryWidth(mesh) {
    const parameterWidth = number(mesh?.geometry?.parameters?.width, 0);
    if (parameterWidth > 0) return parameterWidth;
    mesh?.geometry?.computeBoundingBox?.();
    const box = mesh?.geometry?.boundingBox;
    return box ? Math.max(0, number(box.max?.x) - number(box.min?.x)) : 0;
  }

  function applyRootOutsetRefinement(assembly, item, geometry) {
    if (!assembly) return assembly;
    const pivot = findFirst(assembly, "ServoForgeEngagementAnglePivot");
    const plate = findFirst(assembly, "ServoForgeSpenderPlate");
    if (!pivot || !plate || pivot.userData?.spenderRootOutsetV11Applied) return assembly;

    const scale = unitsPerMm(geometry);
    const plateLength = Math.max(scale, geometryWidth(plate));
    const outwardSign = number(item?.radialOutSign, 1) >= 0 ? 1 : -1;

    // The previous engagement layer established approximately +2 mm at the
    // upstream/knuckle end and -2 mm at the downstream end. The user requested
    // another +7 mm at the root while preserving the downstream end. To change
    // only one endpoint, split the additional 7 mm into a 3.5 mm outward center
    // shift plus a differential tilt that contributes +3.5 mm at the root and
    // -3.5 mm at the downstream end. Net incremental result: root +7 mm,
    // downstream 0 mm.
    const differentialWorld = (ADDITIONAL_ROOT_OUTSET_MM - ADDITIONAL_DOWNSTREAM_OFFSET_MM) * scale;
    const additionalAngleRadians = Math.atan2(differentialWorld, plateLength);
    const centerOutsetWorld = ADDITIONAL_CENTER_OUTSET_MM * scale;

    pivot.rotation.y += outwardSign * additionalAngleRadians;
    pivot.position.z += outwardSign * centerOutsetWorld;

    pivot.userData.spenderRootOutsetV11Applied = true;
    pivot.userData.additionalRootOutsetMm = ADDITIONAL_ROOT_OUTSET_MM;
    pivot.userData.additionalDownstreamOffsetMm = ADDITIONAL_DOWNSTREAM_OFFSET_MM;
    pivot.userData.additionalCenterOutsetMm = ADDITIONAL_CENTER_OUTSET_MM;
    pivot.userData.additionalAngleRadians = additionalAngleRadians;
    pivot.userData.additionalAngleDegrees = additionalAngleRadians * 180 / Math.PI;
    pivot.userData.totalRootOutsetMm = TOTAL_ROOT_OUTSET_MM;
    pivot.userData.totalDownstreamInsetMm = TOTAL_DOWNSTREAM_INSET_MM;
    pivot.userData.refinementAuthority = "user-requested-additional-7mm-root-outset-only";

    assembly.userData.spenderRootOutsetRefinement = Object.freeze({
      additionalRootOutsetMm: ADDITIONAL_ROOT_OUTSET_MM,
      additionalDownstreamOffsetMm: ADDITIONAL_DOWNSTREAM_OFFSET_MM,
      additionalCenterOutsetMm: ADDITIONAL_CENTER_OUTSET_MM,
      totalRootOutsetMm: TOTAL_ROOT_OUTSET_MM,
      totalDownstreamInsetMm: TOTAL_DOWNSTREAM_INSET_MM,
      downstreamPositionPreserved: true,
      mapAnglePreserved: true,
      servoAuthorityUntouched: true,
      dimensionalAuthority: "user-requested-9mm-total-root-outset-2mm-downstream-inset"
    });

    return assembly;
  }

  function createAggregateAssembly(THREE, item, geometry) {
    return applyRootOutsetRefinement(baseFactory.createAggregateAssembly(THREE, item, geometry), item, geometry);
  }

  function createSpenderPlateAssembly(THREE, item, geometry) {
    return applyRootOutsetRefinement(baseFactory.createSpenderPlateAssembly(THREE, item, geometry), item, geometry);
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseFactory,
    FACTORY_VERSION,
    ADDITIONAL_ROOT_OUTSET_MM,
    ADDITIONAL_DOWNSTREAM_OFFSET_MM,
    ADDITIONAL_CENTER_OUTSET_MM,
    TOTAL_ROOT_OUTSET_MM,
    TOTAL_DOWNSTREAM_INSET_MM,
    createSpenderPlateAssembly,
    createAggregateAssembly
  });
})(window);
