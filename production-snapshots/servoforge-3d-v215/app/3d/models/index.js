(function installServoForge3DModelRegistry(global) {
  "use strict";

  const REGISTRY_VERSION = "servoforge.3d-model-registry.v1";

  const models = Object.freeze({
    bottle: global.Labeler3DBottleModel || null,
    starWheel: global.Labeler3DStarWheelModel || null,
    spender: global.Labeler3DSpenderModel || null,
    wipePad: global.Labeler3DWipePadModel || null,
    wipeRoller: global.Labeler3DWipeRollerModel || null,
    coder: global.Labeler3DCoderModel || null
  });

  const equipmentModels = Object.freeze([
    models.wipeRoller,
    models.coder,
    models.wipePad,
    models.spender
  ].filter(Boolean));

  function resolveEquipment(item = {}) {
    return equipmentModels.find((model) => model?.matches?.(item)) || null;
  }

  function status() {
    return Object.freeze({
      registryVersion: REGISTRY_VERSION,
      modelIds: Object.freeze(Object.values(models).filter(Boolean).map((model) => model.id)),
      equipmentRouting: true,
      servoMutationAllowed: false,
      canonicalFolder: "app/3d/models"
    });
  }

  global.Labeler3DModelRegistry = Object.freeze({
    REGISTRY_VERSION,
    models,
    equipmentModels,
    resolveEquipment,
    status
  });
})(window);
