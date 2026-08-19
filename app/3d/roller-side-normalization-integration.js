(function installServoForge3DRollerSideNormalization(global) {
  "use strict";

  const baseAdapter = global.Labeler3DEquipmentLayoutAdapter;
  if (!baseAdapter?.snapshot) {
    throw new Error("ServoForge roller side normalization requires the equipment layout adapter.");
  }

  const PATCH_VERSION = "servoforge.3d-roller-side-normalization.v1";

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
    const base = baseAdapter.snapshot(machineMap, stateLike, geometry, options);
    const rawObjects = Array.isArray(machineMap?.objects) ? machineMap.objects : [];
    const objects = (Array.isArray(base?.objects) ? base.objects : []).map((item, index) => {
      if (String(item?.kind || "").toLowerCase() !== "roller") return item;
      const raw = rawObjects.find((candidate) => String(candidate?.id || "") === String(item?.id || "")) || rawObjects[index] || {};
      const rawSide = raw?.side ?? raw?.mountSide ?? raw?.rollerSide ?? item?.side;
      const side = normalizeSide(rawSide, item?.side);
      return freeze({
        ...item,
        side,
        rawSideValue: rawSide == null ? "" : String(rawSide),
        sideAuthority: "normalized-machine-map-roller-side",
        rollerHardwareDirection: side === "inner" ? "inside" : "outside"
      });
    });

    return freeze({
      ...base,
      schemaVersion: `${base?.schemaVersion || "servoforge.3d-equipment"}+roller-side-normalized`,
      patchVersion: PATCH_VERSION,
      objects,
      rollerSideAuthority: Object.freeze({
        insideTermsNormalizeTo: "inner",
        outsideTermsNormalizeTo: "outer",
        innerHardwareDirection: "inside",
        outerHardwareDirection: "outside"
      })
    });
  }

  global.Labeler3DEquipmentLayoutAdapter = Object.freeze({
    ...baseAdapter,
    PATCH_VERSION,
    normalizeRollerSide: normalizeSide,
    snapshot
  });

  global.Labeler3DRollerSideNormalization = Object.freeze({
    PATCH_VERSION,
    normalizeSide,
    status() {
      return Object.freeze({
        patchVersion: PATCH_VERSION,
        inside: "inner",
        outside: "outer",
        readOnly: true
      });
    }
  });
})(window);
