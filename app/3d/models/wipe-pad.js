(function installServoForge3DWipePadModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.wipe-pad.v1";

  function matches(item = {}) {
    const kind = String(item?.kind || "").toLowerCase();
    return kind === "pad" || kind === "wipe-pad" || kind === "wipepad";
  }

  function create(THREE, item, geometry, context = {}) {
    return context.legacyFactory?.createEquipmentAssembly?.(THREE, item, geometry) || null;
  }

  global.Labeler3DWipePadModel = Object.freeze({
    id: "wipe-pad",
    MODEL_VERSION,
    matches,
    create,
    authority: Object.freeze({
      dimensions: "measured-70mm-height-18mm-sponge-4mm-backing",
      contact: "measured-2mm-penetration",
      renderOwnership: "models/wipe-pad.js",
      migrationState: "registry-routed-legacy-backed"
    })
  });
})(window);
