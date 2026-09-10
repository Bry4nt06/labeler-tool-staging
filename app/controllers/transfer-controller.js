"use strict";

(function installTransferController(global) {
  const actions = global.LabelerWorkspaceActionService;

  function exportJson() {
    const payload = {
      ...state,
      heads: actions.call("heads") || [],
      program: (actions.call("programSegments") || []).map((row) => actions.call("roundedServoExportRow", row) || row)
    };
    actions.call("download", "labeler-servo-map.json", "application/json", JSON.stringify(payload, null, 2));
  }

  function exportSettings() {
    actions.call("saveCurrentSettings");
    const portable = {
      format: "labeler-tool-portable-settings",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: actions.call("settingsSnapshot") || {}
    };
    actions.call("download", "labeler-tool-settings.json", "application/json", JSON.stringify(portable, null, 2));
  }

  function activeRpcMachineType() {
    try {
      const map = typeof activeMachineMap === "function" ? activeMachineMap() : null;
      return map?.machineType || state?.machineType || state?.selectedMachineType || "";
    } catch {
      return state?.machineType || state?.selectedMachineType || "";
    }
  }

  function rpcTableOutput(value, machineType) {
    const driver = global.LabelerTopModulRpcAngleDriver;
    const converted = driver?.physicalToRpcTableAngle?.(value, machineType);
    const result = Number.isFinite(converted) ? converted : Number(value);
    if (!Number.isFinite(result)) return value;
    return driver?.variant?.(machineType) === "dts3" ? result.toFixed(4) : (actions.call("oneDecimalOutput", result) ?? result);
  }

  function dts3ExportValues(row, machineType) {
    const driver = global.LabelerTopModulRpcAngleDriver;
    const target = driver?.dts3ElgaTarget?.(row, machineType);
    if (!target) return null;
    return {
      command: target.command,
      tablePosition: Number.isFinite(target.parameter1) ? target.parameter1.toFixed(4) : "",
      plateTarget: Number.isFinite(target.parameter2) ? (actions.call("oneDecimalOutput", target.parameter2) ?? target.parameter2) : ""
    };
  }

  function exportCsv() {
    const autocol = Boolean(actions.call("activeMachineUsesAutocolCommands"));
    const machineType = activeRpcMachineType();
    const rpcDriver = global.LabelerTopModulRpcAngleDriver;
    const dts3 = rpcDriver?.variant?.(machineType) === "dts3";
    const rows = [[
      "HMI",
      "PLC",
      autocol ? "Travel Command" : dts3 ? "DTS3 Command" : "CMD",
      dts3 ? "Parameter 1 / Table Position (DTS3 0-45)" : "Table Angle",
      dts3 ? "Parameter 2 / Absolute Plate Target" : "Plate Angle",
      "Table Travel",
      "Plate Travel",
      "Turn Speed",
      "Action"
    ]];
    (actions.call("programSegments", state.program) || []).forEach((row) => {
      const dts3Values = dts3ExportValues(row, machineType);
      rows.push([
        row.hmi,
        row.plc,
        autocol
          ? actions.call("autocolCommandLabel", row)
          : dts3
            ? (rpcDriver?.rpcCommandLabel?.(row, machineType) ?? row.cmd)
            : row.cmd,
        dts3Values?.tablePosition ?? rpcTableOutput(row.tableAngle, machineType),
        dts3Values?.plateTarget ?? (actions.call("oneDecimalOutput", row.plateAngle) ?? row.plateAngle),
        rpcTableOutput(row.tableTravel, machineType),
        actions.call("oneDecimalOutput", row.plateTravel) ?? row.plateTravel,
        actions.call("oneDecimalOutput", row.absSpeed) ?? row.absSpeed,
        row.action
      ]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    actions.call("download", "labeler-servo-program.csv", "text/csv", csv);
  }

  function importSettings(file) {
    actions.call("importPortableSettingsFile", file);
  }

  function importFaultConfig(file) {
    actions.call("importFaultConfigFile", file);
  }

  function saveSettings() {
    actions.call("saveCurrentSettings");
  }

  function checkForUpdates() {
    actions.call("checkForToolUpdates");
  }

  function exportMachineMap() {
    actions.call("exportSelectedMachineMap");
  }

  global.LabelerTransferController = Object.freeze({
    exportJson,
    exportSettings,
    exportCsv,
    importSettings,
    importFaultConfig,
    saveSettings,
    checkForUpdates,
    exportMachineMap
  });
})(window);