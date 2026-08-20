(function installServoForge3DViewportUiControls(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.3d-viewport-ui-controls.v4";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const BOTTLE_MODES = new Set(["all", "none", "head1"]);
  const TRANSPARENT_OBJECT_OPACITY = 0.50;

  let THREE = null;
  let uiInstalled = false;
  let objectHooksInstalled = false;
  let bottleMode = "all";
  let telemetryHidden = false;
  let machineTransparent = false;
  let freeRoam = false;
  let lastCamera = null;
  let lastFrameTime = 0;
  let freeRoamFrameId = null;
  let lookDragging = false;
  let lookPointerId = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let freeYaw = 0;
  let freePitch = 0;
  let freePosition = null;
  let freeQuaternion = null;
  const pressedKeys = new Set();
  const materialRecords = new Map();

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function installBottleVisibilityProxy(object) {
    if (!object || object.__servoforgeBottleVisibilityProxyV4) return;
    const isHandlingBottle = Boolean(object?.userData?.handlingBottle);
    const isHeadOneBottle = object?.name === "ServoForgeLiveBottle";
    if (!isHandlingBottle && !isHeadOneBottle) return;

    const record = {
      kind: isHandlingBottle ? "handling" : "head1",
      baseVisible: Boolean(object.visible)
    };

    try {
      Object.defineProperty(object, "visible", {
        configurable: true,
        enumerable: true,
        get() {
          if (record.kind === "head1") {
            if (bottleMode === "head1") return true;
            if (bottleMode === "all") return record.baseVisible;
            return false;
          }
          if (!record.baseVisible) return false;
          return bottleMode === "all";
        },
        set(value) {
          record.baseVisible = Boolean(value);
        }
      });
      Object.defineProperty(object, "__servoforgeBottleVisibilityProxyV4", {
        configurable: false,
        enumerable: false,
        writable: false,
        value: record
      });
    } catch (error) {
      console.warn("ServoForge 3D bottle visibility proxy could not be installed", error);
    }
  }

  function hasBottleAncestor(object) {
    let current = object;
    while (current) {
      if (current?.userData?.handlingBottle || current?.name === "ServoForgeLiveBottle") return true;
      current = current.parent;
    }
    return false;
  }

  function hasServoForgeAncestor(object) {
    let current = object;
    while (current) {
      if (String(current?.name || "").startsWith("ServoForge")) return true;
      current = current.parent;
    }
    return false;
  }

  function isMachineMesh(mesh) {
    if (!mesh?.isMesh || hasBottleAncestor(mesh) || mesh?.userData?.handlingBottleInstances) return false;
    // The unnamed CircleGeometry is the viewport floor, not labeler hardware.
    if (mesh.geometry?.type === "CircleGeometry" && !hasServoForgeAncestor(mesh)) return false;
    return true;
  }

  function applyMaterialTransparency(record) {
    const material = record?.material;
    if (!material) return;
    if (machineTransparent) {
      material.opacity = clamp(record.opacity * TRANSPARENT_OBJECT_OPACITY, 0, 1);
      material.transparent = true;
      material.depthWrite = false;
    } else {
      material.opacity = record.opacity;
      material.transparent = record.transparent;
      material.depthWrite = record.depthWrite;
    }
    material.needsUpdate = true;
  }

  function registerMaterial(material) {
    if (!material || materialRecords.has(material)) return;
    const record = {
      material,
      opacity: Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1,
      transparent: Boolean(material.transparent),
      depthWrite: material.depthWrite !== false
    };
    materialRecords.set(material, record);
    applyMaterialTransparency(record);
  }

  function registerMachineMaterials(object) {
    object?.traverse?.((child) => {
      if (!isMachineMesh(child)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(registerMaterial);
    });
  }

  function applyAllMachineTransparency() {
    materialRecords.forEach(applyMaterialTransparency);
  }

  function installThreeObjectHooks() {
    if (!THREE || objectHooksInstalled) return;
    const prototype = THREE.Object3D?.prototype;
    if (!prototype) return;

    if (!prototype.__servoforgeViewportUiAddHookV4) {
      const nativeAdd = prototype.add;
      prototype.add = function servoforgeViewportUiAdd(...objects) {
        const result = nativeAdd.apply(this, objects);
        objects.forEach((object) => {
          installBottleVisibilityProxy(object);
          registerMachineMaterials(object);
        });
        return result;
      };
      Object.defineProperty(prototype, "__servoforgeViewportUiAddHookV4", {
        configurable: false,
        enumerable: false,
        writable: false,
        value: true
      });
    }

    if (!prototype.__servoforgeViewportUiLookAtHookV4) {
      const nativeLookAt = prototype.lookAt;
      prototype.lookAt = function servoforgeViewportUiLookAt(...args) {
        if (this?.isCamera) lastCamera = this;
        return nativeLookAt.apply(this, args);
      };
      Object.defineProperty(prototype, "__servoforgeViewportUiLookAtHookV4", {
        configurable: false,
        enumerable: false,
        writable: false,
        value: true
      });
    }

    objectHooksInstalled = true;
  }

  function initializeFreePose(camera) {
    if (!THREE || !camera) return false;
    freePosition = new THREE.Vector3().copy(camera.position);
    freeQuaternion = new THREE.Quaternion().copy(camera.quaternion);
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    freePitch = euler.x;
    freeYaw = euler.y;
    lastFrameTime = global.performance?.now?.() || Date.now();
    return true;
  }

  function updateFreeQuaternion() {
    if (!THREE || !freeQuaternion) return;
    freeQuaternion.setFromEuler(new THREE.Euler(freePitch, freeYaw, 0, "YXZ"));
  }

  function applyFreeMovement(camera, now) {
    if (!freeRoam || !THREE || !camera) return;
    if (!freePosition || !freeQuaternion) initializeFreePose(camera);
    if (!freePosition || !freeQuaternion) return;

    const currentTime = Number.isFinite(Number(now)) ? Number(now) : (global.performance?.now?.() || Date.now());
    const deltaSeconds = clamp((currentTime - lastFrameTime) / 1000, 0, 0.05);
    lastFrameTime = currentTime;
    const speed = pressedKeys.has("shift") ? 8.5 : 3.6;
    const step = speed * deltaSeconds;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(freeQuaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(freeQuaternion);
    forward.y = 0;
    right.y = 0;
    if (forward.lengthSq() > 1e-8) forward.normalize();
    if (right.lengthSq() > 1e-8) right.normalize();

    if (pressedKeys.has("w")) freePosition.addScaledVector(forward, step);
    if (pressedKeys.has("s")) freePosition.addScaledVector(forward, -step);
    if (pressedKeys.has("d")) freePosition.addScaledVector(right, step);
    if (pressedKeys.has("a")) freePosition.addScaledVector(right, -step);
    if (pressedKeys.has("e")) freePosition.y += step;
    if (pressedKeys.has("q")) freePosition.y -= step;

    camera.position.copy(freePosition);
    camera.quaternion.copy(freeQuaternion);
  }

  function freeRoamFrame(now) {
    freeRoamFrameId = null;
    if (!freeRoam) return;
    if (lastCamera) applyFreeMovement(lastCamera, now);
    freeRoamFrameId = global.requestAnimationFrame(freeRoamFrame);
  }

  function startFreeRoamLoop() {
    if (freeRoamFrameId !== null) return;
    lastFrameTime = global.performance?.now?.() || Date.now();
    freeRoamFrameId = global.requestAnimationFrame(freeRoamFrame);
  }

  function stopFreeRoamLoop() {
    if (freeRoamFrameId !== null) {
      global.cancelAnimationFrame?.(freeRoamFrameId);
      freeRoamFrameId = null;
    }
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
      .servoforge-3d-controls #servoforge3dTransparentObjects[aria-pressed="true"]{border-color:#70d9c0;color:#bdf6e8;background:#12332e}
      .servoforge-3d-free-roam-pad{position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:8;display:grid;grid-template-columns:auto auto;gap:8px;align-items:center;background:rgba(5,15,20,.90);border:1px solid rgba(85,194,255,.42);border-radius:10px;padding:7px 9px;box-shadow:0 8px 24px rgba(0,0,0,.30);pointer-events:auto}
      .servoforge-3d-free-roam-pad[hidden]{display:none!important}.servoforge-3d-free-roam-copy{display:flex;flex-direction:column;gap:2px;min-width:118px}.servoforge-3d-free-roam-copy strong{font-size:10px;color:#bde8ff}.servoforge-3d-free-roam-copy small{font-size:8px;color:#8fa8b3;line-height:1.3}
      .servoforge-3d-free-roam-buttons{display:grid;grid-template-columns:repeat(3,30px);grid-template-rows:repeat(2,27px);gap:3px}.servoforge-3d-free-roam-buttons button{border:1px solid rgba(150,183,197,.28);background:#122833;color:#eef7fa;border-radius:6px;padding:0;font-size:9px;font-weight:800;cursor:pointer;touch-action:none}.servoforge-3d-free-roam-buttons button:active,.servoforge-3d-free-roam-buttons button[data-active="true"]{border-color:#55c2ff;background:#173a4b;color:#c8efff}
      @media(max-width:1100px){.servoforge-3d-telemetry{grid-template-columns:repeat(6,minmax(82px,1fr))!important;width:min(900px,calc(100% - 24px))!important}}
      @media(max-width:850px){.servoforge-3d-telemetry{grid-template-columns:repeat(3,minmax(92px,1fr))!important;width:calc(100% - 20px)!important;left:10px!important;bottom:42px!important}.servoforge-3d-metric.action{grid-column:span 2!important}.servoforge-3d-controls .servoforge-3d-bottle-control{max-width:100%}.servoforge-3d-free-roam-pad{top:8px;max-width:calc(100% - 16px)}.servoforge-3d-free-roam-copy{min-width:100px}}
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
      ? "Free roam active • Drag to look • WASD move • Q/E vertical • Shift = faster"
      : "Drag to orbit • Wheel to zoom";
  }

  function updateFreeRoamUi() {
    const button = document.querySelector("#servoforge3dFreeRoam");
    if (button) {
      button.setAttribute("aria-pressed", String(freeRoam));
      button.textContent = "Free Roam";
    }
    const pad = document.querySelector("#servoforge3dFreeRoamPad");
    if (pad) pad.hidden = !freeRoam;
    updateHelpCopy();
  }

  function setFreeRoam(enabled, options = {}) {
    const next = Boolean(enabled);
    if (next === freeRoam && !(next && !freePosition)) {
      updateFreeRoamUi();
      return;
    }

    freeRoam = next;
    pressedKeys.clear();
    lookDragging = false;
    lookPointerId = null;

    if (freeRoam) {
      const follow = document.querySelector("#servoforge3dFollow");
      if (follow?.getAttribute("aria-pressed") === "true") follow.click();
      if (lastCamera) initializeFreePose(lastCamera);
      startFreeRoamLoop();
    } else {
      stopFreeRoamLoop();
      freePosition = null;
      freeQuaternion = null;
      if (options.resetCamera !== false) global.Labeler3DViewport?.resetCamera?.();
    }

    updateFreeRoamUi();
  }

  function setBottleMode(mode) {
    const next = BOTTLE_MODES.has(String(mode)) ? String(mode) : "all";
    bottleMode = next;
    global.Labeler3DBottleHandlingViewport?.setBottleMode?.(next);
    const select = document.querySelector("#servoforge3dBottleMode");
    if (select && select.value !== next) select.value = next;
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

  function setMachineTransparent(enabled) {
    machineTransparent = Boolean(enabled);
    applyAllMachineTransparency();
    const button = document.querySelector("#servoforge3dTransparentObjects");
    if (button) {
      button.setAttribute("aria-pressed", String(machineTransparent));
      button.title = machineTransparent
        ? "Labeler objects are at 50% opacity. Click for 100%."
        : "Labeler objects are at 100% opacity. Click for 50%.";
    }
  }

  function keyFromKeyboardEvent(event) {
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

  function bindFreeRoamPad(pad) {
    pad.querySelectorAll("button[data-free-key]").forEach((button) => {
      const key = String(button.dataset.freeKey || "");
      const release = () => {
        pressedKeys.delete(key);
        button.dataset.active = "false";
      };
      button.addEventListener("pointerdown", (event) => {
        if (!freeRoam) return;
        event.preventDefault();
        pressedKeys.add(key);
        button.dataset.active = "true";
        button.setPointerCapture?.(event.pointerId);
      });
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    });
  }

  function installViewportControls() {
    if (uiInstalled) return true;
    const backdrop = document.querySelector("#servoforge3dBackdrop");
    const controls = backdrop?.querySelector(".servoforge-3d-controls");
    const stage = backdrop?.querySelector("#servoforge3dStage");
    const canvas = backdrop?.querySelector("#servoforge3dCanvas");
    if (!backdrop || !controls || !stage || !canvas) return false;

    installStyles();

    if (!document.querySelector("#servoforge3dBottleMode")) {
      const label = document.createElement("label");
      label.className = "servoforge-3d-bottle-control";
      label.innerHTML = `Bottles <select id="servoforge3dBottleMode" aria-label="Bottle visibility"><option value="all">All</option><option value="none">Hide all</option><option value="head1">Head 1 only</option></select>`;
      const closeButton = controls.querySelector("#servoforge3dClose");
      controls.insertBefore(label, closeButton || null);
      label.querySelector("select")?.addEventListener("change", (event) => setBottleMode(event.target.value));
    }

    if (!document.querySelector("#servoforge3dTransparentObjects")) {
      const button = document.createElement("button");
      button.id = "servoforge3dTransparentObjects";
      button.type = "button";
      button.textContent = "Transparent Objects";
      button.setAttribute("aria-pressed", "false");
      const closeButton = controls.querySelector("#servoforge3dClose");
      controls.insertBefore(button, closeButton || null);
      button.addEventListener("click", () => setMachineTransparent(!machineTransparent));
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

    if (!document.querySelector("#servoforge3dFreeRoamPad")) {
      const pad = document.createElement("div");
      pad.id = "servoforge3dFreeRoamPad";
      pad.className = "servoforge-3d-free-roam-pad";
      pad.hidden = true;
      pad.innerHTML = `
        <div class="servoforge-3d-free-roam-copy"><strong>Free Roam Controls</strong><small>Drag scene to look. Keyboard: WASD + Q/E. Hold Shift for faster travel.</small></div>
        <div class="servoforge-3d-free-roam-buttons" aria-label="Free roam movement controls">
          <button type="button" data-free-key="q" aria-label="Move down">Q ↓</button><button type="button" data-free-key="w" aria-label="Move forward">W</button><button type="button" data-free-key="e" aria-label="Move up">E ↑</button>
          <button type="button" data-free-key="a" aria-label="Move left">A</button><button type="button" data-free-key="s" aria-label="Move backward">S</button><button type="button" data-free-key="d" aria-label="Move right">D</button>
        </div>`;
      stage.appendChild(pad);
      bindFreeRoamPad(pad);
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
      if (lastCamera && freeQuaternion) lastCamera.quaternion.copy(freeQuaternion);
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
      if (lastCamera) lastCamera.position.copy(freePosition);
    }, { capture: true, passive: false });

    document.addEventListener("keydown", (event) => {
      if (!freeRoam) return;
      const tag = String(event.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      const key = keyFromKeyboardEvent(event);
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      pressedKeys.add(key);
    }, true);

    document.addEventListener("keyup", (event) => {
      if (!freeRoam) return;
      const key = keyFromKeyboardEvent(event);
      if (!key) return;
      pressedKeys.delete(key);
    }, true);

    global.addEventListener?.("blur", () => pressedKeys.clear());

    controls.addEventListener("click", (event) => {
      if (!freeRoam) return;
      const target = event.target?.closest?.("[data-3d-camera], #servoforge3dFollow");
      if (!target) return;
      setFreeRoam(false, { resetCamera: false });
    }, true);

    backdrop.querySelector("#servoforge3dClose")?.addEventListener("click", () => {
      if (freeRoam) setFreeRoam(false, { resetCamera: false });
    });

    setBottleMode(bottleMode);
    setMachineTransparent(machineTransparent);
    setTelemetryHidden(telemetryHidden);
    updateFreeRoamUi();
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
      objectHooksInstalled,
      cameraCaptured: Boolean(lastCamera),
      bottleMode,
      telemetryHidden,
      machineTransparent,
      machineOpacity: machineTransparent ? TRANSPARENT_OBJECT_OPACITY : 1,
      freeRoam,
      trackedMachineMaterials: materialRecords.size,
      geometryUntouched: true,
      plannerUntouched: true,
      servoRuntimeUntouched: true
    });
  }

  global.Labeler3DViewportUiControls = Object.freeze({
    INTEGRATION_VERSION,
    THREE_VERSION,
    TRANSPARENT_OBJECT_OPACITY,
    setBottleMode,
    setTelemetryHidden,
    setMachineTransparent,
    setFreeRoam,
    status
  });

  import(THREE_MODULE_URL)
    .then((module) => {
      THREE = module;
      installThreeObjectHooks();
      installWhenReady();
    })
    .catch((error) => console.error("ServoForge 3D viewport UI controls failed", error));
})(window);

