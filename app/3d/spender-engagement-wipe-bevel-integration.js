(function installServoForge3DSpenderEngagementAndWipeBevel(global) {
  "use strict";

  const baseHardwareFactory = global.Labeler3DHardwareMeshFactory;
  const baseWipeFactory = global.Labeler3DWipePadMeshFactory;
  if (!baseHardwareFactory?.createAggregateAssembly || !baseWipeFactory?.createMeasuredAssembly || !baseWipeFactory?.radialBands) {
    throw new Error("ServoForge spender engagement/wipe bevel integration requires the active hardware and wipe-pad factories.");
  }

  const FACTORY_VERSION = "servoforge.3d-hardware-mesh.v10-spender-engagement-wipe-bevel";
  const WIPE_FACTORY_VERSION = "servoforge.3d-wipe-pad-mesh.v2-leading-bevel";
  const SPENDER_ROOT_OUTSET_MM = 2;
  const SPENDER_DOWNSTREAM_INSET_MM = 2;
  const WIPE_LEADING_BEVEL_LENGTH_MM = 15;
  const WIPE_LEADING_BEVEL_DEPTH_MM = 6;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function unitsPerMm(geometry = {}) {
    return Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.004450588));
  }

  function findFirst(root, name) {
    let found = null;
    root?.traverse?.((child) => {
      if (!found && child?.name === name) found = child;
    });
    return found;
  }

  function geometryWidth(mesh) {
    const parameterWidth = number(mesh?.geometry?.parameters?.width, 0);
    if (parameterWidth > 0) return parameterWidth;
    mesh?.geometry?.computeBoundingBox?.();
    const box = mesh?.geometry?.boundingBox;
    return box ? Math.max(0, number(box.max?.x) - number(box.min?.x)) : 0;
  }

  function applySpenderEngagement(assembly, item, geometry) {
    if (!assembly) return assembly;
    const pivot = findFirst(assembly, "ServoForgeEngagementAnglePivot");
    const plate = findFirst(assembly, "ServoForgeSpenderPlate");
    if (!pivot || !plate || pivot.userData?.spenderEngagementV10Applied) return assembly;

    const scale = unitsPerMm(geometry);
    const plateLength = Math.max(scale, geometryWidth(plate));
    const totalRadialDeltaWorld = (SPENDER_ROOT_OUTSET_MM + SPENDER_DOWNSTREAM_INSET_MM) * scale;
    const engagementAngleRadians = Math.atan2(totalRadialDeltaWorld, plateLength);
    const outwardSign = number(item?.radialOutSign, 1) >= 0 ? 1 : -1;

    // Local +X is downstream bottle flow. Rotating around the common engagement
    // pivot makes the upstream/knuckle end move radially outward while the
    // downstream peel/wipe end moves radially inward. The symmetric 4 mm total
    // delta produces about 2 mm at each plate end without changing map angle.
    pivot.rotation.y += outwardSign * engagementAngleRadians;
    pivot.userData.spenderEngagementV10Applied = true;
    pivot.userData.engagementAngleRadians = engagementAngleRadians;
    pivot.userData.engagementAngleDegrees = engagementAngleRadians * 180 / Math.PI;
    pivot.userData.rootOutsetMm = SPENDER_ROOT_OUTSET_MM;
    pivot.userData.downstreamInsetMm = SPENDER_DOWNSTREAM_INSET_MM;
    pivot.userData.engagementAuthority = "user-requested-root-out/downstream-in";

    assembly.userData.spenderEngagement = Object.freeze({
      rootOutsetMm: SPENDER_ROOT_OUTSET_MM,
      downstreamInsetMm: SPENDER_DOWNSTREAM_INSET_MM,
      engagementAngleDegrees: engagementAngleRadians * 180 / Math.PI,
      plateLengthWorld: plateLength,
      mapAnglePreserved: true,
      flowAlignmentPreserved: true,
      dimensionalAuthority: "user-requested-approx-2mm-downstream-inset"
    });
    return assembly;
  }

  function createAggregateAssembly(THREE, item, geometry) {
    return applySpenderEngagement(baseHardwareFactory.createAggregateAssembly(THREE, item, geometry), item, geometry);
  }

  function createSpenderPlateAssembly(THREE, item, geometry) {
    return applySpenderEngagement(baseHardwareFactory.createSpenderPlateAssembly(THREE, item, geometry), item, geometry);
  }

  function pushTriangle(positions, a, b, c) {
    positions.push(...a, ...b, ...c);
  }

  function pushQuad(positions, a, b, c, d) {
    pushTriangle(positions, a, b, c);
    pushTriangle(positions, a, c, d);
  }

  function beveledAnnularPrismGeometry(THREE, options = {}) {
    const innerRadius = Math.max(0.000001, number(options.innerRadius));
    const outerRadius = Math.max(innerRadius + 0.000001, number(options.outerRadius));
    const originRadius = Math.max(0.000001, number(options.originRadius));
    const height = Math.max(0.000001, number(options.height));
    const spanRadians = Math.max(0.0001, number(options.spanRadians));
    const side = options.side === "inner" ? "inner" : "outer";
    const bevelDepth = Math.max(0, number(options.bevelDepth));
    const bevelFraction = clamp(number(options.bevelFraction), 0, 0.48);
    const segments = Math.max(8, Math.min(128, Math.ceil(number(options.segments, spanRadians * 64))));
    const y0 = -height / 2;
    const y1 = height / 2;
    const start = -spanRadians / 2;
    const positions = [];

    function radialBandsAt(angle) {
      const progress = clamp((angle - start) / spanRadians, 0, 1);
      const relief = bevelFraction > 0 && progress < bevelFraction
        ? bevelDepth * (1 - progress / bevelFraction)
        : 0;
      if (side === "inner") {
        return {
          inner: innerRadius,
          outer: Math.max(innerRadius + 0.000001, outerRadius - relief)
        };
      }
      return {
        inner: Math.min(outerRadius - 0.000001, innerRadius + relief),
        outer: outerRadius
      };
    }

    function point(radius, angle, y) {
      return [
        Math.cos(angle) * radius - originRadius,
        y,
        Math.sin(angle) * radius
      ];
    }

    for (let index = 0; index < segments; index += 1) {
      const a0 = start + spanRadians * (index / segments);
      const a1 = start + spanRadians * ((index + 1) / segments);
      const r0 = radialBandsAt(a0);
      const r1 = radialBandsAt(a1);

      const i00 = point(r0.inner, a0, y0);
      const i01 = point(r1.inner, a1, y0);
      const i10 = point(r0.inner, a0, y1);
      const i11 = point(r1.inner, a1, y1);
      const o00 = point(r0.outer, a0, y0);
      const o01 = point(r1.outer, a1, y0);
      const o10 = point(r0.outer, a0, y1);
      const o11 = point(r1.outer, a1, y1);

      pushQuad(positions, o00, o10, o11, o01);
      pushQuad(positions, i01, i11, i10, i00);
      pushQuad(positions, i10, i11, o11, o10);
      pushQuad(positions, i00, o00, o01, i01);
    }

    const startBands = radialBandsAt(start);
    const end = spanRadians / 2;
    const endBands = radialBandsAt(end);
    pushQuad(
      positions,
      point(startBands.inner, start, y0),
      point(startBands.inner, start, y1),
      point(startBands.outer, start, y1),
      point(startBands.outer, start, y0)
    );
    pushQuad(
      positions,
      point(endBands.inner, end, y0),
      point(endBands.outer, end, y0),
      point(endBands.outer, end, y1),
      point(endBands.inner, end, y1)
    );

    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    result.computeVertexNormals();
    result.computeBoundingBox();
    result.computeBoundingSphere();
    return result;
  }

  function applyLeadingBevel(THREE, assembly, item) {
    if (!assembly || assembly.userData?.leadingEntryBevelV2Applied) return assembly;
    const wipePad = item?.wipePad;
    const bands = baseWipeFactory.radialBands(wipePad);
    const height = Math.max(0.000001, number(wipePad?.heightWorld));
    const spanRadians = Math.max(0.0001, number(wipePad?.spanDegrees, number(item?.spanDegrees, 0.5)) * Math.PI / 180);
    if (!bands || !height) return assembly;

    const sponge = findFirst(assembly, "ServoForgeWipePadSponge18mm");
    if (!sponge?.geometry) return assembly;

    const scale = Math.max(0.000001, number(wipePad?.heightWorld) / Math.max(1, number(wipePad?.heightMm, 70)));
    const bevelDepthWorld = WIPE_LEADING_BEVEL_DEPTH_MM * scale;
    const bevelLengthWorld = WIPE_LEADING_BEVEL_LENGTH_MM * scale;
    const contactRadiusWorld = Math.max(0.000001, number(wipePad?.contactFaceRadiusWorld));
    const contactArcLengthWorld = Math.max(0.000001, contactRadiusWorld * spanRadians);
    const bevelFraction = clamp(bevelLengthWorld / contactArcLengthWorld, 0.04, 0.45);

    const beveledGeometry = beveledAnnularPrismGeometry(THREE, {
      innerRadius: bands.spongeInner,
      outerRadius: bands.spongeOuter,
      originRadius: bands.origin,
      height,
      spanRadians,
      side: wipePad?.side,
      bevelDepth: bevelDepthWorld,
      bevelFraction
    });
    const previousGeometry = sponge.geometry;
    sponge.geometry = beveledGeometry;
    previousGeometry?.dispose?.();
    sponge.userData.leadingBevelLengthMm = WIPE_LEADING_BEVEL_LENGTH_MM;
    sponge.userData.leadingBevelDepthMm = WIPE_LEADING_BEVEL_DEPTH_MM;
    sponge.userData.leadingBevelStart = "machine-map-start-angle";
    sponge.userData.leadingBevelPurpose = "label-entry-clearance-before-full-wipe-contact";

    assembly.userData.leadingEntryBevelV2Applied = true;
    assembly.userData.wipePad = Object.freeze({
      ...(assembly.userData.wipePad || {}),
      leadingBevelLengthMm: WIPE_LEADING_BEVEL_LENGTH_MM,
      leadingBevelDepthMm: WIPE_LEADING_BEVEL_DEPTH_MM,
      leadingBevelStart: "machine-map-start-angle",
      leadingBevelAuthority: "user-requested-label-entry-clearance-photo-reference",
      normalContactPenetrationMm: number(wipePad?.bottlePenetrationMm, 2)
    });
    return assembly;
  }

  function createMeasuredAssembly(THREE, item, options = {}) {
    return applyLeadingBevel(THREE, baseWipeFactory.createMeasuredAssembly(THREE, item, options), item);
  }

  global.Labeler3DWipePadMeshFactory = Object.freeze({
    ...baseWipeFactory,
    FACTORY_VERSION: WIPE_FACTORY_VERSION,
    WIPE_LEADING_BEVEL_LENGTH_MM,
    WIPE_LEADING_BEVEL_DEPTH_MM,
    beveledAnnularPrismGeometry,
    createMeasuredAssembly
  });

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...baseHardwareFactory,
    FACTORY_VERSION,
    SPENDER_ROOT_OUTSET_MM,
    SPENDER_DOWNSTREAM_INSET_MM,
    createSpenderPlateAssembly,
    createAggregateAssembly
  });
})(window);
