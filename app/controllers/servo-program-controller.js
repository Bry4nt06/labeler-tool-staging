"use strict";

(function installServoProgramController(global) {
  const actions = global.LabelerWorkspaceActionService;

  function rowForHmi(hmi) {
    const value = Number(hmi);
    return state.program.find((row) => Number(row.hmi) === value)
      || state.program[Math.max(0, value - 1)]
      || null;
  }

  function rowIndex(row) {
    const plc = Number(row?.plc);
    if (Number.isInteger(plc) && state.program[plc]) return plc;
    const hmi = Number(row?.hmi);
    return Number.isInteger(hmi) ? hmi - 1 : -1;
  }

  function updateCommand(hmi, value) {
    const row = rowForHmi(hmi);
    const index = rowIndex(row);
    if (!row || index < 0 || !state.program[index]) return false;
    actions.execute({
      mutate() {
        state.program[index].cmd = actions.number(value, row.cmd);
      },
      render: "all"
    });
    return true;
  }

  function setOverride(hmi, field, value) {
    const row = rowForHmi(hmi);
    if (!row || !["tableAngle", "plateAngle"].includes(field)) return false;
    const rawValue = String(value ?? "");
    return actions.call("setServoAngleOverride", row, field, rawValue.trim() === "" ? "" : rawValue) !== false;
  }

  function updateOverride(hmi, field, value) {
    return setOverride(hmi, field, value);
  }

  function preserveProgramViewport(callback) {
    const pageX = Number(global.scrollX || global.pageXOffset || 0);
    const pageY = Number(global.scrollY || global.pageYOffset || 0);
    let programNode = null;
    try { programNode = typeof els !== "undefined" ? els.program : null; } catch { programNode = null; }
    const programTop = Number(programNode?.scrollTop || 0);
    const programLeft = Number(programNode?.scrollLeft || 0);

    callback();

    const restore = () => {
      if (programNode) {
        programNode.scrollTop = programTop;
        programNode.scrollLeft = programLeft;
      }
      if (typeof global.scrollTo === "function") global.scrollTo(pageX, pageY);
    };
    restore();
    if (typeof global.requestAnimationFrame === "function") global.requestAnimationFrame(restore);
  }

  function refreshOverridePresentation() {
    preserveProgramViewport(() => {
      actions.call("renderProgram");
      actions.call("renderValidation");
      actions.call("renderAnimationFrame");
    });
  }

  function scheduleOverridePresentationRefresh() {
    const refresh = () => refreshOverridePresentation();
    if (typeof global.requestAnimationFrame === "function") global.requestAnimationFrame(refresh);
    else if (typeof global.setTimeout === "function") global.setTimeout(refresh, 0);
    else refresh();
  }

  function commitOverride(hmi, field, value) {
    if (!setOverride(hmi, field, value)) return false;
    // setServoAngleOverride now updates both the authoritative override store
    // and the current program row. Do not regenerate the complete program here:
    // replacing every generated row during focusout caused the active editor to
    // snap back and made the workspace visibly jump.
    scheduleOverridePresentationRefresh();
    return true;
  }

  function updateAction(hmi, value) {
    const row = rowForHmi(hmi);
    const index = rowIndex(row);
    if (!row || index < 0 || !state.program[index]) return false;
    state.program[index].action = String(value ?? "");
    return true;
  }

  global.LabelerServoProgramController = Object.freeze({
    updateCommand,
    updateOverride,
    commitOverride,
    refreshOverridePresentation,
    scheduleOverridePresentationRefresh,
    updateAction
  });
})(window);
