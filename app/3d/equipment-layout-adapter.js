(function installServoForge3DEquipmentLayoutAdapter(global) {
  "use strict";

  const SCHEMA_VERSION = "servoforge.3d-equipment.v1";

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

  function wipePadAdapter() {
    return global.Labeler3DWipePadGeometryAdapter || null;
  }

  function midpointAngle(start, end) {
    const a = number(start, 0);
    let b = number(end, a);
    while (b < a) b += 360;
    return normalizeAngle(a + (b - a) / 2);
  }

  function spanDegrees(item) {
    const kind = String(item?.kind || "");
    if (kind === "sensor") return 3;
    if (kind === "coding") return 5;
    if (kind === "gripper") return 2;
    const start = number(item?.start, number(item?.angle, 0));
    const end = number(item?.end, start);
    return Math.max(0.5, Math.abs(end - start));
  }

  function placementAngle(item) {
    if (Number.isFinite(Number(item?.angle))) return normalizeAngle(item.angle);
    return midpointAngle(item?.start, item?.end);
  }

  function depthForObject(item, depths = {}) {
    const kind = String(item?.kind || "");
    const side = item?.side === "inner" ? "inner" : "outer";
    if (kind === "sensor") return number(depths.sensor, number(depths.opRoller, 14) + 7);
    if (kind === "coding") return number(depths.coding, number(depths.opRoller, 14));
    if (kind === "gripper") return number(depths.gripper, number(depths.spender, 12));
    if (kind === "roller") return side === "inner"
      ? number(depths.nonOpRoller, -18)
      : number(depths.opRoller, 14);
    if (kind === "pad" || kind === "brush" || kind === "brush-channel") return side === "inner"
      ? number(depths.wipeInner, -4)
      : number(depths.wipeOuter, 16);
    return number(depths.spender, 12);
  }

  function enabledSlots(value, fallbackCount = 1) {
    const source = Array.isArray(value) ? value : [];
    const count = clamp(Math.round(number(fallbackCount, 1)), 1, 6);
    return Array.from({ length: 6 }, (_, index) => source[index] === undefined ? index < count : Boolean(source[index]));
  }

  function machineOrbit(angle, radius, options) {
    const adapter = global.Labeler3DSceneAdapter;
    if (!adapter?.machineOrbit) throw new Error("ServoForge 3D equipment layout requires Labeler3DSceneAdapter.machineOrbit.");
    return adapter.machineOrbit(angle, {
      carouselRadius: radius,
      carouselDirection: options.carouselDirection,
      zeroAngleDegrees: options.zeroAngleDegrees
    });
  }

  function snapshot(machineMap, stateLike, geometry, options = {}) {
    const map = machineMap && typeof machineMap === "object" ? machineMap : {};
    const state = stateLike && typeof stateLike === "object" ? stateLike : {};
    const physicalRadiusWorld = Math.max(0.001, number(geometry?.machine?.physicalPitchRadiusWorld, geometry?.machine?.pitchRadiusWorld));
    const worldUnitsPerMm = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.00445));
    const mapRadius = Math.max(1, number(map?.machineSettings?.radius, number(state.radius, 250)));
    const depths = map?.depths && typeof map.depths === "object" ? map.depths : (state.depths || {});
    const carouselDirection = String(options.carouselDirection || map?.machineSettings?.direction || state.direction || "ccw");
    const zeroAngleDegrees = number(options.zeroAngleDegrees, number(map?.machineSettings?.zeroAngle, state.zeroAngle));
    const scaleFromMapRadius = physicalRadiusWorld / mapRadius;
    const objects = Array.isArray(map?.objects) ? map.objects : [];

    const equipment = objects.map((item, index) => {
      const angle = placementAngle(item);
      const depthMapUnits = depthForObject(item, depths);
      const kind = String(item?.kind || "unknown");
      const wipePad = kind === "pad" && wipePadAdapter()?.snapshot
        ? wipePadAdapter().snapshot({ ...item, spanDegrees: spanDegrees(item) }, geometry)
        : null;
      const fallbackRadialWorld = Math.max(0.1, physicalRadiusWorld + depthMapUnits * scaleFromMapRadius);
      const radialWorld = Number.isFinite(Number(wipePad?.assemblyCenterRadiusWorld))
        ? Number(wipePad.assemblyCenterRadiusWorld)
        : fallbackRadialWorld;
      const orbit = machineOrbit(angle, radialWorld, { carouselDirection, zeroAngleDegrees });
      const span = spanDegrees(item);
      const tangentLengthWorld = Number.isFinite(Number(wipePad?.contactFaceArcLengthWorld))
        ? Number(wipePad.contactFaceArcLengthWorld)
        : Math.max(0.08, radialWorld * (span * Math.PI / 180));
      const extensionMapUnits = Math.max(4, number(item?.extension, 20));
      const extensionWorld = extensionMapUnits * scaleFromMapRadius;
      const section = String(item?.labelSection || map?.stationSections?.[String(item?.station)] || "auto");
      return freeze({
        id: String(item?.id || `equipment-${index + 1}`),
        name: String(item?.name || `${kind} ${index + 1}`),
        kind,
        application: String(item?.application || map?.applicationMode || state.applicationMode || "apl"),
        station: Number.isFinite(Number(item?.station)) ? Number(item.station) : null,
        section,
        side: item?.side === "inner" ? "inner" : "outer",
        role: String(item?.role || "process"),
        angleDegrees: angle,
        startDegrees: normalizeAngle(number(item?.start, angle)),
        endDegrees: normalizeAngle(number(item?.end, angle)),
        spanDegrees: span,
        mapDepthUnits: depthMapUnits,
        radialWorld,
        radialMmEquivalent: radialWorld / worldUnitsPerMm,
        tangentLengthWorld,
        extensionWorld,
        position: { x: orbit.x, y: 0, z: orbit.z },
        rotationY: orbit.radians + Math.PI / 2,
        aimRotationY: orbit.radians + Math.PI,
        sensorAimOffsetDegrees: kind === "sensor" ? number(item?.sensorAimOffsetDeg, 0) : 0,
        sensorFieldOfViewDegrees: kind === "sensor" ? clamp(number(item?.sensorFieldOfViewDeg, 18), 4, 60) : null,
        servoAssist: kind === "sensor" ? Boolean(item?.servoAssist) : false,
        orientationTarget: kind === "coding" ? String(item?.orientationTarget || "") : "",
        wipePad,
        placementAuthority: wipePad
          ? "machine-map-angle-plus-user-measured-wipe-contact-geometry"
          : "machine-map-angle-plus-derived-radial-depth",
        radialCadAuthority: Boolean(wipePad?.contactAuthority)
      });
    });

    const aggregateCount = clamp(Math.round(number(map?.aggregateCount, 6)), 1, 6);
    const aggregateEnabled = enabledSlots(map?.enabledAggregates, aggregateCount);
    const stationEnabled = enabledSlots(map?.enabledStations, number(map?.stationCount, aggregateCount));
    const aggregates = [];
    for (let aggregate = 1; aggregate <= 6; aggregate += 1) {
      if (!aggregateEnabled[aggregate - 1]) continue;
      const angle = normalizeAngle(number(
        map?.aggregateAngles?.[String(aggregate)],
        map?.stationAngles?.[String(aggregate)]
      ));
      const radialWorld = physicalRadiusWorld + number(depths.spender, 12) * scaleFromMapRadius + 0.32;
      const orbit = machineOrbit(angle, radialWorld, { carouselDirection, zeroAngleDegrees });
      aggregates.push(freeze({
        aggregate,
        station: aggregate,
        stationEnabled: Boolean(stationEnabled[aggregate - 1]),
        angleDegrees: angle,
        section: String(map?.stationSections?.[String(aggregate)] || "auto"),
        position: { x: orbit.x, y: 0, z: orbit.z },
        rotationY: orbit.radians + Math.PI / 2,
        placementAuthority: "machine-map-aggregate-centerline",
        radialCadAuthority: false
      }));
    }

    const measuredPads = equipment.filter((item) => item.kind === "pad" && item.wipePad?.dimensionalAuthority === "user-measured");
    return freeze({
      schemaVersion: SCHEMA_VERSION,
      mapId: String(map?.id || state.activeMapId || ""),
      mapName: String(map?.name || "Active machine map"),
      applicationMode: String(map?.applicationMode || state.applicationMode || "apl"),
      machineType: String(map?.machineType || "TopModul"),
      physicalPitchRadiusWorld: physicalRadiusWorld,
      mapRadius,
      mapToWorldScale: scaleFromMapRadius,
      angularAuthority: "active-machine-map",
      radialAuthority: measuredPads.length
        ? "measured-wipe-contact-plus-map-derived-other-equipment"
        : "derived-from-map-depth-ratio-not-cad",
      wipePadAuthority: measuredPads.length ? "user-measured" : "none",
      aggregates,
      objects: equipment,
      counts: {
        aggregates: aggregates.length,
        pads: equipment.filter((item) => item.kind === "pad").length,
        measuredPads: measuredPads.length,
        rollers: equipment.filter((item) => item.kind === "roller").length,
        sensors: equipment.filter((item) => item.kind === "sensor").length,
        coding: equipment.filter((item) => item.kind === "coding").length,
        other: equipment.filter((item) => !["pad", "roller", "sensor", "coding"].includes(item.kind)).length
      }
    });
  }

  global.Labeler3DEquipmentLayoutAdapter = Object.freeze({
    SCHEMA_VERSION,
    normalizeAngle,
    midpointAngle,
    spanDegrees,
    placementAngle,
    depthForObject,
    snapshot
  });
})(window);
