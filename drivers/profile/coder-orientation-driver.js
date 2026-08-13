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
    const code = Math.abs(finite(codeBoxOffsetDeg, NaN));
    const inspection = finite(inspectionOffsetDeg, 0);
    const center = labelCenter({ section, applicationTarget: application, labelWidthDeg: width });
    const offset = leftEdgeOffset({ labelWidthDeg: width, codeBoxOffsetDeg: code, inspectionOffsetDeg: inspection });
    if (![application, width, code, center, offset].every(Number.isFinite)) return null;

    const stored = normalizedStoredDirection(storedDirection);
    const direction = physicalDirection(stored);
    const servoSign = servoDirectionSign(stored);
    const printedDatum = center - offset;
    const measuredLocalOffset = printedDatum - application;
    const machineLocalOffset = servoSign * measuredLocalOffset;
    const rawTarget = application + machineLocalOffset;
    const target = nearestEquivalent(rawTarget, finite(currentPlateAngle, rawTarget));

    return {
      target,
      rawTarget,
      physicalDirection: direction,
      storedDirection: stored,
      servoDirectionSign: servoSign,
      printedCodeBoxDatum: printedDatum,
      measuredLocalOffset,
      machineLocalOffset,
      application,
      center,
      width,
      code,
      inspection,
      leftEdgeOffset: offset,
      referenceEdge: "left",
      targetReference: "printed-label-left-edge",
      directionInvariantLeftEdge: true,
      positiveMeasuredInput: true,
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
