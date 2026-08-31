(function installServoForgeColdGlueBrushExitClearance(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.cold-glue-brush-exit-clearance.v24.1";
  const DEFAULT_LABEL_EDGE_GUARD_DEG = 3;
  const EPSILON = 0.001;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function moveSpan(move) {
    return Math.max(EPSILON, number(move?.span, number(move?.end) - number(move?.start)));
  }

  function isOpenBrushMove(move) {
    return move?.stage !== "opposed" && (move?.side === "inner" || move?.side === "outer");
  }

  function trailingOppositeEdgeGroup(moves) {
    const source = Array.isArray(moves) ? moves : [];
    let endIndex = source.length - 1;
    while (endIndex >= 0 && !isOpenBrushMove(source[endIndex])) endIndex -= 1;
    if (endIndex < 0) return null;

    const last = source[endIndex];
    if (last.centerTackStage !== "edge-to-opposite-edge") return null;

    const side = last.side;
    let startIndex = endIndex;
    while (startIndex > 0) {
      const previous = source[startIndex - 1];
      if (!isOpenBrushMove(previous)
        || previous.side !== side
        || previous.centerTackStage !== "edge-to-opposite-edge") break;
      startIndex -= 1;
    }

    return {
      side,
      startIndex,
      endIndex,
      moves: source.slice(startIndex, endIndex + 1)
    };
  }

  function allocateProtectedRotation(requiredRotation, windows, maxRatio, safetyFactor) {
    let remaining = Math.max(0, number(requiredRotation, 0));
    const safeRatio = Math.max(0.1, number(maxRatio, 21))
      * clamp(number(safetyFactor, 0.9), 0.25, 0.98);
    const totalSpan = windows.reduce((sum, window) => sum + moveSpan(window), 0);
    const requestedRatio = totalSpan > EPSILON ? remaining / totalSpan : 0;
    const allocations = [];

    windows.forEach((window) => {
      const span = moveSpan(window);
      const rotation = Math.min(remaining, span * Math.min(requestedRatio, safeRatio));
      allocations.push({
        ...window,
        span,
        rotation,
        ratio: rotation / span,
        oppositeLabelEdgeProtected: true,
        centerTackStage: "edge-to-opposite-edge-protected"
      });
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

    return {
      allocations,
      remaining: Math.max(0, remaining),
      requestedRatio,
      safeRatio
    };
  }

  function replaceReferencedMoves(list, byKey) {
    return (Array.isArray(list) ? list : []).map((move) => byKey.get(move?.key) || move);
  }

  function protectPlan(plan, options = {}) {
    if (!plan || !Array.isArray(plan.channelMoves) || !plan.channelMoves.length) return plan;

    const trailing = trailingOppositeEdgeGroup(plan.channelMoves);
    if (!trailing?.moves?.length) return plan;

    const edgeGuardDeg = clamp(
      number(options.labelEdgeGuardDeg, DEFAULT_LABEL_EDGE_GUARD_DEG),
      0.5,
      12
    );
    const labelDeg = Math.max(0, number(plan.labelDeg, options.labelDeg));
    const overWipeDeg = Math.max(0, number(plan.overWipeDeg, options.overWipeDeg));

    // The first center-out phase already carries the first label edge beyond the
    // brush by overWipeDeg. The legacy second phase then commanded a full label
    // plus TWO over-wipes, which necessarily swept the opposite label edge into
    // and through the trailing end of the remaining single brush.
    //
    // On exit, rotate only far enough to wipe one label length while preserving
    // the larger of the configured over-wipe or the minimum edge guard as
    // clearance before the opposite label edge reaches the brush contact line.
    const oppositeEdgeClearanceDeg = Math.max(overWipeDeg, edgeGuardDeg);
    const protectedRequiredRotation = Math.max(
      0,
      labelDeg + overWipeDeg - oppositeEdgeClearanceDeg
    );

    const allocation = allocateProtectedRotation(
      protectedRequiredRotation,
      trailing.moves,
      options.maxRatio,
      options.safetyFactor
    );

    const protectedMoves = plan.channelMoves.slice();
    protectedMoves.splice(trailing.startIndex, trailing.moves.length, ...allocation.allocations);
    const byKey = new Map(protectedMoves.map((move) => [move?.key, move]));
    const groupKeys = new Set(trailing.moves.map((move) => move?.key));

    const phasePlans = (Array.isArray(plan.phasePlans) ? plan.phasePlans : []).map((phase) => {
      const phaseWindows = Array.isArray(phase?.windows) ? phase.windows : [];
      if (!phaseWindows.some((window) => groupKeys.has(window?.key))) return phase;
      return {
        ...phase,
        windows: allocation.allocations,
        requiredRotation: protectedRequiredRotation,
        remaining: allocation.remaining,
        ratio: allocation.requestedRatio,
        oppositeLabelEdgeProtected: true,
        oppositeEdgeClearanceDeg,
        labelEdgeGuardDeg: edgeGuardDeg
      };
    });

    const issues = [...(Array.isArray(plan.issues) ? plan.issues : [])];
    if (allocation.remaining > EPSILON) {
      issues.push({
        level: "bad",
        code: "cold-glue-brush-exit-clearance-capacity",
        side: trailing.side,
        message: `${trailing.side === "outer" ? "Outside" : "Inside"} brush cannot complete the protected single-brush wipe without entering the opposite-label-edge clearance; ${allocation.remaining.toFixed(1)} deg of bottle rotation remains.`
      });
    }

    const totalRotation = protectedMoves.reduce(
      (sum, move) => sum + Math.max(0, number(move?.rotation, 0)),
      0
    );
    const finalPlateTravel = protectedMoves.reduce(
      (sum, move) => sum + number(move?.direction, 0) * Math.max(0, number(move?.rotation, 0)),
      0
    );

    return {
      ...plan,
      channelMoves: protectedMoves,
      process: replaceReferencedMoves(plan.process, byKey),
      final: protectedMoves.filter((move) => isOpenBrushMove(move) && move.centerTackStage === "edge-to-opposite-edge-protected"),
      holds: protectedMoves.filter((move) => move.stage === "opposed"),
      phasePlans,
      issues,
      totalRotation,
      finalPlateTravel,
      oppositeLabelEdgeProtection: Object.freeze({
        enabled: true,
        brushSide: trailing.side,
        labelEdgeGuardDeg: edgeGuardDeg,
        configuredOverWipeDeg: overWipeDeg,
        oppositeEdgeClearanceDeg,
        legacyFinalRotationDeg: Math.max(0, labelDeg + overWipeDeg * 2),
        protectedFinalRotationDeg: protectedRequiredRotation,
        remainingRotation: allocation.remaining,
        rule: "single-brush-exit-must-stop-before-opposite-label-edge"
      })
    };
  }

  function install() {
    const previous = global.LabelerColdGlueMotionDriver;
    if (!previous || global.__ServoForgeColdGlueBrushExitClearanceV241Installed) return false;

    const originalCreateBrushChannelPlan = previous.createBrushChannelPlan?.bind(previous);
    const originalCreatePlan = previous.createPlan?.bind(previous);

    function createBrushChannelPlan(options = {}) {
      const plan = originalCreateBrushChannelPlan ? originalCreateBrushChannelPlan(options) : null;
      return protectPlan(plan, options);
    }

    function createPlan(options = {}) {
      const plan = originalCreatePlan ? originalCreatePlan(options) : null;
      return protectPlan(plan, options);
    }

    global.LabelerColdGlueMotionDriver = Object.freeze({
      ...previous,
      createBrushChannelPlan,
      createPlan,
      brushExitClearanceVersion: INTEGRATION_VERSION,
      labelEdgeGuardDeg: DEFAULT_LABEL_EDGE_GUARD_DEG
    });
    global.__ServoForgeColdGlueBrushExitClearanceV241Installed = true;
    return true;
  }

  install();

  global.ServoForgeColdGlueBrushExitClearance = Object.freeze({
    INTEGRATION_VERSION,
    DEFAULT_LABEL_EDGE_GUARD_DEG,
    protectPlan,
    install
  });
})(window);
