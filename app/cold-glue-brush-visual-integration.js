(function installServoForgeColdGlueBrushVisualIntegration(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.cold-glue-brush-visual.v2";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const BRUSH_HEIGHT_MM = 70;
  const BRISTLE_DEPTH_MM = 18;
  const BACKING_DEPTH_MM = 4;
  const TOTAL_DEPTH_MM = BRISTLE_DEPTH_MM + BACKING_DEPTH_MM;

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

  function forwardSpan(startValue, endValue) {
    const start = normalizeAngle(startValue);
    const end = normalizeAngle(endValue);
    let span = end - start;
    if (span <= 0) span += 360;
    return Math.max(0.5, span);
  }

  function brushRange(item, side) {
    if (side === "inner") {
      return {
        start: number(item?.innerStart, item?.start),
        end: number(item?.innerEnd, item?.end)
      };
    }
    if (side === "outer") {
      return {
        start: number(item?.outerStart, item?.start),
        end: number(item?.outerEnd, item?.end)
      };
    }
    return {
      start: number(item?.start, item?.angle),
      end: number(item?.end, item?.start)
    };
  }

  function brushRadius(item, side) {
    const effectiveSide = side || (item?.side === "inner" ? "inner" : "outer");
    const depth = effectiveSide === "inner" ? state?.depths?.brushInner : state?.depths?.brushOuter;
    return number(state?.radius) + number(depth);
  }

  function svgNode(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function brushWidthMapUnits() {
    if (typeof wipeDownPadWidthMapUnits === "function") return wipeDownPadWidthMapUnits();
    return Math.max(8, number(state?.radius, 250) * 0.045);
  }

  function curvedBrushPath(start, end, centerRadius, width) {
    if (typeof machineTrailingPadPath === "function") {
      return machineTrailingPadPath(start, end, centerRadius, width);
    }
    if (typeof arcPath === "function") {
      return arcPath(start, end, centerRadius - width / 2, centerRadius + width / 2);
    }
    return "";
  }

  function addTopDownBristleTexture(group, range, centerRadius, width) {
    if (typeof angleToXY !== "function") return;
    const span = forwardSpan(range.start, range.end);
    const rows = clamp(Math.round(span / 2.4), 6, 18);
    const innerRadius = centerRadius - width * 0.34;
    const outerRadius = centerRadius + width * 0.34;

    for (let index = 1; index < rows; index += 1) {
      const angle = number(range.start) + span * (index / rows);
      const a = angleToXY(angle, innerRadius);
      const b = angleToXY(angle, outerRadius);
      group.appendChild(svgNode("line", {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        stroke: index % 2 ? "#fffdf2" : "#d8d1bd",
        "stroke-width": index % 2 ? 0.62 : 0.44,
        "stroke-opacity": index % 2 ? 0.78 : 0.55,
        "stroke-linecap": "round",
        "pointer-events": "none"
      }));
    }
  }

  function installTopDownBrushVisuals() {
    if (typeof drawConfiguredAssemblies !== "function" || global.__ServoForgeColdGlueBrushTopDownV2Installed) return;
    const originalDrawConfiguredAssemblies = drawConfiguredAssemblies;

    drawConfiguredAssemblies = function drawConfiguredAssembliesWithCurvedColdGlueBrushes(add, layer) {
      originalDrawConfiguredAssemblies(add, layer);
      if (state?.applicationMode !== "cold-glue" || !layer?.querySelectorAll) return;

      const objects = typeof coldGlueMapObjects === "function" ? coldGlueMapObjects() : [];
      const byId = new Map(objects.map((item) => [String(item?.id || ""), item]));
      const sourcePaths = layer.querySelectorAll("[data-cold-glue-brush], [data-cold-glue-brush-channel]");

      sourcePaths.forEach((sourcePath) => {
        if (sourcePath.dataset.servoforgeBrushV2 === "true") return;
        const objectLayer = sourcePath.closest?.("[data-map-object-id]");
        const item = byId.get(String(objectLayer?.getAttribute("data-map-object-id") || ""));
        if (!item || !sourcePath.parentNode) return;

        const side = sourcePath.getAttribute("data-channel-side") || (item.side === "inner" ? "inner" : "outer");
        const range = brushRange(item, side);
        const radius = brushRadius(item, side);
        const width = brushWidthMapUnits();
        const d = curvedBrushPath(range.start, range.end, radius, width);
        if (!d) return;

        const visual = svgNode("g", {
          "data-cold-glue-brush-visual": item.id,
          "data-brush-side": side,
          "data-brush-shape": "curved-wipe-profile",
          "pointer-events": "none"
        });

        visual.appendChild(svgNode("path", {
          d,
          fill: "#202428",
          stroke: "#0f1113",
          "stroke-width": 2.5,
          "stroke-linejoin": "round"
        }));

        visual.appendChild(svgNode("path", {
          d,
          fill: "#eee8d5",
          stroke: "#c6bd9f",
          "stroke-width": 0.8,
          "stroke-linejoin": "round",
          transform: `scale(${1 - 1.3 / Math.max(20, radius)} ${1 - 1.3 / Math.max(20, radius)})`
        }));

        addTopDownBristleTexture(visual, range, radius, width);
        sourcePath.setAttribute("fill-opacity", "0.001");
        sourcePath.setAttribute("stroke", "transparent");
        sourcePath.dataset.servoforgeBrushV2 = "true";
        sourcePath.parentNode.appendChild(visual);
      });
    };

    global.__ServoForgeColdGlueBrushTopDownV2Installed = true;
  }

  function brushBands(item, geometry) {
    const unitsPerMm = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.00445));
    const origin = Math.max(0.1, number(item?.radialWorld, 1));
    const bristleDepth = BRISTLE_DEPTH_MM * unitsPerMm;
    const backingDepth = BACKING_DEPTH_MM * unitsPerMm;
    const totalDepth = TOTAL_DEPTH_MM * unitsPerMm;
    const contactRadius = item?.side === "inner"
      ? origin + totalDepth / 2
      : origin - totalDepth / 2;

    if (item?.side === "inner") {
      return Object.freeze({
        origin,
        contactRadius,
        bristleInner: contactRadius - bristleDepth,
        bristleOuter: contactRadius,
        backingInner: contactRadius - bristleDepth - backingDepth,
        backingOuter: contactRadius - bristleDepth,
        contactSign: 1,
        unitsPerMm
      });
    }

    return Object.freeze({
      origin,
      contactRadius,
      bristleInner: contactRadius,
      bristleOuter: contactRadius + bristleDepth,
      backingInner: contactRadius + bristleDepth,
      backingOuter: contactRadius + bristleDepth + backingDepth,
      contactSign: -1,
      unitsPerMm
    });
  }

  function createCurvedColdGlueBrushAssembly(THREE, item, geometry) {
    const annularPrismGeometry = global.Labeler3DWipePadMeshFactory?.annularPrismGeometry;
    if (typeof annularPrismGeometry !== "function") return null;

    const bands = brushBands(item, geometry);
    const spanRadians = Math.max(0.0001, number(item?.spanDegrees, 0.5) * Math.PI / 180);
    const height = BRUSH_HEIGHT_MM * bands.unitsPerMm;
    const group = new THREE.Group();
    group.name = `ServoForgeColdGlueBrush-${String(item?.id || "brush")}`;

    const bristleMaterial = new THREE.MeshStandardMaterial({
      color: 0xeee8d5,
      roughness: 0.98,
      metalness: 0.0,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    const bristleShadeMaterial = new THREE.MeshStandardMaterial({
      color: 0xcfc5aa,
      roughness: 1.0,
      metalness: 0
    });
    const backingMaterial = new THREE.MeshStandardMaterial({
      color: 0x202428,
      roughness: 0.58,
      metalness: 0.22,
      emissive: 0x000000,
      emissiveIntensity: 0
    });

    const bristles = new THREE.Mesh(
      annularPrismGeometry(THREE, {
        innerRadius: bands.bristleInner,
        outerRadius: bands.bristleOuter,
        originRadius: bands.origin,
        height,
        spanRadians
      }),
      bristleMaterial
    );
    bristles.name = "ServoForgeColdGlueBrushBristles";
    bristles.position.y = 0.60;
    bristles.castShadow = true;
    bristles.receiveShadow = true;
    group.add(bristles);

    const backing = new THREE.Mesh(
      annularPrismGeometry(THREE, {
        innerRadius: bands.backingInner,
        outerRadius: bands.backingOuter,
        originRadius: bands.origin,
        height,
        spanRadians
      }),
      backingMaterial
    );
    backing.name = "ServoForgeColdGlueBrushBacking";
    backing.position.y = 0.60;
    backing.castShadow = true;
    backing.receiveShadow = true;
    group.add(backing);

    const textureRows = clamp(Math.round(number(item?.spanDegrees, 0.5) / 1.3), 8, 22);
    const contactOffset = bands.contactSign * Math.max(0.003, bands.unitsPerMm * 0.8);
    const laneDepth = Math.max(0.0025, bands.unitsPerMm * 0.65);
    const laneWidth = Math.max(0.0025, bands.unitsPerMm * 0.75);
    const laneHeight = height * 0.88;

    for (let index = 1; index < textureRows; index += 1) {
      const angle = -spanRadians / 2 + spanRadians * (index / textureRows);
      const radius = bands.contactRadius + contactOffset;
      const localX = Math.cos(angle) * radius - bands.origin;
      const localZ = Math.sin(angle) * radius;
      const lane = new THREE.Mesh(
        new THREE.BoxGeometry(laneDepth, laneHeight, laneWidth),
        bristleShadeMaterial
      );
      lane.position.set(localX, 0.60, localZ);
      lane.rotation.y = -angle;
      group.add(lane);
    }

    group.userData.hardwareReference = Object.freeze({
      profileId: "cold-glue-brush",
      dimensionalAuthority: false,
      shapeAuthority: "wipe-down-pad-curvature",
      visualReference: "user-supplied-cold-glue-brush-photo",
      curved: true
    });
    group.userData.highlightMaterials = [bristleMaterial, backingMaterial];
    group.userData.contactMaterials = [bristleMaterial];
    return group;
  }

  function install3DBrushLayout() {
    const previousAdapter = global.Labeler3DEquipmentLayoutAdapter;
    if (!previousAdapter || global.__ServoForgeColdGlueBrushLayoutV2Installed) return;

    function mappedBrushItem(source, raw, side, context) {
      const range = brushRange(raw, side);
      const span = forwardSpan(range.start, range.end);
      const angleDegrees = normalizeAngle(number(range.start) + span / 2);
      const depthMapUnits = number(
        side === "inner" ? context.depths?.brushInner : context.depths?.brushOuter,
        number(side === "inner" ? context.depths?.wipeInner : context.depths?.wipeOuter)
      );
      const radialWorld = Math.max(0.1, context.physicalPitchRadiusWorld + depthMapUnits * context.mapToWorldScale);
      const orbit = global.Labeler3DSceneAdapter?.machineOrbit?.(angleDegrees, {
        carouselRadius: radialWorld,
        carouselDirection: context.carouselDirection,
        zeroAngleDegrees: context.zeroAngleDegrees
      });
      if (!orbit) return null;

      return Object.freeze({
        ...source,
        id: source.kind === "brush-channel" ? `${source.id}-${side}` : source.id,
        name: source.kind === "brush-channel"
          ? `${source.name} ${side === "inner" ? "Inside" : "Outside"}`
          : source.name,
        kind: "brush",
        side,
        angleDegrees,
        startDegrees: normalizeAngle(range.start),
        endDegrees: normalizeAngle(range.end),
        spanDegrees: span,
        mapDepthUnits: depthMapUnits,
        radialWorld,
        radialMmEquivalent: radialWorld / Math.max(0.000001, context.worldUnitsPerMm),
        tangentLengthWorld: Math.max(0.12, radialWorld * span * Math.PI / 180),
        position: { x: orbit.x, y: 0, z: orbit.z },
        rotationY: -Math.atan2(orbit.z, orbit.x),
        placementAuthority: "cold-glue-brush-uses-wipe-down-curved-footprint",
        radialCadAuthority: false
      });
    }

    function snapshot(machineMap, stateLike, geometry, options = {}) {
      const base = previousAdapter.snapshot(machineMap, stateLike, geometry, options);
      const mapObjects = Array.isArray(machineMap?.objects) ? machineMap.objects : [];
      const rawById = new Map(mapObjects.map((item) => [String(item?.id || ""), item]));
      const depths = machineMap?.depths && typeof machineMap.depths === "object"
        ? machineMap.depths
        : (stateLike?.depths || {});
      const worldUnitsPerMm = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.00445));
      const context = {
        depths,
        physicalPitchRadiusWorld: number(base?.physicalPitchRadiusWorld, geometry?.machine?.physicalPitchRadiusWorld),
        mapToWorldScale: number(base?.mapToWorldScale, 1),
        worldUnitsPerMm,
        carouselDirection: String(options.carouselDirection || machineMap?.machineSettings?.direction || stateLike?.direction || "ccw"),
        zeroAngleDegrees: number(options.zeroAngleDegrees, machineMap?.machineSettings?.zeroAngle || stateLike?.zeroAngle)
      };

      const expanded = [];
      (Array.isArray(base?.objects) ? base.objects : []).forEach((item) => {
        if (item?.kind !== "brush" && item?.kind !== "brush-channel") {
          expanded.push(item);
          return;
        }

        const raw = rawById.get(String(item.id)) || item;
        if (item.kind === "brush-channel") {
          const outer = mappedBrushItem(item, raw, "outer", context);
          const inner = mappedBrushItem(item, raw, "inner", context);
          if (outer) expanded.push(outer);
          if (inner) expanded.push(inner);
          return;
        }

        const mapped = mappedBrushItem(item, raw, raw?.side === "inner" ? "inner" : "outer", context);
        if (mapped) expanded.push(mapped);
      });

      return Object.freeze({
        ...base,
        objects: Object.freeze(expanded),
        counts: Object.freeze({
          ...(base?.counts || {}),
          brushes: expanded.filter((item) => item?.kind === "brush").length,
          other: expanded.filter((item) => !["pad", "roller", "sensor", "coding", "brush"].includes(item?.kind)).length
        }),
        coldGlueBrushAuthority: "wipe-down-curvature-inner-outer-v2"
      });
    }

    global.Labeler3DEquipmentLayoutAdapter = Object.freeze({
      ...previousAdapter,
      SCHEMA_VERSION: `${previousAdapter.SCHEMA_VERSION || "servoforge.3d-equipment"}+cold-glue-brush-v2`,
      snapshot
    });
    global.__ServoForgeColdGlueBrushLayoutV2Installed = true;
  }

  function install3DBrushVisuals() {
    const previousFactory = global.Labeler3DHardwareMeshFactory;
    if (!previousFactory || global.__ServoForgeColdGlueBrush3DV2Installed) return;

    function createEquipmentAssembly(THREE, item, geometry) {
      if (item?.kind !== "brush" && item?.kind !== "brush-channel") {
        return previousFactory.createEquipmentAssembly?.(THREE, item, geometry) || null;
      }

      const group = createCurvedColdGlueBrushAssembly(THREE, item, geometry);
      if (!group) return previousFactory.createEquipmentAssembly?.(THREE, item, geometry) || null;
      group.userData.kind = item?.kind;
      group.userData.station = item?.station;
      group.userData.section = item?.section;
      group.position.set(number(item?.position?.x), 0, number(item?.position?.z));
      group.rotation.y = number(item?.rotationY, -Math.atan2(number(item?.position?.z), number(item?.position?.x)));
      return group;
    }

    global.Labeler3DHardwareMeshFactory = Object.freeze({
      ...previousFactory,
      FACTORY_VERSION: `${previousFactory.FACTORY_VERSION || "servoforge.3d-hardware-mesh"}+cold-glue-brush-v2`,
      createBrushAssembly: createCurvedColdGlueBrushAssembly,
      createEquipmentAssembly
    });
    global.__ServoForgeColdGlueBrush3DV2Installed = true;
  }

  installTopDownBrushVisuals();
  install3DBrushLayout();
  install3DBrushVisuals();

  global.ServoForgeColdGlueBrushVisualIntegration = Object.freeze({
    INTEGRATION_VERSION,
    BRUSH_HEIGHT_MM,
    BRISTLE_DEPTH_MM,
    BACKING_DEPTH_MM,
    TOTAL_DEPTH_MM,
    installTopDownBrushVisuals,
    install3DBrushLayout,
    install3DBrushVisuals,
    createCurvedColdGlueBrushAssembly
  });
})(window);
