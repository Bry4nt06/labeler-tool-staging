(function installServoForge3DBottlePathShapeCorrection(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-bottle-path.v1-table-orbit";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const PATH_COLOR = 0xff6a3d;
  const PATH_TUBE_RADIUS = 0.024;

  let installed = false;
  let capturedCount = 0;

  function isServoForgeBottlePath(object) {
    if (!object?.isMesh || object?.geometry?.type !== "TorusGeometry") return false;
    const color = object?.material?.color?.getHex?.();
    return color === PATH_COLOR && Math.abs(Number(object?.position?.y) - 0.247) < 0.02;
  }

  function patchPathMesh(THREE, path) {
    if (!path || path.userData?.servoforgeBottlePathCorrected) return;
    capturedCount += 1;
    path.name = "ServoForgeBottleTableOrbitPath";

    const nativeScaleSet = path.scale.set.bind(path.scale);
    let currentRadius = null;

    path.scale.set = function setPhysicalBottlePathRadius(x, y, z) {
      const requestedRadius = Number(x);
      if (Number.isFinite(requestedRadius) && requestedRadius > 0) {
        if (currentRadius === null || Math.abs(currentRadius - requestedRadius) > 1e-9) {
          const previous = path.geometry;
          path.geometry = new THREE.TorusGeometry(requestedRadius, PATH_TUBE_RADIUS, 10, 192);
          previous?.dispose?.();
          currentRadius = requestedRadius;
        }
        // Geometry now carries the physical bottle-table radius directly. Keeping
        // unit scale prevents the old local-axis scaling from turning the path
        // into an oval after its X-axis rotation into the carousel plane.
        return nativeScaleSet(1, 1, 1);
      }
      return nativeScaleSet(x, y, z);
    };

    path.userData.servoforgeBottlePathCorrected = Object.freeze({
      patchVersion: PATCH_VERSION,
      radiusAuthority: "physical-bottle-table-pitch-radius",
      geometryMode: "native-circular-torus-no-nonuniform-scale",
      followsBottleTableCenters: true,
      ovalScalingDisabled: true
    });
  }

  import(THREE_MODULE_URL).then((THREE) => {
    const prototype = THREE.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeBottlePathPatchInstalled) {
      installed = Boolean(prototype?.__servoforgeBottlePathPatchInstalled);
      return;
    }

    const nativeAdd = prototype.add;
    prototype.add = function servoforgePatchedAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        if (isServoForgeBottlePath(object)) patchPathMesh(THREE, object);
      });
      return result;
    };

    Object.defineProperty(prototype, "__servoforgeBottlePathPatchInstalled", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
    installed = true;
  }).catch((error) => {
    console.error("ServoForge bottle-path shape correction failed", error);
  });

  global.Labeler3DBottlePathShapeCorrection = Object.freeze({
    PATCH_VERSION,
    THREE_VERSION,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        installed,
        capturedCount,
        pathShape: "circular-table-orbit",
        radiusAuthority: "physical-bottle-table-pitch-radius",
        readOnly: true
      });
    }
  });
})(window);
