"use strict";

(function installMultiMapLockAndImportIntegration() {
  const PREFS_KEY = "servoforge-developer-preferences-v1";
  const RETRY_MS = 50;
  let installed = false;
  let refreshPending = false;
  let cardObserver = null;

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      return {
        lockedMapIds: Array.isArray(saved?.lockedMapIds) ? [...new Set(saved.lockedMapIds.map(String))] : [],
        hiddenPanels: Array.isArray(saved?.hiddenPanels) ? [...new Set(saved.hiddenPanels.map(String))] : []
      };
    } catch {
      return { lockedMapIds: [], hiddenPanels: [] };
    }
  }

  function savePreferences(next) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function selectedIds(select) {
    return select ? [...select.selectedOptions].map((option) => String(option.value || "")).filter(Boolean) : [];
  }

  function installStyles() {
    if (document.querySelector("#multiMapLockImportStyles")) return;
    const style = document.createElement("style");
    style.id = "multiMapLockImportStyles";
    style.textContent = `
      #workspaceControlsCard .workspace-map-access{grid-template-columns:minmax(0,1fr) 180px!important;align-items:stretch!important}
      #workspaceControlsCard #workspaceMapSelect[multiple]{width:100%;min-width:0;height:auto!important;min-height:154px;padding:4px}
      #workspaceControlsCard #workspaceMapSelect option{padding:5px 7px}
      .workspace-map-actions{display:grid;gap:7px;align-content:end;min-width:0}
      .workspace-map-actions button{width:100%;min-width:0;min-height:38px;height:auto!important;white-space:normal!important}
      .workspace-map-selection-help{display:block;margin-top:2px;color:var(--muted);font-size:9px;line-height:1.35}
      .map-library-actions .map-import-action{display:inline-flex;align-items:center;justify-content:center;min-height:34px}
      @media(max-width:800px){#workspaceControlsCard .workspace-map-access{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function setLabelText(label, text) {
    if (!label) return;
    const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode && textNode.textContent.trim() !== text) textNode.textContent = `${text} `;
  }

  function renderWorkspaceOptions(card) {
    const select = card?.querySelector("#workspaceMapSelect");
    if (!select || typeof state === "undefined") return;

    const previous = selectedIds(select);
    const desiredSelection = previous.length ? previous : state.activeMapId ? [String(state.activeMapId)] : [];
    const selected = new Set(desiredSelection);
    const locked = new Set(readPreferences().lockedMapIds);
    const html = (state.mapLibrary || []).map((map) => {
      const id = String(map.id);
      return `<option value="${escapeHtml(id)}"${selected.has(id) ? " selected" : ""}>${locked.has(id) ? "🔒 " : ""}${escapeHtml(map.name || "Machine Map")}</option>`;
    }).join("");

    if (select.innerHTML !== html) select.innerHTML = html;
    if (!selectedIds(select).length && state.activeMapId) {
      const active = [...select.options].find((option) => option.value === String(state.activeMapId));
      if (active) active.selected = true;
    }
  }

  function updateWorkspaceSummary(card) {
    const select = card?.querySelector("#workspaceMapSelect");
    if (!select) return;
    const chosen = selectedIds(select);
    const locked = new Set(readPreferences().lockedMapIds);
    const selectedLocked = chosen.filter((id) => locked.has(id)).length;
    const lockButton = card.querySelector("#workspaceLockSelectedMaps");
    const unlockButton = card.querySelector("#workspaceUnlockSelectedMaps");
    const badge = card.querySelector("#workspaceMapLockState");
    const help = card.querySelector("#workspaceMapLockHelp");

    if (lockButton) lockButton.disabled = !chosen.length || selectedLocked === chosen.length;
    if (unlockButton) unlockButton.disabled = selectedLocked === 0;
    if (badge) {
      badge.textContent = `${locked.size} Locked`;
      badge.dataset.state = locked.size ? "locked" : "editable";
    }
    if (help) {
      help.textContent = chosen.length
        ? `${chosen.length} selected • ${selectedLocked} already locked. Locked maps must be unlocked here before they can be changed.`
        : "Select one or more maps, then choose Lock Selected or Unlock Selected.";
    }
  }

  function renderBuilderMapLocks() {
    const select = document.querySelector("#mapLibrarySelect");
    if (!select || typeof state === "undefined") return;
    const locked = new Set(readPreferences().lockedMapIds);
    [...select.options].forEach((option) => {
      const map = (state.mapLibrary || []).find((entry) => String(entry.id) === String(option.value));
      if (!map) return;
      const expected = `${locked.has(String(map.id)) ? "🔒 " : ""}${map.name || "Machine Map"}`;
      if (option.textContent !== expected) option.textContent = expected;
    });
  }

  function enhanceWorkspaceCard() {
    refreshPending = false;
    const card = document.querySelector("#workspaceControlsCard");
    if (!card) return;

    const select = card.querySelector("#workspaceMapSelect");
    if (!select) return;
    select.multiple = true;
    select.size = Math.min(8, Math.max(5, (state.mapLibrary || []).length || 5));
    setLabelText(select.closest("label"), "Maps to lock or unlock");

    let help = card.querySelector("#workspaceMapSelectionHelp");
    if (!help) {
      help = document.createElement("small");
      help.id = "workspaceMapSelectionHelp";
      help.className = "workspace-map-selection-help";
      help.textContent = "Hold Ctrl on Windows or Command on Mac to select multiple maps.";
      select.insertAdjacentElement("afterend", help);
    }

    const oldAction = card.querySelector("#workspaceToggleMapLock");
    let actions = card.querySelector(".workspace-map-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "workspace-map-actions";
      actions.innerHTML = `
        <button id="workspaceLockSelectedMaps" type="button">Lock Selected</button>
        <button id="workspaceUnlockSelectedMaps" type="button" class="secondary-button">Unlock Selected</button>`;
      if (oldAction) oldAction.replaceWith(actions);
      else card.querySelector(".workspace-map-access")?.appendChild(actions);
    } else if (oldAction) {
      oldAction.remove();
    }

    renderWorkspaceOptions(card);
    updateWorkspaceSummary(card);
    renderBuilderMapLocks();
  }

  function scheduleRefresh() {
    if (refreshPending) return;
    refreshPending = true;
    window.requestAnimationFrame(enhanceWorkspaceCard);
  }

  function applyLocks(lock) {
    const card = document.querySelector("#workspaceControlsCard");
    const chosen = selectedIds(card?.querySelector("#workspaceMapSelect"));
    if (!chosen.length) return;
    const next = readPreferences();
    const chosenSet = new Set(chosen);
    next.lockedMapIds = lock
      ? [...new Set([...next.lockedMapIds, ...chosen])]
      : next.lockedMapIds.filter((id) => !chosenSet.has(String(id)));
    savePreferences(next);
    if (typeof render === "function") render();
    scheduleRefresh();
  }

  function bindWorkspaceActions() {
    if (document.documentElement.dataset.multiMapLockBound === "true") return;
    document.documentElement.dataset.multiMapLockBound = "true";

    document.addEventListener("click", (event) => {
      if (event.target.closest("#workspaceLockSelectedMaps")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        applyLocks(true);
      } else if (event.target.closest("#workspaceUnlockSelectedMaps")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        applyLocks(false);
      }
    }, true);

    document.addEventListener("change", (event) => {
      if (event.target.closest?.("#workspaceMapSelect")) window.requestAnimationFrame(() => updateWorkspaceSummary(document.querySelector("#workspaceControlsCard")));
      if (event.target.closest?.("#mapLibrarySelect")) window.setTimeout(() => {
        renderBuilderMapLocks();
        if (typeof render === "function") render();
      }, 0);
    }, true);
  }

  function machineMapRecords(documentData) {
    if (!documentData || typeof documentData !== "object") return [];
    if (documentData.format === "servoforge-machine-map" && documentData.map && typeof documentData.map === "object") return [documentData.map];
    if (documentData.format === "labeler-tool-portable-settings" && Array.isArray(documentData.settings?.mapLibrary)) return documentData.settings.mapLibrary;
    if (Array.isArray(documentData.mapLibrary)) return documentData.mapLibrary;
    if (documentData.map && typeof documentData.map === "object") return [documentData.map];
    if (Array.isArray(documentData.objects) && (documentData.machineType || documentData.applicationMode || documentData.schemaVersion)) return [documentData];
    return [];
  }

  function importMapDocument(documentData) {
    const records = machineMapRecords(documentData);
    if (!records.length) throw new Error("This JSON file does not contain a ServoForge machine map or map library.");
    if (typeof createMachineMap !== "function" || typeof uniqueMapId !== "function" || typeof uniqueMapName !== "function") {
      throw new Error("Map Builder is not ready. Close and reopen Map Builder, then try again.");
    }

    const imported = [];
    records.forEach((source, index) => {
      const map = createMachineMap({
        ...deepClone(source),
        id: uniqueMapId("machine-map"),
        name: uniqueMapName(String(source?.name || `Imported Map ${index + 1}`)),
        isTemplate: false
      });
      state.mapLibrary.push(map);
      imported.push(map);
    });

    if (typeof clearServoSimulationForSelectedMap === "function") clearServoSimulationForSelectedMap();
    loadMachineMapIntoRuntime(imported[0], true);
    if (typeof saveCurrentSettings === "function") saveCurrentSettings();
    if (typeof render === "function") render();
    if (typeof renderWipeDownBuilder === "function") renderWipeDownBuilder();
    scheduleRefresh();
    return imported;
  }

  async function readJsonFile(file) {
    return JSON.parse(await file.text());
  }

  function ensureMapImportControl() {
    const exportButton = document.querySelector("#exportMachineMap");
    if (!exportButton || document.querySelector("#importMachineMap")) return;
    const label = document.createElement("label");
    label.className = "file-action map-import-action";
    label.innerHTML = 'Import Map<input id="importMachineMap" type="file" accept="application/json,.json">';
    exportButton.insertAdjacentElement("afterend", label);
    label.querySelector("input")?.addEventListener("change", async (event) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;
      try {
        const imported = importMapDocument(await readJsonFile(file));
        window.alert(`${imported.length} map${imported.length === 1 ? "" : "s"} imported successfully.`);
      } catch (error) {
        window.alert(`Unable to import map: ${error.message}`);
      } finally {
        input.value = "";
      }
    });
  }

  function bindFormatAwareFaultImport() {
    const input = document.querySelector("#importFaultConfig");
    if (!input || input.dataset.formatAwareImport === "true") return;
    input.dataset.formatAwareImport = "true";
    setLabelText(input.closest("label"), "Import Fault Limits");

    input.addEventListener("change", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const file = input.files?.[0];
      if (!file) return;
      try {
        const documentData = await readJsonFile(file);
        const maps = machineMapRecords(documentData);
        if (maps.length) {
          const imported = importMapDocument(documentData);
          window.alert(`${imported.length} map${imported.length === 1 ? "" : "s"} recognized and imported through Map Builder.`);
        } else {
          applyFaultConfig(documentData);
          if (typeof saveCurrentSettings === "function") saveCurrentSettings();
          window.alert(`Fault configuration loaded. Plate/table fault ratio: ${fmt(state.maxMoveRatio, 1)}:1`);
        }
      } catch (error) {
        window.alert(`Unable to load JSON configuration: ${error.message}`);
      } finally {
        input.value = "";
      }
    }, true);
  }

  function observeWorkspaceCard() {
    const card = document.querySelector("#workspaceControlsCard");
    if (!card || cardObserver) return;
    cardObserver = new MutationObserver(scheduleRefresh);
    cardObserver.observe(card, { childList: true, subtree: true });
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined" || !document.querySelector("#workspaceControlsCard")) return false;
    installed = true;
    installStyles();
    bindWorkspaceActions();
    bindFormatAwareFaultImport();
    ensureMapImportControl();
    observeWorkspaceCard();
    enhanceWorkspaceCard();
    window.setTimeout(() => {
      ensureMapImportControl();
      bindFormatAwareFaultImport();
      scheduleRefresh();
    }, 500);
    return true;
  }

  function waitForApplication() {
    if (install()) return;
    window.setTimeout(waitForApplication, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForApplication, { once: true });
  else waitForApplication();
})();
