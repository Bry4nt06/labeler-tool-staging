(function installServoForge3DSceneRootBridge(global) {
  "use strict";

  const VERSION = "servoforge.3d-scene-root-bridge.v1";
  const BUILD = "3d-handling-bridge-v222-20260820-1002";
  const UPDATED_AT = "Aug 20, 2026 10:02 AM ET";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

  let bridgedSceneCount = 0;
  let lastBridgeRoot = null;

  function publishBuild() {
    global.ServoForgeBootstrapBuild = BUILD;
    global.ServoForgeBootstrapUpdatedAt = UPDATED_AT;
    global.SERVOFORGE_BUILD_ID = BUILD;
    global.SERVOFORGE_BUILD_UPDATED_AT = UPDATED_AT;
    global.ServoForgeStagingBuildBannerAuthorityV2?.enforce?.();
  }

  function install(THREE) {
    const prototype = THREE?.WebGLRenderer?.prototype;
    if (!prototype || prototype.__servoforgeSceneRootBridgeV1) return;

    const nativeRender = prototype.render;
    prototype.render = function servoforgeRenderWithSceneRootBridge(scene, camera) {
      try {
        if (scene?.isScene && !scene.userData?.servoforgeHandlingBridgeInstalled) {
          const root = new THREE.Group();
          root.name = "ServoForge3DScene";
          root.userData.servoforgeSceneRootBridge = true;
          root.userData.bridgeVersion = VERSION;

          // Bottle-handling integrations listen for an Object3D named
          // ServoForge3DScene. The canonical v0.8 renderer owns a THREE.Scene
          // directly, so it never emitted that add event. Adding this root into
          // the real rendered scene gives the handling system one authoritative
          // parent without creating a second viewport or renderer.
          scene.add(root);
          scene.userData.servoforgeHandlingBridgeInstalled = true;
          scene.userData.servoforgeHandlingBridgeVersion = VERSION;
          lastBridgeRoot = root;
          bridgedSceneCount += 1;

          // Reassert the current view after the handling layer has a real scene.
          const mode = document.querySelector("#servoforge3dBottleMode")?.value || "all";
          global.Labeler3DBottleHandlingViewport?.setBottleMode?.(mode);
        }
      } catch (error) {
        console.warn("ServoForge 3D scene-root bridge skipped a frame", error);
      }

      return nativeRender.call(this, scene, camera);
    };

    Object.defineProperty(prototype, "__servoforgeSceneRootBridgeV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }

  publishBuild();

  import(THREE_MODULE_URL)
    .then((THREE) => install(THREE))
    .catch((error) => console.error("ServoForge 3D scene-root bridge failed", error));

  global.Labeler3DSceneRootBridge = Object.freeze({
    VERSION,
    BUILD,
    status() {
      return Object.freeze({
        version: VERSION,
        bridgedSceneCount,
        bridgeRootPresent: Boolean(lastBridgeRoot?.parent),
        bridgeRootName: lastBridgeRoot?.name || null,
        targetRenderer: "canonical-three-scene-renderer-v08",
        secondViewportCreated: false
      });
    }
  });
})(window);
