"use strict";

(function installColdGlueLabelRelativeBrushEntry(global) {
  const base = global.LabelerColdGlueMotionDriver;
  if (!base || base.labelRelativeBrushEntryAuthority === true) return;

  const finite = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const norm = (value) => ((finite(value, 0) % 360) + 360) % 360;
  const mapDirection = (value) => String(value || "").toLowerCase() === "ccw" ? "ccw" : "cw";

  function flowFacingTarget(applicationPlateDeg, direction = "cw", labelDeg = 0) {
    const application = norm(applicationPlateDeg);
    if (finite(labelDeg, 0) >= 330) return application;
    const offset = mapDirection(direction) === "ccw" ? 90 : -90;
    return norm(application + offset);
  }

  function channelEntryAngle(direction = "cw", labelDeg = 0, applicationPlateDeg = 0) {
    return flowFacingTarget(applicationPlateDeg, direction, labelDeg);
  }

  function rebaseOpposedHold(move, entryAngle) {
    if (!move || move.stage !== "opposed" || move.configuredHold || move.holdCurrent) return move;
    return { ...move, holdAngle: entryAngle };
  }

  function rebasePlan(plan, options) {
    if (!plan || typeof plan !== "object") return plan;
    const applicationPlateDeg = norm(options?.applicationPlateDeg);
    const entryAngle = channelEntryAngle(options?.mapDirection, options?.labelDeg, applicationPlateDeg);
    return {
      ...plan,
      applicationPlateDeg,
      channelEntryAngle: entryAngle,
      channelMoves: Array.isArray(plan.channelMoves)
        ? plan.channelMoves.map((move) => rebaseOpposedHold(move, entryAngle))
        : plan.channelMoves,
      holds: Array.isArray(plan.holds)
        ? plan.holds.map((move) => rebaseOpposedHold(move, entryAngle))
        : plan.holds
    };
  }

  const createPlan = (options) => rebasePlan(base.createPlan(options), options);
  const createBrushChannelPlan = (options) => rebasePlan(base.createBrushChannelPlan(options), options);

  global.LabelerColdGlueMotionDriver = Object.freeze({
    ...base,
    createPlan,
    createBrushChannelPlan,
    flowFacingTarget,
    channelEntryAngle,
    labelRelativeBrushEntryAuthority: true
  });
})(window);
