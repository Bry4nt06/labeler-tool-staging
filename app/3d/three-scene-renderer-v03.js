(function installServoForge3DFullCarouselViewport(global) {
  "use strict";

  const VIEWPORT_VERSION = "servoforge.3d-viewport.v0.3";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const REFERENCE_PITCH_RADIUS_WORLD = 2.55;
  const REFERENCE_OUTER_RADIUS_WORLD = 3.18;
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;

  let THREE = null;
  let enginePromise = null;
  let scene = null;
  let camera = null;
  let renderer = null;
  let resizeObserver = null;
  let animationFrame = null;
  let viewportOpen = false;
  let followTable = false;
  let lastSnapshot = null;
  let lastMachineSignature = "";
  let lastPopulationSignature = "";
  let carouselBody = null;
  let carouselTop = null;
  let pathRing = null;
  let hub = null;
  let referencePost = null;
  let headLayer = null;
  let headAssemblies = [];
  let activeServoPlate = null;
  let activeBottleModel = null;
  let ui = null;

  const cameraState = {
    azimuth: Math.PI * 0.22,
    polar: Math.PI * 0.32,
    distance: 7.6,
    target: null,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0
  };

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatDegrees(value, decimals = 1) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric.toFixed(decimals)}°` : "—";
  }

  function formatMillimeters(value, decimals = 1) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric.toFixed(decimals)} mm` : "—";
  }

  function material(options) {
    return new THREE.MeshStandardMaterial(options);
  }

  function installStyles() {
    if (document.querySelector("#servoforge3dViewportStyles")) return;
    const style = document.createElement("style");
    style.id = "servoforge3dViewportStyles";
    style.textContent = `
      .servoforge-3d-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(2,8,12,.72);backdrop-filter:blur(7px);padding:clamp(14px,3vw,34px);display:flex;align-items:center;justify-content:center}
      .servoforge-3d-backdrop[hidden]{display:none!important}
      .servoforge-3d-panel{width:min(1240px,96vw);height:min(850px,92vh);min-height:540px;background:#071117;border:1px solid rgba(137,174,190,.32);border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.55);overflow:hidden;display:grid;grid-template-rows:auto 1fr;color:#edf5f7}
      .servoforge-3d-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid rgba(137,174,190,.18);background:linear-gradient(180deg,rgba(17,38,47,.98),rgba(8,22,29,.98))}
      .servoforge-3d-title{display:flex;align-items:center;gap:12px;min-width:0}.servoforge-3d-title h2{margin:0;font-size:17px}.servoforge-3d-title small{display:block;color:#91a9b4;margin-top:2px;font-size:11px}
      .servoforge-3d-live{width:9px;height:9px;border-radius:50%;background:#35d18a;box-shadow:0 0 12px rgba(53,209,138,.7);flex:0 0 auto}
      .servoforge-3d-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.servoforge-3d-controls button{border:1px solid rgba(150,183,197,.28);background:#122833;color:#eef7fa;border-radius:8px;padding:7px 10px;font:inherit;font-size:11px;font-weight:700;cursor:pointer}.servoforge-3d-controls button:hover{background:#193846}.servoforge-3d-controls button[aria-pressed="true"]{border-color:#ff784d;color:#ffb095;background:#2d1d18}
      .servoforge-3d-stage{position:relative;min-height:0;background:radial-gradient(circle at 50% 38%,#18313d 0,#09171e 50%,#050c11 100%);overflow:hidden}.servoforge-3d-canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}.servoforge-3d-canvas:active{cursor:grabbing}
      .servoforge-3d-telemetry{position:absolute;left:14px;bottom:14px;display:grid;grid-template-columns:repeat(5,minmax(112px,1fr));gap:8px;width:min(1080px,calc(100% - 28px));pointer-events:none}.servoforge-3d-metric{background:rgba(5,15,20,.84);border:1px solid rgba(137,174,190,.2);border-radius:10px;padding:8px 9px;box-shadow:0 8px 24px rgba(0,0,0,.2);min-width:0}.servoforge-3d-metric span{display:block;color:#829ba7;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.servoforge-3d-metric strong{display:block;margin-top:3px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.servoforge-3d-metric.action{grid-column:span 2}.servoforge-3d-metric.physical strong{color:#b9f4d8}.servoforge-3d-metric.live strong{color:#ffad8f}
      .servoforge-3d-note{position:absolute;right:14px;top:14px;max-width:350px;background:rgba(5,15,20,.78);border:1px solid rgba(137,174,190,.16);border-radius:9px;padding:8px 10px;color:#9db2bb;font-size:10px;line-height:1.4;pointer-events:none}.servoforge-3d-note strong{color:#ffd1c1}
      .servoforge-3d-help{position:absolute;right:14px;bottom:14px;background:rgba(5,15,20,.72);border:1px solid rgba(137,174,190,.16);border-radius:9px;padding:8px 10px;color:#8ca3ad;font-size:10px;pointer-events:none}
      .servoforge-3d-error{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);max-width:560px;background:rgba(75,22,18,.94);border:1px solid rgba(255,120,77,.55);border-radius:12px;padding:14px 16px;color:#ffe7df;font-size:12px;line-height:1.45;text-align:center}
      @media(max-width:820px){.servoforge-3d-backdrop{padding:8px}.servoforge-3d-panel{width:100%;height:94vh;min-height:500px;border-radius:12px}.servoforge-3d-head{align-items:flex-start;flex-direction:column}.servoforge-3d-controls{justify-content:flex-start}.servoforge-3d-telemetry{grid-template-columns:repeat(2,minmax(100px,1fr));width:calc(100% - 28px);bottom:46px}.servoforge-3d-metric.action{grid-column:span 2}.servoforge-3d-help{left:14px;right:auto}.servoforge-3d-note{top:8px;right:8px;max-width:240px}}
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

    const backdrop = document.createElement("div");
    backdrop.id = "servoforge3dBackdrop";
    backdrop.className = "servoforge-3d-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="servoforge-3d-panel" role="dialog" aria-modal="true" aria-labelledby="servoforge3dTitle">
        <header class="servoforge-3d-head">
          <div class="servoforge-3d-title"><span class="servoforge-3d-live" aria-hidden="true"></span><div><h2 id="servoforge3dTitle">ServoForge 3D • Full Carousel</h2><small>Physical bottle profile • full bottle-table population • read only • Three.js ${THREE_VERSION}</small></div></div>
          <div class="servoforge-3d-controls">
            <button type="button" data-3d-camera="operator">Operator</button>
            <button type="button" data-3d-camera="top">Top</button>
            <button type="button" data-3d-camera="reset">Reset Camera</button>
            <button type="button" id="servoforge3dFollow" aria-pressed="false">Follow Head 1</button>
            <button type="button" id="servoforge3dClose">Close</button>
          </div>
        </header>
        <div class="servoforge-3d-stage" id="servoforge3dStage">
          <canvas class="servoforge-3d-canvas" id="servoforge3dCanvas" aria-label="Live full-carousel ServoForge 3D simulation"></canvas>
          <div class="servoforge-3d-note"><strong>Head 1 is live.</strong> Every bottle table is positioned from the machine head count and pitch radius. Passive heads intentionally use neutral servo orientation until multi-bottle replay is added.</div>
          <div class="servoforge-3d-telemetry" aria-live="polite">
            <div class="servoforge-3d-metric"><span>Machine angle</span><strong id="servoforge3dMachineAngle">—</strong></div>
            <div class="servoforge-3d-metric"><span>Bottle servo</span><strong id="servoforge3dServoAngle">—</strong></div>
            <div class="servoforge-3d-metric"><span>Active command</span><strong id="servoforge3dCommand">—</strong></div>
            <div class="servoforge-3d-metric live"><span>Live head</span><strong id="servoforge3dLiveHead">Head 1</strong></div>
            <div class="servoforge-3d-metric physical"><span>Bottle tables</span><strong id="servoforge3dHeadCount">—</strong></div>
            <div class="servoforge-3d-metric physical"><span>Active bottle</span><strong id="servoforge3dBottleName">—</strong></div>
            <div class="servoforge-3d-metric physical"><span>Effective diameter</span><strong id="servoforge3dBottleDiameter">—</strong></div>
            <div class="servoforge-3d-metric physical"><span>Pitch radius</span><strong id="servoforge3dPitchRadius">—</strong></div>
            <div class="servoforge-3d-metric"><span>Event</span><strong id="servoforge3dEvent">—</strong></div>
            <div class="servoforge-3d-metric"><span>Motion</span><strong id="servoforge3dMotion">—</strong></div>
            <div class="servoforge-3d-metric action"><span>Action</span><strong id="servoforge3dAction">Waiting for Servo Program</strong></div>
            <div class="servoforge-3d-metric"><span>Stage</span><strong id="servoforge3dStageName">—</strong></div>
          </div>
          <div class="servoforge-3d-help">Drag to orbit • Wheel to zoom</div>
          <div id="servoforge3dError" class="servoforge-3d-error" hidden></div>
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
      headCount: backdrop.querySelector("#servoforge3dHeadCount"),
      bottleName: backdrop.querySelector("#servoforge3dBottleName"),
      bottleDiameter: backdrop.querySelector("#servoforge3dBottleDiameter"),
      pitchRadius: backdrop.querySelector("#servoforge3dPitchRadius"),
      event: backdrop.querySelector("#servoforge3dEvent"),
      motion: backdrop.querySelector("#servoforge3dMotion"),
      action: backdrop.querySelector("#servoforge3dAction"),
      stageName: backdrop.querySelector("#servoforge3dStageName")
    };

    openButton.addEventListener("click", openViewport);
    ui.closeButton.addEventListener("click", closeViewport);
    ui.followButton.addEventListener("click", () => {
      followTable = !followTable;
      ui.followButton.setAttribute("aria-pressed", String(followTable));
      if (followTable && lastSnapshot) focusTable(lastSnapshot);
    });
    backdrop.querySelectorAll("[data-3d-camera]").forEach((button) => {
      button.addEventListener("click", () => setCameraPreset(button.getAttribute("data-3d-camera")));
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeViewport();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && viewportOpen) closeViewport();
    });
    return ui;
  }

  async function ensureThree() {
    if (THREE) return THREE;
    if (!enginePromise) {
      enginePromise = import(THREE_MODULE_URL).then((module) => {
        THREE = module;
        return THREE;
      });
    }
    return enginePromise;
  }

  function bottleProfile(geometry) {
    const supplied = geometry?.bottle?.profilePointsWorld;
    if (Array.isArray(supplied) && supplied.length >= 4) {
      return supplied.map((point) => new THREE.Vector2(number(point.radius), number(point.y)));
    }
    return [
      [0.27, 0.00], [0.30, 0.05], [0.31, 0.18], [0.31, 1.02],
      [0.30, 1.14], [0.26, 1.26], [0.18, 1.37], [0.12, 1.44],
      [0.115, 1.85], [0.13, 1.90]
    ].map(([radius, y]) => new THREE.Vector2(radius, y));
  }

  function createBottleModel(geometry) {
    const group = new THREE.Group();
    group.name = "ServoForgeLiveBottle";
    const profile = bottleProfile(geometry);
    const bodyRadius = Math.max(...profile.map((point) => point.x));
    const height = Math.max(...profile.map((point) => point.y));
    const unitsPerMm = number(geometry?.renderScale?.worldUnitsPerMm, 0.00445);
    const finishRadius = number(geometry?.bottle?.finishOuterDiameterMm, 26.6) * unitsPerMm / 2;

    const glass = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 72),
      material({ color: 0x70401f, roughness: 0.27, metalness: 0.02 })
    );
    glass.castShadow = true;
    glass.receiveShadow = true;
    group.add(glass);

    const capHeight = Math.max(0.024, 6 * unitsPerMm);
    const capRadius = Math.max(finishRadius * 1.08, bodyRadius * 0.20);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(capRadius, capRadius * 1.01, capHeight, 40),
      material({ color: 0x3387c8, roughness: 0.32, metalness: 0.42 })
    );
    cap.position.y = height + capHeight / 2;
    cap.castShadow = true;
    group.add(cap);

    const markerHeight = Math.max(0.26, Math.min(height * 0.42, number(geometry?.bottle?.bodyStraightHeightMm, 92) * unitsPerMm * 0.86));
    const markerThickness = Math.max(0.010, bodyRadius * 0.08);
    const frontMarker = new THREE.Mesh(
      new THREE.BoxGeometry(markerThickness, markerHeight, Math.max(0.025, bodyRadius * 0.24)),
      new THREE.MeshStandardMaterial({ color: 0xff6a3d, emissive: 0x421308, emissiveIntensity: 0.42, roughness: 0.35 })
    );
    frontMarker.position.set(bodyRadius + markerThickness * 0.45, Math.max(markerHeight / 2 + 0.04, height * 0.25), 0);
    group.add(frontMarker);

    const datum = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(0.028, bodyRadius * 0.20), Math.max(0.10, bodyRadius * 0.70), 24),
      new THREE.MeshStandardMaterial({ color: 0xffd3c4, emissive: 0x5b1709, emissiveIntensity: 0.25 })
    );
    datum.rotation.z = -Math.PI / 2;
    datum.position.set(bodyRadius + Math.max(0.05, bodyRadius * 0.35), Math.min(height * 0.55, 125 * unitsPerMm), 0);
    group.add(datum);
    return group;
  }

  function createHeadAssembly(headNumber, geometry) {
    const active = headNumber === 1;
    const group = new THREE.Group();
    group.name = `ServoForgeBottleTable${headNumber}`;
    group.userData.headNumber = headNumber;

    const baseRadius = number(geometry?.bottleTable?.baseDiameterWorld, 0.36) / 2;
    const plateRadius = number(geometry?.bottleTable?.plateDiameterWorld, 0.30) / 2;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(baseRadius, baseRadius * 1.035, 0.16, 40),
      material({
        color: active ? 0x30221e : 0x151e23,
        roughness: 0.30,
        metalness: 0.82,
        emissive: active ? 0x351006 : 0x000000,
        emissiveIntensity: active ? 0.32 : 0
      })
    );
    base.position.y = 0.08;
    base.castShadow = active;
    base.receiveShadow = true;
    group.add(base);

    const plateGroup = new THREE.Group();
    plateGroup.name = `ServoPlate${headNumber}`;
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(plateRadius, plateRadius, 0.07, 40),
      material({ color: active ? 0x777d80 : 0x555f64, roughness: 0.24, metalness: 0.90 })
    );
    plate.position.y = 0.195;
    plate.castShadow = active;
    plateGroup.add(plate);

    const datum = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.05, plateRadius * 0.55), 0.024, Math.max(0.018, plateRadius * 0.12)),
      new THREE.MeshStandardMaterial({
        color: active ? 0xff6a3d : 0x9ba8ae,
        emissive: active ? 0x4a1408 : 0x000000,
        emissiveIntensity: active ? 0.55 : 0,
        roughness: 0.36
      })
    );
    datum.position.set(plateRadius * 0.72, 0.24, 0);
    plateGroup.add(datum);
    group.add(plateGroup);

    if (active) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(baseRadius * 1.08, 0.018, 10, 48),
        new THREE.MeshStandardMaterial({ color: 0xff6a3d, emissive: 0x8a240d, emissiveIntensity: 0.85, roughness: 0.30 })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.245;
      group.add(halo);
      const bottle = createBottleModel(geometry);
      bottle.position.y = BOTTLE_LIFT;
      group.add(bottle);
      activeServoPlate = plateGroup;
      activeBottleModel = bottle;
    }

    return group;
  }

  function disposeObject3D(object) {
    if (!object) return;
    object.traverse((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((item) => item?.dispose?.());
      else child.material?.dispose?.();
    });
  }

  function clearHeadPopulation() {
    headAssemblies.forEach((assembly) => {
      headLayer?.remove(assembly);
      disposeObject3D(assembly);
    });
    headAssemblies = [];
    activeServoPlate = null;
    activeBottleModel = null;
  }

  function populationSignature(snapshot) {
    const geometry = snapshot?.geometry;
    return [
      snapshot?.carousel?.headCount,
      geometry?.bottle?.bottleType,
      geometry?.bottle?.effectiveDiameterMm,
      geometry?.bottle?.referenceHeightMm,
      geometry?.bottleTable?.baseDiameterWorld,
      geometry?.bottleTable?.plateDiameterWorld
    ].join("|");
  }

  function rebuildCarouselHeads(snapshot) {
    const signature = populationSignature(snapshot);
    if (signature === lastPopulationSignature && headAssemblies.length === number(snapshot?.carousel?.headCount, 0)) return;
    lastPopulationSignature = signature;
    clearHeadPopulation();
    const count = Math.max(1, Math.round(number(snapshot?.carousel?.headCount, 1)));
    for (let head = 1; head <= count; head += 1) {
      const assembly = createHeadAssembly(head, snapshot.geometry);
      headAssemblies.push(assembly);
      headLayer.add(assembly);
    }
  }

  function createMachineScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071117);
    scene.fog = new THREE.Fog(0x071117, 9, 18);
    camera = new THREE.PerspectiveCamera(42, 1, 0.05, 50);
    cameraState.target = new THREE.Vector3(0, 0.72, 0);

    renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.add(new THREE.HemisphereLight(0xa9d8ef, 0x101519, 1.55));
    const key = new THREE.DirectionalLight(0xffffff, 2.15);
    key.position.set(4.5, 7, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xff8a5c, 0.62);
    fill.position.set(-4, 3, -3);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(6.3, 96),
      material({ color: 0x0b171d, roughness: 0.86, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(12, 24, 0x36505b, 0x1e3038);
    grid.position.y = 0.002;
    scene.add(grid);

    carouselBody = new THREE.Mesh(
      new THREE.CylinderGeometry(REFERENCE_OUTER_RADIUS_WORLD, REFERENCE_OUTER_RADIUS_WORLD * 1.035, 0.20, 96),
      material({ color: 0x202b31, roughness: 0.42, metalness: 0.72 })
    );
    carouselBody.position.y = 0.10;
    carouselBody.receiveShadow = true;
    carouselBody.castShadow = true;
    scene.add(carouselBody);

    carouselTop = new THREE.Mesh(
      new THREE.CylinderGeometry(REFERENCE_OUTER_RADIUS_WORLD * 0.93, REFERENCE_OUTER_RADIUS_WORLD * 0.93, 0.035, 96),
      material({ color: 0x35434a, roughness: 0.34, metalness: 0.78 })
    );
    carouselTop.position.y = 0.218;
    carouselTop.receiveShadow = true;
    scene.add(carouselTop);

    pathRing = new THREE.Mesh(
      new THREE.TorusGeometry(REFERENCE_PITCH_RADIUS_WORLD, 0.024, 10, 160),
      new THREE.MeshStandardMaterial({ color: 0xff6a3d, emissive: 0x4a1408, emissiveIntensity: 0.42, roughness: 0.35 })
    );
    pathRing.rotation.x = Math.PI / 2;
    pathRing.position.y = 0.247;
    scene.add(pathRing);

    hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.82, 0.34, 64),
      material({ color: 0x10191e, roughness: 0.3, metalness: 0.82 })
    );
    hub.position.y = 0.34;
    hub.castShadow = true;
    scene.add(hub);

    headLayer = new THREE.Group();
    headLayer.name = "ServoForgeBottleTablePopulation";
    scene.add(headLayer);

    referencePost = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 1.20, 0.22),
      material({ color: 0x31434b, roughness: 0.36, metalness: 0.62 })
    );
    post.position.y = 0.6;
    referencePost.add(post);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.20, 0.48),
      new THREE.MeshStandardMaterial({ color: 0xb74e31, emissive: 0x2a0c05, emissiveIntensity: 0.25, roughness: 0.42 })
    );
    head.position.set(-0.22, 1.05, 0);
    referencePost.add(head);
    scene.add(referencePost);

    const axes = new THREE.AxesHelper(0.72);
    axes.position.y = 0.24;
    scene.add(axes);
    bindCameraControls();
    setCameraPreset("operator");
    resizeObserver = new ResizeObserver(resizeRenderer);
    resizeObserver.observe(ui.stage);
    resizeRenderer();
  }

  function machineSignature(snapshot) {
    return [snapshot?.geometry?.machine?.pitchRadiusWorld, snapshot?.geometry?.machine?.carouselOuterRadiusWorld].join("|");
  }

  function syncMachineGeometry(snapshot) {
    const signature = machineSignature(snapshot);
    if (signature === lastMachineSignature) return;
    lastMachineSignature = signature;
    const pitchWorld = number(snapshot?.geometry?.machine?.pitchRadiusWorld, REFERENCE_PITCH_RADIUS_WORLD);
    const outerWorld = number(snapshot?.geometry?.machine?.carouselOuterRadiusWorld, REFERENCE_OUTER_RADIUS_WORLD);
    const pitchScale = pitchWorld / REFERENCE_PITCH_RADIUS_WORLD;
    const outerScale = outerWorld / REFERENCE_OUTER_RADIUS_WORLD;
    carouselBody.scale.set(outerScale, 1, outerScale);
    carouselTop.scale.set(outerScale, 1, outerScale);
    pathRing.scale.set(pitchScale, 1, pitchScale);
    hub.scale.set(pitchScale, 1, pitchScale);
    if (referencePost) referencePost.position.x = outerWorld + 0.30;
  }

  function applyHeadLayout(snapshot) {
    const heads = Array.isArray(snapshot?.carousel?.heads) ? snapshot.carousel.heads : [];
    heads.forEach((head, index) => {
      const assembly = headAssemblies[index];
      if (!assembly) return;
      assembly.position.set(number(head.position?.x), number(head.position?.y, TABLE_Y), number(head.position?.z));
      assembly.rotation.y = number(head.rotationY);
    });
    if (activeServoPlate) activeServoPlate.rotation.y = number(snapshot?.scene?.bottleTable?.servoRotationY);
    if (activeBottleModel) activeBottleModel.rotation.y = number(snapshot?.scene?.bottle?.servoRotationY);
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
      cameraState.polar = clamp(cameraState.polar + dy * 0.006, 0.08, Math.PI * 0.49);
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
      cameraState.distance = clamp(cameraState.distance * Math.exp(event.deltaY * 0.0011), 2.0, 14);
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
    if (name === "top") {
      cameraState.target.set(0, 0.35, 0);
      cameraState.azimuth = Math.PI * 0.5;
      cameraState.polar = 0.08;
      cameraState.distance = 8.5;
    } else if (name === "reset" || name === "operator") {
      cameraState.target.set(0, 0.76, 0);
      cameraState.azimuth = Math.PI * 0.22;
      cameraState.polar = Math.PI * 0.32;
      cameraState.distance = 7.6;
      if (name === "reset") followTable = false;
    }
    if (ui?.followButton) ui.followButton.setAttribute("aria-pressed", String(followTable));
    applyCamera();
  }

  function focusTable(snapshot = lastSnapshot) {
    const head = snapshot?.carousel?.heads?.[0];
    if (!head?.position || !cameraState.target) return;
    cameraState.target.set(number(head.position.x), 0.76, number(head.position.z));
    cameraState.distance = Math.min(cameraState.distance, 4.2);
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
    ui.machineAngle.textContent = formatDegrees(snapshot?.scene?.carousel?.machineAngleDegrees);
    ui.servoAngle.textContent = formatDegrees(snapshot?.scene?.bottle?.servoAngleDegrees);
    ui.command.textContent = active ? `HMI ${active.hmi} • CMD ${active.command}` : "No active row";
    ui.liveHead.textContent = `Head ${snapshot?.carousel?.activeHead || 1}`;
    ui.headCount.textContent = `${snapshot?.carousel?.headCount || geometry.machine?.headCount || 0} tables`;
    ui.bottleName.textContent = geometry.bottle?.bottleType || "—";
    ui.bottleDiameter.textContent = formatMillimeters(geometry.bottle?.effectiveDiameterMm, 2);
    ui.pitchRadius.textContent = formatMillimeters(geometry.machine?.pitchRadiusMm, 3);
    ui.event.textContent = activity.eventId || "—";
    ui.motion.textContent = flags.executesRotation ? "Rotating" : flags.hold ? "Holding" : "Idle";
    ui.action.textContent = active?.action || "Waiting for Servo Program";
    ui.stageName.textContent = [activity.section, activity.stage].filter(Boolean).join(" / ") || "—";
  }

  function applySnapshot(snapshot) {
    if (!snapshot?.scene || !snapshot?.carousel) return;
    syncMachineGeometry(snapshot);
    rebuildCarouselHeads(snapshot);
    applyHeadLayout(snapshot);
    if (followTable) focusTable(snapshot);
    updateTelemetry(snapshot);
  }

  function renderFrame() {
    if (!viewportOpen || !renderer || !scene || !camera) return;
    try {
      const activeRuntime = runtime();
      if (!activeRuntime?.snapshot) throw new Error("3D scene runtime is unavailable.");
      lastSnapshot = activeRuntime.snapshot({
        scene: {
          tableY: TABLE_Y,
          bottleLift: BOTTLE_LIFT,
          unitMode: "physical-mm-full-carousel-v0.3"
        }
      });
      applySnapshot(lastSnapshot);
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
    try {
      await ensureThree();
      if (!renderer) createMachineScene();
      resizeRenderer();
      ui.error.hidden = true;
      if (animationFrame !== null) global.cancelAnimationFrame(animationFrame);
      animationFrame = global.requestAnimationFrame(renderFrame);
    } catch (error) {
      ui.error.hidden = false;
      ui.error.textContent = `Unable to start the 3D renderer. ${error?.message || error}`;
      console.error("ServoForge 3D full-carousel renderer failed", error);
    }
  }

  function closeViewport() {
    if (!ui) return;
    viewportOpen = false;
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
      followTable,
      fullCarousel: true,
      headCount: lastSnapshot?.carousel?.headCount || 0,
      activeHead: lastSnapshot?.carousel?.activeHead || 1,
      passiveServoMode: lastSnapshot?.carousel?.passiveServoMode || "neutral-no-invented-motion",
      source: "Labeler3DSceneRuntime.snapshot",
      readOnly: true
    });
  }

  function installWhenReady(attempt = 0) {
    if (!runtime()?.snapshot) {
      if (attempt < 120) global.setTimeout(() => installWhenReady(attempt + 1), 25);
      return;
    }
    if (!installUi() && attempt < 120) {
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
      focusTable
    });
  }

  installWhenReady();
})(window);
