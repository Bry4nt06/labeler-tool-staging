(function installServoForge3DAllBottleServoSynchronization(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-all-bottle-servo-sync.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const handlingBottles = new Set();
  let THREE = null;
  let running = false;
  let lastServoRotationY = 0;
  let synchronizedBottleCount = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function isHandlingBottle(object) {
    return Boolean(object?.userData?.handlingBottle)
      || /^ServoForgeHandlingBottle\d+$/.test(String(object?.name || ""));
  }

  function currentServoRotationY() {
    const rows = Array.isArray(global.state?.program) ? global.state.program : [];
    const tableAngle = number(global.state?.previewAngle, 0);
    const driver = global.Labeler3DSimulationFrameDriver;
    const sceneAdapter = global.Labeler3DSceneAdapter;
    const runtime = global.Labeler3DSceneRuntime;

    if (runtime?.snapshot) {
      try {
        const snapshot = runtime.snapshot({ rows, tableAngle });
        const rotationY = snapshot?.scene?.bottle?.rotation?.y;
        if (Number.isFinite(Number(rotationY))) return Number(rotationY);
      } catch {
        // Fall through to the lower-level frame path.
      }
    }

    if (driver?.snapshot && sceneAdapter?.toSceneState && rows.length) {
      try {
        const frame = driver.snapshot(rows, tableAngle, {
          commandDriver: global.LabelerServoCommandDriver
        });
        const scene = sceneAdapter.toSceneState(frame, {
          carouselDirection: global.state?.direction || "ccw",
          zeroAngleDegrees: number(global.state?.zeroAngle, 0)
        });
        const rotationY = scene?.bottle?.rotation?.y;
        if (Number.isFinite(Number(rotationY))) return Number(rotationY);
      } catch {
        // Keep the last valid rotation so the population never snaps back.
      }
    }

    return lastServoRotationY;
  }

  function synchronize() {
    const rotationY = currentServoRotationY();
    lastServoRotationY = rotationY;
    let count = 0;

    handlingBottles.forEach((bottle) => {
      if (!bottle?.parent) {
        handlingBottles.delete(bottle);
        return;
      }
      bottle.rotation.y = rotationY;
      bottle.userData.servoRotationAuthority = PATCH_VERSION;
      bottle.userData.servoRotationMode = "all-bottles-one-servo-path";
      bottle.userData.servoRotationY = rotationY;
      count += 1;
    });

    synchronizedBottleCount = count;
  }

  function loop() {
    if (!running) return;
    synchronize();
    global.requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running) return;
    running = true;
    global.requestAnimationFrame(loop);
  }

  function installHook() {
    const prototype = THREE?.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeAllBottleServoSyncV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoForgeAllBottleServoSyncAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        if (isHandlingBottle(object)) handlingBottles.add(object);
      });
      if (handlingBottles.size) startLoop();
      return result;
    };
    Object.defineProperty(prototype, "__servoforgeAllBottleServoSyncV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }

  function status() {
    return Object.freeze({
      patchVersion: PATCH_VERSION,
      synchronizedBottleCount,
      trackedBottleCount: handlingBottles.size,
      lastServoRotationY,
      motionAuthority: "current-preview-angle-generated-servo-program",
      populationMode: "all-bottles-one-servo-path",
      positionAuthorityUntouched: true,
      starWheelAuthorityUntouched: true
    });
  }

  global.Labeler3DAllBottleServoSynchronization = Object.freeze({
    PATCH_VERSION,
    synchronize,
    status
  });

  import(THREE_MODULE_URL)
    .then((module) => {
      THREE = module;
      installHook();
      startLoop();
    })
    .catch((error) => console.error("ServoForge all-bottle servo synchronization integration failed", error));
})(window);
