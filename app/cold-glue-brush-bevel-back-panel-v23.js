(function installServoForgeColdGlueBrushBevelBackPanel(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.cold-glue-brush-bevel-back-panel.v23";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const BRUSH_HEIGHT_MM = 70;
  const BRISTLE_DEPTH_MM = 18;
  const BACK_PANEL_DEPTH_MM = 4;

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
    return {
      start: number(item?.start, item?.angle),
      end: number(item?.end, item?.start)
    };
  }

  function brushCenterRadius(item, side) {
    const depth = side === "inner" ? state?.depths?.brushInner : state?.depths?.brushOuter;
    return number(state?.radius) + number(depth);
  }

  function brushWidthMapUnits() {
    if (typeof wipeDownPadWidthMapUnits === "function") return wipeDownPadWidthMapUnits();
    return Math.max(8, number(state?.radius, 250) * 0.045);
  }

  function beveledAnnularPath(startValue, endValue, centerRadius, width, side) {
    if (typeof angleToXY !== "function") return "";
    const start = number(startValue, 0);
    let end = number(endValue, start);
    while (end < start) end += 360;

    const innerRadius = Math.max(1, centerRadius - width / 2);
    const outerRadius = Math.max(innerRadius + 0.5, centerRadius + width / 2);
    const span = Math.max(0.1, end - start);
    const physicalBevelDeg = (width / Math.max(1, centerRadius)) * 180 / Math.PI * 0.8;
    const bevelDeg = Math.min(span * 0.38, Math.max(0.75, Math.min(5, physicalBevelDeg)));
    const sweepForward = state?.direction === "cw" ? 0 : 1;
    const sweepReverse = sweepForward ? 0 : 1;

    if (side === "inner") {
      // Mirror the wipe-style leading bevel radially for the inside brush.
      // This points the bevel inward toward the carousel center instead of
      // matching the outside brush orientation.
      const startInner = angleToXY(start, innerRadius);
      const endInner = angleToXY(end, innerRadius);
      const startOuter = angleToXY(start + bevelDeg, outerRadius);
      const endOuter = angleToXY(end, outerRadius);
      const outerSpan = Math.max(0.1, end - (start + bevelDeg));
      return [
        `M ${startInner.x} ${startInner.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${span > 180 ? 1 : 0} ${sweepForward} ${endInner.x} ${endInner.y}`,
        `L ${endOuter.x} ${endOuter.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${outerSpan > 180 ? 1 : 0} ${sweepReverse} ${startOuter.x} ${startOuter.y}`,
        "Z"
      ].join(" ");
    }

    const startOuter = angleToXY(start, outerRadius);
    const endOuter = angleToXY(end, outerRadius);
    const startInner = angleToXY(start + bevelDeg, innerRadius);
    const endInner = angleToXY(end, innerRadius);
    const innerSpan = Math.max(0.1, end - (start + bevelDeg));
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${span > 180 ? 1 : 0} ${sweepForward} ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${innerSpan > 180 ? 1 : 0} ${sweepReverse} ${startInner.x} ${startInner.y}`,
      "Z"
    ].join(" ");
  }

  function updateTopDownBrush(group, item, side) {
    const paths = group?.querySelectorAll?.("path");
    if (!paths || paths.length < 2) return;

    const range = brushRange(item, side);
    const centerRadius = brushCenterRadius(item, side);
    const totalWidth = brushWidthMapUnits();
    const bristleWidth = Math.max(4, totalWidth - 2.0);
    const panelWidth = clamp(totalWidth * 0.24, 2.8, 4.2);
    const backsideSign = side === "inner" ? -1 : 1;
    const panelCenterRadius = centerRadius + backsideSign * (bristleWidth / 2 + panelWidth / 2 - 0.35);

    const panelPath = beveledAnnularPath(range.start, range.end, panelCenterRadius, panelWidth, side);
    const bristlePath = beveledAnnularPath(range.start, range.end, centerRadius, bristleWidth, side);
    if (!panelPath || !bristlePath) return;

    paths[0].setAttribute("d", panelPath);
    paths[0].setAttribute("fill", "#3a4045");
    paths[0].setAttribute("stroke", "#15191c");
    paths[0].setAttribute("stroke-width", "1.05");
    paths[0].setAttribute("data-brush-back-panel", side);

    paths[1].setAttribute("d", bristlePath);
    paths[1].setAttribute("fill", "#ffffff");
    paths[1].setAttribute("stroke", "#d2d2d2");
    paths[1].setAttribute("stroke-width", "0.72");
    paths[1].setAttribute("data-brush-bristle-face", side);

    group.setAttribute("data-bevel-orientation", side === "inner" ? "inward" : "outward");
    group.setAttribute("data-back-panel", "dark-grey");
  }

  function installTopDownOverride() {
    if (typeof drawConfiguredAssemblies !== "function" || global.__ServoForgeColdGlueBrushBevelPanelTopDownInstalled) return;
    const previousDrawConfiguredAssemblies = drawConfiguredAssemblies;

    drawConfiguredAssemblies = function drawConfiguredAssembliesWithMirroredInnerBrushBevel(add, layer) {
      previousDrawConfiguredAssemblies(add, layer);
      if (state?.applicationMode !== "cold-glue" || !layer?.querySelectorAll) return;

      const objects = typeof coldGlueMapObjects === "function" ? coldGlueMapObjects() : [];
      const byId = new Map(objects.map((item) => [String(item?.id || ""), item]));
      layer.querySelectorAll("[data-cold-glue-brush-visual]").forEach((group) => {
        const objectLayer = group.closest?.("[data-map-object-id]");
        const item = byId.get(String(objectLayer?.getAttribute("data-map-object-id") || ""));
        if (!item) return;
        const side = group.getAttribute("data-brush-side") === "inner" ? "inner" : "outer";
        updateTopDownBrush(group, item, side);
      });
    };

    global.__ServoForgeColdGlueBrushBevelPanelTopDownInstalled = true;
  }

  function pushTriangle(positions, a, b, c) {
    positions.push(...a, ...b, ...c);
  }

  function pushQuad(positions, a, b, c, d) {
    pushTriangle(positions, a, b, c);
    pushTriangle(positions, a, c, d);
  }

  function beveledAnnularPrismGeometry(THREE, options = {}) {
    const innerRadius = Math.max(0.001, number(options.innerRadius));
    const outerRadius = Math.max(innerRadius + 0.001, number(options.outerRadius));
    const originRadius = Math.max(0.001, number(options.originRadius));
    const height = Math.max(0.001, number(options.height));
    const spanRadians = Math.max(0.0001, number(options.spanRadians));
    const side = options.side === "inner" ? "inner" : "outer";
    const segments = Math.max(6, Math.min(96, Math.ceil(spanRadians * 56)));
    const y0 = -height / 2;
    const y1 = height / 2;
    const start = -spanRadians / 2;
    const end = spanRadians / 2;
    const averageRadius = (innerRadius + outerRadius) / 2;
    const width = outerRadius - innerRadius;
    const bevelRadians = Math.min(spanRadians * 0.38, Math.max(0.012, Math.min(0.09, width / Math.max(0.001, averageRadius) * 0.8)));
    const innerStart = side === "inner" ? start : start + bevelRadians;
    const outerStart = side === "inner" ? start + bevelRadians : start;
    const positions = [];

    function point(radius, angle, y) {
      return [
        Math.cos(angle) * radius - originRadius,
        y,
        Math.sin(angle) * radius
      ];
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    for (let index = 0; index < segments; index += 1) {
      const t0 = index / segments;
      const t1 = (index + 1) / segments;
      const ia0 = lerp(innerStart, end, t0);
      const ia1 = lerp(innerStart, end, t1);
      const oa0 = lerp(outerStart, end, t0);
      const oa1 = lerp(outerStart, end, t1);

      const i00 = point(innerRadius, ia0, y0);
      const i01 = point(innerRadius, ia1, y0);
      const i10 = point(innerRadius, ia0, y1);
      const i11 = point(innerRadius, ia1, y1);
      const o00 = point(outerRadius, oa0, y0);
      const o01 = point(outerRadius, oa1, y0);
      const o10 = point(outerRadius, oa0, y1);
      const o11 = point(outerRadius, oa1, y1);

      pushQuad(positions, o00, o10, o11, o01);
      pushQuad(positions, i01, i11, i10, i00);
      pushQuad(positions, i10, i11, o11, o10);
      pushQuad(positions, i00, o00, o01, i01);
    }

    pushQuad(
      positions,
      point(innerRadius, innerStart, y0),
      point(innerRadius, innerStart, y1),
      point(outerRadius, outerStart, y1),
      point(outerRadius, outerStart, y0)
    );
    pushQuad(
      positions,
      point(innerRadius, end, y0),
      point(outerRadius, end, y0),
      point(outerRadius, end, y1),
      point(innerRadius, end, y1)
    );

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  function brushBands(item, geometry) {
    const unitsPerMm = Math.max(0.000001, number(geometry?.renderScale?.worldUnitsPerMm, 0.00445));
    const origin = Math.max(0.1, number(item?.radialWorld, 1));
    const bristleDepth = BRISTLE_DEPTH_MM * unitsPerMm;
    const panelDepth = BACK_PANEL_DEPTH_MM * unitsPerMm;
    const totalDepth = bristleDepth + panelDepth;
    const inner = item?.side === "inner";
    const contactRadius = inner ? origin + totalDepth / 2 : origin - totalDepth / 2;

    if (inner) {
      return {
        origin,
        unitsPerMm,
        bristleInner: contactRadius - bristleDepth,
        bristleOuter: contactRadius,
        panelInner: contactRadius - bristleDepth - panelDepth,
        panelOuter: contactRadius - bristleDepth
      };
    }

    return {
      origin,
      unitsPerMm,
      bristleInner: contactRadius,
      bristleOuter: contactRadius + bristleDepth,
      panelInner: contactRadius + bristleDepth,
      panelOuter: contactRadius + bristleDepth + panelDepth
    };
  }

  function createBeveledBrushAssembly(THREE, item, geometry) {
    const bands = brushBands(item, geometry);
    const side = item?.side === "inner" ? "inner" : "outer";
    const spanRadians = Math.max(0.0001, number(item?.spanDegrees, 0.5) * Math.PI / 180);
    const height = BRUSH_HEIGHT_MM * bands.unitsPerMm;
    const group = new THREE.Group();
    group.name = `ServoForgeColdGlueBrush-${String(item?.id || "brush")}`;

    const bristleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.98,
      metalness: 0,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4045,
      roughness: 0.48,
      metalness: 0.42,
      emissive: 0x000000,
      emissiveIntensity: 0
    });

    const bristles = new THREE.Mesh(
      beveledAnnularPrismGeometry(THREE, {
        innerRadius: bands.bristleInner,
        outerRadius: bands.bristleOuter,
        originRadius: bands.origin,
        height,
        spanRadians,
        side
      }),
      bristleMaterial
    );
    bristles.name = "ServoForgeColdGlueBrushBristles";
    bristles.position.y = 0.60;
    bristles.castShadow = true;
    bristles.receiveShadow = true;
    group.add(bristles);

    const backPanel = new THREE.Mesh(
      beveledAnnularPrismGeometry(THREE, {
        innerRadius: bands.panelInner,
        outerRadius: bands.panelOuter,
        originRadius: bands.origin,
        height,
        spanRadians,
        side
      }),
      panelMaterial
    );
    backPanel.name = "ServoForgeColdGlueBrushBackPanel";
    backPanel.position.y = 0.60;
    backPanel.castShadow = true;
    backPanel.receiveShadow = true;
    group.add(backPanel);

    group.userData.hardwareReference = Object.freeze({
      profileId: "cold-glue-brush",
      dimensionalAuthority: false,
      shapeAuthority: "wipe-down-pad-curvature-with-side-specific-bevel",
      bevelOrientation: side === "inner" ? "inward" : "outward",
      backPanel: "dark-grey",
      curved: true
    });
    group.userData.highlightMaterials = [bristleMaterial, panelMaterial];
    group.userData.contactMaterials = [bristleMaterial];
    group.userData.backingMaterials = [panelMaterial];
    return group;
  }

  function install3DOverride() {
    const previousFactory = global.Labeler3DHardwareMeshFactory;
    if (!previousFactory || global.__ServoForgeColdGlueBrushBevelPanel3DInstalled) return;

    function createBrushAssembly(THREE, item, geometry) {
      return createBeveledBrushAssembly(THREE, item, geometry);
    }

    function createEquipmentAssembly(THREE, item, geometry) {
      if (item?.kind !== "brush" && item?.kind !== "brush-channel") {
        return previousFactory.createEquipmentAssembly?.(THREE, item, geometry) || null;
      }
      const group = createBeveledBrushAssembly(THREE, item, geometry);
      group.userData.kind = item?.kind;
      group.userData.station = item?.station;
      group.userData.section = item?.section;
      group.position.set(number(item?.position?.x), 0, number(item?.position?.z));
      group.rotation.y = number(item?.rotationY, -Math.atan2(number(item?.position?.z), number(item?.position?.x)));
      return group;
    }

    global.Labeler3DHardwareMeshFactory = Object.freeze({
      ...previousFactory,
      FACTORY_VERSION: `${previousFactory.FACTORY_VERSION || "servoforge.3d-hardware-mesh"}+brush-bevel-panel-v23`,
      createBrushAssembly,
      createEquipmentAssembly
    });
    global.__ServoForgeColdGlueBrushBevelPanel3DInstalled = true;
  }

  installTopDownOverride();
  install3DOverride();

  global.ServoForgeColdGlueBrushBevelBackPanel = Object.freeze({
    INTEGRATION_VERSION,
    beveledAnnularPath,
    beveledAnnularPrismGeometry,
    createBeveledBrushAssembly,
    installTopDownOverride,
    install3DOverride
  });
})(window);
