(function installServoForge3DHardwareViewport(global) {
  "use strict";

  const VIEWPORT_SINGLETON_KEY = "__servoforge3DViewportSingletonV09";
  if (global[VIEWPORT_SINGLETON_KEY]) return;

  const staleBackdrops = [...(global.document?.querySelectorAll?.("#servoforge3dBackdrop") || [])];
  staleBackdrops.forEach((backdrop) => {
    try { backdrop.querySelector?.("#servoforge3dClose")?.click?.(); } catch {}
    backdrop.remove?.();
  });

  const viewportSingleton = {
    version: "servoforge.3d-viewport-singleton.v2",
    installing: true,
    installed: false,
    open: false,
    staleViewportCountRemoved: staleBackdrops.length,
    api: null
  };
  global[VIEWPORT_SINGLETON_KEY] = viewportSingleton;

  const VIEWPORT_VERSION = "servoforge.3d-viewport.v0.10";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

  let THREE = null;
  let enginePromise = null;
  let scene = null;
  let camera = null;
  let renderer = null;
  let resizeObserver = null;
  let animationFrame = null;
  let viewportOpen = false;
  let followHead = false;
  let lastSnapshot = null;
  let lastEquipmentSignature = "";
  let equipmentLayer = null;
  let aggregateLayer = null;
  let equipmentAssemblies = [];
  let aggregateAssemblies = [];
  let ui = null;

  const cameraState = {
    azimuth: Math.PI * 0.22,
    polar: Math.PI * 0.31,
    distance: 10,
    target: null,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0
  };

  function runtime() { return global.Labeler3DSceneRuntime || null; }
  function hardwareFactory() { return global.Labeler3DHardwareMeshFactory || null; }
  function hardwareCatalog() { return global.Labeler3DHardwareReferenceCatalog || null; }
  function handlingViewport() { return global.Labeler3DBottleHandlingViewport || null; }
  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function formatDegrees(value, decimals = 1) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric.toFixed(decimals)}°` : "—";
  }
  function formatMillimeters(value, decimals = 1) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric.toFixed(decimals)} mm` : "—";
  }
  function material(options) { return new THREE.MeshStandardMaterial(options); }

  function installStyles() {
    if (document.querySelector("#servoforge3dViewportStyles")) return;
    const style = document.createElement("style");
    style.id = "servoforge3dViewportStyles";
    style.textContent = `
      .servoforge-3d-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(2,8,12,.74);backdrop-filter:blur(7px);padding:clamp(12px,2.5vw,30px);display:flex;align-items:center;justify-content:center}
      .servoforge-3d-backdrop[hidden]{display:none!important}.servoforge-3d-panel{width:min(1380px,97vw);height:min(920px,95vh);min-height:560px;background:#071117;border:1px solid rgba(137,174,190,.32);border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.55);overflow:hidden;display:grid;grid-template-rows:auto 1fr;color:#edf5f7}
      .servoforge-3d-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid rgba(137,174,190,.18);background:linear-gradient(180deg,rgba(17,38,47,.98),rgba(8,22,29,.98))}.servoforge-3d-title{display:flex;align-items:center;gap:12px;min-width:0}.servoforge-3d-title h2{margin:0;font-size:17px}.servoforge-3d-title small{display:block;color:#91a9b4;margin-top:2px;font-size:11px}.servoforge-3d-live{width:9px;height:9px;border-radius:50%;background:#35d18a;box-shadow:0 0 12px rgba(53,209,138,.7);flex:0 0 auto}
      .servoforge-3d-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.servoforge-3d-controls button{border:1px solid rgba(150,183,197,.28);background:#122833;color:#eef7fa;border-radius:8px;padding:7px 10px;font:inherit;font-size:11px;font-weight:700;cursor:pointer}.servoforge-3d-controls button:hover{background:#193846}.servoforge-3d-controls button[aria-pressed="true"]{border-color:#ff784d;color:#ffb095;background:#2d1d18}
      .servoforge-3d-stage{position:relative;min-height:0;background:radial-gradient(circle at 50% 38%,#18313d 0,#09171e 52%,#050c11 100%);overflow:hidden}.servoforge-3d-canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}.servoforge-3d-canvas:active{cursor:grabbing}
      .servoforge-3d-telemetry{position:absolute;left:14px;bottom:14px;display:grid;grid-template-columns:repeat(5,minmax(112px,1fr));gap:8px;width:min(1180px,calc(100% - 28px));pointer-events:none}.servoforge-3d-metric{background:rgba(5,15,20,.86);border:1px solid rgba(137,174,190,.2);border-radius:10px;padding:8px 9px;box-shadow:0 8px 24px rgba(0,0,0,.2);min-width:0}.servoforge-3d-metric span{display:block;color:#829ba7;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.servoforge-3d-metric strong{display:block;margin-top:3px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.servoforge-3d-metric.action{grid-column:span 2}.servoforge-3d-metric.physical strong{color:#b9f4d8}.servoforge-3d-metric.live strong{color:#ffad8f}.servoforge-3d-metric.hardware strong{color:#d8e6ea}.servoforge-3d-metric.sensor strong{color:#7de6b1}.servoforge-3d-metric.coder strong{color:#ff9898}
      .servoforge-3d-note{position:absolute;right:14px;top:14px;max-width:480px;background:rgba(5,15,20,.82);border:1px solid rgba(137,174,190,.16);border-radius:9px;padding:8px 10px;color:#9db2bb;font-size:10px;line-height:1.42;pointer-events:none}.servoforge-3d-note strong{color:#ffd1c1}.servoforge-3d-legend{position:absolute;left:14px;top:14px;background:rgba(5,15,20,.80);border:1px solid rgba(137,174,190,.16);border-radius:9px;padding:8px 10px;color:#9db2bb;font-size:10px;line-height:1.5;pointer-events:none}.servoforge-3d-legend b{color:#eef7fa}.servoforge-3d-help{position:absolute;right:14px;bottom:14px;background:rgba(5,15,20,.72);border:1px solid rgba(137,174,190,.16);border-radius:9px;padding:8px 10px;color:#8ca3ad;font-size:10px;pointer-events:none}.servoforge-3d-error{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);max-width:560px;background:rgba(75,22,18,.94);border:1px solid rgba(255,120,77,.55);border-radius:12px;padding:14px 16px;color:#ffe7df;font-size:12px;line-height:1.45;text-align:center}
      @media(max-width:850px){.servoforge-3d-backdrop{padding:7px}.servoforge-3d-panel{width:100%;height:96vh;min-height:500px;border-radius:12px}.servoforge-3d-head{align-items:flex-start;flex-direction:column}.servoforge-3d-controls{justify-content:flex-start}.servoforge-3d-telemetry{grid-template-columns:repeat(2,minmax(100px,1fr));width:calc(100% - 28px);bottom:46px}.servoforge-3d-metric.action{grid-column:span 2}.servoforge-3d-help{left:14px;right:auto}.servoforge-3d-note{top:8px;right:8px;max-width:280px}.servoforge-3d-legend{display:none}}
    `;
    document.head.appendChild(style);
  }

  function installUi() {
    if (ui) return ui;
    installStyles();
    const toolbar = document.querySelector(".map-toolbar");
    if (!toolbar) return null;

    let openButton = document.querySelector("#servoforge3dOpen");
    if (!openButton) {
      openButton = document.createElement("button");
      openButton.id = "servoforge3dOpen";
      openButton.type = "button";
      openButton.className = "secondary-button compact-map-button";
      openButton.textContent = "3D View";
      openButton.setAttribute("aria-haspopup", "dialog");
      toolbar.appendChild(openButton);
    }

    const existingBackdrop = document.querySelector("#servoforge3dBackdrop");
    existingBackdrop?.remove?.();

    const backdrop = document.createElement("div");
    backdrop.id = "servoforge3dBackdrop";
    backdrop.className = "servoforge-3d-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="servoforge-3d-panel" role="dialog" aria-modal="true" aria-labelledby="servoforge3dTitle">
        <header class="servoforge-3d-head">
          <div class="servoforge-3d-title"><span class="servoforge-3d-live" aria-hidden="true"></span><div><h2 id="servoforge3dTitle">ServoForge 3D • Bottle Handling</h2><small>Single starwheel environment • active machine-map hardware • read only • Three.js ${THREE_VERSION}</small></div></div>
          <div class="servoforge-3d-controls"><button type="button" data-3d-camera="operator">Operator</button><button type="button" data-3d-camera="top">Top</button><button type="button" data-3d-camera="reset">Reset Camera</button><button type="button" id="servoforge3dFollow" aria-pressed="false">Follow Head 1</button><button type="button" id="servoforge3dClose">Close</button></div>
        </header>
        <div class="servoforge-3d-stage" id="servoforge3dStage">
          <canvas class="servoforge-3d-canvas" id="servoforge3dCanvas" aria-label="ServoForge starwheel bottle-handling simulation"></canvas>
          <div class="servoforge-3d-note"><strong>Scene authority:</strong> the starwheel bottle-handling environment is the only transport scene. The retired generic carousel/head environment is not constructed.</div>
          <div class="servoforge-3d-legend"><b>Bottle handling</b><br>Starwheels + conveyors: transport path<br>Bottles: synchronized machine flow<br>Silver: application hardware<br>Brown: measured wipe pad<br>Gray/red: coder<br>Green/cyan: label sensor</div>
          <div class="servoforge-3d-telemetry" aria-live="polite">
            <div class="servoforge-3d-metric"><span>Machine angle</span><strong id="servoforge3dMachineAngle">—</strong></div><div class="servoforge-3d-metric"><span>Bottle servo</span><strong id="servoforge3dServoAngle">—</strong></div><div class="servoforge-3d-metric"><span>Active command</span><strong id="servoforge3dCommand">—</strong></div><div class="servoforge-3d-metric live"><span>Live head</span><strong id="servoforge3dLiveHead">Head 1</strong></div><div class="servoforge-3d-metric hardware"><span>Hardware catalog</span><strong id="servoforge3dHardwareCatalog">—</strong></div>
            <div class="servoforge-3d-metric hardware"><span>Machine map</span><strong id="servoforge3dMapName">—</strong></div><div class="servoforge-3d-metric hardware"><span>Equipment</span><strong id="servoforge3dEquipmentCount">—</strong></div><div class="servoforge-3d-metric sensor"><span>Sensors</span><strong id="servoforge3dSensors">—</strong></div><div class="servoforge-3d-metric coder"><span>Coders</span><strong id="servoforge3dCoders">—</strong></div><div class="servoforge-3d-metric physical"><span>Measured wipe pads</span><strong id="servoforge3dMeasuredPads">—</strong></div>
            <div class="servoforge-3d-metric physical"><span>Pitch radius</span><strong id="servoforge3dPitchRadius">—</strong></div><div class="servoforge-3d-metric physical"><span>Effective diameter</span><strong id="servoforge3dBottleDiameter">—</strong></div><div class="servoforge-3d-metric"><span>Event</span><strong id="servoforge3dEvent">—</strong></div><div class="servoforge-3d-metric"><span>Motion</span><strong id="servoforge3dMotion">—</strong></div><div class="servoforge-3d-metric action"><span>Action</span><strong id="servoforge3dAction">Waiting for Servo Program</strong></div><div class="servoforge-3d-metric"><span>Stage</span><strong id="servoforge3dStageName">—</strong></div>
          </div>
          <div class="servoforge-3d-help">Drag to orbit • Wheel to zoom</div><div id="servoforge3dError" class="servoforge-3d-error" hidden></div>
        </div>
      </section>`;
    document.body.appendChild(backdrop);

    ui = {
      openButton,
      backdrop,
      stage: backdrop.querySelector("#servoforge3dStage"),
      canvas: backdrop.querySelector("#servoforge3dCanvas"),
      closeButton: backdrop.querySelector("#servoforge3dClose"),
      followButton: backdrop.querySelector("#servoforge3dFollow"),
      error: backdrop.querySelector("#servoforge3dError"),
      machineAngle: backdrop.querySelector("#servoforge3dMachineAngle"),
      servoAngle: backdrop.querySelector("#servoforge3dServoAngle"),
      command: backdrop.querySelector("#servoforge3dCommand"),
      liveHead: backdrop.querySelector("#servoforge3dLiveHead"),
      hardwareCatalog: backdrop.querySelector("#servoforge3dHardwareCatalog"),
      mapName: backdrop.querySelector("#servoforge3dMapName"),
      equipmentCount: backdrop.querySelector("#servoforge3dEquipmentCount"),
      sensors: backdrop.querySelector("#servoforge3dSensors"),
      coders: backdrop.querySelector("#servoforge3dCoders"),
      measuredPads: backdrop.querySelector("#servoforge3dMeasuredPads"),
      pitchRadius: backdrop.querySelector("#servoforge3dPitchRadius"),
      bottleDiameter: backdrop.querySelector("#servoforge3dBottleDiameter"),
      event: backdrop.querySelector("#servoforge3dEvent"),
      motion: backdrop.querySelector("#servoforge3dMotion"),
      action: backdrop.querySelector("#servoforge3dAction"),
      stageName: backdrop.querySelector("#servoforge3dStageName")
    };

    openButton.onclick = openViewport;
    ui.closeButton.onclick = closeViewport;
    ui.followButton.onclick = () => {
      followHead = !followHead;
      ui.followButton.setAttribute("aria-pressed", String(followHead));
      if (followHead) focusHead();
    };
    backdrop.querySelectorAll("[data-3d-camera]").forEach((button) => {
      button.onclick = () => setCameraPreset(button.getAttribute("data-3d-camera"));
    });
    backdrop.onclick = (event) => { if (event.target === backdrop) closeViewport(); };
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && viewportOpen) closeViewport();
    });
    return ui;
  }

  async function ensureThree() {
    if (THREE) return THREE;
    if (!enginePromise) enginePromise = import(THREE_MODULE_URL).then((module) => (THREE = module));
    return enginePromise;
  }

  function disposeObject3D(object) {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
      const dispose = (entry) => { entry?.map?.dispose?.(); entry?.dispose?.(); };
      if (Array.isArray(child.material)) child.material.forEach(dispose);
      else dispose(child.material);
    });
  }

  function clearLayer(layer, collection) {
    collection.forEach((assembly) => {
      layer?.remove(assembly);
      disposeObject3D(assembly);
    });
    collection.length = 0;
  }

  function equipmentSignature(snapshot) {
    const equipment = snapshot?.equipment || {};
    return [
      equipment.mapId,
      equipment.mapName,
      snapshot?.geometry?.bottle?.diameterWorld,
      snapshot?.geometry?.bottle?.visualHeightWorld,
      ...(equipment.aggregates || []).map((item) => `${item.aggregate}:${item.angleDegrees}`),
      ...(equipment.objects || []).map((item) => [
        item.id,
        item.kind,
        item.angleDegrees,
        item.mapDepthUnits,
        item.spanDegrees,
        item.sensorFieldOfViewDegrees,
        item.wipePad?.contactFaceRadiusWorld
      ].join(":"))
    ].join("|");
  }

  function rebuildEquipment(snapshot) {
    const signature = equipmentSignature(snapshot);
    if (signature === lastEquipmentSignature) return;
    lastEquipmentSignature = signature;
    clearLayer(aggregateLayer, aggregateAssemblies);
    clearLayer(equipmentLayer, equipmentAssemblies);
    const factory = hardwareFactory();
    (snapshot?.equipment?.aggregates || []).forEach((item) => {
      const assembly = factory?.createAggregateAssembly?.(THREE, item, snapshot.geometry);
      if (!assembly) return;
      aggregateAssemblies.push(assembly);
      aggregateLayer.add(assembly);
    });
    (snapshot?.equipment?.objects || []).forEach((item) => {
      const assembly = factory?.createEquipmentAssembly?.(THREE, item, snapshot.geometry);
      if (!assembly) return;
      equipmentAssemblies.push(assembly);
      equipmentLayer.add(assembly);
    });
  }

  function createMachineScene() {
    scene = new THREE.Scene();
    scene.name = "ServoForgeCanonicalBottleHandlingScene";
    scene.userData.sceneAuthority = "starwheel-bottle-handling-only";
    scene.userData.legacyCarouselEnvironment = false;
    scene.background = new THREE.Color(0x071117);
    scene.fog = new THREE.Fog(0x071117, 12, 24);

    camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
    cameraState.target = new THREE.Vector3(0, 0.72, 0);

    renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.add(new THREE.HemisphereLight(0xa9d8ef, 0x101519, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(5, 8, 4);
    key.castShadow = false;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xff8a5c, 0.55);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8.5, 96),
      material({ color: 0x0b171d, roughness: 0.86, metalness: 0.05 })
    );
    floor.name = "ServoForgeBottleHandlingFloor";
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = false;
    scene.add(floor);

    const grid = new THREE.GridHelper(16, 32, 0x36505b, 0x1e3038);
    grid.name = "ServoForgeBottleHandlingGrid";
    grid.position.y = 0.002;
    scene.add(grid);

    aggregateLayer = new THREE.Group();
    aggregateLayer.name = "ServoForgePhotoReferencedApplicationAssemblies";
    scene.add(aggregateLayer);

    equipmentLayer = new THREE.Group();
    equipmentLayer.name = "ServoForgePhotoReferencedMachineHardware";
    scene.add(equipmentLayer);

    bindCameraControls();
    setCameraPreset("operator");
    resizeObserver = new ResizeObserver(resizeRenderer);
    resizeObserver.observe(ui.stage);
    resizeRenderer();
  }

  function updateActivityHighlight(snapshot) {
    const activeAggregate = Number(snapshot?.scene?.activity?.aggregate);
    const activeStage = String(snapshot?.scene?.activity?.stage || "").toLowerCase();
    aggregateAssemblies.forEach((assembly) => {
      const active = Number.isFinite(activeAggregate) && Number(assembly.userData.aggregate) === activeAggregate;
      (assembly.userData.highlightMaterials || []).forEach((entry) => {
        entry.emissive?.setHex?.(active ? 0x4c2a12 : 0x000000);
        entry.emissiveIntensity = active ? 0.58 : 0;
      });
    });
    equipmentAssemblies.forEach((assembly) => {
      const sameStation = Number.isFinite(activeAggregate) && Number(assembly.userData.station) === activeAggregate;
      const kind = String(assembly.userData.kind || "");
      const active = sameStation && (
        (activeStage === "wipe" && (kind === "pad" || kind === "roller"))
        || (activeStage.includes("sensor") && kind === "sensor")
        || (activeStage.includes("cod") && kind === "coding")
      );
      (assembly.userData.contactMaterials || assembly.userData.highlightMaterials || []).forEach((entry) => {
        entry.emissive?.setHex?.(active ? 0x4f1708 : 0x000000);
        entry.emissiveIntensity = active ? 0.42 : 0;
      });
    });
  }

  function bindCameraControls() {
    const canvas = ui.canvas;
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      cameraState.dragging = true;
      cameraState.pointerId = event.pointerId;
      cameraState.lastX = event.clientX;
      cameraState.lastY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!cameraState.dragging || event.pointerId !== cameraState.pointerId) return;
      const dx = event.clientX - cameraState.lastX;
      const dy = event.clientY - cameraState.lastY;
      cameraState.lastX = event.clientX;
      cameraState.lastY = event.clientY;
      cameraState.azimuth -= dx * 0.006;
      cameraState.polar = clamp(cameraState.polar + dy * 0.006, 0.07, Math.PI * 0.49);
      applyCamera();
    });
    const release = (event) => {
      if (event.pointerId !== cameraState.pointerId) return;
      cameraState.dragging = false;
      cameraState.pointerId = null;
      canvas.releasePointerCapture?.(event.pointerId);
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      cameraState.distance = clamp(cameraState.distance * Math.exp(event.deltaY * 0.0011), 2.2, 20);
      applyCamera();
    }, { passive: false });
  }

  function applyCamera() {
    if (!camera || !cameraState.target) return;
    const sinPolar = Math.sin(cameraState.polar);
    camera.position.set(
      cameraState.target.x + cameraState.distance * sinPolar * Math.cos(cameraState.azimuth),
      cameraState.target.y + cameraState.distance * Math.cos(cameraState.polar),
      cameraState.target.z + cameraState.distance * sinPolar * Math.sin(cameraState.azimuth)
    );
    camera.lookAt(cameraState.target);
  }

  function setCameraPreset(name) {
    if (!cameraState.target || !THREE) return;
    const outerWorld = number(lastSnapshot?.geometry?.machine?.carouselOuterRadiusWorld, 3.8);
    if (name === "top") {
      camera.up.set(0, 0, -1);
      cameraState.target.set(0, 0.30, 0);
      cameraState.azimuth = Math.PI * 0.5;
      cameraState.polar = 0.07;
      cameraState.distance = Math.max(10.5, outerWorld * 2.75);
    } else {
      camera.up.set(0, 1, 0);
      cameraState.target.set(0, 0.76, 0);
      cameraState.azimuth = Math.PI * 0.22;
      cameraState.polar = Math.PI * 0.31;
      cameraState.distance = Math.max(9.5, outerWorld * 2.45);
      if (name === "reset") followHead = false;
    }
    if (ui?.followButton) ui.followButton.setAttribute("aria-pressed", String(followHead));
    applyCamera();
  }

  function focusHead() {
    if (!cameraState.target) return;
    const handling = handlingViewport()?.latestSnapshot?.();
    const bottle = handling?.bottles?.find?.((entry) => entry?.owner === "carousel");
    const fallback = lastSnapshot?.carousel?.heads?.[0];
    const point = bottle?.position || fallback?.position;
    if (!point) return;
    cameraState.target.set(number(point.x), 0.76, number(point.z));
    cameraState.distance = Math.min(cameraState.distance, 4.6);
    applyCamera();
  }

  function resizeRenderer() {
    if (!renderer || !camera || !ui?.stage) return;
    const width = Math.max(1, ui.stage.clientWidth);
    const height = Math.max(1, ui.stage.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function updateTelemetry(snapshot) {
    const active = snapshot?.scene?.activeServo;
    const activity = snapshot?.scene?.activity || {};
    const flags = snapshot?.scene?.flags || {};
    const geometry = snapshot?.geometry || {};
    const equipment = snapshot?.equipment || {};
    const counts = equipment.counts || {};
    const catalogStatus = hardwareCatalog()?.status?.();
    const setText = (node, value) => {
      const next = String(value);
      if (node && node.textContent !== next) node.textContent = next;
    };
    setText(ui.machineAngle, formatDegrees(snapshot?.scene?.carousel?.machineAngleDegrees));
    setText(ui.servoAngle, formatDegrees(snapshot?.scene?.bottle?.servoAngleDegrees));
    setText(ui.command, active ? `HMI ${active.hmi} • CMD ${active.command}` : "No active row");
    setText(ui.liveHead, `Head ${snapshot?.carousel?.activeHead || 1}`);
    setText(ui.hardwareCatalog, catalogStatus ? `${catalogStatus.profileCount} profiles • photo ref` : "Unavailable");
    setText(ui.mapName, equipment.mapName || "—");
    setText(ui.equipmentCount, `${equipment?.aggregates?.length || 0} spender • ${equipment?.objects?.length || 0} map objects`);
    setText(ui.sensors, `${number(counts.sensors)} visible`);
    setText(ui.coders, `${number(counts.coding)} visible`);
    setText(ui.measuredPads, `${number(counts.measuredPads)}/${number(counts.pads)} measured`);
    setText(ui.pitchRadius, formatMillimeters(geometry.machine?.physicalPitchRadiusMm, 3));
    setText(ui.bottleDiameter, formatMillimeters(geometry.bottle?.effectiveDiameterMm, 2));
    setText(ui.event, activity.eventId || "—");
    setText(ui.motion, flags.executesRotation ? "Rotating" : flags.hold ? "Holding" : "Idle");
    setText(ui.action, active?.action || "Waiting for Servo Program");
    setText(ui.stageName, [activity.section, activity.stage].filter(Boolean).join(" / ") || "—");
  }

  function applySnapshot(snapshot) {
    if (!snapshot?.scene || !snapshot?.carousel || !snapshot?.equipment || !snapshot?.labels) return;
    rebuildEquipment(snapshot);
    updateActivityHighlight(snapshot);
    handlingViewport()?.sync?.(snapshot);
    if (followHead) focusHead();
    updateTelemetry(snapshot);
  }

  function renderFrame(timestamp) {
    if (!viewportOpen || !renderer || !scene || !camera) return;
    try {
      const activeRuntime = runtime();
      if (!activeRuntime?.snapshot) throw new Error("3D scene runtime is unavailable.");
      lastSnapshot = activeRuntime.snapshot({
        scene: { tableY: 0.20, bottleLift: 0.155, unitMode: "physical-mm-starwheel-only-v303" }
      });
      applySnapshot(lastSnapshot);
      global.Labeler3DPresentationFrameCoordinator?.frame?.({
        timestamp,
        snapshot: lastSnapshot,
        scene,
        camera,
        renderer
      });
      ui.error.hidden = true;
      renderer.render(scene, camera);
    } catch (error) {
      ui.error.hidden = false;
      ui.error.textContent = `3D frame unavailable: ${error?.message || error}`;
    }
    animationFrame = global.requestAnimationFrame(renderFrame);
  }

  async function openViewport() {
    installUi();
    ui.backdrop.hidden = false;
    viewportOpen = true;
    viewportSingleton.open = true;
    try {
      await ensureThree();
      if (!hardwareFactory()?.createEquipmentAssembly) throw new Error("3D hardware mesh factory is unavailable.");
      if (!handlingViewport()?.attachScene) throw new Error("3D bottle-handling viewport is unavailable.");
      if (!renderer) createMachineScene();
      await handlingViewport().attachScene(scene);
      resizeRenderer();
      ui.error.hidden = true;
      if (animationFrame !== null) global.cancelAnimationFrame(animationFrame);
      animationFrame = global.requestAnimationFrame(renderFrame);
    } catch (error) {
      ui.error.hidden = false;
      ui.error.textContent = `Unable to start the 3D bottle-handling renderer. ${error?.message || error}`;
      console.error("ServoForge 3D bottle-handling renderer failed", error);
    }
  }

  function closeViewport() {
    if (!ui) return;
    viewportOpen = false;
    viewportSingleton.open = false;
    ui.backdrop.hidden = true;
    if (animationFrame !== null) {
      global.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function status() {
    return Object.freeze({
      version: VIEWPORT_VERSION,
      threeVersion: THREE_VERSION,
      installed: Boolean(ui),
      engineReady: Boolean(THREE && renderer),
      open: viewportOpen,
      followHead,
      sceneName: scene?.name || null,
      sceneAuthority: "starwheel-bottle-handling-only",
      legacyCarouselEnvironment: false,
      genericCarouselConstructed: false,
      handlingAttached: Boolean(handlingViewport()?.status?.().installed),
      hardwareCatalog: hardwareCatalog()?.CATALOG_VERSION || null,
      hardwareFactory: hardwareFactory()?.FACTORY_VERSION || null,
      sensorsRendered: true,
      coderRendered: true,
      measuredWipePads: true,
      spenderPhotoReference: true,
      readOnly: true,
      sensorLogicUntouched: true,
      coderLogicUntouched: true,
      plannerPitchGeometryUntouched: true,
      source: "Labeler3DSceneRuntime.snapshot"
    });
  }

  function installWhenReady(attempt = 0) {
    if (!runtime()?.snapshot || !hardwareFactory()?.createEquipmentAssembly || !handlingViewport()?.attachScene) {
      if (attempt < 160) global.setTimeout(() => installWhenReady(attempt + 1), 25);
      return;
    }
    if (!installUi() && attempt < 160) {
      global.setTimeout(() => installWhenReady(attempt + 1), 25);
      return;
    }
    global.Labeler3DViewport = Object.freeze({
      VIEWPORT_VERSION,
      THREE_VERSION,
      open: openViewport,
      close: closeViewport,
      status,
      resetCamera: () => setCameraPreset("reset"),
      topCamera: () => setCameraPreset("top"),
      focusHead
    });
    viewportSingleton.api = global.Labeler3DViewport;
    viewportSingleton.installing = false;
    viewportSingleton.installed = true;
  }

  installWhenReady();
})(window);
