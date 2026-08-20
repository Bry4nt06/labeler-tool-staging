(function installServoForge3DDirectionParityPresentation(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-direction-parity-presentation.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

  let THREE = null;
  let running = false;
  let headLayer = null;
  let handlingLayer = null;
  let carouselTop = null;
  let carouselBody = null;
  let tableTopDirectionMarker = null;
  const wheelGroups = new Map();
  const conveyorGroups = new Map();
  let lastDirection = null;
  let directionChangesApplied = 0;
  let synchronizedFrames = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeDirection(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "cw" || normalized === "clockwise" ? "cw" : "ccw";
  }

  function appState() {
    try {
      if (typeof state !== "undefined" && state && typeof state === "object") return state;
    } catch {
      // Fall through to window state only for isolated environments.
    }
    return global.state && typeof global.state === "object" ? global.state : null;
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function handlingAdapter() {
    return global.Labeler3DBottleHandlingAdapter || null;
  }

  function wheelKeyForObject(object) {
    const name = String(object?.name || "");
    if (name === "ServoForgeInfeedStar") return "infeed";
    if (name === "ServoForgeIntermediateStar") return "intermediate";
    if (name === "ServoForgeDischargeStar") return "discharge";
    return null;
  }

  function conveyorKeyForObject(object) {
    const name = String(object?.name || "");
    if (name === "ServoForgeInfeedConveyor") return "infeed-conveyor";
    if (name === "ServoForgeOutfeedConveyor") return "outfeed-conveyor";
    return null;
  }

  function isCarouselTop(object) {
    if (!object?.isMesh || object?.geometry?.type !== "CylinderGeometry") return false;
    const color = object?.material?.color?.getHex?.();
    return color === 0x35434a && Math.abs(number(object?.position?.y) - 0.218) < 0.03;
  }

  function isCarouselBody(object) {
    if (!object?.isMesh || object?.geometry?.type !== "CylinderGeometry") return false;
    const color = object?.material?.color?.getHex?.();
    return color === 0x202b31 && Math.abs(number(object?.position?.y) - 0.10) < 0.04;
  }

  function ensureTableTopDirectionMarker() {
    if (!THREE || !carouselTop || tableTopDirectionMarker) return;
    const marker = new THREE.Group();
    marker.name = "ServoForgeCarouselTopDirectionReference";
    marker.userData.presentationOnly = true;
    marker.userData.directionParityReference = true;

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, 0.025, 0.035),
      new THREE.MeshBasicMaterial({ color: 0xff6a3d })
    );
    bar.position.set(0.70, 0.045, 0);
    marker.add(bar);

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.12, 18),
      new THREE.MeshBasicMaterial({ color: 0xffb08f })
    );
    tip.rotation.z = -Math.PI / 2;
    tip.position.set(0.85, 0.045, 0);
    marker.add(tip);

    carouselTop.add(marker);
    tableTopDirectionMarker = marker;
  }

  function syncHeadPopulation(snapshot) {
    if (!headLayer) return;
    const heads = snapshot?.carousel?.heads || [];
    heads.forEach((head, index) => {
      const assembly = headLayer.children?.[index];
      if (!assembly) return;
      assembly.position.set(
        number(head.position?.x),
        number(head.position?.y, 0.20),
        number(head.position?.z)
      );
      assembly.rotation.y = number(head.rotationY);
      assembly.userData.carouselDirection = normalizeDirection(snapshot?.carousel?.carouselDirection || appState()?.direction);
    });
  }

  function syncCarouselTop(snapshot, direction) {
    const mechanicalRotationY = number(snapshot?.scene?.carousel?.rotationY);
    if (carouselTop) {
      carouselTop.rotation.y = mechanicalRotationY;
      carouselTop.userData.carouselDirection = direction;
      ensureTableTopDirectionMarker();
    }
    if (carouselBody) {
      carouselBody.rotation.y = mechanicalRotationY;
      carouselBody.userData.carouselDirection = direction;
    }
  }

  function syncWheel(key, wheel, handling) {
    const group = wheelGroups.get(key);
    if (!group || !wheel) return;
    group.position.x = number(wheel.center?.x);
    group.position.z = number(wheel.center?.z);

    const reference = number(wheel.referencePocketAngleRadians, number(group.userData.referencePocketAngleRadians));
    group.userData.referencePocketAngleRadians = reference;
    group.userData.carouselDirection = handling.carouselDirection || handling.layout?.carouselDirection || null;
    group.userData.pocketPhaseAuthority = wheel.pocketPhaseAuthority || group.userData.pocketPhaseAuthority;

    const directionSign = number(wheel.routeDirectionSign, 1) >= 0 ? 1 : -1;
    const pocketPitchRadians = Math.max(0.000001, Math.abs(number(wheel.pocketPitchRadians, Math.PI * 2 / Math.max(3, number(wheel.pocketCount, 16)))));
    const worldPocketAngle = reference + directionSign * number(handling.feedPhasePitch) * pocketPitchRadians;
    group.rotation.y = -worldPocketAngle;
  }

  function syncConveyor(owner, segment) {
    const group = conveyorGroups.get(owner);
    if (!group || !segment?.start || !segment?.end) return;
    const startX = number(segment.start.x);
    const startZ = number(segment.start.z);
    const endX = number(segment.end.x);
    const endZ = number(segment.end.z);
    const dx = endX - startX;
    const dz = endZ - startZ;
    group.position.x = (startX + endX) / 2;
    group.position.z = (startZ + endZ) / 2;
    group.rotation.y = Math.atan2(-dz, dx);
    group.userData.directionParitySynchronized = true;
  }

  function syncHandling(handling) {
    if (!handling?.layout) return;
    Object.entries(handling.layout.wheels || {}).forEach(([key, wheel]) => syncWheel(key, wheel, handling));
    (handling.layout.segments || []).forEach((segment) => {
      if (segment.owner === "infeed-conveyor" || segment.owner === "outfeed-conveyor") {
        syncConveyor(segment.owner, segment);
      }
    });
    if (handlingLayer) {
      handlingLayer.userData.carouselDirection = handling.carouselDirection || handling.layout.carouselDirection;
      handlingLayer.userData.directionParitySynchronized = true;
    }
  }

  function currentSnapshots() {
    const activeRuntime = runtime();
    const adapter = handlingAdapter();
    if (!activeRuntime?.snapshot || !adapter?.snapshot) return null;
    const sceneSnapshot = activeRuntime.latestSnapshot?.() || activeRuntime.snapshot({
      scene: {
        tableY: 0.20,
        bottleLift: 0.155,
        unitMode: "physical-mm-direction-parity"
      }
    });
    const current = appState() || {};
    const direction = normalizeDirection(current.direction || sceneSnapshot?.carousel?.carouselDirection || "ccw");
    const handling = adapter.snapshot(
      sceneSnapshot?.scene?.carousel?.machineAngleDegrees,
      sceneSnapshot.geometry,
      {
        carouselDirection: direction,
        zeroAngleDegrees: number(current.zeroAngle, 0)
      }
    );
    return { sceneSnapshot, handling, direction };
  }

  function synchronizeFrame() {
    let snapshots;
    try {
      snapshots = currentSnapshots();
    } catch {
      return;
    }
    if (!snapshots) return;
    const { sceneSnapshot, handling, direction } = snapshots;
    if (lastDirection !== null && lastDirection !== direction) directionChangesApplied += 1;
    lastDirection = direction;

    syncHeadPopulation(sceneSnapshot);
    syncCarouselTop(sceneSnapshot, direction);
    syncHandling(handling);
    synchronizedFrames += 1;
  }

  function loop() {
    if (!running) return;
    synchronizeFrame();
  }

  function startLoop() {
    if (running) return;
    const coordinator = global.Labeler3DPresentationFrameCoordinator;
    if (!coordinator?.register) {
      console.warn("ServoForge 3D presentation frame coordinator is unavailable.");
      return;
    }
    running = true;
    coordinator.register(PATCH_VERSION, loop, { minIntervalMs: 32 });
  }

  import(THREE_MODULE_URL).then((module) => {
    THREE = module;
    const prototype = THREE.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeDirectionParityPresentationV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgeDirectionParityAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        if (object?.name === "ServoForgeBottleTablePopulation") headLayer = object;
        if (object?.name === "ServoForgeBottleHandlingSystem") handlingLayer = object;

        const wheelKey = wheelKeyForObject(object);
        if (wheelKey) wheelGroups.set(wheelKey, object);

        const conveyorKey = conveyorKeyForObject(object);
        if (conveyorKey) conveyorGroups.set(conveyorKey, object);

        if (isCarouselTop(object)) {
          carouselTop = object;
          object.name = object.name || "ServoForgeCarouselTop";
          ensureTableTopDirectionMarker();
        }
        if (isCarouselBody(object)) {
          carouselBody = object;
          object.name = object.name || "ServoForgeCarouselBody";
        }

        if (headLayer || handlingLayer || wheelKey || conveyorKey || carouselTop) startLoop();
      });
      return result;
    };
    Object.defineProperty(prototype, "__servoforgeDirectionParityPresentationV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }).catch((error) => {
    console.error("ServoForge 3D direction parity presentation failed", error);
  });

  global.Labeler3DDirectionParityPresentation = Object.freeze({
    PATCH_VERSION,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        lastDirection,
        directionChangesApplied,
        synchronizedFrames,
        wheelGroups: wheelGroups.size,
        conveyorGroups: conveyorGroups.size,
        headLayerCaptured: Boolean(headLayer),
        carouselTopCaptured: Boolean(carouselTop),
        tableTopDirectionMarkerVisible: Boolean(tableTopDirectionMarker),
        readOnly: true
      });
    }
  });
})(window);
