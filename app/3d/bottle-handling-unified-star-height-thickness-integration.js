(function installServoForge3DUnifiedStarHeightThickness(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-bottle-handling-unified-star-height-thickness.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

  const STAR_THICKNESS_MM = 80;
  const STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM = 30;
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const BOTTLE_BASE_Y = TABLE_Y + BOTTLE_LIFT;

  let THREE = null;
  let running = false;
  const wheelGroups = new Map();
  let adjustedWheelCount = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
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

  function starHub(group) {
    return group?.children?.find((child) => /Hub$/.test(String(child?.name || "")) && child?.isMesh) || null;
  }

  function unitsPerMm() {
    try {
      const snapshot = runtime()?.snapshot?.({
        scene: {
          tableY: TABLE_Y,
          bottleLift: BOTTLE_LIFT,
          unitMode: "physical-mm-unified-star-height-thickness"
        }
      });
      return Math.max(0.000001, number(snapshot?.geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
    } catch {
      return 2.55 / 572.958;
    }
  }

  function geometryHeight(mesh) {
    const geometry = mesh?.geometry;
    if (!geometry) return 0;
    geometry.computeBoundingBox?.();
    const box = geometry.boundingBox;
    if (!box) return 0;
    return Math.max(0, number(box.max?.y) - number(box.min?.y));
  }

  function enforceWheel(group, key, scale) {
    if (!group?.parent) {
      wheelGroups.delete(key);
      return;
    }

    const thicknessWorld = STAR_THICKNESS_MM * scale;
    const centerAboveBottleBaseMm = STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM + STAR_THICKNESS_MM / 2;
    const centerY = BOTTLE_BASE_Y + centerAboveBottleBaseMm * scale;
    const topFaceAboveBottleBaseMm = STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM + STAR_THICKNESS_MM;

    // Every handling star shares this exact vertical center. This final layer
    // intentionally runs after the earlier star presentation layers so the
    // infeed, intermediate, and discharge stars cannot drift vertically apart.
    group.position.y = centerY;
    group.userData.unifiedStarHeight = true;
    group.userData.starThicknessMm = STAR_THICKNESS_MM;
    group.userData.starBottomFaceAboveBottleBaseMm = STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM;
    group.userData.starTopFaceAboveBottleBaseMm = topFaceAboveBottleBaseMm;
    group.userData.starCenterAboveBottleBaseMm = centerAboveBottleBaseMm;
    group.userData.sharedVerticalAuthority = "user-requested-all-three-stars-same-height";
    group.userData.padCollisionAvoidance = "star-lower-face-raised-above-bottle-pad-plane";

    const plate = starPlate(group);
    if (plate) {
      const nominalHeight = geometryHeight(plate);
      if (nominalHeight > 1e-9) {
        plate.scale.y = thicknessWorld / nominalHeight;
      }
      plate.userData.starThicknessMm = STAR_THICKNESS_MM;
      plate.userData.starThicknessAuthority = "user-requested-increased-common-thickness";
      plate.userData.sharedVerticalCenterY = centerY;
    }

    // Keep the visible center hub inside the same 80 mm envelope instead of
    // leaving it at the older thinner presentation height.
    const hub = starHub(group);
    if (hub) {
      const nominalHubHeight = geometryHeight(hub);
      if (nominalHubHeight > 1e-9) {
        hub.scale.y = Math.min(1, thicknessWorld / nominalHubHeight);
      }
      hub.position.y = 0;
      hub.userData.sharedVerticalCenterY = centerY;
    }

    adjustedWheelCount += 1;
  }

  function enforceAllStars() {
    const scale = unitsPerMm();
    ["infeed", "intermediate", "discharge"].forEach((key) => {
      const group = wheelGroups.get(key);
      if (group) enforceWheel(group, key, scale);
    });
  }

  function loop() {
    if (!running) return;
    enforceAllStars();
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
    if (!prototype || prototype.__servoforgeUnifiedStarHeightThicknessV1) return;

    const nativeAdd = prototype.add;
    prototype.add = function servoforgeUnifiedStarHeightThicknessAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        const key = wheelKeyForObject(object);
        if (!key) return;
        wheelGroups.set(key, object);
        startLoop();
      });
      return result;
    };

    Object.defineProperty(prototype, "__servoforgeUnifiedStarHeightThicknessV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }).catch((error) => {
    console.error("ServoForge unified star height/thickness integration failed", error);
  });

  global.Labeler3DBottleHandlingUnifiedStarHeightThickness = Object.freeze({
    PATCH_VERSION,
    STAR_THICKNESS_MM,
    STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        starThicknessMm: STAR_THICKNESS_MM,
        lowerFaceAboveBottleBaseMm: STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM,
        centerAboveBottleBaseMm: STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM + STAR_THICKNESS_MM / 2,
        wheelGroups: wheelGroups.size,
        adjustedWheelCount,
        allThreeStarsShareVerticalCenter: true,
        readOnly: true
      });
    }
  });
})(window);
