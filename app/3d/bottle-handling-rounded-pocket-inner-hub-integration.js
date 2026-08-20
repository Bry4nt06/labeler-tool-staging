(function installServoForge3DRoundedPocketInnerHub(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-bottle-handling-rounded-pocket-inner-hub.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

  const STAR_THICKNESS_MM = 80;
  const STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM = 30;
  const POCKET_DIAMETRAL_CLEARANCE_MM = 3;
  const INNER_RING_OUTER_RADIUS_RATIO = 0.515;
  const INNER_RING_INNER_RADIUS_RATIO = 0.405;
  const COUPLING_BASE_RADIUS_RATIO = 0.315;
  const COUPLING_LOBE_DEPTH_RATIO = 0.065;
  const CENTER_BORE_RADIUS_RATIO = 0.115;
  const PRIMARY_BOLT_CIRCLE_RATIO = 0.315;
  const PRIMARY_BOLT_COUNT = 4;
  const SECONDARY_BOLT_CIRCLE_RATIO = 0.445;
  const SECONDARY_BOLT_COUNT = 8;
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const BOTTLE_BASE_Y = TABLE_Y + BOTTLE_LIFT;

  let THREE = null;
  let running = false;
  const wheelGroups = new Map();
  let geometrySignature = "";
  let rebuiltWheelCount = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function runtime() {
    return global.Labeler3DSceneRuntime || null;
  }

  function adapter() {
    return global.Labeler3DBottleHandlingAdapter || null;
  }

  function appState() {
    try {
      if (typeof state !== "undefined" && state && typeof state === "object") return state;
    } catch {
      // Fall through to the window mirror in isolated environments.
    }
    return global.state && typeof global.state === "object" ? global.state : {};
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

  function unitsPerMm(snapshot) {
    return Math.max(0.000001, number(snapshot?.geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
  }

  function bottleDiameterMm(snapshot) {
    return Math.max(1, number(snapshot?.geometry?.bottle?.effectiveDiameterMm, 60.7));
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
    const outerRadius = Math.max(pitchRadius + scale, number(wheel?.outerRadiusWorld, 300 * scale));
    const pocketDiameterMm = bottleDiameterMm(snapshot) + POCKET_DIAMETRAL_CLEARANCE_MM;
    const pocketRadius = pocketDiameterMm * scale / 2;

    // The bottle center follows the star pitch circle. Intersect the true
    // bottle-clearance circle with the measured star outer circle, then trace
    // the inward circular arc between those intersections. This produces a
    // genuine bottle-shaped cradle rather than the old wave/scallop profile.
    const denominator = Math.max(1e-12, 2 * pitchRadius * pocketRadius);
    const cosGamma = clamp(
      (pitchRadius * pitchRadius + pocketRadius * pocketRadius - outerRadius * outerRadius) / denominator,
      -1,
      1
    );
    const gamma = Math.acos(cosGamma);
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

      // Travel from the lower outer-circle intersection, through the inward
      // cradle point, to the upper intersection. The decreasing pocket-circle
      // angle is intentional; the opposite direction wraps around the outside
      // of the clearance circle and creates the blocky/incorrect tooth shape.
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
    const scale = unitsPerMm(snapshot);
    const thicknessWorld = STAR_THICKNESS_MM * scale;
    const geometry = new THREE.ExtrudeGeometry(profile.shape, {
      depth: thicknessWorld,
      bevelEnabled: false,
      curveSegments: 3
    });
    geometry.translate(0, 0, -thicknessWorld / 2);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, profile, thicknessWorld };
  }

  function annularGeometry(outerRadius, innerRadius, thicknessWorld) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thicknessWorld,
      bevelEnabled: false,
      curveSegments: 64
    });
    geometry.translate(0, 0, -thicknessWorld / 2);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
  }

  function fourLobeCouplingGeometry(outerRadius, boreRadius, thicknessWorld) {
    const shape = new THREE.Shape();
    const samples = 128;
    for (let index = 0; index <= samples; index += 1) {
      const angle = index / samples * Math.PI * 2;
      const lobe = 0.5 + 0.5 * Math.cos(angle * 4);
      const radius = outerRadius * (1 - COUPLING_LOBE_DEPTH_RATIO / COUPLING_BASE_RADIUS_RATIO * (1 - lobe));
      const point = polar(radius, angle);
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thicknessWorld,
      bevelEnabled: false,
      curveSegments: 48
    });
    geometry.translate(0, 0, -thicknessWorld / 2);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
  }

  function removeLegacyCenterDetails(group) {
    [...group.children].forEach((child) => {
      const name = String(child?.name || "");
      if (/Hub$/.test(name) || /PitchReference$/.test(name) || name === "ServoForgeStarDrawingInnerAssembly") {
        group.remove(child);
        child.traverse?.((entry) => {
          entry.geometry?.dispose?.();
          if (Array.isArray(entry.material)) entry.material.forEach((material) => material?.dispose?.());
          else entry.material?.dispose?.();
        });
      }
    });
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

  function addDrawingBackedInnerAssembly(group, profile, snapshot) {
    removeLegacyCenterDetails(group);

    const scale = unitsPerMm(snapshot);
    const outer = profile.outerRadius;
    const innerGroup = new THREE.Group();
    innerGroup.name = "ServoForgeStarDrawingInnerAssembly";
    innerGroup.userData.referenceSource = "user-supplied-star-wheel-drawing-2026-08-18";
    innerGroup.userData.dimensionalAuthority = false;
    innerGroup.userData.visualHierarchyAuthority = true;

    // Ratios are taken from the supplied plan-view drawing. They are visual
    // hierarchy references only until actual inner-hub dimensions are measured.
    const ringOuter = outer * INNER_RING_OUTER_RADIUS_RATIO;
    const ringInner = outer * INNER_RING_INNER_RADIUS_RATIO;
    const ringThickness = 18 * scale;
    const couplingOuter = outer * COUPLING_BASE_RADIUS_RATIO;
    const boreRadius = outer * CENTER_BORE_RADIUS_RATIO;
    const couplingThickness = 24 * scale;

    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x889398, roughness: 0.38, metalness: 0.58 });
    const couplingMaterial = new THREE.MeshStandardMaterial({ color: 0x5f6b70, roughness: 0.34, metalness: 0.66 });
    const boltMaterial = new THREE.MeshStandardMaterial({ color: 0x3f4a4f, roughness: 0.28, metalness: 0.78 });

    const ring = new THREE.Mesh(annularGeometry(ringOuter, ringInner, ringThickness), ringMaterial);
    ring.name = "ServoForgeStarInnerMountingRing";
    innerGroup.add(ring);

    const coupling = new THREE.Mesh(fourLobeCouplingGeometry(couplingOuter, boreRadius, couplingThickness), couplingMaterial);
    coupling.name = "ServoForgeStarInnerCouplingPlate";
    coupling.position.y = 2 * scale;
    innerGroup.add(coupling);

    const primaryBoltRadius = outer * PRIMARY_BOLT_CIRCLE_RATIO;
    for (let index = 0; index < PRIMARY_BOLT_COUNT; index += 1) {
      const angle = Math.PI / 4 + index * Math.PI * 2 / PRIMARY_BOLT_COUNT;
      addBolt(innerGroup, primaryBoltRadius, angle, couplingThickness / 2 + 2 * scale, 9 * scale, 5 * scale, boltMaterial, `ServoForgeStarPrimaryBolt${index + 1}`);
    }

    const secondaryBoltRadius = outer * SECONDARY_BOLT_CIRCLE_RATIO;
    for (let index = 0; index < SECONDARY_BOLT_COUNT; index += 1) {
      const angle = index * Math.PI * 2 / SECONDARY_BOLT_COUNT;
      addBolt(innerGroup, secondaryBoltRadius, angle, ringThickness / 2 + 1.5 * scale, 4.5 * scale, 3 * scale, boltMaterial, `ServoForgeStarSecondaryBolt${index + 1}`);
    }

    group.add(innerGroup);
  }

  function currentContext() {
    const activeRuntime = runtime();
    const handlingAdapter = adapter();
    if (!activeRuntime?.snapshot || !handlingAdapter?.snapshot) return null;
    const snapshot = activeRuntime.latestSnapshot?.() || activeRuntime.snapshot({
      scene: {
        tableY: TABLE_Y,
        bottleLift: BOTTLE_LIFT,
        unitMode: "physical-mm-rounded-pocket-inner-hub"
      }
    });
    const current = appState();
    const handling = handlingAdapter.snapshot(
      snapshot?.scene?.carousel?.machineAngleDegrees,
      snapshot.geometry,
      {
        carouselDirection: String(current?.direction || "ccw"),
        zeroAngleDegrees: number(current?.zeroAngle, 0)
      }
    );
    return { snapshot, handling };
  }

  function signatureFor(context) {
    const { snapshot, handling } = context;
    return [
      bottleDiameterMm(snapshot).toFixed(3),
      unitsPerMm(snapshot).toFixed(8),
      STAR_THICKNESS_MM,
      POCKET_DIAMETRAL_CLEARANCE_MM,
      ...Object.entries(handling?.layout?.wheels || {}).map(([key, wheel]) => [
        key,
        number(wheel?.outerRadiusWorld).toFixed(6),
        number(wheel?.pitchRadiusWorld).toFixed(6),
        wheel?.pocketCount
      ].join(":"))
    ].join("|");
  }

  function rebuildWheels(context) {
    const { snapshot, handling } = context;
    const signature = signatureFor(context);
    const scale = unitsPerMm(snapshot);
    const centerAboveBottleBaseMm = STAR_BOTTOM_FACE_ABOVE_BOTTLE_BASE_MM + STAR_THICKNESS_MM / 2;
    const centerY = BOTTLE_BASE_Y + centerAboveBottleBaseMm * scale;

    wheelGroups.forEach((group, key) => {
      if (!group?.parent) {
        wheelGroups.delete(key);
        return;
      }
      const wheel = handling?.layout?.wheels?.[key];
      const plate = starPlate(group);
      if (!wheel || !plate) return;

      group.position.y = centerY;
      group.userData.sharedVerticalAuthority = "user-requested-all-three-stars-same-height";
      group.userData.starThicknessMm = STAR_THICKNESS_MM;
      group.userData.roundedPocketAuthority = "active-bottle-diameter-plus-3mm-diametral-clearance";
      group.userData.innerAssemblyReference = "user-supplied-star-wheel-drawing-2026-08-18";

      const localSignature = `${signature}|${key}`;
      if (plate.userData.roundedPocketInnerHubSignature === localSignature) return;

      const built = starBodyGeometry(wheel, snapshot);
      const previousGeometry = plate.geometry;
      plate.geometry = built.geometry;
      plate.scale.set(1, 1, 1);
      previousGeometry?.dispose?.();
      plate.userData.roundedPocketInnerHubSignature = localSignature;
      plate.userData.pocketOpeningDiameterMm = built.profile.pocketDiameterMm;
      plate.userData.pocketRadialClearanceMm = built.profile.radialClearanceMm;
      plate.userData.activeBottleDiameterMm = bottleDiameterMm(snapshot);
      plate.userData.starThicknessMm = STAR_THICKNESS_MM;
      plate.userData.pocketShapeAuthority = "true-circular-bottle-clearance-arc";

      addDrawingBackedInnerAssembly(group, built.profile, snapshot);
      rebuiltWheelCount += 1;
    });

    geometrySignature = signature;
  }

  function loop() {
    if (!running) return;
    try {
      const context = currentContext();
      if (context) rebuildWheels(context);
    } catch (error) {
      console.warn("ServoForge rounded star pocket / inner hub frame skipped", error);
    }
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
    if (!prototype || prototype.__servoforgeRoundedPocketInnerHubV1) return;

    const nativeAdd = prototype.add;
    prototype.add = function servoforgeRoundedPocketInnerHubAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        const key = wheelKeyForObject(object);
        if (!key) return;
        wheelGroups.set(key, object);
        startLoop();
      });
      return result;
    };

    Object.defineProperty(prototype, "__servoforgeRoundedPocketInnerHubV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }).catch((error) => {
    console.error("ServoForge rounded pocket / inner hub integration failed", error);
  });

  global.Labeler3DBottleHandlingRoundedPocketInnerHub = Object.freeze({
    PATCH_VERSION,
    STAR_THICKNESS_MM,
    POCKET_DIAMETRAL_CLEARANCE_MM,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        wheelGroups: wheelGroups.size,
        rebuiltWheelCount,
        geometrySignature,
        starThicknessMm: STAR_THICKNESS_MM,
        pocketDiametralClearanceMm: POCKET_DIAMETRAL_CLEARANCE_MM,
        pocketRadialClearanceMm: POCKET_DIAMETRAL_CLEARANCE_MM / 2,
        roundedBottlePockets: true,
        drawingBackedInnerAssembly: true,
        allThreeStarsSameVerticalCenter: true,
        readOnly: true
      });
    }
  });
})(window);
