"use strict";

(function installCoderOrientationDriver(global) {
  if (global.LabelerCoderOrientationDriver) return;

  const FULL_CYCLE_DEG = 360;
  const LABEL_SECTIONS = Object.freeze(["neck", "body", "back"]);

  function finite(value, fallback = NaN) {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizedStoredDirection(value) {
    return String(value || "ccw").trim().toLowerCase() === "cw" ? "cw" : "ccw";
  }

  function physicalDirection(storedDirection) {
    return normalizedStoredDirection(storedDirection) === "cw" ? "ccw" : "cw";
  }

  function directionLabel(storedDirection) {
    return physicalDirection(storedDirection) === "cw" ? "Clockwise" : "Counter-clockwise";
  }

  function servoDirectionSign(storedDirection) {
    return normalizedStoredDirection(storedDirection) === "cw" ? -1 : 1;
  }

  function nearestEquivalent(target, reference) {
    const base = finite(target, 0);
    const current = finite(reference, base);
    return base + FULL_CYCLE_DEG * Math.round((current - base) / FULL_CYCLE_DEG);
  }

  function labelCenter({ section, applicationTarget, labelWidthDeg }) {
    const application = finite(applicationTarget, NaN);
    const width = finite(labelWidthDeg, NaN);
    if (!Number.isFinite(application) || !Number.isFinite(width)) return NaN;
    return application + (["body", "back"].includes(String(section)) ? width / 2 : 0);
  }

  function leftEdgeOffset({ labelWidthDeg, codeBoxOffsetDeg, inspectionOffsetDeg = 0 }) {
    const width = finite(labelWidthDeg, NaN);
    const code = Math.abs(finite(codeBoxOffsetDeg, NaN));
    const inspection = finite(inspectionOffsetDeg, 0);
    if (!Number.isFinite(width) || !Number.isFinite(code)) return NaN;
    return width / 2 - code + inspection;
  }

  // Finished-label geometry is fixed in the bottle-local Top View frame. Body
  // and neck are centered on the bottle's 0° reference; back is centered 180°
  // opposite. This frame does not change when the carousel direction changes.
  function bottleSectionCenter(section) {
    return String(section || "").toLowerCase() === "back" ? 180 : 0;
  }

  function printedCodeBoxLocalAngle({
    section,
    labelWidthDeg,
    codeBoxOffsetDeg,
    inspectionOffsetDeg = 0
  }) {
    const width = finite(labelWidthDeg, NaN);
    const code = Math.abs(finite(codeBoxOffsetDeg, NaN));
    const inspection = finite(inspectionOffsetDeg, 0);
    const sectionCenter = bottleSectionCenter(section);
    if (![width, code, inspection, sectionCenter].every(Number.isFinite)) return NaN;

    // Code Box Center is measured positively from the printed label's left edge.
    // The rendered finished-label arc uses center - width/2 as that same edge.
    return sectionCenter - width / 2 + code - inspection;
  }

  function coderFacingRay(coderSide = "outer") {
    return String(coderSide || "outer").trim().toLowerCase() === "inner" ? 180 : 0;
  }

  function codeBoxTarget({
    section,
    applicationTarget,
    labelWidthDeg,
    codeBoxOffsetDeg,
    inspectionOffsetDeg = 0,
    storedDirection = "ccw",
    currentPlateAngle,
    coderSide = "outer"
  }) {
    const application = finite(applicationTarget, NaN);
    const width = finite(labelWidthDeg, NaN);
    const code = Math.abs(finite(codeBoxOffsetDeg, NaN));
    const inspection = finite(inspectionOffsetDeg, 0);
    const sectionCenter = bottleSectionCenter(section);
    const localCodeBoxAngle = printedCodeBoxLocalAngle({
      section,
      labelWidthDeg: width,
      codeBoxOffsetDeg: code,
      inspectionOffsetDeg: inspection
    });
    if (![width, code, inspection, sectionCenter, localCodeBoxAngle].every(Number.isFinite)) return null;

    const stored = normalizedStoredDirection(storedDirection);
    const direction = physicalDirection(stored);
    const servoSign = servoDirectionSign(stored);
    const facingRay = coderFacingRay(coderSide);

    // This is the same transform used by the Top View map renderer:
    // world bottle feature = head radial + servoSign*plate + local feature.
    // At an outside coder the code-box feature must equal the outward head radial
    // ray (0° local world offset); at an inside coder it must equal 180°.
    // Solve that physical constraint directly. The original application servo
    // angle is diagnostic metadata only and must not move the finished code box.
    const rawTarget = servoSign * (facingRay - localCodeBoxAngle);
    const target = nearestEquivalent(rawTarget, finite(currentPlateAngle, rawTarget));
    const worldFeatureOffset = servoSign * target + localCodeBoxAngle;

    return {
      target,
      rawTarget,
      physicalDirection: direction,
      storedDirection: stored,
      servoDirectionSign: servoSign,
      printedCodeBoxLocalAngle: localCodeBoxAngle,
      printedCodeBoxDatum: localCodeBoxAngle,
      bottleSectionCenter: sectionCenter,
      coderFacingRay: facingRay,
      worldFeatureOffset,
      application,
      width,
      code,
      inspection,
      coderSide: String(coderSide || "outer").toLowerCase(),
      referenceEdge: "left",
      targetReference: "bottle-local-code-box-to-coder-ray",
      directionInvariantLeftEdge: true,
      positiveMeasuredInput: true,
      radialFrameTarget: true,
      applicationTargetExcludedFromCoderFacing: true,
      directionDependentServoCommand: true
    };
  }

  const api = Object.freeze({
    FULL_CYCLE_DEG,
    LABEL_SECTIONS,
    normalizedStoredDirection,
    physicalDirection,
    directionLabel,
    servoDirectionSign,
    nearestEquivalent,
    labelCenter,
    leftEdgeOffset,
    bottleSectionCenter,
    printedCodeBoxLocalAngle,
    coderFacingRay,
    codeBoxTarget
  });

  global.LabelerCoderOrientationDriver = api;
  global.LabelerDriverRegistry?.register?.("profile.coderOrientation", api, {
    source: "drivers/profile/coder-orientation-driver.js",
    replace: true
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
