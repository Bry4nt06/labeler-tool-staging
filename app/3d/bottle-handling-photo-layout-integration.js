(function installServoForge3DBottleHandlingPhotoLayout(global) {
  "use strict";

  const base = global.Labeler3DBottleHandlingAdapter;
  const sceneAdapter = global.Labeler3DSceneAdapter;
  if (!base?.buildLayout || !base?.pointAtPitch || !sceneAdapter?.machineOrbit) return;

  const PATCH_VERSION = "servoforge.3d-bottle-handling-photo-layout.v1";
  const PHOTO_SOURCE = "user-machine-photo-with-marked-zero-datum-2026-08-18";
  const INFEED_RADIAL_COMPONENT = 0.92;
  const INFEED_POSITIVE_SIDE_COMPONENT = 0.38;
  const CONVEYOR_PITCHES = 4;

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

  function routeRotationY(direction) {
    const tangent = unit(direction);
    return Math.atan2(-tangent.z, tangent.x);
  }

  function vectorAngle(vector) {
    return Math.atan2(number(vector?.z), number(vector?.x));
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
    const startRadians = vectorAngle(subtract(startPoint, center));
    const endRadians = vectorAngle(subtract(endPoint, center));
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
      const score = dot(tangent, unit(desiredStartTangent));
      const travelPenalty = Math.abs(delta) > Math.PI * 1.25 ? 0.12 : 0;
      const adjusted = score - travelPenalty;
      if (adjusted > bestScore) {
        bestScore = adjusted;
        best = delta;
      }
    });
    return best;
  }

  function machineOrbit(angle, radius, options) {
    return sceneAdapter.machineOrbit(angle, {
      carouselRadius: radius,
      carouselDirection: options.carouselDirection,
      zeroAngleDegrees: options.zeroAngleDegrees
    });
  }

  function tangentAt(angle, radius, options) {
    const origin = machineOrbit(angle, radius, options);
    const downstream = machineOrbit(angle + 0.1, radius, options);
    return unit(subtract(downstream, origin));
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

  function arcSegment(id, owner, center, radius, startPoint, endPoint, pocketCount, deltaRadians) {
    const startRadians = vectorAngle(subtract(startPoint, center));
    const pocketPitchRadians = Math.PI * 2 / Math.max(3, Math.round(number(pocketCount, 8)));
    return {
      id,
      owner,
      type: "star-arc",
      center,
      radius,
      startRadians,
      deltaRadians,
      pocketCount,
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
      startAngleDegrees: source.entryAngleDegrees,
      endAngleDegrees: source.exitAngleDegrees,
      spanDegrees: source.exitAngleDegrees - source.entryAngleDegrees,
      pitchLength: (source.exitAngleDegrees - source.entryAngleDegrees) / source.headPitchDegrees
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

  function buildLayout(geometry, options = {}) {
    const source = base.buildLayout(geometry, options);
    const orbitOptions = {
      carouselDirection: source.carouselDirection,
      zeroAngleDegrees: source.zeroAngleDegrees
    };
    const centerSpacingWorld = source.centerSpacingWorld;
    const zeroPoint = machineOrbit(0, source.carouselRadius, orbitOptions);
    const zeroDirection = unit(zeroPoint);
    const positiveSideDirection = tangentAt(0, source.carouselRadius, orbitOptions);

    const entryContact = machineOrbit(source.entryAngleDegrees, source.carouselRadius, orbitOptions);
    const exitContact = machineOrbit(source.exitAngleDegrees, source.carouselRadius, orbitOptions);
    const entryRadial = unit(entryContact);
    const exitRadial = unit(exitContact);
    const entryTangent = tangentAt(source.entryAngleDegrees, source.carouselRadius, orbitOptions);
    const exitTangent = tangentAt(source.exitAngleDegrees, source.carouselRadius, orbitOptions);

    const infeedRadius = number(source.wheels?.infeed?.pitchRadiusWorld);
    const intermediateRadius = number(source.wheels?.intermediate?.pitchRadiusWorld);
    const dischargeRadius = number(source.wheels?.discharge?.pitchRadiusWorld);
    const infeedPockets = Math.max(3, Math.round(number(source.wheels?.infeed?.pocketCount, 10)));
    const intermediatePockets = Math.max(3, Math.round(number(source.wheels?.intermediate?.pocketCount, 10)));
    const dischargePockets = Math.max(3, Math.round(number(source.wheels?.discharge?.pocketCount, 8)));

    // Machine photo authority:
    // - intermediate star sits immediately outside the carousel on +angle side
    // - infeed star is farther outward and slightly farther +angle side
    // - discharge star sits immediately outside the carousel on -angle side
    const intermediateCenter = add(entryContact, scale(entryRadial, intermediateRadius));
    const infeedSeparationDirection = unit(add(
      scale(zeroDirection, INFEED_RADIAL_COMPONENT),
      scale(positiveSideDirection, INFEED_POSITIVE_SIDE_COMPONENT)
    ));
    const infeedCenter = add(
      intermediateCenter,
      scale(infeedSeparationDirection, infeedRadius + intermediateRadius)
    );
    const dischargeCenter = add(exitContact, scale(exitRadial, dischargeRadius));

    const infeedIntermediateDirection = unit(subtract(intermediateCenter, infeedCenter));
    const infeedIntermediateContact = add(infeedCenter, scale(infeedIntermediateDirection, infeedRadius));

    // The white timing/feed screw in the supplied photo is approximately tangent
    // to the lower side of the infeed star and nearly perpendicular to the 0° line.
    const infeedStart = add(infeedCenter, scale(zeroDirection, infeedRadius));
    const infeedConveyorDirection = positiveSideDirection;
    const infeedConveyorStart = add(
      infeedStart,
      scale(infeedConveyorDirection, -CONVEYOR_PITCHES * centerSpacingWorld)
    );

    const infeedDelta = chooseArcDelta(
      infeedCenter,
      infeedStart,
      infeedIntermediateContact,
      infeedConveyorDirection
    );
    const infeedEndAngle = vectorAngle(subtract(infeedIntermediateContact, infeedCenter));
    const infeedEndTangent = tangentForAngle(infeedEndAngle, infeedDelta >= 0 ? 1 : -1);
    const intermediateDelta = chooseArcDelta(
      intermediateCenter,
      infeedIntermediateContact,
      entryContact,
      infeedEndTangent
    );

    // Discharge leaves the carousel on the negative-angle side and continues
    // through the discharge star without crossing back through the 0° cluster.
    const dischargeEnd = add(dischargeCenter, scale(zeroDirection, dischargeRadius));
    const dischargeDelta = chooseArcDelta(
      dischargeCenter,
      exitContact,
      dischargeEnd,
      exitTangent
    );
    const dischargeEndAngle = vectorAngle(subtract(dischargeEnd, dischargeCenter));
    const dischargeEndTangent = tangentForAngle(dischargeEndAngle, dischargeDelta >= 0 ? 1 : -1);
    const outfeedEnd = add(
      dischargeEnd,
      scale(dischargeEndTangent, CONVEYOR_PITCHES * centerSpacingWorld)
    );

    const rawSegments = [
      lineSegment("infeed-conveyor", "infeed-conveyor", infeedConveyorStart, infeedStart, CONVEYOR_PITCHES),
      arcSegment("infeed-star", "infeed-star", infeedCenter, infeedRadius, infeedStart, infeedIntermediateContact, infeedPockets, infeedDelta),
      arcSegment("intermediate-star", "intermediate-star", intermediateCenter, intermediateRadius, infeedIntermediateContact, entryContact, intermediatePockets, intermediateDelta),
      carouselSegment(source),
      arcSegment("discharge-star", "discharge-star", dischargeCenter, dischargeRadius, exitContact, dischargeEnd, dischargePockets, dischargeDelta),
      lineSegment("outfeed-conveyor", "outfeed-conveyor", dischargeEnd, outfeedEnd, CONVEYOR_PITCHES)
    ];
    const segments = withDistances(rawSegments);

    const wheels = freeze({
      infeed: {
        ...source.wheels.infeed,
        center: infeedCenter,
        routeDirectionSign: rawSegments[1].routeDirectionSign,
        photoRole: "lower-right-outboard"
      },
      intermediate: {
        ...source.wheels.intermediate,
        center: intermediateCenter,
        routeDirectionSign: rawSegments[2].routeDirectionSign,
        photoRole: "upper-right-carousel-transfer"
      },
      discharge: {
        ...source.wheels.discharge,
        center: dischargeCenter,
        routeDirectionSign: rawSegments[4].routeDirectionSign,
        photoRole: "left-carousel-discharge"
      }
    });

    const farthest = Math.max(
      source.carouselRadius,
      magnitude(infeedCenter) + infeedRadius,
      magnitude(intermediateCenter) + intermediateRadius,
      magnitude(dischargeCenter) + dischargeRadius
    );
    const zeroDatum = freeze({
      ...(source.zeroDatum || {}),
      machineAngleDegrees: 0,
      source: PHOTO_SOURCE,
      angularAuthority: true,
      radialDirection: zeroDirection,
      line: {
        start: { x: 0, z: 0 },
        end: scale(zeroDirection, farthest)
      }
    });

    return freeze({
      ...source,
      schemaVersion: "servoforge.3d-bottle-handling.v3-photo-layout",
      patchVersion: PATCH_VERSION,
      referenceSource: PHOTO_SOURCE,
      segments,
      wheels,
      totalPitchLength: segments[segments.length - 1]?.endPitch || 0,
      zeroDatum,
      photoCalibration: {
        zeroDatum: "marked-red-line",
        infeedPosition: "lower-right-outboard",
        intermediatePosition: "upper-right-near-carousel",
        dischargePosition: "left-near-carousel",
        infeedIntermediateAxis: "mostly-radial-with-small-positive-angle-offset",
        timingScrewAxis: "approximately-tangent-to-infeed-star-and-perpendicular-to-zero-datum"
      },
      authority: {
        ...(source.authority || {}),
        visualLayout: PHOTO_SOURCE,
        starWheelCenters: "user-machine-photo-calibrated-provisional",
        timingScrewAxis: "user-machine-photo-observed",
        dimensionalAuthority: false
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
      noSingleBottleZeroReset: true,
      bottleIdentityModel: "continuous-pitch-population",
      carouselServoAuthority: "ServoForge replay frame at each occupied bottle-table angle",
      photoLayoutCalibrated: true,
      readOnly: true
    });
  }

  global.Labeler3DBottleHandlingAdapter = Object.freeze({
    ...base,
    PATCH_VERSION,
    PHOTO_SOURCE,
    photoLayoutCalibrated: true,
    buildLayout,
    pointAtPitch,
    snapshot
  });
})(window);
