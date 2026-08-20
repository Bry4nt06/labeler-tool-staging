(function installServoForge3DBottleHandlingPhotoPresentation(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-bottle-handling-photo-presentation.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const DATUM_Y = 0.275;

  let THREE = null;
  let handlingLayer = null;
  let datumLine = null;
  let datumOrigin = null;
  let hiddenGenericHubCount = 0;
  let running = false;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function handlingAdapter() {
    return global.Labeler3DBottleHandlingAdapter || null;
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function isGenericCarouselHub(object) {
    if (!object?.isMesh || object?.geometry?.type !== "CylinderGeometry") return false;
    const color = object?.material?.color?.getHex?.();
    const y = number(object?.position?.y);
    return color === 0x10191e && Math.abs(y - 0.34) < 0.03;
  }

  function ensureDatumVisual() {
    if (!THREE || !handlingLayer) return;
    if (!datumLine) {
      datumLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, DATUM_Y, 0),
          new THREE.Vector3(1, DATUM_Y, 0)
        ]),
        new THREE.LineBasicMaterial({ color: 0xff2b18, transparent: true, opacity: 0.95 })
      );
      datumLine.name = "ServoForgeBottleHandlingZeroDatumLine";
      datumLine.userData.angularAuthority = true;
      datumLine.userData.source = "user-marked-labeler-zero-photo-2026-08-18";
      handlingLayer.add(datumLine);
    }
    if (!datumOrigin) {
      datumOrigin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.018, 24),
        new THREE.MeshBasicMaterial({ color: 0xff2b18 })
      );
      datumOrigin.name = "ServoForgeBottleHandlingZeroDatumOrigin";
      datumOrigin.position.y = DATUM_Y;
      handlingLayer.add(datumOrigin);
    }
  }

  function updateDatum() {
    if (!handlingLayer || !datumLine) return;
    const activeRuntime = runtime();
    const adapter = handlingAdapter();
    if (!activeRuntime?.snapshot || !adapter?.snapshot) return;
    try {
      const snapshot = activeRuntime.latestSnapshot?.() || activeRuntime.snapshot({
        scene: {
          tableY: 0.20,
          bottleLift: 0.155,
          unitMode: "physical-mm-bottle-handling-photo-datum"
        }
      });
      const handling = adapter.snapshot(
        snapshot?.scene?.carousel?.machineAngleDegrees,
        snapshot.geometry,
        {
          carouselDirection: String(global.state?.direction || "ccw"),
          zeroAngleDegrees: number(global.state?.zeroAngle, 0)
        }
      );
      const line = handling?.layout?.zeroDatum?.line;
      if (!line?.end) return;
      datumLine.geometry.setFromPoints([
        new THREE.Vector3(number(line.start?.x), DATUM_Y, number(line.start?.z)),
        new THREE.Vector3(number(line.end?.x), DATUM_Y, number(line.end?.z))
      ]);
      datumLine.geometry.computeBoundingSphere?.();
    } catch {
      // Presentation reference only. Never interfere with ServoForge runtime.
    }
  }

  function loop() {
    if (!running) return;
    ensureDatumVisual();
    updateDatum();
  }

  function startLoop() {
    if (running) return;
    const coordinator = global.Labeler3DPresentationFrameCoordinator;
    if (!coordinator?.register) {
      console.warn("ServoForge 3D presentation frame coordinator is unavailable.");
      return;
    }
    running = true;
    coordinator.register(PATCH_VERSION, loop, { minIntervalMs: 120 });
  }

  import(THREE_MODULE_URL).then((module) => {
    THREE = module;
    const prototype = THREE.Object3D?.prototype;
    if (!prototype || prototype.__servoforgePhotoHandlingPresentationV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgePhotoHandlingPresentationAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        if (isGenericCarouselHub(object)) {
          object.name = "ServoForgeGenericCarouselHubHiddenForHandling";
          object.visible = false;
          object.userData.hiddenForBottleHandlingPurposeView = true;
          hiddenGenericHubCount += 1;
        }
        if (object?.name === "ServoForgeBottleHandlingSystem") {
          handlingLayer = object;
          ensureDatumVisual();
          startLoop();
        }
      });
      return result;
    };
    Object.defineProperty(prototype, "__servoforgePhotoHandlingPresentationV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }).catch((error) => {
    console.error("ServoForge photo handling presentation failed", error);
  });

  global.Labeler3DBottleHandlingPhotoPresentation = Object.freeze({
    PATCH_VERSION,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        datumVisible: Boolean(datumLine),
        hiddenGenericHubCount,
        readOnly: true
      });
    }
  });
})(window);
