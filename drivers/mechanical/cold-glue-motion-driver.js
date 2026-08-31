(function (global) {
  "use strict";

  const EPSILON = 0.001;

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizedDirection(value) {
    return String(value || "").toLowerCase() === "ccw" ? "ccw" : "cw";
  }

  // ServoForge preserves the legacy map token convention where the stored
  // machine direction is the inverse of the physical bottle-table travel.
  // Keep that translation here so every Cold Glue wipe uses one physical
  // direction authority instead of reinterpreting the stored token locally.
  function physicalMachineDirection(value = "cw") {
    return normalizedDirection(value) === "cw" ? "ccw" : "cw";
  }

  function flowFacingTarget(applicationPlateDeg, mapDirection = "cw", labelDeg = 0) {
    if (finite(labelDeg, 0) >= 330) return 0;
    void applicationPlateDeg;
    return normalizedDirection(mapDirection) === "ccw" ? 90 : -90;
  }

  function channelEntryAngle(mapDirection = "cw", labelDeg = 0) {
    return flowFacingTarget(0, mapDirection, labelDeg);
  }

  function wipeDirectionForSide(side, mapDirection = "cw") {
    const physicalDirection = physicalMachineDirection(mapDirection);
    const outerDirection = physicalDirection === "cw" ? 1 : -1;
    return side === "inner" ? -outerDirection : outerDirection;
  }

  function applicationTarget(baseTargetDeg, mapDirection = "cw", labelDeg = 0) {
    if (finite(labelDeg, 0) >= 330) return normalizedDirection(mapDirection) === "ccw" ? 120 : -120;
    return finite(baseTargetDeg, 0);
  }

  function normalizeBrush(item, index) {
    const start = finite(item?.start, 0);
    const end = Math.max(start + EPSILON, finite(item?.end, start + 1));
    const side = item?.side === "inner" ? "inner" : "outer";
    return {
      ...item,
      id: item?.id || `brush-${index + 1}`,
      start,
      end,
      span: end - start,
      side,
      holdBottleAngle: Boolean(item?.holdBottleAngle),
      holdAngle: finite(item?.bottleHoldAngleDeg, NaN),
      holdCurrent: Boolean(item?.holdCurrentBottleAngle),
      holdStart: Math.max(start, Math.min(end, finite(item?.bottleHoldStartDeg, start)))
    };
  }

  function segmentChannel(channel, mapDirection, labelDeg, channelIndex) {
    const outerStart = finite(channel?.outerStart, channel?.start);
    const outerEnd = Math.max(outerStart, finite(channel?.outerEnd, channel?.end));
    const innerStart = finite(channel?.innerStart, channel?.start);
    const innerEnd = Math.max(innerStart, finite(channel?.innerEnd, channel?.end));
    const channelStart = Math.min(outerStart, innerStart);
    const channelEnd = Math.max(outerEnd, innerEnd);
    const holdStart = Math.max(channelStart, Math.min(channelEnd, finite(channel?.bottleHoldStartDeg, channelStart)));
    const entryAngle = channelEntryAngle(mapDirection, labelDeg);
    const channelId = channel?.id || `brush-channel-${channelIndex + 1}`;
    const points = [...new Set([
      outerStart, outerEnd, innerStart, innerEnd,
      ...(channel?.holdBottleAngle ? [holdStart] : [])
    ])].sort((a, b) => a - b);
    const segments = [];

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (end <= start + EPSILON) continue;
      const middle = (start + end) / 2;
      const outerActive = middle >= outerStart - EPSILON && middle <= outerEnd + EPSILON;
      const innerActive = middle >= innerStart - EPSILON && middle <= innerEnd + EPSILON;
      const configuredHold = Boolean(channel?.holdBottleAngle) && middle >= holdStart - EPSILON;
      if (!outerActive && !innerActive) continue;

      if (configuredHold || (outerActive && innerActive)) {
        segments.push({
          id: channelId,
          brushIds: [channelId],
          key: `channel-${channelIndex}-${index}`,
          stage: "opposed",
          start,
          end,
          span: end - start,
          rotation: 0,
          ratio: 0,
          direction: 0,
          holdAngle: configuredHold && Number.isFinite(Number(channel?.bottleHoldAngleDeg))
            ? finite(channel.bottleHoldAngleDeg, entryAngle)
            : entryAngle,
          holdCurrent: configuredHold && Boolean(channel?.holdCurrentBottleAngle),
          configuredHold,
          parallelBrushHold: outerActive && innerActive
        });
      } else {
        const side = outerActive ? "outer" : "inner";
        segments.push({
          id: channelId,
          brushIds: [channelId],
          key: `channel-${channelIndex}-${index}`,
          stage: side,
          side,
          start,
          end,
          span: end - start,
          direction: wipeDirectionForSide(side, mapDirection),
          rotation: 0,
          ratio: 0,
          singleSideOpening: true
        });
      }
    }
    return segments;
  }

  function segmentBrushes(brushes, mapDirection, labelDeg) {
    const normalized = (Array.isArray(brushes) ? brushes : [])
      .map(normalizeBrush)
      .filter((brush) => brush.end > brush.start + EPSILON);
    const entryAngle = channelEntryAngle(mapDirection, labelDeg);
    const points = [...new Set(normalized.flatMap((brush) => [
      brush.start,
      brush.end,
      ...(brush.holdBottleAngle ? [brush.holdStart] : [])
    ]))].sort((a, b) => a - b);
    const segments = [];

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (end <= start + EPSILON) continue;
      const middle = (start + end) / 2;
      const active = normalized.filter((brush) => middle >= brush.start - EPSILON && middle <= brush.end + EPSILON);
      if (!active.length) continue;
      const outer = active.filter((brush) => brush.side === "outer");
      const inner = active.filter((brush) => brush.side === "inner");
      const configuredHoldBrush = active.find((brush) => brush.holdBottleAngle && middle >= brush.holdStart - EPSILON);
      const brushIds = active.map((brush) => brush.id);

      if (configuredHoldBrush || (outer.length && inner.length)) {
        segments.push({
          id: brushIds.join("+"),
          brushIds,
          key: `brushes-${index}`,
          stage: "opposed",
          start,
          end,
          span: end - start,
          rotation: 0,
          ratio: 0,
          direction: 0,
          holdAngle: configuredHoldBrush && Number.isFinite(configuredHoldBrush.holdAngle)
            ? configuredHoldBrush.holdAngle
            : entryAngle,
          holdCurrent: Boolean(configuredHoldBrush?.holdCurrent),
          configuredHold: Boolean(configuredHoldBrush),
          parallelBrushHold: Boolean(outer.length && inner.length)
        });
      } else {
        const side = outer.length ? "outer" : "inner";
        segments.push({
          id: brushIds.join("+"),
          brushIds,
          key: `brushes-${index}`,
          stage: side,
          side,
          start,
          end,
          span: end - start,
          direction: wipeDirectionForSide(side, mapDirection),
          rotation: 0,
          ratio: 0,
          singleSideOpening: true
        });
      }
    }
    return segments;
  }

  function allocateAcrossWindows(required, windows, maxRatio, safetyFactor) {
    let remaining = Math.max(0, finite(required, 0));
    const allocations = [];
    const totalSpan = windows.reduce((sum, window) => sum + Math.max(0, finite(window.span, window.end - window.start)), 0);
    const requestedRatio = totalSpan > EPSILON ? remaining / totalSpan : 0;
    const safeRatio = Math.max(0.1, finite(maxRatio, 21)) * Math.max(0.25, Math.min(0.98, finite(safetyFactor, 0.9)));

    windows.forEach((window) => {
      const span = Math.max(EPSILON, finite(window.span, window.end - window.start));
      const rotation = Math.min(remaining, span * Math.min(requestedRatio, safeRatio));
      allocations.push({ ...window, rotation, ratio: rotation / span });
      remaining -= rotation;
    });

    if (remaining > EPSILON) {
      for (const allocation of allocations) {
        const capacity = allocation.span * safeRatio;
        const spare = Math.max(0, capacity - allocation.rotation);
        const added = Math.min(spare, remaining);
        allocation.rotation += added;
        allocation.ratio = allocation.rotation / allocation.span;
        remaining -= added;
        if (remaining <= EPSILON) break;
      }
    }
    return { allocations, remaining: Math.max(0, remaining), requestedRatio, safeRatio };
  }

  function planSegments(options, rawSegments, source) {
    const labelDeg = Math.max(0, finite(options?.labelDeg, 0));
    const overWipeDeg = Math.max(0, finite(options?.overWipeDeg, 0));
    const mapDirection = normalizedDirection(options?.mapDirection);
    const maxRatio = Math.max(0.1, finite(options?.maxRatio, 21));
    const safetyFactor = Math.max(0.25, Math.min(0.98, finite(options?.safetyFactor, 0.9)));
    const segments = rawSegments.slice().sort((a, b) => a.start - b.start || a.end - b.end);
    const openSegments = segments.filter((segment) => segment.stage === "outer" || segment.stage === "inner");
    const issues = [];
    const allocationByKey = new Map();
    const phasePlans = [];

    let phase = null;
    openSegments.forEach((segment) => {
      if (!phase || phase.side !== segment.side) {
        phase = { side: segment.side, windows: [] };
        phasePlans.push(phase);
      }
      phase.windows.push(segment);
    });

    phasePlans.forEach((phasePlan, phaseIndex) => {
      const requiredRotation = phaseIndex === 0
        ? Math.max(0, labelDeg / 2 + overWipeDeg)
        : Math.max(0, labelDeg + overWipeDeg * 2);
      const allocation = allocateAcrossWindows(requiredRotation, phasePlan.windows, maxRatio, safetyFactor);
      allocation.allocations.forEach((window) => allocationByKey.set(window.key, {
        ...window,
        direction: wipeDirectionForSide(phasePlan.side, mapDirection),
        centerTackStage: phaseIndex === 0 ? "center-to-first-edge" : "edge-to-opposite-edge",
        wipeOutward: true,
        leadingEdgeWipe: false,
        tackMode: "center"
      }));
      phasePlan.requiredRotation = requiredRotation;
      phasePlan.remaining = allocation.remaining;
      phasePlan.ratio = allocation.requestedRatio;
      if (allocation.remaining > EPSILON) {
        issues.push({
          level: "bad",
          code: "cold-glue-channel-capacity",
          side: phasePlan.side,
          message: `${phasePlan.side === "outer" ? "Outside" : "Inside"} brush opening is short by ${allocation.remaining.toFixed(1)} deg of bottle rotation.`
        });
      }
    });

    const channelMoves = segments.map((segment) => {
      if (segment.stage === "opposed") return {
        ...segment,
        rotation: 0,
        ratio: 0,
        direction: 0,
        leadingEdgeWipe: false,
        tackMode: "center",
        centerOutFromApplication: true
      };
      return allocationByKey.get(segment.key) || {
        ...segment,
        rotation: 0,
        ratio: 0,
        direction: wipeDirectionForSide(segment.side, mapDirection),
        leadingEdgeWipe: false,
        tackMode: "center",
        centerOutFromApplication: true
      };
    });

    const totalRotation = channelMoves.reduce((sum, move) => sum + Math.max(0, finite(move.rotation, 0)), 0);
    const signedRotation = channelMoves.reduce((sum, move) => sum + finite(move.direction, 0) * Math.max(0, finite(move.rotation, 0)), 0);
    const opposed = channelMoves.filter((move) => move.stage === "opposed");
    const process = openSegments.length ? channelMoves.filter((move) => move.stage !== "opposed" && move.side === openSegments[0].side) : [];
    const final = channelMoves.filter((move) => move.stage !== "opposed" && !process.includes(move));

    return {
      source,
      labelDeg,
      overWipeDeg,
      totalRotation,
      fullWrap: labelDeg >= 330,
      centerTackTwoSided: true,
      simultaneousOppositeWipe: opposed.some((move) => move.parallelBrushHold),
      brushEntryLeadDeg: 0,
      channelEntryAngle: channelEntryAngle(mapDirection, labelDeg),
      finalPlateTravel: signedRotation,
      channelMoves,
      process,
      final,
      holds: opposed,
      phasePlans,
      issues,
      leadingEdgeWipe: false,
      tackMode: "center"
    };
  }

  function createBrushChannelPlan(options) {
    const mapDirection = normalizedDirection(options?.mapDirection);
    const labelDeg = Math.max(0, finite(options?.labelDeg, 0));
    const channels = Array.isArray(options?.channels) ? options.channels : [];
    const segments = channels.flatMap((channel, index) => segmentChannel(channel, mapDirection, labelDeg, index));
    if (!segments.length) {
      return {
        labelDeg,
        overWipeDeg: Math.max(0, finite(options?.overWipeDeg, 0)),
        totalRotation: 0,
        channelMoves: [],
        process: [],
        final: [],
        holds: [],
        issues: [{ level: "bad", code: "cold-glue-no-brushes", message: "No brush channel windows are assigned to this Cold Glue station." }],
        leadingEdgeWipe: false,
        tackMode: "center"
      };
    }
    return planSegments(options, segments, "cold-glue-brush-channel");
  }

  function createPlan(options) {
    const mapDirection = normalizedDirection(options?.mapDirection);
    const labelDeg = Math.max(0, finite(options?.labelDeg, 0));
    const brushes = Array.isArray(options?.brushes) ? options.brushes : [];
    const segments = segmentBrushes(brushes, mapDirection, labelDeg);
    if (!segments.length) {
      return {
        labelDeg,
        overWipeDeg: Math.max(0, finite(options?.overWipeDeg, 0)),
        totalRotation: 0,
        channelMoves: [],
        process: [],
        final: [],
        holds: [],
        issues: [{ level: "bad", code: "cold-glue-no-brushes", message: "No brush windows are assigned to this Cold Glue station." }],
        leadingEdgeWipe: false,
        tackMode: "center"
      };
    }
    return planSegments(options, segments, "cold-glue-brush-pair");
  }

  global.LabelerColdGlueMotionDriver = Object.freeze({
    createPlan,
    createBrushChannelPlan,
    flowFacingTarget,
    channelEntryAngle,
    physicalMachineDirection,
    wipeDirectionForSide,
    applicationTarget,
    centerTackOnly: true,
    leadingEdgeWipeAllowed: false,
    parallelOverlapTurnsBottle: false,
    channelRunoutWipeAuthority: true
  });
})(window);
