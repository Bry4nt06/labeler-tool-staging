"use strict";

(function installSegmentCommandFinalizerDriver(global) {
  const base = global.LabelerServoCommandDriver;
  if (!base || global.LabelerSegmentCommandFinalizerDriver) return;

  const EPSILON = 0.001;
  const REST = Number(base.MOVE_TYPES?.REST ?? 3);
  const CORRECTION = Number(base.MOVE_TYPES?.CORRECTION ?? 7);

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function segmentMoves(rows, index, tolerance = EPSILON) {
    const row = rows[index];
    const next = rows[index + 1];
    if (!row || !next) return false;
    return Math.abs(finite(next.plateAngle) - finite(row.plateAngle)) > tolerance;
  }

  function finalize(rows, tolerance = EPSILON) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row, index) => ({
      ...row,
      cmd: segmentMoves(rows, index, tolerance) ? CORRECTION : REST
    }));
  }

  const api = Object.freeze({ EPSILON, REST, CORRECTION, segmentMoves, finalize });
  global.LabelerSegmentCommandFinalizerDriver = api;
  global.LabelerServoCommandDriver = Object.freeze({ ...base, finalize });
  global.LabelerDriverRegistry?.register("servo.segmentCommandFinalizer", api, {
    source: "drivers/servo/segment-command-finalizer-driver.js",
    replace: true
  });
})(typeof window !== "undefined" ? window : globalThis);
