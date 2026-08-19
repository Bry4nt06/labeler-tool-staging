(function installServoForge3DRollerSideCompatibility(global) {
  "use strict";

  const baseEquipmentAdapter = global.Labeler3DEquipmentLayoutAdapter;
  if (!baseEquipmentAdapter?.snapshot) {
    throw new Error("ServoForge roller side compatibility requires the equipment layout adapter.");
  }

  const PATCH_VERSION = "servoforge.3d-roller-side-compatibility.v2";

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function normalizeSide(value, fallback = "outer") {
    const raw = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (["inner", "inside", "internal", "nonop", "nonoperator", "nonoperatorside"].includes(raw)) return "inner";
    if (["outer", "outside", "external", "op", "operator", "operatorside"].includes(raw)) return "outer";
    return fallback === "inner" ? "inner" : "outer";
  }

  function snapshot(machineMap, stateLike, geometry, options = {}) {
    const base = baseEquipmentAdapter.snapshot(machineMap, stateLike, geometry, options);
    const rawObjects = Array.isArray(machineMap?.objects) ? machineMap.objects : [];
    const byId = new Map(rawObjects.map((item) => [String(item?.id || ""), item]));

    const objects = (Array.isArray(base?.objects) ? base.objects : []).map((item, index) => {
      if (String(item?.kind || "").toLowerCase() !== "roller") return item;
      const raw = byId.get(String(item?.id || "")) || rawObjects[index] || {};
      const rawSide = raw?.side ?? raw?.mountSide ?? raw?.rollerSide ?? item?.side;
      const side = normalizeSide(rawSide, item?.side);
      return freeze({
        ...item,
        side,
        rawSideValue: rawSide == null ? "" : String(rawSide),
        sideAuthority: "normalized-active-machine-map-roller-side",
        rollerHardwareDirection: side === "inner" ? "inside" : "outside",
        sharedRollerMount: null
      });
    });

    return freeze({
      ...base,
      schemaVersion: `${base?.schemaVersion || "servoforge.3d-equipment"}+roller-side-compatible`,
      patchVersion: PATCH_VERSION,
      objects,
      sharedRollerMounting: null,
      rollerSideAuthority: Object.freeze({
        outsideRollerHardwareDirection: "outside",
        insideRollerHardwareDirection: "inside",
        staleSharedBracketGroupingRemoved: true,
        geometryCreatedByThisLayer: false
      })
    });
  }

  global.Labeler3DEquipmentLayoutAdapter = Object.freeze({
    ...baseEquipmentAdapter,
    PATCH_VERSION,
    normalizeRollerSide: normalizeSide,
    snapshot
  });

  global.Labeler3DRollerSharedBracketRefinement = Object.freeze({
    PATCH_VERSION,
    compatibilityOnly: true,
    geometryCreated: false,
    normalizeSide,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        compatibilityOnly: true,
        geometryCreated: false,
        sharedBracketGroupingRemoved: true,
        outside: "outer",
        inside: "inner",
        readOnly: true
      });
    }
  });
})(window);
