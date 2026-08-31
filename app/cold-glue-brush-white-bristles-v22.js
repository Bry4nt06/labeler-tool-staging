(function installServoForgeColdGlueBrushWhiteBristles(global) {
  "use strict";

  const INTEGRATION_VERSION = "servoforge.cold-glue-brush-white-bristles.v22";
  const WHITE = "#ffffff";
  const WHITE_SHADE = "#dedede";

  function recolorTopDownBrushes(layer) {
    if (!layer?.querySelectorAll) return;
    layer.querySelectorAll("[data-cold-glue-brush-visual]").forEach((group) => {
      const paths = group.querySelectorAll("path");
      if (paths[1]) {
        paths[1].setAttribute("fill", WHITE);
        paths[1].setAttribute("stroke", "#d3d3d3");
      }
      group.querySelectorAll("line").forEach((line, index) => {
        line.setAttribute("stroke", index % 2 ? WHITE_SHADE : WHITE);
        line.setAttribute("stroke-opacity", index % 2 ? "0.72" : "0.94");
      });
      group.setAttribute("data-bristle-color", "white");
    });
  }

  function installTopDownOverride() {
    if (typeof drawConfiguredAssemblies !== "function" || global.__ServoForgeColdGlueWhiteBristlesTopDownInstalled) return;
    const previousDrawConfiguredAssemblies = drawConfiguredAssemblies;
    drawConfiguredAssemblies = function drawConfiguredAssembliesWithWhiteColdGlueBristles(add, layer) {
      previousDrawConfiguredAssemblies(add, layer);
      if (state?.applicationMode === "cold-glue") recolorTopDownBrushes(layer);
    };
    global.__ServoForgeColdGlueWhiteBristlesTopDownInstalled = true;
  }

  function recolor3DBrush(group) {
    if (!group?.traverse) return group;
    group.traverse((node) => {
      if (!node?.isMesh || !node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        const current = material?.color?.getHex?.();
        if (node.name === "ServoForgeColdGlueBrushBristles" || current === 0xeee8d5) {
          material.color?.setHex?.(0xffffff);
          material.roughness = 0.98;
          material.metalness = 0;
          material.needsUpdate = true;
        } else if (current === 0xcfc5aa) {
          material.color?.setHex?.(0xe2e2e2);
          material.roughness = 1.0;
          material.metalness = 0;
          material.needsUpdate = true;
        }
      });
    });
    group.userData.bristleColor = "white";
    return group;
  }

  function install3DOverride() {
    const previousFactory = global.Labeler3DHardwareMeshFactory;
    if (!previousFactory || global.__ServoForgeColdGlueWhiteBristles3DInstalled) return;

    function createBrushAssembly(THREE, item, geometry) {
      const group = previousFactory.createBrushAssembly?.(THREE, item, geometry) || null;
      return recolor3DBrush(group);
    }

    function createEquipmentAssembly(THREE, item, geometry) {
      const group = previousFactory.createEquipmentAssembly?.(THREE, item, geometry) || null;
      if (item?.kind === "brush" || item?.kind === "brush-channel") recolor3DBrush(group);
      return group;
    }

    global.Labeler3DHardwareMeshFactory = Object.freeze({
      ...previousFactory,
      FACTORY_VERSION: `${previousFactory.FACTORY_VERSION || "servoforge.3d-hardware-mesh"}+white-bristles-v22`,
      createBrushAssembly,
      createEquipmentAssembly
    });
    global.__ServoForgeColdGlueWhiteBristles3DInstalled = true;
  }

  installTopDownOverride();
  install3DOverride();

  global.ServoForgeColdGlueBrushWhiteBristles = Object.freeze({
    INTEGRATION_VERSION,
    color: WHITE,
    installTopDownOverride,
    install3DOverride
  });
})(window);
