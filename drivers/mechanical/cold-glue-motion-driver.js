(function (global) {
  "use strict";

  const EPSILON = 0.001;
  const DEFAULT_LABEL_EDGE_GUARD_DEG = 3;

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
    // Aggregate application is an absolute bottle center-line reference:
    // Neck/Body 0°, Back 180°. Map direction and wrap length affect the
    // downstream brush wipe, never the aggregate application datum itself.
    void mapDirection;
    void labelDeg;
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

  function normalizeOverlapEdge(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    if (normalized === "leading" || normalized === "leading-edge") return "leading";
    if (normalized === "trailing" || normalized === "trailing-edge") return "trailing";
    return null;
  }

  function normalizedWrapPlan(options, labelDeg) {
    const supplied = options?.wrapPlan && typeof options.wrapPlan === "object" ? options.wrapPlan : {};
    const resolvedMode = supplied.resolvedMode === "full-wrap-overlap" || options?.wrapMode === "full-wrap-overlap"
      ? "full-wrap-overlap"
      : "standard";
    const overlapEdge = normalizeOverlapEdge(supplied.overlapEdge ?? options?.overlapEdge);
    const targetOverlapDeg = Math.max(0, finite(supplied.targetOverlapDeg ?? options?.targetOverlapDeg, Math.max(0, labelDeg - 360)));
    const motionWrapAngleDeg = Math.max(0, finite(supplied.motionWrapAngleDeg ?? options?.motionWrapAngleDeg, 360 + targetOverlapDeg));
    const seamWipeEnabled = supplied.seamWipeEnabled !== false && options?.seamWipeEnabled !== false;
    const seamOverWipeDeg = seamWipeEnabled
      ? Math.min(45, Math.max(0, finite(supplied.seamOverWipeDeg ?? options?.seamOverWipeDeg, 5)))
      : 0;
    const fullWrapReady = resolvedMode === "full-wrap-overlap"
      && Boolean(overlapEdge)
      && targetOverlapDeg > EPSILON;
    const issues = [...(Array.isArray(supplied.issues) ? supplied.issues : [])];
    if (resolvedMode === "full-wrap-overlap" && !overlapEdge && !issues.some((issue) => issue?.code === "neck-wrap-overlap-edge-required")) {
      issues.push({ level: "bad", code: "neck-wrap-overlap-edge-required", message: "Select the leading or trailing overlap edge before the full-wrap seam crossing is enabled." });
    }
    if (resolvedMode === "full-wrap-overlap" && targetOverlapDeg <= EPSILON && !issues.some((issue) => issue?.code === "neck-wrap-positive-overlap-required")) {
      issues.push({ level: "bad", code: "neck-wrap-positive-overlap-required", message: "Full-wrap overlap motion requires a positive overlap target." });
    }
    return {
      ...supplied,
      resolvedMode,
      overlapEdge,
      underlyingEdge: overlapEdge === "leading" ? "trailing" : overlapEdge === "trailing" ? "leading" : null,
      targetOverlapDeg,
      motionWrapAngleDeg,
      seamWipeEnabled,
      seamOverWipeDeg,
      fullWrapReady,
      issues
    };
  }

  function splitAllocationsByStages(allocations, stages) {
    const stageQueue = stages
      .filter((stage) => finite(stage.rotation, 0) > EPSILON)
      .map((stage) => ({ ...stage, remaining: finite(stage.rotation, 0) }));
    if (!stageQueue.length) return allocations.map((move) => ({ ...move, originalWindowKey: move.key }));

    const split = [];
    let stageIndex = 0;
    let splitIndex = 0;
    allocations.forEach((allocation) => {
      let rotationRemaining = Math.max(0, finite(allocation.rotation, 0));
      let spanRemaining = Math.max(EPSILON, finite(allocation.span, finite(allocation.end) - finite(allocation.start)));
      let start = finite(allocation.start, 0);
      if (rotationRemaining <= EPSILON) {
        split.push({ ...allocation, originalWindowKey: allocation.key });
        return;
      }
      while (rotationRemaining > EPSILON && stageIndex < stageQueue.length) {
        const stage = stageQueue[stageIndex];
        const rotation = Math.min(rotationRemaining, stage.remaining);
        const span = rotationRemaining - rotation <= EPSILON
          ? spanRemaining
          : spanRemaining * (rotation / rotationRemaining);
        split.push({
          ...allocation,
          key: `${allocation.key}:wrap-${stage.key}-${splitIndex += 1}`,
          originalWindowKey: allocation.key,
          start,
          end: start + span,
          span,
          rotation,
          ratio: span > EPSILON ? rotation / span : allocation.ratio,
          centerTackStage: `full-wrap-${stage.key}`,
          wrapStage: stage.key,
          wrapStageLabel: stage.label
        });
        start += span;
        spanRemaining = Math.max(0, spanRemaining - span);
        rotationRemaining = Math.max(0, rotationRemaining - rotation);
        stage.remaining = Math.max(0, stage.remaining - rotation);
        if (stage.remaining <= EPSILON) stageIndex += 1;
      }
    });
    return split;
  }

  function planSegments(options, rawSegments, source) {
    const labelDeg = Math.max(0, finite(options?.labelDeg, 0));
    const overWipeDeg = Math.max(0, finite(options?.overWipeDeg, 0));
    const mapDirection = normalizedDirection(options?.mapDirection);
    const maxRatio = Math.max(0.1, finite(options?.maxRatio, 21));
    const safetyFactor = Math.max(0.25, Math.min(0.98, finite(options?.safetyFactor, 0.9)));
    const segments = rawSegments.slice().sort((a, b) => a.start - b.start || a.end - b.end);
    const openSegments = segments.filter((segment) => segment.stage === "outer" || segment.stage === "inner");
    const wrapPlan = normalizedWrapPlan(options, labelDeg);
    const edgeGuardDeg = Math.max(0.5, Math.min(12, finite(options?.labelEdgeGuardDeg, DEFAULT_LABEL_EDGE_GUARD_DEG)));
    const oppositeEdgeClearanceDeg = Math.max(overWipeDeg, edgeGuardDeg);
    const protectedFinalRotationDeg = Math.max(0, labelDeg + overWipeDeg - oppositeEdgeClearanceDeg);
    const legacyFinalRotationDeg = Math.max(0, labelDeg + overWipeDeg * 2);
    const issues = [...(Array.isArray(wrapPlan.issues) ? wrapPlan.issues : [])];
    const allocationsByWindow = new Map();
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
      const fullWrapFirstRotation = wrapPlan.motionWrapAngleDeg / 2 + overWipeDeg;
      const fullWrapFinalRotation = wrapPlan.motionWrapAngleDeg + overWipeDeg + wrapPlan.seamOverWipeDeg;
      const requiredRotation = phaseIndex === 0
        ? Math.max(0, wrapPlan.fullWrapReady ? fullWrapFirstRotation : labelDeg / 2 + overWipeDeg)
        : Math.max(0, wrapPlan.fullWrapReady ? fullWrapFinalRotation : protectedFinalRotationDeg);
      const allocation = allocateAcrossWindows(requiredRotation, phasePlan.windows, maxRatio, safetyFactor);
      let plannedAllocations = allocation.allocations.map((window) => ({
        ...window,
        originalWindowKey: window.key,
        direction: wipeDirectionForSide(phasePlan.side, mapDirection),
        centerTackStage: phaseIndex === 0
          ? wrapPlan.fullWrapReady ? "full-wrap-first-edge-wipe" : "center-to-first-edge"
          : wrapPlan.fullWrapReady ? "full-wrap-circumference-wipe" : "edge-to-opposite-edge-protected",
        wipeOutward: true,
        leadingEdgeWipe: false,
        tackMode: "center",
        oppositeLabelEdgeProtected: phaseIndex > 0 && !wrapPlan.fullWrapReady,
        permittedOverlapEdge: phaseIndex > 0 && wrapPlan.fullWrapReady ? wrapPlan.overlapEdge : null,
        underlyingEdge: phaseIndex > 0 && wrapPlan.fullWrapReady ? wrapPlan.underlyingEdge : null
      }));
      if (phaseIndex === 0 && wrapPlan.fullWrapReady) {
        plannedAllocations = plannedAllocations.map((move) => ({
          ...move,
          wrapStage: "first-edge-wipe",
          wrapStageLabel: "First Edge Wipe"
        }));
      }
      if (phaseIndex > 0 && wrapPlan.fullWrapReady) {
        plannedAllocations = splitAllocationsByStages(plannedAllocations, [
          { key: "circumference-wipe", label: "Circumference Wipe", rotation: 360 + overWipeDeg },
          { key: "overlap-edge-crossing", label: "Overlap Edge Crossing", rotation: wrapPlan.targetOverlapDeg },
          { key: "seam-wipe", label: "Seam Wipe", rotation: wrapPlan.seamOverWipeDeg }
        ]);
      }
      plannedAllocations.forEach((move) => {
        const key = move.originalWindowKey || move.key;
        const current = allocationsByWindow.get(key) || [];
        current.push(move);
        allocationsByWindow.set(key, current);
      });
      phasePlan.windows = plannedAllocations;
      phasePlan.requiredRotation = requiredRotation;
      phasePlan.remaining = allocation.remaining;
      phasePlan.ratio = allocation.requestedRatio;
      phasePlan.oppositeLabelEdgeProtected = phaseIndex > 0 && !wrapPlan.fullWrapReady;
      phasePlan.oppositeEdgeClearanceDeg = phaseIndex > 0 && !wrapPlan.fullWrapReady ? oppositeEdgeClearanceDeg : 0;
      phasePlan.permittedOverlapEdge = phaseIndex > 0 && wrapPlan.fullWrapReady ? wrapPlan.overlapEdge : null;
      if (allocation.remaining > EPSILON) {
        issues.push({
          level: "bad",
          code: phaseIndex > 0 && wrapPlan.fullWrapReady
            ? "cold-glue-neck-wrap-capacity"
            : phaseIndex > 0
              ? "cold-glue-brush-exit-clearance-capacity"
              : "cold-glue-channel-capacity",
          side: phasePlan.side,
          message: phaseIndex > 0 && wrapPlan.fullWrapReady
            ? `${phasePlan.side === "outer" ? "Outside" : "Inside"} brush cannot finish the full neck-wrap overlap and seam wipe; ${allocation.remaining.toFixed(1)} deg of bottle rotation remains.`
            : phaseIndex > 0
              ? `${phasePlan.side === "outer" ? "Outside" : "Inside"} brush cannot complete the protected single-brush wipe without entering the opposite-label-edge clearance; ${allocation.remaining.toFixed(1)} deg of bottle rotation remains.`
              : `${phasePlan.side === "outer" ? "Outside" : "Inside"} brush opening is short by ${allocation.remaining.toFixed(1)} deg of bottle rotation.`
        });
      }
    });

    const channelMoves = segments.flatMap((segment) => {
      if (segment.stage === "opposed") return [{
        ...segment,
        rotation: 0,
        ratio: 0,
        direction: 0,
        leadingEdgeWipe: false,
        tackMode: "center",
        centerOutFromApplication: true
      }];
      return allocationsByWindow.get(segment.key) || [{
        ...segment,
        rotation: 0,
        ratio: 0,
        direction: wipeDirectionForSide(segment.side, mapDirection),
        leadingEdgeWipe: false,
        tackMode: "center",
        centerOutFromApplication: true
      }];
    });

    const totalRotation = channelMoves.reduce((sum, move) => sum + Math.max(0, finite(move.rotation, 0)), 0);
    const signedRotation = channelMoves.reduce((sum, move) => sum + finite(move.direction, 0) * Math.max(0, finite(move.rotation, 0)), 0);
    const opposed = channelMoves.filter((move) => move.stage === "opposed");
    const process = channelMoves.filter((move) => move.centerTackStage === "center-to-first-edge" || move.centerTackStage === "full-wrap-first-edge-wipe");
    const final = channelMoves.filter((move) => Number.isFinite(Number(move.rotation)) && move.stage !== "opposed" && !process.includes(move));
    const hasFinalPhase = phasePlans.length > 1;
    const oppositeLabelEdgeProtection = hasFinalPhase
      ? wrapPlan.fullWrapReady
        ? Object.freeze({
            enabled: false,
            permittedCrossing: true,
            permittedOverlapEdge: wrapPlan.overlapEdge,
            underlyingEdge: wrapPlan.underlyingEdge,
            targetOverlapDeg: wrapPlan.targetOverlapDeg,
            rule: "only-designated-overlap-edge-may-cross-for-seam-wipe"
          })
        : Object.freeze({
            enabled: true,
            brushSide: phasePlans[1]?.side || null,
            labelEdgeGuardDeg: edgeGuardDeg,
            configuredOverWipeDeg: overWipeDeg,
            oppositeEdgeClearanceDeg,
            legacyFinalRotationDeg,
            protectedFinalRotationDeg,
            remainingRotation: phasePlans[1]?.remaining || 0,
            rule: "single-brush-exit-must-stop-before-opposite-label-edge"
          })
      : null;

    return {
      source,
      labelDeg,
      overWipeDeg,
      totalRotation,
      fullWrap: labelDeg >= 330,
      overlapWrap: wrapPlan.fullWrapReady,
      wrapPlan,
      seamWipePlan: wrapPlan.fullWrapReady ? {
        enabled: wrapPlan.seamWipeEnabled,
        overlapEdge: wrapPlan.overlapEdge,
        underlyingEdge: wrapPlan.underlyingEdge,
        overlapDeg: wrapPlan.targetOverlapDeg,
        overWipeDeg: wrapPlan.seamOverWipeDeg,
        fullySeated: phasePlans[1]?.remaining <= EPSILON
      } : null,
      ...(oppositeLabelEdgeProtection ? { oppositeLabelEdgeProtection } : {}),
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
    channelRunoutWipeAuthority: true,
    standardOppositeEdgeProtectionAuthority: true,
    fullWrapOverlapPolicyAuthority: true,
    labelEdgeGuardDeg: DEFAULT_LABEL_EDGE_GUARD_DEG
  });
})(window);
