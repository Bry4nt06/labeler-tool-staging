(function installServoForge3DCoderHousingDimensionRefinement(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createEquipmentAssembly) {
    throw new Error("ServoForge coder housing refinement requires the active hardware mesh factory.");
  }

  const PATCH_VERSION = "servoforge.3d-coder-housing-dimensions.v1";
  const HOUSING_HEIGHT_MM = 914.4; // 36 in
  const HOUSING_WIDTH_MM = 101.6; // 4 in
  const HOUSING_DEPTH_MM = 101.6; // 4 in
  const EXTENSION_LENGTH_MM = 152.4; // 6 in
  const OPTIC_HEAD_LENGTH_MM = 101.6; // 4 in
  const OPTIC_HEAD_WIDTH_MM = 101.6; // 4 in
  const OPTIC_HEAD_HEIGHT_MM = 101.6; // 4 in
  const LENS_DIAMETER_MM = 76.2; // 3 in
  const LENS_THICKNESS_MM = 8;
  const LENS_CENTER_ABOVE_HOUSING_BOTTOM_MM = 101.6; // 4 in

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function unitsPerMm(geometry = {}) {
    return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
  }

  function disposeObject(object) {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
      const disposeMaterial = (entry) => entry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    });
  }

  function colorHex(material) {
    try {
      return Number(material?.color?.getHex?.());
    } catch {
      return NaN;
    }
  }

  function findLaserBeam(assembly) {
    let beam = null;
    assembly?.traverse?.((child) => {
      if (beam || !child?.isMesh || child.geometry?.type !== "CylinderGeometry") return;
      const hex = colorHex(child.material);
      const isRedBasic = child.material?.type === "MeshBasicMaterial"
        && Number.isFinite(hex)
        && ((hex >> 16) & 0xff) > 180
        && ((hex >> 8) & 0xff) < 100;
      if (isRedBasic) beam = child;
    });
    return beam;
  }

  function beamStartPlaneZ(beam) {
    const length = Math.max(0, number(beam?.geometry?.parameters?.height));
    return number(beam?.position?.z) + length / 2;
  }

  function replaceCoderVisuals(THREE, assembly, geometry) {
    if (!assembly || assembly.userData?.coderHousingDimensionsV1Applied) return assembly;
    const beam = findLaserBeam(assembly);
    if (!beam) return assembly;

    // Preserve the existing red laser beam exactly. Its near endpoint is the
    // fixed optical datum already positioned by the 190 mm bottle-surface
    // setback logic. Everything else is rebuilt backward from that datum.
    const lensFaceZ = beamStartPlaneZ(beam);
    const lensY = number(beam.position?.y, 0.72);
    const scale = unitsPerMm(geometry);

    [...assembly.children].forEach((child) => {
      if (child === beam) return;
      assembly.remove(child);
      disposeObject(child);
    });

    beam.name = "ServoForgeCoderLaserBeam";
    beam.userData.geometryPreserved = true;
    beam.userData.sizePreserved = true;

    const housingHeight = HOUSING_HEIGHT_MM * scale;
    const housingWidth = HOUSING_WIDTH_MM * scale;
    const housingDepth = HOUSING_DEPTH_MM * scale;
    const extensionLength = EXTENSION_LENGTH_MM * scale;
    const opticLength = OPTIC_HEAD_LENGTH_MM * scale;
    const opticWidth = OPTIC_HEAD_WIDTH_MM * scale;
    const opticHeight = OPTIC_HEAD_HEIGHT_MM * scale;
    const lensRadius = LENS_DIAMETER_MM * scale / 2;
    const lensThickness = LENS_THICKNESS_MM * scale;
    const lensCenterAboveBottom = LENS_CENTER_ABOVE_HOUSING_BOTTOM_MM * scale;

    const housingMaterial = new THREE.MeshStandardMaterial({
      color: 0x293139,
      roughness: 0.34,
      metalness: 0.48
    });
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0x20272d,
      roughness: 0.38,
      metalness: 0.54
    });
    const extensionMaterial = new THREE.MeshStandardMaterial({
      color: 0x68737a,
      roughness: 0.28,
      metalness: 0.76
    });
    const lensMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe4f4fa,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.82,
      transparent: true,
      opacity: 0.30,
      ior: 1.48,
      thickness: Math.max(0.01, lensThickness),
      side: THREE.DoubleSide
    });
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8c1c6,
      roughness: 0.22,
      metalness: 0.88
    });

    // Local -Z points toward the bottle/carousel. Build the enlarged coder in
    // +Z behind the fixed lens face so the existing 190 mm optical setback is
    // not changed by these new housing dimensions.
    const opticCenterZ = lensFaceZ + opticLength / 2;
    const extensionCenterZ = lensFaceZ + opticLength + extensionLength / 2;
    const housingFrontZ = lensFaceZ + opticLength + extensionLength;
    const housingCenterZ = housingFrontZ + housingDepth / 2;
    const housingCenterY = lensY + housingHeight / 2 - lensCenterAboveBottom;

    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(housingWidth, housingHeight, housingDepth),
      housingMaterial
    );
    housing.name = "ServoForgeCoderHousing36in";
    housing.position.set(0, housingCenterY, housingCenterZ);
    housing.castShadow = true;
    housing.receiveShadow = true;
    assembly.add(housing);

    const extensionCrossSection = Math.min(opticWidth * 0.52, HOUSING_WIDTH_MM * scale * 0.62);
    const extension = new THREE.Mesh(
      new THREE.BoxGeometry(extensionCrossSection, extensionCrossSection, extensionLength),
      extensionMaterial
    );
    extension.name = "ServoForgeCoderExtension6in";
    extension.position.set(0, lensY, extensionCenterZ);
    extension.castShadow = true;
    assembly.add(extension);

    const opticHead = new THREE.Mesh(
      new THREE.BoxGeometry(opticWidth, opticHeight, opticLength),
      headMaterial
    );
    opticHead.name = "ServoForgeCoderOpticHead4in";
    opticHead.position.set(0, lensY, opticCenterZ);
    opticHead.castShadow = true;
    opticHead.receiveShadow = true;
    assembly.add(opticHead);

    const clearLens = new THREE.Mesh(
      new THREE.CylinderGeometry(lensRadius, lensRadius, lensThickness, 64),
      lensMaterial
    );
    clearLens.name = "ServoForgeCoderClearLens3in";
    clearLens.rotation.x = Math.PI / 2;
    clearLens.position.set(0, lensY, lensFaceZ + lensThickness / 2);
    clearLens.castShadow = false;
    clearLens.userData.coderLensDiameterMm = LENS_DIAMETER_MM;
    clearLens.userData.lensFinish = "clear-translucent";
    assembly.add(clearLens);

    const lensRim = new THREE.Mesh(
      new THREE.TorusGeometry(lensRadius * 1.02, Math.max(scale * 1.8, lensRadius * 0.035), 10, 64),
      rimMaterial
    );
    lensRim.name = "ServoForgeCoderLensRim";
    lensRim.position.set(0, lensY, lensFaceZ - scale * 0.8);
    assembly.add(lensRim);

    assembly.userData.coderHousingDimensionsV1Applied = true;
    assembly.userData.coderHousing = Object.freeze({
      heightInches: 36,
      widthInches: 4,
      depthInches: 4,
      extensionLengthInches: 6,
      opticHeadLengthInches: 4,
      lensDiameterInches: 3,
      lensFinish: "clear-translucent",
      laserBeamGeometryUntouched: true,
      bottleSurfaceSetbackPreservedMm: 190,
      dimensionalAuthority: "user-supplied-sketch-2026-08-18"
    });
    assembly.userData.highlightMaterials = [housingMaterial, headMaterial];
    return assembly;
  }

  function createEquipmentAssembly(THREE, item, geometry) {
    const assembly = baseFactory.createEquipmentAssembly(THREE, item, geometry);
    if (!assembly || item?.kind !== "coding") return assembly;
    return replaceCoderVisuals(THREE, assembly, geometry);
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseFactory,
    FACTORY_VERSION: "servoforge.3d-hardware-mesh.v13-coder-housing-dimensions",
    PATCH_VERSION,
    CODER_HOUSING_HEIGHT_MM: HOUSING_HEIGHT_MM,
    CODER_HOUSING_WIDTH_MM: HOUSING_WIDTH_MM,
    CODER_HOUSING_DEPTH_MM: HOUSING_DEPTH_MM,
    CODER_EXTENSION_LENGTH_MM: EXTENSION_LENGTH_MM,
    CODER_OPTIC_HEAD_LENGTH_MM: OPTIC_HEAD_LENGTH_MM,
    CODER_LENS_DIAMETER_MM: LENS_DIAMETER_MM,
    createEquipmentAssembly
  });

  global.Labeler3DCoderHousingDimensionRefinement = Object.freeze({
    PATCH_VERSION,
    HOUSING_HEIGHT_MM,
    HOUSING_WIDTH_MM,
    HOUSING_DEPTH_MM,
    EXTENSION_LENGTH_MM,
    OPTIC_HEAD_LENGTH_MM,
    LENS_DIAMETER_MM,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        housing: "36in-tall-4in-wide-4in-deep",
        extension: "6in",
        opticHead: "4in",
        lens: "3in-clear-translucent",
        beamPreserved: true,
        setbackPreservedMm: 190
      });
    }
  });
})(window);
