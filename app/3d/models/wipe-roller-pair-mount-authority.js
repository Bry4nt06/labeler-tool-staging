(function installServoForge3DRollerPairMountAuthority(global) {
  "use strict";

  const baseModel = global.Labeler3DWipeRollerModel;
  if (!baseModel?.create) {
    throw new Error("ServoForge roller pair mount compatibility requires the wipe roller model.");
  }

  const MODEL_VERSION = "servoforge.3d-model.wipe-roller-pair-mount.v2-reference-only-disabled";
  const PAIR_MOUNT_RULES = Object.freeze({
    source: "user-machine-rule-2026-08-19-clamp-only",
    railGeometryRendered: false,
    pairRailRendered: false,
    extensionArmsRendered: false,
    risersRendered: false,
    immediateClampOwnedByCanonicalRollerModel: true,
    rollerIsBottleFacingTerminal: true,
    mountingHardwareExtendsAwayFromBottle: true,
    compatibilityOnly: true
  });

  // This file intentionally no longer wraps or replaces Labeler3DWipeRollerModel.
  // The canonical app/3d/models/wipe-roller.js model is the sole rendering
  // authority for rollers. Pair rails and long mounting hardware remain stored
  // only as historical/photo reference and are not created in the scene.
  global.Labeler3DRollerPairMountAuthority = Object.freeze({
    MODEL_VERSION,
    rules: PAIR_MOUNT_RULES,
    status() {
      return Object.freeze({
        modelVersion: MODEL_VERSION,
        compatibilityOnly: true,
        canonicalRollerModelPreserved: global.Labeler3DWipeRollerModel === baseModel,
        railGeometryRendered: false,
        extensionArmsRendered: false,
        risersRendered: false,
        immediateClampOwnedByCanonicalRollerModel: true,
        readOnly: true
      });
    }
  });
})(window);
