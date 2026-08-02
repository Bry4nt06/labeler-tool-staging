"use strict";

function bindGlobalActions() {
  if (els.toggleAggregateSpacing) {
    els.toggleAggregateSpacing.setAttribute("aria-pressed", String(Boolean(state.showAggregateSpacingOverlay)));
    els.toggleAggregateSpacing.addEventListener("click", () => {
      state.showAggregateSpacingOverlay = !state.showAggregateSpacingOverlay;
      els.toggleAggregateSpacing.setAttribute("aria-pressed", String(state.showAggregateSpacingOverlay));
      saveCurrentSettings();
      renderMap();
    });
  }

  const setWipeDownPopupOpen = (open) => {
    if (!els.wipeDownDataPanel) return;
    els.wipeDownDataPanel.hidden = !open;
    els.showWipeDownData?.setAttribute("aria-expanded", String(open));
    if (open) renderWipeDownData();
  };
  els.showWipeDownData?.addEventListener("click", () => setWipeDownPopupOpen(els.wipeDownDataPanel?.hidden !== false));
  els.closeWipeDownData?.addEventListener("click", () => setWipeDownPopupOpen(false));

  [els.tablePitchRadiusMm, els.padClearanceMm].forEach((control) => {
    control?.addEventListener("change", () => {
      state.tablePitchRadiusMm = Math.max(0.001, num(els.tablePitchRadiusMm.value, state.tablePitchRadiusMm));
      state.padClearanceMm = Math.max(0, num(els.padClearanceMm.value, state.padClearanceMm));
      syncMapPointsFromAssemblies();
      render();
      renderAssemblyEditor();
    });
  });

  document.querySelector("#exportJson").addEventListener("click", () => {
    download("labeler-servo-map.json", "application/json", JSON.stringify({
      ...state,
      heads: heads(),
      program: programSegments().map(roundedServoExportRow)
    }, null, 2));
  });

  els.exportSettings?.addEventListener("click", () => {
    saveCurrentSettings();
    const portable = {
      format: "labeler-tool-portable-settings",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: settingsSnapshot()
    };
    download("labeler-tool-settings.json", "application/json", JSON.stringify(portable, null, 2));
  });
  els.importSettings?.addEventListener("change", () => importPortableSettingsFile(els.importSettings.files?.[0]));
  bindZoneSiteDeveloperMenu();

  document.querySelector("#exportCsv").addEventListener("click", () => {
    const autocol = activeMachineUsesAutocolCommands();
    const rows = [[
      "HMI",
      "PLC",
      autocol ? "Travel Command" : "CMD",
      "Table Angle",
      "Plate Angle",
      "Table Travel",
      "Plate Travel",
      "Turn Speed",
      "Action"
    ]];
    programSegments(state.program).forEach((row) => rows.push([
      row.hmi,
      row.plc,
      autocol ? autocolCommandLabel(row) : row.cmd,
      oneDecimalOutput(row.tableAngle),
      oneDecimalOutput(row.plateAngle),
      oneDecimalOutput(row.tableTravel),
      oneDecimalOutput(row.plateTravel),
      oneDecimalOutput(row.absSpeed),
      row.action
    ]));
    download(
      "labeler-servo-program.csv",
      "text/csv",
      rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    );
  });

  els.saveSettings.addEventListener("click", saveCurrentSettings);
  els.checkForUpdates?.addEventListener("click", () => checkForToolUpdates());
  els.simulation?.addEventListener("click", (event) => {
    const insertButton = event.target.closest(".simulation-insert-pair");
    if (!insertButton) return;
    const lineIndex = Number(insertButton.dataset.simulationLineIndex);
    if (!Number.isInteger(lineIndex)) return;
    insertSimulationPairAfter(lineIndex);
    render();
  });
  els.importFaultConfig.addEventListener("change", () => importFaultConfigFile(els.importFaultConfig.files?.[0]));

  els.loadGeneratedTurns.addEventListener("click", () => {
    state.simulation.turns = state.program.map((row) => Number.isFinite(row.plateAngle) ? row.plateAngle : null);
    state.simulation.rows = state.program.map((row) => ({
      cmd: row.cmd,
      tableAngle: row.tableAngle,
      action: row.action
    }));
    state.simulation.deletedRows = [];
    state.simulation.lines = state.program.map((row) => ({ ...row }));
    state.simulation.useCustom = true;
    render();
  });

  els.clearCustomTurns.addEventListener("click", () => {
    state.simulation.turns = state.program.map(() => null);
    state.simulation.rows = [];
    state.simulation.deletedRows = [];
    state.simulation.lines = [];
    state.simulation.useCustom = false;
    render();
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeTab = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".table-wrap").forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector(`#${tab.dataset.tab}`)?.classList.add("active");
      render();
    });
  });
}

window.LabelerGlobalActions = Object.freeze({ bind: bindGlobalActions });
