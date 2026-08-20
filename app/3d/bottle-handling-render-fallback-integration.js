(function installServoForgeBottleHandlingRenderFallback(global) {
  "use strict";

  const VERSION = "servoforge.3d-bottle-handling-render-fallback.v1";
  const BUILD = "3d-handling-direct-v224-20260820-1101";
  const UPDATED_AT = "Aug 20, 2026 11:01 AM ET";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const LAYER_NAME = "ServoForgeBottleHandlingDirectFallback";
  const TABLE_Y = 0.355;

  let THREE = null;
  let installed = false;
  let activeScene = null;
  let layer = null;
  let bottlePool = [];
  let wheelGroups = new Map();
  let lastSignature = "";
  let visibleBottleCount = 0;
  let starWheelCount = 0;
  let lastError = "";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function publishBuild() {
    global.ServoForgeBootstrapBuild = BUILD;
    global.ServoForgeBootstrapUpdatedAt = UPDATED_AT;
    global.SERVOFORGE_BUILD_ID = BUILD;
    global.SERVOFORGE_BUILD_UPDATED_AT = UPDATED_AT;
    global.ServoForgeStagingBuildBannerAuthorityV2?.enforce?.();
  }

  function adapter() {
    return global.Labeler3DBottleHandlingAdapter || null;
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function currentBottleMode() {
    return String(document.querySelector("#servoforge3dBottleMode")?.value || "all");
  }

  function disposeObject(object) {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
      const disposeMaterial = (entry) => entry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    });
  }

  function clearLayer() {
    bottlePool = [];
    wheelGroups.clear();
    starWheelCount = 0;
    visibleBottleCount = 0;
    if (layer?.parent) layer.parent.remove(layer);
    if (layer) disposeObject(layer);
    layer = null;
    lastSignature = "";
  }

  function bottleProfile(geometry) {
    const supplied = geometry?.bottle?.profilePointsWorld;
    if (Array.isArray(supplied) && supplied.length >= 4) {
      return supplied.map((point) => new THREE.Vector2(number(point.radius), number(point.y)));
    }
    return [[0.27,0],[0.31,0.18],[0.31,1.02],[0.18,1.37],[0.12,1.85],[0.13,1.90]]
      .map(([radius, y]) => new THREE.Vector2(radius, y));
  }

  function createBottle(index, geometry) {
    const profile = bottleProfile(geometry);
    const bodyRadius = Math.max(...profile.map((point) => point.x));
    const height = Math.max(...profile.map((point) => point.y));
    const unitsPerMm = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.00445));
    const finishRadius = number(geometry?.bottle?.finishOuterDiameterMm, 26.6) * unitsPerMm / 2;
    const group = new THREE.Group();
    group.name = `ServoForgeDirectHandlingBottle${index + 1}`;
    group.userData.handlingBottle = true;
    group.userData.directFallback = VERSION;

    const body = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 36),
      new THREE.MeshStandardMaterial({ color: 0x70401f, roughness: 0.27, metalness: 0.02 })
    );
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const capHeight = Math.max(0.024, 6 * unitsPerMm);
    const capRadius = Math.max(finishRadius * 1.08, bodyRadius * 0.20);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(capRadius, capRadius, capHeight, 20),
      new THREE.MeshStandardMaterial({ color: 0x3387c8, roughness: 0.32, metalness: 0.42 })
    );
    cap.position.y = height + capHeight / 2;
    group.add(cap);

    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.009, bodyRadius * 0.07), Math.max(0.18, height * 0.32), Math.max(0.022, bodyRadius * 0.20)),
      new THREE.MeshStandardMaterial({ color: 0xff6a3d, emissive: 0x421308, emissiveIntensity: 0.45, roughness: 0.35 })
    );
    marker.position.set(bodyRadius * 1.04, height * 0.30, 0);
    group.add(marker);
    return group;
  }

  function createStarGeometry(wheel, bottleRadius) {
    const outerRadius = wheel.pitchRadiusWorld + bottleRadius * 0.70;
    const pocketDepth = Math.max(bottleRadius * 0.78, outerRadius * 0.08);
    const shape = new THREE.Shape();
    const samples = Math.max(160, wheel.pocketCount * 24);
    for (let index = 0; index <= samples; index += 1) {
      const theta = index / samples * Math.PI * 2;
      const pocketWave = Math.pow(Math.max(0, Math.cos(theta * wheel.pocketCount)), 6);
      const radius = outerRadius - pocketDepth * pocketWave;
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * radius;
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const thickness = Math.max(0.05, bottleRadius * 0.32);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 2 });
    geometry.translate(0, 0, -thickness / 2);
    geometry.rotateX(Math.PI / 2);
    return { geometry, thickness };
  }

  function createStar(key, wheel, bottleRadius) {
    const group = new THREE.Group();
    group.name = `ServoForgeDirectStar-${key}`;
    group.position.set(number(wheel.center?.x), 0.285, number(wheel.center?.z));
    group.userData.handlingWheel = key;
    const star = createStarGeometry(wheel, bottleRadius);
    const plate = new THREE.Mesh(
      star.geometry,
      new THREE.MeshStandardMaterial({ color: 0xd4d9da, roughness: 0.42, metalness: 0.24 })
    );
    plate.castShadow = true;
    plate.receiveShadow = true;
    group.add(plate);
    const hubRadius = Math.max(bottleRadius * 0.65, wheel.pitchRadiusWorld * 0.16);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(hubRadius, hubRadius, star.thickness * 1.5, 28),
      new THREE.MeshStandardMaterial({ color: 0x657177, roughness: 0.30, metalness: 0.72 })
    );
    group.add(hub);
    layer.add(group);
    wheelGroups.set(key, group);
  }

  function createConveyor(segment, bottleRadius, name) {
    if (!segment?.start || !segment?.end) return;
    const dx = number(segment.end.x) - number(segment.start.x);
    const dz = number(segment.end.z) - number(segment.start.z);
    const length = Math.max(0.01, Math.hypot(dx, dz));
    const width = Math.max(bottleRadius * 2.25, 0.24);
    const group = new THREE.Group();
    group.name = name;
    group.position.set((number(segment.start.x) + number(segment.end.x)) / 2, 0.25, (number(segment.start.z) + number(segment.end.z)) / 2);
    group.rotation.y = Math.atan2(-dz, dx);
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.045, width),
      new THREE.MeshStandardMaterial({ color: 0x22292d, roughness: 0.72, metalness: 0.10 })
    );
    group.add(belt);
    layer.add(group);
  }

  function sharedServoRotation(handling) {
    const rows = Array.isArray(global.state?.program) ? global.state.program : [];
    const tableAngle = number(global.state?.previewAngle, 0);
    const driver = global.Labeler3DSimulationFrameDriver;
    const sceneAdapter = global.Labeler3DSceneAdapter;
    if (!driver?.snapshot || !sceneAdapter?.toSceneState || !rows.length) return 0;
    try {
      const frame = driver.snapshot(rows, tableAngle, { commandDriver: global.LabelerServoCommandDriver });
      const sceneState = sceneAdapter.toSceneState(frame, {
        carouselRadius: handling.layout.carouselRadius,
        carouselDirection: handling.layout.carouselDirection,
        zeroAngleDegrees: handling.layout.zeroAngleDegrees
      });
      return number(sceneState?.bottle?.rotation?.y, 0);
    } catch {
      return 0;
    }
  }

  function signature(snapshot, handling) {
    return [handling?.bottleCount, handling?.layout?.headCount, handling?.layout?.centerSpacingMm, snapshot?.geometry?.bottle?.effectiveDiameterMm].join("|");
  }

  function rebuild(snapshot, handling) {
    if (!layer) return;
    while (layer.children.length) {
      const child = layer.children[0];
      layer.remove(child);
      disposeObject(child);
    }
    bottlePool = [];
    wheelGroups.clear();

    const profile = bottleProfile(snapshot.geometry);
    const bottleRadius = Math.max(...profile.map((point) => point.x));
    Object.entries(handling.layout.wheels || {}).forEach(([key, wheel]) => createStar(key, wheel, bottleRadius));
    const infeed = handling.layout.segments?.find((segment) => segment.owner === "infeed-conveyor");
    const outfeed = handling.layout.segments?.find((segment) => segment.owner === "outfeed-conveyor");
    createConveyor(infeed, bottleRadius, "ServoForgeDirectInfeedConveyor");
    createConveyor(outfeed, bottleRadius, "ServoForgeDirectOutfeedConveyor");
    for (let index = 0; index < handling.bottleCount; index += 1) {
      const bottle = createBottle(index, snapshot.geometry);
      layer.add(bottle);
      bottlePool.push(bottle);
    }
    starWheelCount = wheelGroups.size;
  }

  function update(snapshot, handling) {
    const rotationY = sharedServoRotation(handling);
    const mode = currentBottleMode();
    let visible = 0;
    bottlePool.forEach((bottle, index) => {
      const point = handling.bottles[index];
      const show = mode === "all" && Boolean(point);
      bottle.visible = show;
      if (!point) return;
      if (show) visible += 1;
      bottle.position.set(number(point.position?.x), TABLE_Y, number(point.position?.z));
      bottle.rotation.y = rotationY;
      bottle.userData.owner = point.owner;
      bottle.userData.segmentId = point.segmentId;
      bottle.userData.servoRotationY = rotationY;
    });
    visibleBottleCount = visible;

    Object.entries(handling.wheels || {}).forEach(([key, wheel]) => {
      const group = wheelGroups.get(key);
      if (!group) return;
      group.rotation.y = -number(wheel.rotationY, 0);
    });
  }

  function attach(scene) {
    if (!scene?.isScene) return false;
    if (scene.getObjectByName?.("ServoForgeBottleHandlingSystem")) {
      if (layer?.parent) clearLayer();
      activeScene = scene;
      return false;
    }
    if (activeScene !== scene || !layer?.parent) {
      clearLayer();
      activeScene = scene;
      layer = new THREE.Group();
      layer.name = LAYER_NAME;
      layer.userData.directBottleHandlingFallback = VERSION;
      scene.add(layer);
    }
    return true;
  }

  function renderInto(scene) {
    try {
      if (!attach(scene) || !layer) return;
      const activeRuntime = runtime();
      const handlingAdapter = adapter();
      if (!activeRuntime?.snapshot || !handlingAdapter?.snapshot) return;
      const snapshot = activeRuntime.snapshot({ scene: { unitMode: "physical-mm-bottle-handling-direct-v1" } });
      const handling = handlingAdapter.snapshot(snapshot?.scene?.carousel?.machineAngleDegrees, snapshot.geometry, {
        carouselDirection: String(global.state?.direction || "ccw"),
        zeroAngleDegrees: number(global.state?.zeroAngle, 0)
      });
      const nextSignature = signature(snapshot, handling);
      if (nextSignature !== lastSignature || bottlePool.length !== handling.bottleCount) {
        lastSignature = nextSignature;
        rebuild(snapshot, handling);
      }
      update(snapshot, handling);
      lastError = "";
    } catch (error) {
      lastError = String(error?.message || error || "unknown error");
      console.warn("ServoForge direct bottle-handling render skipped", error);
    }
  }

  async function install() {
    THREE = await import(THREE_MODULE_URL);
    const prototype = THREE.WebGLRenderer?.prototype;
    if (!prototype || prototype.__servoforgeBottleHandlingRenderFallbackV1) return;
    const nativeRender = prototype.render;
    prototype.render = function servoforgeBottleHandlingRenderFallback(scene, camera) {
      renderInto(scene);
      return nativeRender.call(this, scene, camera);
    };
    Object.defineProperty(prototype, "__servoforgeBottleHandlingRenderFallbackV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
    installed = true;
  }

  publishBuild();
  install().catch((error) => {
    lastError = String(error?.message || error || "install failed");
    console.error("ServoForge direct bottle-handling render fallback failed to install", error);
  });

  global.Labeler3DBottleHandlingRenderFallback = Object.freeze({
    VERSION,
    BUILD,
    status() {
      return Object.freeze({
        version: VERSION,
        installed,
        activeScene: Boolean(activeScene),
        layerAttached: Boolean(layer?.parent),
        bottleCount: bottlePool.length,
        visibleBottleCount,
        starWheelCount,
        bottleMode: currentBottleMode(),
        lastError
      });
    }
  });
})(window);
