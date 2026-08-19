(function installServoForge3DCoderHeight26InRefinement(global) {
  "use strict";

  const baseFactory = global.Labeler3DHardwareMeshFactory;
  if (!baseFactory?.createEquipmentAssembly) {
    throw new Error("ServoForge 26 inch coder refinement requires the active hardware factory.");
  }

  const PATCH_VERSION = "servoforge.3d-coder-height-26in.v1";
  const HOUSING_HEIGHT_MM = 660.4; // 26 in
  const HOUSING_WIDTH_MM = 101.6; // preserve 4 in
  const HOUSING_DEPTH_MM = 101.6; // preserve 4 in
  const LENS_CENTER_ABOVE_HOUSING_BOTTOM_MM = 101.6; // preserve 4 in datum

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function unitsPerMm(geometry = {}) {
    return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
  }

  function apply26InHousing(THREE, assembly, geometry) {
    if (!assembly || assembly.userData?.coderHeight26InApplied) return assembly;
    const housing = assembly.getObjectByName?.("ServoForgeCoderHousing36in");
    const lens = assembly.getObjectByName?.("ServoForgeCoderClearLens3in");
    if (!housing || !lens) return assembly;

    const scale = unitsPerMm(geometry);
    const heightWorld = HOUSING_HEIGHT_MM * scale;
    const widthWorld = HOUSING_WIDTH_MM * scale;
    const depthWorld = HOUSING_DEPTH_MM * scale;
    const lensBottomDatumWorld = LENS_CENTER_ABOVE_HOUSING_BOTTOM_MM * scale;

    const oldGeometry = housing.geometry;
    housing.geometry = new THREE.BoxGeometry(widthWorld, heightWorld, depthWorld);
    oldGeometry?.dispose?.();
    housing.name = "ServoForgeCoderHousing26in";
    housing.position.y = number(lens.position?.y) + heightWorld / 2 - lensBottomDatumWorld;
    housing.userData.heightInches = 26;
    housing.userData.widthInches = 4;
    housing.userData.depthInches = 4;
    housing.userData.lensDatumPreserved = true;

    assembly.userData.coderHeight26InApplied = true;
    assembly.userData.coderHousing = Object.freeze({
      ...(assembly.userData.coderHousing || {}),
      heightInches: 26,
      widthInches: 4,
      depthInches: 4,
      lensDiameterInches: 3,
      lensFinish: "clear-translucent",
      laserBeamGeometryUntouched: true,
      bottleSurfaceSetbackPreservedMm: 190,
      heightAuthority: "user-corrected-26in-2026-08-18"
    });
    return assembly;
  }

  function createEquipmentAssembly(THREE, item, geometry) {
    const assembly = baseFactory.createEquipmentAssembly(THREE, item, geometry);
    if (!assembly || item?.kind !== "coding") return assembly;
    return apply26InHousing(THREE, assembly, geometry);
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseFactory,
    FACTORY_VERSION: "servoforge.3d-hardware-mesh.v15-coder-26in",
    PATCH_VERSION,
    CODER_HOUSING_HEIGHT_MM: HOUSING_HEIGHT_MM,
    createEquipmentAssembly
  });

  global.Labeler3DCoderHeight26InRefinement = Object.freeze({
    PATCH_VERSION,
    HOUSING_HEIGHT_MM,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        housing: "26in-tall-4in-wide-4in-deep",
        lens: "3in-clear-translucent",
        beamPreserved: true,
        setbackPreservedMm: 190,
        readOnly: true
      });
    }
  });
})(window);
