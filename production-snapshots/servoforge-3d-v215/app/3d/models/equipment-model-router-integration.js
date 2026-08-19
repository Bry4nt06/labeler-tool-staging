(function installServoForge3DEquipmentModelRouter(global) {
  "use strict";

  const legacyFactory = global.Labeler3DHardwareMeshFactory;
  const registry = global.Labeler3DModelRegistry;
  if (!legacyFactory?.createEquipmentAssembly || !registry?.resolveEquipment) {
    throw new Error("ServoForge 3D model router requires the active hardware factory and model registry.");
  }

  const ROUTER_VERSION = "servoforge.3d-equipment-model-router.v3-spender-arm-family-cleanup";
  const SPENDER_APPLICATION_ARM_NAMES = Object.freeze(new Set([
    "ServoForgeSpenderPhotoApplicationArmExtrusion",
    "ServoForgeABLabelApplicationArm",
    "ServoForgeKronesABArmSection",
    "ServoForgeKronesABArmMeasuringTape"
  ]));

  function disposeObject(object) {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
      const disposeMaterial = (entry) => entry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    });
  }

  function isSpenderApplicationArmNode(child) {
    const name = String(child?.name || "");
    if (!name || name.includes("Knuckle")) return false;
    if (SPENDER_APPLICATION_ARM_NAMES.has(name)) return true;
    return /ApplicationArm|ABArm/.test(name);
  }

  function stripSpenderApplicationArm(root) {
    if (!root?.traverse) return 0;
    const targets = [];
    root.traverse((child) => {
      if (isSpenderApplicationArmNode(child)) targets.push(child);
    });

    const targetSet = new Set(targets);
    const roots = targets.filter((target) => {
      let parent = target?.parent;
      while (parent) {
        if (targetSet.has(parent)) return false;
        parent = parent.parent;
      }
      return true;
    });

    roots.forEach((target) => {
      target.parent?.remove(target);
      disposeObject(target);
    });

    root.userData.spenderApplicationArm = Object.freeze({
      rendered: false,
      removedCount: roots.length,
      removalAuthority: "user-directed-remove-all-application-arm-variants-only",
      removalMatcher: "ApplicationArm-or-ABArm-excluding-Knuckle",
      spenderPlatePreserved: true,
      knucklePreserved: true
    });
    return roots.length;
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
        spenderApplicationArmFamilyCleanup: true,
        plannerWrites: false,
        servoWrites: false
      });
    }
  });
})(window);
