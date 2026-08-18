(function installServoForge3DSpenderPlatePlacement(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory) throw new Error("ServoForge 3D spender placement requires Labeler3DHardwareMeshFactory.");

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v3-spender-hardware-shape";

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

  function cylinder(THREE, radius, length, meshMaterial, segments = 28) {
    return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), meshMaterial);
  }

  function cylinderAlongZ(THREE, radius, length, meshMaterial, segments = 28) {
    const mesh = cylinder(THREE, radius, length, meshMaterial, segments);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  function boltHeadAlongZ(THREE, radius, depth, meshMaterial) {
    const bolt = cylinderAlongZ(THREE, radius, depth, meshMaterial, 16);
    return bolt;
  }

  function createClampCollar(THREE, tubeRadius, depth, collarMaterial, boltMaterial) {
    const group = new THREE.Group();
    group.name = "ServoForgeSpenderClamp";

    const collar = cylinderAlongZ(THREE, tubeRadius * 1.72, depth, collarMaterial, 32);
    group.add(collar);

    const splitGap = new THREE.Mesh(
      new THREE.BoxGeometry(tubeRadius * 0.48, tubeRadius * 1.25, depth * 1.10),
      material(THREE, { color: 0x242b2e, roughness: 0.48, metalness: 0.34 })
    );
    splitGap.position.x = tubeRadius * 1.42;
    group.add(splitGap);

    const ear = new THREE.Mesh(
      new THREE.BoxGeometry(tubeRadius * 0.85, tubeRadius * 1.40, depth * 1.05),
      collarMaterial
    );
    ear.position.x = tubeRadius * 2.02;
    group.add(ear);

    const bolt = boltHeadAlongZ(THREE, tubeRadius * 0.24, depth * 1.28, boltMaterial);
    bolt.position.x = tubeRadius * 2.02;
    group.add(bolt);

    return group;
  }

  function addPlateFasteners(THREE, parent, options) {
    const {
      plateLength,
      plateHeight,
      plateThickness,
      outwardSign,
      supportX,
      boltMaterial
    } = options;
    const boltRadius = Math.max(0.006, plateHeight * 0.024);
    const boltDepth = Math.max(0.008, plateThickness * 0.72);
    const x = -plateLength * 0.68 - supportX;
    [-0.30, 0, 0.30].forEach((heightRatio) => {
      const bolt = boltHeadAlongZ(THREE, boltRadius, boltDepth, boltMaterial);
      bolt.name = "ServoForgeSpenderPlateFastener";
      bolt.position.set(x, plateHeight * heightRatio, outwardSign * (plateThickness / 2 + boltDepth / 2));
      parent.add(bolt);
    });
  }

  function createSpenderPlateAssembly(THREE, aggregateItem, geometry) {
    const metrics = bottleMetrics(geometry);
    const ref = catalogProfile();
    const ratios = ref?.visualRatios || {};
    const assembly = new THREE.Group();
    const aggregate = Number(aggregateItem?.aggregate) || 0;
    const applicationZone = String(aggregateItem?.applicationZone || (aggregate <= 2 ? "neck" : "body"));
    assembly.name = `ServoForgeSpenderPlateAssembly${aggregate || ""}`;

    const unitsPerMm = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.00445));
    const clearanceMm = Math.max(0, number(aggregateItem?.applicationClearanceMm, 2));
    const clearanceWorld = Math.max(0, number(aggregateItem?.applicationClearanceWorld, clearanceMm * unitsPerMm));
    const outwardSign = number(aggregateItem?.radialOutSign, 1) >= 0 ? 1 : -1;
    const applicationY = Math.max(0.18, number(aggregateItem?.applicationHeightWorld, metrics.height * 0.58));

    // Photo-reference proportions only. Placement and the 2 mm bottle clearance
    // remain authoritative; these hardware dimensions are intentionally marked
    // provisional until direct machine measurements are supplied.
    const plateLength = Math.max(0.40, metrics.diameter * Math.max(1.72, number(ratios.plateLengthBottleDiameters, 1.65)));
    const bodyPlateHeight = Math.max(0.26, Math.min(metrics.height * 0.35, metrics.diameter * 1.28));
    const neckPlateHeight = Math.max(0.20, Math.min(metrics.height * 0.26, metrics.diameter * 0.92));
    const plateHeight = applicationZone === "neck" ? neckPlateHeight : bodyPlateHeight;
    const plateThickness = Math.max(3 * unitsPerMm, metrics.diameter * 0.045);
    const supportRadius = Math.max(0.026, metrics.diameter * 0.115);
    const armRadius = Math.max(0.019, metrics.diameter * 0.090);
    const clampDepth = Math.max(0.055, metrics.diameter * 0.30);
    const armReach = Math.max(0.46, metrics.diameter * Math.max(2.05, number(ratios.armLengthBottleDiameters, 2.0)));

    // The group origin is the bottle centerline at the machine-map application
    // angle. Local +X is downstream bottle flow. The bottle-facing plate surface
    // remains exactly bottle radius + 2 mm regardless of CW/CCW direction.
    const bottleFacingSurfaceZ = outwardSign * (metrics.radius + clearanceWorld);
    const plateCenterZ = bottleFacingSurfaceZ + outwardSign * plateThickness / 2;

    // The peel edge is x=0. The plate and label web extend upstream (-X).
    const plateCenterX = -plateLength / 2;
    const supportZ = plateCenterZ + outwardSign * armReach;
    const supportX = -plateLength * 0.50;

    const stainless = material(THREE, { color: 0xa9b2b6, roughness: 0.24, metalness: 0.88, emissive: 0x000000, emissiveIntensity: 0 });
    const polished = material(THREE, { color: 0xd3d8da, roughness: 0.15, metalness: 0.94, emissive: 0x000000, emissiveIntensity: 0 });
    const plateMaterial = material(THREE, { color: 0xcbd1d3, roughness: 0.22, metalness: 0.90, emissive: 0x000000, emissiveIntensity: 0 });
    const darkMaterial = material(THREE, { color: 0x30383c, roughness: 0.46, metalness: 0.48 });
    const backingMaterial = material(THREE, { color: 0x4a5357, roughness: 0.34, metalness: 0.76 });
    const boltMaterial = material(THREE, { color: 0xe2e5e6, roughness: 0.16, metalness: 0.94 });

    const postHeight = Math.max(applicationY + plateHeight * 0.92, metrics.height * 0.82);
    const supportPost = cylinder(THREE, supportRadius, postHeight, stainless, 32);
    supportPost.name = "ServoForgeSpenderSupportPost";
    supportPost.position.set(supportX, postHeight / 2, supportZ);
    supportPost.castShadow = true;
    assembly.add(supportPost);

    const baseFoot = cylinder(THREE, supportRadius * 1.62, Math.max(0.045, supportRadius * 0.64), darkMaterial, 28);
    baseFoot.name = "ServoForgeSpenderSupportFoot";
    baseFoot.position.set(supportX, Math.max(0.025, supportRadius * 0.32), supportZ);
    assembly.add(baseFoot);

    const lowerPostCollar = cylinder(THREE, supportRadius * 1.38, Math.max(0.035, supportRadius * 0.72), backingMaterial, 28);
    lowerPostCollar.position.set(supportX, applicationY - plateHeight * 0.45, supportZ);
    assembly.add(lowerPostCollar);

    const upperPostCollar = lowerPostCollar.clone();
    upperPostCollar.position.y = applicationY + plateHeight * 0.45;
    assembly.add(upperPostCollar);

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

    const mountTube = cylinderAlongZ(THREE, armRadius, armReach, stainless, 30);
    mountTube.name = "ServoForgeSpenderMountTube";
    mountTube.position.z = -outwardSign * armReach / 2;
    sidePivot.add(mountTube);

    const rootClamp = createClampCollar(THREE, armRadius, clampDepth, backingMaterial, boltMaterial);
    rootClamp.position.z = -outwardSign * armReach * 0.14;
    sidePivot.add(rootClamp);

    const centerClamp = createClampCollar(THREE, armRadius, clampDepth, backingMaterial, boltMaterial);
    centerClamp.position.z = -outwardSign * armReach * 0.52;
    centerClamp.rotation.z = Math.PI;
    sidePivot.add(centerClamp);

    const plateClamp = createClampCollar(THREE, armRadius, clampDepth, backingMaterial, boltMaterial);
    plateClamp.position.z = -outwardSign * armReach * 0.88;
    sidePivot.add(plateClamp);

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

    const backingSpineDepth = Math.max(0.025, plateThickness * 3.8);
    const backingSpineWidth = Math.max(0.040, plateLength * 0.075);
    const backingSpine = new THREE.Mesh(
      new THREE.BoxGeometry(backingSpineWidth, plateHeight * 1.04, backingSpineDepth),
      backingMaterial
    );
    backingSpine.name = "ServoForgeSpenderBackbone";
    backingSpine.position.set(-plateLength * 0.70 - supportX, 0, outwardSign * (plateThickness / 2 + backingSpineDepth / 2));
    engagementPivot.add(backingSpine);

    const mountingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.11, plateLength * 0.28), Math.max(0.045, plateHeight * 0.13), Math.max(0.035, backingSpineDepth * 0.86)),
      backingMaterial
    );
    mountingBlade.name = "ServoForgeSpenderPlateMountBlade";
    mountingBlade.position.set(-plateLength * 0.50 - supportX, 0, outwardSign * (plateThickness / 2 + backingSpineDepth * 0.72));
    engagementPivot.add(mountingBlade);

    const peelEdgeWidth = Math.max(1.5 * unitsPerMm, plateThickness * 0.48);
    const peelEdge = new THREE.Mesh(
      new THREE.BoxGeometry(peelEdgeWidth, plateHeight * 0.985, plateThickness * 1.42),
      polished
    );
    peelEdge.name = "ServoForgeSpenderPlatePeelEdge";
    peelEdge.position.set(-supportX, 0, 0);
    engagementPivot.add(peelEdge);

    const guideRadius = Math.max(0.028, metrics.diameter * 0.17);
    const guideHeight = plateHeight * 0.88;
    const guideX = -plateLength * 0.90 - supportX;
    const guideZ = outwardSign * (plateThickness / 2 + guideRadius * 1.08);

    const guideRoller = cylinder(THREE, guideRadius, guideHeight, polished, 36);
    guideRoller.name = "ServoForgeSpenderGuideRoller";
    guideRoller.position.set(guideX, 0, guideZ);
    guideRoller.castShadow = true;
    engagementPivot.add(guideRoller);

    const guideAxleRadius = Math.max(0.008, guideRadius * 0.24);
    const guideAxle = cylinder(THREE, guideAxleRadius, guideHeight * 1.14, backingMaterial, 22);
    guideAxle.name = "ServoForgeSpenderGuideRollerAxle";
    guideAxle.position.set(guideX, 0, guideZ);
    engagementPivot.add(guideAxle);

    [-1, 1].forEach((verticalSign) => {
      const cap = cylinder(THREE, guideRadius * 1.08, Math.max(0.012, guideHeight * 0.045), boltMaterial, 28);
      cap.name = "ServoForgeSpenderGuideRollerCap";
      cap.position.set(guideX, verticalSign * guideHeight * 0.52, guideZ);
      engagementPivot.add(cap);
    });

    addPlateFasteners(THREE, engagementPivot, {
      plateLength,
      plateHeight,
      plateThickness,
      outwardSign,
      supportX,
      boltMaterial
    });

    const webHeight = plateHeight * 0.70;
    const bottleFacingZ = -outwardSign * (plateThickness / 2 + 0.0025);
    const plateWeb = new THREE.Mesh(
      new THREE.PlaneGeometry(plateLength * 0.79, webHeight),
      new THREE.MeshStandardMaterial({ color: 0xf8f8ef, roughness: 0.58, metalness: 0, transparent: true, opacity: 0.52, side: THREE.DoubleSide })
    );
    plateWeb.name = "ServoForgeSpenderPlateLabelWeb";
    plateWeb.position.set(-plateLength * 0.47 - supportX, 0, bottleFacingZ);
    engagementPivot.add(plateWeb);

    const feederWebLength = Math.max(0.08, plateLength * 0.18);
    const feederWeb = new THREE.Mesh(
      new THREE.PlaneGeometry(feederWebLength, webHeight * 0.94),
      new THREE.MeshStandardMaterial({ color: 0xf8f8ef, roughness: 0.60, metalness: 0, transparent: true, opacity: 0.44, side: THREE.DoubleSide })
    );
    feederWeb.name = "ServoForgeSpenderFeederLabelWeb";
    feederWeb.position.set(guideX + feederWebLength * 0.46, 0, bottleFacingZ);
    engagementPivot.add(feederWeb);

    assembly.userData.hardwareReference = Object.freeze({
      profileId: "application-spender",
      source: ref?.visualSource || "reference",
      dimensionalAuthority: false,
      mechanicalHierarchyAuthority: true,
      placementAuthority: true,
      photoDetailLevel: "spender-hardware-v3"
    });
    assembly.userData.spenderPlate = Object.freeze({
      aggregate,
      applicationZone,
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
      hardwareShapeAuthority: "photo-referenced-provisional-dimensions",
      guideRollerRendered: true,
      clampCollarsRendered: 3,
      backingSpineRendered: true,
      labelWebRendered: true,
      mechanicalHierarchyAuthority: true,
      dimensionalAuthority: false,
      adjustmentAuthority: false,
      pivots: Object.freeze(["forward-angle", "side-angle", "engagement-angle"])
    });
    assembly.userData.highlightMaterials = [stainless, plateMaterial, polished];
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
