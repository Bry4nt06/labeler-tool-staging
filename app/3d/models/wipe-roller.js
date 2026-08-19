(function installServoForge3DWipeRollerModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.wipe-roller.v1";

  function matches(item = {}) {
    return String(item?.kind || "").toLowerCase() === "roller";
  }

  function create(THREE, item, geometry, context = {}) {
    return context.legacyFactory?.createEquipmentAssembly?.(THREE, item, geometry) || null;
  }

  global.Labeler3DWipeRollerModel = Object.freeze({
    id: "wipe-roller",
    MODEL_VERSION,
    matches,
    create,
    authority: Object.freeze({
      widthMm: 80,
      contact: "section-aware-neck-contact",
      mountingReference: "stored-but-hidden",
      renderOwnership: "models/wipe-roller.js",
      migrationState: "registry-routed-legacy-backed"
    })
  });
})(window);
