"use strict";

const WIPE_DOWN_PAD_WIDTH_MM = 22;
const WIPE_SPONGE_PATTERN_ID = "servoforge-wipe-sponge-pattern";
const ROLLER_SPONGE_PATTERN_ID = "servoforge-roller-sponge-pattern";

function mapUnitsPerMillimeter() {
  const referenceRadiusMm = Math.abs(num(state.referencePitchRadiusMm || state.tablePitchRadiusMm, 0));
  const mapRadius = Math.abs(num(state.radius, 0));
  if (!(referenceRadiusMm > 0) || !(mapRadius > 0)) return 1;
  return mapRadius / referenceRadiusMm;
}

function wipeDownPadWidthMapUnits() {
  return WIPE_DOWN_PAD_WIDTH_MM * mapUnitsPerMillimeter();
}

function ensureWipeComponentVisualDefs(add, parent) {
  const svg = parent?.ownerSVGElement || (String(parent?.tagName || "").toLowerCase() === "svg" ? parent : null);
  if (!svg || svg.querySelector(`#${WIPE_SPONGE_PATTERN_ID}`)) return;

  const defs = add("defs", { "data-wipe-component-materials": "sponge-v1" }, svg);

  const wipePattern = add("pattern", {
    id: WIPE_SPONGE_PATTERN_ID,
    patternUnits: "userSpaceOnUse",
    width: 7,
    height: 7
  }, defs);
  add("rect", { x: 0, y: 0, width: 7, height: 7, fill: "#ee7418" }, wipePattern);
  add("circle", { cx: 1.2, cy: 1.5, r: 0.85, fill: "#ffad55", "fill-opacity": 0.72 }, wipePattern);
  add("circle", { cx: 5.2, cy: 2.1, r: 1.05, fill: "#c74f0c", "fill-opacity": 0.58 }, wipePattern);
  add("circle", { cx: 3.4, cy: 5.3, r: 0.72, fill: "#ff9638", "fill-opacity": 0.68 }, wipePattern);
  add("circle", { cx: 6.5, cy: 6.1, r: 0.52, fill: "#9f3d09", "fill-opacity": 0.45 }, wipePattern);
  add("circle", { cx: 0.5, cy: 5.7, r: 0.48, fill: "#ffba6f", "fill-opacity": 0.5 }, wipePattern);

  const rollerPattern = add("pattern", {
    id: ROLLER_SPONGE_PATTERN_ID,
    patternUnits: "userSpaceOnUse",
    width: 6,
    height: 6
  }, defs);
  add("rect", { x: 0, y: 0, width: 6, height: 6, fill: "#969da4" }, rollerPattern);
  add("circle", { cx: 1.1, cy: 1.2, r: 0.72, fill: "#d5d9dd", "fill-opacity": 0.62 }, rollerPattern);
  add("circle", { cx: 4.4, cy: 1.8, r: 0.88, fill: "#697077", "fill-opacity": 0.55 }, rollerPattern);
  add("circle", { cx: 2.8, cy: 4.6, r: 0.65, fill: "#bcc2c7", "fill-opacity": 0.58 }, rollerPattern);
  add("circle", { cx: 5.6, cy: 5.2, r: 0.46, fill: "#5d646b", "fill-opacity": 0.48 }, rollerPattern);
}

function machineForwardPadPath(startAngle, endAngle, centerRadius, widthMapUnits) {
  const start = num(startAngle, 0);
  let end = num(endAngle, start);
  while (end < start) end += 360;

  const width = Math.max(1, num(widthMapUnits, wipeDownPadWidthMapUnits()));
  const innerRadius = Math.max(1, centerRadius - width / 2);
  const outerRadius = Math.max(innerRadius + 0.5, centerRadius + width / 2);
  const span = Math.max(0.1, end - start);
  const physicalBevelDeg = (width / Math.max(1, centerRadius)) * 180 / Math.PI * 0.8;
  const bevelDeg = Math.min(span * 0.38, Math.max(0.75, Math.min(5, physicalBevelDeg)));
  const innerForwardEnd = end - bevelDeg;

  const startOuter = angleToXY(start, outerRadius);
  const endOuter = angleToXY(end, outerRadius);
  const startInner = angleToXY(start, innerRadius);
  const endInner = angleToXY(innerForwardEnd, innerRadius);
  const largeOuter = span > 180 ? 1 : 0;
  const innerSpan = Math.max(0.1, innerForwardEnd - start);
  const largeInner = innerSpan > 180 ? 1 : 0;
  const sweepOuter = state.direction === "cw" ? 0 : 1;
  const sweepInner = sweepOuter ? 0 : 1;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeOuter} ${sweepOuter} ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeInner} ${sweepInner} ${startInner.x} ${startInner.y}`,
    "Z"
  ].join(" ");
}

function drawSpongeWipeDownPad(add, parent, item, centerRadius) {
  ensureWipeComponentVisualDefs(add, parent);
  const widthMapUnits = wipeDownPadWidthMapUnits();
  const d = machineForwardPadPath(item.start, item.end, centerRadius, widthMapUnits);
  const pad = add("path", {
    d,
    fill: `url(#${WIPE_SPONGE_PATTERN_ID})`,
    stroke: "#7d3511",
    "stroke-width": 1.1,
    "stroke-linejoin": "round",
    "data-wipe-down-pad": item.id,
    "data-pad-width-mm": WIPE_DOWN_PAD_WIDTH_MM,
    "data-sponge-material": "orange-foam",
    "data-bevel-facing": "machine-forward",
    "data-machine-direction": state.direction
  }, parent);
  add("path", {
    d,
    fill: "none",
    stroke: "#ffd09b",
    "stroke-width": 0.55,
    "stroke-opacity": 0.38,
    "pointer-events": "none"
  }, parent);
  return pad;
}

function drawSpongeRoller(add, parent, x, y, attributes = {}) {
  ensureWipeComponentVisualDefs(add, parent);
  const group = add("g", {
    transform: `translate(${x} ${y})`,
    "data-sponge-roller": "true"
  }, parent);
  const outer = add("circle", {
    cx: 0,
    cy: 0,
    r: 10,
    fill: `url(#${ROLLER_SPONGE_PATTERN_ID})`,
    stroke: "#d0d5da",
    "stroke-width": 1,
    ...attributes
  }, group);
  add("circle", {
    cx: 0,
    cy: 0,
    r: 4.2,
    fill: "#111417",
    stroke: "#050607",
    "stroke-width": 0.9,
    "data-roller-hub": "black"
  }, group);
  add("circle", {
    cx: -1.2,
    cy: -1.2,
    r: 1.15,
    fill: "#4b5157",
    "fill-opacity": 0.68,
    "pointer-events": "none"
  }, group);
  return outer;
}

window.LabelerWipeComponentVisualRenderer = Object.freeze({
  WIPE_DOWN_PAD_WIDTH_MM,
  mapUnitsPerMillimeter,
  wipeDownPadWidthMapUnits,
  machineForwardPadPath,
  drawSpongeWipeDownPad,
  drawSpongeRoller,
  spongeWipePadsV1: true,
  spongeRollersV1: true
});

function drawMapObjectLabel() {
  // Map labels are intentionally disabled. Object names remain available in the Map Builder.
}

function activeAggregateDefinitions() {
  const machineMap = activeMachineMap();
  if (!machineMap) return [];
  const enabled = normalizeEnabledSlots(machineMap.enabledAggregates, machineMap.aggregateCount);
  const angles = normalizeAggregateAngles(machineMap.aggregateAngles, machineMap.applicationMode, machineMap.objects);
  return enabled
    .map((isEnabled, index) => isEnabled ? { number: index + 1, angle: num(angles[String(index + 1)], 0) } : null)
    .filter(Boolean);
}

const AGGREGATE_CENTERLINE_MIN_GAP_DEG = 6;

function aggregateCenterlineGaps() {
  const aggregates = activeAggregateDefinitions()
    .map((aggregate) => ({ ...aggregate, angle: norm(aggregate.angle) }))
    .sort((a, b) => a.angle - b.angle || a.number - b.number);
  if (aggregates.length < 2) return [];
  return aggregates.map((aggregate, index) => {
    const next = aggregates[(index + 1) % aggregates.length];
    const endAngle = index === aggregates.length - 1 ? next.angle + 360 : next.angle;
    const gapDeg = endAngle - aggregate.angle;
    return {
      from: aggregate.number,
      to: next.number,
      startAngle: aggregate.angle,
      endAngle,
      gapDeg,
      wrapsToFirst: index === aggregates.length - 1,
      violatesMinimum: gapDeg < AGGREGATE_CENTERLINE_MIN_GAP_DEG
    };
  });
}

function drawIndependentAggregates(add, layer) {
  const machineSign = state.direction === "cw" ? 1 : -1;
  activeAggregateDefinitions().forEach((aggregate) => {
    const xy = angleToXY(aggregate.angle, state.radius + state.depths.spender);
    const rotation = angleToSvgRotation(aggregate.angle) + (state.applicationMode === "cold-glue" ? 90 : machineSign * SPENDER_PLATE_ARM_ANGLE);
    const group = add("g", { transform: `translate(${xy.x} ${xy.y}) rotate(${rotation})`, "data-aggregate-marker": aggregate.number }, layer);
    if (state.applicationMode === "cold-glue") {
      add("line", { x1: -9, y1: 0, x2: 9, y2: 0, stroke: "#d71920", "stroke-width": 3, "stroke-linecap": "round" }, group);
    } else {
      add("line", { x1: 0, y1: 0, x2: 30, y2: 0, stroke: "#d71920", "stroke-width": 4, "stroke-linecap": "round" }, group);
      add("circle", { cx: 0, cy: 0, r: 3, fill: "#d71920", stroke: "#ffffff", "stroke-width": 1 }, group);
    }
  });
}

function labelSensorMapStatus(item) {
  const station = Number(item.station);
  const section = state.motionPlan?.stationPlans?.find((plan) => Number(plan.station) === station)?.section || labelSectionForStation(station);
  if (!["neck", "body", "back"].includes(section)) return { color: "#e5d34b", percent: 0, required: Math.min(100, Math.max(1, num(item.requiredVisibilityPercent, 50))), passes: false };
  const seed = generatedAplSeedProfile();
  const targetIndex = section === "neck" ? 1 : section === "body" ? 11 : 21;
  const labelWidth = Math.min(360, Math.max(3, num(sectionWipePlan(section)?.labelDeg, 0)));
  const center = labelSensorInspectionCenter(section, num(seed[targetIndex]?.plateAngle, 0), labelWidth);
  const visibility = labelSensorVisibility(center, plateAngleAt(num(item.angle, item.start), state.program), labelWidth, 180);
  const required = Math.min(100, Math.max(1, num(item.requiredVisibilityPercent, 50)));
  const passes = visibility.percent + 0.001 >= required;
  return { color: passes ? "#25bf72" : item.servoAssist ? "#db4b4b" : "#e5d34b", percent: visibility.percent, required, passes };
}

function labelSensorMapColor(item) {
  return labelSensorMapStatus(item).color;
}

function drawConfiguredAssemblies(add, layer) {
  ensurePersistentApplicationMaps();
  ensureWipeComponentVisualDefs(add, layer);
  if (state.applicationMode === "cold-glue") {
    const brushFill = "#6f6688";
    const gripperHalfLength = 9;
    coldGlueMapObjects().forEach((raw) => {
      const item = { ...raw, kind: raw.kind === "wipe" ? "brush" : raw.kind };
      const objectLayer = add("g", { "data-map-object-id": item.id, class: state.selectedMapObjectId === item.id ? "map-object selected-map-object" : "map-object" }, layer);
      if (item.kind === "sensor") {
        const placement = num(item.angle, item.start);
        const centerRadius = state.radius + state.depths.opRoller + 7;
        add("path", { d: arcPath(placement - 1.5, placement + 1.5, centerRadius - 8, centerRadius + 8), fill: labelSensorMapColor(item), "fill-opacity": 0.62, stroke: "none", "data-label-sensor": item.id, "data-sensor-station": item.station }, objectLayer);
        drawMapObjectLabel(add, objectLayer, item, placement, centerRadius, 20);
        return;
      }
      if (item.kind === "coding") {
        const centerRadius = state.radius + state.depths.opRoller;
        add("path", { d: arcPath(num(item.start), num(item.end), centerRadius - 7, centerRadius + 7), fill: "#8f7a48", "fill-opacity": 0.62, stroke: "none", "data-coding-object": item.id }, objectLayer);
        drawMapObjectLabel(add, objectLayer, item, (num(item.start) + num(item.end)) / 2, centerRadius, 18);
        return;
      }
      if (item.kind === "gripper") {
        const angle = num(item.angle, item.start);
        if (!Number.isFinite(angle)) return;
        const duplicateAggregate = activeAggregateDefinitions().some((aggregate) => Math.abs(((aggregate.angle - angle + 540) % 360) - 180) < 0.25);
        if (duplicateAggregate) return;
        const xy = angleToXY(angle, state.radius + state.depths.spender);
        const rotation = angleToSvgRotation(angle) + 90;
        const group = add("g", { transform: `translate(${xy.x} ${xy.y}) rotate(${rotation})` }, objectLayer);
        add("line", { x1: -gripperHalfLength, y1: 0, x2: gripperHalfLength, y2: 0, stroke: "#9b5558", "stroke-width": 2.5, "stroke-linecap": "round", "data-cold-glue-gripper": item.id }, group);
        drawMapObjectLabel(add, objectLayer, item, angle, state.radius + state.depths.spender, 18);
        return;
      }
      if (item.kind === "roller") {
        const angle = num(item.angle, item.start);
        if (!Number.isFinite(angle)) return;
        const depth = item.side === "inner" ? state.depths.nonOpRoller : state.depths.opRoller;
        const xy = angleToXY(angle, state.radius + depth);
        drawSpongeRoller(add, objectLayer, xy.x, xy.y, { "data-cold-glue-roller": item.id });
        drawMapObjectLabel(add, objectLayer, item, angle, state.radius + depth, 17);
        return;
      }
      if (item.kind === "brush-channel") {
        const brushHalfWidth = Math.max(4, Math.min(7, num(item.extension, 20) / 4));
        const outerRadius = state.radius + state.depths.wipeOuter;
        const innerRadius = state.radius + state.depths.wipeInner;
        add("path", { d: arcPath(num(item.outerStart, item.start), num(item.outerEnd, item.end), outerRadius - brushHalfWidth, outerRadius + brushHalfWidth), fill: brushFill, "fill-opacity": 0.46, stroke: "none", "data-cold-glue-brush-channel": item.id, "data-channel-side": "outer" }, objectLayer);
        add("path", { d: arcPath(num(item.innerStart, item.start), num(item.innerEnd, item.end), innerRadius - brushHalfWidth, innerRadius + brushHalfWidth), fill: brushFill, "fill-opacity": 0.46, stroke: "none", "data-cold-glue-brush-channel": item.id, "data-channel-side": "inner" }, objectLayer);
        const labelAngle = (Math.min(num(item.outerStart, item.start), num(item.innerStart, item.start)) + Math.max(num(item.outerEnd, item.end), num(item.innerEnd, item.end))) / 2;
        drawMapObjectLabel(add, objectLayer, item, labelAngle, (outerRadius + innerRadius) / 2, brushHalfWidth + 13);
        return;
      }
      if (item.kind !== "brush") return;
      const depth = item.side === "inner" ? state.depths.wipeInner : state.depths.wipeOuter;
      const brushCenterRadius = state.radius + depth;
      // Brush extension is a physical setup value, not a literal SVG radial
      // thickness. Scale and cap the drawing so inside/outside brush channels
      // remain separate and bottles stay visible between them.
      const brushHalfWidth = Math.max(4, Math.min(7, num(item.extension, 20) / 4));
      add("path", { d: arcPath(num(item.start), num(item.end), brushCenterRadius - brushHalfWidth, brushCenterRadius + brushHalfWidth), fill: brushFill, "fill-opacity": 0.46, stroke: "none", "data-cold-glue-brush": item.id }, objectLayer);
      drawMapObjectLabel(add, objectLayer, item, (num(item.start) + num(item.end)) / 2, brushCenterRadius, brushHalfWidth + 13);
    });
    return;
  }

  state.aplMapObjects.forEach((raw) => {
    const item = normalizeBuilderObject(raw, "apl");
    const objectLayer = add("g", { "data-map-object-id": item.id, class: state.selectedMapObjectId === item.id ? "map-object selected-map-object" : "map-object" }, layer);
    const isInner = item.side === "inner";
    if (item.kind === "sensor") {
      const centerRadius = state.radius + state.depths.opRoller + 7;
      const placement = num(item.angle, item.start);
      add("path", {
        d: arcPath(placement - 1.5, placement + 1.5, centerRadius - 8, centerRadius + 8),
        fill: labelSensorMapColor(item), "fill-opacity": 0.62, stroke: "none",
        "data-label-sensor": item.id, "data-sensor-station": item.station
      }, objectLayer);
      drawMapObjectLabel(add, objectLayer, item, placement, centerRadius, 20);
      return;
    }
    if (item.kind === "coding") {
      const centerRadius = state.radius + state.depths.opRoller;
      add("path", { d: arcPath(num(item.start), num(item.end), centerRadius - 7, centerRadius + 7), fill: "#8f7a48", "fill-opacity": 0.62, stroke: "none", "data-coding-object": item.id }, objectLayer);
      drawMapObjectLabel(add, objectLayer, item, (num(item.start) + num(item.end)) / 2, centerRadius, 18);
      return;
    }
    if (item.kind === "roller") {
      const depth = isInner ? state.depths.nonOpRoller : state.depths.opRoller;
      const xy = angleToXY(item.start, state.radius + depth);
      drawSpongeRoller(add, objectLayer, xy.x, xy.y, {
        "data-apl-roller": item.id,
        "data-wipe-span": item.wipeSpanDeg
      });
      drawMapObjectLabel(add, objectLayer, item, item.start, state.radius + depth, 19);
      return;
    }
    const centerRadius = state.radius + (isInner ? state.depths.wipeInner : state.depths.wipeOuter);
    drawSpongeWipeDownPad(add, objectLayer, item, centerRadius);
    drawMapObjectLabel(add, objectLayer, item, (item.start + item.end) / 2, centerRadius, wipeDownPadWidthMapUnits() / 2 + 13);
  });
}
