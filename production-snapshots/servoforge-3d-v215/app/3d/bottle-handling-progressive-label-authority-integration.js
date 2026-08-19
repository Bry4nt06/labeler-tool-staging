(function installServoForge3DProgressiveLabelAuthority(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-progressive-label-authority.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const handlingBottles = new Set();
  let THREE = null;
  let running = false;
  let suppressedLegacyGroups = 0;

  function isHandlingBottle(object) {
    return Boolean(object?.userData?.handlingBottle) || /^ServoForgeHandlingBottle\d+$/.test(String(object?.name || ""));
  }

  function suppressLegacyLabelGroup(bottle) {
    if (!bottle?.parent) return;
    bottle.children?.forEach((child) => {
      if (child?.name !== "ServoForgeHandlingBottleLabels") return;
      if (child.visible !== false) suppressedLegacyGroups += 1;
      child.visible = false;
      child.userData.supersededByProgressiveLabelFlow = true;
      child.userData.labelVisualAuthority = "ServoForgeProgressiveBottleLabels";
    });
  }

  function loop() {
    if (!running) return;
    handlingBottles.forEach((bottle) => {
      if (!bottle?.parent) handlingBottles.delete(bottle);
      else suppressLegacyLabelGroup(bottle);
    });
    global.requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running) return;
    running = true;
    global.requestAnimationFrame(loop);
  }

  function installHook() {
    const prototype = THREE?.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeProgressiveLabelAuthorityV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgeProgressiveLabelAuthorityAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        if (isHandlingBottle(object)) handlingBottles.add(object);
      });
      if (handlingBottles.size) startLoop();
      return result;
    };
    Object.defineProperty(prototype, "__servoforgeProgressiveLabelAuthorityV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }

  function status() {
    return Object.freeze({
      patchVersion: PATCH_VERSION,
      handlingBottles: handlingBottles.size,
      suppressedLegacyGroups,
      progressiveLabelVisualAuthority: true,
      starGeometryAuthorityUntouched: true,
      servoWrites: false,
      plannerWrites: false
    });
  }

  global.Labeler3DProgressiveLabelAuthority = Object.freeze({ PATCH_VERSION, status });

  import(THREE_MODULE_URL)
    .then((module) => {
      THREE = module;
      installHook();
    })
    .catch((error) => console.error("ServoForge progressive label authority integration failed", error));
})(window);
