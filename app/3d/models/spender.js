(function installServoForge3DSpenderModel(global) {
  "use strict";

  const MODEL_VERSION = "servoforge.3d-model.spender.v1";

  function matches(item = {}) {
    const kind = String(item?.kind || "").toLowerCase();
    return kind === "aggregate" || kind === "spender" || Number.isFinite(Number(item?.aggregate));
  }

  function create(THREE, item, geometry, context = {}) {
    return context.legacyFactory?.createEquipmentAssembly?.(THREE, item, geometry) || null;
  }

  global.Labeler3DSpenderModel = Object.freeze({
    id: "spender",
    MODEL_VERSION,
    matches,
    create,
    authority: Object.freeze({
      placement: "machine-map-angle-plus-flow-tangent",
      contact: "bottle-facing-surface-plus-2mm-clearance",
      renderOwnership: "models/spender.js",
      migrationState: "registry-routed-legacy-backed"
    })
  });
})(window);
