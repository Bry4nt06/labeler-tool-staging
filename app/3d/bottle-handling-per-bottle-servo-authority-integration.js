(function installServoForge3DPerBottleServoAuthority(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-per-bottle-servo-authority.v1";
  const baseViewport = global.Labeler3DBottleHandlingViewport;
  const frameDriver = global.Labeler3DSimulationFrameDriver;
  const sceneAdapter = global.Labeler3DSceneAdapter;

  if (!baseViewport?.sync || !baseViewport?.getLayer || !frameDriver?.prepare || !frameDriver?.snapshotPrepared || !sceneAdapter?.mapRadiansToThreeRotationY) {
    throw new Error("ServoForge per-bottle servo authority requires the active bottle-handling viewport, simulation frame driver, and scene adapter.");
  }

  let THREE = null;
  let threePromise = null;
  let preparedProgram = null;
  let preparedSignature = "";
  let correctedBottleCount = 0;
  let correctedFrameCount = 0;
  let lastServoAngles = [];
  let replayFallbackCount = 0;

  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function ensureThree() {
    if (THREE) return Promise.resolve(THREE);
    if (!threePromise) threePromise = import(THREE_MODULE_URL).then((module) => (THREE = module));
    return threePromise;
  }

  function appState() {
    try {
      if (typeof state !== "undefined" && state && typeof state === "object") return state;
    } catch {}
    return global.state && typeof global.state === "object" ? global.state : null;
  }

  function programRows() {
    const current = appState();
    return Array.isArray(current?.program) ? current.program : [];
  }

  function programSignature(rows) {
    return (rows || []).map((row, index) => [
      row?.hmi ?? index + 1,
      row?.plc ?? index,
      row?.command,
      row?.tableStart,
      row?.tableEnd,
      row?.plateStart,
      row?.plateEnd,
      row?.eventId,
      row?.processId
    ].join(":")).join("|");
  }

  function preparedReplay() {
    const rows = programRows();
    const signature = programSignature(rows);
    if (!preparedProgram || preparedSignature !== signature) {
      preparedProgram = frameDriver.prepare(rows, {
        commandDriver: global.LabelerServoCommandDriver || null
      });
      preparedSignature = signature;
    }
    return preparedProgram;
  }

  function directionSign(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "cw" || normalized === "clockwise" ? -1 : 1;
  }

  function servoRotationForTableAngle(tableAngleDegrees, handling, snapshot) {
    const fallback = number(snapshot?.scene?.bottle?.servoRotationY, 0);
    if (!Number.isFinite(Number(tableAngleDegrees))) return fallback;

    try {
      const prepared = preparedReplay();
      if (!prepared?.frames?.length) return fallback;
      const replayFrame = frameDriver.snapshotPrepared(prepared, Number(tableAngleDegrees));
      const servoAngleUnwrapped = number(replayFrame?.container?.servoAngleUnwrapped, 0);
      const direction = handling?.layout?.carouselDirection
        || appState()?.direction
        || "ccw";
      const servoMapRadians = servoAngleUnwrapped * Math.PI / 180 * directionSign(direction);
      return sceneAdapter.mapRadiansToThreeRotationY(servoMapRadians);
    } catch (error) {
      replayFallbackCount += 1;
      if (replayFallbackCount <= 3) {
        console.warn("ServoForge per-bottle servo replay fell back to the active shared servo angle.", error);
      }
      return fallback;
    }
  }

  function handlingBottleGroups(layer) {
    return (layer?.children || [])
      .filter((child) => child?.userData?.handlingBottle)
      .sort((left, right) => {
        const leftIndex = number(String(left?.name || "").match(/(\d+)$/)?.[1], 0);
        const rightIndex = number(String(right?.name || "").match(/(\d+)$/)?.[1], 0);
        return leftIndex - rightIndex;
      });
  }

  function bottleInstanceMeshes(layer) {
    const meshes = [];
    layer?.traverse?.((child) => {
      if (child?.userData?.handlingBottleInstances) meshes.push(child);
    });
    return meshes;
  }

  function applyPerBottleServo(snapshot) {
    if (!THREE) return false;

    const layer = baseViewport.getLayer?.();
    const handling = baseViewport.latestSnapshot?.() || baseViewport.latestHandlingSnapshot?.();
    if (!layer || !handling?.bottles?.length) return false;

    const groups = handlingBottleGroups(layer);
    const instanceMeshes = bottleInstanceMeshes(layer);
    if (!groups.length || !instanceMeshes.length) return false;

    const oldBottleMatrix = new THREE.Matrix4();
    const inverseOldBottleMatrix = new THREE.Matrix4();
    const delta = new THREE.Matrix4();
    const currentInstanceMatrix = new THREE.Matrix4();
    const correctedInstanceMatrix = new THREE.Matrix4();
    const angles = [];
    let corrected = 0;

    const count = Math.min(groups.length, handling.bottles.length);
    for (let index = 0; index < count; index += 1) {
      const bottle = groups[index];
      const point = handling.bottles[index];
      if (String(point?.owner || "") !== "carousel") continue;

      const routeRotationY = number(point?.routeRotationY, 0);
      const servoRotationY = servoRotationForTableAngle(point?.tableAngleDegrees, handling, snapshot);
      const targetRotationY = routeRotationY + servoRotationY;
      angles.push(Object.freeze({
        index,
        tableAngleDegrees: number(point?.tableAngleDegrees, 0),
        servoRotationY,
        targetRotationY
      }));

      bottle.updateMatrix();
      oldBottleMatrix.copy(bottle.matrix);
      if (Math.abs(number(bottle.rotation?.y) - targetRotationY) < 1e-10) {
        bottle.userData.servoAuthority = PATCH_VERSION;
        bottle.userData.perBottleServoReplay = true;
        continue;
      }

      bottle.rotation.y = targetRotationY;
      bottle.userData.servoAuthority = PATCH_VERSION;
      bottle.userData.perBottleServoReplay = true;
      bottle.userData.servoTableAngleDegrees = number(point?.tableAngleDegrees, 0);
      bottle.updateMatrix();

      inverseOldBottleMatrix.copy(oldBottleMatrix).invert();
      delta.multiplyMatrices(bottle.matrix, inverseOldBottleMatrix);

      instanceMeshes.forEach((mesh) => {
        if (index >= mesh.count) return;
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
    lastServoAngles = angles;
    return true;
  }

  function sync(snapshot) {
    const result = baseViewport.sync(snapshot);
    if (!result) return result;

    if (!THREE) {
      ensureThree().then(() => applyPerBottleServo(snapshot)).catch((error) => {
        console.warn("ServoForge per-bottle servo authority could not load Three.js", error);
      });
      return result;
    }

    try {
      applyPerBottleServo(snapshot);
    } catch (error) {
      console.warn("ServoForge per-bottle servo correction skipped one frame; base viewport remains active.", error);
    }
    return result;
  }

  function status() {
    const baseStatus = baseViewport.status?.() || {};
    return Object.freeze({
      ...baseStatus,
      perBottleServoAuthorityVersion: PATCH_VERSION,
      perBottleServoReplay: true,
      servoSource: "ServoForge generated program replay at each carousel bottle table angle",
      sharedServoFallbackOnly: true,
      preparedProgramCached: Boolean(preparedProgram),
      correctedBottleCount,
      correctedFrameCount,
      replayFallbackCount,
      lastServoAngles: Object.freeze([...lastServoAngles]),
      rendererUntouched: true,
      handlingGeometryUntouched: true,
      readOnly: true
    });
  }

  const viewport = Object.freeze({
    ...baseViewport,
    sync,
    status
  });

  global.Labeler3DBottleHandlingViewport = viewport;
  global.Labeler3DPerBottleServoAuthority = Object.freeze({
    PATCH_VERSION,
    status,
    servoRotationForTableAngle
  });

  ensureThree().catch((error) => console.warn("ServoForge per-bottle servo authority preload failed", error));
})(window);
