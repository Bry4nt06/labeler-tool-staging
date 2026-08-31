(function installServoForgeColdGlueBrushExitClearance(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.cold-glue-brush-exit-clearance.v24";
  const DEFAULT_LABEL_EDGE_GUARD_DEG = 3;
  const DEFAULT_EXIT_CLEARANCE_TABLE_DEG = 3;
  const MIN_ACTIVE_TABLE_SPAN_DEG = 0.25;
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
    const requestedClearanceDeg = clamp(
      number(options.brushExitClearanceDeg, DEFAULT_EXIT_CLEARANCE_TABLE_DEG),
      0.5,
      8
    );
    const labelDeg = Math.max(0, number(plan.labelDeg, options.labelDeg));
    const overWipeDeg = Math.max(0, number(plan.overWipeDeg, options.overWipeDeg));

    // At the beginning of the second center-out phase the first edge has already
    // wiped through its configured over-wipe. Rotating another full label plus
    // two over-wipes drives the opposite label edge through the trailing brush
    // tip. Stop before that edge reaches the brush instead.
    const protectedRequiredRotation = Math.max(0, labelDeg + overWipeDeg - edgeGuardDeg);

    const activeWindows = trailing.moves.map((move) => ({ ...move }));
    const lastWindow = activeWindows[activeWindows.length - 1];
    const originalExitEnd = number(lastWindow.end, number(lastWindow.start) + moveSpan(lastWindow));
    const originalLastSpan = moveSpan(lastWindow);
    const appliedClearanceDeg = Math.min(
      requestedClearanceDeg,
      Math.max(0, originalLastSpan - MIN_ACTIVE_TABLE_SPAN_DEG)
    );

    if (appliedClearanceDeg > EPSILON) {
      lastWindow.end = originalExitEnd - appliedClearanceDeg;
      lastWindow.span = Math.max(MIN_ACTIVE_TABLE_SPAN_DEG, lastWindow.end - number(lastWindow.start));
    }

    const allocation = allocateProtectedRotation(
      protectedRequiredRotation,
      activeWindows,
      options.maxRatio,
      options.safetyFactor
    );

    const replacementMoves = allocation.allocations;
    const protectedMoves = plan.channelMoves.slice();
    protectedMoves.splice(trailing.startIndex, trailing.moves.length, ...replacementMoves);

    let exitHold = null;
    if (appliedClearanceDeg > EPSILON) {
      const protectedExitStart = originalExitEnd - appliedClearanceDeg;
      const source = trailing.moves[trailing.moves.length - 1];
      exitHold = {
        ...source,
        key: `${source.key || "brush"}:exit-clearance`,
        stage: "opposed",
        start: protectedExitStart,
        end: originalExitEnd,
        span: appliedClearanceDeg,
        rotation: 0,
        ratio: 0,
        direction: 0,
        holdCurrent: true,
        configuredHold: false,
        parallelBrushHold: false,
        exitClearanceHold: true,
        oppositeLabelEdgeProtected: true,
        protectedBrushSide: trailing.side,
        centerTackStage: "brush-exit-clearance",
        wipeOutward: false,
        leadingEdgeWipe: false,
        tackMode: "center"
      };
      protectedMoves.splice(trailing.startIndex + replacementMoves.length, 0, exitHold);
    }

    const byKey = new Map(protectedMoves.map((move) => [move?.key, move]));
    const groupKeys = new Set(trailing.moves.map((move) => move?.key));
    const phasePlans = (Array.isArray(plan.phasePlans) ? plan.phasePlans : []).map((phase) => {
      const phaseWindows = Array.isArray(phase?.windows) ? phase.windows : [];
      if (!phaseWindows.some((window) => groupKeys.has(window?.key))) return phase;
      return {
        ...phase,
        windows: replacementMoves,
        requiredRotation: protectedRequiredRotation,
        remaining: allocation.remaining,
        ratio: allocation.requestedRatio,
        oppositeLabelEdgeProtected: true,
        labelEdgeGuardDeg: edgeGuardDeg,
        brushExitClearanceDeg: appliedClearanceDeg
      };
    });

    const issues = [...(Array.isArray(plan.issues) ? plan.issues : [])];
    if (allocation.remaining > EPSILON) {
      issues.push({
        level: "bad",
        code: "cold-glue-brush-exit-clearance-capacity",
        side: trailing.side,
        message: `${trailing.side === "outer" ? "Outside" : "Inside"} brush cannot complete the protected wipe before the ${appliedClearanceDeg.toFixed(1)} deg exit-clearance zone; ${allocation.remaining.toFixed(1)} deg of bottle rotation remains.`
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
        requestedExitClearanceDeg: requestedClearanceDeg,
        appliedExitClearanceDeg,
        rotationStopsAtTableDeg: exitHold ? exitHold.start : originalExitEnd,
        brushClearsAtTableDeg: originalExitEnd,
        protectedRequiredRotation,
        remainingRotation: allocation.remaining
      })
    };
  }

  function install() {
    const previous = global.LabelerColdGlueMotionDriver;
    if (!previous || global.__ServoForgeColdGlueBrushExitClearanceV24Installed) return false;

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
      labelEdgeGuardDeg: DEFAULT_LABEL_EDGE_GUARD_DEG,
      brushExitClearanceDeg: DEFAULT_EXIT_CLEARANCE_TABLE_DEG
    });
    global.__ServoForgeColdGlueBrushExitClearanceV24Installed = true;
    return true;
  }

  install();

  global.ServoForgeColdGlueBrushExitClearance = Object.freeze({
    INTEGRATION_VERSION,
    DEFAULT_LABEL_EDGE_GUARD_DEG,
    DEFAULT_EXIT_CLEARANCE_TABLE_DEG,
    protectPlan,
    install
  });
})(window);
