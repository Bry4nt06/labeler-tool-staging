(function installServoForge3DBottleHandlingPocketClearanceAndLabels(global) {
  "use strict";

  const PATCH_VERSION = "servoforge.3d-bottle-handling-pocket-clearance-labels.v1";
  const THREE_VERSION = "0.185.1";
  const THREE_MODULE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
  const STAR_THICKNESS_MM = 60;
  const POCKET_DIAMETRAL_CLEARANCE_MM = 3;
  const BODY_PANEL_BOTTOM_MM = 24;
  const BODY_PANEL_TOP_MM = 78;
  const MIN_PAD_VERTICAL_CLEARANCE_MM = 12;
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const BOTTLE_BASE_Y = TABLE_Y + BOTTLE_LIFT;

  let THREE = null;
  let running = false;
  const wheelGroups = new Map();
  const handlingBottles = new Set();
  let labelPrototype = null;
  let labelSignature = "";
  let lastStarSignature = "";
  let lastSnapshot = null;
  let lastHandling = null;
  let rebuiltStarCount = 0;
  let restoredLabelBottleCount = 0;

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

  function labelFactory() {
    return global.Labeler3DLabelMeshFactory || null;
  }

  function labelAdapter() {
    return global.Labeler3DLabelGeometryAdapter || null;
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

  function isHandlingBottle(object) {
    return /^ServoForgeHandlingBottle\d+$/.test(String(object?.name || ""));
  }

  function starPlate(group) {
    return group?.children?.find((child) => /Plate$/.test(String(child?.name || "")) && child?.isMesh) || null;
  }

  function resolveUnitsPerMm(snapshot) {
    return Math.max(0.000001, number(snapshot?.geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
  }

  function resolveBottleDiameterMm(snapshot) {
    return Math.max(1, number(snapshot?.geometry?.bottle?.effectiveDiameterMm, 60.7));
  }

  function resolvePocketOpeningDiameterMm(snapshot) {
    return resolveBottleDiameterMm(snapshot) + POCKET_DIAMETRAL_CLEARANCE_MM;
  }

  function resolveBodyPanelEnvelope(snapshot) {
    const body = snapshot?.labels?.sections?.body;
    const bottomMm = Number.isFinite(Number(body?.bottomMm)) ? Number(body.bottomMm) : BODY_PANEL_BOTTOM_MM;
    const topMm = Number.isFinite(Number(body?.topMm)) ? Number(body.topMm) : BODY_PANEL_TOP_MM;
    const thicknessMm = STAR_THICKNESS_MM;
    let centerMm = (bottomMm + topMm) / 2;
    let bottomFaceMm = centerMm - thicknessMm / 2;
    if (bottomFaceMm < MIN_PAD_VERTICAL_CLEARANCE_MM) {
      centerMm += MIN_PAD_VERTICAL_CLEARANCE_MM - bottomFaceMm;
      bottomFaceMm = MIN_PAD_VERTICAL_CLEARANCE_MM;
    }
    return Object.freeze({
      sourceBottomMm: bottomMm,
      sourceTopMm: topMm,
      centerAboveBottleBaseMm: centerMm,
      bottomFaceAboveBottleBaseMm: bottomFaceMm,
      topFaceAboveBottleBaseMm: centerMm + thicknessMm / 2,
      bottlePadTopAboveBottleBaseMm: 0,
      bottlePadVerticalClearanceMm: bottomFaceMm,
      thicknessMm
    });
  }

  function polarPoint(radius, angle) {
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  function pushPoint(points, point) {
    const previous = points[points.length - 1];
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 1e-8) return;
    points.push(point);
  }

  function pocketedStarShape(wheel, snapshot) {
    const unitsPerMm = resolveUnitsPerMm(snapshot);
    const count = Math.max(3, Math.round(number(wheel?.pocketCount, 16)));
    const pitchRadius = Math.max(0.001, number(wheel?.pitchRadiusWorld));
    const configuredOuter = number(wheel?.outerRadiusWorld);
    const fallbackOuter = pitchRadius + resolveBottleDiameterMm(snapshot) * unitsPerMm * 0.30;
    const outerRadius = Math.max(pitchRadius + unitsPerMm, configuredOuter > 0 ? configuredOuter : fallbackOuter);
    const requestedPocketRadius = resolvePocketOpeningDiameterMm(snapshot) * unitsPerMm / 2;
    const minimumOpenPocketRadius = Math.max(unitsPerMm, outerRadius - pitchRadius + unitsPerMm * 0.5);
    const pocketRadius = Math.max(requestedPocketRadius, minimumOpenPocketRadius);

    const denominator = 2 * outerRadius * pitchRadius;
    const cosIntersection = denominator > 1e-12
      ? clamp((outerRadius * outerRadius + pitchRadius * pitchRadius - pocketRadius * pocketRadius) / denominator, -1, 1)
      : 1;
    const halfMouthAngle = Math.acos(cosIntersection);
    const pocketPitch = Math.PI * 2 / count;
    const mouthHalf = Math.min(halfMouthAngle, pocketPitch * 0.44);
    const points = [];
    const notchSamples = 22;
    const outerSamples = 8;

    for (let pocket = 0; pocket < count; pocket += 1) {
      const centerAngle = pocket * pocketPitch;
      const startAngle = centerAngle - mouthHalf;
      const endAngle = centerAngle + mouthHalf;
      const center = polarPoint(pitchRadius, centerAngle);
      const start = polarPoint(outerRadius, startAngle);
      const end = polarPoint(outerRadius, endAngle);

      if (pocket === 0) pushPoint(points, start);

      const betaStart = Math.atan2(start.y - center.y, start.x - center.x);
      const betaEnd = Math.atan2(end.y - center.y, end.x - center.x);
      let shortDelta = betaEnd - betaStart;
      while (shortDelta > Math.PI) shortDelta -= Math.PI * 2;
      while (shortDelta < -Math.PI) shortDelta += Math.PI * 2;
      const longDelta = shortDelta >= 0 ? shortDelta - Math.PI * 2 : shortDelta + Math.PI * 2;

      for (let step = 1; step <= notchSamples; step += 1) {
        const t = step / notchSamples;
        const beta = betaStart + longDelta * t;
        pushPoint(points, {
          x: center.x + Math.cos(beta) * pocketRadius,
          y: center.y + Math.sin(beta) * pocketRadius
        });
      }

      const nextCenterAngle = (pocket + 1) * pocketPitch;
      const outerEndAngle = nextCenterAngle - mouthHalf;
      for (let step = 1; step <= outerSamples; step += 1) {
        const t = step / outerSamples;
        const angle = endAngle + (outerEndAngle - endAngle) * t;
        pushPoint(points, polarPoint(outerRadius, angle));
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
      pocketOpeningDiameterMm: pocketRadius * 2 / unitsPerMm,
      pocketCenterSpacingMm: 2 * (pitchRadius / unitsPerMm) * Math.sin(Math.PI / count),
      mouthHalfAngle,
      pocketCount: count
    };
  }

  function createStarBodyGeometry(wheel, snapshot) {
    const profile = pocketedStarShape(wheel, snapshot);
    const unitsPerMm = resolveUnitsPerMm(snapshot);
    const thicknessWorld = STAR_THICKNESS_MM * unitsPerMm;
    const geometry = new THREE.ExtrudeGeometry(profile.shape, {
      depth: thicknessWorld,
      bevelEnabled: false,
      curveSegments: 2
    });
    geometry.translate(0, 0, -thicknessWorld / 2);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, profile, thicknessWorld };
  }

  function starGeometrySignature(snapshot, handling) {
    return [
      resolveBottleDiameterMm(snapshot).toFixed(3),
      resolveUnitsPerMm(snapshot).toFixed(8),
      STAR_THICKNESS_MM,
      POCKET_DIAMETRAL_CLEARANCE_MM,
      ...Object.entries(handling?.layout?.wheels || {}).map(([key, wheel]) => [
        key,
        wheel.pocketCount,
        number(wheel.pitchRadiusWorld).toFixed(6),
        number(wheel.outerRadiusWorld).toFixed(6)
      ].join(":"))
    ].join("|");
  }

  function applyStarBodies(snapshot, handling) {
    const signature = starGeometrySignature(snapshot, handling);
    const vertical = resolveBodyPanelEnvelope(snapshot);
    const unitsPerMm = resolveUnitsPerMm(snapshot);
    const centerY = BOTTLE_BASE_Y + vertical.centerAboveBottleBaseMm * unitsPerMm;

    wheelGroups.forEach((group, key) => {
      if (!group?.parent) {
        wheelGroups.delete(key);
        return;
      }
      const wheel = handling?.layout?.wheels?.[key];
      const plate = starPlate(group);
      if (!wheel || !plate) return;

      group.position.y = centerY;
      group.userData.starThicknessMm = STAR_THICKNESS_MM;
      group.userData.bodyPanelCenterAboveBottleBaseMm = vertical.centerAboveBottleBaseMm;
      group.userData.starBottomFaceAboveBottleBaseMm = vertical.bottomFaceAboveBottleBaseMm;
      group.userData.starTopFaceAboveBottleBaseMm = vertical.topFaceAboveBottleBaseMm;
      group.userData.bottlePadVerticalClearanceMm = vertical.bottlePadVerticalClearanceMm;
      group.userData.bottlePadCollisionAvoidance = "vertical-separation-above-bottle-pad-contact-plane";

      const localSignature = `${signature}|${key}`;
      if (plate.userData.starPocketClearanceSignature === localSignature) return;

      const built = createStarBodyGeometry(wheel, snapshot);
      const oldGeometry = plate.geometry;
      plate.geometry = built.geometry;
      plate.scale.set(1, 1, 1);
      oldGeometry?.dispose?.();
      plate.userData.starPocketClearanceSignature = localSignature;
      plate.userData.starThicknessMm = STAR_THICKNESS_MM;
      plate.userData.pocketDiametralClearanceMm = POCKET_DIAMETRAL_CLEARANCE_MM;
      plate.userData.pocketOpeningDiameterMm = built.profile.pocketOpeningDiameterMm;
      plate.userData.pocketCenterSpacingMm = built.profile.pocketCenterSpacingMm;
      plate.userData.activeBottleDiameterMm = resolveBottleDiameterMm(snapshot);
      plate.userData.pocketFitAuthority = "active-bottle-diameter-plus-functional-clearance";
      plate.userData.starThicknessAuthority = "user-measured-60mm";
      rebuiltStarCount += 1;
    });

    lastStarSignature = signature;
  }

  function sectionLabelMap(labelGroup) {
    const meshes = {};
    labelGroup?.traverse?.((child) => {
      const section = String(child?.userData?.labelSection || "").trim();
      if (section) meshes[section] = child;
    });
    return meshes;
  }

  function currentLabelSignature(snapshot) {
    const labels = snapshot?.labels || {};
    return JSON.stringify({
      brand: labels.brand,
      bottleType: labels.bottleType,
      sections: Object.fromEntries(["neck", "body", "back"].map((section) => {
        const item = labels?.sections?.[section] || {};
        return [section, {
          enabled: Boolean(item.enabled),
          wrapDegrees: number(item.wrapDegrees),
          centerAngleDegrees: number(item.centerAngleDegrees),
          bottomWorld: number(item.bottomWorld),
          topWorld: number(item.topWorld),
          applicationAngleDegrees: Number.isFinite(Number(item.applicationAngleDegrees)) ? Number(item.applicationAngleDegrees) : null
        }];
      }))
    });
  }

  function disposePrototype() {
    if (!labelPrototype) return;
    labelPrototype.traverse?.((child) => {
      if (!child?.isMesh) return;
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((material) => {
        material?.map?.dispose?.();
        material?.dispose?.();
      });
      else {
        child.material?.map?.dispose?.();
        child.material?.dispose?.();
      }
    });
    labelPrototype = null;
  }

  function clearBottleLabelGroup(bottle) {
    const current = bottle?.children?.find((child) => child?.name === "ServoForgeHandlingBottleLabels");
    if (current) bottle.remove(current);
  }

  function rebuildLabelPrototype(snapshot) {
    const factory = labelFactory();
    const signature = currentLabelSignature(snapshot);
    if (signature === labelSignature && labelPrototype) return false;

    handlingBottles.forEach((bottle) => clearBottleLabelGroup(bottle));
    disposePrototype();
    labelSignature = signature;
    if (!factory?.createBottleLabels || !snapshot?.labels?.sections) return true;

    labelPrototype = factory.createBottleLabels(THREE, snapshot.labels, snapshot.geometry);
    if (labelPrototype) labelPrototype.name = "ServoForgeHandlingBottleLabelsPrototype";
    return true;
  }

  function attachLabels(bottle) {
    if (!bottle || !bottle.parent || !labelPrototype) return;
    if (bottle.children.some((child) => child?.name === "ServoForgeHandlingBottleLabels")) return;
    const labels = labelPrototype.clone(true);
    labels.name = "ServoForgeHandlingBottleLabels";
    labels.userData.labelMeshes = sectionLabelMap(labels);
    labels.userData.labelApplicationAuthority = "per-bottle-carousel-angle";
    bottle.add(labels);
    restoredLabelBottleCount += 1;
  }

  function passedApplication(tableAngle, applicationAngle) {
    const adapterRef = labelAdapter();
    if (typeof adapterRef?.bottleHasPassedApplication === "function") {
      return adapterRef.bottleHasPassedApplication(tableAngle, applicationAngle);
    }
    if (!Number.isFinite(Number(applicationAngle))) return true;
    const normalize = (value) => ((number(value) % 360) + 360) % 360;
    return normalize(tableAngle) + 0.001 >= normalize(applicationAngle);
  }

  function effectiveApplicationAngleForBottle(bottle, handling) {
    const owner = String(bottle?.userData?.owner || "");
    if (owner === "carousel") return number(bottle?.userData?.tableAngleDegrees, NaN);
    if (owner === "discharge-star" || owner === "outfeed-conveyor") {
      return number(handling?.layout?.exitAngleDegrees, NaN);
    }
    return NaN;
  }

  function updateBottleLabels(snapshot, handling) {
    rebuildLabelPrototype(snapshot);
    const sections = snapshot?.labels?.sections || {};

    handlingBottles.forEach((bottle) => {
      if (!bottle?.parent) {
        handlingBottles.delete(bottle);
        return;
      }
      attachLabels(bottle);
      const group = bottle.children.find((child) => child?.name === "ServoForgeHandlingBottleLabels");
      const meshes = group?.userData?.labelMeshes || sectionLabelMap(group);
      const tableAngle = effectiveApplicationAngleForBottle(bottle, handling);

      ["neck", "body", "back"].forEach((sectionName) => {
        const mesh = meshes?.[sectionName];
        if (!mesh) return;
        const section = sections?.[sectionName] || {};
        mesh.visible = Boolean(section.enabled)
          && Number.isFinite(tableAngle)
          && passedApplication(tableAngle, section.applicationAngleDegrees);
        mesh.userData.applicationAngleDegrees = section.applicationAngleDegrees;
        mesh.userData.applicationStateSource = "handling-bottle-owner-and-table-angle";
      });
    });
  }

  function currentSnapshots() {
    const activeRuntime = runtime();
    const handlingAdapter = adapter();
    if (!activeRuntime?.snapshot || !handlingAdapter?.snapshot) return null;
    const snapshot = activeRuntime.snapshot({
      scene: {
        tableY: TABLE_Y,
        bottleLift: BOTTLE_LIFT,
        unitMode: "physical-mm-star-pocket-label-restoration"
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

  function updateViewportCopy(snapshot) {
    const note = global.document?.querySelector?.(".servoforge-3d-note");
    if (note && !note.dataset.starPocketLabelsV1) {
      note.dataset.starPocketLabelsV1 = "true";
      note.innerHTML = `<strong>Handling geometry:</strong> star bodies are ${STAR_THICKNESS_MM} mm thick and elevated into the bottle body panel. Pocket opening follows active bottle diameter + ${POCKET_DIAMETRAL_CLEARANCE_MM} mm functional clearance. The star lower face stays above the bottle-pad contact plane. Labels now apply per bottle as each carousel table passes its ServoForge application angle.`;
    }
    const legend = global.document?.querySelector?.(".servoforge-3d-legend");
    if (legend && !legend.dataset.starPocketLabelsV1) {
      legend.dataset.starPocketLabelsV1 = "true";
      legend.innerHTML += "<br>Cream labels: appear after each bottle passes its mapped application station";
    }
  }

  function loop() {
    if (!running) return;
    try {
      const current = currentSnapshots();
      if (current) {
        lastSnapshot = current.snapshot;
        lastHandling = current.handling;
        applyStarBodies(current.snapshot, current.handling);
        updateBottleLabels(current.snapshot, current.handling);
        updateViewportCopy(current.snapshot);
      }
    } catch (error) {
      console.warn("ServoForge star pocket/label restoration frame skipped", error);
    }
    global.requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running) return;
    running = true;
    global.requestAnimationFrame(loop);
  }

  function installHooks() {
    const prototype = THREE?.Object3D?.prototype;
    if (!prototype || prototype.__servoforgeStarPocketLabelRestoreV1) return;
    const nativeAdd = prototype.add;
    prototype.add = function servoforgeStarPocketLabelRestoreAdd(...objects) {
      const result = nativeAdd.apply(this, objects);
      objects.forEach((object) => {
        const wheelKey = wheelKeyForObject(object);
        if (wheelKey) wheelGroups.set(wheelKey, object);
        if (isHandlingBottle(object)) handlingBottles.add(object);
      });
      if ((wheelGroups.size || handlingBottles.size) && !running) startLoop();
      return result;
    };
    Object.defineProperty(prototype, "__servoforgeStarPocketLabelRestoreV1", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true
    });
  }

  function status() {
    const vertical = lastSnapshot ? resolveBodyPanelEnvelope(lastSnapshot) : null;
    return Object.freeze({
      patchVersion: PATCH_VERSION,
      installed: Boolean(THREE),
      wheelGroups: wheelGroups.size,
      handlingBottles: handlingBottles.size,
      rebuiltStarCount,
      restoredLabelBottleCount,
      starThicknessMm: STAR_THICKNESS_MM,
      pocketDiametralClearanceMm: POCKET_DIAMETRAL_CLEARANCE_MM,
      activeBottleDiameterMm: lastSnapshot ? resolveBottleDiameterMm(lastSnapshot) : null,
      pocketOpeningDiameterMm: lastSnapshot ? resolvePocketOpeningDiameterMm(lastSnapshot) : null,
      bottlePadVerticalClearanceMm: vertical?.bottlePadVerticalClearanceMm ?? null,
      labelApplicationRestored: Boolean(labelPrototype),
      carouselServoAuthorityUntouched: true,
      handlingSchemaVersion: lastHandling?.schemaVersion || null,
      readOnly: true
    });
  }

  global.Labeler3DBottleHandlingPocketClearanceAndLabels = Object.freeze({
    PATCH_VERSION,
    STAR_THICKNESS_MM,
    POCKET_DIAMETRAL_CLEARANCE_MM,
    BODY_PANEL_BOTTOM_MM,
    BODY_PANEL_TOP_MM,
    MIN_PAD_VERTICAL_CLEARANCE_MM,
    resolvePocketOpeningDiameterMm,
    resolveBodyPanelEnvelope,
    status
  });

  import(THREE_MODULE_URL)
    .then((module) => {
      THREE = module;
      installHooks();
    })
    .catch((error) => console.error("ServoForge star pocket/label restoration integration failed", error));
})(window);
