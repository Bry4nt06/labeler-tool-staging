(function installServoForge3DFreeRoamCameraCapture(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.3d-free-roam-camera-capture.v3";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const MOVE_SPEED = 4.2;
  const FAST_MOVE_SPEED = 10.5;
  const LOOK_SENSITIVITY = 0.0045;

  let THREE = null;
  let installed = false;
  let activeCamera = null;
  let desiredPosition = null;
  let desiredQuaternion = null;
  let capturedFrames = 0;
  let authoritativeFrames = 0;
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

  function ensureStatusUi() {
    const copy = global.document?.querySelector?.("#servoforge3dFreeRoamPad .servoforge-3d-free-roam-copy");
    if (!copy) return null;
    let status = global.document.querySelector("#servoforge3dFreeRoamRuntimeStatus");
    if (!status) {
      status = global.document.createElement("small");
      status.id = "servoforge3dFreeRoamRuntimeStatus";
      status.style.color = "#70d9c0";
      status.style.fontWeight = "700";
      status.textContent = "Waiting for 3D camera…";
      copy.appendChild(status);
    }
    return status;
  }

  function updateStatusUi() {
    const status = ensureStatusUi();
    if (!status) return;
    if (!freeRoamActive()) {
      status.textContent = activeCamera ? "Camera linked" : "Waiting for 3D camera…";
      return;
    }
    if (!activeCamera) {
      status.textContent = "Free roam: waiting for camera…";
      status.style.color = "#ffb095";
      return;
    }
    const keys = [...pressedKeys].filter((key) => key !== "shift").map((key) => key.toUpperCase());
    status.textContent = keys.length ? `Free roam linked • moving ${keys.join("+")}` : "Free roam linked • ready";
    status.style.color = "#70d9c0";
  }

  function initializeDesiredPose(camera = activeCamera) {
    if (!THREE || !camera) return false;
    desiredPosition = new THREE.Vector3().copy(camera.position);
    desiredQuaternion = new THREE.Quaternion().copy(camera.quaternion);
    const euler = new THREE.Euler().setFromQuaternion(desiredQuaternion, "YXZ");
    pitch = euler.x;
    yaw = euler.y;
    return true;
  }

  function clearDesiredPose() {
    desiredPosition = null;
    desiredQuaternion = null;
  }

  function captureCameraPrototype(THREERef) {
    const prototype = THREERef.Camera?.prototype;
    if (!prototype?.updateMatrixWorld) return false;
    if (prototype.__servoforgeFreeRoamCameraCaptureV3) {
      installed = true;
      return true;
    }

    const nativeUpdateMatrixWorld = prototype.updateMatrixWorld;
    prototype.updateMatrixWorld = function servoforgeFreeRoamCameraCapture(force) {
      if (this?.isCamera && viewportVisible()) {
        activeCamera = this;
        capturedFrames += 1;

        // This is the key authority boundary for Free Roam. The normal viewport
        // camera/orbit controller can update the camera earlier in the frame,
        // but immediately before Three.js builds the camera world matrix for
        // rendering we restore the Free Roam pose. This prevents the legacy
        // orbit controller and the UI helper loop from snapping movement back.
        if (freeRoamActive()) {
          if (!desiredPosition || !desiredQuaternion) initializeDesiredPose(this);
          if (desiredPosition && desiredQuaternion) {
            this.position.copy(desiredPosition);
            this.quaternion.copy(desiredQuaternion);
            authoritativeFrames += 1;
          }
        }
      }

      return nativeUpdateMatrixWorld.call(this, force);
    };

    Object.defineProperty(prototype, "__servoforgeFreeRoamCameraCaptureV3", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });

    installed = true;
    return true;
  }

  function syncLookFromDesiredPose() {
    if (!THREE) return false;
    if (!desiredQuaternion && !initializeDesiredPose()) return false;
    const euler = new THREE.Euler().setFromQuaternion(desiredQuaternion, "YXZ");
    pitch = euler.x;
    yaw = euler.y;
    return true;
  }

  function updateDesiredQuaternion() {
    if (!THREE) return;
    if (!desiredQuaternion && !initializeDesiredPose()) return;
    desiredQuaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
  }

  function applyMovement(deltaSeconds) {
    if (!THREE || !activeCamera || deltaSeconds <= 0) return;
    if ((!desiredPosition || !desiredQuaternion) && !initializeDesiredPose()) return;

    const speed = pressedKeys.has("shift") ? FAST_MOVE_SPEED : MOVE_SPEED;
    const step = speed * deltaSeconds;
    let changed = false;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(desiredQuaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(desiredQuaternion);
    forward.y = 0;
    right.y = 0;
    if (forward.lengthSq() > 1e-8) forward.normalize();
    if (right.lengthSq() > 1e-8) right.normalize();

    if (pressedKeys.has("w")) { desiredPosition.addScaledVector(forward, step); changed = true; }
    if (pressedKeys.has("s")) { desiredPosition.addScaledVector(forward, -step); changed = true; }
    if (pressedKeys.has("d")) { desiredPosition.addScaledVector(right, step); changed = true; }
    if (pressedKeys.has("a")) { desiredPosition.addScaledVector(right, -step); changed = true; }
    if (pressedKeys.has("e")) { desiredPosition.y += step; changed = true; }
    if (pressedKeys.has("q")) { desiredPosition.y -= step; changed = true; }

    if (changed) movementFrames += 1;
  }

  function frame(now) {
    frameId = null;
    const active = freeRoamActive();

    if (active && !wasFreeRoamActive) {
      initializeDesiredPose();
      syncLookFromDesiredPose();
      lastFrameTime = Number(now) || global.performance?.now?.() || Date.now();
    }

    if (!active && wasFreeRoamActive) {
      pressedKeys.clear();
      pointerKeys.clear();
      dragging = false;
      dragPointerId = null;
      clearDesiredPose();
    }

    if (active) {
      const currentTime = Number(now) || global.performance?.now?.() || Date.now();
      const deltaSeconds = clamp((currentTime - lastFrameTime) / 1000, 0, 0.05);
      lastFrameTime = currentTime;
      applyMovement(deltaSeconds);
    }

    updateStatusUi();
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
      updateStatusUi();
    }, true);

    global.addEventListener("keyup", (event) => {
      const key = freeKeyFromEvent(event);
      if (key) pressedKeys.delete(key);
      updateStatusUi();
    }, true);

    global.addEventListener("pointerdown", (event) => {
      if (!freeRoamActive()) return;

      const keyButton = freeKeyButtonFromEvent(event);
      if (keyButton) {
        const key = String(keyButton.dataset.freeKey || "").toLowerCase();
        if (key) {
          pressedKeys.add(key);
          pointerKeys.set(event.pointerId, key);
          updateStatusUi();
        }
        return;
      }

      if (!eventHitsCanvas(event) || event.button !== 0) return;
      dragging = true;
      dragPointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      syncLookFromDesiredPose();
    }, true);

    global.addEventListener("pointermove", (event) => {
      if (!freeRoamActive() || !dragging || event.pointerId !== dragPointerId) return;
      if ((!desiredPosition || !desiredQuaternion) && !initializeDesiredPose()) return;
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      yaw -= dx * LOOK_SENSITIVITY;
      pitch = clamp(pitch - dy * LOOK_SENSITIVITY, -Math.PI * 0.49, Math.PI * 0.49);
      updateDesiredQuaternion();
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
      updateStatusUi();
    };
    global.addEventListener("pointerup", releasePointer, true);
    global.addEventListener("pointercancel", releasePointer, true);

    global.addEventListener("wheel", (event) => {
      if (!freeRoamActive() || !activeCamera || !THREE || !eventHitsCanvas(event)) return;
      if ((!desiredPosition || !desiredQuaternion) && !initializeDesiredPose()) return;
      event.preventDefault();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(desiredQuaternion).normalize();
      const amount = clamp(-Number(event.deltaY || 0) * 0.0025, -1.25, 1.25);
      desiredPosition.addScaledVector(forward, amount);
      movementFrames += 1;
    }, { capture: true, passive: false });

    global.addEventListener("blur", () => {
      pressedKeys.clear();
      pointerKeys.clear();
      dragging = false;
      dragPointerId = null;
      updateStatusUi();
    });
  }

  function status() {
    return Object.freeze({
      integrationVersion: INTEGRATION_VERSION,
      threeVersion: THREE_VERSION,
      installed,
      cameraCaptured: Boolean(activeCamera),
      capturedFrames,
      authoritativeFrames,
      movementFrames,
      desiredPoseReady: Boolean(desiredPosition && desiredQuaternion),
      freeRoamActive: freeRoamActive(),
      pressedKeys: [...pressedKeys],
      purpose: "authoritative-render-time-free-roam-camera-bridge"
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
    .catch((error) => console.error("ServoForge Free Roam authoritative camera bridge failed", error));
})(window);
