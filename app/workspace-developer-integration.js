"use strict";

(function installWorkspaceDeveloperControls() {
  const RETRY_MS = 40;
  const PREFS_KEY = "servoforge-developer-preferences-v1";
  const AUTH_KEY = "servoforge-developer-auth-v1";
  const SESSION_KEY = "servoforge-developer-session-v1";
  const PANEL_DEFINITIONS = Object.freeze([
    ["mapBuilder", "Map Builder"],
    ["specs", "Specs"],
    ["buildInputs", "Build Inputs"],
    ["program", "Servo Program"],
    ["simulation", "Servo Simulation"],
    ["diagnostics", "Diagnostics"],
    ["preview", "Preview & Animation"],
    ["validation", "Validation"],
    ["overlays", "Map Overlays"]
  ]);
  let installed = false;
  let applying = false;
  let observer = null;

  function readJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function developerPreferences() {
    const saved = readJson(localStorage, PREFS_KEY, {});
    return {
      lockedMapIds: Array.isArray(saved.lockedMapIds) ? [...new Set(saved.lockedMapIds.map(String))] : [],
      hiddenPanels: Array.isArray(saved.hiddenPanels) ? [...new Set(saved.hiddenPanels.map(String))] : []
    };
  }

  function saveDeveloperPreferences(preferences) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  }

  function developerUnlocked() {
    return sessionStorage.getItem(SESSION_KEY) === "unlocked";
  }

  function authenticationRecord() {
    return readJson(localStorage, AUTH_KEY, null);
  }

  function bytesToHex(buffer) {
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function passwordDigest(password, salt) {
    if (!crypto?.subtle) throw new Error("Secure browser hashing is unavailable.");
    const encoded = new TextEncoder().encode(`${salt}:${password}`);
    return bytesToHex(await crypto.subtle.digest("SHA-256", encoded));
  }

  async function createDeveloperLogin(password, confirmation) {
    if (password.length < 8) throw new Error("Use at least 8 characters for the developer password.");
    if (password !== confirmation) throw new Error("The password confirmation does not match.");
    const salt = randomSalt();
    const digest = await passwordDigest(password, salt);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ version: 1, salt, digest, createdAt: new Date().toISOString() }));
    sessionStorage.setItem(SESSION_KEY, "unlocked");
  }

  async function verifyDeveloperLogin(password) {
    const record = authenticationRecord();
    if (!record?.salt || !record?.digest) return false;
    return (await passwordDigest(password, record.salt)) === record.digest;
  }

  function activeMap() {
    return typeof activeMachineMap === "function" ? activeMachineMap() : null;
  }

  function mapIsLocked(map = activeMap()) {
    return Boolean(map?.id && developerPreferences().lockedMapIds.includes(String(map.id)));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function installStyles() {
    if (document.querySelector("#workspaceDeveloperStyles")) return;
    const style = document.createElement("style");
    style.id = "workspaceDeveloperStyles";
    style.textContent = `
      .tabs .map-builder-tab { order:-10; }
      .map-toolbar #wipeDownBuilderButton { display:none; }
      .developer-mode-card { display:grid;gap:8px;margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--panel); }
      .developer-mode-head { display:flex;align-items:center;justify-content:space-between;gap:8px; }
      .developer-mode-head strong,.developer-mode-head small { display:block; }
      .developer-mode-head small,.developer-mode-note { color:var(--muted);font-size:9px;line-height:1.35; }
      .developer-mode-status { padding:3px 7px;border:1px solid var(--line);border-radius:999px;font-size:9px;font-weight:800; }
      .developer-mode-status[data-state="unlocked"] { border-color:var(--green);color:var(--green); }
      .developer-login-grid,.developer-feature-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px; }
      .developer-login-grid label,.developer-feature-grid label { display:grid;gap:3px;min-width:0; }
      .developer-login-actions,.developer-map-actions { display:flex;flex-wrap:wrap;gap:6px;align-items:end; }
      .developer-feature-panel { display:grid;gap:9px;padding-top:8px;border-top:1px solid var(--line); }
      .developer-panel-toggles { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px; }
      .developer-panel-toggle { display:flex!important;grid-template-columns:none!important;align-items:center;gap:6px;padding:6px;border:1px solid var(--line);border-radius:7px;background:var(--input);font-size:9px; }
      .locked-map-viewer { display:flex;align-items:end;gap:7px;margin-left:auto; }
      .locked-map-viewer label { display:grid;gap:2px;color:var(--muted);font-size:8px; }
      .locked-map-viewer select { min-width:180px;max-width:280px; }
      .locked-map-badge,.map-read-only-indicator { padding:3px 7px;border:1px solid #d79a3c;border-radius:999px;color:#ffc56b;font-size:8px;font-weight:800;white-space:nowrap; }
      .map-read-only-indicator { margin-left:7px; }
      .read-only-surface { position:relative; }
      .read-only-surface input:disabled,.read-only-surface select:disabled,.read-only-surface textarea:disabled,.read-only-surface button:disabled { cursor:not-allowed;opacity:.62; }
      #mapLockToggle[data-developer-readonly="true"] { border-color:#d79a3c;color:#ffc56b;cursor:not-allowed; }
      [data-developer-hidden="true"] { display:none!important; }
      @media(max-width:760px){.developer-login-grid,.developer-feature-grid,.developer-panel-toggles{grid-template-columns:1fr}.locked-map-viewer{width:100%;margin-left:0}.locked-map-viewer label{flex:1}.locked-map-viewer select{width:100%;min-width:0}}
    `;
    document.head.appendChild(style);
  }

  function ensureDeveloperSettings() {
    const panel = document.querySelector(".top-settings-panel");
    if (!panel) return null;
    let card = panel.querySelector("#developerModeCard");
    if (!card) {
      card = document.createElement("section");
      card.id = "developerModeCard";
      card.className = "developer-mode-card";
      card.innerHTML = `
        <div class="developer-mode-head">
          <div><strong>Developer Mode</strong><small>Unlock protected staging controls, map locks, and panel visibility.</small></div>
          <span id="developerModeStatus" class="developer-mode-status" data-state="locked">Locked</span>
        </div>
        <div id="developerLoginGrid" class="developer-login-grid">
          <label>Password<input id="developerPassword" type="password" autocomplete="current-password"></label>
          <label id="developerConfirmLabel" hidden>Confirm password<input id="developerPasswordConfirm" type="password" autocomplete="new-password"></label>
        </div>
        <div class="developer-login-actions">
          <button id="developerLoginAction" type="button">Unlock Developer Mode</button>
          <button id="developerLockAction" type="button" class="secondary-button" hidden>Lock Developer Mode</button>
          <button id="developerChangePassword" type="button" class="secondary-button" hidden>Change Login</button>
        </div>
        <div id="developerLoginMessage" class="developer-mode-note" aria-live="polite">Developer access is stored locally on this browser and unlocks only for the current session.</div>
        <div id="developerFeaturePanel" class="developer-feature-panel" hidden>
          <div class="developer-feature-grid">
            <label>Map access<select id="developerMapSelect"></select></label>
            <div class="developer-map-actions"><button id="developerToggleMapLock" type="button">Lock Selected Map</button></div>
          </div>
          <div><strong>Panel visibility</strong><div id="developerPanelToggles" class="developer-panel-toggles"></div></div>
          <small class="developer-mode-note">Locked maps load in read-only mode. Map Builder is hidden and map, specification, Build Input, and Servo Program editing are disabled.</small>
        </div>`;
      const feedback = panel.querySelector("#giveFeedback");
      if (feedback) feedback.insertAdjacentElement("beforebegin", card);
      else panel.appendChild(card);
    }
    return card;
  }

  function renderDeveloperAuthentication() {
    const card = ensureDeveloperSettings();
    if (!card) return;
    const unlocked = developerUnlocked();
    const hasLogin = Boolean(authenticationRecord());
    const status = card.querySelector("#developerModeStatus");
    const login = card.querySelector("#developerLoginAction");
    const lock = card.querySelector("#developerLockAction");
    const change = card.querySelector("#developerChangePassword");
    const confirmLabel = card.querySelector("#developerConfirmLabel");
    const password = card.querySelector("#developerPassword");
    const confirm = card.querySelector("#developerPasswordConfirm");
    const features = card.querySelector("#developerFeaturePanel");
    status.textContent = unlocked ? "Unlocked" : hasLogin ? "Locked" : "Setup Required";
    status.dataset.state = unlocked ? "unlocked" : "locked";
    login.hidden = unlocked;
    login.textContent = hasLogin ? "Unlock Developer Mode" : "Create Developer Login";
    lock.hidden = !unlocked;
    change.hidden = !unlocked;
    confirmLabel.hidden = hasLogin || unlocked;
    features.hidden = !unlocked;
    if (unlocked) {
      password.value = "";
      confirm.value = "";
    }
    renderDeveloperFeatures();
  }

  function mapOptions() {
    const maps = Array.isArray(state?.mapLibrary) ? state.mapLibrary : [];
    const preferences = developerPreferences();
    return maps.map((map) => `<option value="${escapeHtml(map.id)}">${preferences.lockedMapIds.includes(String(map.id)) ? "🔒 " : ""}${escapeHtml(map.name || "Machine Map")}</option>`).join("");
  }

  function renderDeveloperFeatures() {
    const card = document.querySelector("#developerModeCard");
    if (!card || !developerUnlocked()) return;
    const preferences = developerPreferences();
    const mapSelect = card.querySelector("#developerMapSelect");
    const lockButton = card.querySelector("#developerToggleMapLock");
    const previous = mapSelect?.value || state.activeMapId;
    if (mapSelect) {
      mapSelect.innerHTML = mapOptions();
      mapSelect.value = [...mapSelect.options].some((option) => option.value === previous) ? previous : state.activeMapId;
    }
    const selectedId = mapSelect?.value || state.activeMapId;
    const selectedLocked = preferences.lockedMapIds.includes(String(selectedId));
    if (lockButton) lockButton.textContent = selectedLocked ? "Unlock Selected Map" : "Lock Selected Map";
    const toggles = card.querySelector("#developerPanelToggles");
    if (toggles) {
      toggles.innerHTML = PANEL_DEFINITIONS.map(([id, label]) => `
        <label class="developer-panel-toggle"><input type="checkbox" data-developer-panel="${id}" ${preferences.hiddenPanels.includes(id) ? "checked" : ""}> Hide ${label}</label>`).join("");
    }
  }

  function ensureLockedMapViewer() {
    const mapHead = document.querySelector(".map-head");
    if (!mapHead) return null;
    let viewer = mapHead.querySelector("#lockedMapViewer");
    if (!viewer) {
      viewer = document.createElement("div");
      viewer.id = "lockedMapViewer";
      viewer.className = "locked-map-viewer";
      viewer.innerHTML = `<label>Locked Maps<select id="lockedMapViewerSelect"></select></label><span class="locked-map-badge">Read Only</span>`;
      mapHead.appendChild(viewer);
      viewer.querySelector("select")?.addEventListener("change", (event) => {
        const map = state.mapLibrary.find((entry) => String(entry.id) === event.currentTarget.value);
        if (!map || !developerPreferences().lockedMapIds.includes(String(map.id))) return;
        loadMachineMapIntoRuntime(map, true);
        if (typeof saveCurrentSettings === "function") saveCurrentSettings();
        applyWorkspaceState();
      });
    }
    return viewer;
  }

  function renderLockedMapViewer() {
    const viewer = ensureLockedMapViewer();
    if (!viewer) return;
    const preferences = developerPreferences();
    const lockedMaps = (state.mapLibrary || []).filter((map) => preferences.lockedMapIds.includes(String(map.id)));
    viewer.hidden = lockedMaps.length === 0;
    const select = viewer.querySelector("select");
    if (!select) return;
    select.innerHTML = lockedMaps.map((map) => `<option value="${escapeHtml(map.id)}">${escapeHtml(map.name || "Machine Map")}</option>`).join("");
    if (lockedMaps.some((map) => map.id === state.activeMapId)) select.value = state.activeMapId;
  }

  function orderedTabButtons() {
    const tabs = document.querySelector(".tabs");
    const builder = document.querySelector("#wipeDownBuilderButton");
    if (!tabs || !builder) return;
    builder.classList.remove("compact-builder-button", "secondary-button", "compact-map-button");
    builder.classList.add("tab", "map-builder-tab");
    builder.textContent = "Map Builder";
    builder.removeAttribute("data-tab");
    const normalTabs = ["specs", "buildInputs", "program", "simulation", "diagnostics"]
      .map((id) => tabs.querySelector(`[data-tab="${id}"]`))
      .filter(Boolean);
    const anchor = tabs.querySelector(".simulation-actions-spacer") || tabs.firstElementChild;
    [builder, ...normalTabs].forEach((button) => tabs.insertBefore(button, anchor));
  }

  function closeBuilder() {
    const drawer = document.querySelector("#applicationSetupDialog");
    if (!drawer || drawer.hidden) return;
    document.querySelector("#closeApplicationSetup")?.click();
    window.setTimeout(syncTabState, 0);
  }

  function syncTabState() {
    const drawerOpen = document.querySelector("#applicationSetupDialog")?.hidden === false;
    const builder = document.querySelector("#wipeDownBuilderButton");
    if (builder) builder.classList.toggle("active", drawerOpen);
    if (drawerOpen) {
      document.querySelectorAll('.tabs .tab[data-tab]').forEach((tab) => tab.classList.remove("active"));
    } else {
      document.querySelectorAll('.tabs .tab[data-tab]').forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === state.activeTab));
    }
  }

  function panelTargets(id) {
    const tabs = document.querySelector(".tabs");
    const targets = {
      mapBuilder: [document.querySelector("#wipeDownBuilderButton"), document.querySelector("#applicationSetupDialog")],
      specs: [tabs?.querySelector('[data-tab="specs"]'), document.querySelector("#specs")],
      buildInputs: [tabs?.querySelector('[data-tab="buildInputs"]'), document.querySelector("#buildInputs")],
      program: [tabs?.querySelector('[data-tab="program"]'), document.querySelector("#program")],
      simulation: [tabs?.querySelector('[data-tab="simulation"]'), document.querySelector("#simulation")],
      diagnostics: [tabs?.querySelector('[data-tab="diagnostics"]'), document.querySelector("#diagnostics")],
      preview: [document.querySelector(".preview-panel")],
      validation: [document.querySelector(".validation")],
      overlays: [document.querySelector(".map-overlay-control")]
    };
    return (targets[id] || []).filter(Boolean);
  }

  function applyHiddenPanels() {
    const hiddenPanels = developerPreferences().hiddenPanels;
    PANEL_DEFINITIONS.forEach(([id]) => {
      const hidden = hiddenPanels.includes(id) || (id === "mapBuilder" && mapIsLocked());
      panelTargets(id).forEach((target) => {
        target.dataset.developerHidden = String(hidden);
        if (hidden && target.id === "applicationSetupDialog") closeBuilder();
      });
    });
    const activeTabHidden = hiddenPanels.includes(String(state.activeTab));
    if (activeTabHidden) {
      const fallback = ["specs", "buildInputs", "program", "simulation", "diagnostics"].find((id) => !hiddenPanels.includes(id));
      document.querySelector(`.tabs .tab[data-tab="${fallback}"]`)?.click();
    }
  }

  function setControlReadOnly(control, locked) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement || control instanceof HTMLButtonElement)) return;
    if (control.matches('[data-open-diagnostics],[data-open-simulation]')) return;
    if (locked) {
      if (!control.hasAttribute("data-developer-was-disabled")) control.dataset.developerWasDisabled = String(control.disabled);
      control.disabled = true;
    } else if (control.hasAttribute("data-developer-was-disabled")) {
      control.disabled = control.dataset.developerWasDisabled === "true";
      delete control.dataset.developerWasDisabled;
    }
  }

  function applyMapReadOnlyState() {
    const locked = mapIsLocked();
    const mapLockToggle = document.querySelector("#mapLockToggle");
    const undoMapEdit = document.querySelector("#undoMapEdit");
    const drawer = document.querySelector("#applicationSetupDialog");
    if (locked) {
      state.mapLocked = true;
      closeBuilder();
    }
    if (mapLockToggle) {
      mapLockToggle.dataset.developerReadonly = String(locked);
      mapLockToggle.disabled = locked;
      mapLockToggle.setAttribute("aria-pressed", "true");
      if (locked) mapLockToggle.textContent = "Read Only";
      else if (mapLockToggle.textContent === "Read Only") mapLockToggle.textContent = state.mapLocked === false ? "Unlocked" : "Locked";
    }
    if (undoMapEdit) setControlReadOnly(undoMapEdit, locked);
    [document.querySelector("#specs"), document.querySelector("#buildInputs"), document.querySelector("#program"), drawer].filter(Boolean).forEach((surface) => {
      surface.classList.toggle("read-only-surface", locked);
      surface.querySelectorAll("input,select,textarea,button").forEach((control) => setControlReadOnly(control, locked));
    });
    const activeName = document.querySelector("#activeMapName");
    let indicator = document.querySelector("#mapReadOnlyIndicator");
    if (locked && activeName && !indicator) {
      indicator = document.createElement("span");
      indicator.id = "mapReadOnlyIndicator";
      indicator.className = "map-read-only-indicator";
      indicator.textContent = "READ ONLY";
      activeName.insertAdjacentElement("afterend", indicator);
    }
    if (indicator) indicator.hidden = !locked;
  }

  function applyWorkspaceState() {
    if (applying) return;
    applying = true;
    try {
      orderedTabButtons();
      renderLockedMapViewer();
      applyHiddenPanels();
      applyMapReadOnlyState();
      renderDeveloperAuthentication();
      syncTabState();
    } finally {
      applying = false;
    }
  }

  function installOutsideClickClosing() {
    if (document.documentElement.dataset.workspaceAutoCloseBound === "true") return;
    document.documentElement.dataset.workspaceAutoCloseBound = "true";
    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      const settings = document.querySelector(".top-settings-menu");
      if (settings?.open && !settings.contains(target)) settings.open = false;

      const drawer = document.querySelector("#applicationSetupDialog");
      const builderTab = document.querySelector("#wipeDownBuilderButton");
      if (drawer?.hidden === false && !drawer.contains(target) && !builderTab?.contains(target)) closeBuilder();

      const labelerReference = document.querySelector("#labelerMapReference");
      const labelerButton = document.querySelector("#labelerMapButton");
      if (labelerReference?.hidden === false && !labelerReference.contains(target) && !labelerButton?.contains(target)) document.querySelector("#closeLabelerMap")?.click();

      const wipePanel = document.querySelector("#wipeDownDataPanel");
      const wipeButton = document.querySelector("#showWipeDownData");
      if (wipePanel?.hidden === false && !wipePanel.contains(target) && !wipeButton?.contains(target)) document.querySelector("#closeWipeDownData")?.click();

      document.querySelectorAll(".builder-scroll-content details[open],.top-settings-panel details[open]").forEach((details) => {
        if (!details.contains(target)) details.open = false;
      });
    }, true);
  }

  function installEventBindings() {
    const card = ensureDeveloperSettings();
    if (card?.dataset.bound !== "true") {
      card.dataset.bound = "true";
      card.querySelector("#developerLoginAction")?.addEventListener("click", async () => {
        const password = String(card.querySelector("#developerPassword")?.value || "");
        const confirmation = String(card.querySelector("#developerPasswordConfirm")?.value || "");
        const message = card.querySelector("#developerLoginMessage");
        try {
          if (authenticationRecord()) {
            if (!(await verifyDeveloperLogin(password))) throw new Error("Incorrect developer password.");
            sessionStorage.setItem(SESSION_KEY, "unlocked");
          } else {
            await createDeveloperLogin(password, confirmation);
          }
          message.textContent = "Developer Mode unlocked for this browser session.";
          renderDeveloperAuthentication();
          applyWorkspaceState();
        } catch (error) {
          message.textContent = error.message;
        }
      });
      card.querySelector("#developerLockAction")?.addEventListener("click", () => {
        sessionStorage.removeItem(SESSION_KEY);
        renderDeveloperAuthentication();
        applyWorkspaceState();
      });
      card.querySelector("#developerChangePassword")?.addEventListener("click", async () => {
        const password = window.prompt("Enter the new developer password (minimum 8 characters):", "");
        if (password == null) return;
        const confirmation = window.prompt("Confirm the new developer password:", "");
        if (confirmation == null) return;
        const message = card.querySelector("#developerLoginMessage");
        try {
          await createDeveloperLogin(password, confirmation);
          message.textContent = "Developer login updated.";
          renderDeveloperAuthentication();
        } catch (error) {
          message.textContent = error.message;
        }
      });
      card.querySelector("#developerMapSelect")?.addEventListener("change", renderDeveloperFeatures);
      card.querySelector("#developerToggleMapLock")?.addEventListener("click", () => {
        const selectedId = String(card.querySelector("#developerMapSelect")?.value || "");
        if (!selectedId) return;
        const preferences = developerPreferences();
        const locked = preferences.lockedMapIds.includes(selectedId);
        preferences.lockedMapIds = locked ? preferences.lockedMapIds.filter((id) => id !== selectedId) : [...preferences.lockedMapIds, selectedId];
        saveDeveloperPreferences(preferences);
        renderDeveloperFeatures();
        applyWorkspaceState();
      });
      card.querySelector("#developerPanelToggles")?.addEventListener("change", (event) => {
        const checkbox = event.target.closest("[data-developer-panel]");
        if (!checkbox) return;
        const preferences = developerPreferences();
        const panelId = checkbox.dataset.developerPanel;
        preferences.hiddenPanels = checkbox.checked
          ? [...new Set([...preferences.hiddenPanels, panelId])]
          : preferences.hiddenPanels.filter((id) => id !== panelId);
        saveDeveloperPreferences(preferences);
        applyWorkspaceState();
      });
    }

    const builder = document.querySelector("#wipeDownBuilderButton");
    if (builder && builder.dataset.workspaceBound !== "true") {
      builder.dataset.workspaceBound = "true";
      builder.addEventListener("click", () => window.setTimeout(() => {
        if (mapIsLocked()) closeBuilder();
        syncTabState();
      }, 0));
    }

    document.querySelectorAll('.tabs .tab[data-tab]').forEach((tab) => {
      if (tab.dataset.workspaceBound === "true") return;
      tab.dataset.workspaceBound = "true";
      tab.addEventListener("click", () => {
        closeBuilder();
        window.setTimeout(syncTabState, 0);
      });
    });
  }

  function wrapMapLoading() {
    if (typeof loadMachineMapIntoRuntime !== "function" || loadMachineMapIntoRuntime.workspaceDeveloperWrapped) return;
    const base = loadMachineMapIntoRuntime;
    const wrapped = function loadMachineMapIntoRuntimeWithDeveloperState(...args) {
      const result = base.apply(this, args);
      window.setTimeout(applyWorkspaceState, 0);
      return result;
    };
    wrapped.workspaceDeveloperWrapped = true;
    loadMachineMapIntoRuntime = wrapped;
    window.loadMachineMapIntoRuntime = wrapped;
  }

  function installObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      const externalMutation = mutations.some((mutation) => !mutation.target.closest?.("#developerModeCard,#lockedMapViewer"));
      if (!externalMutation) return;
      installEventBindings();
      applyWorkspaceState();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined" || typeof activeMachineMap !== "function" || !document.querySelector(".tabs")) return false;
    installed = true;
    installStyles();
    ensureDeveloperSettings();
    ensureLockedMapViewer();
    wrapMapLoading();
    installOutsideClickClosing();
    installEventBindings();
    installObserver();
    applyWorkspaceState();
    return true;
  }

  function waitForApplication() {
    if (install()) return;
    window.setTimeout(waitForApplication, RETRY_MS);
  }

  if (document.readyState === "complete") waitForApplication();
  else window.addEventListener("load", waitForApplication, { once: true });
})();
