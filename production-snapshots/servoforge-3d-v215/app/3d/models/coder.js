(function installServoForge3DCoderModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.coder.v1";

  function matches(item = {}) {
    const kind = String(item?.kind || "").toLowerCase();
    return kind === "coding" || kind === "coder" || kind === "laser-coder";
  }

  function create(THREE, item, geometry, context = {}) {
    return context.legacyFactory?.createEquipmentAssembly?.(THREE, item, geometry) || null;
  }

  global.Labeler3DCoderModel = Object.freeze({
    id: "coder",
    MODEL_VERSION,
    matches,
    create,
    authority: Object.freeze({
      aim: "radially-to-carousel-center",
      bottleSurfaceSetbackMm: 190,
      housingHeightInches: 26,
      lensDiameterInches: 3,
      renderOwnership: "models/coder.js",
      migrationState: "registry-routed-legacy-backed"
    })
  });
})(window);
