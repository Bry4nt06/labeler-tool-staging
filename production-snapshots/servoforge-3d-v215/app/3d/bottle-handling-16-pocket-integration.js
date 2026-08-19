(function installServoForge3DBottleHandling16PocketSet(global) {
  "use strict";

  const base = global.Labeler3DBottleHandlingAdapter;
  const sceneAdapter = global.Labeler3DSceneAdapter;
  if (!base?.buildLayout || !base?.pointAtPitch || !sceneAdapter?.machineOrbit) return;

  const PATCH_VERSION = "servoforge.3d-bottle-handling-16-pocket.v1";
  const REFERENCE_SOURCE = "user-confirmed-16-pocket-handling-stars-2026-08-18";
  const STAR_POCKET_COUNT = 16;
  const ENTRY_TRANSFER_ANGLE_DEGREES = 30;
  const DISCHARGE_TRANSFER_ANGLE_DEGREES = 330;
  const CONVEYOR_PITCHES = 4;
  const INFEED_RADIAL_COMPONENT = 0.92;
  const INFEED_POSITIVE_SIDE_COMPONENT = 0.38;

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

  function dot(a, b) {
    return number(a?.x) * number(b?.x) + number(a?.z) * number(b?.z);
  }

  function fraction(value) {
    const numeric = number(value, 0);
    return numeric - Math.floor(numeric);
  }

  function polarAngle(vector) {
    return Math.atan2(number(vector?.z), number(vector?.x));
  }

  function routeRotationY(direction) {
    const tangent = unit(direction);
    return Math.atan2(-tangent.z, tangent.x);
  }

  function machineOrbit(angleDegrees, radius, options) {
    return sceneAdapter.machineOrbit(angleDegrees, {
      carouselRadius: radius,
      carouselDirection: options.carouselDirection,
      zeroAngleDegrees: options.zeroAngleDegrees
    });
  }

  function tangentAt(angleDegrees, radius, options) {
    const origin = machineOrbit(angleDegrees, radius, options);
    const downstream = machineOrbit(angleDegrees + 0.1, radius, options);
    return unit(subtract(downstream, origin));
  }

  function wheelPitchRadiusWorld(centerSpacingWorld) {
    const spacing = Math.max(0.001, number(centerSpacingWorld, 0.49));
    return spacing / (2 * Math.sin(Math.PI / STAR_POCKET_COUNT));
  }

  function wheelPitchRadiusMm(centerSpacingMm) {
    const spacing = Math.max(0.001, number(centerSpacingMm, 110));
    return spacing / (2 * Math.sin(Math.PI / STAR_POCKET_COUNT));
  }

  function signedShortestAngle(fromRadians, toRadians) {
    let delta = toRadians - fromRadians;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  function tangentForAngle(angle, sign) {
    return unit({
      x: -Math.sin(angle) * sign,
      z: Math.cos(angle) * sign
    });
  }

  function chooseArcDelta(center, startPoint, endPoint, desiredStartTangent) {
    const startRadians = polarAngle(subtract(startPoint, center));
    const endRadians = polarAngle(subtract(endPoint, center));
    const shortDelta = signedShortestAngle(startRadians, endRadians);
    const candidates = [
      shortDelta,
      shortDelta >= 0 ? shortDelta - Math.PI * 2 : shortDelta + Math.PI * 2
    ];
    let best = candidates[0];
    let bestScore = -Infinity;
    candidates.forEach((delta) => {
      const sign = delta >= 0 ? 1 : -1;
      const tangent = tangentForAngle(startRadians, sign);
      const travelPenalty = Math.abs(delta) > Math.PI * 1.25 ? 0.12 : 0;
      const score = dot(tangent, unit(desiredStartTangent)) - travelPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = delta;
      }
    });
    return best;
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

  function arcSegment(id, owner, center, radius, startPoint, endPoint, deltaRadians) {
    const startRadians = polarAngle(subtract(startPoint, center));
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
      routeDirectionSign: deltaRadians >= 0 ? 1 : -1
    };
  }

  function carouselSegment(source) {
    return {
      id: "carousel",
      owner: "carousel",
      type: "carousel-arc",
      radius: source.carouselRadius,
      startAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
      endAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES,
      spanDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES - ENTRY_TRANSFER_ANGLE_DEGREES,
      pitchLength: (DISCHARGE_TRANSFER_ANGLE_DEGREES - ENTRY_TRANSFER_ANGLE_DEGREES) / source.headPitchDegrees
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

  function contactPhase(angleDegrees, headPitchDegrees) {
    return fraction(number(angleDegrees) / Math.max(0.000001, number(headPitchDegrees, 1)));
  }

  function pocketReferenceForContact(wheel, contactPoint, transferPhasePitch) {
    const contactPolar = polarAngle(subtract(contactPoint, wheel.center));
    const directionSign = number(wheel.routeDirectionSign, 1) >= 0 ? 1 : -1;
    const pocketPitchRadians = Math.PI * 2 / STAR_POCKET_COUNT;
    return contactPolar - directionSign * transferPhasePitch * pocketPitchRadians;
  }

  function buildLayout(geometry, options = {}) {
    const source = base.buildLayout(geometry, {
      ...options,
      entryAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
      exitAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES
    });
    const orbitOptions = {
      carouselDirection: source.carouselDirection,
      zeroAngleDegrees: source.zeroAngleDegrees
    };
    const radius = wheelPitchRadiusWorld(source.centerSpacingWorld);
    const radiusMm = wheelPitchRadiusMm(source.centerSpacingMm);
    const pitchDiameterMm = radiusMm * 2;
    const pocketPitchRadians = Math.PI * 2 / STAR_POCKET_COUNT;

    const zeroPoint = machineOrbit(0, source.carouselRadius, orbitOptions);
    const zeroDirection = unit(zeroPoint);
    const positiveSideDirection = tangentAt(0, source.carouselRadius, orbitOptions);

    const entryContact = machineOrbit(ENTRY_TRANSFER_ANGLE_DEGREES, source.carouselRadius, orbitOptions);
    const dischargeContact = machineOrbit(DISCHARGE_TRANSFER_ANGLE_DEGREES, source.carouselRadius, orbitOptions);
    const entryRadial = unit(entryContact);
    const dischargeRadial = unit(dischargeContact);
    const entryTangent = tangentAt(ENTRY_TRANSFER_ANGLE_DEGREES, source.carouselRadius, orbitOptions);
    const dischargeTangent = tangentAt(DISCHARGE_TRANSFER_ANGLE_DEGREES, source.carouselRadius, orbitOptions);

    const intermediateCenter = add(entryContact, scale(entryRadial, radius));
    const infeedSeparationDirection = unit(add(
      scale(zeroDirection, INFEED_RADIAL_COMPONENT),
      scale(positiveSideDirection, INFEED_POSITIVE_SIDE_COMPONENT)
    ));
    const infeedCenter = add(intermediateCenter, scale(infeedSeparationDirection, radius * 2));
    const dischargeCenter = add(dischargeContact, scale(dischargeRadial, radius));

    const infeedIntermediateDirection = unit(subtract(intermediateCenter, infeedCenter));
    const infeedIntermediateContact = add(infeedCenter, scale(infeedIntermediateDirection, radius));
    const infeedStart = add(infeedCenter, scale(zeroDirection, radius));
    const infeedConveyorStart = add(
      infeedStart,
      scale(positiveSideDirection, -CONVEYOR_PITCHES * source.centerSpacingWorld)
    );

    const infeedDelta = chooseArcDelta(
      infeedCenter,
      infeedStart,
      infeedIntermediateContact,
      positiveSideDirection
    );
    const infeedEndAngle = polarAngle(subtract(infeedIntermediateContact, infeedCenter));
    const infeedEndTangent = tangentForAngle(infeedEndAngle, infeedDelta >= 0 ? 1 : -1);
    const intermediateDelta = chooseArcDelta(
      intermediateCenter,
      infeedIntermediateContact,
      entryContact,
      infeedEndTangent
    );

    const dischargeEnd = add(dischargeCenter, scale(zeroDirection, radius));
    const dischargeDelta = chooseArcDelta(
      dischargeCenter,
      dischargeContact,
      dischargeEnd,
      dischargeTangent
    );
    const dischargeEndAngle = polarAngle(subtract(dischargeEnd, dischargeCenter));
    const dischargeEndTangent = tangentForAngle(dischargeEndAngle, dischargeDelta >= 0 ? 1 : -1);
    const outfeedEnd = add(
      dischargeEnd,
      scale(dischargeEndTangent, CONVEYOR_PITCHES * source.centerSpacingWorld)
    );

    const rawSegments = [
      lineSegment("infeed-conveyor", "infeed-conveyor", infeedConveyorStart, infeedStart, CONVEYOR_PITCHES),
      arcSegment("infeed-star", "infeed-star", infeedCenter, radius, infeedStart, infeedIntermediateContact, infeedDelta),
      arcSegment("intermediate-star", "intermediate-star", intermediateCenter, radius, infeedIntermediateContact, entryContact, intermediateDelta),
      carouselSegment(source),
      arcSegment("discharge-star", "discharge-star", dischargeCenter, radius, dischargeContact, dischargeEnd, dischargeDelta),
      lineSegment("outfeed-conveyor", "outfeed-conveyor", dischargeEnd, outfeedEnd, CONVEYOR_PITCHES)
    ];
    const segments = withDistances(rawSegments);

    const entryPhasePitch = contactPhase(ENTRY_TRANSFER_ANGLE_DEGREES, source.headPitchDegrees);
    const dischargePhasePitch = contactPhase(DISCHARGE_TRANSFER_ANGLE_DEGREES, source.headPitchDegrees);

    const provisionalWheels = {
      infeed: {
        id: "infeed-star",
        label: "Infeed Star",
        center: infeedCenter,
        pitchRadiusWorld: radius,
        pitchRadiusMm: radiusMm,
        pitchDiameterMm,
        pocketCount: STAR_POCKET_COUNT,
        pocketPitchRadians,
        routeDirectionSign: rawSegments[1].routeDirectionSign
      },
      intermediate: {
        id: "intermediate-star",
        label: "Intermediate Star",
        center: intermediateCenter,
        pitchRadiusWorld: radius,
        pitchRadiusMm: radiusMm,
        pitchDiameterMm,
        pocketCount: STAR_POCKET_COUNT,
        pocketPitchRadians,
        routeDirectionSign: rawSegments[2].routeDirectionSign
      },
      discharge: {
        id: "discharge-star",
        label: "Discharge Star",
        center: dischargeCenter,
        pitchRadiusWorld: radius,
        pitchRadiusMm: radiusMm,
        pitchDiameterMm,
        pocketCount: STAR_POCKET_COUNT,
        pocketPitchRadians,
        routeDirectionSign: rawSegments[4].routeDirectionSign
      }
    };

    const infeedReference = pocketReferenceForContact(
      provisionalWheels.infeed,
      infeedIntermediateContact,
      entryPhasePitch
    );
    const intermediateReference = pocketReferenceForContact(
      provisionalWheels.intermediate,
      entryContact,
      entryPhasePitch
    );
    const dischargeReference = pocketReferenceForContact(
      provisionalWheels.discharge,
      dischargeContact,
      dischargePhasePitch
    );

    const wheels = freeze({
      infeed: {
        ...provisionalWheels.infeed,
        referencePocketAngleRadians: infeedReference,
        transferPhasePitch: entryPhasePitch,
        pocketPhaseAuthority: "16-pocket-synchronized-to-intermediate-handoff"
      },
      intermediate: {
        ...provisionalWheels.intermediate,
        referencePocketAngleRadians: intermediateReference,
        carouselTransferAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
        carouselTransferContact: { x: entryContact.x, z: entryContact.z },
        transferPhasePitch: entryPhasePitch,
        pocketPhaseAuthority: "16-pocket-machine-map-30-degree-handoff"
      },
      discharge: {
        ...provisionalWheels.discharge,
        referencePocketAngleRadians: dischargeReference,
        carouselTransferAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES,
        carouselTransferContact: { x: dischargeContact.x, z: dischargeContact.z },
        transferPhasePitch: dischargePhasePitch,
        pocketPhaseAuthority: "16-pocket-machine-map-330-degree-handoff"
      }
    });

    const farthest = Math.max(
      source.carouselRadius,
      magnitude(infeedCenter) + radius,
      magnitude(intermediateCenter) + radius,
      magnitude(dischargeCenter) + radius
    );

    const zeroDatum = freeze({
      ...(source.zeroDatum || {}),
      machineAngleDegrees: 0,
      radialDirection: zeroDirection,
      line: {
        start: { x: 0, z: 0 },
        end: scale(zeroDirection, farthest)
      }
    });

    return freeze({
      ...source,
      schemaVersion: "servoforge.3d-bottle-handling.v5-16-pocket",
      patchVersion: PATCH_VERSION,
      referenceSource: REFERENCE_SOURCE,
      entryAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
      exitAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES,
      transferGapDegrees: 60,
      segments,
      wheels,
      totalPitchLength: segments[segments.length - 1]?.endPitch || 0,
      zeroDatum,
      starWheelSet: {
        pocketCount: STAR_POCKET_COUNT,
        centerSpacingMm: source.centerSpacingMm,
        pitchRadiusMm: radiusMm,
        pitchDiameterMm,
        radiusDerivation: "centerSpacing/(2*sin(pi/16))",
        allHandlingStarsSamePitchDiameter: true,
        source: REFERENCE_SOURCE
      },
      deadZoneTransferAnchors: {
        ...(source.deadZoneTransferAnchors || {}),
        entryAngleDegrees: ENTRY_TRANSFER_ANGLE_DEGREES,
        dischargeAngleDegrees: DISCHARGE_TRANSFER_ANGLE_DEGREES,
        pocketCentersPhaseLocked: true
      },
      authority: {
        ...(source.authority || {}),
        starWheelPocketCounts: "user-confirmed-16-pockets",
        starWheelPitchDiameter: "derived-from-user-confirmed-16-pockets-and-measured-110mm-center-spacing",
        transferAngles: "user-machine-map-dead-zone-boundaries-30deg-330deg",
        pocketPhase: "phase-locked-to-transfer-boundaries",
        dimensionalAuthority: "pitch-diameter-derived-from-measured-pitch-and-confirmed-pocket-count"
      }
    });
  }

  function pointAtPitch(layout, pitchDistance) {
    return base.pointAtPitch(layout, pitchDistance);
  }

  function snapshot(machineAngleDegrees, geometry, options = {}) {
    const layout = buildLayout(geometry, options);
    const normalizedMachineAngle = ((number(machineAngleDegrees) % 360) + 360) % 360;
    const feedPitchAbsolute = normalizedMachineAngle / layout.headPitchDegrees;
    const feedPhasePitch = feedPitchAbsolute - Math.floor(feedPitchAbsolute);
    const bottleCount = Math.ceil(layout.totalPitchLength) + 2;
    const bottles = [];

    for (let slot = 0; slot < bottleCount; slot += 1) {
      const pitchDistance = feedPhasePitch + slot;
      if (pitchDistance > layout.totalPitchLength + 1e-9) continue;
      const point = pointAtPitch(layout, pitchDistance);
      bottles.push(freeze({ id: `handling-bottle-${slot}`, slot, ...point }));
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
      zeroDatum: layout.zeroDatum,
      starWheelSet: layout.starWheelSet,
      deadZoneTransferAnchors: layout.deadZoneTransferAnchors,
      noSingleBottleZeroReset: true,
      bottleIdentityModel: "continuous-pitch-population",
      carouselServoAuthority: "ServoForge replay frame at each occupied bottle-table angle",
      sixteenPocketHandlingSet: true,
      readOnly: true
    });
  }

  global.Labeler3DBottleHandlingAdapter = Object.freeze({
    ...base,
    PATCH_VERSION,
    REFERENCE_SOURCE,
    STAR_POCKET_COUNT,
    ENTRY_TRANSFER_ANGLE_DEGREES,
    DISCHARGE_TRANSFER_ANGLE_DEGREES,
    wheelPitchRadiusWorld,
    wheelPitchRadiusMm,
    sixteenPocketHandlingSet: true,
    buildLayout,
    pointAtPitch,
    snapshot
  });
})(typeof window !== "undefined" ? window : globalThis);
