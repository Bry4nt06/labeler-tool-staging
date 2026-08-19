(function installServoForge3DBottleHandlingMeasuredStarLayout(global) {
  "use strict";

  const base = global.Labeler3DBottleHandlingAdapter;
  const sceneAdapter = global.Labeler3DSceneAdapter;
  if (!base?.buildLayout || !base?.pointAtPitch || !sceneAdapter?.machineOrbit) return;

  const PATCH_VERSION = "servoforge.3d-bottle-handling-measured-stars.v1";
  const REFERENCE_SOURCE = "user-measured-handling-stars-2026-08-18";
  const STAR_OUTER_DIAMETER_MM = 600;
  const STAR_OUTER_RADIUS_MM = STAR_OUTER_DIAMETER_MM / 2;
  const INTERMEDIATE_DISCHARGE_CLEAR_GAP_MM = 200;
  const INTERMEDIATE_DISCHARGE_CENTER_DISTANCE_MM = STAR_OUTER_DIAMETER_MM + INTERMEDIATE_DISCHARGE_CLEAR_GAP_MM;
  const STAR_POCKET_COUNT = 16;
  const ENTRY_TRANSFER_ANGLE_DEGREES = 30;
  const DISCHARGE_TRANSFER_ANGLE_DEGREES = 330;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function add(a, b) {
    return { x: number(a?.x) + number(b?.x), z: number(a?.z) + number(b?.z) };
  }

  function subtract(a, b) {
    return { x: number(a?.x) - number(b?.x), z: number(a?.z) - number(b?.z) };
  }

  function scale(vector, factor) {
    return { x: number(vector?.x) * factor, z: number(vector?.z) * factor };
  }

  function magnitude(vector) {
    return Math.hypot(number(vector?.x), number(vector?.z));
  }

  function unit(vector, fallback = { x: 1, z: 0 }) {
    const length = magnitude(vector);
    return length > 1e-9
      ? { x: number(vector?.x) / length, z: number(vector?.z) / length }
      : { x: number(fallback?.x, 1), z: number(fallback?.z, 0) };
  }

  function polarAngle(vector) {
    return Math.atan2(number(vector?.z), number(vector?.x));
  }

  function routeRotationY(direction) {
    const tangent = unit(direction);
    return Math.atan2(-tangent.z, tangent.x);
  }

  function normalizeAngle(value) {
    const normalized = number(value, 0) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function fraction(value) {
    const numeric = number(value, 0);
    return numeric - Math.floor(numeric);
  }

  function machineOrbit(angleDegrees, radius, layout) {
    return sceneAdapter.machineOrbit(angleDegrees, {
      carouselRadius: radius,
      carouselDirection: layout.carouselDirection,
      zeroAngleDegrees: layout.zeroAngleDegrees
    });
  }

  function tangentAt(angleDegrees, radius, layout) {
    const start = machineOrbit(angleDegrees, radius, layout);
    const end = machineOrbit(angleDegrees + 0.1, radius, layout);
    return unit(subtract(end, start));
  }

  function signedDeltaWithSign(startRadians, endRadians, sign) {
    let delta = endRadians - startRadians;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (sign >= 0 && delta <= 0) delta += Math.PI * 2;
    if (sign < 0 && delta >= 0) delta -= Math.PI * 2;
    return delta;
  }

  function arcSegment(id, owner, center, radius, startPoint, endPoint, routeDirectionSign) {
    const startRadians = polarAngle(subtract(startPoint, center));
    const endRadians = polarAngle(subtract(endPoint, center));
    const sign = number(routeDirectionSign, 1) >= 0 ? 1 : -1;
    const deltaRadians = signedDeltaWithSign(startRadians, endRadians, sign);
    const pocketPitchRadians = Math.PI * 2 / STAR_POCKET_COUNT;
    return {
      id,
      owner,
      type: "star-arc",
      center,
      radius,
      startRadians,
      deltaRadians,
      pocketCount: STAR_POCKET_COUNT,
      pocketPitchRadians,
      pitchLength: Math.max(0.01, Math.abs(deltaRadians) / pocketPitchRadians),
      routeDirectionSign: sign
    };
  }

  function lineSegment(id, owner, start, end, pitchLength) {
    return {
      id,
      owner,
      type: "line",
      start,
      end,
      pitchLength: Math.max(0.01, number(pitchLength, 1)),
      routeRotationY: routeRotationY(subtract(end, start))
    };
  }

  function withDistances(segments) {
    let cursor = 0;
    return segments.map((segment) => {
      const startPitch = cursor;
      cursor += Math.max(0.01, number(segment.pitchLength, 0.01));
      return { ...segment, startPitch, endPitch: cursor };
    });
  }

  function pointFromArc(segment, atEnd) {
    const angle = segment.startRadians + (atEnd ? segment.deltaRadians : 0);
    return {
      x: number(segment.center?.x) + Math.cos(angle) * number(segment.radius),
      z: number(segment.center?.z) + Math.sin(angle) * number(segment.radius)
    };
  }

  function contactPhase(angleDegrees, headPitchDegrees) {
    return fraction(number(angleDegrees) / Math.max(0.000001, number(headPitchDegrees, 1)));
  }

  function pocketReferenceForContact(wheel, contactPoint, transferPhasePitch) {
    const contactPolar = polarAngle(subtract(contactPoint, wheel.center));
    const directionSign = number(wheel.routeDirectionSign, 1) >= 0 ? 1 : -1;
    const pocketPitchRadians = Math.PI * 2 / STAR_POCKET_COUNT;
    return contactPolar - directionSign * transferPhasePitch * pocketPitchRadians;
  }

  function measuredStarCenters(source, pitchRadiusWorld, centerDistanceWorld) {
    const zeroDirection = unit(machineOrbit(0, source.carouselRadius, source));
    const positiveSideDirection = tangentAt(0, source.carouselRadius, source);
    const entryContact = machineOrbit(ENTRY_TRANSFER_ANGLE_DEGREES, source.carouselRadius, source);
    const dischargeContact = machineOrbit(DISCHARGE_TRANSFER_ANGLE_DEGREES, source.carouselRadius, source);

    const entryZero = entryContact.x * zeroDirection.x + entryContact.z * zeroDirection.z;
    const entrySide = entryContact.x * positiveSideDirection.x + entryContact.z * positiveSideDirection.z;
    const halfCenterDistance = centerDistanceWorld / 2;
    const sideDelta = halfCenterDistance - entrySide;
    const radialSquared = Math.max(0, pitchRadiusWorld * pitchRadiusWorld - sideDelta * sideDelta);
    const outwardZero = entryZero + Math.sqrt(radialSquared);

    const intermediateCenter = add(
      scale(zeroDirection, outwardZero),
      scale(positiveSideDirection, halfCenterDistance)
    );
    const dischargeCenter = add(
      scale(zeroDirection, outwardZero),
      scale(positiveSideDirection, -halfCenterDistance)
    );

    return {
      zeroDirection,
      positiveSideDirection,
      entryContact,
      dischargeContact,
      intermediateCenter,
      dischargeCenter
    };
  }

  function buildLayout(geometry, options = {}) {
    const source = base.buildLayout(geometry, {
      ...options,
      entryAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
      exitAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES
    });
    const unitsPerMm = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
    const outerRadiusWorld = STAR_OUTER_RADIUS_MM * unitsPerMm;
    const centerDistanceWorld = INTERMEDIATE_DISCHARGE_CENTER_DISTANCE_MM * unitsPerMm;
    const pitchRadiusWorld = number(source.wheels?.intermediate?.pitchRadiusWorld);
    const pitchRadiusMm = pitchRadiusWorld / unitsPerMm;
    const pocketPitchRadians = Math.PI * 2 / STAR_POCKET_COUNT;

    const centers = measuredStarCenters(source, pitchRadiusWorld, centerDistanceWorld);
    const intermediateCenter = centers.intermediateCenter;
    const dischargeCenter = centers.dischargeCenter;
    const entryContact = centers.entryContact;
    const dischargeContact = centers.dischargeContact;

    const sourceInfeed = source.wheels?.infeed;
    const sourceIntermediate = source.wheels?.intermediate;
    const infeedAxis = unit(subtract(sourceInfeed?.center, sourceIntermediate?.center));
    const infeedCenter = add(intermediateCenter, scale(infeedAxis, pitchRadiusWorld * 2));
    const infeedIntermediateContact = add(intermediateCenter, scale(infeedAxis, pitchRadiusWorld));

    const sourceInfeedArc = source.segments.find((segment) => segment.owner === "infeed-star");
    const sourceDischargeArc = source.segments.find((segment) => segment.owner === "discharge-star");
    const sourceInfeedLine = source.segments.find((segment) => segment.owner === "infeed-conveyor");
    const sourceOutfeedLine = source.segments.find((segment) => segment.owner === "outfeed-conveyor");
    const sourceCarousel = source.segments.find((segment) => segment.owner === "carousel");

    const oldInfeedStart = sourceInfeedArc ? pointFromArc(sourceInfeedArc, false) : add(sourceInfeed.center, scale(centers.zeroDirection, pitchRadiusWorld));
    const infeedStartOffset = subtract(oldInfeedStart, sourceInfeed.center);
    const infeedStart = add(infeedCenter, infeedStartOffset);
    const infeedLineOffset = sourceInfeedLine ? subtract(sourceInfeedLine.start, sourceInfeedLine.end) : scale(centers.positiveSideDirection, -source.centerSpacingWorld * 4);
    const infeedConveyorStart = add(infeedStart, infeedLineOffset);

    const oldDischargeEnd = sourceDischargeArc ? pointFromArc(sourceDischargeArc, true) : add(source.discharge.center, scale(centers.zeroDirection, pitchRadiusWorld));
    const dischargeEndOffset = subtract(oldDischargeEnd, source.wheels.discharge.center);
    const dischargeEnd = add(dischargeCenter, dischargeEndOffset);
    const outfeedLineOffset = sourceOutfeedLine ? subtract(sourceOutfeedLine.end, sourceOutfeedLine.start) : scale(centers.positiveSideDirection, source.centerSpacingWorld * 4);
    const outfeedEnd = add(dischargeEnd, outfeedLineOffset);

    const infeedArc = arcSegment(
      "infeed-star",
      "infeed-star",
      infeedCenter,
      pitchRadiusWorld,
      infeedStart,
      infeedIntermediateContact,
      sourceInfeedArc?.routeDirectionSign
    );
    const intermediateArc = arcSegment(
      "intermediate-star",
      "intermediate-star",
      intermediateCenter,
      pitchRadiusWorld,
      infeedIntermediateContact,
      entryContact,
      source.segments.find((segment) => segment.owner === "intermediate-star")?.routeDirectionSign
    );
    const dischargeArc = arcSegment(
      "discharge-star",
      "discharge-star",
      dischargeCenter,
      pitchRadiusWorld,
      dischargeContact,
      dischargeEnd,
      sourceDischargeArc?.routeDirectionSign
    );

    const rawSegments = [
      lineSegment("infeed-conveyor", "infeed-conveyor", infeedConveyorStart, infeedStart, sourceInfeedLine?.pitchLength || 4),
      infeedArc,
      intermediateArc,
      {
        ...sourceCarousel,
        startAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
        endAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES,
        spanDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES - ENTRY_TRANSFER_ANGLE_DEGREES,
        pitchLength: (DISCHARGE_TRANSFER_ANGLE_DEGREES - ENTRY_TRANSFER_ANGLE_DEGREES) / source.headPitchDegrees
      },
      dischargeArc,
      lineSegment("outfeed-conveyor", "outfeed-conveyor", dischargeEnd, outfeedEnd, sourceOutfeedLine?.pitchLength || 4)
    ];
    const segments = withDistances(rawSegments);

    const entryPhasePitch = contactPhase(ENTRY_TRANSFER_ANGLE_DEGREES, source.headPitchDegrees);
    const dischargePhasePitch = contactPhase(DISCHARGE_TRANSFER_ANGLE_DEGREES, source.headPitchDegrees);

    const provisionalWheels = {
      infeed: {
        ...source.wheels.infeed,
        center: infeedCenter,
        pitchRadiusWorld,
        pitchRadiusMm,
        outerRadiusWorld,
        outerRadiusMm: STAR_OUTER_RADIUS_MM,
        outerDiameterMm: STAR_OUTER_DIAMETER_MM,
        pocketCount: STAR_POCKET_COUNT,
        pocketPitchRadians,
        routeDirectionSign: infeedArc.routeDirectionSign
      },
      intermediate: {
        ...source.wheels.intermediate,
        center: intermediateCenter,
        pitchRadiusWorld,
        pitchRadiusMm,
        outerRadiusWorld,
        outerRadiusMm: STAR_OUTER_RADIUS_MM,
        outerDiameterMm: STAR_OUTER_DIAMETER_MM,
        pocketCount: STAR_POCKET_COUNT,
        pocketPitchRadians,
        routeDirectionSign: intermediateArc.routeDirectionSign
      },
      discharge: {
        ...source.wheels.discharge,
        center: dischargeCenter,
        pitchRadiusWorld,
        pitchRadiusMm,
        outerRadiusWorld,
        outerRadiusMm: STAR_OUTER_RADIUS_MM,
        outerDiameterMm: STAR_OUTER_DIAMETER_MM,
        pocketCount: STAR_POCKET_COUNT,
        pocketPitchRadians,
        routeDirectionSign: dischargeArc.routeDirectionSign
      }
    };

    const wheels = freeze({
      infeed: {
        ...provisionalWheels.infeed,
        referencePocketAngleRadians: pocketReferenceForContact(provisionalWheels.infeed, infeedIntermediateContact, entryPhasePitch),
        transferPhasePitch: entryPhasePitch,
        pocketPhaseAuthority: "16-pocket-synchronized-to-intermediate-handoff"
      },
      intermediate: {
        ...provisionalWheels.intermediate,
        referencePocketAngleRadians: pocketReferenceForContact(provisionalWheels.intermediate, entryContact, entryPhasePitch),
        carouselTransferAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
        carouselTransferContact: { x: entryContact.x, z: entryContact.z },
        transferPhasePitch: entryPhasePitch,
        pocketPhaseAuthority: "16-pocket-machine-map-30-degree-handoff"
      },
      discharge: {
        ...provisionalWheels.discharge,
        referencePocketAngleRadians: pocketReferenceForContact(provisionalWheels.discharge, dischargeContact, dischargePhasePitch),
        carouselTransferAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES,
        carouselTransferContact: { x: dischargeContact.x, z: dischargeContact.z },
        transferPhasePitch: dischargePhasePitch,
        pocketPhaseAuthority: "16-pocket-machine-map-330-degree-handoff"
      }
    });

    const actualCenterDistanceWorld = magnitude(subtract(intermediateCenter, dischargeCenter));
    const clearGapWorld = actualCenterDistanceWorld - outerRadiusWorld * 2;

    return freeze({
      ...source,
      schemaVersion: "servoforge.3d-bottle-handling.v6-measured-stars",
      patchVersion: PATCH_VERSION,
      referenceSource: REFERENCE_SOURCE,
      entryAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
      exitAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES,
      segments,
      wheels,
      totalPitchLength: segments[segments.length - 1]?.endPitch || 0,
      measuredStarGeometry: {
        source: REFERENCE_SOURCE,
        pocketCount: STAR_POCKET_COUNT,
        outerDiameterMm: STAR_OUTER_DIAMETER_MM,
        outerRadiusMm: STAR_OUTER_RADIUS_MM,
        pitchRadiusMm,
        pitchDiameterMm: pitchRadiusMm * 2,
        intermediateDischargeClearGapMm: INTERMEDIATE_DISCHARGE_CLEAR_GAP_MM,
        intermediateDischargeCenterDistanceMm: INTERMEDIATE_DISCHARGE_CENTER_DISTANCE_MM,
        renderedCenterDistanceMm: actualCenterDistanceWorld / unitsPerMm,
        renderedClearGapMm: clearGapWorld / unitsPerMm,
        outerDiameterAuthority: true,
        intermediateDischargeGapAuthority: true
      },
      authority: {
        ...(source.authority || {}),
        starWheelOuterDiameter: "user-measured-600mm-end-to-end",
        intermediateDischargeSpacing: "user-measured-200mm-clear-edge-gap",
        intermediateDischargeCenterDistance: "derived-800mm-from-600mm-diameter-plus-200mm-clear-gap",
        starWheelPitchCircle: "derived-from-16-pockets-and-110mm-bottle-center-pitch",
        dimensionalAuthority: "partial-user-measured-handling-geometry"
      }
    });
  }

  function pointAtPitch(layout, pitchDistance) {
    return base.pointAtPitch(layout, pitchDistance);
  }

  function snapshot(machineAngleDegrees, geometry, options = {}) {
    const layout = buildLayout(geometry, options);
    const normalizedMachineAngle = normalizeAngle(machineAngleDegrees);
    const feedPitchAbsolute = normalizedMachineAngle / layout.headPitchDegrees;
    const feedPhasePitch = feedPitchAbsolute - Math.floor(feedPitchAbsolute);
    const bottleCount = Math.ceil(layout.totalPitchLength) + 2;
    const bottles = [];

    for (let slot = 0; slot < bottleCount; slot += 1) {
      const pitchDistance = feedPhasePitch + slot;
      if (pitchDistance > layout.totalPitchLength + 1e-9) continue;
      bottles.push(freeze({
        id: `handling-bottle-${slot}`,
        slot,
        ...pointAtPitch(layout, pitchDistance)
      }));
    }

    const wheels = Object.fromEntries(Object.entries(layout.wheels).map(([key, wheel]) => [key, freeze({
      ...wheel,
      rotationY: wheel.routeDirectionSign * feedPhasePitch * wheel.pocketPitchRadians
    })]));

    return freeze({
      schemaVersion: layout.schemaVersion,
      patchVersion: PATCH_VERSION,
      referenceSource: REFERENCE_SOURCE,
      machineAngleDegrees: normalizedMachineAngle,
      feedPhasePitch,
      centerSpacingMm: layout.centerSpacingMm,
      bottleCount: bottles.length,
      ownershipSequence: [
        "infeed-conveyor",
        "infeed-star",
        "intermediate-star",
        "carousel",
        "discharge-star",
        "outfeed-conveyor"
      ],
      layout,
      wheels,
      bottles,
      measuredStarGeometry: layout.measuredStarGeometry,
      noSingleBottleZeroReset: true,
      bottleIdentityModel: "continuous-pitch-population",
      carouselServoAuthority: "ServoForge replay frame at each occupied bottle-table angle",
      readOnly: true
    });
  }

  global.Labeler3DBottleHandlingAdapter = Object.freeze({
    ...base,
    PATCH_VERSION,
    REFERENCE_SOURCE,
    STAR_OUTER_DIAMETER_MM,
    STAR_OUTER_RADIUS_MM,
    INTERMEDIATE_DISCHARGE_CLEAR_GAP_MM,
    INTERMEDIATE_DISCHARGE_CENTER_DISTANCE_MM,
    measuredStarGeometryV1: true,
    buildLayout,
    pointAtPitch,
    snapshot
  });
})(window);
