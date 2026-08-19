(function installServoForge3DStarWheelModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.star-wheel.v1";

  function create(THREE, wheel, geometry, context = {}) {
    if (typeof context.createLegacyStarWheel !== "function") return null;
    return context.createLegacyStarWheel(THREE, wheel, geometry, context.options || {});
  }

  global.Labeler3DStarWheelModel = Object.freeze({
    id: "star-wheel",
    MODEL_VERSION,
    create,
    authority: Object.freeze({
      motion: "bottle-handling-transfer-synchronization",
      layout: "measured-star-layout-plus-transfer-anchors",
      renderOwnership: "models/star-wheel.js",
      migrationState: "registered-legacy-backed"
    })
  });
})(window);
