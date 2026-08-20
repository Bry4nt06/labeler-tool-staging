(function installServoForge3DBottleHandlingViewport(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.3d-bottle-handling-viewport.v6";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const BOTTLE_BASE_Y = TABLE_Y + BOTTLE_LIFT;
  const CONVEYOR_Y = 0.25;
  const STAR_THICKNESS_MM = 80;
  const STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM = 30;
  const POCKET_DIAMETRAL_CLEARANCE_MM = 3;
  const INNER_HUB_REFERENCE_SOURCE = "user-supplied-star-wheel-drawing-2026-08-18";
  const RECESS_RADIUS_RATIO = 0.535;
  const RING_OUTER_RADIUS_RATIO = 0.485;
  const RING_INNER_RADIUS_RATIO = 0.355;
  const COUPLING_OUTER_RADIUS_RATIO = 0.300;
  const CENTER_BORE_RADIUS_RATIO = 0.105;
  const PRIMARY_BOLT_CIRCLE_RATIO = 0.305;
  const SECONDARY_BOLT_CIRCLE_RATIO = 0.430;
  const PRIMARY_BOLT_COUNT = 4;
  const SECONDARY_BOLT_COUNT = 8;

  let THREE = null;
  let threePromise = null;
  let layer = null;
  let layerScene = null;
  let lastGeometrySignature = "";
  let bottlePool = [];
  let wheelGroups = new Map();
  let staticHardware = [];
  let sharedBottleAssets = null;
  let lastHandlingSnapshot = null;
  let bottleMode = "all";
  let visibleHandlingBottleCount = 0;
  let attachedSceneCount = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function adapter() {
    return global.Labeler3DBottleHandlingAdapter || null;
  }

  function ensureThree() {
    if (THREE) return Promise.resolve(THREE);
    if (!threePromise) threePromise = import(THREE_MODULE_URL).then((module) => (THREE = module));
    return threePromise;
  }

  function disposeObject(object) {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
      const disposeMaterial = (entry) => {
        entry?.map?.dispose?.();
        entry?.dispose?.();
      };
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    });
  }

  function disposeSharedBottleAssets() {
    if (!sharedBottleAssets) return;
    [sharedBottleAssets.bodyGeometry, sharedBottleAssets.capGeometry, sharedBottleAssets.markerGeometry].forEach((geometry) => geometry?.dispose?.());
    [sharedBottleAssets.glassMaterial, sharedBottleAssets.capMaterial, sharedBottleAssets.datumMaterial].forEach((material) => material?.dispose?.());
    sharedBottleAssets = null;
  }

  function clearGenerated() {
    bottlePool.forEach((bottle) => {
      const labels = bottle.children?.filter((child) => child?.name === "ServoForgeProgressiveBottleLabels") || [];
      labels.forEach((entry) => disposeObject(entry));
      bottle.parent?.remove(bottle);
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
    disposeSharedBottleAssets();
  }

  function unitsPerMm(snapshot) {
    return Math.max(0.000001, number(snapshot?.geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
  }

  function bottleDiameterMm(snapshot) {
    return Math.max(1, number(snapshot?.geometry?.bottle?.effectiveDiameterMm, 60.7));
  }

  function bottleProfile(geometry) {
    const supplied = geometry?.bottle?.profilePointsWorld;
    if (Array.isArray(supplied) && supplied.length >= 4) {
      return supplied.map((point) => new THREE.Vector2(number(point.radius), number(point.y)));
    }
    return [[0.27, 0], [0.31, 0.18], [0.31, 1.02], [0.18, 1.37], [0.12, 1.85], [0.13, 1.90]]
      .map(([radius, y]) => new THREE.Vector2(radius, y));
  }

  function createSharedBottleAssets(geometry) {
    const profile = bottleProfile(geometry);
    const bodyRadius = Math.max(...profile.map((point) => point.x));
    const height = Math.max(...profile.map((point) => point.y));
    const scale = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.00445));
    const finishRadius = number(geometry?.bottle?.finishOuterDiameterMm, 26.6) * scale / 2;
    const capRadius = Math.max(finishRadius * 1.08, bodyRadius * 0.20);
    const capHeight = Math.max(0.024, 6 * scale);
    const markerHeight = Math.max(0.18, height * 0.32);
    return {
      bodyRadius,
      height,
      bodyGeometry: new THREE.LatheGeometry(profile, 40),
      capGeometry: new THREE.CylinderGeometry(capRadius, capRadius, capHeight, 20),
      markerGeometry: new THREE.BoxGeometry(Math.max(0.009, bodyRadius * 0.07), markerHeight, Math.max(0.022, bodyRadius * 0.20)),
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

  function polar(radius, angle) {
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  function pushPoint(points, point) {
    const previous = points[points.length - 1];
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 1e-9) return;
    points.push(point);
  }

  function roundedPocketProfile(wheel, snapshot) {
    const scale = unitsPerMm(snapshot);
    const pocketCount = Math.max(3, Math.round(number(wheel?.pocketCount, 16)));
    const pitchRadius = Math.max(scale, number(wheel?.pitchRadiusWorld));
    const measuredOuterRadius = number(wheel?.outerRadiusWorld);
    const outerRadius = Math.max(pitchRadius + scale, measuredOuterRadius > 0 ? measuredOuterRadius : 300 * scale);
    const pocketDiameterMm = bottleDiameterMm(snapshot) + POCKET_DIAMETRAL_CLEARANCE_MM;
    const pocketRadius = pocketDiameterMm * scale / 2;
    const denominator = Math.max(1e-12, 2 * pitchRadius * pocketRadius);
    const gamma = Math.acos(clamp(
      (pitchRadius * pitchRadius + pocketRadius * pocketRadius - outerRadius * outerRadius) / denominator,
      -1,
      1
    ));
    const pocketPitch = Math.PI * 2 / pocketCount;
    const intersectionHalfAngle = Math.acos(clamp(
      (outerRadius * outerRadius + pitchRadius * pitchRadius - pocketRadius * pocketRadius)
        / Math.max(1e-12, 2 * outerRadius * pitchRadius),
      -1,
      1
    ));
    const mouthHalfAngle = Math.min(intersectionHalfAngle, pocketPitch * 0.47);
    const points = [];
    const pocketSamples = 24;
    const outerSamples = 8;
    for (let pocket = 0; pocket < pocketCount; pocket += 1) {
      const centerAngle = pocket * pocketPitch;
      const pocketCenter = polar(pitchRadius, centerAngle);
      const mouthStart = centerAngle - mouthHalfAngle;
      const mouthEnd = centerAngle + mouthHalfAngle;
      if (pocket === 0) pushPoint(points, polar(outerRadius, mouthStart));
      for (let step = 1; step <= pocketSamples; step += 1) {
        const t = step / pocketSamples;
        const beta = centerAngle + Math.PI + gamma - (2 * gamma * t);
        pushPoint(points, {
          x: pocketCenter.x + Math.cos(beta) * pocketRadius,
          y: pocketCenter.y + Math.sin(beta) * pocketRadius
        });
      }
      const nextMouthStart = centerAngle + pocketPitch - mouthHalfAngle;
      for (let step = 1; step <= outerSamples; step += 1) {
        const t = step / outerSamples;
        pushPoint(points, polar(outerRadius, mouthEnd + (nextMouthStart - mouthEnd) * t));
      }
    }
    const shape = new THREE.Shape();
    points.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    return {
      shape,
      outerRadius,
      pitchRadius,
      pocketRadius,
      pocketDiameterMm,
      radialClearanceMm: POCKET_DIAMETRAL_CLEARANCE_MM / 2,
      pocketCount,
      mouthHalfAngle
    };
  }

  function starBodyGeometry(wheel, snapshot) {
    const profile = roundedPocketProfile(wheel, snapshot);
    const thicknessWorld = STAR_THICKNESS_MM * unitsPerMm(snapshot);
    const geometry = new THREE.ExtrudeGeometry(profile.shape, { depth: thicknessWorld, bevelEnabled: false, curveSegments: 3 });
    geometry.translate(0, 0, -thicknessWorld / 2);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, profile, thicknessWorld };
  }

  function annulusGeometry(outerRadius, innerRadius, thickness) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 64 });
    geometry.translate(0, 0, -thickness / 2);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
  }

  function couplingGeometry(outerRadius, boreRadius, thickness) {
    const shape = new THREE.Shape();
    const samples = 160;
    for (let index = 0; index <= samples; index += 1) {
      const angle = index / samples * Math.PI * 2;
      const fourLobe = 0.5 + 0.5 * Math.cos(angle * 4);
      const radius = outerRadius * (0.80 + 0.20 * fourLobe);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 48 });
    geometry.translate(0, 0, -thickness / 2);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addBolt(group, radius, angle, y, headRadius, headHeight, boltMaterial, name) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(headRadius, headRadius, headHeight, 20), boltMaterial);
    bolt.name = name;
    bolt.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    group.add(bolt);
  }

  function addVisibleInnerHub(group, profile, snapshot, thicknessWorld) {
    const scale = unitsPerMm(snapshot);
    const outer = profile.outerRadius;
    const topY = thicknessWorld / 2;
    const assembly = new THREE.Group();
    assembly.name = "ServoForgeStarVisibleInnerHub";
    assembly.userData.referenceSource = INNER_HUB_REFERENCE_SOURCE;
    assembly.userData.visualHierarchyAuthority = true;
    assembly.userData.dimensionalAuthority = false;
    assembly.userData.topSurfaceMounted = true;
    const recessMaterial = new THREE.MeshStandardMaterial({ color: 0x1d2529, roughness: 0.48, metalness: 0.34 });
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa5a9, roughness: 0.30, metalness: 0.76 });
    const couplingMaterial = new THREE.MeshStandardMaterial({ color: 0x626e73, roughness: 0.30, metalness: 0.70 });
    const boltMaterial = new THREE.MeshStandardMaterial({ color: 0x343d41, roughness: 0.24, metalness: 0.86 });
    const recessThickness = 4 * scale;
    const ringThickness = 10 * scale;
    const couplingThickness = 14 * scale;
    const recessRadius = outer * RECESS_RADIUS_RATIO;
    const recess = new THREE.Mesh(new THREE.CylinderGeometry(recessRadius, recessRadius, recessThickness, 96), recessMaterial);
    recess.name = "ServoForgeStarInnerRecessField";
    recess.position.y = topY - recessThickness / 2 + 0.35 * scale;
    assembly.add(recess);
    const ringOuter = outer * RING_OUTER_RADIUS_RATIO;
    const ringInner = outer * RING_INNER_RADIUS_RATIO;
    const ring = new THREE.Mesh(annulusGeometry(ringOuter, ringInner, ringThickness), ringMaterial);
    ring.name = "ServoForgeStarInnerMountingRingVisible";
    ring.position.y = topY + ringThickness / 2 + 0.8 * scale;
    assembly.add(ring);
    const couplingOuter = outer * COUPLING_OUTER_RADIUS_RATIO;
    const boreRadius = outer * CENTER_BORE_RADIUS_RATIO;
    const coupling = new THREE.Mesh(couplingGeometry(couplingOuter, boreRadius, couplingThickness), couplingMaterial);
    coupling.name = "ServoForgeStarInnerFourLobeCouplingVisible";
    coupling.position.y = topY + couplingThickness / 2 + 1.2 * scale;
    assembly.add(coupling);
    const bore = new THREE.Mesh(new THREE.CylinderGeometry(boreRadius * 0.92, boreRadius * 0.92, couplingThickness + 2 * scale, 48), recessMaterial);
    bore.name = "ServoForgeStarCenterBoreVisible";
    bore.position.y = coupling.position.y + 0.8 * scale;
    assembly.add(bore);
    const primaryRadius = outer * PRIMARY_BOLT_CIRCLE_RATIO;
    for (let index = 0; index < PRIMARY_BOLT_COUNT; index += 1) {
      addBolt(assembly, primaryRadius, Math.PI / 4 + index * Math.PI * 2 / PRIMARY_BOLT_COUNT, topY + couplingThickness + 4 * scale, 8.5 * scale, 5 * scale, boltMaterial, `ServoForgeStarVisiblePrimaryBolt${index + 1}`);
    }
    const secondaryRadius = outer * SECONDARY_BOLT_CIRCLE_RATIO;
    for (let index = 0; index < SECONDARY_BOLT_COUNT; index += 1) {
      addBolt(assembly, secondaryRadius, index * Math.PI * 2 / SECONDARY_BOLT_COUNT, topY + ringThickness + 2.8 * scale, 4.3 * scale, 3.2 * scale, boltMaterial, `ServoForgeStarVisibleSecondaryBolt${index + 1}`);
    }
    group.add(assembly);
  }

  function wheelName(key) {
    if (key === "infeed") return "ServoForgeInfeedStar";
    if (key === "intermediate") return "ServoForgeIntermediateStar";
    if (key === "discharge") return "ServoForgeDischargeStar";
    return `ServoForge${String(key || "Handling")}Star`;
  }

  function starStartReference(layout, wheelKey, wheel) {
    if (Number.isFinite(Number(wheel?.referencePocketAngleRadians))) return Number(wheel.referencePocketAngleRadians);
    const segment = (layout?.segments || []).find((entry) => entry.owner === wheel?.id || entry.owner === `${wheelKey}-star`);
    return segment?.type === "star-arc" ? number(segment.startRadians, 0) : 0;
  }

  function createStarWheel(wheelKey, wheel, layout, snapshot) {
    const group = new THREE.Group();
    group.name = wheelName(wheelKey);
    const scale = unitsPerMm(snapshot);
    const centerAboveBottleBaseMm = STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM + STAR_THICKNESS_MM / 2;
    group.position.set(number(wheel?.center?.x), BOTTLE_BASE_Y + centerAboveBottleBaseMm * scale, number(wheel?.center?.z));
    group.userData.handlingWheel = wheelKey;
    group.userData.starThicknessMm = STAR_THICKNESS_MM;
    group.userData.starBottomFaceAboveBottleBaseMm = STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM;
    group.userData.starTopFaceAboveBottleBaseMm = STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM + STAR_THICKNESS_MM;
    group.userData.allThreeStarsSameVerticalCenter = true;
    group.userData.roundedPocketAuthority = "active-bottle-diameter-plus-3mm-diametral-clearance";
    group.userData.innerAssemblyReference = INNER_HUB_REFERENCE_SOURCE;
    const built = starBodyGeometry(wheel, snapshot);
    const surface = new THREE.Mesh(built.geometry, new THREE.MeshStandardMaterial({ color: 0xd4d9da, roughness: 0.48, metalness: 0.18 }));
    surface.name = `${group.name}Plate`;
    surface.castShadow = true;
    surface.receiveShadow = true;
    surface.userData.starThicknessMm = STAR_THICKNESS_MM;
    surface.userData.pocketDiametralClearanceMm = POCKET_DIAMETRAL_CLEARANCE_MM;
    surface.userData.pocketOpeningDiameterMm = built.profile.pocketDiameterMm;
    surface.userData.radialClearanceMm = built.profile.radialClearanceMm;
    surface.userData.pocketShapeAuthority = "true-circular-bottle-clearance-arc";
    group.add(surface);
    addVisibleInnerHub(group, built.profile, snapshot, built.thicknessWorld);
    group.userData.referencePocketAngleRadians = starStartReference(layout, wheelKey, wheel);
    group.userData.pocketPhaseAuthority = wheel?.pocketPhaseAuthority || "handling-layout-reference";
    layer.add(group);
    wheelGroups.set(wheelKey, group);
  }

  function createConveyor(segment, bottleRadius, name) {
    const dx = number(segment?.end?.x) - number(segment?.start?.x);
    const dz = number(segment?.end?.z) - number(segment?.start?.z);
    const length = Math.max(0.01, Math.hypot(dx, dz));
    const width = Math.max(bottleRadius * 2.25, 0.24);
    const angleY = Math.atan2(-dz, dx);
    const centerX = (number(segment?.start?.x) + number(segment?.end?.x)) / 2;
    const centerZ = (number(segment?.start?.z) + number(segment?.end?.z)) / 2;
    const group = new THREE.Group();
    group.name = name;
    group.position.set(centerX, CONVEYOR_Y, centerZ);
    group.rotation.y = angleY;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(length, 0.045, width), new THREE.MeshStandardMaterial({ color: 0x22292d, roughness: 0.70, metalness: 0.12 }));
    group.add(belt);
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0x8e9a9f, roughness: 0.28, metalness: 0.78 });
    [-1, 1].forEach((side) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.055, 0.025), railMaterial);
      rail.position.set(0, 0.08, side * width * 0.56);
      group.add(rail);
    });
    layer.add(group);
    staticHardware.push(group);
  }

  function geometrySignature(snapshot, handling) {
    const wheels = handling?.layout?.wheels || {};
    return [
      handling?.layout?.headCount,
      handling?.layout?.centerSpacingMm,
      handling?.layout?.carouselDirection,
      handling?.layout?.zeroAngleDegrees,
      snapshot?.geometry?.bottle?.effectiveDiameterMm,
      snapshot?.geometry?.bottle?.visualHeightWorld,
      handling?.layout?.entryAngleDegrees,
      handling?.layout?.exitAngleDegrees,
      handling?.bottleCount,
      ...Object.entries(wheels).flatMap(([key, wheel]) => [key, wheel?.center?.x, wheel?.center?.z, wheel?.pitchRadiusWorld, wheel?.outerRadiusWorld, wheel?.referencePocketAngleRadians])
    ].join("|");
  }

  function rebuild(snapshot, handling) {
    clearGenerated();
    sharedBottleAssets = createSharedBottleAssets(snapshot.geometry);
    const bottleRadius = sharedBottleAssets.bodyRadius;
    Object.entries(handling?.layout?.wheels || {}).forEach(([key, wheel]) => createStarWheel(key, wheel, handling.layout, snapshot));
    const infeed = (handling?.layout?.segments || []).find((segment) => segment.owner === "infeed-conveyor");
    const outfeed = (handling?.layout?.segments || []).find((segment) => segment.owner === "outfeed-conveyor");
    if (infeed) createConveyor(infeed, bottleRadius, "ServoForgeInfeedConveyor");
    if (outfeed) createConveyor(outfeed, bottleRadius, "ServoForgeOutfeedConveyor");
    for (let index = 0; index < number(handling?.bottleCount, 0); index += 1) {
      const bottle = createHandlingBottle(index);
      layer.add(bottle);
      bottlePool.push(bottle);
    }
    global.Labeler3DProgressiveLabelFlow?.attachLayer?.(layer);
  }

  function setBottleMode(mode) {
    bottleMode = ["all", "head1", "none"].includes(String(mode)) ? String(mode) : "all";
    return bottleMode;
  }

  function updateBottlePopulation(snapshot, handling) {
    const sharedServoRotation = number(snapshot?.scene?.bottle?.servoRotationY, 0);
    let visible = 0;
    bottlePool.forEach((bottle, index) => {
      const point = handling?.bottles?.[index];
      const shouldShow = bottleMode === "all" && Boolean(point);
      bottle.visible = shouldShow;
      if (!point) return;
      if (shouldShow) visible += 1;
      bottle.userData.owner = point.owner;
      bottle.userData.segmentId = point.segmentId;
      bottle.userData.tableAngleDegrees = point.tableAngleDegrees;
      bottle.userData.routeRotationY = point.routeRotationY;
      bottle.position.set(number(point.position?.x), BOTTLE_BASE_Y, number(point.position?.z));
      bottle.rotation.y = sharedServoRotation;
    });
    visibleHandlingBottleCount = visible;
  }

  function updateWheels(handling) {
    Object.entries(handling?.wheels || {}).forEach(([key, wheel]) => {
      const group = wheelGroups.get(key);
      if (!group) return;
      group.position.x = number(wheel?.center?.x, group.position.x);
      group.position.z = number(wheel?.center?.z, group.position.z);
      const reference = Number.isFinite(Number(wheel?.referencePocketAngleRadians))
        ? Number(wheel.referencePocketAngleRadians)
        : number(group.userData.referencePocketAngleRadians);
      group.userData.referencePocketAngleRadians = reference;
      const directionSign = number(wheel.routeDirectionSign, 1) >= 0 ? 1 : -1;
      const pocketPitchRadians = Math.max(0.000001, Math.abs(number(wheel.pocketPitchRadians, Math.PI * 2 / Math.max(3, number(wheel.pocketCount, 16)))));
      const worldPocketAngle = reference + directionSign * number(handling.feedPhasePitch) * pocketPitchRadians;
      group.rotation.y = -worldPocketAngle;
    });
  }

  function sync(snapshot) {
    const handlingAdapter = adapter();
    if (!layer || !snapshot?.geometry || !handlingAdapter?.snapshot) return false;
    try {
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
      if (signature !== lastGeometrySignature || bottlePool.length !== number(handling?.bottleCount, 0)) {
        lastGeometrySignature = signature;
        rebuild(snapshot, handling);
      }
      updateWheels(handling);
      updateBottlePopulation(snapshot, handling);
      return true;
    } catch (error) {
      console.warn("ServoForge 3D bottle handling sync skipped", error);
      return false;
    }
  }

  function ensureHandlingLayer(sceneRoot) {
    if (!THREE || !sceneRoot?.isScene) return false;
    if (layer && layerScene === sceneRoot) return true;
    if (layer) {
      layer.parent?.remove(layer);
      clearGenerated();
    }
    layerScene = sceneRoot;
    layer = new THREE.Group();
    layer.name = "ServoForgeBottleHandlingSystem";
    layer.userData.handlingAuthority = INTEGRATION_VERSION;
    layer.userData.singleSceneAuthority = true;
    layer.userData.integratedStarGeometry = true;
    sceneRoot.add(layer);
    attachedSceneCount += 1;
    global.Labeler3DProgressiveLabelFlow?.attachLayer?.(layer);
    return true;
  }

  async function attachScene(sceneRoot) {
    await ensureThree();
    if (!sceneRoot?.isScene) throw new Error("Bottle handling can only attach to a Three.js Scene.");
    ensureHandlingLayer(sceneRoot);
    return layer;
  }

  function detachScene(sceneRoot = layerScene) {
    if (!layer || !sceneRoot || layerScene !== sceneRoot) return false;
    layer.parent?.remove(layer);
    clearGenerated();
    layer = null;
    layerScene = null;
    lastGeometrySignature = "";
    return true;
  }

  function status() {
    return Object.freeze({
      integrationVersion: INTEGRATION_VERSION,
      installed: Boolean(layer && layerScene),
      bottleMode,
      bottleCount: bottlePool.length,
      visibleHandlingBottleCount,
      starWheelCount: wheelGroups.size,
      starThicknessMm: STAR_THICKNESS_MM,
      starBottomFaceAboveBottleBaseMm: STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM,
      pocketDiametralClearanceMm: POCKET_DIAMETRAL_CLEARANCE_MM,
      roundedPocketAuthority: true,
      visibleInnerHubAuthority: true,
      measuredOuterDiameterAuthority: "handling-layout-adapter",
      pocketPhaseAuthority: "handling-layout-adapter",
      attachedSceneCount,
      independentAnimationLoop: false,
      prototypeSceneHook: false,
      singleSnapshotAuthority: true,
      singleSceneAuthority: true,
      activeSceneName: layerScene?.name || null,
      lastHandlingSnapshot
    });
  }

  global.Labeler3DBottleHandlingViewport = Object.freeze({
    INTEGRATION_VERSION,
    THREE_VERSION,
    attachScene,
    detachScene,
    setBottleMode,
    sync,
    status,
    getLayer: () => layer,
    latestHandlingSnapshot: () => lastHandlingSnapshot
  });
})(window);
