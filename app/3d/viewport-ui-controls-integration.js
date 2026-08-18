(function installServoForge3DViewportUiControls(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.3d-viewport-ui-controls.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const BOTTLE_MODES = new Set(["all", "alternate", "none", "head1"]);

  let THREE = null;
  let patchedRenderer = false;
  let uiInstalled = false;
  let bottleMode = "all";
  let telemetryHidden = false;
  let freeRoam = false;
  let lastScene = null;
  let lastCamera = null;
  let lastFrameTime = 0;
  let lookDragging = false;
  let lookPointerId = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let freeYaw = 0;
  let freePitch = 0;
  let freePosition = null;
  let freeQuaternion = null;
  const pressedKeys = new Set();

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function activeViewportScene(scene) {
    if (!scene?.getObjectByName) return false;
    return Boolean(
      scene.getObjectByName("ServoForgeBottleTablePopulation")
      || scene.getObjectByName("ServoForgeBottleHandlingSystem")
    );
  }

  function applyBottleVisibility(scene) {
    if (!scene?.traverse || !activeViewportScene(scene)) return;
    let handlingIndex = 0;
    scene.traverse((object) => {
      if (object?.userData?.handlingBottle) {
        const visible = bottleMode === "all"
          || (bottleMode === "alternate" && handlingIndex % 2 === 0);
        object.visible = visible;
        handlingIndex += 1;
        return;
      }
      if (object?.name === "ServoForgeLiveBottle") {
        object.visible = bottleMode === "head1";
      }
    });
  }

  function initializeFreePose(camera) {
    if (!THREE || !camera) return false;
    freePosition = freePosition || new THREE.Vector3();
    freeQuaternion = freeQuaternion || new THREE.Quaternion();
    freePosition.copy(camera.position);
    freeQuaternion.copy(camera.quaternion);
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    freePitch = euler.x;
    freeYaw = euler.y;
    lastFrameTime = global.performance?.now?.() || Date.now();
    return true;
  }

  function updateFreeQuaternion() {
    if (!THREE || !freeQuaternion) return;
    const euler = new THREE.Euler(freePitch, freeYaw, 0, "YXZ");
    freeQuaternion.setFromEuler(euler);
  }

  function applyFreeMovement(camera) {
    if (!freeRoam || !THREE || !camera) return;
    if (!freePosition || !freeQuaternion) initializeFreePose(camera);
    if (!freePosition || !freeQuaternion) return;

    const now = global.performance?.now?.() || Date.now();
    const deltaSeconds = clamp((now - lastFrameTime) / 1000, 0, 0.05);
    lastFrameTime = now;
    const speed = pressedKeys.has("shift") ? 8.5 : 3.6;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(freeQuaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(freeQuaternion);
    forward.y = 0;
    right.y = 0;
    if (forward.lengthSq() > 1e-8) forward.normalize();
    if (right.lengthSq() > 1e-8) right.normalize();

    const step = speed * deltaSeconds;
    if (pressedKeys.has("w")) freePosition.addScaledVector(forward, step);
    if (pressedKeys.has("s")) freePosition.addScaledVector(forward, -step);
    if (pressedKeys.has("d")) freePosition.addScaledVector(right, step);
    if (pressedKeys.has("a")) freePosition.addScaledVector(right, -step);
    if (pressedKeys.has("e")) freePosition.y += step;
    if (pressedKeys.has("q")) freePosition.y -= step;

    camera.position.copy(freePosition);
    camera.quaternion.copy(freeQuaternion);
  }

  function patchThreeRenderer() {
    if (!THREE || patchedRenderer) return;
    const prototype = THREE.WebGLRenderer?.prototype;
    if (!prototype?.render || prototype.__servoforgeViewportUiControlsV1) return;
    const nativeRender = prototype.render;
    prototype.render = function servoforgeViewportUiRender(scene, camera) {
      if (activeViewportScene(scene)) {
        lastScene = scene;
        lastCamera = camera;
        applyBottleVisibility(scene);
        applyFreeMovement(camera);
      }
      return nativeRender.call(this, scene, camera);
    };
    Object.defineProperty(prototype, "__servoforgeViewportUiControlsV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
    patchedRenderer = true;
  }

  function installStyles() {
    if (document.querySelector("#servoforge3dViewportUiControlsStyles")) return;
    const style = document.createElement("style");
    style.id = "servoforge3dViewportUiControlsStyles";
    style.textContent = `
      .servoforge-3d-telemetry{grid-template-columns:repeat(8,minmax(82px,1fr))!important;gap:4px!important;width:min(1080px,calc(100% - 24px))!important;left:10px!important;bottom:10px!important}
      .servoforge-3d-telemetry[hidden]{display:none!important}
      .servoforge-3d-metric{padding:5px 6px!important;border-radius:7px!important;box-shadow:0 5px 14px rgba(0,0,0,.18)!important}
      .servoforge-3d-metric span{font-size:7.5px!important;letter-spacing:.065em!important}
      .servoforge-3d-metric strong{margin-top:2px!important;font-size:10px!important}
      .servoforge-3d-controls .servoforge-3d-bottle-control{display:flex;align-items:center;gap:5px;border:1px solid rgba(150,183,197,.22);background:#0d2029;border-radius:8px;padding:3px 5px 3px 7px;color:#9fb4bd;font-size:10px;font-weight:700}
      .servoforge-3d-controls .servoforge-3d-bottle-control select{border:0;background:#122833;color:#eef7fa;border-radius:6px;padding:4px 6px;font:inherit;font-size:10px;font-weight:700;outline:none;cursor:pointer}
      .servoforge-3d-controls #servoforge3dFreeRoam[aria-pressed="true"]{border-color:#55c2ff;color:#bde8ff;background:#102b3a}
      .servoforge-3d-controls #servoforge3dTelemetryToggle[aria-pressed="true"]{border-color:#7b8b92;color:#c5d1d6;background:#172127}
      @media(max-width:1100px){.servoforge-3d-telemetry{grid-template-columns:repeat(6,minmax(82px,1fr))!important;width:min(900px,calc(100% - 24px))!important}}
      @media(max-width:850px){.servoforge-3d-telemetry{grid-template-columns:repeat(3,minmax(92px,1fr))!important;width:calc(100% - 20px)!important;left:10px!important;bottom:42px!important}.servoforge-3d-metric.action{grid-column:span 2!important}.servoforge-3d-controls .servoforge-3d-bottle-control{max-width:100%}}
    `;
    document.head.appendChild(style);
  }

  function helpElement() {
    return document.querySelector("#servoforge3dBackdrop .servoforge-3d-help");
  }

  function updateHelpCopy() {
    const help = helpElement();
    if (!help) return;
    help.textContent = freeRoam
      ? "Free roam • Drag to look • WASD move • Q/E vertical • Wheel forward/back"
      : "Drag to orbit • Wheel to zoom";
  }

  function updateFreeRoamButton() {
    const button = document.querySelector("#servoforge3dFreeRoam");
    if (!button) return;
    button.setAttribute("aria-pressed", String(freeRoam));
    button.textContent = freeRoam ? "Exit Free Roam" : "Free Roam";
  }

  function setFreeRoam(enabled) {
    freeRoam = Boolean(enabled);
    pressedKeys.clear();
    lookDragging = false;
    lookPointerId = null;

    if (freeRoam) {
      const follow = document.querySelector("#servoforge3dFollow");
      if (follow?.getAttribute("aria-pressed") === "true") follow.click();
      if (lastCamera) initializeFreePose(lastCamera);
    } else {
      freePosition = null;
      freeQuaternion = null;
      global.Labeler3DViewport?.resetCamera?.();
    }

    updateFreeRoamButton();
    updateHelpCopy();
  }

  function setBottleMode(mode) {
    const next = BOTTLE_MODES.has(String(mode)) ? String(mode) : "all";
    bottleMode = next;
    const select = document.querySelector("#servoforge3dBottleMode");
    if (select && select.value !== next) select.value = next;
    if (lastScene) applyBottleVisibility(lastScene);
  }

  function setTelemetryHidden(hidden) {
    telemetryHidden = Boolean(hidden);
    const telemetry = document.querySelector("#servoforge3dBackdrop .servoforge-3d-telemetry");
    if (telemetry) telemetry.hidden = telemetryHidden;
    const button = document.querySelector("#servoforge3dTelemetryToggle");
    if (button) {
      button.setAttribute("aria-pressed", String(telemetryHidden));
      button.textContent = telemetryHidden ? "Show Data" : "Hide Data";
    }
  }

  function installViewportControls() {
    if (uiInstalled) return true;
    const backdrop = document.querySelector("#servoforge3dBackdrop");
    const controls = backdrop?.querySelector(".servoforge-3d-controls");
    const canvas = backdrop?.querySelector("#servoforge3dCanvas");
    if (!backdrop || !controls || !canvas) return false;

    installStyles();

    if (!document.querySelector("#servoforge3dBottleMode")) {
      const label = document.createElement("label");
      label.className = "servoforge-3d-bottle-control";
      label.innerHTML = `Bottles <select id="servoforge3dBottleMode" aria-label="Bottle visibility"><option value="all">All</option><option value="alternate">Every other</option><option value="none">Hide all</option><option value="head1">Head 1 only</option></select>`;
      const closeButton = controls.querySelector("#servoforge3dClose");
      controls.insertBefore(label, closeButton || null);
      label.querySelector("select")?.addEventListener("change", (event) => setBottleMode(event.target.value));
    }

    if (!document.querySelector("#servoforge3dFreeRoam")) {
      const button = document.createElement("button");
      button.id = "servoforge3dFreeRoam";
      button.type = "button";
      button.textContent = "Free Roam";
      button.setAttribute("aria-pressed", "false");
      const closeButton = controls.querySelector("#servoforge3dClose");
      controls.insertBefore(button, closeButton || null);
      button.addEventListener("click", () => setFreeRoam(!freeRoam));
    }

    if (!document.querySelector("#servoforge3dTelemetryToggle")) {
      const button = document.createElement("button");
      button.id = "servoforge3dTelemetryToggle";
      button.type = "button";
      button.textContent = "Hide Data";
      button.setAttribute("aria-pressed", "false");
      const closeButton = controls.querySelector("#servoforge3dClose");
      controls.insertBefore(button, closeButton || null);
      button.addEventListener("click", () => setTelemetryHidden(!telemetryHidden));
    }

    canvas.addEventListener("pointerdown", (event) => {
      if (!freeRoam || event.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      lookDragging = true;
      lookPointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    }, true);

    canvas.addEventListener("pointermove", (event) => {
      if (!freeRoam || !lookDragging || event.pointerId !== lookPointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      freeYaw -= dx * 0.0045;
      freePitch = clamp(freePitch - dy * 0.0045, -Math.PI * 0.49, Math.PI * 0.49);
      updateFreeQuaternion();
    }, true);

    const releaseLook = (event) => {
      if (!freeRoam || event.pointerId !== lookPointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      lookDragging = false;
      lookPointerId = null;
      canvas.releasePointerCapture?.(event.pointerId);
    };
    canvas.addEventListener("pointerup", releaseLook, true);
    canvas.addEventListener("pointercancel", releaseLook, true);

    canvas.addEventListener("wheel", (event) => {
      if (!freeRoam || !THREE || !freePosition || !freeQuaternion) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(freeQuaternion).normalize();
      const amount = clamp(-event.deltaY * 0.0025, -1.25, 1.25);
      freePosition.addScaledVector(forward, amount);
    }, { capture: true, passive: false });

    document.addEventListener("keydown", (event) => {
      if (!freeRoam) return;
      const tag = String(event.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      const key = String(event.key || "").toLowerCase();
      if (!["w", "a", "s", "d", "q", "e", "shift"].includes(key)) return;
      event.preventDefault();
      event.stopPropagation();
      pressedKeys.add(key);
    }, true);

    document.addEventListener("keyup", (event) => {
      if (!freeRoam) return;
      const key = String(event.key || "").toLowerCase();
      pressedKeys.delete(key);
    }, true);

    const closeButton = backdrop.querySelector("#servoforge3dClose");
    closeButton?.addEventListener("click", () => {
      if (freeRoam) setFreeRoam(false);
    });

    setBottleMode(bottleMode);
    setTelemetryHidden(telemetryHidden);
    updateFreeRoamButton();
    updateHelpCopy();
    uiInstalled = true;
    return true;
  }

  function installWhenReady(attempt = 0) {
    if (installViewportControls()) return;
    if (attempt < 240) global.setTimeout(() => installWhenReady(attempt + 1), 25);
  }

  function status() {
    return Object.freeze({
      integrationVersion: INTEGRATION_VERSION,
      threeVersion: THREE_VERSION,
      installed: uiInstalled,
      rendererPatched: patchedRenderer,
      bottleMode,
      telemetryHidden,
      freeRoam,
      geometryUntouched: true,
      plannerUntouched: true,
      servoRuntimeUntouched: true
    });
  }

  global.Labeler3DViewportUiControls = Object.freeze({
    INTEGRATION_VERSION,
    THREE_VERSION,
    setBottleMode,
    setTelemetryHidden,
    setFreeRoam,
    status
  });

  import(THREE_MODULE_URL)
    .then((module) => {
      THREE = module;
      patchThreeRenderer();
      installWhenReady();
    })
    .catch((error) => console.error("ServoForge 3D viewport UI controls failed", error));
})(window);
