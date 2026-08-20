(function installServoForgeBottleHandlingSceneAttachmentRecovery(global) {
  "use strict";

  const VERSION = "servoforge.3d-bottle-handling-scene-attachment-recovery.v1";
  const BUILD = "3d-bottle-population-v222-20260820-0955";
  const UPDATED_AT = "Aug 20, 2026 9:55 AM ET";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  let attachedSceneCount = 0;
  let lastBottleCount = 0;

  function publishBuild() {
    global.ServoForgeBootstrapBuild = BUILD;
    global.ServoForgeBootstrapUpdatedAt = UPDATED_AT;
    global.SERVOFORGE_BUILD_ID = BUILD;
    global.SERVOFORGE_BUILD_UPDATED_AT = UPDATED_AT;
    global.ServoForgeStagingBuildBannerAuthorityV2?.enforce?.();
  }

  function triggerBottleHandlingSceneHook(THREE, scene) {
    if (!scene?.isScene || scene.userData?.servoforgeBottleHandlingSceneAttachmentV1) return false;

    const originalName = scene.name;
    const probe = new THREE.Group();
    try {
      // bottle-handling-viewport-integration installs an Object3D.add hook that
      // recognizes a scene named ServoForge3DScene. The v0.8 renderer creates
      // its Scene directly, so that hook never previously saw the scene.
      scene.name = "ServoForge3DScene";
      probe.add(scene);
      probe.remove(scene);
      scene.name = originalName || "ServoForge3DScene";
      scene.userData.servoforgeBottleHandlingSceneAttachmentV1 = true;
      attachedSceneCount += 1;
      return true;
    } catch (error) {
      scene.name = originalName;
      console.warn("ServoForge bottle-handling scene attachment recovery failed", error);
      return false;
    }
  }

  async function install() {
    const THREE = await import(THREE_MODULE_URL);
    const prototype = THREE.WebGLRenderer?.prototype;
    if (!prototype || prototype.__servoforgeBottleHandlingSceneAttachmentRecoveryV1) return;

    const nativeRender = prototype.render;
    prototype.render = function servoforgeBottleHandlingSceneAttachmentRender(scene, camera) {
      triggerBottleHandlingSceneHook(THREE, scene);
      const result = nativeRender.call(this, scene, camera);
      const status = global.Labeler3DBottleHandlingViewport?.status?.();
      lastBottleCount = Number(status?.bottleCount || 0);
      return result;
    };

    Object.defineProperty(prototype, "__servoforgeBottleHandlingSceneAttachmentRecoveryV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }

  publishBuild();
  install().catch((error) => console.error("ServoForge bottle-handling scene attachment recovery failed to install", error));

  global.Labeler3DBottleHandlingSceneAttachmentRecovery = Object.freeze({
    VERSION,
    BUILD,
    status() {
      const handling = global.Labeler3DBottleHandlingViewport?.status?.();
      return Object.freeze({
        version: VERSION,
        attachedSceneCount,
        bottleHandlingInstalled: Boolean(handling?.installed),
        bottleCount: Number(handling?.bottleCount || lastBottleCount || 0),
        visibleHandlingBottleCount: Number(handling?.visibleHandlingBottleCount || 0),
        bottleMode: handling?.bottleMode || null
      });
    }
  });
})(window);
