(function installServoForge3DHeadOneViewAuthority(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.3d-head-one-view-authority.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const baseViewport = global.Labeler3DBottleHandlingViewport;

  if (!baseViewport?.sync || !baseViewport?.setBottleMode || !baseViewport?.latestSnapshot || !baseViewport?.getLayer) {
    throw new Error("ServoForge Head 1 view authority requires the active bottle-handling viewport.");
  }

  let THREE = null;
  let threePromise = null;
  let bottleMode = "all";
  let lastSceneSnapshot = null;
  let headOneCarrierIndex = -1;
  let headOneBottleVisible = false;
  let maskFrameCount = 0;

  function ensureThree() {
    if (THREE) return Promise.resolve(THREE);
    if (!threePromise) threePromise = import(THREE_MODULE_URL).then((module) => (THREE = module));
    return threePromise;
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeMode(value) {
    const mode = String(value || "all");
    return ["all", "none", "head1"].includes(mode) ? mode : "all";
  }

  function physicalHeadOne(snapshot = lastSceneSnapshot) {
    const heads = Array.isArray(snapshot?.carousel?.heads) ? snapshot.carousel.heads : [];
    return heads.find((head) => Number(head?.head) === 1) || heads[0] || null;
  }

  function carrierHeadOneIndex(handling) {
    return (handling?.bottles || []).findIndex((point) =>
      point?.owner === "carousel" && Number(point?.carrierHead) === 1
    );
  }

  function trackingSnapshot() {
    const handling = baseViewport.latestSnapshot?.();
    const head = physicalHeadOne();
    if (!handling || !head?.position) return handling;

    const trackingPoint = Object.freeze({
      id: "servoforge-head-one-camera-target",
      owner: "carousel",
      carrierHead: 1,
      trackingOnly: true,
      tableAngleDegrees: number(head.tableAngleDegrees, 0),
      position: Object.freeze({
        x: number(head.position.x, 0),
        z: number(head.position.z, 0)
      })
    });

    return Object.freeze({
      ...handling,
      bottles: Object.freeze([trackingPoint, ...(handling.bottles || [])]),
      headOneViewAuthority: Object.freeze({
        source: "carousel-head-1-physical-carrier",
        fullRevolutionCameraTarget: true,
        transportBottleIdentityUsedForCamera: false
      })
    });
  }

  function instanceMeshes(layer) {
    const meshes = [];
    layer?.traverse?.((child) => {
      if (child?.userData?.handlingBottleInstances && child?.isInstancedMesh) meshes.push(child);
    });
    return meshes;
  }

  function applyHeadOneMask() {
    if (!THREE || bottleMode !== "head1") return false;
    const layer = baseViewport.getLayer?.();
    const handling = baseViewport.latestSnapshot?.();
    if (!layer || !handling) return false;

    const selectedIndex = carrierHeadOneIndex(handling);
    const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    const currentMatrix = new THREE.Matrix4();

    instanceMeshes(layer).forEach((mesh) => {
      const count = Math.max(0, Number(mesh.count) || 0);
      for (let index = 0; index < count; index += 1) {
        if (index === selectedIndex) continue;
        mesh.getMatrixAt(index, currentMatrix);
        mesh.setMatrixAt(index, hiddenMatrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });

    headOneCarrierIndex = selectedIndex;
    headOneBottleVisible = selectedIndex >= 0;
    maskFrameCount += 1;
    return true;
  }

  function setBottleMode(mode) {
    bottleMode = normalizeMode(mode);

    // The retired viewport behavior defined Head 1 as the first bottle currently
    // owned by the carousel. Keep the base viewport in all-bottle mode and mask
    // the instanced population here using the real carrierHead === 1 identity.
    if (bottleMode === "head1") {
      baseViewport.setBottleMode("all");
      if (THREE) applyHeadOneMask();
      else ensureThree().then(applyHeadOneMask).catch((error) => {
        console.warn("ServoForge Head 1 bottle mask could not load Three.js", error);
      });
    } else {
      baseViewport.setBottleMode(bottleMode);
      headOneCarrierIndex = -1;
      headOneBottleVisible = false;
    }
    return bottleMode;
  }

  function sync(snapshot) {
    lastSceneSnapshot = snapshot || lastSceneSnapshot;
    const result = baseViewport.sync(snapshot);
    if (!result) return result;

    if (bottleMode === "head1") {
      if (THREE) applyHeadOneMask();
      else ensureThree().then(applyHeadOneMask).catch((error) => {
        console.warn("ServoForge Head 1 bottle mask could not load Three.js", error);
      });
    }
    return result;
  }

  function status() {
    const baseStatus = baseViewport.status?.() || {};
    const head = physicalHeadOne();
    return Object.freeze({
      ...baseStatus,
      headOneViewAuthorityVersion: INTEGRATION_VERSION,
      bottleMode,
      headOneCarrierIndex,
      headOneBottleVisible,
      headOnePhysicalTableAngleDegrees: Number.isFinite(Number(head?.tableAngleDegrees)) ? Number(head.tableAngleDegrees) : null,
      cameraAuthority: "carousel.heads[0]-physical-head-1",
      headOneBottleAuthority: "carrierHead-1",
      firstCarouselBottleShortcutRetired: true,
      fullRevolutionCameraTracking: true,
      maskFrameCount,
      geometryUntouched: true,
      rendererFrameLoopUntouched: true,
      readOnly: true
    });
  }

  global.Labeler3DBottleHandlingViewport = Object.freeze({
    ...baseViewport,
    setBottleMode,
    sync,
    latestSnapshot: trackingSnapshot,
    latestHandlingSnapshot: trackingSnapshot,
    status
  });

  global.Labeler3DHeadOneViewAuthority = Object.freeze({
    INTEGRATION_VERSION,
    physicalHeadOne,
    carrierHeadOneIndex,
    status
  });
})(window);
