(function installServoForge3DBottleHandlingAdapter(global) {
  "use strict";

  const SCHEMA_VERSION = "servoforge.3d-bottle-handling.v1";
  const REFERENCE_SOURCE = "krones-topmodul-handling-parts-manual-plus-user-machine-reference";
  const INFEED_POCKETS = 10;
  const INTERMEDIATE_POCKETS = 8;
  const DISCHARGE_POCKETS = 10;
  const CONVEYOR_PITCHES = 4;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalizeAngle(value) {
    const normalized = number(value, 0) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
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

  function lerpPoint(start, end, progress) {
    const t = clamp(number(progress), 0, 1);
    return {
      x: number(start?.x) + (number(end?.x) - number(start?.x)) * t,
      z: number(start?.z) + (number(end?.z) - number(start?.z)) * t
    };
  }

  function vectorAngle(vector) {
    return Math.atan2(number(vector?.z), number(vector?.x));
  }

  function signedAngleBetween(from, to) {
    const a = unit(from);
    const b = unit(to);
    return Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z);
  }

  function routeRotationY(direction) {
    const tangent = unit(direction);
    return Math.atan2(-tangent.z, tangent.x);
  }

  function sceneAdapter() {
    const adapter = global.Labeler3DSceneAdapter;
    if (!adapter?.machineOrbit) {
      throw new Error("ServoForge bottle handling requires Labeler3DSceneAdapter.machineOrbit.");
    }
    return adapter;
  }

  function machineOrbit(angle, radius, options) {
    return sceneAdapter().machineOrbit(angle, {
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

  function radialAt(angle, radius, options) {
    return unit(machineOrbit(angle, radius, options));
  }

  function wheelPitchRadiusWorld(centerSpacingWorld, pocketCount) {
    const spacing = Math.max(0.001, number(centerSpacingWorld, 0.49));
    const count = Math.max(3, Math.round(number(pocketCount, 8)));
    return spacing / (2 * Math.sin(Math.PI / count));
  }

  function lineSegment(id, owner, start, end, pitchLength) {
    const direction = unit(subtract(end, start));
    return {
      id,
      owner,
      type: "line",
      start,
      end,
      pitchLength: Math.max(0.01, number(pitchLength, 1)),
      routeRotationY: routeRotationY(direction)
    };
  }

  function arcSegment(id, owner, center, radius, startPoint, endPoint, pocketCount, forcedDelta = null) {
    const startVector = subtract(startPoint, center);
    const endVector = subtract(endPoint, center);
    const startRadians = vectorAngle(startVector);
    const deltaRadians = Number.isFinite(Number(forcedDelta))
      ? Number(forcedDelta)
      : signedAngleBetween(startVector, endVector);
    const pocketPitchRadians = (Math.PI * 2) / Math.max(3, Math.round(number(pocketCount, 8)));
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

  function carouselSegment(id, startAngleDegrees, endAngleDegrees, radius, headPitchDegrees) {
    const spanDegrees = Math.max(headPitchDegrees, endAngleDegrees - startAngleDegrees);
    return {
      id,
      owner: "carousel",
      type: "carousel-arc",
      radius,
      startAngleDegrees,
      endAngleDegrees,
      spanDegrees,
      pitchLength: spanDegrees / headPitchDegrees
    };
  }

  function withDistances(segments) {
    let cursor = 0;
    return segments.map((segment) => {
      const startPitch = cursor;
      cursor += Math.max(0.01, number(segment.pitchLength, 0.01));
      return {
        ...segment,
        startPitch,
        endPitch: cursor
      };
    });
  }

  function buildLayout(geometry, options = {}) {
    const unitsPerMm = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 2.55 / 572.958));
    const centerSpacingMm = Math.max(1, number(geometry?.bottleTable?.centerSpacingMm, 110));
    const centerSpacingWorld = centerSpacingMm * unitsPerMm;
    const headCount = Math.max(8, Math.round(number(geometry?.machine?.headCount, 45)));
    const headPitchDegrees = 360 / headCount;
    const carouselRadius = Math.max(centerSpacingWorld * 4, number(geometry?.machine?.physicalPitchRadiusWorld, centerSpacingWorld * 7));
    const carouselDirection = String(options.carouselDirection || "ccw");
    const zeroAngleDegrees = number(options.zeroAngleDegrees, 0);
    const orbitOptions = { carouselDirection, zeroAngleDegrees };

    // Keep both transfers on the carousel head lattice so every bottle center
    // remains exactly on a real bottle-table center while the carousel owns it.
    const entryAngleDegrees = number(options.entryAngleDegrees, headPitchDegrees * 2);
    const exitAngleDegrees = number(options.exitAngleDegrees, 360 - headPitchDegrees * 4);
    if (!(exitAngleDegrees > entryAngleDegrees + headPitchDegrees)) {
      throw new Error("Bottle handling exit angle must be downstream of the entry angle.");
    }

    const infeedRadius = wheelPitchRadiusWorld(centerSpacingWorld, INFEED_POCKETS);
    const intermediateRadius = wheelPitchRadiusWorld(centerSpacingWorld, INTERMEDIATE_POCKETS);
    const dischargeRadius = wheelPitchRadiusWorld(centerSpacingWorld, DISCHARGE_POCKETS);

    const entryContact = machineOrbit(entryAngleDegrees, carouselRadius, orbitOptions);
    const entryRadial = radialAt(entryAngleDegrees, carouselRadius, orbitOptions);
    const entryTangent = tangentAt(entryAngleDegrees, carouselRadius, orbitOptions);

    const intermediateCenter = add(entryContact, scale(entryRadial, intermediateRadius));
    const infeedCenter = add(intermediateCenter, scale(entryTangent, -(infeedRadius + intermediateRadius)));
    const infeedIntermediateContact = add(intermediateCenter, scale(entryTangent, -intermediateRadius));
    const infeedStarStart = add(infeedCenter, scale(entryRadial, infeedRadius));
    const infeedConveyorStart = add(infeedStarStart, scale(entryTangent, -CONVEYOR_PITCHES * centerSpacingWorld));

    const exitContact = machineOrbit(exitAngleDegrees, carouselRadius, orbitOptions);
    const exitRadial = radialAt(exitAngleDegrees, carouselRadius, orbitOptions);
    const exitTangent = tangentAt(exitAngleDegrees, carouselRadius, orbitOptions);
    const dischargeCenter = add(exitContact, scale(exitRadial, dischargeRadius));
    const dischargeEnd = add(dischargeCenter, scale(exitRadial, dischargeRadius));
    const outfeedEnd = add(dischargeEnd, scale(exitTangent, CONVEYOR_PITCHES * centerSpacingWorld));

    const rawSegments = [
      lineSegment("infeed-conveyor", "infeed-conveyor", infeedConveyorStart, infeedStarStart, CONVEYOR_PITCHES),
      arcSegment("infeed-star", "infeed-star", infeedCenter, infeedRadius, infeedStarStart, infeedIntermediateContact, INFEED_POCKETS),
      arcSegment("intermediate-star", "intermediate-star", intermediateCenter, intermediateRadius, infeedIntermediateContact, entryContact, INTERMEDIATE_POCKETS),
      carouselSegment("carousel", entryAngleDegrees, exitAngleDegrees, carouselRadius, headPitchDegrees),
      arcSegment("discharge-star", "discharge-star", dischargeCenter, dischargeRadius, exitContact, dischargeEnd, DISCHARGE_POCKETS, Math.PI),
      lineSegment("outfeed-conveyor", "outfeed-conveyor", dischargeEnd, outfeedEnd, CONVEYOR_PITCHES)
    ];
    const segments = withDistances(rawSegments);
    const totalPitchLength = segments[segments.length - 1]?.endPitch || 0;

    const wheels = freeze({
      infeed: {
        id: "infeed-star",
        label: "Infeed Star",
        center: infeedCenter,
        pitchRadiusWorld: infeedRadius,
        pocketCount: INFEED_POCKETS,
        pocketPitchRadians: Math.PI * 2 / INFEED_POCKETS,
        routeDirectionSign: rawSegments[1].routeDirectionSign
      },
      intermediate: {
        id: "intermediate-star",
        label: "Intermediate Star",
        center: intermediateCenter,
        pitchRadiusWorld: intermediateRadius,
        pocketCount: INTERMEDIATE_POCKETS,
        pocketPitchRadians: Math.PI * 2 / INTERMEDIATE_POCKETS,
        routeDirectionSign: rawSegments[2].routeDirectionSign
      },
      discharge: {
        id: "discharge-star",
        label: "Discharge Star",
        center: dischargeCenter,
        pitchRadiusWorld: dischargeRadius,
        pocketCount: DISCHARGE_POCKETS,
        pocketPitchRadians: Math.PI * 2 / DISCHARGE_POCKETS,
        routeDirectionSign: rawSegments[4].routeDirectionSign
      }
    });

    return freeze({
      schemaVersion: SCHEMA_VERSION,
      referenceSource: REFERENCE_SOURCE,
      centerSpacingMm,
      centerSpacingWorld,
      headCount,
      headPitchDegrees,
      carouselRadius,
      carouselDirection,
      zeroAngleDegrees,
      entryAngleDegrees,
      exitAngleDegrees,
      transferGapDegrees: 360 - exitAngleDegrees + entryAngleDegrees,
      segments,
      wheels,
      totalPitchLength,
      authority: {
        topology: "krones-topmodul-handling-parts-manual",
        synchronizationPitch: "user-measured-bottle-table-center-spacing-110mm",
        starWheelPocketCounts: "provisional-visual",
        starWheelCenters: "provisional-tangent-layout",
        starWheelDiameters: "provisional-derived-from-synchronization-pitch",
        guideRails: "not-yet-modeled",
        conveyors: "provisional-functional-path",
        dimensionalAuthority: false
      },
      readOnly: true
    });
  }

  function pointOnSegment(segment, progress, layout) {
    const t = clamp(number(progress), 0, 1);
    if (segment.type === "line") {
      const position = lerpPoint(segment.start, segment.end, t);
      return {
        position,
        routeRotationY: segment.routeRotationY,
        tableAngleDegrees: null,
        wheelAngleRadians: null
      };
    }

    if (segment.type === "star-arc") {
      const angle = segment.startRadians + segment.deltaRadians * t;
      const position = {
        x: number(segment.center?.x) + Math.cos(angle) * segment.radius,
        z: number(segment.center?.z) + Math.sin(angle) * segment.radius
      };
      const tangentSign = segment.deltaRadians >= 0 ? 1 : -1;
      const tangent = { x: -Math.sin(angle) * tangentSign, z: Math.cos(angle) * tangentSign };
      return {
        position,
        routeRotationY: routeRotationY(tangent),
        tableAngleDegrees: null,
        wheelAngleRadians: angle
      };
    }

    const tableAngleDegrees = segment.startAngleDegrees + segment.spanDegrees * t;
    const orbit = machineOrbit(tableAngleDegrees, segment.radius, {
      carouselDirection: layout.carouselDirection,
      zeroAngleDegrees: layout.zeroAngleDegrees
    });
    return {
      position: { x: orbit.x, z: orbit.z },
      routeRotationY: number(orbit.threeRotationY, -number(orbit.radians)),
      tableAngleDegrees: normalizeAngle(tableAngleDegrees),
      tableAngleUnwrappedDegrees: tableAngleDegrees,
      wheelAngleRadians: null
    };
  }

  function pointAtPitch(layout, pitchDistance) {
    const distance = clamp(number(pitchDistance), 0, layout.totalPitchLength);
    const segment = layout.segments.find((entry) => distance <= entry.endPitch + 1e-9) || layout.segments[layout.segments.length - 1];
    const span = Math.max(1e-9, segment.endPitch - segment.startPitch);
    const progress = clamp((distance - segment.startPitch) / span, 0, 1);
    const point = pointOnSegment(segment, progress, layout);
    return freeze({
      segmentId: segment.id,
      owner: segment.owner,
      progress,
      pitchDistance: distance,
      ...point
    });
  }

  function snapshot(machineAngleDegrees, geometry, options = {}) {
    const layout = buildLayout(geometry, options);
    const headPitch = layout.headPitchDegrees;
    const normalizedMachineAngle = normalizeAngle(machineAngleDegrees);
    const feedPitchAbsolute = normalizedMachineAngle / headPitch;
    const feedPhasePitch = feedPitchAbsolute - Math.floor(feedPitchAbsolute);
    const bottleCount = Math.ceil(layout.totalPitchLength) + 2;
    const bottles = [];

    for (let slot = 0; slot < bottleCount; slot += 1) {
      const pitchDistance = feedPhasePitch + slot;
      if (pitchDistance > layout.totalPitchLength + 1e-9) continue;
      const point = pointAtPitch(layout, pitchDistance);
      bottles.push(freeze({
        id: `handling-bottle-${slot}`,
        slot,
        ...point
      }));
    }

    const wheels = Object.fromEntries(Object.entries(layout.wheels).map(([key, wheel]) => [key, freeze({
      ...wheel,
      rotationY: wheel.routeDirectionSign * feedPhasePitch * wheel.pocketPitchRadians
    })]));

    return freeze({
      schemaVersion: SCHEMA_VERSION,
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
      noSingleBottleZeroReset: true,
      bottleIdentityModel: "continuous-pitch-population",
      carouselServoAuthority: "ServoForge replay frame at each occupied bottle-table angle",
      readOnly: true
    });
  }

  global.Labeler3DBottleHandlingAdapter = Object.freeze({
    SCHEMA_VERSION,
    REFERENCE_SOURCE,
    INFEED_POCKETS,
    INTERMEDIATE_POCKETS,
    DISCHARGE_POCKETS,
    wheelPitchRadiusWorld,
    buildLayout,
    pointAtPitch,
    snapshot
  });
})(window);
