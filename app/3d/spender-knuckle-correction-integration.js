(function installServoForge3DSpenderKnuckleCorrection(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createSpenderPlateAssembly) {
    throw new Error("ServoForge spender knuckle correction requires the manual-backed hardware factory.");
  }

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v5-spender-knuckle-correction";

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

  function correctWedgeBackside(assembly, aggregateItem) {
    const outwardSign = number(aggregateItem?.radialOutSign, 1) >= 0 ? 1 : -1;
    const plate = findFirst(assembly, "ServoForgeSpenderPlate");
    if (!plate) return { removedBacksideBlock: false };

    const parameters = plate.geometry?.parameters || {};
    const plateHeight = Math.max(0.18, number(parameters.height, 0.28));
    const plateThickness = Math.max(0.008, number(parameters.depth, 0.018));

    // User-corrected machine geometry: the solid manual-inspired infeed block is
    // not present on this spender plate. The old block and its floating knob are
    // removed from the final rendered assembly while the manual identity stays
    // in the reference catalog.
    const removed = removeNamed(assembly, new Set([
      "ServoForgeKronesWedgeInfeedHousing",
      "ServoForgeKronesWedgeKnurledAdjustment"
    ]));

    // Keep the thin guide/clamp hardware, but pull it tight to the back face of
    // the spender plate so it no longer appears suspended where the block was.
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

    // Avoid duplicate geometry if a caller re-applies the correction.
    const existing = findFirst(assembly, "ServoForgeSpenderAngleAdjustmentKnuckle");
    if (existing) return existing;

    const parameters = plate.geometry?.parameters || {};
    const plateLength = Math.max(0.30, number(parameters.width, 0.42));
    const plateHeight = Math.max(0.18, number(parameters.height, 0.28));
    const plateThickness = Math.max(0.008, number(parameters.depth, 0.018));
    const outwardSign = number(aggregateItem?.radialOutSign, 1) >= 0 ? 1 : -1;

    const stainless = material(THREE, { color: 0xaab3b7, roughness: 0.24, metalness: 0.88 });
    const jointMaterial = material(THREE, { color: 0x626d72, roughness: 0.30, metalness: 0.80 });
    const dark = material(THREE, { color: 0x30373b, roughness: 0.44, metalness: 0.48 });
    const polished = material(THREE, { color: 0xd9dddf, roughness: 0.15, metalness: 0.94 });

    const joint = new THREE.Group();
    joint.name = "ServoForgeSpenderAngleAdjustmentKnuckle";
    // The engagement-pivot origin is the end of the radial application arm.
    // Place the knuckle directly on that axis and just behind the plate face.
    const knuckleRadius = Math.max(0.030, plateHeight * 0.105);
    joint.position.set(0, 0, outwardSign * (plateThickness / 2 + knuckleRadius * 0.42));
    engagementPivot.add(joint);

    const hub = new THREE.Mesh(new THREE.SphereGeometry(knuckleRadius, 28, 20), jointMaterial);
    hub.name = "ServoForgeSpenderAngleKnuckleHub";
    joint.add(hub);

    // Vertical pivot pin makes the forward-angle joint visually explicit.
    const pivotPin = new THREE.Mesh(
      new THREE.CylinderGeometry(knuckleRadius * 0.32, knuckleRadius * 0.32, knuckleRadius * 2.7, 24),
      polished
    );
    pivotPin.name = "ServoForgeSpenderAngleKnucklePivotPin";
    joint.add(pivotPin);

    // Two clevis cheeks tie the end of the radial arm around the knuckle.
    [-1, 1].forEach((side) => {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(knuckleRadius * 0.52, knuckleRadius * 2.15, knuckleRadius * 1.30),
        stainless
      );
      cheek.name = "ServoForgeSpenderAngleKnuckleClevis";
      cheek.position.x = side * knuckleRadius * 1.05;
      joint.add(cheek);
    });

    // The plate arm is the missing mechanical connection called out by the user:
    // it runs from the adjustment knuckle into the plate mounting/backbone area.
    const plateArmLength = Math.max(0.10, plateLength * 0.27);
    const plateArmHeight = Math.max(0.025, plateHeight * 0.085);
    const plateArmDepth = Math.max(plateThickness * 2.1, knuckleRadius * 0.72);
    const plateArm = new THREE.Mesh(
      new THREE.BoxGeometry(plateArmLength, plateArmHeight, plateArmDepth),
      stainless
    );
    plateArm.name = "ServoForgeSpenderPlateAdjustmentArm";
    plateArm.position.set(-plateArmLength * 0.48, 0, outwardSign * knuckleRadius * 0.28);
    joint.add(plateArm);

    const plateArmEnd = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.032, plateArmHeight * 1.35), plateArmHeight * 1.55, plateArmDepth * 1.08),
      jointMaterial
    );
    plateArmEnd.name = "ServoForgeSpenderPlateArmMount";
    plateArmEnd.position.set(-plateArmLength, 0, outwardSign * knuckleRadius * 0.28);
    joint.add(plateArmEnd);

    // Re-home the visible manual adjustment to the knuckle itself instead of the
    // removed backside block.
    const knobRadius = Math.max(0.018, knuckleRadius * 0.55);
    const knobLength = Math.max(0.035, knuckleRadius * 1.45);
    const knob = cylinderAlongX(THREE, knobRadius, knobLength, dark, 24);
    knob.name = "ServoForgeSpenderKnuckleAngleAdjustment";
    knob.position.set(knuckleRadius * 1.55, knuckleRadius * 0.18, 0);
    joint.add(knob);

    const knobCap = cylinderAlongX(THREE, knobRadius * 1.18, Math.max(0.010, knobLength * 0.18), polished, 24);
    knobCap.name = "ServoForgeSpenderKnuckleAdjustmentCap";
    knobCap.position.set(knuckleRadius * 1.55 + knobLength * 0.52, knuckleRadius * 0.18, 0);
    joint.add(knobCap);

    joint.userData.mechanicalReference = Object.freeze({
      role: "spender-angle-adjustment-knuckle",
      connectedToRadialApplicationArm: true,
      connectedToPlateAdjustmentArm: true,
      placementAuthority: "user-corrected-machine-reference-2026-08-18",
      dimensionalAuthority: false
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
      knuckleConnectedToPlateArm: Boolean(knuckle),
      approvedPlacementPreserved: true,
      bottleClearanceMm: number(aggregateItem?.applicationClearanceMm, 2),
      flowAligned: true,
      sourceAuthority: "user-corrected-machine-reference-2026-08-18"
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
