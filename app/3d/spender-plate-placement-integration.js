(function installServoForge3DSpenderPlatePlacement(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory) throw new Error("ServoForge 3D spender placement requires Labeler3DHardwareMeshFactory.");

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v2-spender-placement";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function material(THREE, options) {
    return new THREE.MeshStandardMaterial(options);
  }

  function catalogProfile() {
    return global.Labeler3DHardwareReferenceCatalog?.profile?.("application-spender") || null;
  }

  function bottleMetrics(geometry = {}) {
    const diameter = Math.max(0.10, number(geometry?.bottle?.diameterWorld, 0.27));
    const height = Math.max(0.35, number(geometry?.bottle?.visualHeightWorld, 1.05));
    return Object.freeze({ diameter, radius: diameter / 2, height });
  }

  function verticalCylinder(THREE, radius, length, color, metalness = 0.78, roughness = 0.28) {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 28),
      material(THREE, { color, metalness, roughness })
    );
  }

  function createSpenderPlateAssembly(THREE, aggregateItem, geometry) {
    const metrics = bottleMetrics(geometry);
    const ref = catalogProfile();
    const ratios = ref?.visualRatios || {};
    const assembly = new THREE.Group();
    const aggregate = Number(aggregateItem?.aggregate) || 0;
    assembly.name = `ServoForgeSpenderPlateAssembly${aggregate || ""}`;

    const unitsPerMm = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.00445));
    const clearanceMm = Math.max(0, number(aggregateItem?.applicationClearanceMm, 2));
    const clearanceWorld = Math.max(0, number(aggregateItem?.applicationClearanceWorld, clearanceMm * unitsPerMm));
    const outwardSign = number(aggregateItem?.radialOutSign, 1) >= 0 ? 1 : -1;
    const applicationY = Math.max(0.18, number(aggregateItem?.applicationHeightWorld, metrics.height * 0.58));

    const plateLength = Math.max(0.38, metrics.diameter * number(ratios.plateLengthBottleDiameters, 1.65));
    const plateHeight = Math.max(0.30, metrics.height * number(ratios.plateHeightBottleHeights, 0.43));
    const plateThickness = Math.max(4 * unitsPerMm, metrics.diameter * number(ratios.plateThicknessBottleDiameters, 0.10));
    const supportWidth = Math.max(0.07, metrics.diameter * number(ratios.supportPostBottleDiameters, 0.42));
    const clampRadius = Math.max(0.035, metrics.diameter * number(ratios.clampDiameterBottleDiameters, 0.48) / 2);
    const armReach = Math.max(0.42, metrics.diameter * number(ratios.armLengthBottleDiameters, 2.0));
    const armRadius = Math.max(0.018, metrics.diameter * 0.085);

    // The group origin is the bottle centerline at the machine-map application
    // angle. Local +X is downstream bottle flow. Local +/-Z is radial, with the
    // sign supplied by the equipment adapter. The bottle-facing plate surface is
    // therefore radius + 2 mm from the bottle centerline, independent of CW/CCW.
    const bottleFacingSurfaceZ = outwardSign * (metrics.radius + clearanceWorld);
    const plateCenterZ = bottleFacingSurfaceZ + outwardSign * plateThickness / 2;

    // The application/peel edge is x=0. The plate extends upstream (-X), which
    // matches a bottle travelling downstream (+X) past the spender edge.
    const plateCenterX = -plateLength / 2;
    const supportZ = plateCenterZ + outwardSign * armReach;
    const supportX = -plateLength * 0.46;

    const armMaterial = material(THREE, { color: 0xa3adb1, roughness: 0.27, metalness: 0.86, emissive: 0x000000, emissiveIntensity: 0 });
    const plateMaterial = material(THREE, { color: 0xcfd5d7, roughness: 0.20, metalness: 0.92, emissive: 0x000000, emissiveIntensity: 0 });
    const edgeMaterial = material(THREE, { color: 0xf3f6f7, roughness: 0.16, metalness: 0.94, emissive: 0x000000, emissiveIntensity: 0 });
    const darkMaterial = material(THREE, { color: 0x30383c, roughness: 0.46, metalness: 0.48 });

    const postHeight = Math.max(applicationY + plateHeight * 0.72, metrics.height * 0.78);
    const supportPost = new THREE.Mesh(new THREE.BoxGeometry(supportWidth, postHeight, supportWidth), darkMaterial);
    supportPost.position.set(supportX, postHeight / 2, supportZ);
    supportPost.castShadow = true;
    assembly.add(supportPost);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(supportWidth * 2.4, Math.max(0.06, supportWidth * 0.55), supportWidth * 2.4),
      darkMaterial
    );
    base.position.set(supportX, Math.max(0.03, supportWidth * 0.275), supportZ);
    assembly.add(base);

    const armRoot = new THREE.Group();
    armRoot.name = "ServoForgeApplicationArmRoot";
    armRoot.position.set(supportX, applicationY, supportZ);
    assembly.add(armRoot);

    const forwardPivot = new THREE.Group();
    forwardPivot.name = "ServoForgeForwardAnglePivot";
    armRoot.add(forwardPivot);

    const sidePivot = new THREE.Group();
    sidePivot.name = "ServoForgeSideAnglePivot";
    forwardPivot.add(sidePivot);

    // Radial tube from the machine-side support toward the plate.
    const tube = verticalCylinder(THREE, armRadius, armReach, 0xa3adb1, 0.86, 0.27);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = -outwardSign * armReach / 2;
    sidePivot.add(tube);

    const rootClamp = verticalCylinder(THREE, clampRadius, Math.max(0.055, supportWidth * 0.78), 0x69757a, 0.84, 0.24);
    rootClamp.rotation.x = Math.PI / 2;
    rootClamp.position.z = -outwardSign * armReach * 0.18;
    sidePivot.add(rootClamp);

    const outerClamp = rootClamp.clone();
    outerClamp.position.z = -outwardSign * armReach * 0.78;
    sidePivot.add(outerClamp);

    const engagementPivot = new THREE.Group();
    engagementPivot.name = "ServoForgeEngagementAnglePivot";
    engagementPivot.position.z = -outwardSign * armReach;
    sidePivot.add(engagementPivot);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(plateLength, plateHeight, plateThickness), plateMaterial);
    plate.name = "ServoForgeSpenderPlate";
    plate.position.set(plateCenterX - supportX, 0, 0);
    plate.castShadow = true;
    plate.receiveShadow = true;
    engagementPivot.add(plate);

    const peelEdgeWidth = Math.max(2 * unitsPerMm, plateThickness * 0.58);
    const peelEdge = new THREE.Mesh(
      new THREE.BoxGeometry(peelEdgeWidth, plateHeight * 0.98, plateThickness * 1.30),
      edgeMaterial
    );
    peelEdge.name = "ServoForgeSpenderPlatePeelEdge";
    peelEdge.position.set(-supportX, 0, 0);
    engagementPivot.add(peelEdge);

    const guideRadius = Math.max(0.018, metrics.diameter * 0.095);
    const guideRoller = verticalCylinder(THREE, guideRadius, plateHeight * 0.78, 0x929ca1, 0.82, 0.23);
    guideRoller.position.set(-plateLength * 0.83 - supportX, 0, outwardSign * (plateThickness * 1.55 + guideRadius));
    engagementPivot.add(guideRoller);

    const labelWeb = new THREE.Mesh(
      new THREE.PlaneGeometry(plateLength * 0.76, plateHeight * 0.70),
      new THREE.MeshStandardMaterial({ color: 0xf7f7ee, roughness: 0.60, metalness: 0, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    labelWeb.position.set(plateCenterX - supportX, 0, -outwardSign * (plateThickness / 2 + 0.002));
    engagementPivot.add(labelWeb);

    assembly.userData.hardwareReference = Object.freeze({
      profileId: "application-spender",
      source: ref?.visualSource || "reference",
      dimensionalAuthority: false,
      mechanicalHierarchyAuthority: true,
      placementAuthority: true
    });
    assembly.userData.spenderPlate = Object.freeze({
      aggregate,
      applicationZone: String(aggregateItem?.applicationZone || (aggregate <= 2 ? "neck" : "body")),
      flowAligned: true,
      downstreamLocalAxis: "+X",
      plateExtends: "upstream-negative-X",
      bottleClearanceMm: clearanceMm,
      bottleClearanceWorld: clearanceWorld,
      clearanceAuthority: String(aggregateItem?.clearanceAuthority || "user-specified-2mm"),
      bottleFacingSurfaceZ,
      plateCenterZ,
      applicationHeightWorld: applicationY,
      applicationHeightAuthority: String(aggregateItem?.applicationHeightAuthority || "reference-bottle-profile"),
      radialOutSign: outwardSign,
      mechanicalHierarchyAuthority: true,
      dimensionalAuthority: false,
      adjustmentAuthority: false,
      pivots: Object.freeze(["forward-angle", "side-angle", "engagement-angle"])
    });
    assembly.userData.highlightMaterials = [armMaterial, plateMaterial, edgeMaterial];
    return assembly;
  }

  function createAggregateAssembly(THREE, item, geometry) {
    const group = new THREE.Group();
    group.name = `ServoForgeAggregate${item?.aggregate || ""}`;
    group.userData.aggregate = item?.aggregate;

    const spender = createSpenderPlateAssembly(THREE, item, geometry);
    group.add(spender);
    group.position.set(number(item?.position?.x), number(item?.position?.y, 0), number(item?.position?.z));
    group.rotation.y = number(item?.flowRotationY, number(item?.rotationY));
    group.userData.hardwareReference = spender.userData.hardwareReference;
    group.userData.spenderPlate = spender.userData.spenderPlate;
    group.userData.flowDirection = item?.flowDirection || null;
    group.userData.highlightMaterials = spender.userData.highlightMaterials || [];
    return group;
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseFactory,
    FACTORY_VERSION,
    createSpenderPlateAssembly,
    createAggregateAssembly
  });
})(window);
