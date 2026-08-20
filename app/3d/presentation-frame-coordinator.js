"use strict";

(function installServoForge3DPresentationFrameCoordinator(global) {
  if (global.Labeler3DPresentationFrameCoordinator?.installed) return;

  const COORDINATOR_VERSION = "servoforge.3d-presentation-frame-coordinator.v1";
  const callbacks = new Map();
  let frameCount = 0;
  let callbackRuns = 0;
  let callbackFailures = 0;

  function register(id, callback, options = {}) {
    const key = String(id || "").trim();
    if (!key) throw new Error("A presentation callback id is required.");
    if (typeof callback !== "function") throw new TypeError("A presentation callback must be a function.");

    callbacks.set(key, {
      callback,
      minIntervalMs: Math.max(0, Number(options.minIntervalMs) || 0),
      lastRunAt: Number.NEGATIVE_INFINITY
    });
    return () => callbacks.delete(key);
  }

  function unregister(id) {
    return callbacks.delete(String(id || ""));
  }

  function frame(context = {}) {
    const timestamp = Number.isFinite(Number(context.timestamp))
      ? Number(context.timestamp)
      : Number(global.performance?.now?.() || Date.now());
    frameCount += 1;

    callbacks.forEach((entry, id) => {
      if ((timestamp - entry.lastRunAt) < entry.minIntervalMs) return;
      entry.lastRunAt = timestamp;
      try {
        entry.callback(context);
        callbackRuns += 1;
      } catch (error) {
        callbackFailures += 1;
        console.warn(`ServoForge 3D presentation callback "${id}" skipped`, error);
      }
    });
  }

  function status() {
    return Object.freeze({
      coordinatorVersion: COORDINATOR_VERSION,
      registeredCallbacks: callbacks.size,
      frameCount,
      callbackRuns,
      callbackFailures,
      singleFrameAuthority: true
    });
  }

  global.Labeler3DPresentationFrameCoordinator = Object.freeze({
    installed: true,
    COORDINATOR_VERSION,
    register,
    unregister,
    frame,
    status
  });
})(typeof window !== "undefined" ? window : globalThis);
