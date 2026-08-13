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
    // Saved maps use the original coordinate-system names. Translate them at
    // the geometry boundary instead of changing stored map coordinates.
    return normalizedStoredDirection(storedDirection) === "cw" ? "ccw" : "cw";
  }

  function directionLabel(storedDirection) {
    return physicalDirection(storedDirection) === "cw" ? "Clockwise" : "Counter-clockwise";
  }

  function servoDirectionSign(storedDirection) {
    // Same local bottle/plate sign used by the Mechanical Map. The saved token
    // is a legacy coordinate convention, not the operator-facing direction.
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
    const code = finite(codeBoxOffsetDeg, NaN);
    const inspection = finite(inspectionOffsetDeg, 0);
    if (!Number.isFinite(width) || !Number.isFinite(code)) return NaN;
    return width / 2 - code + inspection;
  }

  function codeBoxTarget({
    section,
    applicationTarget,
    labelWidthDeg,
    codeBoxOffsetDeg,
    inspectionOffsetDeg = 0,
    storedDirection = "ccw",
    currentPlateAngle
  }) {
    const application = finite(applicationTarget, NaN);
    const width = finite(labelWidthDeg, NaN);
    const code = finite(codeBoxOffsetDeg, NaN);
    const inspection = finite(inspectionOffsetDeg, 0);
    const center = labelCenter({ section, applicationTarget: application, labelWidthDeg: width });
    const offset = leftEdgeOffset({ labelWidthDeg: width, codeBoxOffsetDeg: code, inspectionOffsetDeg: inspection });
    if (![application, width, code, center, offset].every(Number.isFinite)) return null;

    const stored = normalizedStoredDirection(storedDirection);
    const direction = physicalDirection(stored);
    const servoSign = servoDirectionSign(stored);

    // Resolve exactly one point on the printed artwork first. For Body/Back
    // leading-edge application this is application + Code Box Center From Left
    // Label Edge. Reversing the machine never substitutes the opposite label end.
    const printedDatum = center - offset;

    // Convert that same artwork point into the legacy/internal plate coordinate.
    // The physical target stays the same, while the HMI/CMD target is allowed to
    // be greater or smaller when the carousel direction changes.
    const rawTarget = servoSign * printedDatum;
    const target = nearestEquivalent(rawTarget, finite(currentPlateAngle, rawTarget));
    return {
      target,
      rawTarget,
      physicalDirection: direction,
      storedDirection: stored,
      servoDirectionSign: servoSign,
      printedCodeBoxDatum: printedDatum,
      application,
      center,
      width,
      code,
      inspection,
      leftEdgeOffset: offset,
      referenceEdge: "left",
      targetReference: "printed-label-left-edge",
      directionInvariantLeftEdge: true,
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
    codeBoxTarget
  });

  global.LabelerCoderOrientationDriver = api;
  global.LabelerDriverRegistry?.register?.("profile.coderOrientation", api, {
    source: "drivers/profile/coder-orientation-driver.js",
    replace: true
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
