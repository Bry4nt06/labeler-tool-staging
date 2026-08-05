"use strict";

(function installGlobalMachineParameterDefaults(global) {
  if (global.LabelerGlobalMachineParameterDefaults) return;

  // Center Line Front is derived by the current APL model as:
  // -(90 - neckSpenderPlateDeg) + plateStartPositionDeg.
  // A 75-degree spender plate therefore uses a 15-degree starting position
  // to produce the requested zero-degree front centerline.
  const DEFAULT_BUILD_INPUTS = Object.freeze({
    neckSpenderPlateDeg: 75,
    neckApplication: "Center",
    plateStartPositionDeg: 15,
    neckContactMm: 0,
    bodyContactMm: 0,
    backContactMm: 0
  });

  function apply(targetState) {
    if (!targetState || typeof targetState !== "object") return false;
    targetState.buildInputs = {
      ...(targetState.buildInputs || {}),
      ...DEFAULT_BUILD_INPUTS
    };
    return true;
  }

  // This runs before loadSavedSettings(). Existing saved build inputs are
  // merged afterward and remain authoritative, so user changes are preserved.
  const applied = typeof state !== "undefined" ? apply(state) : false;

  global.LabelerGlobalMachineParameterDefaults = Object.freeze({
    DEFAULT_BUILD_INPUTS,
    apply,
    applied
  });
})(typeof window !== "undefined" ? window : globalThis);
