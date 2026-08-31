(function installServoForge3DBottleTableOrientationCorrection(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-bottle-table-orientation.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const BOTTLE_BASE_Y = 0.355;

  const baseViewport = global.Labeler3DBottleHandlingViewport;
  if (!baseViewport?.attachScene || !baseViewport?.sync || !baseViewport?.getLayer) {
    throw new Error("ServoForge bottle-table orientation correction requires the active bottle-handling viewport.");
  }

  let THREE = null;
  let threePromise = null;
  let tableRoot = null;
  let tableLayer = null;
  let tableSignature = "";
  let plateInstances = null;
  let plateDummy = null;
  let tableBuildCount = 0;
  let correctedBottleCount = 0;
  let correctedFrameCount = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function ensureThree() {
    if (THREE) return Promise.resolve(THREE);
    if (!threePromise) threePromise = import(THREE_MODULE_URL).then((module) => (THREE = module));
    return threePromise;
  }

  function disposeObject(object) {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
      const disposeMaterial = (entry) => entry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    });
  }

  function removeBottleTable() {
    if (tableRoot) {
      tableRoot.parent?.remove(tableRoot);
      disposeObject(tableRoot);
    }
    tableRoot = null;
    tableLayer = null;
    tableSignature = "";
    plateInstances = null;
    plateDummy = null;
  }

  function bottleTableSignature(snapshot) {
    const geometry = snapshot?.geometry || {};
    return [
      geometry?.machine?.headCount,
      geometry?.machine?.physicalPitchRadiusWorld,
      geometry?.machine?.carouselOuterRadiusWorld,
      geometry?.bottleTable?.plateDiameterWorld,
      geometry?.bottleTable?.centerSpacingWorld,
      geometry?.renderScale?.worldUnitsPerMm
    ].join("|");
  }

  function buildBottleTable(snapshot) {
    if (!THREE) return false;
    const layer = baseViewport.getLayer?.();
    if (!layer) return false;

    const signature = bottleTableSignature(snapshot);
    if (tableRoot && tableLayer === layer && tableSignature === signature) return true;

    removeBottleTable();
    tableLayer = layer;
    tableSignature = signature;

    const geometry = snapshot?.geometry || {};
    const scale = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
    const headCount = Math.max(1, Math.round(number(geometry?.machine?.headCount, 45)));
    const pitchRadius = Math.max(0.5, number(geometry?.machine?.physicalPitchRadiusWorld, 3.5));
    const plateDiameter = Math.max(0.10, number(geometry?.bottleTable?.plateDiameterWorld, 94 * scale));
    const plateRadius = plateDiameter / 2;
    const configuredOuter = number(geometry?.machine?.carouselOuterRadiusWorld, 0);
    const deckRadius = Math.max(
      pitchRadius + plateRadius * 0.86,
      configuredOuter > 0 ? configuredOuter : pitchRadius + plateRadius + 20 * scale
    );

    const plateThickness = Math.max(0.045, 14 * scale);
    const plateTopY = BOTTLE_BASE_Y - Math.max(0.045, 12 * scale);
    const plateCenterY = plateTopY - plateThickness / 2;
    const deckThickness = Math.max(0.10, 28 * scale);
    const deckTopY = plateCenterY - plateThickness / 2 - Math.max(0.008, 2 * scale);
    const deckCenterY = deckTopY - deckThickness / 2;

    tableRoot = new THREE.Group();
    tableRoot.name = "ServoForgeBottleTableAssembly";
    tableRoot.userData.bottleTableAuthority = PATCH_VERSION;
    tableRoot.userData.singleEnvironmentAuthority = true;
    tableRoot.userData.measuredPlateGeometry = true;

    const deckMaterial = new THREE.MeshStandardMaterial({
      color: 0x303b40,
      roughness: 0.38,
      metalness: 0.76
    });
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(deckRadius, deckRadius * 1.012, deckThickness, 96),
      deckMaterial
    );
    deck.name = "ServoForgeBottleTableDeck";
    deck.position.y = deckCenterY;
    deck.castShadow = false;
    deck.receiveShadow = false;
    tableRoot.add(deck);

    const topSkin = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(0.1, deckRadius - Math.max(0.035, 8 * scale)), Math.max(0.1, deckRadius - Math.max(0.035, 8 * scale)), Math.max(0.018, 4 * scale), 96),
      new THREE.MeshStandardMaterial({ color: 0x57656b, roughness: 0.28, metalness: 0.82 })
    );
    topSkin.name = "ServoForgeBottleTableTopSkin";
    topSkin.position.y = deckTopY + Math.max(0.009, 2 * scale);
    topSkin.castShadow = false;
    topSkin.receiveShadow = false;
    tableRoot.add(topSkin);

    const hubRadius = Math.max(0.52, pitchRadius * 0.34);
    const hubHeight = Math.max(0.16, 38 * scale);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(hubRadius, hubRadius * 1.04, hubHeight, 64),
      new THREE.MeshStandardMaterial({ color: 0x182126, roughness: 0.34, metalness: 0.78 })
    );
    hub.name = "ServoForgeBottleTableCenterHub";
    hub.position.y = deckTopY + hubHeight / 2;
    hub.castShadow = false;
    hub.receiveShadow = false;
    tableRoot.add(hub);

    const plateGeometry = new THREE.CylinderGeometry(plateRadius, plateRadius * 1.012, plateThickness, 32);
    const plateMaterial = new THREE.MeshStandardMaterial({ color: 0x7a858a, roughness: 0.24, metalness: 0.90 });
    plateInstances = new THREE.InstancedMesh(plateGeometry, plateMaterial, headCount);
    plateInstances.name = "ServoForgeBottleTablePlatesInstanced";
    plateInstances.userData.bottleTableInstances = "plate";
    plateInstances.userData.plateDiameterMm = number(geometry?.bottleTable?.plateDiameterMm, 94);
    plateInstances.userData.centerSpacingMm = number(geometry?.bottleTable?.centerSpacingMm, 110);
    plateInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    plateInstances.castShadow = false;
    plateInstances.receiveShadow = false;
    plateInstances.frustumCulled = false;
    tableRoot.add(plateInstances);

    plateDummy = new THREE.Object3D();
    plateDummy.userData.plateCenterY = plateCenterY;

    // Insert the table before the bottle/star population so bottles and stars
    // remain visually above the table while still sharing one Three.js scene.
    layer.add(tableRoot);
    tableRoot.renderOrder = -1;
    tableBuildCount += 1;
    return true;
  }

  function updateBottleTable(snapshot) {
    if (!buildBottleTable(snapshot) || !plateInstances || !plateDummy) return false;
    const heads = Array.isArray(snapshot?.carousel?.heads) ? snapshot.carousel.heads : [];
    const count = Math.min(plateInstances.count, heads.length);
    const plateCenterY = number(plateDummy.userData.plateCenterY, 0.27);

    for (let index = 0; index < count; index += 1) {
      const head = heads[index];
      plateDummy.position.set(number(head?.position?.x), plateCenterY, number(head?.position?.z));
      plateDummy.rotation.set(0, number(head?.rotationY), 0);
      plateDummy.scale.set(1, 1, 1);
      plateDummy.updateMatrix();
      plateInstances.setMatrixAt(index, plateDummy.matrix);
    }
    plateInstances.count = count;
    plateInstances.instanceMatrix.needsUpdate = true;
    return true;
  }

  function correctedRotationY(point, snapshot) {
    const routeRotationY = number(point?.routeRotationY, 0);
    if (String(point?.owner || "") !== "carousel") return routeRotationY;

    // Top View authority is:
    //   tableFrameVisualAngle + machineVisualAngle(plateAngle)
    // SceneAdapter already converts both components into Three.js Y rotation,
    // so the equivalent world-frame transform is routeRotationY + servoRotationY.
    const sharedServoRotation = number(snapshot?.scene?.bottle?.servoRotationY, 0);
    return routeRotationY + sharedServoRotation;
  }

  function handlingBottles(layer) {
    return (layer?.children || [])
      .filter((child) => child?.userData?.handlingBottle)
      .sort((left, right) => {
        const leftIndex = number(String(left?.name || "").match(/(\d+)$/)?.[1], 0);
        const rightIndex = number(String(right?.name || "").match(/(\d+)$/)?.[1], 0);
        return leftIndex - rightIndex;
      });
  }

  function bottleInstanceMeshes(layer) {
    const meshes = {};
    layer?.traverse?.((child) => {
      const key = child?.userData?.handlingBottleInstances;
      if (key) meshes[key] = child;
    });
    return meshes;
  }

  function correctBottleOrientations(snapshot) {
    if (!THREE) return false;
    const layer = baseViewport.getLayer?.();
    const handling = baseViewport.latestSnapshot?.() || baseViewport.latestHandlingSnapshot?.();
    if (!layer || !handling?.bottles?.length) return false;

    const bottles = handlingBottles(layer);
    const instances = bottleInstanceMeshes(layer);
    const instanceMeshes = Object.values(instances);
    if (!bottles.length || !instanceMeshes.length) return false;

    const oldBottleMatrix = new THREE.Matrix4();
    const inverseOldBottleMatrix = new THREE.Matrix4();
    const delta = new THREE.Matrix4();
    const currentInstanceMatrix = new THREE.Matrix4();
    const correctedInstanceMatrix = new THREE.Matrix4();
    let corrected = 0;

    const count = Math.min(bottles.length, handling.bottles.length);
    for (let index = 0; index < count; index += 1) {
      const bottle = bottles[index];
      const point = handling.bottles[index];
      const targetRotationY = correctedRotationY(point, snapshot);
      if (!Number.isFinite(targetRotationY)) continue;

      bottle.updateMatrix();
      oldBottleMatrix.copy(bottle.matrix);
      if (Math.abs(number(bottle.rotation?.y) - targetRotationY) < 1e-10) continue;

      bottle.rotation.y = targetRotationY;
      bottle.userData.orientationAuthority = PATCH_VERSION;
      bottle.userData.worldFrameOrientation = String(point?.owner || "") === "carousel";
      bottle.updateMatrix();

      inverseOldBottleMatrix.copy(oldBottleMatrix).invert();
      delta.multiplyMatrices(bottle.matrix, inverseOldBottleMatrix);

      instanceMeshes.forEach((mesh) => {
        mesh.getMatrixAt(index, currentInstanceMatrix);
        correctedInstanceMatrix.multiplyMatrices(delta, currentInstanceMatrix);
        mesh.setMatrixAt(index, correctedInstanceMatrix);
      });
      corrected += 1;
    }

    instanceMeshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
    correctedBottleCount = corrected;
    correctedFrameCount += 1;
    return true;
  }

  async function attachScene(sceneRoot) {
    await ensureThree();
    const attached = await baseViewport.attachScene(sceneRoot);
    tableLayer = baseViewport.getLayer?.() || null;
    return attached;
  }

  function detachScene(sceneRoot) {
    removeBottleTable();
    return baseViewport.detachScene?.(sceneRoot) ?? false;
  }

  function sync(snapshot) {
    const result = baseViewport.sync(snapshot);
    if (!result) return result;
    if (!THREE) {
      ensureThree().catch((error) => console.warn("ServoForge bottle-table correction engine unavailable", error));
      return result;
    }
    updateBottleTable(snapshot);
    correctBottleOrientations(snapshot);
    return result;
  }

  function status() {
    const baseStatus = baseViewport.status?.() || {};
    return Object.freeze({
      ...baseStatus,
      bottleTableCorrectionVersion: PATCH_VERSION,
      bottleTableRendered: Boolean(tableRoot && tableLayer),
      bottleTableSingleEnvironment: true,
      bottleTableInstancedPlates: Boolean(plateInstances),
      bottleTableBuildCount: tableBuildCount,
      orientationMatchesTopViewWorldFrame: true,
      orientationUsesRoutePlusServoOnCarousel: true,
      correctedBottleCount,
      correctedFrameCount,
      performanceModel: "existing-instanced-bottles-plus-instanced-bottle-plates",
      prototypeSceneHook: false,
      readOnly: true
    });
  }

  const correctedViewport = Object.freeze({
    ...baseViewport,
    attachScene,
    attach: attachScene,
    detachScene,
    sync,
    status,
    correctedRotationY
  });

  global.Labeler3DBottleHandlingViewport = correctedViewport;
  global.Labeler3DBottleTableOrientationCorrection = Object.freeze({
    PATCH_VERSION,
    THREE_VERSION,
    correctedRotationY,
    status
  });

  ensureThree().catch((error) => console.warn("ServoForge bottle-table correction engine could not preload", error));
})(window);
