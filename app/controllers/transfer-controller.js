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

  function exportCsv() {
    const autocol = Boolean(actions.call("activeMachineUsesAutocolCommands"));
    const machineType = activeRpcMachineType();
    const dts3 = global.LabelerTopModulRpcAngleDriver?.variant?.(machineType) === "dts3";
    const rows = [[
      "HMI",
      "PLC",
      autocol ? "Travel Command" : "CMD",
      dts3 ? "Table Angle (DTS3 0-45)" : "Table Angle",
      "Plate Angle",
      "Table Travel",
      "Plate Travel",
      "Turn Speed",
      "Action"
    ]];
    (actions.call("programSegments", state.program) || []).forEach((row) => rows.push([
      row.hmi,
      row.plc,
      autocol ? actions.call("autocolCommandLabel", row) : row.cmd,
      rpcTableOutput(row.tableAngle, machineType),
      actions.call("oneDecimalOutput", row.plateAngle) ?? row.plateAngle,
      rpcTableOutput(row.tableTravel, machineType),
      actions.call("oneDecimalOutput", row.plateTravel) ?? row.plateTravel,
      actions.call("oneDecimalOutput", row.absSpeed) ?? row.absSpeed,
      row.action
    ]));
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