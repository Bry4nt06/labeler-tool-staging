(function installServoForge3DFreeRoamCameraCapture(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.3d-free-roam-camera-capture.v2";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const MOVE_SPEED = 4.2;
  const FAST_MOVE_SPEED = 10.5;
  const LOOK_SENSITIVITY = 0.0045;

  let THREE = null;
  let installed = false;
  let activeCamera = null;
  let capturedFrames = 0;
  let movementFrames = 0;
  let frameId = null;
  let lastFrameTime = 0;
  let wasFreeRoamActive = false;
  let dragging = false;
  let dragPointerId = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let yaw = 0;
  let pitch = 0;

  const pressedKeys = new Set();
  const pointerKeys = new Map();

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function viewportVisible() {
    const backdrop = global.document?.querySelector?.("#servoforge3dBackdrop");
    return Boolean(backdrop && !backdrop.hidden);
  }

  function freeRoamActive() {
    const button = global.document?.querySelector?.("#servoforge3dFreeRoam");
    return viewportVisible() && button?.getAttribute("aria-pressed") === "true";
  }

  function eventHitsCanvas(event) {
    const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
    return path.some((entry) => entry?.id === "servoforge3dCanvas");
  }

  function freeKeyFromEvent(event) {
    const codeMap = {
      KeyW: "w",
      KeyA: "a",
      KeyS: "s",
      KeyD: "d",
      KeyQ: "q",
      KeyE: "e",
      ShiftLeft: "shift",
      ShiftRight: "shift"
    };
    return codeMap[event?.code] || null;
  }

  function freeKeyButtonFromEvent(event) {
    const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
    return path.find((entry) => entry?.dataset?.freeKey) || null;
  }

  function captureCameraPrototype(THREERef) {
    const prototype = THREERef.Camera?.prototype;
    if (!prototype?.updateMatrixWorld) return false;
    if (prototype.__servoforgeFreeRoamCameraCaptureV2) {
      installed = true;
      return true;
    }

    const nativeUpdateMatrixWorld = prototype.updateMatrixWorld;
    prototype.updateMatrixWorld = function servoforgeFreeRoamCameraCapture(force) {
      const result = nativeUpdateMatrixWorld.call(this, force);
      if (this?.isCamera && viewportVisible()) {
        activeCamera = this;
        capturedFrames += 1;
      }
      return result;
    };

    Object.defineProperty(prototype, "__servoforgeFreeRoamCameraCaptureV2", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });

    installed = true;
    return true;
  }

  function syncLookFromCamera() {
    if (!THREE || !activeCamera) return false;
    const euler = new THREE.Euler().setFromQuaternion(activeCamera.quaternion, "YXZ");
    pitch = euler.x;
    yaw = euler.y;
    return true;
  }

  function applyLookToCamera() {
    if (!THREE || !activeCamera) return;
    activeCamera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  }

  function applyMovement(deltaSeconds) {
    if (!THREE || !activeCamera || deltaSeconds <= 0) return;
    const speed = pressedKeys.has("shift") ? FAST_MOVE_SPEED : MOVE_SPEED;
    const step = speed * deltaSeconds;
    let changed = false;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(activeCamera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(activeCamera.quaternion);
    forward.y = 0;
    right.y = 0;
    if (forward.lengthSq() > 1e-8) forward.normalize();
    if (right.lengthSq() > 1e-8) right.normalize();

    if (pressedKeys.has("w")) { activeCamera.position.addScaledVector(forward, step); changed = true; }
    if (pressedKeys.has("s")) { activeCamera.position.addScaledVector(forward, -step); changed = true; }
    if (pressedKeys.has("d")) { activeCamera.position.addScaledVector(right, step); changed = true; }
    if (pressedKeys.has("a")) { activeCamera.position.addScaledVector(right, -step); changed = true; }
    if (pressedKeys.has("e")) { activeCamera.position.y += step; changed = true; }
    if (pressedKeys.has("q")) { activeCamera.position.y -= step; changed = true; }

    if (changed) {
      activeCamera.updateMatrix?.();
      activeCamera.updateMatrixWorld?.(true);
      movementFrames += 1;
    }
  }

  function frame(now) {
    frameId = null;
    const active = freeRoamActive();

    if (active && !wasFreeRoamActive) {
      syncLookFromCamera();
      lastFrameTime = Number(now) || global.performance?.now?.() || Date.now();
    }

    if (!active && wasFreeRoamActive) {
      pressedKeys.clear();
      pointerKeys.clear();
      dragging = false;
      dragPointerId = null;
    }

    if (active) {
      const currentTime = Number(now) || global.performance?.now?.() || Date.now();
      const deltaSeconds = clamp((currentTime - lastFrameTime) / 1000, 0, 0.05);
      lastFrameTime = currentTime;
      applyMovement(deltaSeconds);
    }

    wasFreeRoamActive = active;
    frameId = global.requestAnimationFrame(frame);
  }

  function bindInputBridge() {
    global.addEventListener("keydown", (event) => {
      if (!freeRoamActive()) return;
      const tag = String(event.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      const key = freeKeyFromEvent(event);
      if (!key) return;
      event.preventDefault();
      pressedKeys.add(key);
    }, true);

    global.addEventListener("keyup", (event) => {
      const key = freeKeyFromEvent(event);
      if (key) pressedKeys.delete(key);
    }, true);

    global.addEventListener("pointerdown", (event) => {
      if (!freeRoamActive()) return;

      const keyButton = freeKeyButtonFromEvent(event);
      if (keyButton) {
        const key = String(keyButton.dataset.freeKey || "").toLowerCase();
        if (key) {
          pressedKeys.add(key);
          pointerKeys.set(event.pointerId, key);
        }
        return;
      }

      if (!eventHitsCanvas(event) || event.button !== 0) return;
      dragging = true;
      dragPointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      syncLookFromCamera();
    }, true);

    global.addEventListener("pointermove", (event) => {
      if (!freeRoamActive() || !dragging || event.pointerId !== dragPointerId || !activeCamera) return;
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      yaw -= dx * LOOK_SENSITIVITY;
      pitch = clamp(pitch - dy * LOOK_SENSITIVITY, -Math.PI * 0.49, Math.PI * 0.49);
      applyLookToCamera();
      activeCamera.updateMatrix?.();
      activeCamera.updateMatrixWorld?.(true);
      movementFrames += 1;
    }, true);

    const releasePointer = (event) => {
      const key = pointerKeys.get(event.pointerId);
      if (key) {
        pressedKeys.delete(key);
        pointerKeys.delete(event.pointerId);
      }
      if (event.pointerId === dragPointerId) {
        dragging = false;
        dragPointerId = null;
      }
    };
    global.addEventListener("pointerup", releasePointer, true);
    global.addEventListener("pointercancel", releasePointer, true);

    global.addEventListener("wheel", (event) => {
      if (!freeRoamActive() || !activeCamera || !THREE || !eventHitsCanvas(event)) return;
      event.preventDefault();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(activeCamera.quaternion).normalize();
      const amount = clamp(-Number(event.deltaY || 0) * 0.0025, -1.25, 1.25);
      activeCamera.position.addScaledVector(forward, amount);
      activeCamera.updateMatrix?.();
      activeCamera.updateMatrixWorld?.(true);
      movementFrames += 1;
    }, { capture: true, passive: false });

    global.addEventListener("blur", () => {
      pressedKeys.clear();
      pointerKeys.clear();
      dragging = false;
      dragPointerId = null;
    });
  }

  function status() {
    return Object.freeze({
      integrationVersion: INTEGRATION_VERSION,
      threeVersion: THREE_VERSION,
      installed,
      cameraCaptured: Boolean(activeCamera),
      capturedFrames,
      movementFrames,
      freeRoamActive: freeRoamActive(),
      pressedKeys: [...pressedKeys],
      purpose: "direct-active-camera-free-roam-bridge"
    });
  }

  global.Labeler3DFreeRoamCameraCapture = Object.freeze({
    INTEGRATION_VERSION,
    THREE_VERSION,
    status
  });

  import(THREE_MODULE_URL)
    .then((module) => {
      THREE = module;
      if (!captureCameraPrototype(THREE)) throw new Error("Three.js Camera.updateMatrixWorld is unavailable.");
      bindInputBridge();
      if (frameId === null) frameId = global.requestAnimationFrame(frame);
    })
    .catch((error) => console.error("ServoForge Free Roam direct camera bridge failed", error));
})(window);
