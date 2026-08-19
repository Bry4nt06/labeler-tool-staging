(function installServoForge3DEquipmentModelRouter(global) {
  "use strict";

  const legacyFactory = global.Labeler3DHardwareMeshFactory;
  const registry = global.Labeler3DModelRegistry;
  if (!legacyFactory?.createEquipmentAssembly || !registry?.resolveEquipment) {
    throw new Error("ServoForge 3D model router requires the active hardware factory and model registry.");
  }

  const ROUTER_VERSION = "servoforge.3d-equipment-model-router.v2-render-cleanup";
  const SPENDER_APPLICATION_ARM_GROUP = "ServoForgeSpenderPhotoApplicationArmExtrusion";

  function disposeObject(object) {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
      const disposeMaterial = (entry) => entry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    });
  }

  function stripSpenderApplicationArm(root) {
    if (!root?.traverse) return 0;
    const targets = [];
    root.traverse((child) => {
      if (child?.name === SPENDER_APPLICATION_ARM_GROUP) targets.push(child);
    });
    targets.forEach((target) => {
      target.parent?.remove(target);
      disposeObject(target);
    });
    if (targets.length) {
      root.userData.spenderApplicationArm = Object.freeze({
        rendered: false,
        removedCount: targets.length,
        removalAuthority: "user-directed-remove-application-arm-only",
        spenderPlatePreserved: true,
        knucklePreserved: true
      });
    }
    return targets.length;
  }

  function createEquipmentAssembly(THREE, item, geometry) {
    const model = registry.resolveEquipment(item);
    if (!model?.create) return legacyFactory.createEquipmentAssembly(THREE, item, geometry);
    const result = model.create(THREE, item, geometry, {
      legacyFactory,
      registry,
      routerVersion: ROUTER_VERSION
    }) || legacyFactory.createEquipmentAssembly(THREE, item, geometry);
    if (model.id === "spender") stripSpenderApplicationArm(result);
    return result;
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
    stripSpenderApplicationArm,
    status() {
      return Object.freeze({
        routerVersion: ROUTER_VERSION,
        registryVersion: registry.REGISTRY_VERSION,
        legacyFactoryCaptured: true,
        visualCompatibilityMode: true,
        spenderApplicationArmRendered: false,
        plannerWrites: false,
        servoWrites: false
      });
    }
  });
})(window);
