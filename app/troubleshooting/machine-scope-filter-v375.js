"use strict";

(function installTroubleshootingMachineScope(global) {
  const base = global.ServoForgeTroubleshootingLibrary;
  if (!base || global.ServoForgeTroubleshootingMachineScope) return;

  const SCOPE_KEY = "servoforge-troubleshooting-scope-v1";
  const SETTINGS_KEY = "labelerToolSettings";
  const VALID_MACHINES = new Set(["auto", "all", "autocol", "multimodul", "topmodul-dts4", "topmodul-dts3"]);
  const VALID_APPLICATIONS = new Set(["auto", "all", "apl", "cold-glue"]);
  const MACHINE_LABELS = Object.freeze({
    all: "All Machines",
    autocol: "Autocol",
    multimodul: "MultiModul",
    "topmodul-dts4": "TopModul (DTS4)",
    "topmodul-dts3": "TopModul (DTS3)"
  });
  const APPLICATION_LABELS = Object.freeze({
    all: "All Applications",
    apl: "APL",
    "cold-glue": "Cold Glue"
  });

  function safeJson(raw, fallback = null) {
    try { return JSON.parse(raw); }
    catch { return fallback; }
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function canonicalMachine(value) {
    const text = normalizeText(value).replaceAll(" ", "");
    if (text.includes("AUTOCOL")) return "autocol";
    if (text.includes("MULTIMODUL")) return "multimodul";
    if (text.includes("TOPMODUL") && text.includes("DTS3")) return "topmodul-dts3";
    if (text.includes("TOPMODUL") && text.includes("DTS4")) return "topmodul-dts4";
    // Existing saved TopModul maps predate the explicit DTS split and are DTS4.
    if (text.includes("TOPMODUL")) return "topmodul-dts4";
    return "all";
  }

  function canonicalApplication(value) {
    const text = normalizeText(value).replaceAll(" ", "");
    if (text === "APL" || text.includes("AUTOMATICPRESSURESENSITIVE")) return "apl";
    if (text.includes("COLDGLUE")) return "cold-glue";
    return "all";
  }

  function readSavedMachineContext() {
    let saved = {};
    try { saved = safeJson(global.localStorage?.getItem(SETTINGS_KEY), {}) || {}; } catch { saved = {}; }
    const mapLibrary = Array.isArray(saved.mapLibrary) ? saved.mapLibrary : [];
    const activeMap = mapLibrary.find((map) => map?.id === saved.activeMapId) || null;
    return {
      machineType: activeMap?.machineType || saved.machineType || "",
      applicationMode: activeMap?.applicationMode || activeMap?.application || saved.applicationMode || ""
    };
  }

  function readSelections() {
    let stored = {};
    try { stored = safeJson(global.localStorage?.getItem(SCOPE_KEY), {}) || {}; } catch { stored = {}; }
    let machine = String(stored.machine || "");
    // v375 originally stored the generic value "topmodul". Preserve that user's
    // intent by migrating it to the current DTS4 family, which is the legacy map.
    if (machine === "topmodul") machine = "topmodul-dts4";
    machine = VALID_MACHINES.has(machine) ? machine : "auto";
    const application = VALID_APPLICATIONS.has(String(stored.application || "")) ? String(stored.application) : "auto";
    return { machine, application };
  }

  let selections = readSelections();

  function writeSelections() {
    try { global.localStorage?.setItem(SCOPE_KEY, JSON.stringify(selections)); } catch { }
  }

  function resolvedScope(context = {}) {
    const detected = { ...readSavedMachineContext(), ...(context || {}) };
    const detectedMachine = canonicalMachine(detected.machineType);
    const detectedApplication = canonicalApplication(detected.applicationMode);
    const machine = selections.machine === "auto" ? detectedMachine : selections.machine;
    const application = selections.application === "auto" ? detectedApplication : selections.application;
    return {
      machine,
      application,
      detectedMachine,
      detectedApplication,
      context: {
        ...(context || {}),
        machineType: machine === "all" ? "" : MACHINE_LABELS[machine],
        applicationMode: application === "all" ? "" : application
      }
    };
  }

  function sourceFor(ref) {
    try { return base.getSource?.(ref?.sourceId) || null; }
    catch { return null; }
  }

  function recordText(record) {
    const parts = [
      record?.id,
      record?.code,
      record?.title,
      record?.summary,
      record?.description,
      record?.category,
      record?.machineType,
      record?.machineFamily,
      record?.applicationMode,
      record?.application,
      ...(Array.isArray(record?.aliases) ? record.aliases : []),
      ...(Array.isArray(record?.machineTypes) ? record.machineTypes : []),
      ...(Array.isArray(record?.machineFamilies) ? record.machineFamilies : []),
      ...(Array.isArray(record?.applications) ? record.applications : []),
      ...(Array.isArray(record?.topics) ? record.topics : [])
    ];
    for (const ref of Array.isArray(record?.sourceRefs) ? record.sourceRefs : []) {
      const source = sourceFor(ref);
      if (!source) continue;
      parts.push(source.id, source.title, source.file, source.notes, ...(Array.isArray(source.topics) ? source.topics : []));
    }
    return normalizeText(parts.filter(Boolean).join(" "));
  }

  function explicitMachines(record) {
    const text = recordText(record);
    const machines = new Set();
    if (/\bAUTOCOL\b/.test(text)) machines.add("autocol");
    if (/\bMULTI\s*MODUL\b/.test(text) || /\bMULTIMODUL\b/.test(text)) machines.add("multimodul");

    const hasTopModul = /\bTOP\s*MODUL\b/.test(text) || /\bTOPMODUL\b/.test(text);
    if (hasTopModul) {
      const hasDts3 = /\bDTS\s*3\b/.test(text) || /\bDTS3\b/.test(text);
      const hasDts4 = /\bDTS\s*4\b/.test(text) || /\bDTS4\b/.test(text);
      if (hasDts3) machines.add("topmodul-dts3");
      if (hasDts4) machines.add("topmodul-dts4");
      // A generic TopModul reference predates/does not declare the RPC revision,
      // so keep it available to both variants rather than pretending it is DTS4-only.
      if (!hasDts3 && !hasDts4) {
        machines.add("topmodul-dts3");
        machines.add("topmodul-dts4");
      }
    }
    return machines;
  }

  function explicitApplications(record) {
    const text = recordText(record);
    const applications = new Set();
    if (/\bAPL\b/.test(text)) applications.add("apl");
    if (/\bCOLD\s*GLUE\b/.test(text) || /\bCOLDGLUE\b/.test(text)) applications.add("cold-glue");
    return applications;
  }

  function recordMatches(record, scope) {
    const machines = explicitMachines(record);
    const applications = explicitApplications(record);
    const machineOk = scope.machine === "all" || machines.size === 0 || machines.has(scope.machine);
    const applicationOk = scope.application === "all" || applications.size === 0 || applications.has(scope.application);
    return machineOk && applicationOk;
  }

  function searchEntries(query, context = {}, limit = 8) {
    const requested = Math.max(1, Number(limit) || 8);
    const scope = resolvedScope(context);
    const poolLimit = Math.max(requested, Array.isArray(base.entries) ? base.entries.length : 128);
    const rows = base.searchEntries.call(base, query, scope.context, poolLimit);
    return rows.filter((entry) => recordMatches(entry, scope)).slice(0, requested);
  }

  function recommendFlows(context = {}) {
    const scope = resolvedScope(context);
    const rows = typeof base.recommendFlows === "function"
      ? base.recommendFlows.call(base, scope.context)
      : (Array.isArray(base.flows) ? base.flows : []);
    return rows.filter((flow) => recordMatches(flow, scope));
  }

  function searchSources(query, limit) {
    const requested = Math.max(1, Number(limit) || (Array.isArray(base.sources) ? base.sources.length : 100));
    const scope = resolvedScope(readSavedMachineContext());
    const poolLimit = Math.max(requested, Array.isArray(base.sources) ? base.sources.length : requested);
    const rows = base.searchSources.call(base, query, poolLimit);
    return rows.filter((source) => recordMatches(source, scope)).slice(0, requested);
  }

  function setMachineScope(value) {
    let next = String(value || "auto");
    if (next === "topmodul") next = "topmodul-dts4";
    selections.machine = VALID_MACHINES.has(next) ? next : "auto";
    writeSelections();
    return selections.machine;
  }

  function setApplicationScope(value) {
    const next = String(value || "auto");
    selections.application = VALID_APPLICATIONS.has(next) ? next : "auto";
    writeSelections();
    return selections.application;
  }

  function getScope(context = {}) {
    return { selections: { ...selections }, ...resolvedScope(context) };
  }

  const api = Object.freeze({
    version: "v375.1",
    getScope,
    setMachineScope,
    setApplicationScope,
    recordMatches,
    canonicalMachine,
    canonicalApplication
  });

  global.ServoForgeTroubleshootingMachineScope = api;
  global.ServoForgeTroubleshootingLibrary = Object.freeze({
    ...base,
    searchEntries,
    recommendFlows,
    searchSources,
    machineScope: api
  });

  function installControls() {
    if (typeof document === "undefined" || document.getElementById("troubleshootingMachineScope")) return;
    const context = document.getElementById("troubleshootingContext");
    if (!context?.parentElement) return;
    const wrapper = document.createElement("div");
    wrapper.className = "sf-machine-scope-controls";
    wrapper.innerHTML = `
      <label>Machine Scope
        <select id="troubleshootingMachineScope" aria-label="Troubleshooting machine scope">
          <option value="auto">Auto (current setup)</option>
          <option value="autocol">Autocol</option>
          <option value="multimodul">MultiModul</option>
          <option value="topmodul-dts4">TopModul (DTS4)</option>
          <option value="topmodul-dts3">TopModul (DTS3)</option>
          <option value="all">All Machines</option>
        </select>
      </label>
      <label>Application
        <select id="troubleshootingApplicationScope" aria-label="Troubleshooting application scope">
          <option value="auto">Auto (current setup)</option>
          <option value="apl">APL</option>
          <option value="cold-glue">Cold Glue</option>
          <option value="all">All Applications</option>
        </select>
      </label>
      <span id="troubleshootingScopeStatus" class="sf-machine-scope-status"></span>`;
    context.insertAdjacentElement("afterend", wrapper);

    const style = document.createElement("style");
    style.id = "troubleshootingMachineScopeStyles";
    style.textContent = `
      .sf-machine-scope-controls{display:grid;grid-template-columns:minmax(180px,240px) minmax(180px,240px) 1fr;gap:10px;align-items:end;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
      .sf-machine-scope-controls label{display:grid;gap:5px;color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
      .sf-machine-scope-controls select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:7px;background:var(--input);color:var(--ink)}
      .sf-machine-scope-status{align-self:center;color:var(--muted);font-size:11px;line-height:1.45}
      @media(max-width:780px){.sf-machine-scope-controls{grid-template-columns:1fr}.sf-machine-scope-status{padding-top:2px}}
    `;
    document.head.appendChild(style);

    const machineSelect = document.getElementById("troubleshootingMachineScope");
    const applicationSelect = document.getElementById("troubleshootingApplicationScope");
    const status = document.getElementById("troubleshootingScopeStatus");
    machineSelect.value = selections.machine;
    applicationSelect.value = selections.application;

    const renderStatus = () => {
      const saved = readSavedMachineContext();
      const scope = resolvedScope(saved);
      const machineText = selections.machine === "auto"
        ? (scope.detectedMachine === "all" ? "Auto: no machine detected" : `Auto detected: ${MACHINE_LABELS[scope.detectedMachine]}`)
        : MACHINE_LABELS[scope.machine];
      const appText = selections.application === "auto"
        ? (scope.detectedApplication === "all" ? "all applications" : APPLICATION_LABELS[scope.detectedApplication])
        : APPLICATION_LABELS[scope.application];
      status.textContent = `${machineText} • ${appText}. Machine-specific records outside this scope are hidden; universal records remain available.`;
    };
    renderStatus();

    const apply = () => {
      setMachineScope(machineSelect.value);
      setApplicationScope(applicationSelect.value);
      renderStatus();
      global.location?.reload?.();
    };
    machineSelect.addEventListener("change", apply);
    applicationSelect.addEventListener("change", apply);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installControls, { once: true });
    else installControls();
  }
})(typeof window !== "undefined" ? window : globalThis);
