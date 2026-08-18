(function installServoForge3DFreeRoamCameraCapture(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.3d-free-roam-camera-capture.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

  let installed = false;
  let capturedFrames = 0;

  function install(THREE) {
    const prototype = THREE.Camera?.prototype;
    if (!prototype?.updateMatrixWorld) return false;
    if (prototype.__servoforgeFreeRoamCameraCaptureV1) {
      installed = true;
      return true;
    }

    const nativeUpdateMatrixWorld = prototype.updateMatrixWorld;
    const forward = new THREE.Vector3();
    const target = new THREE.Vector3();

    prototype.updateMatrixWorld = function servoforgeFreeRoamCameraCapture(force) {
      const result = nativeUpdateMatrixWorld.call(this, force);

      // viewport-ui-controls captures the live camera from Object3D.lookAt().
      // A 3D scene may have created its camera before that hook was installed,
      // leaving Free Roam with no camera reference. Re-applying the camera's
      // current forward direction preserves the current view while guaranteeing
      // that the active camera is handed to the Free Roam controller on every
      // rendered frame.
      if (this?.isCamera && typeof this.lookAt === "function") {
        forward.set(0, 0, -1).applyQuaternion(this.quaternion);
        target.copy(this.position).add(forward);
        this.lookAt(target);
        capturedFrames += 1;
      }

      return result;
    };

    Object.defineProperty(prototype, "__servoforgeFreeRoamCameraCaptureV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });

    installed = true;
    return true;
  }

  function status() {
    return Object.freeze({
      integrationVersion: INTEGRATION_VERSION,
      threeVersion: THREE_VERSION,
      installed,
      capturedFrames,
      purpose: "capture-active-camera-for-free-roam"
    });
  }

  global.Labeler3DFreeRoamCameraCapture = Object.freeze({
    INTEGRATION_VERSION,
    THREE_VERSION,
    status
  });

  import(THREE_MODULE_URL)
    .then((THREE) => {
      if (!install(THREE)) throw new Error("Three.js Camera.updateMatrixWorld is unavailable.");
    })
    .catch((error) => console.error("ServoForge Free Roam camera capture failed", error));
})(window);
