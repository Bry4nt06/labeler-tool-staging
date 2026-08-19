(function installServoForge3DBottleModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.bottle.v1";

  function create(THREE, geometry, context = {}) {
    if (typeof context.createLegacyBottle !== "function") return null;
    return context.createLegacyBottle(THREE, geometry, context.options || {});
  }

  global.Labeler3DBottleModel = Object.freeze({
    id: "bottle",
    MODEL_VERSION,
    create,
    authority: Object.freeze({
      motion: "servoforge-normalized-replay-frame",
      dimensions: "active-bottle-spec-plus-physical-geometry-adapter",
      renderOwnership: "models/bottle.js",
      migrationState: "registered-legacy-backed"
    })
  });
})(window);
