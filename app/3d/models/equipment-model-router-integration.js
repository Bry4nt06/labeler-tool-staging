(function installServoForge3DEquipmentModelRouter(global) {
  "use strict";

  const legacyFactory = global.Labeler3DHardwareMeshFactory;
  const registry = global.Labeler3DModelRegistry;
  if (!legacyFactory?.createEquipmentAssembly || !registry?.resolveEquipment) {
    throw new Error("ServoForge 3D model router requires the active hardware factory and model registry.");
  }

  const ROUTER_VERSION = "servoforge.3d-equipment-model-router.v1";

  function createEquipmentAssembly(THREE, item, geometry) {
    const model = registry.resolveEquipment(item);
    if (!model?.create) return legacyFactory.createEquipmentAssembly(THREE, item, geometry);
    return model.create(THREE, item, geometry, {
      legacyFactory,
      registry,
      routerVersion: ROUTER_VERSION
    }) || legacyFactory.createEquipmentAssembly(THREE, item, geometry);
  }

  global.Labeler3DHardwareMeshFactory = Object.freeze({
    ...legacyFactory,
    FACTORY_VERSION: `${legacyFactory.FACTORY_VERSION || "servoforge.3d-hardware-mesh"}+model-router`,
    MODEL_ROUTER_VERSION: ROUTER_VERSION,
    MODEL_REGISTRY_VERSION: registry.REGISTRY_VERSION,
    createEquipmentAssembly
  });

  global.Labeler3DEquipmentModelRouter = Object.freeze({
    ROUTER_VERSION,
    MODEL_REGISTRY_VERSION: registry.REGISTRY_VERSION,
    resolveEquipment: registry.resolveEquipment,
    status() {
      return Object.freeze({
        routerVersion: ROUTER_VERSION,
        registryVersion: registry.REGISTRY_VERSION,
        legacyFactoryCaptured: true,
        visualCompatibilityMode: true,
        plannerWrites: false,
        servoWrites: false
      });
    }
  });
})(window);
