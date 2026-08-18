(function installServoForge3DSpenderManualAssembly(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  const partsReference = global.Labeler3DTopModulPartsReference;
  if (!baseFactory) throw new Error("ServoForge 3D manual spender assembly requires Labeler3DHardwareMeshFactory.");
  if (!partsReference) throw new Error("ServoForge 3D manual spender assembly requires Labeler3DTopModulPartsReference.");

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v4-topmodul-manual-spender";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function material(THREE, options) {
    return new THREE.MeshStandardMaterial(options);
  }

  function cylinder(THREE, radius, length, meshMaterial, segments = 28) {
    return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), meshMaterial);
  }

  function cylinderAlongZ(THREE, radius, length, meshMaterial, segments = 28) {
    const mesh = cylinder(THREE, radius, length, meshMaterial, segments);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  function findFirst(root, name) {
    let result = null;
    root?.traverse?.((child) => {
      if (!result && child?.name === name) result = child;
    });
    return result;
  }

  function findAll(root, predicate) {
    const results = [];
    root?.traverse?.((child) => {
      if (predicate(child)) results.push(child);
    });
    return results;
  }

  function moveChildren(group, objects) {
    objects.filter(Boolean).forEach((object) => group.add(object));
  }

  function manualMetadata(assemblyKey, extra = {}) {
    const reference = partsReference.assembly?.(assemblyKey);
    return Object.freeze({
      assemblyKey,
      id: reference?.id || assemblyKey,
      designation: reference?.designation || reference?.designations?.[0] || assemblyKey,
      drawingReference: reference?.drawingReference || null,
      drawingPages: Object.freeze([...(reference?.drawingPages || [])]),
      sourceAuthority: partsReference.SOURCE_AUTHORITY,
      dimensionalAuthority: false,
      hierarchyAuthority: "user-supplied-krones-parts-manual",
      ...extra
    });
  }

  function addApplicationWedgeManualDetails(THREE, wedgeGroup, plate, aggregateItem, geometry) {
    if (!wedgeGroup || !plate) return;
    const parameters = plate.geometry?.parameters || {};
    const plateLength = Math.max(0.30, number(parameters.width, number(geometry?.bottle?.diameterWorld, 0.27) * 1.72));
    const plateHeight = Math.max(0.18, number(parameters.height, number(geometry?.bottle?.visualHeightWorld, 1.05) * 0.30));
    const plateThickness = Math.max(0.008, number(parameters.depth, number(geometry?.renderScale?.worldUnitsPerMm, 0.00445) * 3));
    const outwardSign = number(aggregateItem?.radialOutSign, 1) >= 0 ? 1 : -1;

    const housingMaterial = material(THREE, { color: 0x737d82, roughness: 0.29, metalness: 0.80 });
    const clampMaterial = material(THREE, { color: 0x555f64, roughness: 0.31, metalness: 0.78 });
    const polished = material(THREE, { color: 0xd8dcde, roughness: 0.14, metalness: 0.95 });
    const dark = material(THREE, { color: 0x252c30, roughness: 0.48, metalness: 0.42 });

    // Manual drawing 0-900-585-924 shows the application plate extending from
    // a compact infeed/mounting housing. Local +X remains downstream bottle flow,
    // so the housing sits behind the downstream half of the existing wedge plate.
    const housingLength = Math.max(0.12, plateLength * 0.31);
    const housingHeight = plateHeight * 0.92;
    const housingDepth = Math.max(plateThickness * 7.2, plateHeight * 0.16);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(housingLength, housingHeight, housingDepth), housingMaterial);
    housing.name = "ServoForgeKronesWedgeInfeedHousing";
    housing.position.set(plate.position.x + plateLength / 2 - housingLength / 2, plate.position.y, outwardSign * (plateThickness / 2 + housingDepth / 2));
    housing.castShadow = true;
    wedgeGroup.add(housing);

    const guidePlate = new THREE.Mesh(
      new THREE.BoxGeometry(housingLength * 0.94, plateHeight * 0.08, housingDepth * 1.04),
      polished
    );
    guidePlate.name = "ServoForgeKronesWedgeGuidePlate";
    guidePlate.position.set(housing.position.x, plate.position.y + housingHeight * 0.48, housing.position.z);
    wedgeGroup.add(guidePlate);

    const clampPlate = new THREE.Mesh(
      new THREE.BoxGeometry(housingLength * 0.18, plateHeight * 0.72, housingDepth * 1.08),
      clampMaterial
    );
    clampPlate.name = "ServoForgeKronesWedgeClampingPlate";
    clampPlate.position.set(housing.position.x - housingLength * 0.34, plate.position.y, housing.position.z);
    wedgeGroup.add(clampPlate);

    // BOM item 11: 0-900-67-556-7 SPROCKET IDLER L=119. Its exact diameter is
    // not supplied by the parts list, so the visual diameter remains proportional.
    const idlerRadius = Math.max(0.020, plateHeight * 0.095);
    const idlerLength = Math.max(0.12, plateHeight * 0.78);
    const idler = cylinder(THREE, idlerRadius, idlerLength, polished, 32);
    idler.name = "ServoForgeKronesSprocketIdlerL119";
    idler.position.set(housing.position.x - housingLength * 0.42, plate.position.y - plateHeight * 0.08, outwardSign * (plateThickness / 2 + idlerRadius * 1.18));
    wedgeGroup.add(idler);

    const bearingRadius = idlerRadius * 1.16;
    [-1, 1].forEach((verticalSign) => {
      const bearing = cylinder(THREE, bearingRadius, Math.max(0.010, idlerLength * 0.055), dark, 28);
      bearing.name = "ServoForgeKronesWedgeBearing61800";
      bearing.position.set(idler.position.x, idler.position.y + verticalSign * idlerLength * 0.51, idler.position.z);
      wedgeGroup.add(bearing);
    });

    // BOM item 33: knurled screw M6x25. The drawing shows a prominent manual
    // adjustment control on the housing side.
    const knobRadius = Math.max(0.022, plateHeight * 0.085);
    const knobDepth = Math.max(0.018, housingDepth * 0.24);
    const knob = cylinderAlongZ(THREE, knobRadius, knobDepth, dark, 24);
    knob.name = "ServoForgeKronesWedgeKnurledAdjustment";
    knob.position.set(housing.position.x + housingLength * 0.34, plate.position.y + plateHeight * 0.38, outwardSign * (plateThickness / 2 + housingDepth + knobDepth / 2));
    wedgeGroup.add(knob);

    wedgeGroup.userData.manualReference = manualMetadata("applicationWedge", {
      partNumber: "0-900-585-924",
      sprocketIdlerPartNumber: "0-900-67-556-7",
      guidePlatePartNumber: "0-900-49-585-7",
      infeedHousingPartNumber: "0-900-58-560-3",
      mountingPlatePartNumber: "0-900-58-552-6",
      dimensions: "provisional-from-manual-shape-and-photo-proportions"
    });
  }

  function addArmManualDetails(THREE, armGroup, armRoot, aggregateItem, geometry) {
    if (!armGroup || !armRoot) return;
    const sidePivot = findFirst(armRoot, "ServoForgeSideAnglePivot");
    const mountTube = findFirst(armRoot, "ServoForgeSpenderMountTube");
    const plate = findFirst(armRoot, "ServoForgeSpenderPlate");
    const plateHeight = Math.max(0.18, number(plate?.geometry?.parameters?.height, number(geometry?.bottle?.visualHeightWorld, 1.05) * 0.30));
    const outwardSign = number(aggregateItem?.radialOutSign, 1) >= 0 ? 1 : -1;
    const stainless = material(THREE, { color: 0xa9b2b6, roughness: 0.24, metalness: 0.88 });
    const dark = material(THREE, { color: 0x30383c, roughness: 0.44, metalness: 0.50 });
    const sensorMaterial = material(THREE, { color: 0x363d41, roughness: 0.42, metalness: 0.34 });

    const armReach = Math.max(0.30, number(mountTube?.geometry?.parameters?.height, 0.46));
    if (sidePivot) {
      // BOM item 2 is a SECTION. The actual machine photos also show substantial
      // support structure around the arm; this slim section is a manual-backed
      // identity cue and does not replace the already-approved placement tube.
      const section = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.038, plateHeight * 0.10), Math.max(0.026, plateHeight * 0.065), armReach * 0.88),
        stainless
      );
      section.name = "ServoForgeKronesABArmSection";
      section.position.set(-Math.max(0.030, plateHeight * 0.12), Math.max(0.025, plateHeight * 0.12), -outwardSign * armReach * 0.50);
      sidePivot.add(section);

      // BOM item 20: measuring tape along the arm adjustment axis.
      const tape = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.008, plateHeight * 0.020), Math.max(0.004, plateHeight * 0.010), armReach * 0.70),
        material(THREE, { color: 0xd7c98a, roughness: 0.50, metalness: 0.12 })
      );
      tape.name = "ServoForgeKronesABArmMeasuringTape";
      tape.position.set(section.position.x, section.position.y + Math.max(0.018, plateHeight * 0.045), -outwardSign * armReach * 0.48);
      sidePivot.add(tape);

      // BOM item 7: 9-100-80-501-2 AB STOP P.E. SENSOR ASSEMBLY.
      const sensorWidth = Math.max(0.050, plateHeight * 0.16);
      const sensorHeight = Math.max(0.065, plateHeight * 0.20);
      const sensorDepth = Math.max(0.040, plateHeight * 0.13);
      const sensor = new THREE.Mesh(new THREE.BoxGeometry(sensorWidth, sensorHeight, sensorDepth), sensorMaterial);
      sensor.name = "ServoForgeKronesABStopPESensorAssembly";
      sensor.position.set(sensorWidth * 0.70, -plateHeight * 0.40, -outwardSign * armReach * 0.63);
      sidePivot.add(sensor);

      const sensorLens = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(0.008, sensorWidth * 0.15), 20),
        new THREE.MeshBasicMaterial({ color: 0x55e17d, side: THREE.DoubleSide })
      );
      sensorLens.name = "ServoForgeKronesABStopPESensorLens";
      sensorLens.rotation.y = outwardSign > 0 ? 0 : Math.PI;
      sensorLens.position.set(sensor.position.x, sensor.position.y, sensor.position.z - outwardSign * (sensorDepth / 2 + 0.002));
      sidePivot.add(sensorLens);
    }

    armGroup.userData.manualReference = manualMetadata("abLabelApplicationArm", {
      partNumber: "0-900-588-044",
      referencedApplicationWedgeVariant: "0-900-58-592-6",
      stopPhotoelectricSensorPartNumber: "9-100-80-501-2",
      sprocketIdlerPartNumber: "0-900-67-556-7",
      measuringTapePartNumber: "0-900-01-112-0"
    });
  }

  function applyManualHierarchy(THREE, assembly, aggregateItem, geometry) {
    if (!assembly) return assembly;

    const supportPost = findFirst(assembly, "ServoForgeSpenderSupportPost");
    const supportFoot = findFirst(assembly, "ServoForgeSpenderSupportFoot");
    const armRoot = findFirst(assembly, "ServoForgeApplicationArmRoot");
    const engagementPivot = findFirst(assembly, "ServoForgeEngagementAnglePivot");
    const plate = findFirst(assembly, "ServoForgeSpenderPlate");

    // Root represents the manual's LABEL APPLICATOR HEAD while preserving the
    // existing aggregate placement group outside this assembly.
    const aggregate = Number(aggregateItem?.aggregate) || 0;
    assembly.name = `ServoForgeKronesLabelApplicatorHead-Agg${aggregate || "X"}`;
    assembly.userData.manualReference = manualMetadata("labelApplicatorHead", {
      partNumber: "0-900-571-103",
      aggregate
    });

    const armGroup = new THREE.Group();
    armGroup.name = "ServoForgeKronesABLabelApplicationArm";
    assembly.add(armGroup);
    moveChildren(armGroup, [supportPost, supportFoot, armRoot]);

    if (engagementPivot) {
      const wedgeObjects = findAll(engagementPivot, (child) => [
        "ServoForgeSpenderPlate",
        "ServoForgeSpenderBackbone",
        "ServoForgeSpenderPlateMountBlade",
        "ServoForgeSpenderPlatePeelEdge",
        "ServoForgeSpenderPlateFastener"
      ].includes(child?.name));
      const idlerObjects = findAll(engagementPivot, (child) => [
        "ServoForgeSpenderGuideRoller",
        "ServoForgeSpenderGuideRollerAxle",
        "ServoForgeSpenderGuideRollerCap"
      ].includes(child?.name));
      const webObjects = findAll(engagementPivot, (child) => [
        "ServoForgeSpenderPlateLabelWeb",
        "ServoForgeSpenderFeederLabelWeb"
      ].includes(child?.name));

      const wedgeGroup = new THREE.Group();
      wedgeGroup.name = "ServoForgeKronesApplicationWedge";
      engagementPivot.add(wedgeGroup);
      moveChildren(wedgeGroup, wedgeObjects);

      const idlerGroup = new THREE.Group();
      idlerGroup.name = "ServoForgeKronesGuideRollerAssembly";
      engagementPivot.add(idlerGroup);
      moveChildren(idlerGroup, idlerObjects);
      idlerGroup.userData.manualReference = Object.freeze({
        designation: "SPROCKET IDLER L=119 / guide roller presentation",
        partNumber: "0-900-67-556-7",
        sourceAuthority: partsReference.SOURCE_AUTHORITY,
        dimensionalAuthority: false
      });

      const webGroup = new THREE.Group();
      webGroup.name = "ServoForgeKronesLabelWebPath";
      engagementPivot.add(webGroup);
      moveChildren(webGroup, webObjects);
      webGroup.userData.manualReference = Object.freeze({
        designation: "Label web presentation path",
        sourceAuthority: "manual-hierarchy-plus-user-machine-photos",
        dimensionalAuthority: false
      });

      addApplicationWedgeManualDetails(THREE, wedgeGroup, plate, aggregateItem, geometry);
    }

    addArmManualDetails(THREE, armGroup, armRoot, aggregateItem, geometry);

    assembly.userData.spenderManualAssembly = Object.freeze({
      hierarchy: Object.freeze([
        "LABEL APPLICATOR HEAD 0-900-571-103",
        "AB LABEL APPLICATION ARM 0-900-588-044",
        "APPLICATION WEDGE 0-900-585-924",
        "SPROCKET IDLER L=119 0-900-67-556-7",
        "AB STOP P.E. SENSOR ASSEMBLY 9-100-80-501-2"
      ]),
      manualHierarchyAuthority: true,
      dimensionsAutomaticallyAuthoritative: false,
      placementRulesPreserved: true,
      bottleClearanceMm: number(aggregateItem?.applicationClearanceMm, 2),
      flowAligned: true
    });
    return assembly;
  }

  function createSpenderPlateAssembly(THREE, aggregateItem, geometry) {
    return applyManualHierarchy(
      THREE,
      baseFactory.createSpenderPlateAssembly(THREE, aggregateItem, geometry),
      aggregateItem,
      geometry
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
    group.userData.flowDirection = item?.flowDirection || null;
    group.userData.highlightMaterials = spender.userData.highlightMaterials || [];
    return group;
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseFactory,
    FACTORY_VERSION,
    createSpenderPlateAssembly,
    createAggregateAssembly,
    applyManualHierarchy
  });
})(window);
