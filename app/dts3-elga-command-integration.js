"use strict";

(function installDts3ElgaCommandIntegration(global) {
  if (global.LabelerDts3ElgaCommandIntegration?.installed) return;

  const driver = global.LabelerDts3CommandSemanticsDriver;
  if (!driver) return;

  let generationWrapped = false;
  let renderWrapped = false;
  let observer = null;

  function activeMachineType() {
    try {
      const map = typeof activeMachineMap === "function" ? activeMachineMap() : null;
      return map?.machineType || state?.machineType || state?.selectedMachineType || "";
    } catch {
      return global.state?.machineType || global.state?.selectedMachineType || "";
    }
  }

  function isActiveDts3() {
    return driver.isDts3Machine(activeMachineType());
  }

  function rpcTablePosition(value) {
    const machineType = activeMachineType();
    const converted = global.LabelerTopModulRpcAngleDriver?.physicalToRpcTableAngle?.(value, machineType);
    return Number.isFinite(converted) ? converted : Number(value);
  }

  function annotateProgram() {
    if (!isActiveDts3() || !Array.isArray(global.state?.program)) return false;
    const annotated = driver.annotateRows(global.state.program, {
      machineType: activeMachineType(),
      tablePosition: rpcTablePosition
    });
    global.state.program = annotated;
    if (Array.isArray(global.state.motionTranslation?.rows)) global.state.motionTranslation.rows = annotated;
    if (Array.isArray(global.state.motionPlan?.rows)) global.state.motionPlan.rows = annotated;
    global.state.dts3CommandSemantics = {
      command: "ELGa",
      targetMode: "absolute",
      maxCorrectionTurns: 2,
      source: "LCT-3 programming manual"
    };
    return true;
  }

  function decorateProgramTable() {
    if (!isActiveDts3()) return;
    annotateProgram();
    const host = global.els?.program || global.document?.querySelector?.("#program");
    if (!host?.querySelectorAll) return;

    host.querySelectorAll("tr[data-program-hmi]").forEach((tr) => {
      const hmi = Number(tr.dataset.programHmi);
      const row = global.state?.program?.find?.((item) => Number(item?.hmi) === hmi);
      const control = tr.querySelector('[data-program-field="command"]');
      if (!row || !control) return;

      const isElga = row.dts3CommandMnemonic === "ELGa";
      tr.dataset.dts3MachineCommand = isElga ? "ELGa" : (row.dts3CommandRole || "");
      if (control.tagName === "SELECT") {
        const correctionOption = [...control.options].find((option) => Number(option.value) === 7);
        const referenceOption = [...control.options].find((option) => Number(option.value) === 3);
        if (correctionOption) correctionOption.textContent = "ELGa";
        if (referenceOption) referenceOption.textContent = "Reference";
      }
      control.title = isElga
        ? `ELGa — Electronic gear, absolute. P1 stop table position ${Number(row.dts3CommandParameter1).toFixed(4)}; P2 absolute plate target ${Number(row.dts3CommandParameter2).toFixed(1)}°; travel ${Number(row.dts3CommandTravelDeg).toFixed(1)}°.`
        : "DTS3 reference boundary used internally by ServoForge.";

      let badge = tr.querySelector(".dts3-command-badge");
      if (!badge) {
        badge = global.document.createElement("span");
        badge.className = "dts3-command-badge";
        control.insertAdjacentElement?.("afterend", badge);
      }
      badge.textContent = isElga ? "ELGa" : "REF";
      badge.title = control.title;
    });
  }

  function wrapGeneration() {
    if (generationWrapped || typeof global.applyGeneratedServoProfile !== "function") return;
    generationWrapped = true;
    const before = global.applyGeneratedServoProfile;
    global.applyGeneratedServoProfile = function applyGeneratedServoProfileWithDts3Elga(...args) {
      const result = before.apply(this, args);
      annotateProgram();
      return result;
    };
  }

  function wrapRender() {
    if (renderWrapped || typeof global.renderProgram !== "function") return;
    renderWrapped = true;
    const before = global.renderProgram;
    global.renderProgram = function renderProgramWithDts3Elga(...args) {
      const result = before.apply(this, args);
      decorateProgramTable();
      return result;
    };
  }

  function installStyles() {
    if (global.document?.getElementById?.("dts3ElgaCommandStyles")) return;
    const style = global.document?.createElement?.("style");
    if (!style) return;
    style.id = "dts3ElgaCommandStyles";
    style.textContent = ".dts3-command-badge{display:inline-flex;margin-left:5px;padding:1px 5px;border:1px solid var(--line);border-radius:999px;font-size:8px;font-weight:700;letter-spacing:.04em;color:var(--green);vertical-align:middle}.dts3-command-badge[title*='reference' i]{color:var(--muted)}";
    global.document.head?.appendChild(style);
  }

  function installObserver() {
    if (observer || typeof global.MutationObserver !== "function") return;
    const host = global.els?.program || global.document?.querySelector?.("#program");
    if (!host) return;
    observer = new global.MutationObserver(() => {
      global.queueMicrotask?.(decorateProgramTable);
    });
    observer.observe(host, { childList: true, subtree: true });
  }

  function install() {
    installStyles();
    wrapGeneration();
    wrapRender();
    annotateProgram();
    decorateProgramTable();
    installObserver();
    global.LabelerDts3ElgaCommandIntegration = Object.freeze({
      installed: true,
      version: 1,
      annotateProgram,
      decorateProgramTable,
      activeMachineType,
      isActiveDts3
    });
  }

  install();
})(typeof window !== "undefined" ? window : globalThis);
