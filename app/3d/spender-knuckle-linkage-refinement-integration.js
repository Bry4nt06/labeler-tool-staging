(function installServoForge3DSpenderKnuckleLinkageRefinement(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createSpenderPlateAssembly) {
    throw new Error("ServoForge spender linkage refinement requires the corrected spender hardware factory.");
  }

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v7-spender-photo-linkage";
  const PHOTO_REFERENCE = "user-supplied-spender-linkage-closeups-2026-08-18";

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

  function cylinderAlongZ(THREE, radius, length, meshMaterial, segments = 24) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), meshMaterial);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  function cylinderAlongX(THREE, radius, length, meshMaterial, segments = 24) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), meshMaterial);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  }

  function boxBetweenXY(THREE, start, end, thicknessY, depthZ, meshMaterial, name) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(length, thicknessY, depthZ),
      meshMaterial
    );
    mesh.name = name;
    mesh.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, number(start.z, 0));
    mesh.rotation.z = Math.atan2(dy, dx);
    return mesh;
  }

  function createTaperedPlateEar(THREE, length, height, depth, meshMaterial) {
    const shape = new THREE.Shape();
    shape.moveTo(-length * 0.50, -height * 0.22);
    shape.lineTo(length * 0.50, -height * 0.40);
    shape.lineTo(length * 0.50, height * 0.40);
    shape.lineTo(-length * 0.50, height * 0.22);
    shape.closePath();

    const hole = new THREE.Path();
    hole.absarc(length * 0.27, 0, Math.min(height * 0.17, length * 0.10), 0, Math.PI * 2, false);
    shape.holes.push(hole);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 20
    });
    geometry.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.name = "ServoForgeSpenderPlateSupportEar";
    return mesh;
  }

  function refineBackside(assembly) {
    const removed = removeNamed(assembly, new Set([
      "ServoForgeSpenderAngleAdjustmentKnuckle",
      "ServoForgeSpenderBackbone",
      "ServoForgeSpenderPlateMountBlade",
      "ServoForgeKronesWedgeInfeedHousing",
      "ServoForgeKronesWedgeKnurledAdjustment",
      "ServoForgeKronesWedgeClampingPlate"
    ]));

    return Object.freeze({
      removedCount: removed,
      backsideOpen: true,
      legacyBackboneRemoved: true,
      legacyMountBlockRemoved: true
    });
  }

  function addRefinedKnuckle(THREE, assembly, aggregateItem) {
    const engagementPivot = findFirst(assembly, "ServoForgeEngagementAnglePivot");
    const plate = findFirst(assembly, "ServoForgeSpenderPlate");
    if (!engagementPivot || !plate) return null;

    const parameters = plate.geometry?.parameters || {};
    const plateLength = Math.max(0.30, number(parameters.width, 0.42));
    const plateHeight = Math.max(0.18, number(parameters.height, 0.28));
    const plateThickness = Math.max(0.008, number(parameters.depth, 0.018));
    const outwardSign = number(aggregateItem?.radialOutSign, 1) >= 0 ? 1 : -1;

    const stainless = material(THREE, { color: 0xaab3b7, roughness: 0.24, metalness: 0.88 });
    const jointMaterial = material(THREE, { color: 0x626d72, roughness: 0.30, metalness: 0.80 });
    const polished = material(THREE, { color: 0xd9dddf, roughness: 0.15, metalness: 0.94 });
    const dark = material(THREE, { color: 0x202629, roughness: 0.47, metalness: 0.38 });
    const dialMaterial = material(THREE, { color: 0xa52b25, roughness: 0.42, metalness: 0.18 });

    const dialRadius = Math.max(0.030, plateHeight * 0.11);
    const dialThickness = Math.max(0.016, dialRadius * 0.44);

    // Machine closeups place the red adjustment pivot at the upstream end of
    // the wedge. Local +X is downstream bottle flow, so the linkage must continue
    // from this upstream pivot in +X into the plate-support arm.
    const upstreamPivotX = number(plate.position.x, 0) - plateLength * 0.38;
    const pivotY = number(plate.position.y, 0) + plateHeight * 0.40;
    const pivotZ = outwardSign * (plateThickness / 2 + dialThickness * 0.62);

    const joint = new THREE.Group();
    joint.name = "ServoForgeSpenderRefinedAngleAdjustmentKnuckle";
    joint.position.set(upstreamPivotX, pivotY, pivotZ);
    engagementPivot.add(joint);

    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(dialRadius, dialRadius, dialThickness, 36),
      dialMaterial
    );
    dial.name = "ServoForgeSpenderRefinedRedPivotDial";
    joint.add(dial);

    const pivotWasher = new THREE.Mesh(
      new THREE.CylinderGeometry(dialRadius * 0.58, dialRadius * 0.58, dialThickness * 1.15, 28),
      polished
    );
    pivotWasher.name = "ServoForgeSpenderRefinedPivotWasher";
    pivotWasher.position.y = dialThickness * 0.04;
    joint.add(pivotWasher);

    const centerBolt = new THREE.Mesh(
      new THREE.CylinderGeometry(dialRadius * 0.19, dialRadius * 0.19, dialThickness * 1.35, 18),
      jointMaterial
    );
    centerBolt.name = "ServoForgeSpenderRefinedPivotBolt";
    joint.add(centerBolt);

    // Explicit link from the radial application-arm terminus to the pivot.
    // This prevents the angle knuckle from appearing visually detached.
    const armAnchor = {
      x: -upstreamPivotX,
      y: -pivotY,
      z: -outwardSign * dialThickness * 0.12
    };
    const mainArmLink = boxBetweenXY(
      THREE,
      { x: 0, y: 0, z: armAnchor.z },
      { x: armAnchor.x, y: armAnchor.y, z: armAnchor.z },
      Math.max(0.026, dialRadius * 0.62),
      Math.max(0.026, dialRadius * 0.66),
      stainless,
      "ServoForgeSpenderRefinedMainArmLink"
    );
    joint.add(mainArmLink);

    const mainArmBolt = cylinderAlongZ(THREE, dialRadius * 0.16, dialRadius * 0.92, polished, 18);
    mainArmBolt.name = "ServoForgeSpenderRefinedMainArmPivotBolt";
    mainArmBolt.position.set(armAnchor.x, armAnchor.y, armAnchor.z);
    joint.add(mainArmBolt);

    const blackLinkLength = Math.max(0.09, plateLength * 0.24);
    const blackLinkEnd = { x: blackLinkLength, y: -dialRadius * 0.10, z: 0 };
    const blackLink = boxBetweenXY(
      THREE,
      { x: 0, y: dialRadius * 0.18, z: 0 },
      blackLinkEnd,
      Math.max(0.020, plateHeight * 0.070),
      Math.max(0.022, plateThickness * 1.55),
      dark,
      "ServoForgeSpenderRefinedBlackAdjustmentLink"
    );
    joint.add(blackLink);

    const hingeRadius = Math.max(0.013, dialRadius * 0.40);
    [-1, 1].forEach((side) => {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(hingeRadius * 1.25, hingeRadius * 2.15, hingeRadius * 0.60),
        stainless
      );
      cheek.name = "ServoForgeSpenderRefinedHingeFork";
      cheek.position.set(blackLinkEnd.x, blackLinkEnd.y, side * hingeRadius * 0.74);
      joint.add(cheek);
    });

    const hingePin = cylinderAlongZ(THREE, hingeRadius * 0.40, hingeRadius * 2.35, polished, 20);
    hingePin.name = "ServoForgeSpenderRefinedHingePin";
    hingePin.position.set(blackLinkEnd.x, blackLinkEnd.y, 0);
    joint.add(hingePin);

    // Silver support arm continues downstream from the pinned hinge into the
    // wedge/plate structure, matching the machine closeup instead of terminating
    // at a rear block.
    const plateConnection = {
      x: blackLinkEnd.x + plateLength * 0.27,
      y: -plateHeight * 0.19,
      z: 0
    };
    const plateArm = boxBetweenXY(
      THREE,
      blackLinkEnd,
      plateConnection,
      Math.max(0.021, plateHeight * 0.065),
      Math.max(0.020, plateThickness * 1.40),
      stainless,
      "ServoForgeSpenderRefinedPlateAdjustmentArm"
    );
    joint.add(plateArm);

    const earLength = Math.max(0.055, plateLength * 0.15);
    const earHeight = Math.max(0.050, plateHeight * 0.22);
    const earDepth = Math.max(0.018, plateThickness * 1.45);
    const supportEar = createTaperedPlateEar(THREE, earLength, earHeight, earDepth, stainless);
    supportEar.position.set(plateConnection.x, plateConnection.y, 0);
    supportEar.rotation.z = -0.12;
    joint.add(supportEar);

    const plateMountPin = cylinderAlongZ(THREE, Math.max(0.008, hingeRadius * 0.30), earDepth * 1.45, polished, 18);
    plateMountPin.name = "ServoForgeSpenderRefinedPlateMountPin";
    plateMountPin.position.set(plateConnection.x + earLength * 0.27, plateConnection.y, 0);
    joint.add(plateMountPin);

    // The visible black angle-setting handle sits above the red pivot.
    const handleLength = Math.max(0.060, dialRadius * 1.90);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(handleLength, Math.max(0.015, dialRadius * 0.28), Math.max(0.017, dialRadius * 0.32)),
      dark
    );
    handle.name = "ServoForgeSpenderRefinedAngleHandle";
    handle.position.set(handleLength * 0.12, dialRadius * 0.96, 0);
    joint.add(handle);

    const handleKnob = cylinderAlongX(THREE, Math.max(0.012, dialRadius * 0.28), Math.max(0.024, dialRadius * 0.58), dark, 22);
    handleKnob.name = "ServoForgeSpenderRefinedHandleKnob";
    handleKnob.position.set(handleLength * 0.54, dialRadius * 0.96, 0);
    joint.add(handleKnob);

    joint.userData.mechanicalReference = Object.freeze({
      role: "spender-angle-adjustment-linkage",
      photoReference: PHOTO_REFERENCE,
      pivotLocation: "upstream-end-of-wedge",
      blackLinkDirection: "downstream-positive-X",
      plateSupportDirection: "downstream-positive-X",
      connectedToRadialApplicationArm: true,
      connectedToPlateAdjustmentArm: true,
      backsideOpen: true,
      dimensionalAuthority: false,
      adjustmentLogicAuthority: false
    });

    return joint;
  }

  function refineAssembly(THREE, assembly, aggregateItem) {
    if (!assembly) return assembly;
    const backside = refineBackside(assembly);
    const knuckle = addRefinedKnuckle(THREE, assembly, aggregateItem);

    assembly.userData.spenderLinkageRefinement = Object.freeze({
      backsideOpen: backside.backsideOpen,
      legacyBackboneRemoved: backside.legacyBackboneRemoved,
      legacyMountBlockRemoved: backside.legacyMountBlockRemoved,
      upstreamPivotRendered: Boolean(knuckle),
      downstreamBlackLinkRendered: Boolean(knuckle),
      downstreamPlateArmRendered: Boolean(knuckle),
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
    return refineAssembly(
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
    group.userData.spenderLinkageRefinement = spender.userData.spenderLinkageRefinement;
    group.userData.flowDirection = item?.flowDirection || null;
    group.userData.highlightMaterials = spender.userData.highlightMaterials || [];
    return group;
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseFactory,
    FACTORY_VERSION,
    createSpenderPlateAssembly,
    createAggregateAssembly,
    refineAssembly
  });
})(window);
