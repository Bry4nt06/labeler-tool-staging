(function installServoForge3DNeckContactCoderCorrection(global) {
  "use strict";

  const baseEquipmentAdapter = global.Labeler3DEquipmentLayoutAdapter;
  const baseHardwareFactory = global.Labeler3DHardwareMeshFactory;
  const baseWipePadAdapter = global.Labeler3DWipePadGeometryAdapter;
  if (!baseEquipmentAdapter?.snapshot || !baseHardwareFactory?.createEquipmentAssembly || !baseWipePadAdapter?.snapshot) {
    throw new Error("ServoForge neck-contact/coder correction requires equipment, hardware, and wipe-pad adapters.");
  }

  const PATCH_VERSION = "servoforge.3d-neck-contact-coder.v1";
  const CODER_BOTTLE_SURFACE_SETBACK_MM = 190;
  const NECK_CONTACT_PENETRATION_MM = 0;
  const TABLE_Y = 0.20;
  const BOTTLE_LIFT = 0.155;
  const BOTTLE_BASE_Y = TABLE_Y + BOTTLE_LIFT;
  const BRUSH_CONTACT_THICKNESS_WORLD = 0.085;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function profile(id) {
    return global.Labeler3DHardwareReferenceCatalog?.profile?.(id) || null;
  }

  function unitsPerMm(geometry = {}) {
    return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
  }

  function bottleBaseYWorld() {
    return BOTTLE_BASE_Y;
  }

  function neckReference(geometry = {}) {
    if (typeof baseHardwareFactory.neckSlopeReference === "function") {
      return baseHardwareFactory.neckSlopeReference(geometry);
    }
    const bottle = geometry?.bottle || {};
    const bodyTopMm = 10 + Math.max(1, number(bottle.bodyStraightHeightMm, 92));
    const shoulderTopMm = bodyTopMm + Math.max(1, number(bottle.shoulderTransitionHeightMm, 41.5));
    const finishStartMm = Math.max(
      shoulderTopMm + 1,
      number(bottle.referenceHeightMm, 241.5) - Math.max(1, number(bottle.finishHeightMm, 17))
    );
    return Object.freeze({
      targetYmm: (shoulderTopMm + finishStartMm) / 2,
      radialSlope: -0.12,
      tiltRadians: Math.atan(0.12),
      tiltDegrees: Math.atan(0.12) * 180 / Math.PI,
      authority: "reference-bottle-profile-neck-slope-midpoint"
    });
  }

  function radiusAtHeightMm(geometry = {}, targetYmm = 0) {
    const points = (Array.isArray(geometry?.bottle?.profilePointsMm) ? geometry.bottle.profilePointsMm : [])
      .map((point) => ({ y: number(point?.yMm), radius: number(point?.radiusMm, NaN) }))
      .filter((point) => Number.isFinite(point.radius))
      .sort((a, b) => a.y - b.y);
    if (!points.length) {
      return Math.max(1, number(geometry?.bottle?.shoulderNeckDiameterMm, 37) / 2);
    }
    if (targetYmm <= points[0].y) return points[0].radius;
    if (targetYmm >= points[points.length - 1].y) return points[points.length - 1].radius;
    for (let index = 1; index < points.length; index += 1) {
      const left = points[index - 1];
      const right = points[index];
      if (targetYmm > right.y) continue;
      const span = right.y - left.y || 1;
      const t = (targetYmm - left.y) / span;
      return left.radius + (right.radius - left.radius) * t;
    }
    return points[points.length - 1].radius;
  }

  function isNeckContact(item = {}) {
    const section = String(item?.section || item?.labelSection || "").trim().toLowerCase();
    const station = Number(item?.station);
    return section === "neck" || station === 1 || station === 2;
  }

  function machineOrbit(angle, radius, options) {
    const adapter = global.Labeler3DSceneAdapter;
    if (!adapter?.machineOrbit) throw new Error("ServoForge neck-contact correction requires machineOrbit.");
    return adapter.machineOrbit(angle, {
      carouselRadius: radius,
      carouselDirection: options.carouselDirection,
      zeroAngleDegrees: options.zeroAngleDegrees
    });
  }

  function rollerRadiusWorld(geometry = {}) {
    const bottleDiameterWorld = Math.max(0.10, number(geometry?.bottle?.diameterWorld, 0.27));
    const ratios = profile("wipe-roller")?.visualRatios || {};
    const diameter = Math.max(0.12, bottleDiameterWorld * number(ratios.rollerDiameterBottleDiameter, 0.72));
    return diameter / 2;
  }

  function coderFaceOffsetWorld(geometry = {}) {
    const bottleDiameterWorld = Math.max(0.10, number(geometry?.bottle?.diameterWorld, 0.27));
    const ratios = profile("laser-coder")?.visualRatios || {};
    const depth = bottleDiameterWorld * number(ratios.housingDepthBottleDiameters, 1.05);
    const projection = bottleDiameterWorld * number(ratios.emitterProjectionBottleDiameter, 0.48);
    return depth / 2 + projection;
  }

  function inwardCoderRotationY(position = {}) {
    // Coder emitter/lens points down local -Z. Choose yaw so local -Z points
    // exactly from the coder toward the carousel center in the XZ plane.
    return Math.atan2(number(position.x), number(position.z));
  }

  function neckGeometryForPad(geometry = {}) {
    const neck = neckReference(geometry);
    const neckRadiusMm = radiusAtHeightMm(geometry, neck.targetYmm);
    return {
      ...geometry,
      bottle: {
        ...(geometry.bottle || {}),
        effectiveRadiusMm: neckRadiusMm,
        effectiveDiameterMm: neckRadiusMm * 2
      }
    };
  }

  function wipePadSnapshot(item = {}, geometry = {}) {
    if (!isNeckContact(item)) return baseWipePadAdapter.snapshot(item, geometry);
    const corrected = baseWipePadAdapter.snapshot(item, neckGeometryForPad(geometry));
    return freeze({
      ...corrected,
      bottleRadiusMm: radiusAtHeightMm(geometry, neckReference(geometry).targetYmm),
      neckContactAuthority: "reference-bottle-neck-radius-at-neck-wipe-height",
      verticalContactAuthority: "aggregate-1-2-neck-level"
    });
  }

  global.Labeler3DWipePadGeometryAdapter = Object.freeze({
    ...baseWipePadAdapter,
    PATCH_VERSION,
    snapshot: wipePadSnapshot
  });

  function correctedEquipmentSnapshot(machineMap, stateLike, geometry, options = {}) {
    const base = baseEquipmentAdapter.snapshot(machineMap, stateLike, geometry, options);
    const scale = unitsPerMm(geometry);
    const pitchRadius = Math.max(0.001, number(base?.physicalPitchRadiusWorld, geometry?.machine?.physicalPitchRadiusWorld));
    const bottleBodyRadius = Math.max(0.001, number(geometry?.bottle?.radiusWorld, number(geometry?.bottle?.diameterWorld, 0.27) / 2));
    const neck = neckReference(geometry);
    const neckRadiusMm = radiusAtHeightMm(geometry, neck.targetYmm);
    const neckRadiusWorld = neckRadiusMm * scale;
    const carouselDirection = String(options.carouselDirection || machineMap?.machineSettings?.direction || stateLike?.direction || "ccw");
    const zeroAngleDegrees = number(options.zeroAngleDegrees, number(machineMap?.machineSettings?.zeroAngle, stateLike?.zeroAngle));

    const objects = (Array.isArray(base?.objects) ? base.objects : []).map((item) => {
      const kind = String(item?.kind || "");
      const neckContact = isNeckContact(item) && ["roller", "pad", "brush", "brush-channel"].includes(kind);

      if (neckContact && kind === "pad" && item.wipePad) {
        const radialWorld = number(item.wipePad.assemblyCenterRadiusWorld, item.radialWorld);
        const orbit = machineOrbit(item.angleDegrees, radialWorld, { carouselDirection, zeroAngleDegrees });
        return freeze({
          ...item,
          section: "neck",
          radialWorld,
          radialMmEquivalent: radialWorld / scale,
          position: { x: orbit.x, y: 0, z: orbit.z },
          contactHeightWorld: bottleBaseYWorld() + neck.targetYmm * scale,
          neckRadiusMm,
          neckContactAuthority: "neck-radius-plus-measured-2mm-pad-penetration",
          placementAuthority: "machine-map-angle-plus-neck-radius-plus-measured-wipe-contact-geometry"
        });
      }

      if (neckContact && (kind === "roller" || kind === "brush" || kind === "brush-channel")) {
        const sideSign = item.side === "inner" ? -1 : 1;
        const toolHalfDepth = kind === "roller" ? rollerRadiusWorld(geometry) : BRUSH_CONTACT_THICKNESS_WORLD / 2;
        const radialWorld = pitchRadius + sideSign * (
          neckRadiusWorld + toolHalfDepth - NECK_CONTACT_PENETRATION_MM * scale
        );
        const orbit = machineOrbit(item.angleDegrees, radialWorld, { carouselDirection, zeroAngleDegrees });
        return freeze({
          ...item,
          section: "neck",
          radialWorld,
          radialMmEquivalent: radialWorld / scale,
          position: { x: orbit.x, y: 0, z: orbit.z },
          contactHeightWorld: bottleBaseYWorld() + neck.targetYmm * scale,
          neckRadiusMm,
          neckContactAuthority: "tangent-contact-at-reference-neck-radius",
          placementAuthority: "machine-map-angle-plus-neck-surface-tangent-contact"
        });
      }

      if (kind === "coding") {
        const setbackWorld = CODER_BOTTLE_SURFACE_SETBACK_MM * scale;
        const faceRadiusWorld = pitchRadius + bottleBodyRadius + setbackWorld;
        const faceOffsetWorld = coderFaceOffsetWorld(geometry);
        const radialWorld = faceRadiusWorld + faceOffsetWorld;
        const orbit = machineOrbit(item.angleDegrees, radialWorld, { carouselDirection, zeroAngleDegrees });
        const position = { x: orbit.x, y: 0, z: orbit.z };
        return freeze({
          ...item,
          radialWorld,
          radialMmEquivalent: radialWorld / scale,
          position,
          aimRotationY: inwardCoderRotationY(position),
          orientationTarget: "carousel-centerline",
          coderBottleSurfaceSetbackMm: CODER_BOTTLE_SURFACE_SETBACK_MM,
          coderFaceRadiusWorld: faceRadiusWorld,
          coderFaceOffsetWorld: faceOffsetWorld,
          coderAimAuthority: "radial-inward-to-carousel-centerline",
          coderSetbackAuthority: "user-specified-190mm-from-bottle-surface",
          placementAuthority: "machine-map-angle-plus-190mm-bottle-surface-setback"
        });
      }

      return item;
    });

    return freeze({
      ...base,
      schemaVersion: "servoforge.3d-equipment.v3-neck-contact-coder",
      patchVersion: PATCH_VERSION,
      objects,
      neckContact: {
        stations: [1, 2],
        targetHeightMm: neck.targetYmm,
        neckRadiusMm,
        rollerPenetrationMm: NECK_CONTACT_PENETRATION_MM,
        authority: "reference-bottle-profile-neck-contact"
      },
      coderPresentation: {
        setbackFromBottleSurfaceMm: CODER_BOTTLE_SURFACE_SETBACK_MM,
        aimTarget: "carousel-centerline",
        authority: "user-specified"
      }
    });
  }

  global.Labeler3DEquipmentLayoutAdapter = Object.freeze({
    ...baseEquipmentAdapter,
    SCHEMA_VERSION: "servoforge.3d-equipment.v3-neck-contact-coder",
    PATCH_VERSION,
    CODER_BOTTLE_SURFACE_SETBACK_MM,
    snapshot: correctedEquipmentSnapshot
  });

  function correctRollerTilt(THREE, assembly, item, geometry) {
    if (!assembly || !isNeckContact(item)) return assembly;
    const roller = assembly.getObjectByName?.("ServoForgePurposeViewRoller");
    if (!roller) return assembly;
    const neck = neckReference(geometry);
    const radialMagnitude = Math.hypot(number(item?.position?.x), number(item?.position?.z)) || 1;
    const radialX = number(item?.position?.x) / radialMagnitude;
    const radialZ = number(item?.position?.z) / radialMagnitude;
    const correctedSlope = item?.side === "inner" ? number(neck.radialSlope) : -number(neck.radialSlope);
    const contactAxis = new THREE.Vector3(radialX * correctedSlope, 1, radialZ * correctedSlope).normalize();
    roller.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), contactAxis);
    assembly.userData.hardwareReference = Object.freeze({
      ...(assembly.userData.hardwareReference || {}),
      neckContact: true,
      outsideRollerTiltCorrected: item?.side !== "inner",
      surfaceTiltDegrees: Math.abs(number(neck.tiltDegrees)),
      tiltAuthority: item?.side === "inner"
        ? "existing-inner-neck-surface-tangent"
        : "user-corrected-opposite-sign-for-outside-neck-roller"
    });
    return assembly;
  }

  function correctNeckVertical(assembly, item, geometry) {
    if (!assembly || !isNeckContact(item)) return assembly;
    const kind = String(item?.kind || "");
    if (!["pad", "brush", "brush-channel"].includes(kind)) return assembly;
    const scale = unitsPerMm(geometry);
    const neck = neckReference(geometry);
    const centerY = bottleBaseYWorld() + neck.targetYmm * scale;

    if (kind === "pad") {
      assembly.children.forEach((child) => {
        if (child?.isGroup && String(child?.name || "").startsWith("ServoForgeMeasuredWipePad-")) {
          child.position.y = centerY;
        }
      });
    } else {
      assembly.traverse?.((child) => {
        if (child?.isMesh) child.position.y = centerY;
      });
    }
    assembly.userData.neckVerticalAuthority = "aggregate-1-2-same-neck-level-as-rollers";
    assembly.userData.neckContactHeightMm = neck.targetYmm;
    return assembly;
  }

  function createEquipmentAssembly(THREE, item, geometry) {
    const assembly = baseHardwareFactory.createEquipmentAssembly(THREE, item, geometry);
    if (!assembly) return null;
    correctRollerTilt(THREE, assembly, item, geometry);
    correctNeckVertical(assembly, item, geometry);
    if (item?.kind === "coding") {
      assembly.userData.coderAimAuthority = "radial-inward-to-carousel-centerline";
      assembly.userData.coderBottleSurfaceSetbackMm = CODER_BOTTLE_SURFACE_SETBACK_MM;
    }
    return assembly;
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseHardwareFactory,
    FACTORY_VERSION: "servoforge.3d-hardware-mesh.v10-neck-contact-coder",
    PATCH_VERSION,
    createEquipmentAssembly
  });

  global.Labeler3DNeckContactCoderCorrection = Object.freeze({
    PATCH_VERSION,
    CODER_BOTTLE_SURFACE_SETBACK_MM,
    NECK_CONTACT_PENETRATION_MM,
    isNeckContact,
    radiusAtHeightMm,
    inwardCoderRotationY,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        neckStations: [1, 2],
        coderSetbackMm: CODER_BOTTLE_SURFACE_SETBACK_MM,
        coderAim: "carousel-centerline",
        outsideRollerTiltFlipped: true,
        readOnly: true
      });
    }
  });
})(window);
