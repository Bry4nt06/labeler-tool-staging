"use strict";

(function installTopModulRpcAngleDriver(global) {
  if (global.LabelerTopModulRpcAngleDriver) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LabelerTopModulRpcAngleDriver;
    return;
  }
  const DTS3_PHYSICAL_DEG_PER_RPC_DEG = 8;
  const DTS3_ELGA_COMMAND = "ELGa";
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
  function isDts3(machineType) {
    return variant(machineType) === "dts3";
  }
  function fullRpcTableRotation(machineType) {
    return isDts3(machineType) ? 45 : 360;
  }
  function physicalToRpcTableAngle(value, machineType) {
    const angle = finite(value);
    if (!Number.isFinite(angle)) return angle;
    return isDts3(machineType) ? angle / DTS3_PHYSICAL_DEG_PER_RPC_DEG : angle;
  }
  function rpcToPhysicalTableAngle(value, machineType) {
    const angle = finite(value);
    if (!Number.isFinite(angle)) return angle;
    return isDts3(machineType) ? angle * DTS3_PHYSICAL_DEG_PER_RPC_DEG : angle;
  }
  function displayDigits(machineType) {
    return isDts3(machineType) ? 4 : 1;
  }
  function rpcCommandLabel(rowOrCommand, machineType) {
    const command = Number(typeof rowOrCommand === "object" ? rowOrCommand?.cmd : rowOrCommand);
    if (!isDts3(machineType)) return Number.isFinite(command) ? command : rowOrCommand;
    if (command === 7) return DTS3_ELGA_COMMAND;
    if (command === 3) return "Rest";
    return Number.isFinite(command) ? `CMD ${command}` : String(rowOrCommand ?? "");
  }
  function elgaAbsoluteTravel(previousPlateAngle, absoluteTargetAngle) {
    const previous = finite(previousPlateAngle);
    const target = finite(absoluteTargetAngle);
    return Number.isFinite(previous) && Number.isFinite(target) ? target - previous : NaN;
  }
  function dts3ElgaTarget(row, machineType) {
    if (!isDts3(machineType) || Number(row?.cmd) !== 7) return null;
    const startTable = finite(row?.tableAngle);
    const tableTravel = finite(row?.tableTravel);
    const startPlate = finite(row?.plateAngle);
    const plateTravel = finite(row?.plateTravel);
    const targetPhysicalTable = Number.isFinite(startTable) && Number.isFinite(tableTravel)
      ? startTable + tableTravel
      : NaN;
    const absolutePlateTarget = Number.isFinite(startPlate) && Number.isFinite(plateTravel)
      ? startPlate + plateTravel
      : NaN;
    return Object.freeze({
      command: DTS3_ELGA_COMMAND,
      parameter1: physicalToRpcTableAngle(targetPhysicalTable, machineType),
      parameter1Unit: "clock/fine-clock impulses represented by DTS3 table position",
      parameter2: absolutePlateTarget,
      parameter2Unit: "degrees",
      parameter2Mode: "absolute",
      startTablePosition: physicalToRpcTableAngle(startTable, machineType),
      startPlateAngle: startPlate,
      plateTravel: elgaAbsoluteTravel(startPlate, absolutePlateTarget)
    });
  }
  const api = Object.freeze({
    DTS3_PHYSICAL_DEG_PER_RPC_DEG,
    DTS3_ELGA_COMMAND,
    variant,
    isDts3,
    fullRpcTableRotation,
    physicalToRpcTableAngle,
    rpcToPhysicalTableAngle,
    displayDigits,
    rpcCommandLabel,
    elgaAbsoluteTravel,
    dts3ElgaTarget
  });
  global.LabelerTopModulRpcAngleDriver = api;
  global.LabelerDriverRegistry?.register?.("translation.topmodulRpcAngle", api, {
    version: 2,
    responsibilities: ["topmodul-dts-version", "rpc-table-angle-presentation", "dts3-45-degree-command-domain", "dts3-elga-absolute-command-translation"]
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
