"use strict";

(function installSimulationController(global) {
  const actions = global.LabelerWorkspaceActionService;

  function togglePlayback() {
    actions.execute({
      mutate() {
        state.isPlaying = !state.isPlaying;
        global.LabelerAnimationRuntime?.resetClock?.();
        if (els.playPause) {
          els.playPause.textContent = state.isPlaying ? "Pause" : "Play";
          els.playPause.setAttribute("aria-pressed", state.isPlaying ? "true" : "false");
        }
      },
      render: "animation"
    });
  }

  function pause() {
    state.isPlaying = false;
    if (els.playPause) {
      els.playPause.textContent = "Play";
      els.playPause.setAttribute("aria-pressed", "false");
    }
  }

  function setSpeed(value) {
    state.animationSpeed = Math.min(50, Math.max(1, actions.number(value, state.animationSpeed)));
    state.animationSpeedUnit = "deg-per-second";
    if (els.animationStepReadout) {
      const formatted = actions.call("fmt", state.animationSpeed, 1) ?? state.animationSpeed;
      els.animationStepReadout.textContent = `${formatted} deg / sec`;
    }
  }

  function loadGeneratedTurns() {
    actions.execute({
      mutate() {
        if (!state.simulation || typeof state.simulation !== "object") state.simulation = {};
        state.simulation.turns = state.program.map((row) => Number.isFinite(row.plateAngle) ? row.plateAngle : null);
        state.simulation.rows = state.program.map((row) => ({ cmd: row.cmd, tableAngle: row.tableAngle, action: row.action }));
        state.simulation.deletedRows = [];
        state.simulation.lines = state.program.map((row) => ({ ...row }));
        state.simulation.useCustom = true;
        state.simulation.source = "generated-copy";
        state.simulation.generatedSignature = state.program.map((row) =>
          [row.cmd, row.tableAngle, row.plateAngle, row.action || ""].join("|")
        ).join(";");
        state.simulation.loadedAt = new Date().toISOString();
        state.simulation.sessionOpened = true;
      },
      persist: true,
      render: "all"
    });
  }

  function resetToBlankProgram() {
    if (!state.simulation || typeof state.simulation !== "object") state.simulation = {};
    state.simulation.turns = [];
    state.simulation.rows = [];
    state.simulation.deletedRows = [];
    state.simulation.lines = [];
    state.simulation.useCustom = true;
    state.simulation.source = "blank";
    state.simulation.sessionOpened = true;
    state.simulation.generatedSignature = "";
    state.simulation.loadedAt = "";
    state.simulation.draftName = "";
    state.simulation.draftDescription = "";
    state.activeServoProfileId = "";
  }

  function openBlankWorkspace() {
    pause();
    actions.execute({
      mutate: resetToBlankProgram,
      persist: true,
      render: "all"
    });
  }

  function clearCustomTurns() {
    openBlankWorkspace();
  }

  function insertPair(lineIndex) {
    if (!Number.isInteger(lineIndex)) return;
    actions.call("insertSimulationPairAfter", lineIndex);
    actions.execute({ persist: true, render: "all" });
  }

  global.LabelerSimulationController = Object.freeze({
    togglePlayback,
    pause,
    setSpeed,
    loadGeneratedTurns,
    openBlankWorkspace,
    clearCustomTurns,
    insertPair
  });
})(window);