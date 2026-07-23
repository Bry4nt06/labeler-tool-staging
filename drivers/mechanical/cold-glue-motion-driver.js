(function (global) {
  "use strict";

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeBrush(item, index) {
    const start = finite(item?.start, 0);
    const end = Math.max(start + 0.001, finite(item?.end, start + 1));
    const side = item?.side === "inner" ? "inner" : "outer";
    const role = ["process", "final", "hold"].includes(item?.role) ? item.role : "process";
    return {
      ...item,
      index,
      start,
      end,
      span: end - start,
      side,
      role,
      holdBottleAngle: Boolean(item?.holdBottleAngle),
      holdAngle: finite(item?.bottleHoldAngleDeg, 90),
      holdCurrent: Boolean(item?.holdCurrentBottleAngle),
      holdStart: Math.max(start, Math.min(end, finite(item?.bottleHoldStartDeg, start))),
      direction: side === "inner" ? 1 : -1,
      coveragePercent: Math.max(0, Math.min(100, finite(item?.coveragePercent, NaN)))
    };
  }

  function collapseSharedOppositeChannels(brushes) {
    const consumed = new Set();
    const channels = [];
    brushes.forEach((brush, index) => {
      if (consumed.has(index)) return;
      const oppositeIndex = brushes.findIndex((candidate, candidateIndex) =>
        candidateIndex !== index &&
        !consumed.has(candidateIndex) &&
        candidate.side !== brush.side &&
        Math.min(candidate.end, brush.end) > Math.max(candidate.start, brush.start) + 0.001
      );
      if (oppositeIndex < 0) {
        channels.push(brush);
        consumed.add(index);
        return;
      }
      const opposite = brushes[oppositeIndex];
      consumed.add(index);
      consumed.add(oppositeIndex);
      const start = Math.max(brush.start, opposite.start);
      const end = Math.min(brush.end, opposite.end);
      channels.push({
        ...brush,
        id: `${brush.id || index}+${opposite.id || oppositeIndex}`,
        start,
        end,
        span: end - start,
        role: brush.role === "final" || opposite.role === "final" ? "final" : "process",
        coveragePercent: Number.isFinite(brush.coveragePercent) ? brush.coveragePercent : opposite.coveragePercent,
        pairedOppositeChannel: true
      });
    });
    return channels.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  function flowFacingTarget(applicationPlateDeg, mapDirection = "cw", labelDeg = 0) {
    if (finite(labelDeg, 0) >= 330) return 0;
    // Cold Glue only: the bottle must enter a brush channel with the freshly
    // tacked label edge pointing downstream. Plate angle is relative to the
    // rotating table, so the downstream tangent is a fixed quarter-turn from
    // the radial zero. Do not add the application plate angle here: doing that
    // carries the pickup/application offset into the channel and can present the
    // loose label edge upstream, allowing the first brush to peel the label off.
    //
    // The map renderer's positive table direction is opposite the plate-axis
    // sign, therefore CCW bottle flow requires +90 deg plate orientation and CW
    // bottle flow requires -90 deg.
    void applicationPlateDeg;
    return mapDirection === "ccw" ? 90 : -90;
  }

  function applicationTarget(baseTargetDeg, mapDirection = "cw", labelDeg = 0) {
    // The gripper/spender is the radial zero reference. Every Cold Glue label
    // must be center-tacked while the bottle face points directly at it.
    void baseTargetDeg;
    void mapDirection;
    void labelDeg;
    return 0;
  }

  function maximumWipeAcrossWindows(windows, maxRatio) {
    const plannedRatio = Math.max(0.01, maxRatio - 0.1);
    return windows
      .filter((window) => window.span > 0.001 && window.role !== "hold")
      .map((window) => ({
        ...window,
        rotation: window.span * plannedRatio,
        ratio: plannedRatio,
        direction: window.side === "inner" ? 1 : -1,
        rotationSense: window.side === "inner" ? "counter-clockwise" : "clockwise"
      }));
  }

  function brushEntryTarget(opposedHoldAngleDeg, firstHalfRotationDeg, firstHalfDirection) {
    // Enter the first one-sided brush early enough that its half-label turn
    // finishes exactly perpendicular to the opposed brush channel.
    return finite(opposedHoldAngleDeg, 90)
      - finite(firstHalfDirection, 0) * finite(firstHalfRotationDeg, 0);
  }

  function createPlan(options) {
    const labelDeg = Math.max(0, finite(options?.labelDeg, 0));
    const overWipeDeg = Math.max(0, finite(options?.overWipeDeg, 0));
    const fullWrap = labelDeg >= 330;
    const mapDirection = options?.mapDirection === "ccw" ? "ccw" : "cw";
    const maxRatio = Math.max(0.1, finite(options?.maxRatio, 21));
    const normalizedBrushes = (Array.isArray(options?.brushes) ? options.brushes : [])
      .map(normalizeBrush)
      .filter((brush) => brush.end > brush.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const holds = [];
    const wipeBrushes = normalizedBrushes.flatMap((brush) => {
      if (brush.role === "hold") {
        holds.push({ ...brush, start: brush.start, end: brush.end, span: brush.span });
        return [];
      }
      if (!brush.holdBottleAngle) return [brush];
      if (brush.holdStart < brush.end - 0.001) holds.push({ ...brush, start: brush.holdStart, end: brush.end, span: brush.end - brush.holdStart });
      return brush.holdStart > brush.start + 0.001 ? [{ ...brush, end: brush.holdStart, span: brush.holdStart - brush.start }] : [];
    });
    const hasSharedOppositeChannel = wipeBrushes.some((brush, index) => wipeBrushes.some((candidate, candidateIndex) =>
      candidateIndex !== index &&
      candidate.side !== brush.side &&
      Math.min(candidate.end, brush.end) > Math.max(candidate.start, brush.start) + 0.001
    ));
    const brushes = hasSharedOppositeChannel ? collapseSharedOppositeChannels(wipeBrushes) : wipeBrushes;
    // Every Cold Glue label is center-tacked at the aggregate. The two loose
    // halves must therefore be wiped in opposite plate directions regardless
    // of whether the label is a full neck wrap or a shorter body/back label.
    const centerTackTwoSided = labelDeg > 0;
    const simultaneousOppositeWipe = hasSharedOppositeChannel;
    // The center is already attached, so the two opposite wipe directions
    // divide the developed label length exactly in half.
    const totalRotation = centerTackTwoSided ? labelDeg : simultaneousOppositeWipe ? labelDeg / 2 + overWipeDeg : labelDeg + overWipeDeg * 2;
    const defaultPartialPercent = Math.max(5, Math.min(95, finite(options?.partialCoveragePercent, 50)));
    if (simultaneousOppositeWipe) {
      const direction = mapDirection === "ccw" ? 1 : -1;
      brushes.forEach((brush) => { brush.direction = direction; });
    }

    const issues = [];
    if (!brushes.length) {
      return { labelDeg, overWipeDeg, totalRotation, process: [], final: [], holds, issues: holds.length ? [] : [{ level: "bad", code: "cold-glue-no-brushes", message: "No brush windows are assigned to this Cold Glue station." }] };
    }

    let finalBrushes = brushes.filter((brush) => brush.role === "final");
    let processBrushes = brushes.filter((brush) => brush.role === "process");
    if (!finalBrushes.length) {
      finalBrushes = [brushes[brushes.length - 1]];
      processBrushes = brushes.slice(0, -1).filter((brush) => brush.role !== "hold");
    }
    if (!processBrushes.length && brushes.length > 1) processBrushes = brushes.slice(0, -1);

    const explicitProcessPercent = processBrushes
      .filter((brush) => Number.isFinite(brush.coveragePercent))
      .reduce((sum, brush) => sum + brush.coveragePercent, 0);
    const partialPercent = centerTackTwoSided ? 50 : explicitProcessPercent > 0 ? Math.max(5, Math.min(95, explicitProcessPercent)) : defaultPartialPercent;
    const processRequired = totalRotation * partialPercent / 100;
    const finalRequired = Math.max(0, totalRotation - processRequired);

    const processAllocations = maximumWipeAcrossWindows(processBrushes, maxRatio);
    const finalAllocations = maximumWipeAcrossWindows(finalBrushes, maxRatio);

    return {
      labelDeg,
      overWipeDeg,
      totalRotation,
      fullWrap,
      centerTackTwoSided,
      simultaneousOppositeWipe,
      brushEntryLeadDeg: fullWrap ? 10 : 0,
      finalPlateTravel: centerTackTwoSided ? 0 : (mapDirection === "ccw" ? 1 : -1) * totalRotation,
      partialCoveragePercent: partialPercent,
      processRequired,
      finalRequired,
      process: processAllocations,
      final: finalAllocations,
      holds,
      issues
    };
  }

  global.LabelerColdGlueMotionDriver = { createPlan, flowFacingTarget, applicationTarget, brushEntryTarget };
})(window);
