"use strict";

function activeServoCommandMachineType() {
  const machineMap = typeof activeMachineMap === "function" ? activeMachineMap() : null;
  return machineMap?.machineType || state?.machineType || state?.selectedMachineType || "";
}

function activeMachineUsesAutocolCommands() {
  return String(activeServoCommandMachineType() || "").toLowerCase() === "autocol";
}

function activeMachineUsesDts3Commands() {
  return window.LabelerTopModulRpcAngleDriver?.variant?.(activeServoCommandMachineType()) === "dts3";
}

function autocolCommandLabel(row) {
  if (row.autocolBoundary === "start-shape") return "Spec.-shap. plate corners";
  if (row.autocolBoundary === "end-curve") return "End of curve";
  return Number(row.cmd) === 7 ? "Correction" : "Rest";
}

function dts3CommandLabel(row) {
  return window.LabelerTopModulRpcAngleDriver?.rpcCommandLabel?.(row, activeServoCommandMachineType())
    ?? (Number(row?.cmd) === 7 ? "ELGa" : "Rest");
}

function servoCommandHeading() {
  if (activeMachineUsesDts3Commands()) return "DTS3 command";
  return activeMachineUsesAutocolCommands() ? "Travel command" : "CMD";
}

function servoCommandControl(row, allowAutocolBoundaries = false, attributes = "") {
  const extra = attributes ? ` ${attributes}` : "";
  if (activeMachineUsesDts3Commands()) {
    const value = Number(row?.cmd) === 7 ? "7" : "3";
    const title = value === "7"
      ? "ELGa — Electronic gear, absolute. Parameter 1 is the target table position and Parameter 2 is the absolute plate-angle target; the previous plate position is carried into the move."
      : "Stopped reference used by ServoForge's internal 3/7 motion model. DTS3 motion commands are translated at the RPC boundary.";
    return `<select class="compact-input"${extra} title="${title}"><option value="3"${value === "3" ? " selected" : ""}>Rest / reference</option><option value="7"${value === "7" ? " selected" : ""}>ELGa</option></select>`;
  }
  if (!activeMachineUsesAutocolCommands()) {
    return `<input class="num compact-input"${extra} type="number" step="1" value="${row.cmd}">`;
  }
  if (!allowAutocolBoundaries && (row.autocolBoundary === "start-shape" || row.autocolBoundary === "end-curve")) {
    return `<select class="compact-input"${extra} disabled><option value="${row.cmd}">${autocolCommandLabel(row)}</option></select>`;
  }
  if (allowAutocolBoundaries && (row.autocolBoundary === "start-shape" || row.autocolBoundary === "end-curve")) {
    return `<select class="compact-input"${extra} disabled><option>${autocolCommandLabel(row)}</option></select>`;
  }
  const value = row.autocolBoundary === "start-shape" ? "start-shape" : row.autocolBoundary === "end-curve" ? "end-curve" : String(Number(row.cmd) === 7 ? 7 : 3);
  return `<select class="compact-input"${extra}>${allowAutocolBoundaries ? `<option value="start-shape"${value === "start-shape" ? " selected" : ""}>Spec.-shap. plate corners</option>` : ""}<option value="3"${value === "3" ? " selected" : ""}>Rest</option><option value="7"${value === "7" ? " selected" : ""}>Correction</option>${allowAutocolBoundaries ? `<option value="end-curve"${value === "end-curve" ? " selected" : ""}>End of curve</option>` : ""}</select>`;
}

window.LabelerServoCommandPresentation = Object.freeze({
  activeServoCommandMachineType,
  activeMachineUsesAutocolCommands,
  activeMachineUsesDts3Commands,
  autocolCommandLabel,
  dts3CommandLabel,
  servoCommandHeading,
  servoCommandControl
});
