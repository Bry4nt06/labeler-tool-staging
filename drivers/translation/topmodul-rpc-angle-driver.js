"use strict";

(function installTopModulRpcAngleDriver(global) {
  if (global.LabelerTopModulRpcAngleDriver) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LabelerTopModulRpcAngleDriver;
    return;
  }
  const DTS3_PHYSICAL_DEG_PER_RPC_DEG = 8;
  function finite(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  function token(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  }
  function variant(machineType) {
    const identity = token(machineType);
    if (!identity.includes("TOPMODUL")) return "";
    if (identity.includes("DTS3")) return "dts3";
    return "dts4";
  }
  function fullRpcTableRotation(machineType) {
    return variant(machineType) === "dts3" ? 45 : 360;
  }
  function physicalToRpcTableAngle(value, machineType) {
    const angle = finite(value);
    if (!Number.isFinite(angle)) return angle;
    return variant(machineType) === "dts3" ? angle / DTS3_PHYSICAL_DEG_PER_RPC_DEG : angle;
  }
  function rpcToPhysicalTableAngle(value, machineType) {
    const angle = finite(value);
    if (!Number.isFinite(angle)) return angle;
    return variant(machineType) === "dts3" ? angle * DTS3_PHYSICAL_DEG_PER_RPC_DEG : angle;
  }
  function displayDigits(machineType) {
    return variant(machineType) === "dts3" ? 4 : 1;
  }
  const api = Object.freeze({
    DTS3_PHYSICAL_DEG_PER_RPC_DEG,
    variant,
    fullRpcTableRotation,
    physicalToRpcTableAngle,
    rpcToPhysicalTableAngle,
    displayDigits
  });
  global.LabelerTopModulRpcAngleDriver = api;
  global.LabelerDriverRegistry?.register?.("translation.topmodulRpcAngle", api, {
    version: 1,
    responsibilities: ["topmodul-dts-version", "rpc-table-angle-presentation", "dts3-45-degree-command-domain"]
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
