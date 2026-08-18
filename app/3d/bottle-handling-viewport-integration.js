(function installServoForge3DBottleHandlingViewport(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.3d-bottle-handling-viewport.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const BOTTLE_BASE_Y = TABLE_Y + BOTTLE_LIFT;
  const STAR_SURFACE_Y = 0.285;

  let THREE = null;
  let threePromise = null;
  let layer = null;
  let layerScene = null;
  let running = false;
  let lastGeometrySignature = "";
  let bottlePool = [];
  let wheelGroups = new Map();
  let staticHardware = [];
  let sharedBottleAssets = null;
  let hiddenLegacyBottleCount = 0;
  let lastHandlingSnapshot = null;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function adapter() {
    return global.Labeler3DBottleHandlingAdapter || null;
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function frameDriver() {
    return global.Labeler3DSimulationFrameDriver || null;
  }

  function sceneAdapter() {
    return global.Labeler3DSceneAdapter || null;
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

  function clearGenerated() {
    bottlePool.forEach((bottle) => {
      bottle.parent?.remove(bottle);
      disposeObject(bottle);
    });
    bottlePool = [];
    wheelGroups.forEach((wheel) => {
      wheel.parent?.remove(wheel);
      disposeObject(wheel);
    });
    wheelGroups.clear();
    staticHardware.forEach((object) => {
      object.parent?.remove(object);
      disposeObject(object);
    });
    staticHardware = [];
    sharedBottleAssets = null;
  }

  function bottleProfile(geometry) {
    const supplied = geometry?.bottle?.profilePointsWorld;
    if (Array.isArray(supplied) && supplied.length >= 4) {
      return supplied.map((point) => new THREE.Vector2(number(point.radius), number(point.y)));
    }
    return [[0.27,0],[0.31,0.18],[0.31,1.02],[0.18,1.37],[0.12,1.85],[0.13,1.90]]
      .map(([radius, y]) => new THREE.Vector2(radius, y));
  }

  function createSharedBottleAssets(geometry) {
    const profile = bottleProfile(geometry);
    const bodyRadius = Math.max(...profile.map((point) => point.x));
    const height = Math.max(...profile.map((point) => point.y));
    const unitsPerMm = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.00445));
    const finishRadius = number(geometry?.bottle?.finishOuterDiameterMm, 26.6) * unitsPerMm / 2;
    const capRadius = Math.max(finishRadius * 1.08, bodyRadius * 0.20);
    const capHeight = Math.max(0.024, 6 * unitsPerMm);
    const markerHeight = Math.max(0.18, height * 0.32);

    return {
      bodyRadius,
      height,
      bodyGeometry: new THREE.LatheGeometry(profile, 48),
      capGeometry: new THREE.CylinderGeometry(capRadius, capRadius, capHeight, 24),
      markerGeometry: new THREE.BoxGeometry(
        Math.max(0.009, bodyRadius * 0.07),
        markerHeight,
        Math.max(0.022, bodyRadius * 0.20)
      ),
      capHeight,
      markerHeight,
      glassMaterial: new THREE.MeshStandardMaterial({ color: 0x70401f, roughness: 0.27, metalness: 0.02 }),
      capMaterial: new THREE.MeshStandardMaterial({ color: 0x3387c8, roughness: 0.32, metalness: 0.42 }),
      datumMaterial: new THREE.MeshStandardMaterial({ color: 0xff6a3d, emissive: 0x421308, emissiveIntensity: 0.35, roughness: 0.35 })
    };
  }

  function createHandlingBottle(index) {
    const assets = sharedBottleAssets;
    const group = new THREE.Group();
    group.name = `ServoForgeHandlingBottle${index + 1}`;
    group.userData.handlingBottle = true;

    const body = new THREE.Mesh(assets.bodyGeometry, assets.glassMaterial);
    body.name = "ServoForgeHandlingBottleBody";
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const cap = new THREE.Mesh(assets.capGeometry, assets.capMaterial);
    cap.name = "ServoForgeHandlingBottleCap";
    cap.position.y = assets.height + assets.capHeight / 2;
    group.add(cap);

    const datum = new THREE.Mesh(assets.markerGeometry, assets.datumMaterial);
    datum.name = "ServoForgeHandlingBottleServoDatum";
    datum.position.set(assets.bodyRadius * 1.04, assets.markerHeight * 0.92, 0);
    group.add(datum);

    return group;
  }

  function createScallopedStarGeometry(wheel, bottleRadius) {
    const outerRadius = wheel.pitchRadiusWorld + bottleRadius * 0.70;
    const pocketDepth = Math.max(bottleRadius * 0.78, outerRadius * 0.08);
    const shape = new THREE.Shape();
    const sampleCount = Math.max(160, wheel.pocketCount * 24);

    for (let index = 0; index <= sampleCount; index += 1) {
      const theta = index / sampleCount * Math.PI * 2;
      const pocketWave = Math.pow(Math.max(0, Math.cos(theta * wheel.pocketCount)), 6);
      const radius = outerRadius - pocketDepth * pocketWave;
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * radius;
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const thickness = Math.max(0.045, bottleRadius * 0.30);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 2
    });
    geometry.translate(0, 0, -thickness / 2);
    geometry.rotateX(Math.PI / 2);
    return { geometry, outerRadius, thickness };
  }

  function starStartReference(layout, wheelKey) {
    const wheel = layout.wheels[wheelKey];
    const owner = wheel.id;
    const segment = layout.segments.find((entry) => entry.owner === owner);
    if (!segment || segment.type !== "star-arc") return 0;
    return segment.startRadians;
  }

  function createStarWheel(wheelKey, wheel, layout, bottleRadius) {
    const group = new THREE.Group();
    group.name = `ServoForge${wheel.label.replace(/\s+/g, "")}`;
    group.position.set(number(wheel.center?.x), STAR_SURFACE_Y, number(wheel.center?.z));
    group.userData.handlingWheel = wheelKey;
    group.userData.dimensionalAuthority = false;
    group.userData.referenceSource = "TopModul handling parts manual topology";

    const star = createScallopedStarGeometry(wheel, bottleRadius);
    const plateMaterial = new THREE.MeshStandardMaterial({ color: 0xd4d9da, roughness: 0.48, metalness: 0.18 });
    const surface = new THREE.Mesh(star.geometry, plateMaterial);
    surface.name = `ServoForge${wheel.label.replace(/\s+/g, "")}Plate`;
    surface.castShadow = true;
    surface.receiveShadow = true;
    group.add(surface);

    const hubRadius = Math.max(bottleRadius * 0.65, wheel.pitchRadiusWorld * 0.16);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(hubRadius, hubRadius, star.thickness * 1.35, 32),
      new THREE.MeshStandardMaterial({ color: 0x657177, roughness: 0.30, metalness: 0.72 })
    );
    hub.name = `ServoForge${wheel.label.replace(/\s+/g, "")}Hub`;
    group.add(hub);

    const pitchRing = new THREE.Mesh(
      new THREE.TorusGeometry(wheel.pitchRadiusWorld, Math.max(0.006, bottleRadius * 0.025), 8, 96),
      new THREE.MeshStandardMaterial({ color: 0x52666e, roughness: 0.34, metalness: 0.62 })
    );
    pitchRing.name = `ServoForge${wheel.label.replace(/\s+/g, "")}PitchReference`;
    pitchRing.rotation.x = Math.PI / 2;
    pitchRing.position.y = star.thickness * 0.72;
    group.add(pitchRing);

    group.userData.referencePocketAngleRadians = starStartReference(layout, wheelKey);
    layer.add(group);
    wheelGroups.set(wheelKey, group);
  }

  function createConveyor(segment, bottleRadius, name) {
    const dx = number(segment.end?.x) - number(segment.start?.x);
    const dz = number(segment.end?.z) - number(segment.start?.z);
    const length = Math.max(0.01, Math.hypot(dx, dz));
    const width = Math.max(bottleRadius * 2.25, 0.24);
    const angleY = Math.atan2(-dz, dx);
    const centerX = (number(segment.start?.x) + number(segment.end?.x)) / 2;
    const centerZ = (number(segment.start?.z) + number(segment.end?.z)) / 2;
    const group = new THREE.Group();
    group.name = name;
    group.position.set(centerX, STAR_SURFACE_Y - 0.035, centerZ);
    group.rotation.y = angleY;

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.045, width),
      new THREE.MeshStandardMaterial({ color: 0x22292d, roughness: 0.70, metalness: 0.12 })
    );
    belt.name = `${name}Belt`;
    group.add(belt);

    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x8e9a9f, roughness: 0.28, metalness: 0.78 });
    [-1, 1].forEach((side) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.055, 0.025), railMaterial);
      rail.name = `${name}GuideRail`;
      rail.position.set(0, 0.08, side * width * 0.56);
      group.add(rail);
    });

    group.userData.dimensionalAuthority = false;
    group.userData.referenceSource = "functional bottle path until measured conveyor/guide geometry is supplied";
    layer.add(group);
    staticHardware.push(group);
  }

  function geometrySignature(snapshot, handling) {
    return [
      handling?.layout?.headCount,
      handling?.layout?.centerSpacingMm,
      snapshot?.geometry?.bottle?.effectiveDiameterMm,
      snapshot?.geometry?.bottle?.visualHeightWorld,
      handling?.layout?.entryAngleDegrees,
      handling?.layout?.exitAngleDegrees
    ].join("|");
  }

  function rebuild(snapshot, handling) {
    clearGenerated();
    sharedBottleAssets = createSharedBottleAssets(snapshot.geometry);
    const bottleRadius = sharedBottleAssets.bodyRadius;

    Object.entries(handling.layout.wheels).forEach(([key, wheel]) => {
      createStarWheel(key, wheel, handling.layout, bottleRadius);
    });

    const infeed = handling.layout.segments.find((segment) => segment.owner === "infeed-conveyor");
    const outfeed = handling.layout.segments.find((segment) => segment.owner === "outfeed-conveyor");
    if (infeed) createConveyor(infeed, bottleRadius, "ServoForgeInfeedConveyor");
    if (outfeed) createConveyor(outfeed, bottleRadius, "ServoForgeOutfeedConveyor");

    for (let index = 0; index < handling.bottleCount; index += 1) {
      const bottle = createHandlingBottle(index);
      layer.add(bottle);
      bottlePool.push(bottle);
    }
  }

  function carouselBottleRotation(point, handling) {
    const driver = frameDriver();
    const scene = sceneAdapter();
    const rows = Array.isArray(global.state?.program) ? global.state.program : [];
    if (!driver?.snapshot || !scene?.toSceneState || !rows.length || !Number.isFinite(Number(point.tableAngleDegrees))) {
      return point.routeRotationY;
    }

    try {
      const frame = driver.snapshot(rows, point.tableAngleDegrees, {
        commandDriver: global.LabelerServoCommandDriver
      });
      const bottleScene = scene.toSceneState(frame, {
        carouselRadius: handling.layout.carouselRadius,
        carouselDirection: handling.layout.carouselDirection,
        zeroAngleDegrees: handling.layout.zeroAngleDegrees,
        tableY: TABLE_Y,
        bottleLift: BOTTLE_LIFT
      });
      return number(bottleScene?.bottle?.rotation?.y, point.routeRotationY);
    } catch {
      return point.routeRotationY;
    }
  }

  function updateBottlePopulation(handling) {
    bottlePool.forEach((bottle, index) => {
      const point = handling.bottles[index];
      bottle.visible = Boolean(point);
      if (!point) return;
      bottle.userData.owner = point.owner;
      bottle.userData.segmentId = point.segmentId;
      bottle.userData.tableAngleDegrees = point.tableAngleDegrees;
      bottle.position.set(number(point.position?.x), BOTTLE_BASE_Y, number(point.position?.z));
      bottle.rotation.y = point.owner === "carousel"
        ? carouselBottleRotation(point, handling)
        : number(point.routeRotationY);
    });
  }

  function updateWheels(handling) {
    Object.entries(handling.wheels).forEach(([key, wheel]) => {
      const group = wheelGroups.get(key);
      if (!group) return;
      const reference = number(group.userData.referencePocketAngleRadians);
      const worldPocketAngle = reference + wheel.routeDirectionSign * handling.feedPhasePitch * wheel.pocketPitchRadians;
      // Three.js Y rotation negates the XZ-plane polar angle.
      group.rotation.y = -worldPocketAngle;
    });
  }

  function updateViewportCopy() {
    const title = document.querySelector("#servoforge3dTitle");
    if (title && title.textContent !== "ServoForge 3D • Bottle Handling") {
      title.textContent = "ServoForge 3D • Bottle Handling";
    }
    const note = document.querySelector(".servoforge-3d-note");
    if (note && !note.dataset.bottleHandlingV1) {
      note.dataset.bottleHandlingV1 = "true";
      note.innerHTML = "<strong>Bottle handling:</strong> bottles are fed continuously through infeed conveyor → infeed star → intermediate star → carousel → discharge star → outfeed. Carousel bottle rotation still comes only from the ServoForge replay program. Star-wheel dimensions/centers remain provisional until machine measurements are supplied.";
    }
    const legend = document.querySelector(".servoforge-3d-legend");
    if (legend && !legend.dataset.bottleHandlingV1) {
      legend.dataset.bottleHandlingV1 = "true";
      legend.innerHTML = "<b>Bottle flow</b><br>Infeed conveyor → Infeed Star → Intermediate Star → Carousel → Discharge Star → Outfeed<br>Orange bottle datum: ServoForge bottle orientation reference";
    }
  }

  function renderHandlingFrame() {
    if (!running) return;
    try {
      const activeRuntime = runtime();
      const handlingAdapter = adapter();
      if (layer && activeRuntime?.snapshot && handlingAdapter?.snapshot) {
        const snapshot = activeRuntime.snapshot({
          scene: {
            tableY: TABLE_Y,
            bottleLift: BOTTLE_LIFT,
            unitMode: "physical-mm-bottle-handling-v1"
          }
        });
        const handling = handlingAdapter.snapshot(
          snapshot?.scene?.carousel?.machineAngleDegrees,
          snapshot.geometry,
          {
            carouselDirection: String(global.state?.direction || "ccw"),
            zeroAngleDegrees: number(global.state?.zeroAngle, 0)
          }
        );
        lastHandlingSnapshot = handling;
        const signature = geometrySignature(snapshot, handling);
        if (signature !== lastGeometrySignature || bottlePool.length < handling.bottleCount) {
          lastGeometrySignature = signature;
          rebuild(snapshot, handling);
        }
        updateWheels(handling);
        updateBottlePopulation(handling);
        updateViewportCopy();
      }
    } catch (error) {
      console.warn("ServoForge 3D bottle handling frame skipped", error);
    }
    global.requestAnimationFrame(renderHandlingFrame);
  }

  function startLoop() {
    if (running) return;
    running = true;
    global.requestAnimationFrame(renderHandlingFrame);
  }

  function ensureHandlingLayer(sceneRoot) {
    if (!THREE || !sceneRoot) return;
    if (layer && layerScene === sceneRoot) return;
    if (layer) {
      layer.parent?.remove(layer);
      clearGenerated();
    }
    layerScene = sceneRoot;
    layer = new THREE.Group();
    layer.name = "ServoForgeBottleHandlingSystem";
    layer.userData.handlingAuthority = Object.freeze({
      integrationVersion: INTEGRATION_VERSION,
      topology: "infeed-star-intermediate-star-carousel-discharge-star",
      servoAuthority: "ServoForge-only-while-carousel-owned",
      dimensionalAuthority: false,
      readOnly: true
    });
    sceneRoot.add(layer);
    startLoop();
  }

  function installThreeSceneHooks() {
    const prototype = THREE?.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeBottleHandlingHookV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgeBottleHandlingAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        if (object?.name === "ServoForgeLiveBottle" && !object?.userData?.handlingBottle) {
          object.visible = false;
          object.userData.hiddenByBottleHandlingV1 = true;
          hiddenLegacyBottleCount += 1;
        }
        if (object?.name === "ServoForgeBottleTablePopulation") {
          ensureHandlingLayer(this);
        }
      });
      return result;
    };
    Object.defineProperty(prototype, "__servoforgeBottleHandlingHookV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }

  function status() {
    return Object.freeze({
      integrationVersion: INTEGRATION_VERSION,
      installed: Boolean(THREE),
      sceneCaptured: Boolean(layer),
      bottleCount: lastHandlingSnapshot?.bottleCount || 0,
      hiddenLegacyBottleCount,
      ownershipSequence: lastHandlingSnapshot?.ownershipSequence || [],
      noSingleBottleZeroReset: true,
      carouselServoAuthorityPreserved: true,
      starWheelDimensionsAuthoritative: false,
      readOnly: true
    });
  }

  global.Labeler3DBottleHandlingViewport = Object.freeze({
    INTEGRATION_VERSION,
    THREE_VERSION,
    status
  });

  ensureThree()
    .then(() => installThreeSceneHooks())
    .catch((error) => console.error("ServoForge 3D bottle handling integration failed", error));
})(window);
