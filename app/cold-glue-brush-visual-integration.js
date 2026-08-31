(function installServoForgeColdGlueBrushVisualIntegration(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.cold-glue-brush-visual.v1";
  const SVG_NS = "http://www.w3.org/2000/svg";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalizedSpan(startValue, endValue) {
    const start = number(startValue, 0);
    let end = number(endValue, start);
    while (end < start) end += 360;
    return Math.max(0.5, end - start);
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
    return { start: number(item?.start), end: number(item?.end, item?.start) };
  }

  function brushRadius(item, side) {
    const effectiveSide = side || (item?.side === "inner" ? "inner" : "outer");
    return number(state?.radius) + number(effectiveSide === "inner" ? state?.depths?.brushInner : state?.depths?.brushOuter);
  }

  function svgNode(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function installTopDownBrushVisuals() {
    if (typeof drawConfiguredAssemblies !== "function" || global.__ServoForgeColdGlueBrushTopDownInstalled) return;
    const originalDrawConfiguredAssemblies = drawConfiguredAssemblies;

    drawConfiguredAssemblies = function drawConfiguredAssembliesWithColdGlueBrushVisuals(add, layer) {
      originalDrawConfiguredAssemblies(add, layer);
      if (state?.applicationMode !== "cold-glue" || !layer?.querySelectorAll) return;

      const objects = typeof coldGlueMapObjects === "function" ? coldGlueMapObjects() : [];
      const byId = new Map(objects.map((item) => [String(item?.id || ""), item]));
      const sourcePaths = layer.querySelectorAll("[data-cold-glue-brush], [data-cold-glue-brush-channel]");

      sourcePaths.forEach((path) => {
        if (path.dataset.servoforgeBrushReplaced === "true") return;
        const objectLayer = path.closest?.("[data-map-object-id]");
        const item = byId.get(String(objectLayer?.getAttribute("data-map-object-id") || ""));
        if (!item || !path.parentNode) return;

        const side = path.getAttribute("data-channel-side") || (item.side === "inner" ? "inner" : "outer");
        const range = brushRange(item, side);
        const start = range.start;
        let end = range.end;
        while (end < start) end += 360;
        const midpoint = start + (end - start) / 2;
        const radius = brushRadius(item, side);
        const center = angleToXY(midpoint, radius);
        const tangentLength = clamp(radius * normalizedSpan(start, end) * Math.PI / 180, 20, 82);
        const thickness = clamp(number(item?.extension, 20) * 0.52, 9, 14);
        const rotation = angleToSvgRotation(midpoint) + 90;

        const group = svgNode("g", {
          transform: `translate(${center.x} ${center.y}) rotate(${rotation})`,
          "data-cold-glue-brush-visual": item.id,
          "data-brush-side": side
        });
        const backing = svgNode("rect", {
          x: -tangentLength / 2,
          y: -thickness / 2,
          width: tangentLength,
          height: thickness,
          rx: Math.min(4.5, thickness * 0.34),
          fill: "#4738a7",
          stroke: "#28206f",
          "stroke-width": 1.1
        });
        group.appendChild(backing);

        const inset = 2.1;
        const faceWidth = Math.max(4, tangentLength - inset * 2);
        const faceHeight = Math.max(3, thickness - inset * 2);
        group.appendChild(svgNode("rect", {
          x: -faceWidth / 2,
          y: -faceHeight / 2,
          width: faceWidth,
          height: faceHeight,
          rx: Math.min(3, faceHeight * 0.34),
          fill: "#6e5dcc",
          "fill-opacity": 0.88
        }));

        const textureCount = clamp(Math.round(tangentLength / 7), 5, 12);
        for (let index = 1; index < textureCount; index += 1) {
          const x = -faceWidth / 2 + (index / textureCount) * faceWidth;
          group.appendChild(svgNode("line", {
            x1: x,
            y1: -faceHeight * 0.34,
            x2: x,
            y2: faceHeight * 0.34,
            stroke: "#d8d1ff",
            "stroke-width": 0.55,
            "stroke-opacity": 0.26,
            "stroke-linecap": "round",
            "pointer-events": "none"
          }));
        }

        path.setAttribute("visibility", "hidden");
        path.dataset.servoforgeBrushReplaced = "true";
        path.parentNode.appendChild(group);
      });
    };

    global.__ServoForgeColdGlueBrushTopDownInstalled = true;
  }

  function roundedBrushGeometry(THREE, width, height, depth, radius) {
    const halfW = width / 2;
    const halfH = height / 2;
    const r = clamp(radius, 0.005, Math.min(halfW, halfH) * 0.9);
    const shape = new THREE.Shape();
    shape.moveTo(-halfW + r, -halfH);
    shape.lineTo(halfW - r, -halfH);
    shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
    shape.lineTo(halfW, halfH - r);
    shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
    shape.lineTo(-halfW + r, halfH);
    shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
    shape.lineTo(-halfW, -halfH + r);
    shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      steps: 1,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: Math.min(0.008, depth * 0.18),
      bevelThickness: Math.min(0.006, depth * 0.14)
    });
    geometry.center();
    return geometry;
  }

  function createColdGlueBrushAssembly(THREE, item) {
    const group = new THREE.Group();
    group.name = `ServoForgeColdGlueBrush-${String(item?.id || "brush")}`;

    const span = clamp(number(item?.tangentLengthWorld, 0.30), 0.16, 0.72);
    const height = 0.34;
    const backingDepth = 0.070;
    const bristleDepth = 0.038;
    const inner = item?.side === "inner";
    const contactSign = inner ? 1 : -1;

    const backingMaterial = new THREE.MeshStandardMaterial({
      color: 0x3f3299,
      roughness: 0.48,
      metalness: 0.08,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    const bristleMaterial = new THREE.MeshStandardMaterial({
      color: 0x6e5dcc,
      roughness: 0.90,
      metalness: 0.01,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    const textureMaterial = new THREE.MeshStandardMaterial({
      color: 0x9183e2,
      roughness: 0.96,
      metalness: 0
    });
    const mountMaterial = new THREE.MeshStandardMaterial({
      color: 0x7f898f,
      roughness: 0.30,
      metalness: 0.78
    });

    const backing = new THREE.Mesh(
      roundedBrushGeometry(THREE, span, height, backingDepth, 0.035),
      backingMaterial
    );
    backing.name = "ServoForgeColdGlueBrushBacking";
    backing.position.y = 0.60;
    backing.castShadow = true;
    backing.receiveShadow = true;
    group.add(backing);

    const faceWidth = span * 0.94;
    const faceHeight = height * 0.90;
    const face = new THREE.Mesh(
      roundedBrushGeometry(THREE, faceWidth, faceHeight, bristleDepth, 0.028),
      bristleMaterial
    );
    face.name = "ServoForgeColdGlueBrushBristleFace";
    face.position.set(0, 0.60, contactSign * (backingDepth / 2 + bristleDepth / 2 + 0.004));
    face.castShadow = true;
    group.add(face);

    const grooveCount = clamp(Math.round(span / 0.045), 6, 13);
    for (let index = 1; index < grooveCount; index += 1) {
      const x = -faceWidth / 2 + (index / grooveCount) * faceWidth;
      const groove = new THREE.Mesh(
        new THREE.BoxGeometry(0.004, faceHeight * 0.84, 0.004),
        textureMaterial
      );
      groove.position.set(x, 0.60, contactSign * (backingDepth / 2 + bristleDepth + 0.006));
      group.add(groove);
    }

    const postRadius = 0.018;
    const postHeight = height * 1.42;
    const mountSign = -contactSign;
    [-0.30, 0.30].forEach((ratio) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 20),
        mountMaterial
      );
      post.position.set(span * ratio, 0.60 + height * 0.18, mountSign * (backingDepth / 2 + postRadius * 2.3));
      group.add(post);
    });
    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, span * 0.72, 20),
      mountMaterial
    );
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 0.60 + height * 0.48, mountSign * (backingDepth / 2 + postRadius * 2.3));
    group.add(crossbar);

    group.userData.hardwareReference = Object.freeze({
      profileId: "cold-glue-brush",
      dimensionalAuthority: false,
      sideAuthority: inner ? "inner" : "outer",
      visualReference: "cold-glue-brush-photo-reference"
    });
    group.userData.highlightMaterials = [backingMaterial, bristleMaterial];
    group.userData.contactMaterials = [bristleMaterial];
    return group;
  }

  function install3DBrushLayout() {
    const previousAdapter = global.Labeler3DEquipmentLayoutAdapter;
    if (!previousAdapter || global.__ServoForgeColdGlueBrushLayoutInstalled) return;

    function midpoint(startValue, endValue) {
      const start = number(startValue, 0);
      let end = number(endValue, start);
      while (end < start) end += 360;
      const value = (start + (end - start) / 2) % 360;
      return value < 0 ? value + 360 : value;
    }

    function mappedBrushItem(source, raw, side, context) {
      const range = brushRange(raw, side);
      const angleDegrees = midpoint(range.start, range.end);
      const depthMapUnits = number(side === "inner" ? context.depths?.brushInner : context.depths?.brushOuter,
        number(side === "inner" ? context.depths?.wipeInner : context.depths?.wipeOuter));
      const radialWorld = Math.max(0.1, context.physicalPitchRadiusWorld + depthMapUnits * context.mapToWorldScale);
      const orbit = global.Labeler3DSceneAdapter?.machineOrbit?.(angleDegrees, {
        carouselRadius: radialWorld,
        carouselDirection: context.carouselDirection,
        zeroAngleDegrees: context.zeroAngleDegrees
      });
      if (!orbit) return null;
      const span = normalizedSpan(range.start, range.end);
      return Object.freeze({
        ...source,
        id: `${source.id}-${side}`,
        name: `${source.name} ${side === "inner" ? "Inside" : "Outside"}`,
        kind: "brush",
        side,
        angleDegrees,
        startDegrees: range.start,
        endDegrees: range.end,
        spanDegrees: span,
        mapDepthUnits: depthMapUnits,
        radialWorld,
        radialMmEquivalent: radialWorld / Math.max(0.000001, context.worldUnitsPerMm),
        tangentLengthWorld: Math.max(0.12, radialWorld * span * Math.PI / 180),
        position: { x: orbit.x, y: 0, z: orbit.z },
        rotationY: orbit.radians + Math.PI / 2,
        placementAuthority: "cold-glue-brush-channel-inner-outer-map-geometry",
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
        if (item?.kind !== "brush-channel") {
          expanded.push(item);
          return;
        }
        const raw = rawById.get(String(item.id)) || {};
        const outer = mappedBrushItem(item, raw, "outer", context);
        const inner = mappedBrushItem(item, raw, "inner", context);
        if (outer) expanded.push(outer);
        if (inner) expanded.push(inner);
      });

      return Object.freeze({
        ...base,
        objects: Object.freeze(expanded),
        counts: Object.freeze({
          ...(base?.counts || {}),
          brushes: expanded.filter((item) => item?.kind === "brush").length,
          other: expanded.filter((item) => !["pad", "roller", "sensor", "coding", "brush"].includes(item?.kind)).length
        }),
        coldGlueBrushAuthority: "expanded-inner-outer-brush-channel"
      });
    }

    global.Labeler3DEquipmentLayoutAdapter = Object.freeze({
      ...previousAdapter,
      SCHEMA_VERSION: `${previousAdapter.SCHEMA_VERSION || "servoforge.3d-equipment"}+cold-glue-brush-v1`,
      snapshot
    });
    global.__ServoForgeColdGlueBrushLayoutInstalled = true;
  }

  function install3DBrushVisuals() {
    const previousFactory = global.Labeler3DHardwareMeshFactory;
    if (!previousFactory || global.__ServoForgeColdGlueBrush3DInstalled) return;

    function createEquipmentAssembly(THREE, item, geometry) {
      if (item?.kind !== "brush" && item?.kind !== "brush-channel") {
        return previousFactory.createEquipmentAssembly?.(THREE, item, geometry) || null;
      }
      const group = createColdGlueBrushAssembly(THREE, item);
      group.name = group.name || `ServoForgeEquipment-${String(item?.id || "equipment")}`;
      group.userData.kind = item?.kind;
      group.userData.station = item?.station;
      group.userData.section = item?.section;
      group.position.set(number(item?.position?.x), 0, number(item?.position?.z));
      group.rotation.y = number(item?.rotationY);
      return group;
    }

    global.Labeler3DHardwareMeshFactory = Object.freeze({
      ...previousFactory,
      FACTORY_VERSION: `${previousFactory.FACTORY_VERSION || "servoforge.3d-hardware-mesh"}+cold-glue-brush-v1`,
      createBrushAssembly: createColdGlueBrushAssembly,
      createEquipmentAssembly
    });
    global.__ServoForgeColdGlueBrush3DInstalled = true;
  }

  installTopDownBrushVisuals();
  install3DBrushLayout();
  install3DBrushVisuals();

  global.ServoForgeColdGlueBrushVisualIntegration = Object.freeze({
    INTEGRATION_VERSION,
    installTopDownBrushVisuals,
    install3DBrushLayout,
    install3DBrushVisuals,
    createColdGlueBrushAssembly
  });
})(window);
