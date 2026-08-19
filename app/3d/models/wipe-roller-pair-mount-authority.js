(function installServoForge3DRollerPairMountAuthority(global) {
  "use strict";

  const baseModel = global.Labeler3DWipeRollerModel;
  if (!baseModel?.create) {
    throw new Error("ServoForge roller clamp-side compatibility requires the wipe roller model.");
  }

  const MODEL_VERSION = "servoforge.3d-model.wipe-roller-clamp-side.v4-explicit-station-side";

  const CLAMP_SIDE_RULES = Object.freeze({
    source: "user-machine-rule-2026-08-19-explicit-roller-side",
    compatibilityOnly: true,
    canonicalRollerModelPreserved: true,
    railGeometryRendered: false,
    pairRailRendered: false,
    extensionArmsRendered: false,
    risersRendered: false,
    immediateClampOwnedByCanonicalRollerModel: true,
    rollerIsBottleFacingTerminal: true,
    mountingHardwareExtendsAwayFromBottle: true,
    hardwareNeverBetweenBottleAndRoller: true,
    stationSideControlsClampDirection: true,
    outsideRollerHardwareDirection: "radially-outward-away-from-carousel-center",
    insideRollerHardwareDirection: "radially-inward-toward-carousel-center",
    immediateHardwareRadialToCarouselCenter: true,
    radiusInferenceDisabled: true
  });

  function clampDirectionSign(item = {}) {
    return String(item?.side || "").toLowerCase() === "inner" ? -1 : 1;
  }

  // Deliberately do not wrap or replace Labeler3DWipeRollerModel here.
  // app/3d/models/wipe-roller.js is the sole geometry authority. It already
  // uses the same explicit rule: inner = -radial, outer = +radial.
  // This file now exists only to publish the locked machine rule and prevent
  // later pair/rail compatibility logic from changing clamp orientation.
  global.Labeler3DRollerPairMountAuthority = Object.freeze({
    MODEL_VERSION,
    rules: CLAMP_SIDE_RULES,
    clampDirectionSign,
    status() {
      return Object.freeze({
        modelVersion: MODEL_VERSION,
        compatibilityOnly: true,
        canonicalRollerModelPreserved: global.Labeler3DWipeRollerModel === baseModel,
        stationSideControlsClampDirection: true,
        outsideClampDirectionSign: 1,
        insideClampDirectionSign: -1,
        railGeometryRendered: false,
        extensionArmsRendered: false,
        risersRendered: false,
        immediateClampOwnedByCanonicalRollerModel: true,
        readOnly: true
      });
    }
  });
})(window);
