"use strict";

(function installClockwiseCodeBoxOrientationIntegration() {
  const RETRY_MS = 50;
  const EPS = 0.001;
  let installed = false;

  const num = (value, fallback = NaN) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const done = (value) => typeof finishAngle === "function"
    ? finishAngle(value)
    : Math.round(num(value, 0) * 10) / 10;
  const nearest = (target, reference) => num(target, 0)
    + 360 * Math.round((num(reference, target) - num(target, 0)) / 360);

  function activeMapSafe() {
    try {
      return typeof activeMachineMap === "function" ? activeMachineMap() : null;
    } catch {
      return null;
    }
  }

  function machineDirection(map = activeMapSafe()) {
    return String(map?.machineSettings?.direction || map?.direction || state?.direction || "ccw")
      .trim()
      .toLowerCase() === "cw" ? "cw" : "ccw";
  }

  function activeApplications() {
    try {
      return typeof selectedLabelApplicationState === "function"
        ? selectedLabelApplicationState()
        : { neck: true, body: true, back: true };
    } catch {
      return { neck: true, body: true, back: true };
    }
  }

  function codingSection(map) {
    const coder = (Array.isArray(map?.objects) ? map.objects : []).find((item) => item?.kind === "coding");
    const explicit = String(coder?.orientationLabelSection || coder?.labelSection || "auto").toLowerCase();
    const active = activeApplications();
    if (["neck", "body", "back"].includes(explicit) && active[explicit]) return explicit;
    return active.back ? "back" : active.body ? "body" : active.neck ? "neck" : "none";
  }

  function labelCircumference(section) {
    const label = typeof selectedLabelSpec === "function" ? selectedLabelSpec() : null;
    const bottle = typeof selectedBottleSpec === "function" ? selectedBottleSpec() : null;
    return section === "neck"
      ? num(label?.neckBottomCircumferenceMm, NaN)
      : num(typeof bodyCircumference === "function" ? bodyCircumference(bottle) : NaN, NaN);
  }

  function labelWidth(section, circumference) {
    const wipe = typeof sectionWipePlan === "function" ? sectionWipePlan(section) : null;
    const planned = num(wipe?.labelDeg, NaN);
    if (Number.isFinite(planned)) return Math.min(360, Math.max(0.1, planned));
    const label = typeof selectedLabelSpec === "function" ? selectedLabelSpec() : null;
    const lengthMm = section === "neck"
      ? Math.max(num(label?.neckBottomCurveMm, 0), num(label?.neckLengthMm, 0))
      : section === "body" ? num(label?.bodyLengthMm, NaN) : num(label?.backLengthMm, NaN);
    return typeof degFromMm === "function" ? num(degFromMm(lengthMm, circumference), NaN) : NaN;
  }

  function applicationTarget(section, rows, beforeTable) {
    const planned = num(state?.motionPlan?.[`${section}ApplicationTarget`], NaN);
    if (Number.isFinite(planned)) return planned;

    const candidates = (Array.isArray(rows) ? rows : []).filter((row) =>
      num(row?.tableAngle, Infinity) < num(beforeTable, Infinity)
      && String(row?.section || "").toLowerCase() === section
      && /application/i.test(String(row?.action || ""))
      && Number.isFinite(num(row?.plateAngle, NaN))
    );
    if (candidates.length) return num(candidates.at(-1)?.plateAngle, NaN);

    const actionPattern = new RegExp(`(?:hold|turn).*${section}.*application`, "i");
    const fallback = (Array.isArray(rows) ? rows : []).filter((row) =>
      num(row?.tableAngle, Infinity) < num(beforeTable, Infinity)
      && actionPattern.test(String(row?.action || ""))
      && Number.isFinite(num(row?.plateAngle, NaN))
    );
    return num(fallback.at(-1)?.plateAngle, NaN);
  }

  function clockwiseTarget(section, rows, holdIndex) {
    const label = typeof selectedLabelSpec === "function" ? selectedLabelSpec() : null;
    const circumference = labelCircumference(section);
    const width = labelWidth(section, circumference);
    const code = typeof degFromMm === "function"
      ? num(degFromMm(label?.codeBoxCenterMm, circumference), NaN)
      : NaN;
    const inspection = typeof degFromMm === "function"
      ? num(degFromMm(state?.buildInputs?.backInspectionOffsetMm, circumference), 0)
      : 0;
    const hold = rows[holdIndex];
    const application = applicationTarget(section, rows, hold?.tableAngle);
    if (![width, code, application].every(Number.isFinite)) return null;

    // Label specifications always measure the code-box center from the printed
    // label's left edge. Reversing machine travel changes the servo-coordinate
    // sign of that label-local distance, but it does not move the printed code
    // box to the other side of the label.
    const center = section === "body" || section === "back"
      ? application - width / 2
      : application;
    const target = center - (width / 2 - code + inspection);
    const previous = rows.slice(0, holdIndex).reverse().find((row) => Number.isFinite(num(row?.plateAngle, NaN)));
    return {
      target: nearest(target, num(previous?.plateAngle, target)),
      application,
      center,
      width,
      code,
      inspection
    };
  }

  function isCodingHold(row) {
    if (Number(row?.cmd) !== 3) return false;
    const action = String(row?.action || "");
    return Boolean(row?.codingObjectId)
      || Boolean(row?.codingHold)
      || Boolean(row?.codingReadyTableAngle)
      || (Boolean(row?.orientationHold) && /coding|code box/i.test(action))
      || /hold.*(?:coding|code box)|(?:coding|code box).*hold|coding.*reference/i.test(action);
  }

  function updateTurnIntoHold(rows, holdIndex, target) {
    let turnIndex = -1;
    for (let index = holdIndex - 1; index >= 0; index -= 1) {
      const row = rows[index];
      if (Number(row?.cmd) !== 7) continue;
      if (row?.codingObjectId || row?.codingMotion || row?.coderAfterWipeHandoff || /coding|code box/i.test(String(row?.action || ""))) {
        turnIndex = index;
        break;
      }
    }
    if (turnIndex < 0) return;

    const turn = rows[turnIndex];
    const startPlate = num(turn?.plateAngle, NaN);
    const tableTravel = num(rows[holdIndex]?.tableAngle, NaN) - num(turn?.tableAngle, NaN);
    if (!Number.isFinite(startPlate)) return;
    rows[turnIndex] = {
      ...turn,
      plannedRotation: target - startPlate,
      plannedRatio: tableTravel > EPS ? Math.abs(target - startPlate) / tableTravel : turn?.plannedRatio,
      clockwiseCodeBoxCorrected: true,
      codeBoxPhysicalSide: "left"
    };
  }

  function updateContinuation(rows, holdIndex, target) {
    const continuation = rows[holdIndex + 1];
    if (!continuation || Number(continuation.cmd) !== 7) return;
    if (!(continuation.coderAfterWipeContinuation
      || continuation.mapObjectOrientationContinuation
      || /continue after/i.test(String(continuation.action || "")))) return;
    const destination = rows[holdIndex + 2];
    const destinationPlate = num(destination?.plateAngle, NaN);
    const tableTravel = num(destination?.tableAngle, NaN) - num(continuation?.tableAngle, NaN);
    rows[holdIndex + 1] = {
      ...continuation,
      plateAngle: done(target),
      plannedRotation: Number.isFinite(destinationPlate) ? destinationPlate - target : continuation?.plannedRotation,
      plannedRatio: Number.isFinite(destinationPlate) && tableTravel > EPS
        ? Math.abs(destinationPlate - target) / tableTravel
        : continuation?.plannedRatio,
      clockwiseCodeBoxCorrected: true,
      codeBoxPhysicalSide: "left"
    };
  }

  function updateMotionPlan(target, section) {
    if (!state?.motionPlan || typeof state.motionPlan !== "object") return;
    state.motionPlan.coderCenterlineTarget = done(target);
    state.motionPlan.codeBoxPhysicalSide = "left";
    state.motionPlan.codeBoxDirectionInvariant = true;
    state.motionPlan.mapObjectOrientationPlans = (Array.isArray(state.motionPlan.mapObjectOrientationPlans)
      ? state.motionPlan.mapObjectOrientationPlans : []).map((plan) =>
      plan?.kind === "coding" || plan?.codingObjectId
        ? { ...plan, section, targetPlateAngle: done(target), clockwiseCodeBoxCorrected: true, codeBoxPhysicalSide: "left" }
        : plan
    );
  }

  function process(sourceRows) {
    if (!Array.isArray(sourceRows) || !sourceRows.length) return sourceRows;
    const map = activeMapSafe();
    if (!map || machineDirection(map) !== "cw") return sourceRows;
    const section = codingSection(map);
    if (section === "none") return sourceRows;

    const rows = sourceRows.map((row) => ({ ...row }));
    const holdIndexes = rows.map((row, index) => isCodingHold(row) ? index : -1).filter((index) => index >= 0);
    if (!holdIndexes.length) return sourceRows;

    let finalTarget = null;
    holdIndexes.forEach((holdIndex) => {
      const correction = clockwiseTarget(section, rows, holdIndex);
      if (!correction) return;
      finalTarget = correction.target;
      rows[holdIndex] = {
        ...rows[holdIndex],
        plateAngle: done(correction.target),
        clockwiseCodeBoxCorrected: true,
        codeBoxPhysicalSide: "left",
        codeBoxReferenceEdge: "left",
        codeBoxOffsetDeg: done(correction.code),
        labelWidthDeg: done(correction.width)
      };
      updateTurnIntoHold(rows, holdIndex, correction.target);
      updateContinuation(rows, holdIndex, correction.target);
    });

    if (!Number.isFinite(finalTarget)) return sourceRows;
    const output = rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
    updateMotionPlan(finalTarget, section);
    if (state?.motionPlan && typeof state.motionPlan === "object") {
      state.motionPlan.rows = output;
      state.motionPlan.finalPlateAngle = output.at(-1)?.plateAngle;
    }
    return output;
  }

  function install() {
    if (installed) return true;
    if (typeof generatedServoProfile !== "function" || typeof state === "undefined") return false;
    const base = generatedServoProfile;
    generatedServoProfile = function generatedServoProfileWithClockwiseCodeBox(...args) {
      return process(base.apply(this, args));
    };
    generatedServoProfile.clockwiseCodeBoxOrientation = true;
    window.generatedServoProfile = generatedServoProfile;
    installed = true;
    try {
      if (typeof applyGeneratedServoProfile === "function") applyGeneratedServoProfile();
      if (typeof render === "function") render();
    } catch (error) {
      console.error("Unable to apply clockwise code-box orientation correction.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})();
