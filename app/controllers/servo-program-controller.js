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

  function captureScrollTargets(programNode) {
    const targets = [];
    const seen = new Set();
    const add = (node) => {
      if (!node || seen.has(node) || typeof node.scrollTop !== "number") return;
      seen.add(node);
      targets.push({ node, top: Number(node.scrollTop || 0), left: Number(node.scrollLeft || 0) });
    };

    add(programNode);
    let parent = programNode?.parentElement || null;
    while (parent) {
      add(parent);
      parent = parent.parentElement;
    }

    try {
      add(global.document?.scrollingElement);
      add(global.document?.documentElement);
      add(global.document?.body);
    } catch { }
    return targets;
  }

  function preserveProgramViewport(callback) {
    let programNode = null;
    try { programNode = typeof els !== "undefined" ? els.program : null; } catch { programNode = null; }
    const scrollTargets = captureScrollTargets(programNode);
    const pageX = Number(global.scrollX || global.pageXOffset || 0);
    const pageY = Number(global.scrollY || global.pageYOffset || 0);

    callback();

    const restore = () => {
      scrollTargets.forEach(({ node, top, left }) => {
        try {
          node.scrollTop = top;
          node.scrollLeft = left;
        } catch { }
      });
      if (!scrollTargets.some(({ node }) => node === global.document?.scrollingElement)
          && typeof global.scrollTo === "function") {
        global.scrollTo(pageX, pageY);
      }
    };
    restore();
    if (typeof global.requestAnimationFrame === "function") global.requestAnimationFrame(restore);
  }

  function formatMetric(value, digits = 1) {
    const rendered = actions.call("fmt", value, digits);
    if (rendered !== undefined && rendered !== null) return String(rendered);
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : "";
  }

  function finishedMetric(value) {
    const rendered = actions.call("finishAngle", value);
    const number = Number(rendered);
    return Number.isFinite(number) ? number : Number(value);
  }

  function refreshProgramMetricsInPlace() {
    let programNode = null;
    try { programNode = typeof els !== "undefined" ? els.program : null; } catch { programNode = null; }
    if (!programNode || typeof programNode.querySelector !== "function") return false;

    const segments = actions.call("programSegments", state.program);
    if (!Array.isArray(segments) || !segments.length) return false;
    const maxSpeed = segments.reduce((best, segment) =>
      Number.isFinite(segment.absSpeed) && segment.absSpeed > (best?.absSpeed ?? -Infinity) ? segment : best,
    null);

    segments.forEach((row) => {
      const tr = programNode.querySelector(`tr[data-program-hmi="${String(row.hmi)}"]`);
      if (!tr || !tr.children || tr.children.length < 12) return;
      const cells = tr.children;
      const status = row.moveFault
        ? ["status-bad", `FAULT ${formatMetric(finishedMetric(row.absSpeed), 1)} >= ${formatMetric(finishedMetric(state.maxMoveRatio), 1)}`]
        : !Number.isFinite(row.plateAngle) && row.cmd !== 0
          ? ["status-warn", "Needs plate angle"]
          : ["status-ok", "OK"];
      const speedClass = maxSpeed && row.hmi === maxSpeed.hmi && row.absSpeed > 0 ? "speed-max" : "";
      const encoderTravel = Number.isFinite(row.plateTravel)
        ? global.LabelerGeometryDriver?.encoderCountsFromPlateDegrees?.(row.plateTravel, state.encoderCountsPerRev, state.servoGearRatio)
        : null;

      tr.classList?.toggle?.("move-fault-row", Boolean(row.moveFault));
      cells[7].textContent = formatMetric(row.tableTravel, 1);
      cells[8].textContent = formatMetric(row.plateTravel, 1);
      cells[9].textContent = Number.isFinite(encoderTravel) ? formatMetric(finishedMetric(encoderTravel), 1) : "";
      cells[10].className = status[0];
      cells[10].textContent = status[1];
      cells[11].className = `num${speedClass ? ` ${speedClass}` : ""}`;
      cells[11].textContent = Number.isFinite(row.absSpeed) ? formatMetric(finishedMetric(row.absSpeed), 1) : "";
    });

    actions.call("updateActiveServoProgramRow");
    return true;
  }

  function refreshOverridePresentation() {
    preserveProgramViewport(() => {
      // Keep the existing Servo Program DOM intact. Rebuilding the table here
      // replaces the editor that just blurred and allows browser/PWA scroll
      // anchoring to snap the workspace back toward the top of the page.
      refreshProgramMetricsInPlace();
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
    refreshProgramMetricsInPlace,
    refreshOverridePresentation,
    scheduleOverridePresentationRefresh,
    updateAction
  });
})(window);
