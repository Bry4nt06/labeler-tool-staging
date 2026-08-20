(function installServoForgeBottleHandlingSceneAttachmentRecovery(global) {
  "use strict";

  const VERSION = "servoforge.3d-bottle-handling-scene-attachment-recovery.v2";
  const BUILD = "3d-handling-attach-v223-20260820-1004";
  const UPDATED_AT = "Aug 20, 2026 10:04 AM ET";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  let attachedSceneCount = 0;
  let attachmentAttempts = 0;
  let lastBottleCount = 0;
  let lastVisibleBottleCount = 0;

  function publishBuild() {
    global.ServoForgeBootstrapBuild = BUILD;
    global.ServoForgeBootstrapUpdatedAt = UPDATED_AT;
    global.SERVOFORGE_BUILD_ID = BUILD;
    global.SERVOFORGE_BUILD_UPDATED_AT = UPDATED_AT;
    global.ServoForgeStagingBuildBannerAuthorityV2?.enforce?.();
  }

  function handlingStatus() {
    return global.Labeler3DBottleHandlingViewport?.status?.() || null;
  }

  function triggerBottleHandlingSceneHook(THREE, scene) {
    if (!scene?.isScene) return false;
    if (handlingStatus()?.installed) {
      scene.userData.servoforgeBottleHandlingSceneAttachmentV2 = true;
      return true;
    }

    attachmentAttempts += 1;
    const originalName = scene.name;
    const probe = new THREE.Group();

    try {
      // The bottle-handling renderer installs an Object3D.add hook that listens
      // for an object named ServoForge3DScene. The canonical v0.8 renderer owns
      // its THREE.Scene directly, so there is no parent.add(scene) event during
      // normal startup. Replaying that event here attaches the star wheels,
      // conveyors and handling-bottle population to the scene actually rendered.
      //
      // IMPORTANT: do not latch success until the handling integration reports
      // installed. Its Three.js import is asynchronous, so the first rendered
      // frame can occur before its hook is ready.
      scene.name = "ServoForge3DScene";
      probe.add(scene);
      probe.remove(scene);
      scene.name = originalName || "ServoForge3DScene";

      const status = handlingStatus();
      if (!status?.installed) return false;

      scene.userData.servoforgeBottleHandlingSceneAttachmentV2 = true;
      attachedSceneCount += 1;
      const mode = document.querySelector("#servoforge3dBottleMode")?.value || "all";
      global.Labeler3DBottleHandlingViewport?.setBottleMode?.(mode);
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
    if (!prototype || prototype.__servoforgeBottleHandlingSceneAttachmentRecoveryV2) return;

    const nativeRender = prototype.render;
    prototype.render = function servoforgeBottleHandlingSceneAttachmentRender(scene, camera) {
      triggerBottleHandlingSceneHook(THREE, scene);
      const result = nativeRender.call(this, scene, camera);
      const status = handlingStatus();
      lastBottleCount = Number(status?.bottleCount || 0);
      lastVisibleBottleCount = Number(status?.visibleHandlingBottleCount || 0);
      return result;
    };

    Object.defineProperty(prototype, "__servoforgeBottleHandlingSceneAttachmentRecoveryV2", {
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
      const handling = handlingStatus();
      return Object.freeze({
        version: VERSION,
        attachedSceneCount,
        attachmentAttempts,
        bottleHandlingInstalled: Boolean(handling?.installed),
        bottleCount: Number(handling?.bottleCount || lastBottleCount || 0),
        visibleHandlingBottleCount: Number(handling?.visibleHandlingBottleCount || lastVisibleBottleCount || 0),
        bottleMode: handling?.bottleMode || null,
        retryUntilAttached: true,
        canonicalViewportOnly: true
      });
    }
  });
})(window);
