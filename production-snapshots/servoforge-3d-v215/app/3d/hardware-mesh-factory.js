(function installServoForge3DHardwareMeshFactory(global) {
  "use strict";

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v1";
  const PAD_REFERENCE_CENTER_Y = 0.60;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function material(THREE, options) {
    return new THREE.MeshStandardMaterial(options);
  }

  function catalog() {
    return global.Labeler3DHardwareReferenceCatalog || null;
  }

  function wipeMeshFactory() {
    return global.Labeler3DWipePadMeshFactory || null;
  }

  function profile(id) {
    return catalog()?.profile?.(id) || null;
  }

  function bottleMetrics(geometry = {}) {
    const diameter = Math.max(0.10, number(geometry?.bottle?.diameterWorld, 0.27));
    const height = Math.max(0.35, number(geometry?.bottle?.visualHeightWorld, 1.05));
    return Object.freeze({ diameter, radius: diameter / 2, height });
  }

  function cylinderBetween(THREE, radius, length, color, metalness = 0.75, roughness = 0.30) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 24),
      material(THREE, { color, metalness, roughness })
    );
    return mesh;
  }

  function createSpenderPlateAssembly(THREE, aggregateItem, geometry) {
    const metrics = bottleMetrics(geometry);
    const ref = profile("application-spender");
    const ratios = ref?.visualRatios || {};
    const assembly = new THREE.Group();
    assembly.name = `ServoForgeSpenderPlateAssembly${aggregateItem?.aggregate || ""}`;

    const armLength = Math.max(0.48, metrics.diameter * number(ratios.armLengthBottleDiameters, 2.0));
    const plateLength = Math.max(0.38, metrics.diameter * number(ratios.plateLengthBottleDiameters, 1.65));
    const plateHeight = Math.max(0.38, metrics.height * number(ratios.plateHeightBottleHeights, 0.43));
    const plateThickness = Math.max(0.018, metrics.diameter * number(ratios.plateThicknessBottleDiameters, 0.10));
    const clampRadius = Math.max(0.045, metrics.diameter * number(ratios.clampDiameterBottleDiameters, 0.48) / 2);
    const supportWidth = Math.max(0.08, metrics.diameter * number(ratios.supportPostBottleDiameters, 0.42));

    const armMaterial = material(THREE, { color: 0x9aa3a7, roughness: 0.28, metalness: 0.84, emissive: 0x000000, emissiveIntensity: 0 });
    const plateMaterial = material(THREE, { color: 0xcbd1d3, roughness: 0.22, metalness: 0.90, emissive: 0x000000, emissiveIntensity: 0 });
    const edgeMaterial = material(THREE, { color: 0xf4f7f8, roughness: 0.18, metalness: 0.92, emissive: 0x000000, emissiveIntensity: 0 });
    const darkMaterial = material(THREE, { color: 0x2d3438, roughness: 0.48, metalness: 0.46 });

    const supportPost = new THREE.Mesh(new THREE.BoxGeometry(supportWidth, metrics.height * 0.72, supportWidth), darkMaterial);
    supportPost.position.set(0.15, metrics.height * 0.36, 0);
    assembly.add(supportPost);

    const armRoot = new THREE.Group();
    armRoot.name = "ServoForgeApplicationArmRoot";
    armRoot.position.set(0.10, metrics.height * 0.58, 0);
    assembly.add(armRoot);

    const forwardPivot = new THREE.Group();
    forwardPivot.name = "ServoForgeForwardAnglePivot";
    armRoot.add(forwardPivot);
    const sidePivot = new THREE.Group();
    sidePivot.name = "ServoForgeSideAnglePivot";
    forwardPivot.add(sidePivot);

    const tube = cylinderBetween(THREE, Math.max(0.022, metrics.diameter * 0.09), armLength, 0x9aa3a7);
    tube.rotation.z = Math.PI / 2;
    tube.position.x = -armLength / 2;
    sidePivot.add(tube);

    const rootClamp = cylinderBetween(THREE, clampRadius, Math.max(0.06, supportWidth * 0.80), 0x626d72, 0.82, 0.25);
    rootClamp.rotation.x = Math.PI / 2;
    rootClamp.position.x = -armLength * 0.18;
    sidePivot.add(rootClamp);
    const outerClamp = rootClamp.clone();
    outerClamp.position.x = -armLength * 0.78;
    sidePivot.add(outerClamp);

    const engagementPivot = new THREE.Group();
    engagementPivot.name = "ServoForgeEngagementAnglePivot";
    engagementPivot.position.set(-armLength, 0, 0);
    sidePivot.add(engagementPivot);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(plateLength, plateHeight, plateThickness), plateMaterial);
    plate.name = "ServoForgeSpenderPlate";
    plate.position.set(-plateLength * 0.42, -plateHeight * 0.05, 0);
    plate.castShadow = true;
    plate.receiveShadow = true;
    engagementPivot.add(plate);

    const peelEdge = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.018, plateThickness * 0.72), plateHeight * 0.98, plateThickness * 1.5), edgeMaterial);
    peelEdge.name = "ServoForgeSpenderPlatePeelEdge";
    peelEdge.position.set(-plateLength * 0.86, -plateHeight * 0.05, 0);
    engagementPivot.add(peelEdge);

    const guideRoller = cylinderBetween(THREE, Math.max(0.022, metrics.diameter * 0.10), plateHeight * 0.74, 0x8c969b, 0.80, 0.25);
    guideRoller.position.set(plateLength * 0.03, -plateHeight * 0.04, plateThickness * 1.05);
    engagementPivot.add(guideRoller);

    const labelWeb = new THREE.Mesh(
      new THREE.PlaneGeometry(plateLength * 0.70, plateHeight * 0.70),
      new THREE.MeshStandardMaterial({ color: 0xf7f7ee, roughness: 0.62, metalness: 0, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
    );
    labelWeb.position.set(-plateLength * 0.40, -plateHeight * 0.02, plateThickness * 0.72);
    engagementPivot.add(labelWeb);

    assembly.userData.hardwareReference = Object.freeze({
      profileId: "application-spender",
      source: ref?.visualSource || "reference",
      dimensionalAuthority: false,
      mechanicalHierarchyAuthority: true
    });
    assembly.userData.spenderPlate = Object.freeze({
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

    const baseMaterial = material(THREE, { color: 0x3f4b51, roughness: 0.34, metalness: 0.72, emissive: 0x000000, emissiveIntensity: 0 });
    const postMaterial = material(THREE, { color: 0x59676e, roughness: 0.30, metalness: 0.74, emissive: 0x000000, emissiveIntensity: 0 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), baseMaterial);
    base.position.y = 0.13;
    group.add(base);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.16), postMaterial);
    post.position.y = 0.55;
    group.add(post);

    const spender = createSpenderPlateAssembly(THREE, item, geometry);
    group.add(spender);
    group.position.set(number(item?.position?.x), 0, number(item?.position?.z));
    group.rotation.y = number(item?.rotationY);
    group.userData.hardwareReference = spender.userData.hardwareReference;
    group.userData.spenderPlate = spender.userData.spenderPlate;
    group.userData.highlightMaterials = [baseMaterial, postMaterial, ...(spender.userData.highlightMaterials || [])];
    return group;
  }

  function createRollerAssembly(THREE, item, geometry) {
    const metrics = bottleMetrics(geometry);
    const ref = profile("wipe-roller");
    const ratios = ref?.visualRatios || {};
    const group = new THREE.Group();
    const rollerDiameter = Math.max(0.12, metrics.diameter * number(ratios.rollerDiameterBottleDiameter, 0.72));
    const rollerHeight = Math.max(0.22, metrics.height * number(ratios.rollerHeightBottleHeight, 0.28));
    const rollerRadius = rollerDiameter / 2;
    const shaftRadius = Math.max(0.012, rollerDiameter * number(ratios.shaftDiameterRollerDiameter, 0.22) / 2);
    const postRadius = Math.max(0.016, rollerDiameter * number(ratios.supportPostDiameterRollerDiameter, 0.26) / 2);
    const supportHeight = rollerHeight * number(ratios.supportPostHeightRollerHeight, 1.65);
    const armLength = rollerDiameter * number(ratios.armLengthRollerDiameter, 1.25);

    const rubberMaterial = material(THREE, { color: 0x2a3033, roughness: 0.88, metalness: 0.02, emissive: 0x000000, emissiveIntensity: 0 });
    const hubMaterial = material(THREE, { color: 0x8d989e, roughness: 0.32, metalness: 0.78 });
    const mountMaterial = material(THREE, { color: 0x707d83, roughness: 0.30, metalness: 0.76 });

    const roller = new THREE.Mesh(new THREE.CylinderGeometry(rollerRadius, rollerRadius, rollerHeight, 36), rubberMaterial);
    roller.position.y = PAD_REFERENCE_CENTER_Y;
    roller.castShadow = true;
    group.add(roller);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(rollerRadius * 0.34, rollerRadius * 0.34, rollerHeight * 1.035, 28), hubMaterial);
    hub.position.y = PAD_REFERENCE_CENTER_Y;
    group.add(hub);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, rollerHeight * 1.28, 20), hubMaterial);
    shaft.position.y = PAD_REFERENCE_CENTER_Y;
    group.add(shaft);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, supportHeight, 24), mountMaterial);
    post.position.set(rollerRadius + armLength * 0.78, PAD_REFERENCE_CENTER_Y + supportHeight * 0.18, 0);
    group.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armLength, Math.max(0.035, postRadius * 1.5), Math.max(0.045, postRadius * 1.8)), mountMaterial);
    arm.position.set(rollerRadius + armLength / 2, PAD_REFERENCE_CENTER_Y + rollerHeight * 0.35, 0);
    group.add(arm);

    group.userData.hardwareReference = Object.freeze({
      profileId: "wipe-roller",
      source: ref?.visualSource || "reference",
      dimensionalAuthority: false,
      mechanicalHierarchyAuthority: true
    });
    group.userData.highlightMaterials = [rubberMaterial];
    return group;
  }

  function createMeasuredPadAssembly(THREE, item) {
    const measured = wipeMeshFactory()?.createMeasuredAssembly?.(THREE, item);
    if (!measured) return null;
    const ref = profile("wipe-pad");
    const ratios = ref?.visualRatios || {};
    const span = Math.max(0.12, number(item?.tangentLengthWorld, 0.30));
    const padHeight = Math.max(0.15, number(item?.wipePad?.heightWorld, 0.31));
    const postRadius = Math.max(0.018, padHeight * number(ratios.supportPostDiameterPadHeight, 0.12) / 2);
    const postHeight = padHeight * number(ratios.supportPostHeightPadHeight, 1.7);
    const crossbarRadius = Math.max(0.014, padHeight * number(ratios.crossbarDiameterPadHeight, 0.11) / 2);
    const crossbarLength = Math.max(0.18, span * number(ratios.crossbarLengthPadArc, 0.72));
    const mountMaterial = material(THREE, { color: 0x78858a, roughness: 0.28, metalness: 0.80 });
    const group = new THREE.Group();
    group.name = `ServoForgeMeasuredWipePadHardware-${String(item?.id || "pad")}`;

    measured.position.y = PAD_REFERENCE_CENTER_Y;
    group.add(measured);
    group.userData.wipePad = measured.userData.wipePad;
    group.userData.contactMaterials = measured.userData.contactMaterials || [];

    const sideSign = item?.wipePad?.side === "inner" ? -1 : 1;
    const radialOffset = sideSign * (number(item?.wipePad?.totalThicknessWorld, 0.10) / 2 + postRadius * 3.0);
    [-0.30, 0.30].forEach((ratio) => {
      const post = cylinderBetween(THREE, postRadius, postHeight, 0x78858a, 0.80, 0.28);
      post.position.set(radialOffset, PAD_REFERENCE_CENTER_Y + padHeight * 0.20, span * ratio);
      group.add(post);
    });
    const crossbar = cylinderBetween(THREE, crossbarRadius, crossbarLength, 0x8b969b, 0.82, 0.26);
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(radialOffset, PAD_REFERENCE_CENTER_Y + padHeight * 0.54, 0);
    group.add(crossbar);

    group.userData.hardwareReference = Object.freeze({
      profileId: "wipe-pad",
      source: ref?.visualSource || "reference",
      dimensionalAuthority: true,
      mountingDimensionalAuthority: false,
      mechanicalHierarchyAuthority: true
    });
    return group;
  }

  function createCoderAssembly(THREE, item, geometry) {
    const metrics = bottleMetrics(geometry);
    const ref = profile("laser-coder");
    const ratios = ref?.visualRatios || {};
    const group = new THREE.Group();
    const width = metrics.diameter * number(ratios.housingWidthBottleDiameters, 1.45);
    const depth = metrics.diameter * number(ratios.housingDepthBottleDiameters, 1.05);
    const height = metrics.height * number(ratios.housingHeightBottleHeights, 0.58);
    const emitterRadius = metrics.diameter * number(ratios.emitterDiameterBottleDiameter, 0.26) / 2;
    const projection = metrics.diameter * number(ratios.emitterProjectionBottleDiameter, 0.48);
    const bracketLength = metrics.diameter * number(ratios.bracketLengthBottleDiameters, 1.10);

    const housingMaterial = material(THREE, { color: 0x596168, roughness: 0.32, metalness: 0.72, emissive: 0x000000, emissiveIntensity: 0 });
    const headMaterial = material(THREE, { color: 0x252b2f, roughness: 0.44, metalness: 0.46 });
    const bracketMaterial = material(THREE, { color: 0x909ba0, roughness: 0.28, metalness: 0.82 });

    const housing = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), housingMaterial);
    housing.position.y = 0.62 + height / 2;
    housing.castShadow = true;
    group.add(housing);
    const emitter = cylinderBetween(THREE, emitterRadius, projection, 0x252b2f, 0.50, 0.38);
    emitter.rotation.x = Math.PI / 2;
    emitter.position.set(0, 0.72, -depth / 2 - projection / 2);
    group.add(emitter);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(emitterRadius * 0.72, 28), new THREE.MeshBasicMaterial({ color: 0xc92d2d, side: THREE.DoubleSide }));
    lens.position.set(0, 0.72, -depth / 2 - projection - 0.002);
    group.add(lens);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(bracketLength, 0.05, 0.07), bracketMaterial);
    bracket.position.set(width / 2 + bracketLength / 2, 0.60, 0);
    group.add(bracket);

    const beamLength = Math.max(0.35, metrics.diameter * 2.6);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, beamLength, 10), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.55 }));
    beam.rotation.x = Math.PI / 2;
    beam.position.set(0, 0.72, -depth / 2 - projection - beamLength / 2);
    group.add(beam);

    group.userData.hardwareReference = Object.freeze({
      profileId: "laser-coder",
      source: ref?.visualSource || "reference",
      dimensionalAuthority: false,
      beamPresentationOnly: true,
      timingAuthority: false
    });
    group.userData.highlightMaterials = [housingMaterial];
    return group;
  }

  function createSensorAssembly(THREE, item, geometry) {
    const metrics = bottleMetrics(geometry);
    const ref = profile("label-sensor");
    const ratios = ref?.visualRatios || {};
    const group = new THREE.Group();
    const width = metrics.diameter * number(ratios.bodyWidthBottleDiameter, 0.46);
    const depth = metrics.diameter * number(ratios.bodyDepthBottleDiameter, 0.36);
    const height = metrics.diameter * number(ratios.bodyHeightBottleDiameter, 0.62);
    const lensRadius = width * number(ratios.lensDiameterBodyWidth, 0.34) / 2;
    const bracketLength = metrics.diameter * number(ratios.bracketLengthBottleDiameter, 0.82);
    const postRadius = metrics.diameter * number(ratios.postDiameterBottleDiameter, 0.12) / 2;

    const bodyMaterial = material(THREE, { color: 0x343b3f, roughness: 0.46, metalness: 0.30, emissive: 0x000000, emissiveIntensity: 0 });
    const mountMaterial = material(THREE, { color: 0x939da2, roughness: 0.28, metalness: 0.82 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMaterial);
    body.position.y = 0.69;
    group.add(body);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(lensRadius, 24), new THREE.MeshBasicMaterial({ color: 0x9e2020, side: THREE.DoubleSide }));
    lens.position.set(0, 0.69, -depth / 2 - 0.002);
    group.add(lens);
    const led = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.009, width * 0.08), 16, 12), new THREE.MeshStandardMaterial({ color: 0x33e879, emissive: 0x0bb94f, emissiveIntensity: 1.4, roughness: 0.28 }));
    led.position.set(width * 0.28, 0.69 + height * 0.28, -depth / 2 - 0.006);
    group.add(led);

    const bracket = new THREE.Mesh(new THREE.BoxGeometry(bracketLength, 0.035, 0.05), mountMaterial);
    bracket.position.set(width / 2 + bracketLength / 2, 0.65, 0);
    group.add(bracket);
    const post = cylinderBetween(THREE, Math.max(0.009, postRadius), Math.max(0.28, metrics.height * 0.42), 0x939da2, 0.82, 0.28);
    post.position.set(width / 2 + bracketLength, 0.55, 0);
    group.add(post);

    const fov = clamp(number(item?.sensorFieldOfViewDegrees, 18), 4, 60) * Math.PI / 180;
    const coneLength = Math.max(0.28, metrics.diameter * 2.0);
    const coneRadius = Math.tan(fov / 2) * coneLength;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(coneRadius, coneLength, 28, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x53cfff, transparent: true, opacity: 0.10, wireframe: false, side: THREE.DoubleSide })
    );
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 0.69, -depth / 2 - coneLength / 2);
    group.add(cone);

    group.userData.hardwareReference = Object.freeze({
      profileId: "label-sensor",
      source: ref?.visualSource || "reference",
      dimensionalAuthority: false,
      fovAuthority: "servoforge-runtime-data",
      servoAssist: Boolean(item?.servoAssist)
    });
    group.userData.highlightMaterials = [bodyMaterial];
    return group;
  }

  function createBrushAssembly(THREE, item) {
    const group = new THREE.Group();
    const span = Math.max(0.08, number(item?.tangentLengthWorld, 0.18));
    const brush = new THREE.Mesh(new THREE.BoxGeometry(clamp(span, 0.12, 0.70), 0.42, 0.085), material(THREE, { color: 0xc3a16d, roughness: 0.88, metalness: 0.02 }));
    brush.position.y = PAD_REFERENCE_CENTER_Y;
    group.add(brush);
    group.userData.hardwareReference = Object.freeze({ profileId: "brush-channel", dimensionalAuthority: false });
    return group;
  }

  function placeEquipmentGroup(group, item) {
    if (!group) return null;
    group.name = group.name || `ServoForgeEquipment-${String(item?.id || "equipment")}`;
    group.userData.kind = item?.kind;
    group.userData.station = item?.station;
    group.userData.section = item?.section;
    const x = number(item?.position?.x);
    const z = number(item?.position?.z);
    group.position.set(x, 0, z);
    if (item?.kind === "pad" && item?.wipePad) group.rotation.y = -Math.atan2(z, x);
    else if (item?.kind === "coding" || item?.kind === "sensor") group.rotation.y = number(item?.aimRotationY, item?.rotationY);
    else group.rotation.y = number(item?.rotationY);
    return group;
  }

  function createEquipmentAssembly(THREE, item, geometry) {
    if (!item) return null;
    let group = null;
    if (item.kind === "roller") group = createRollerAssembly(THREE, item, geometry);
    else if (item.kind === "pad") group = createMeasuredPadAssembly(THREE, item);
    else if (item.kind === "coding") group = createCoderAssembly(THREE, item, geometry);
    else if (item.kind === "sensor") group = createSensorAssembly(THREE, item, geometry);
    else if (item.kind === "brush" || item.kind === "brush-channel") group = createBrushAssembly(THREE, item);
    else {
      group = new THREE.Group();
      const generic = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.40, 0.16), material(THREE, { color: 0x778891, roughness: 0.48, metalness: 0.40 }));
      generic.position.y = 0.55;
      group.add(generic);
    }
    return placeEquipmentGroup(group, item);
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    FACTORY_VERSION,
    createSpenderPlateAssembly,
    createAggregateAssembly,
    createRollerAssembly,
    createMeasuredPadAssembly,
    createCoderAssembly,
    createSensorAssembly,
    createBrushAssembly,
    createEquipmentAssembly
  });
})(window);
