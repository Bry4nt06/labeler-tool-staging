(function installServoForge3DVisibleInnerHub(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-bottle-handling-visible-inner-hub.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

  const REFERENCE_SOURCE = "user-supplied-star-wheel-drawing-2026-08-18";
  const RECESS_RADIUS_RATIO = 0.535;
  const RING_OUTER_RADIUS_RATIO = 0.485;
  const RING_INNER_RADIUS_RATIO = 0.355;
  const COUPLING_OUTER_RADIUS_RATIO = 0.300;
  const CENTER_BORE_RADIUS_RATIO = 0.105;
  const PRIMARY_BOLT_CIRCLE_RATIO = 0.305;
  const SECONDARY_BOLT_CIRCLE_RATIO = 0.430;
  const PRIMARY_BOLT_COUNT = 4;
  const SECONDARY_BOLT_COUNT = 8;
  const RECESS_THICKNESS_MM = 4;
  const RING_THICKNESS_MM = 10;
  const COUPLING_THICKNESS_MM = 14;

  let THREE = null;
  let running = false;
  const wheelGroups = new Map();
  let appliedCount = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function wheelKeyForObject(object) {
    const name = String(object?.name || "");
    if (name === "ServoForgeInfeedStar") return "infeed";
    if (name === "ServoForgeIntermediateStar") return "intermediate";
    if (name === "ServoForgeDischargeStar") return "discharge";
    return null;
  }

  function starPlate(group) {
    return group?.children?.find((child) => /Plate$/.test(String(child?.name || "")) && child?.isMesh) || null;
  }

  function unitsPerMm() {
    try {
      const snapshot = runtime()?.snapshot?.({
        scene: {
          tableY: 0.20,
          bottleLift: 0.155,
          unitMode: "physical-mm-visible-star-inner-hub"
        }
      });
      return Math.max(0.000001, number(snapshot?.geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
    } catch {
      return 2.55 / 572.958;
    }
  }

  function disposeTree(object) {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
      const disposeMaterial = (material) => material?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    });
  }

  function removeExistingVisibleHub(group) {
    [...(group?.children || [])].forEach((child) => {
      if (child?.name !== "ServoForgeStarVisibleInnerHub") return;
      group.remove(child);
      disposeTree(child);
    });
  }

  function hideBuriedHub(group) {
    const buried = group?.children?.find((child) => child?.name === "ServoForgeStarDrawingInnerAssembly");
    if (buried) buried.visible = false;
  }

  function plateMetrics(plate) {
    const geometry = plate?.geometry;
    if (!geometry) return null;
    geometry.computeBoundingBox?.();
    const box = geometry.boundingBox;
    if (!box) return null;
    const sx = Math.abs(number(plate.scale?.x, 1));
    const sy = Math.abs(number(plate.scale?.y, 1));
    const sz = Math.abs(number(plate.scale?.z, 1));
    const outerRadius = Math.max(
      Math.abs(number(box.min?.x)) * sx,
      Math.abs(number(box.max?.x)) * sx,
      Math.abs(number(box.min?.z)) * sz,
      Math.abs(number(box.max?.z)) * sz
    );
    const topY = number(box.max?.y) * sy + number(plate.position?.y);
    return { outerRadius, topY };
  }

  function annulusGeometry(outerRadius, innerRadius, thickness) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 64
    });
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
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 48
    });
    geometry.translate(0, 0, -thickness / 2);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addBolt(group, radius, angle, y, headRadius, headHeight, material, name) {
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(headRadius, headRadius, headHeight, 20),
      material
    );
    bolt.name = name;
    bolt.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    group.add(bolt);
  }

  function buildVisibleHub(group) {
    const plate = starPlate(group);
    const metrics = plateMetrics(plate);
    if (!plate || !metrics || !(metrics.outerRadius > 0)) return;

    hideBuriedHub(group);
    removeExistingVisibleHub(group);

    const scale = unitsPerMm();
    const outer = metrics.outerRadius;
    const recessThickness = RECESS_THICKNESS_MM * scale;
    const ringThickness = RING_THICKNESS_MM * scale;
    const couplingThickness = COUPLING_THICKNESS_MM * scale;
    const topY = metrics.topY;

    const assembly = new THREE.Group();
    assembly.name = "ServoForgeStarVisibleInnerHub";
    assembly.userData.referenceSource = REFERENCE_SOURCE;
    assembly.userData.visualHierarchyAuthority = true;
    assembly.userData.dimensionalAuthority = false;
    assembly.userData.topSurfaceMounted = true;

    const recessMaterial = new THREE.MeshStandardMaterial({
      color: 0x1d2529,
      roughness: 0.48,
      metalness: 0.34
    });
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x9aa5a9,
      roughness: 0.30,
      metalness: 0.76
    });
    const couplingMaterial = new THREE.MeshStandardMaterial({
      color: 0x626e73,
      roughness: 0.30,
      metalness: 0.70
    });
    const boltMaterial = new THREE.MeshStandardMaterial({
      color: 0x343d41,
      roughness: 0.24,
      metalness: 0.86
    });

    const recessRadius = outer * RECESS_RADIUS_RATIO;
    const recess = new THREE.Mesh(
      new THREE.CylinderGeometry(recessRadius, recessRadius, recessThickness, 96),
      recessMaterial
    );
    recess.name = "ServoForgeStarInnerRecessField";
    recess.position.y = topY - recessThickness / 2 + 0.35 * scale;
    assembly.add(recess);

    const ringOuter = outer * RING_OUTER_RADIUS_RATIO;
    const ringInner = outer * RING_INNER_RADIUS_RATIO;
    const ring = new THREE.Mesh(
      annulusGeometry(ringOuter, ringInner, ringThickness),
      ringMaterial
    );
    ring.name = "ServoForgeStarInnerMountingRingVisible";
    ring.position.y = topY + ringThickness / 2 + 0.8 * scale;
    assembly.add(ring);

    const couplingOuter = outer * COUPLING_OUTER_RADIUS_RATIO;
    const boreRadius = outer * CENTER_BORE_RADIUS_RATIO;
    const coupling = new THREE.Mesh(
      couplingGeometry(couplingOuter, boreRadius, couplingThickness),
      couplingMaterial
    );
    coupling.name = "ServoForgeStarInnerFourLobeCouplingVisible";
    coupling.position.y = topY + couplingThickness / 2 + 1.2 * scale;
    assembly.add(coupling);

    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(boreRadius * 0.92, boreRadius * 0.92, couplingThickness + 2 * scale, 48),
      recessMaterial
    );
    bore.name = "ServoForgeStarCenterBoreVisible";
    bore.position.y = coupling.position.y + 0.8 * scale;
    assembly.add(bore);

    const primaryRadius = outer * PRIMARY_BOLT_CIRCLE_RATIO;
    for (let index = 0; index < PRIMARY_BOLT_COUNT; index += 1) {
      const angle = Math.PI / 4 + index * Math.PI * 2 / PRIMARY_BOLT_COUNT;
      addBolt(
        assembly,
        primaryRadius,
        angle,
        topY + couplingThickness + 4 * scale,
        8.5 * scale,
        5 * scale,
        boltMaterial,
        `ServoForgeStarVisiblePrimaryBolt${index + 1}`
      );
    }

    const secondaryRadius = outer * SECONDARY_BOLT_CIRCLE_RATIO;
    for (let index = 0; index < SECONDARY_BOLT_COUNT; index += 1) {
      const angle = index * Math.PI * 2 / SECONDARY_BOLT_COUNT;
      addBolt(
        assembly,
        secondaryRadius,
        angle,
        topY + ringThickness + 2.8 * scale,
        4.3 * scale,
        3.2 * scale,
        boltMaterial,
        `ServoForgeStarVisibleSecondaryBolt${index + 1}`
      );
    }

    assembly.userData.recessRadiusRatio = RECESS_RADIUS_RATIO;
    assembly.userData.innerRingOuterRadiusRatio = RING_OUTER_RADIUS_RATIO;
    assembly.userData.innerRingInnerRadiusRatio = RING_INNER_RADIUS_RATIO;
    assembly.userData.primaryBoltCount = PRIMARY_BOLT_COUNT;
    assembly.userData.secondaryBoltCount = SECONDARY_BOLT_COUNT;
    group.add(assembly);
    appliedCount += 1;
  }

  function enforceVisibleHubs() {
    wheelGroups.forEach((group, key) => {
      if (!group?.parent) {
        wheelGroups.delete(key);
        return;
      }
      const plate = starPlate(group);
      if (!plate) return;
      const current = group.children.find((child) => child?.name === "ServoForgeStarVisibleInnerHub");
      const metrics = plateMetrics(plate);
      const signature = metrics
        ? `${metrics.outerRadius.toFixed(6)}|${metrics.topY.toFixed(6)}|${number(group.userData?.starThicknessMm).toFixed(2)}`
        : "";
      if (current?.userData?.geometrySignature === signature) {
        hideBuriedHub(group);
        return;
      }
      buildVisibleHub(group);
      const rebuilt = group.children.find((child) => child?.name === "ServoForgeStarVisibleInnerHub");
      if (rebuilt) rebuilt.userData.geometrySignature = signature;
    });
  }

  function loop() {
    if (!running) return;
    enforceVisibleHubs();
  }

  function startLoop() {
    if (running) return;
    const coordinator = global.Labeler3DPresentationFrameCoordinator;
    if (!coordinator?.register) {
      console.warn("ServoForge 3D presentation frame coordinator is unavailable.");
      return;
    }
    running = true;
    coordinator.register(PATCH_VERSION, loop, { minIntervalMs: 250 });
  }

  import(THREE_MODULE_URL).then((module) => {
    THREE = module;
    const prototype = THREE.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeVisibleInnerHubV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgeVisibleInnerHubAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        const key = wheelKeyForObject(object);
        if (!key) return;
        wheelGroups.set(key, object);
        startLoop();
      });
      return result;
    };
    Object.defineProperty(prototype, "__servoforgeVisibleInnerHubV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }).catch((error) => {
    console.error("ServoForge visible star-wheel inner hub integration failed", error);
  });

  global.Labeler3DBottleHandlingVisibleInnerHub = Object.freeze({
    PATCH_VERSION,
    REFERENCE_SOURCE,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        wheelGroups: wheelGroups.size,
        appliedCount,
        buriedHubHidden: true,
        visibleTopSurfaceHub: true,
        primaryBoltCount: PRIMARY_BOLT_COUNT,
        secondaryBoltCount: SECONDARY_BOLT_COUNT,
        readOnly: true
      });
    }
  });
})(window);
