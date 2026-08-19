(function installServoForge3DSpenderKnuckleCorrection(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createSpenderPlateAssembly) {
    throw new Error("ServoForge spender knuckle correction requires the manual-backed hardware factory.");
  }

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v6-spender-photo-knuckle";
  const PHOTO_REFERENCE = "user-supplied-spender-knuckle-closeups-2026-08-18";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function material(THREE, options) {
    return new THREE.MeshStandardMaterial(options);
  }

  function findFirst(root, name) {
    let found = null;
    root?.traverse?.((child) => {
      if (!found && child?.name === name) found = child;
    });
    return found;
  }

  function disposeObject(object) {
    if (!object) return;
    object.traverse?.((child) => {
      child.geometry?.dispose?.();
      const disposeMaterial = (entry) => entry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    });
  }

  function removeNamed(root, names) {
    const targets = [];
    root?.traverse?.((child) => {
      if (names.has(child?.name)) targets.push(child);
    });
    targets.forEach((child) => {
      child.parent?.remove(child);
      disposeObject(child);
    });
    return targets.length;
  }

  function cylinderAlongX(THREE, radius, length, meshMaterial, segments = 28) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), meshMaterial);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  }

  function cylinderAlongZ(THREE, radius, length, meshMaterial, segments = 28) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), meshMaterial);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  function correctWedgeBackside(assembly, aggregateItem) {
    const outwardSign = number(aggregateItem?.radialOutSign, 1) >= 0 ? 1 : -1;
    const plate = findFirst(assembly, "ServoForgeSpenderPlate");
    if (!plate) return { removedBacksideBlock: false };

    const parameters = plate.geometry?.parameters || {};
    const plateHeight = Math.max(0.18, number(parameters.height, 0.28));
    const plateThickness = Math.max(0.008, number(parameters.depth, 0.018));

    // Machine-photo correction: this installation does not use the large solid
    // housing that was inferred from the parts-book wedge BOM. Keep the manual
    // identity in the reference layer, but remove the oversized visual block.
    const removed = removeNamed(assembly, new Set([
      "ServoForgeKronesWedgeInfeedHousing",
      "ServoForgeKronesWedgeKnurledAdjustment"
    ]));

    // Retain only the thin guide/clamp hardware immediately behind the plate.
    const guidePlate = findFirst(assembly, "ServoForgeKronesWedgeGuidePlate");
    if (guidePlate) {
      const depth = Math.max(0.006, number(guidePlate.geometry?.parameters?.depth, plateThickness));
      guidePlate.position.z = outwardSign * (plateThickness / 2 + depth / 2 + 0.002);
      guidePlate.position.y = plate.position.y + plateHeight * 0.43;
    }

    const clampPlate = findFirst(assembly, "ServoForgeKronesWedgeClampingPlate");
    if (clampPlate) {
      const depth = Math.max(0.006, number(clampPlate.geometry?.parameters?.depth, plateThickness));
      clampPlate.position.z = outwardSign * (plateThickness / 2 + depth / 2 + 0.003);
      clampPlate.position.y = plate.position.y;
    }

    return { removedBacksideBlock: removed > 0 };
  }

  function addAngleAdjustmentKnuckle(THREE, assembly, aggregateItem) {
    const engagementPivot = findFirst(assembly, "ServoForgeEngagementAnglePivot");
    const plate = findFirst(assembly, "ServoForgeSpenderPlate");
    if (!engagementPivot || !plate) return null;

    const existing = findFirst(assembly, "ServoForgeSpenderAngleAdjustmentKnuckle");
    if (existing) return existing;

    const parameters = plate.geometry?.parameters || {};
    const plateLength = Math.max(0.30, number(parameters.width, 0.42));
    const plateHeight = Math.max(0.18, number(parameters.height, 0.28));
    const plateThickness = Math.max(0.008, number(parameters.depth, 0.018));
    const outwardSign = number(aggregateItem?.radialOutSign, 1) >= 0 ? 1 : -1;

    const stainless = material(THREE, { color: 0xaab3b7, roughness: 0.24, metalness: 0.88 });
    const jointMaterial = material(THREE, { color: 0x626d72, roughness: 0.30, metalness: 0.80 });
    const dark = material(THREE, { color: 0x252b2f, roughness: 0.45, metalness: 0.42 });
    const polished = material(THREE, { color: 0xd9dddf, roughness: 0.15, metalness: 0.94 });
    const dialMaterial = material(THREE, { color: 0xa52b25, roughness: 0.42, metalness: 0.18 });

    const joint = new THREE.Group();
    joint.name = "ServoForgeSpenderAngleAdjustmentKnuckle";

    // The radial application arm terminates at this joint. The photos show a
    // compact red circular pivot/dial, a black adjustment link, and a pinned
    // connection into the thin arm that carries the spender plate.
    const dialRadius = Math.max(0.032, plateHeight * 0.115);
    const dialThickness = Math.max(0.018, dialRadius * 0.42);
    joint.position.set(0, plateHeight * 0.05, outwardSign * (plateThickness / 2 + dialRadius * 0.35));
    engagementPivot.add(joint);

    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(dialRadius, dialRadius, dialThickness, 36),
      dialMaterial
    );
    dial.name = "ServoForgeSpenderAngleKnuckleRedDial";
    joint.add(dial);

    const dialWasher = new THREE.Mesh(
      new THREE.CylinderGeometry(dialRadius * 0.60, dialRadius * 0.60, dialThickness * 1.15, 28),
      polished
    );
    dialWasher.name = "ServoForgeSpenderAngleKnucklePivotWasher";
    dialWasher.position.y = dialThickness * 0.03;
    joint.add(dialWasher);

    const centerBolt = new THREE.Mesh(
      new THREE.CylinderGeometry(dialRadius * 0.20, dialRadius * 0.20, dialThickness * 1.35, 18),
      jointMaterial
    );
    centerBolt.name = "ServoForgeSpenderAngleKnuckleCenterBolt";
    joint.add(centerBolt);

    // Black link runs from the red pivot toward the plate hinge, matching the
    // visible top arm in the machine closeups.
    const blackLinkLength = Math.max(0.11, plateLength * 0.31);
    const blackLinkHeight = Math.max(0.020, plateHeight * 0.075);
    const blackLinkDepth = Math.max(0.024, plateThickness * 1.70);
    const blackLink = new THREE.Mesh(
      new THREE.BoxGeometry(blackLinkLength, blackLinkHeight, blackLinkDepth),
      dark
    );
    blackLink.name = "ServoForgeSpenderAngleKnuckleBlackLink";
    blackLink.position.set(-blackLinkLength * 0.50, dialRadius * 0.36, 0);
    joint.add(blackLink);

    const hingeX = -blackLinkLength;
    const hingeRadius = Math.max(0.014, dialRadius * 0.42);

    // Fork cheeks capture the plate-arm hinge instead of letting the joint float.
    [-1, 1].forEach((side) => {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(hingeRadius * 1.30, hingeRadius * 2.20, hingeRadius * 0.62),
        stainless
      );
      cheek.name = "ServoForgeSpenderAngleKnuckleHingeFork";
      cheek.position.set(hingeX, dialRadius * 0.22, side * hingeRadius * 0.75);
      joint.add(cheek);
    });

    const hingePin = cylinderAlongZ(THREE, hingeRadius * 0.42, hingeRadius * 2.35, polished, 20);
    hingePin.name = "ServoForgeSpenderAngleKnuckleHingePin";
    hingePin.position.set(hingeX, dialRadius * 0.22, 0);
    joint.add(hingePin);

    // Silver plate arm continues from the hinge into the plate/backbone region.
    // This is the explicit mechanical connection requested by the user.
    const plateArmLength = Math.max(0.10, plateLength * 0.26);
    const plateArmHeight = Math.max(0.022, plateHeight * 0.070);
    const plateArmDepth = Math.max(0.020, plateThickness * 1.45);
    const plateArm = new THREE.Mesh(
      new THREE.BoxGeometry(plateArmLength, plateArmHeight, plateArmDepth),
      stainless
    );
    plateArm.name = "ServoForgeSpenderPlateAdjustmentArm";
    plateArm.position.set(hingeX - plateArmLength * 0.50, dialRadius * 0.22, 0);
    joint.add(plateArm);

    const plateArmMount = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.030, plateArmHeight * 1.45), plateArmHeight * 1.85, plateArmDepth * 1.30),
      jointMaterial
    );
    plateArmMount.name = "ServoForgeSpenderPlateArmMount";
    plateArmMount.position.set(hingeX - plateArmLength, dialRadius * 0.22, 0);
    joint.add(plateArmMount);

    // Side clevis/ear visually ties the pivot back into the main application arm.
    const armEarLength = Math.max(0.055, dialRadius * 1.75);
    const armEar = new THREE.Mesh(
      new THREE.BoxGeometry(armEarLength, Math.max(0.026, dialRadius * 0.58), Math.max(0.026, dialRadius * 0.62)),
      stainless
    );
    armEar.name = "ServoForgeSpenderMainArmKnuckleLink";
    armEar.position.set(dialRadius * 0.85, -dialRadius * 0.22, 0);
    armEar.rotation.z = -0.20;
    joint.add(armEar);

    const armEarBolt = cylinderAlongZ(THREE, dialRadius * 0.16, dialRadius * 0.95, polished, 18);
    armEarBolt.name = "ServoForgeSpenderMainArmKnuckleBolt";
    armEarBolt.position.set(dialRadius * 1.42, -dialRadius * 0.30, 0);
    joint.add(armEarBolt);

    // Black handle above the dial is the visible angle-setting lever in the
    // close-up photos. It stays presentation-only; no adjustment logic is added.
    const handleLength = Math.max(0.065, dialRadius * 2.00);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(handleLength, Math.max(0.016, dialRadius * 0.30), Math.max(0.018, dialRadius * 0.34)),
      dark
    );
    handle.name = "ServoForgeSpenderKnuckleAngleHandle";
    handle.position.set(-handleLength * 0.08, dialRadius * 0.95, 0);
    joint.add(handle);

    const handleKnob = cylinderAlongX(THREE, Math.max(0.013, dialRadius * 0.30), Math.max(0.026, dialRadius * 0.62), dark, 22);
    handleKnob.name = "ServoForgeSpenderKnuckleHandleKnob";
    handleKnob.position.set(handleLength * 0.43, dialRadius * 0.95, 0);
    joint.add(handleKnob);

    joint.userData.mechanicalReference = Object.freeze({
      role: "spender-angle-adjustment-knuckle",
      photoReference: PHOTO_REFERENCE,
      redPivotDialRendered: true,
      blackAdjustmentLinkRendered: true,
      pinnedHingeRendered: true,
      connectedToRadialApplicationArm: true,
      connectedToPlateAdjustmentArm: true,
      placementAuthority: "user-corrected-machine-reference-2026-08-18",
      dimensionalAuthority: false,
      adjustmentLogicAuthority: false
    });
    return joint;
  }

  function correctAssembly(THREE, assembly, aggregateItem) {
    if (!assembly) return assembly;
    const backside = correctWedgeBackside(assembly, aggregateItem);
    const knuckle = addAngleAdjustmentKnuckle(THREE, assembly, aggregateItem);

    assembly.userData.spenderCorrection = Object.freeze({
      removedBacksideBlock: Boolean(backside.removedBacksideBlock),
      angleKnuckleRendered: Boolean(knuckle),
      redPivotDialRendered: Boolean(knuckle),
      blackAdjustmentLinkRendered: Boolean(knuckle),
      pinnedHingeRendered: Boolean(knuckle),
      knuckleConnectedToMainArm: Boolean(knuckle),
      knuckleConnectedToPlateArm: Boolean(knuckle),
      approvedPlacementPreserved: true,
      bottleClearanceMm: number(aggregateItem?.applicationClearanceMm, 2),
      flowAligned: true,
      sourceAuthority: PHOTO_REFERENCE
    });
    return assembly;
  }

  function createSpenderPlateAssembly(THREE, aggregateItem, geometry) {
    return correctAssembly(
      THREE,
      baseFactory.createSpenderPlateAssembly(THREE, aggregateItem, geometry),
      aggregateItem
    );
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
    group.userData.spenderManualAssembly = spender.userData.spenderManualAssembly;
    group.userData.spenderCorrection = spender.userData.spenderCorrection;
    group.userData.flowDirection = item?.flowDirection || null;
    group.userData.highlightMaterials = spender.userData.highlightMaterials || [];
    return group;
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseFactory,
    FACTORY_VERSION,
    createSpenderPlateAssembly,
    createAggregateAssembly,
    correctAssembly
  });
})(window);
