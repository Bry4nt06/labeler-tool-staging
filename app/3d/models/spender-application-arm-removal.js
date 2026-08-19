(function installServoForge3DSpenderApplicationArmRemoval(global) {
  "use strict";

  const baseModel = global.Labeler3DSpenderModel;
  if (!baseModel?.create) {
    throw new Error("ServoForge spender application-arm removal requires the canonical spender model.");
  }

  const PATCH_VERSION = "servoforge.3d-model.spender-arm-removal.v1";
  const APPLICATION_ARM_GROUP = "ServoForgeSpenderPhotoApplicationArmExtrusion";

  function disposeObject(object) {
    object?.traverse?.((child) => {
      child.geometry?.dispose?.();
      const disposeMaterial = (entry) => entry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    });
  }

  function removeApplicationArm(root) {
    if (!root?.traverse) return 0;
    const targets = [];
    root.traverse((child) => {
      if (child?.name === APPLICATION_ARM_GROUP) targets.push(child);
    });
    targets.forEach((target) => {
      target.parent?.remove(target);
      disposeObject(target);
    });
    return targets.length;
  }

  function create(THREE, item, geometry, context = {}) {
    const group = baseModel.create(THREE, item, geometry, context);
    if (!group) return group;
    const removedCount = removeApplicationArm(group);
    group.userData.spenderApplicationArm = Object.freeze({
      rendered: false,
      removedCount,
      removalAuthority: "user-directed-remove-application-arm-only",
      spenderPlatePreserved: true,
      knucklePreserved: true,
      placementPreserved: true,
      servoAuthorityUntouched: true,
      plannerAuthorityUntouched: true
    });
    return group;
  }

  global.Labeler3DSpenderModel = Object.freeze({
    ...baseModel,
    MODEL_VERSION: `${baseModel.MODEL_VERSION || "servoforge.3d-model.spender"}+arm-hidden`,
    PATCH_VERSION,
    create,
    renderPolicy: Object.freeze({
      applicationArmVisible: false,
      spenderPlateVisible: true,
      knuckleVisible: true
    })
  });
})(window);
