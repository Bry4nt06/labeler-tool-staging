"use strict";

(function installWorkspaceDeveloperControls() {
  const RETRY_MS = 50;
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
  let applyPending = false;

  function readJson(storage, key, fallback) {
    try {
      const parsed = JSON.parse(storage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function preferences() {
    const saved = readJson(localStorage, PREFS_KEY, {});
    return {
      lockedMapIds: Array.isArray(saved.lockedMapIds) ? [...new Set(saved.lockedMapIds.map(String))] : [],
      hiddenPanels: Array.isArray(saved.hiddenPanels) ? [...new Set(saved.hiddenPanels.map(String))] : []
    };
  }

  function savePreferences(next) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }

  function authRecord() {
    return readJson(localStorage, AUTH_KEY, null);
  }

  function developerUnlocked() {
    return sessionStorage.getItem(SESSION_KEY) === "unlocked";
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
    if (!globalThis.crypto?.subtle) throw new Error("Secure browser hashing is unavailable.");
    const payload = new TextEncoder().encode(`${salt}:${password}`);
    return bytesToHex(await crypto.subtle.digest("SHA-256", payload));
  }

  async function createLogin(password, confirmation) {
    if (password.length < 8) throw new Error("Use at least 8 characters for the developer password.");
    if (password !== confirmation) throw new Error("The password confirmation does not match.");
    const salt = randomSalt();
    const digest = await passwordDigest(password, salt);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ version: 1, salt, digest, createdAt: new Date().toISOString() }));
    sessionStorage.setItem(SESSION_KEY, "unlocked");
  }

  async function verifyLogin(password) {
    const record = authRecord();
    if (!record?.salt || !record?.digest) return false;
    return (await passwordDigest(password, record.salt)) === record.digest;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function activeMap() {
    return typeof activeMachineMap === "function" ? activeMachineMap() : null;
  }

  function mapIsLocked(map = activeMap()) {
    return Boolean(map?.id && preferences().lockedMapIds.includes(String(map.id)));
  }

  function installStyles() {
    if (document.querySelector("#workspaceDeveloperStyles")) return;
    const style = document.createElement("style");
    style.id = "workspaceDeveloperStyles";
    style.textContent = `
      .map-toolbar #wipeDownBuilderButton{display:none}
      .developer-mode-card{display:grid;gap:8px;margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--panel)}
      .developer-mode-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .developer-mode-head strong,.developer-mode-head small{display:block}
      .developer-mode-head small,.developer-mode-note{color:var(--muted);font-size:9px;line-height:1.35}
      .developer-mode-status{padding:3px 7px;border:1px solid var(--line);border-radius:999px;font-size:9px;font-weight:800}
      .developer-mode-status[data-state="unlocked"]{border-color:var(--green);color:var(--green)}
      .developer-login-grid,.developer-feature-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .developer-login-grid label,.developer-feature-grid label{display:grid;gap:3px;min-width:0}
      .developer-login-actions,.developer-map-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:end}
      .developer-feature-panel{display:grid;gap:9px;padding-top:8px;border-top:1px solid var(--line)}
      .developer-panel-toggles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
      .developer-panel-toggle{display:flex!important;grid-template-columns:none!important;align-items:center;gap:6px;padding:6px;border:1px solid var(--line);border-radius:7px;background:var(--input);font-size:9px}
      .locked-map-viewer{display:flex;align-items:end;gap:7px;margin-left:auto}
      .locked-map-viewer label{display:grid;gap:2px;color:var(--muted);font-size:8px}
      .locked-map-viewer select{min-width:180px;max-width:280px}
      .locked-map-badge,.map-read-only-indicator{padding:3px 7px;border:1px solid #d79a3c;border-radius:999px;color:#ffc56b;font-size:8px;font-weight:800;white-space:nowrap}
      .map-read-only-indicator{margin-left:7px}
      .read-only-surface input:disabled,.read-only-surface select:disabled,.read-only-surface textarea:disabled,.read-only-surface button:disabled{cursor:not-allowed;opacity:.62}
      #mapLockToggle[data-developer-readonly="true"]{border-color:#d79a3c;color:#ffc56b;cursor:not-allowed}
      [data-developer-hidden="true"]{display:none!important}
      @media(max-width:760px){.developer-login-grid,.developer-feature-grid,.developer-panel-toggles{grid-template-columns:1fr}.locked-map-viewer{width:100%;margin-left:0}.locked-map-viewer label{flex:1}.locked-map-viewer select{width:100%;min-width:0}}
    `;
    document.head.appendChild(style);
  }

  function ensureDeveloperCard() {
    const panel = document.querySelector(".top-settings-panel");
    if (!panel) return null;
    let card = panel.querySelector("#developerModeCard");
    if (card) return card;

    card = document.createElement("section");
    card.id = "developerModeCard";
    card.className = "developer-mode-card";
    card.innerHTML = `
      <div class="developer-mode-head">
        <div><strong>Developer Mode</strong><small>Unlock protected staging controls, map locks, and panel visibility.</small></div>
        <span id="developerModeStatus" class="developer-mode-status" data-state="locked">Locked</span>
      </div>
      <div class="developer-login-grid">
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
    return card;
  }

  function mapOptions(selectedId) {
    const locked = new Set(preferences().lockedMapIds);
    return (state.mapLibrary || []).map((map) => `<option value="${escapeHtml(map.id)}"${String(map.id) === String(selectedId) ? " selected" : ""}>${locked.has(String(map.id)) ? "🔒 " : ""}${escapeHtml(map.name || "Machine Map")}</option>`).join("");
  }

  function renderDeveloperCard() {
    const card = ensureDeveloperCard();
    if (!card) return;
    const unlocked = developerUnlocked();
    const hasLogin = Boolean(authRecord());
    const status = card.querySelector("#developerModeStatus");
    const loginButton = card.querySelector("#developerLoginAction");
    const lockButton = card.querySelector("#developerLockAction");
    const changeButton = card.querySelector("#developerChangePassword");
    const confirmLabel = card.querySelector("#developerConfirmLabel");
    const featurePanel = card.querySelector("#developerFeaturePanel");

    status.textContent = unlocked ? "Unlocked" : hasLogin ? "Locked" : "Setup Required";
    status.dataset.state = unlocked ? "unlocked" : "locked";
    loginButton.hidden = unlocked;
    loginButton.textContent = hasLogin ? "Unlock Developer Mode" : "Create Developer Login";
    lockButton.hidden = !unlocked;
    changeButton.hidden = !unlocked;
    confirmLabel.hidden = hasLogin || unlocked;
    featurePanel.hidden = !unlocked;

    if (!unlocked) return;
    const mapSelect = card.querySelector("#developerMapSelect");
    const selectedId = mapSelect?.value || state.activeMapId;
    mapSelect.innerHTML = mapOptions(selectedId);
    const selectedLocked = preferences().lockedMapIds.includes(String(mapSelect.value || state.activeMapId));
    card.querySelector("#developerToggleMapLock").textContent = selectedLocked ? "Unlock Selected Map" : "Lock Selected Map";
    card.querySelector("#developerPanelToggles").innerHTML = PANEL_DEFINITIONS.map(([id, label]) => {
      const checked = preferences().hiddenPanels.includes(id) ? " checked" : "";
      return `<label class="developer-panel-toggle"><input type="checkbox" data-developer-panel="${id}"${checked}> Hide ${label}</label>`;
    }).join("");
  }

  function ensureLockedMapViewer() {
    const mapHead = document.querySelector(".map-head");
    if (!mapHead) return null;
    let viewer = mapHead.querySelector("#lockedMapViewer");
    if (viewer) return viewer;
    viewer = document.createElement("div");
    viewer.id = "lockedMapViewer";
    viewer.className = "locked-map-viewer";
    viewer.innerHTML = `<label>Locked Maps<select id="lockedMapViewerSelect"></select></label><span class="locked-map-badge">Read Only</span>`;
    mapHead.appendChild(viewer);
    viewer.querySelector("select").addEventListener("change", (event) => {
      const map = (state.mapLibrary || []).find((entry) => String(entry.id) === event.currentTarget.value);
      if (!map || !preferences().lockedMapIds.includes(String(map.id))) return;
      loadMachineMapIntoRuntime(map, true);
      if (typeof saveCurrentSettings === "function") saveCurrentSettings();
      scheduleApply();
    });
    return viewer;
  }

  function renderLockedMapViewer() {
    const viewer = ensureLockedMapViewer();
    if (!viewer) return;
    const lockedIds = new Set(preferences().lockedMapIds);
    const maps = (state.mapLibrary || []).filter((map) => lockedIds.has(String(map.id)));
    viewer.hidden = maps.length === 0;
    const select = viewer.querySelector("select");
    select.innerHTML = maps.map((map) => `<option value="${escapeHtml(map.id)}">${escapeHtml(map.name || "Machine Map")}</option>`).join("");
    if (maps.some((map) => String(map.id) === String(state.activeMapId))) select.value = state.activeMapId;
  }

  function orderTabs() {
    const tabs = document.querySelector(".tabs");
    const builder = document.querySelector("#wipeDownBuilderButton");
    if (!tabs || !builder) return;

    builder.classList.remove("compact-builder-button", "secondary-button", "compact-map-button");
    builder.classList.add("tab", "map-builder-tab");
    builder.textContent = "Map Builder";
    builder.removeAttribute("data-tab");

    const ordered = [builder, ...["specs", "buildInputs", "program", "simulation", "diagnostics"]
      .map((id) => tabs.querySelector(`[data-tab="${id}"]`))
      .filter(Boolean)];
    const current = [...tabs.children].filter((child) => ordered.includes(child));
    if (ordered.length === current.length && ordered.every((button, index) => current[index] === button)) return;

    const fragment = document.createDocumentFragment();
    ordered.forEach((button) => fragment.appendChild(button));
    tabs.insertBefore(fragment, tabs.querySelector(".simulation-actions-spacer"));
  }

  function closeBuilder() {
    const drawer = document.querySelector("#applicationSetupDialog");
    if (drawer?.hidden === false) document.querySelector("#closeApplicationSetup")?.click();
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

  function applyPanelVisibility() {
    const hidden = new Set(preferences().hiddenPanels);
    PANEL_DEFINITIONS.forEach(([id]) => {
      const shouldHide = hidden.has(id) || (id === "mapBuilder" && mapIsLocked());
      panelTargets(id).forEach((target) => { target.dataset.developerHidden = String(shouldHide); });
      if (id === "mapBuilder" && shouldHide) closeBuilder();
    });

    if (hidden.has(String(state.activeTab))) {
      const fallback = ["specs", "buildInputs", "program", "simulation", "diagnostics"].find((id) => !hidden.has(id));
      document.querySelector(`.tabs .tab[data-tab="${fallback}"]`)?.click();
    }
  }

  function setControlReadOnly(control, locked) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement || control instanceof HTMLButtonElement)) return;
    if (control.matches("[data-open-diagnostics],[data-open-simulation]")) return;
    if (locked) {
      if (!control.hasAttribute("data-developer-was-disabled")) control.dataset.developerWasDisabled = String(control.disabled);
      control.disabled = true;
    } else if (control.hasAttribute("data-developer-was-disabled")) {
      control.disabled = control.dataset.developerWasDisabled === "true";
      delete control.dataset.developerWasDisabled;
    }
  }

  function applyReadOnlyState() {
    const locked = mapIsLocked();
    if (locked) {
      state.mapLocked = true;
      closeBuilder();
    }

    const mapLock = document.querySelector("#mapLockToggle");
    if (mapLock) {
      mapLock.dataset.developerReadonly = String(locked);
      mapLock.disabled = locked;
      if (locked) {
        mapLock.setAttribute("aria-pressed", "true");
        mapLock.textContent = "Read Only";
      } else if (mapLock.textContent === "Read Only") {
        mapLock.textContent = state.mapLocked === false ? "Unlocked" : "Locked";
      }
    }

    [document.querySelector("#undoMapEdit"), ...["#specs", "#buildInputs", "#program", "#applicationSetupDialog"].flatMap((selector) => {
      const surface = document.querySelector(selector);
      if (!surface) return [];
      surface.classList.toggle("read-only-surface", locked);
      return [...surface.querySelectorAll("input,select,textarea,button")];
    })].filter(Boolean).forEach((control) => setControlReadOnly(control, locked));

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

  function syncTabState() {
    const drawerOpen = document.querySelector("#applicationSetupDialog")?.hidden === false;
    const builder = document.querySelector("#wipeDownBuilderButton");
    builder?.classList.toggle("active", drawerOpen);
    if (drawerOpen) document.querySelectorAll('.tabs .tab[data-tab]').forEach((tab) => tab.classList.remove("active"));
  }

  function applyWorkspaceState() {
    applyPending = false;
    orderTabs();
    renderLockedMapViewer();
    applyPanelVisibility();
    applyReadOnlyState();
    renderDeveloperCard();
    bindDynamicControls();
    syncTabState();
  }

  function scheduleApply() {
    if (applyPending) return;
    applyPending = true;
    window.requestAnimationFrame(applyWorkspaceState);
  }

  function installOutsideClickClosing() {
    if (document.documentElement.dataset.workspaceAutoCloseBound === "true") return;
    document.documentElement.dataset.workspaceAutoCloseBound = "true";
    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      const settings = document.querySelector(".top-settings-menu");
      if (settings?.open && !settings.contains(target)) settings.open = false;

      const drawer = document.querySelector("#applicationSetupDialog");
      const builder = document.querySelector("#wipeDownBuilderButton");
      if (drawer?.hidden === false && !drawer.contains(target) && !builder?.contains(target)) closeBuilder();

      const reference = document.querySelector("#labelerMapReference");
      const referenceButton = document.querySelector("#labelerMapButton");
      if (reference?.hidden === false && !reference.contains(target) && !referenceButton?.contains(target)) document.querySelector("#closeLabelerMap")?.click();

      const wipePanel = document.querySelector("#wipeDownDataPanel");
      const wipeButton = document.querySelector("#showWipeDownData");
      if (wipePanel?.hidden === false && !wipePanel.contains(target) && !wipeButton?.contains(target)) document.querySelector("#closeWipeDownData")?.click();

      document.querySelectorAll(".builder-scroll-content details[open],.top-settings-panel details[open]").forEach((details) => {
        if (!details.contains(target)) details.open = false;
      });
    }, true);
  }

  function bindDeveloperCard() {
    const card = ensureDeveloperCard();
    if (!card || card.dataset.workspaceBound === "true") return;
    card.dataset.workspaceBound = "true";

    card.querySelector("#developerLoginAction").addEventListener("click", async () => {
      const message = card.querySelector("#developerLoginMessage");
      try {
        const password = String(card.querySelector("#developerPassword").value || "");
        const confirmation = String(card.querySelector("#developerPasswordConfirm").value || "");
        if (authRecord()) {
          if (!(await verifyLogin(password))) throw new Error("Incorrect developer password.");
          sessionStorage.setItem(SESSION_KEY, "unlocked");
        } else {
          await createLogin(password, confirmation);
        }
        message.textContent = "Developer Mode unlocked for this browser session.";
        scheduleApply();
      } catch (error) {
        message.textContent = error.message;
      }
    });

    card.querySelector("#developerLockAction").addEventListener("click", () => {
      sessionStorage.removeItem(SESSION_KEY);
      scheduleApply();
    });

    card.querySelector("#developerChangePassword").addEventListener("click", async () => {
      const password = window.prompt("Enter the new developer password (minimum 8 characters):", "");
      if (password == null) return;
      const confirmation = window.prompt("Confirm the new developer password:", "");
      if (confirmation == null) return;
      try {
        await createLogin(password, confirmation);
        card.querySelector("#developerLoginMessage").textContent = "Developer login updated.";
        scheduleApply();
      } catch (error) {
        card.querySelector("#developerLoginMessage").textContent = error.message;
      }
    });

    card.addEventListener("change", (event) => {
      const mapSelect = event.target.closest("#developerMapSelect");
      if (mapSelect) {
        const selectedLocked = preferences().lockedMapIds.includes(String(mapSelect.value));
        card.querySelector("#developerToggleMapLock").textContent = selectedLocked ? "Unlock Selected Map" : "Lock Selected Map";
        return;
      }
      const panelToggle = event.target.closest("[data-developer-panel]");
      if (!panelToggle) return;
      const next = preferences();
      const panelId = panelToggle.dataset.developerPanel;
      next.hiddenPanels = panelToggle.checked
        ? [...new Set([...next.hiddenPanels, panelId])]
        : next.hiddenPanels.filter((id) => id !== panelId);
      savePreferences(next);
      scheduleApply();
    });

    card.querySelector("#developerToggleMapLock").addEventListener("click", () => {
      const selectedId = String(card.querySelector("#developerMapSelect").value || "");
      if (!selectedId) return;
      const next = preferences();
      next.lockedMapIds = next.lockedMapIds.includes(selectedId)
        ? next.lockedMapIds.filter((id) => id !== selectedId)
        : [...next.lockedMapIds, selectedId];
      savePreferences(next);
      scheduleApply();
    });
  }

  function bindDynamicControls() {
    bindDeveloperCard();
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

  function wrapFunction(name) {
    const original = window[name];
    if (typeof original !== "function" || original.workspaceDeveloperWrapped) return;
    const wrapped = function workspaceDeveloperWrappedFunction(...args) {
      const result = original.apply(this, args);
      scheduleApply();
      return result;
    };
    wrapped.workspaceDeveloperWrapped = true;
    window[name] = wrapped;
    try { globalThis[name] = wrapped; } catch { }
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined" || typeof activeMachineMap !== "function" || !document.querySelector(".tabs")) return false;
    installed = true;
    installStyles();
    installOutsideClickClosing();
    ["loadMachineMapIntoRuntime", "render", "renderSpecs", "renderBuildInputs", "renderProgram"].forEach(wrapFunction);
    applyWorkspaceState();
    window.setTimeout(scheduleApply, 250);
    window.setTimeout(scheduleApply, 1000);
    return true;
  }

  function waitForApplication() {
    if (install()) return;
    window.setTimeout(waitForApplication, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForApplication, { once: true });
  else waitForApplication();
})();