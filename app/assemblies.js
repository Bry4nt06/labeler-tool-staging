"use strict";

function normalizeAssembly(assembly) {
  const normalized = { ...assembly };
  if (normalized.type === "inner-pads") {
    normalized.type = "pads";
    normalized.sides = ["inner"];
  }
  if (!Array.isArray(normalized.sides)) {
    const legacySide = String(normalized.side || "").toLowerCase();
    normalized.sides = legacySide.includes("inner") ? ["inner"] : legacySide.includes("outer") ? ["outer"] : [];
  }
  normalized.sides = [...new Set(normalized.sides.filter((side) => side === "inner" || side === "outer"))];
  if (!normalized.type || normalized.type === "none" || !normalized.sides.length) {
    normalized.type = "none";
    normalized.sides = [];
  }
  const fallback = defaultAssemblies[Math.max(0, Math.min(defaultAssemblies.length - 1, Number(normalized.station || 1) - 1))];
  normalized.spenderAngle = num(normalized.spenderAngle, fallback.spenderAngle);
  normalized.innerRollerAngles = Array.isArray(normalized.innerRollerAngles) ? normalized.innerRollerAngles.slice(0, 2).map((v, i) => num(v, fallback.innerRollerAngles[i])) : [...fallback.innerRollerAngles];
  normalized.outerRollerAngles = Array.isArray(normalized.outerRollerAngles) ? normalized.outerRollerAngles.slice(0, 2).map((v, i) => num(v, fallback.outerRollerAngles[i])) : [...fallback.outerRollerAngles];
  while (normalized.innerRollerAngles.length < 2) normalized.innerRollerAngles.push(fallback.innerRollerAngles[normalized.innerRollerAngles.length]);
  while (normalized.outerRollerAngles.length < 2) normalized.outerRollerAngles.push(fallback.outerRollerAngles[normalized.outerRollerAngles.length]);
  normalized.padSpanDeg = num(normalized.padSpanDeg, Math.max(1, num(normalized.endAngle, fallback.brushEndAngle) - num(normalized.startAngle, fallback.brushStartAngle)));
  normalized.padSideOffsetDeg = Math.max(0, num(normalized.padSideOffsetDeg, num(fallback.padSideOffsetDeg, 3)));
  normalized.brushStartAngle = num(normalized.brushStartAngle, num(normalized.startAngle, fallback.brushStartAngle));
  normalized.brushEndAngle = num(normalized.brushEndAngle, num(normalized.endAngle, fallback.brushEndAngle));
  const brushMid = (normalized.brushStartAngle + normalized.brushEndAngle) / 2;
  const fallbackOuterBrush = [normalized.brushStartAngle, brushMid];
  const fallbackInnerBrush = [brushMid, normalized.brushEndAngle];
  normalized.outerBrushAngles = Array.isArray(normalized.outerBrushAngles) ? normalized.outerBrushAngles.slice(0, 2).map((v, i) => num(v, fallbackOuterBrush[i])) : fallbackOuterBrush;
  normalized.innerBrushAngles = Array.isArray(normalized.innerBrushAngles) ? normalized.innerBrushAngles.slice(0, 2).map((v, i) => num(v, fallbackInnerBrush[i])) : fallbackInnerBrush;
  while (normalized.outerBrushAngles.length < 2) normalized.outerBrushAngles.push(fallbackOuterBrush[normalized.outerBrushAngles.length]);
  while (normalized.innerBrushAngles.length < 2) normalized.innerBrushAngles.push(fallbackInnerBrush[normalized.innerBrushAngles.length]);
  normalized.brushStartAngle = Math.min(...normalized.outerBrushAngles, ...normalized.innerBrushAngles);
  normalized.brushEndAngle = Math.max(...normalized.outerBrushAngles, ...normalized.innerBrushAngles);
  return normalized;
}

function mmToTableDegrees(mm) {
  const radius = Math.max(0.001, num(state.tablePitchRadiusMm, 572.958));
  return (num(mm) / radius) * (180 / Math.PI);
}

function padStartAngle(assembly) {
  return num(assembly.spenderAngle) + mmToTableDegrees(state.padClearanceMm);
}

function padAnglesForSide(assembly, side = "outer") {
  const baseStart = padStartAngle(assembly);
  const bothSelected = assembly.sides?.includes("outer") && assembly.sides?.includes("inner");
  const offset = bothSelected && side === "inner" ? Math.max(0, num(assembly.padSideOffsetDeg, 3)) : 0;
  const start = baseStart + offset;
  return [start, start + Math.max(0.1, num(assembly.padSpanDeg, 20))];
}

function padProfileTableAngles(station) {
  const assembly = normalizeAssembly(state.assemblies.find((entry) => Number(entry.station) === Number(station)) || defaultAssemblies[station - 1]);
  if (assembly.type !== "pads" || !assembly.sides.length) {
    const start = mapPointAngle(new RegExp(`Agg ${station} .*Start`, "i"));
    const stop = mapPointAngle(new RegExp(`Agg ${station} .*Stop`, "i"), start + 20);
    return [start, Math.min(stop, start + profileTiming.wipe1Duration), stop, stop + 0.5];
  }
  const outer = assembly.sides.includes("outer") ? padAnglesForSide(assembly, "outer") : null;
  const inner = assembly.sides.includes("inner") ? padAnglesForSide(assembly, "inner") : null;
  if (outer && inner) {
    return [outer[0], inner[0], inner[1], Math.max(outer[1], inner[1]) + 0.5];
  }
  const window = outer || inner;
  return [window[0], Math.min(window[1], window[0] + profileTiming.wipe1Duration), window[1], window[1] + 0.5];
}

function assemblyAngles(assembly, side = null) {
  if (assembly.type === "rollers") {
    const sides = side ? [side] : assembly.sides;
    return sides.flatMap((position) => position === "inner" ? assembly.innerRollerAngles : assembly.outerRollerAngles).filter(Number.isFinite);
  }
  if (assembly.type === "pads") {
    const sides = side ? [side] : assembly.sides;
    return sides.flatMap((position) => padAnglesForSide(assembly, position)).filter(Number.isFinite);
  }
  if (assembly.type === "brushes") {
    const sides = side ? [side] : assembly.sides;
    return sides.flatMap((position) => position === "inner" ? assembly.innerBrushAngles : assembly.outerBrushAngles).filter(Number.isFinite);
  }
  return [];
}

function assemblySpan(assembly) {
  const angles = assemblyAngles(assembly);
  return angles.length ? Math.max(...angles) - Math.min(...angles) : 0;
}

function syncMapPointsFromAssemblies() {
  if (state.applicationMode === "cold-glue") return;
  state.assemblies.forEach((raw) => {
    const assembly = normalizeAssembly(raw);
    const station = assembly.station;
    const spender = state.mapPoints.find((point) => new RegExp(`Agg ${station} Spender`, "i").test(point.name));
    if (spender) spender.angle = assembly.spenderAngle;

    const rollerPoints = state.mapPoints.filter((point) => new RegExp(`Agg ${station} Roller`, "i").test(point.name));
    const rollerAngles = [...assembly.outerRollerAngles, ...assembly.innerRollerAngles];
    rollerPoints.forEach((point, index) => {
      if (Number.isFinite(rollerAngles[index])) point.angle = rollerAngles[index];
    });

    const startPoint = state.mapPoints.find((point) => new RegExp(`Agg ${station} .*Start`, "i").test(point.name));
    const stopPoint = state.mapPoints.find((point) => new RegExp(`Agg ${station} .*Stop`, "i").test(point.name));
    if (assembly.type === "brushes") {
      if (startPoint) startPoint.angle = assembly.brushStartAngle;
      if (stopPoint) stopPoint.angle = assembly.brushEndAngle;
    } else {
      if (startPoint) startPoint.angle = padAnglesForSide(assembly, /Inner/i.test(startPoint.name) ? "inner" : "outer")[0];
      if (stopPoint) stopPoint.angle = padAnglesForSide(assembly, /Inner/i.test(stopPoint.name) ? "inner" : "outer")[1];
    }
  });
}

function mapPointStation(name) {
  const match = String(name || "").match(/Agg\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}


function assemblyRequiredRatio(assembly) {
  const span = assemblySpan(assembly);
  return span > 0 ? Math.abs(num(assembly.requiredPlateRotation)) / span : Infinity;
}

function assemblyStatus(assembly) {
  if (!assembly.enabled || assembly.type === "none" || !assembly.sides?.length) return { level: "off", text: "Removed", ratio: 0 };
  const span = assemblySpan(assembly);
  const ratio = assemblyRequiredRatio(assembly);
  if (span <= 0) return { level: "bad", text: "Invalid contact distance", ratio };
  if (ratio >= state.maxMoveRatio) return { level: "bad", text: `Servo fault (${fmt(ratio, 2)}:1)`, ratio };
  if (ratio >= state.maxMoveRatio * 0.85) return { level: "warn", text: `Near limit (${fmt(ratio, 2)}:1)`, ratio };
  return { level: "ok", text: `Optimized (${fmt(ratio, 2)}:1)`, ratio };
}

function assemblyTypeLabel(type) {
  return ({ rollers: "Rollers", pads: "Wipe-down pads", brushes: "Brushes", none: "Removed" })[type] || type;
}

function assemblyPositionLabel(assembly) {
  const sides = assembly.sides || [];
  if (sides.length === 2) return "Inner + outer";
  if (sides[0] === "inner") return "Inner";
  if (sides[0] === "outer") return "Outer";
  return "Select assembly";
}


function assemblySelectValue(assembly) {
  if (!assembly.enabled || assembly.type === "none" || !assembly.sides?.length) return "none";
  const hasInner = assembly.sides.includes("inner");
  const hasOuter = assembly.sides.includes("outer");
  const position = hasInner && hasOuter ? "both" : hasInner ? "inner" : "outer";
  return `${assembly.type}:${position}`;
}
