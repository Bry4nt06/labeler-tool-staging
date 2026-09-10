"use strict";

(function installTopModulDtsMachineVariant(global) {
  if (global.LabelerTopModulMachineVariant) return;
  const MACHINE_TYPES = Object.freeze([
    "TopMatic",
    "Autocol",
    "TopModul (DTS4)",
    "TopModul (DTS3)",
    "MultiModul"
  ]);
  function canonicalMachineType(value) {
    const raw = String(value || "").trim();
    const token = raw.toUpperCase().replace(/[^A-Z0-9]+/g, "");
    if (token === "TOPMODUL") return "TopModul (DTS4)";
    if (token.includes("TOPMODUL") && token.includes("DTS3")) return "TopModul (DTS3)";
    if (token.includes("TOPMODUL") && token.includes("DTS4")) return "TopModul (DTS4)";
    return raw;
  }
  function migrateState() {
    if (typeof state === "undefined" || !state) return false;
    let changed = false;
    state.machineTypes = MACHINE_TYPES.slice();
    for (const field of ["machineType", "selectedMachineType"]) {
      if (!(field in state)) continue;
      const next = canonicalMachineType(state[field]);
      if (next && next !== state[field]) {
        state[field] = next;
        changed = true;
      }
    }
    for (const map of Array.isArray(state.mapLibrary) ? state.mapLibrary : []) {
      if (!map || typeof map !== "object") continue;
      const next = canonicalMachineType(map.machineType);
      if (next && next !== map.machineType) {
        map.machineType = next;
        changed = true;
      }
    }
    return changed;
  }
  const api = Object.freeze({ MACHINE_TYPES, canonicalMachineType, migrateState });
  global.LabelerTopModulMachineVariant = api;
  migrateState();
})(window);
