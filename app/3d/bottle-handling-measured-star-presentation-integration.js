(function installServoForge3DBottleHandlingMeasuredStarPresentation(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-bottle-handling-measured-star-presentation.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

  let THREE = null;
  let running = false;
  const wheelGroups = new Map();
  let scaledWheelCount = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function adapter() {
    return global.Labeler3DBottleHandlingAdapter || null;
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function appState() {
    try {
      if (typeof state !== "undefined" && state && typeof state === "object") return state;
    } catch {
      // Fall through to window mirror only in isolated environments.
    }
    return global.state && typeof global.state === "object" ? global.state : null;
  }

  function wheelKeyForObject(object) {
    const name = String(object?.name || "");
    if (name === "ServoForgeInfeedStar") return "infeed";
    if (name === "ServoForgeIntermediateStar") return "intermediate";
    if (name === "ServoForgeDischargeStar") return "discharge";
    return null;
  }

  function starPlate(group) {
    return group?.children?.find((child) => /Plate$/.test(String(child?.name || "")) && child?.isMesh) || null;
  }

  function geometryOuterRadius(mesh) {
    const geometry = mesh?.geometry;
    if (!geometry) return 0;
    geometry.computeBoundingBox?.();
    const box = geometry.boundingBox;
    if (!box) return 0;
    return Math.max(
      Math.abs(number(box.min?.x)),
      Math.abs(number(box.max?.x)),
      Math.abs(number(box.min?.z)),
      Math.abs(number(box.max?.z))
    );
  }

  function currentHandling() {
    const sharedHandling = global.Labeler3DBottleHandlingViewport?.latestSnapshot?.();
    if (sharedHandling) return sharedHandling;
    const activeRuntime = runtime();
    const handlingAdapter = adapter();
    if (!activeRuntime?.snapshot || !handlingAdapter?.snapshot) return null;
    const sceneSnapshot = activeRuntime.latestSnapshot?.() || activeRuntime.snapshot({
      scene: {
        tableY: 0.20,
        bottleLift: 0.155,
        unitMode: "physical-mm-measured-star-presentation"
      }
    });
    const current = appState() || {};
    return handlingAdapter.snapshot(
      sceneSnapshot?.scene?.carousel?.machineAngleDegrees,
      sceneSnapshot.geometry,
      {
        carouselDirection: String(current.direction || "ccw"),
        zeroAngleDegrees: number(current.zeroAngle, 0)
      }
    );
  }

  function applyMeasuredOuterDiameter() {
    let handling;
    try {
      handling = currentHandling();
    } catch {
      return;
    }
    if (!handling?.layout?.wheels) return;

    wheelGroups.forEach((group, key) => {
      const wheel = handling.layout.wheels[key];
      const plate = starPlate(group);
      if (!wheel || !plate) return;
      const targetRadius = number(wheel.outerRadiusWorld);
      if (!(targetRadius > 0)) return;

      const nominalRadius = geometryOuterRadius(plate);
      if (!(nominalRadius > 0)) return;
      const scaleFactor = targetRadius / nominalRadius;
      if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return;

      plate.scale.x = scaleFactor;
      plate.scale.z = scaleFactor;
      plate.userData.measuredOuterDiameterMm = number(wheel.outerDiameterMm, 600);
      plate.userData.measuredOuterRadiusWorld = targetRadius;
      plate.userData.measurementAuthority = "user-measured-600mm-end-to-end";
      group.userData.measuredOuterDiameterMm = number(wheel.outerDiameterMm, 600);
      group.userData.measuredStarPresentation = true;
      scaledWheelCount += 1;
    });
  }

  function loop() {
    if (!running) return;
    applyMeasuredOuterDiameter();
  }

  function startLoop() {
    if (running) return;
    const coordinator = global.Labeler3DPresentationFrameCoordinator;
    if (!coordinator?.register) {
      console.warn("ServoForge 3D presentation frame coordinator is unavailable.");
      return;
    }
    running = true;
    coordinator.register(PATCH_VERSION, loop, { minIntervalMs: 250 });
  }

  import(THREE_MODULE_URL).then((module) => {
    THREE = module;
    const prototype = THREE.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeMeasuredStarPresentationV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgeMeasuredStarPresentationAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        const key = wheelKeyForObject(object);
        if (key) {
          wheelGroups.set(key, object);
          startLoop();
        }
      });
      return result;
    };
    Object.defineProperty(prototype, "__servoforgeMeasuredStarPresentationV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }).catch((error) => {
    console.error("ServoForge measured star presentation failed", error);
  });

  global.Labeler3DBottleHandlingMeasuredStarPresentation = Object.freeze({
    PATCH_VERSION,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        wheelGroups: wheelGroups.size,
        scaledWheelCount,
        measuredOuterDiameterMm: 600,
        readOnly: true
      });
    }
  });
})(window);

