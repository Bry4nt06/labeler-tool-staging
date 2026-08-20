(function installServoForge3DDashboardTopViewParity(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-dashboard-top-view-parity.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const TOP_VIEW_VERTICAL_RATIO = 4;

  let THREE = null;
  let running = false;
  let aggregateLayer = null;
  let equipmentLayer = null;
  let lastMapId = null;
  let lastMapName = null;
  let lastDirection = null;
  let lastZeroAngleDegrees = null;
  let synchronizedFrames = 0;
  let cameraParityApplications = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function appState() {
    try {
      if (typeof state !== "undefined" && state && typeof state === "object") return state;
    } catch {
      // Fall through to the window mirror for isolated environments.
    }
    return global.state && typeof global.state === "object" ? global.state : null;
  }

  function normalizeDirection(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "cw" || normalized === "clockwise" ? "cw" : "ccw";
  }

  function isServoForgeViewportOpen() {
    const backdrop = global.document?.querySelector?.("#servoforge3dBackdrop");
    return Boolean(backdrop && !backdrop.hidden);
  }

  function targetFromLookAtArgs(args) {
    if (args.length === 1 && args[0] && typeof args[0] === "object") {
      return {
        x: number(args[0].x),
        y: number(args[0].y),
        z: number(args[0].z)
      };
    }
    return {
      x: number(args[0]),
      y: number(args[1]),
      z: number(args[2])
    };
  }

  function installDashboardCameraConvention() {
    const prototype = THREE?.PerspectiveCamera?.prototype;
    if (!prototype || prototype.__servoforgeDashboardTopViewParityV1) return;
    const nativeLookAt = prototype.lookAt;

    prototype.lookAt = function servoforgeDashboardParityLookAt(...args) {
      if (isServoForgeViewportOpen() && Math.abs(number(this.fov) - 42) < 0.1) {
        const target = targetFromLookAtArgs(args);
        const dx = number(this.position?.x) - target.x;
        const dy = number(this.position?.y) - target.y;
        const dz = number(this.position?.z) - target.z;
        const horizontal = Math.hypot(dx, dz);
        const vertical = Math.abs(dy);
        const topLike = vertical > Math.max(0.000001, horizontal) * TOP_VIEW_VERTICAL_RATIO;

        // Dashboard/SVG screen convention:
        //   machine/world +X = screen right (0 degrees)
        //   machine/world +Z = screen down  (90 degrees for CCW)
        // An overhead Three.js camera therefore needs screen-up = world -Z.
        if (topLike) {
          this.up?.set?.(0, 0, -1);
          this.userData.servoforgeDashboardTopView = true;
          this.userData.mapScreenRightAxis = "+X";
          this.userData.mapScreenDownAxis = "+Z";
          cameraParityApplications += 1;
        } else {
          this.up?.set?.(0, 1, 0);
          this.userData.servoforgeDashboardTopView = false;
        }
      }
      return nativeLookAt.apply(this, args);
    };

    Object.defineProperty(prototype, "__servoforgeDashboardTopViewParityV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }

  function equipmentRotation(item) {
    const kind = String(item?.kind || "");
    const x = number(item?.position?.x);
    const z = number(item?.position?.z);
    if (kind === "pad" && item?.wipePad) return -Math.atan2(z, x);
    if (kind === "coding" || kind === "sensor") return number(item?.aimRotationY, item?.rotationY);
    return number(item?.rotationY);
  }

  function syncAggregateAssemblies(equipment) {
    if (!aggregateLayer) return;
    const items = Array.isArray(equipment?.aggregates) ? equipment.aggregates : [];
    items.forEach((item, index) => {
      const assembly = aggregateLayer.children?.[index];
      if (!assembly) return;
      assembly.position.set(number(item?.position?.x), number(assembly.position?.y), number(item?.position?.z));
      assembly.rotation.y = number(item?.flowRotationY, item?.rotationY);
      assembly.userData.aggregate = item?.aggregate;
      assembly.userData.machineMapAngleDegrees = item?.angleDegrees;
      assembly.userData.dashboardMapFrameSynced = true;
    });
  }

  function syncEquipmentAssemblies(equipment) {
    if (!equipmentLayer) return;
    const items = Array.isArray(equipment?.objects) ? equipment.objects : [];
    items.forEach((item, index) => {
      const assembly = equipmentLayer.children?.[index];
      if (!assembly) return;
      assembly.position.set(number(item?.position?.x), number(assembly.position?.y), number(item?.position?.z));
      assembly.rotation.y = equipmentRotation(item);
      assembly.userData.mapObjectId = item?.id;
      assembly.userData.kind = item?.kind;
      assembly.userData.station = item?.station;
      assembly.userData.machineMapAngleDegrees = item?.angleDegrees;
      assembly.userData.machineMapStartDegrees = item?.startDegrees;
      assembly.userData.machineMapEndDegrees = item?.endDegrees;
      assembly.userData.dashboardMapFrameSynced = true;
    });
  }

  function currentSnapshot() {
    const activeRuntime = runtime();
    if (!activeRuntime?.snapshot) return null;
    return activeRuntime.latestSnapshot?.() || activeRuntime.snapshot({
      scene: {
        tableY: 0.20,
        bottleLift: 0.155,
        unitMode: "physical-mm-dashboard-map-parity"
      }
    });
  }

  function synchronizeFrame() {
    let snapshot;
    try {
      snapshot = currentSnapshot();
    } catch {
      return;
    }
    if (!snapshot?.equipment) return;

    syncAggregateAssemblies(snapshot.equipment);
    syncEquipmentAssemblies(snapshot.equipment);

    const current = appState() || {};
    lastMapId = snapshot.equipment.mapId || null;
    lastMapName = snapshot.equipment.mapName || null;
    lastDirection = normalizeDirection(current.direction || "ccw");
    lastZeroAngleDegrees = number(current.zeroAngle, 0);

    if (aggregateLayer) {
      aggregateLayer.userData.activeMachineMapId = lastMapId;
      aggregateLayer.userData.activeMachineMapName = lastMapName;
      aggregateLayer.userData.carouselDirection = lastDirection;
      aggregateLayer.userData.zeroAngleDegrees = lastZeroAngleDegrees;
      aggregateLayer.userData.dashboardMapFrameSynced = true;
    }
    if (equipmentLayer) {
      equipmentLayer.userData.activeMachineMapId = lastMapId;
      equipmentLayer.userData.activeMachineMapName = lastMapName;
      equipmentLayer.userData.carouselDirection = lastDirection;
      equipmentLayer.userData.zeroAngleDegrees = lastZeroAngleDegrees;
      equipmentLayer.userData.dashboardMapFrameSynced = true;
    }
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
    coordinator.register(PATCH_VERSION, loop, { minIntervalMs: 100 });
  }

  import(THREE_MODULE_URL).then((module) => {
    THREE = module;
    installDashboardCameraConvention();

    const prototype = THREE.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeDashboardMapFrameSyncV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgeDashboardMapFrameAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        if (object?.name === "ServoForgePhotoReferencedApplicationAssemblies") aggregateLayer = object;
        if (object?.name === "ServoForgePhotoReferencedMachineHardware") equipmentLayer = object;
        if (aggregateLayer || equipmentLayer) startLoop();
      });
      return result;
    };
    Object.defineProperty(prototype, "__servoforgeDashboardMapFrameSyncV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }).catch((error) => {
    console.error("ServoForge dashboard/3D map parity integration failed", error);
  });

  global.Labeler3DDashboardTopViewParity = Object.freeze({
    PATCH_VERSION,
    TOP_VIEW_VERTICAL_RATIO,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        mapId: lastMapId,
        mapName: lastMapName,
        direction: lastDirection,
        zeroAngleDegrees: lastZeroAngleDegrees,
        aggregateLayerCaptured: Boolean(aggregateLayer),
        equipmentLayerCaptured: Boolean(equipmentLayer),
        synchronizedFrames,
        cameraParityApplications,
        dashboardScreenConvention: "+X-right/+Z-down",
        angularAuthority: "active-machine-map-via-Labeler3DSceneRuntime",
        readOnly: true
      });
    }
  });
})(window);
