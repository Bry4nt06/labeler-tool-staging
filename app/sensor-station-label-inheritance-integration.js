"use strict";

(function installSensorStationLabelInheritance(global) {
  if (global.LabelerSensorStationLabelInheritance?.installed) return;

  const RETRY_MS = 50;
  const CATALOG_VERSION = 8;
  const DEFAULT_MAP_IDS = new Set([
    "map-l85-workbook-reference-3-label-apl",
    "map-45h-topmodul-3-label-apl-wipe-down-pads"
  ]);
  let installed = false;

  const driver = () => global.LabelerDriverRegistry?.resolve("profile.sensorStationLabel")
    || global.LabelerSensorStationLabelDriver
    || null;

  function activeMap() {
    try { return typeof global.activeMachineMap === "function" ? global.activeMachineMap() : null; }
    catch { return null; }
  }

  function editableMap() {
    try { return typeof global.editableMachineMap === "function" ? global.editableMachineMap() : activeMap(); }
    catch { return activeMap(); }
  }

  function normalizeDefaultMetadata(map) {
    if (!map || !DEFAULT_MAP_IDS.has(String(map.id || ""))) return false;
    let changed = false;
    const assign = (key, value) => {
      if (map[key] === value) return;
      map[key] = value;
      changed = true;
    };
    assign("companyDefaultProgram", true);
    assign("companyDefaultProgramVersion", CATALOG_VERSION);
    assign("protectedDefaultMap", true);
    if (String(map.id) === "map-45h-topmodul-3-label-apl-wipe-down-pads") {
      assign("defaultCatalogVersion", CATALOG_VERSION);
    }
    return changed;
  }

  function normalizeMap(map) {
    const policy = driver();
    if (!policy || !map) return false;
    const sensorsChanged = policy.normalizeMap(map, { rename: true });
    const metadataChanged = normalizeDefaultMetadata(map);
    return sensorsChanged || metadataChanged;
  }

  function normalizeRuntime() {
    if (!global.state) return false;
    let changed = false;
    (Array.isArray(global.state.mapLibrary) ? global.state.mapLibrary : []).forEach((map) => {
      if (normalizeMap(map)) changed = true;
    });
    if (Array.isArray(global.state.aplMapObjects)) {
      global.state.aplMapObjects.forEach((item) => {
        if (driver()?.normalizeSensor(item, { rename: true })) changed = true;
      });
    }
    const current = activeMap();
    if (current && normalizeMap(current)) changed = true;
    return changed;
  }

  function sensorForRow(row, map) {
    if (!row || !map || !Array.isArray(map.objects)) return null;
    return map.objects.find((item) => String(item?.id) === String(row.dataset.builderObjectId) && item?.kind === "sensor") || null;
  }

  function inheritedLabelField(item) {
    const policy = driver();
    const section = policy.sectionForStation(item.station);
    const label = document.createElement("label");
    label.className = "sensor-inherited-label-field";
    label.innerHTML = `Inspection label<div class="sensor-inherited-label-value">${policy.sectionLabel(section)} label</div><small>Inherited from ${policy.stationPairLabel(section)}. This sensor only inspects that label.</small>`;
    return label;
  }

  function removeSensorLabelSelectors(row) {
    row.querySelectorAll(".map-object-orientation-fields").forEach((node) => node.remove());
    row.querySelectorAll("label").forEach((label) => {
      const text = String(label.textContent || "").replace(/\s+/g, " ").trim();
      const hasLabelSelector = label.querySelector(
        "[data-station-section], [data-object-orientation-field='orientationLabelSection'], [data-corrected-orientation-field='orientationLabelSection']"
      );
      if (hasLabelSelector || /^(?:Label use|Target label|Inspection label|Station application)\b/i.test(text)) {
        label.remove();
      }
    });
  }

  function relabelSensorEnabled(row, item) {
    const checkbox = row.querySelector('[data-builder-field="servoAssist"]');
    const label = checkbox?.closest("label");
    if (!label) return;
    const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) textNode.textContent = " Sensor enabled";
    const small = label.querySelector("small");
    const section = driver().sectionForStation(item.station);
    if (small) small.textContent = `When enabled, ServoForge orients the bottle to meet the required view of the ${driver().sectionLabel(section).toLowerCase()} label.`;
  }

  function decorateSensorRows() {
    const map = activeMap();
    if (!map) return;
    document.querySelectorAll(".wipe-builder-row[data-builder-object-id]").forEach((row) => {
      const item = sensorForRow(row, map);
      if (!item) return;
      driver().normalizeSensor(item, { rename: true });
      removeSensorLabelSelectors(row);
      const grid = row.querySelector(".builder-row-grid");
      const stationLabel = grid?.querySelector('[data-builder-field="station"]')?.closest("label");
      if (grid && !grid.querySelector(".sensor-inherited-label-field")) {
        const field = inheritedLabelField(item);
        if (stationLabel?.nextSibling) grid.insertBefore(field, stationLabel.nextSibling);
        else grid.appendChild(field);
      }
      relabelSensorEnabled(row, item);
      const status = row.querySelector(".sensor-inline-status span");
      const section = driver().sectionForStation(item.station);
      if (status && !status.textContent.includes("label")) {
        status.textContent = `${status.textContent} • ${driver().sectionLabel(section)} label`;
      }
      const title = row.querySelector("summary strong");
      const nameInput = row.querySelector('[data-builder-field="name"]');
      if (title) title.textContent = item.name;
      if (nameInput && nameInput.value !== item.name) nameInput.value = item.name;
    });
  }

  function wrapLoadSavedSettings() {
    const base = global.loadSavedSettings;
    if (typeof base !== "function") return false;
    if (base.sensorStationLabelInheritance) return true;
    const wrapped = function loadSavedSettingsWithSensorInheritance(...args) {
      const result = base.apply(this, args);
      normalizeRuntime();
      return result;
    };
    wrapped.sensorStationLabelInheritance = true;
    wrapped.previousLoadSavedSettings = base;
    global.loadSavedSettings = wrapped;
    return true;
  }

  function wrapLoadMachineMap() {
    const base = global.loadMachineMapIntoRuntime;
    if (typeof base !== "function") return false;
    if (base.sensorStationLabelInheritance) return true;
    const wrapped = function loadMachineMapWithSensorInheritance(map, ...args) {
      normalizeMap(map);
      const result = base.call(this, map, ...args);
      normalizeRuntime();
      return result;
    };
    wrapped.sensorStationLabelInheritance = true;
    wrapped.previousLoadMachineMapIntoRuntime = base;
    global.loadMachineMapIntoRuntime = wrapped;
    return true;
  }

  function wrapBuilderRefresh() {
    const base = global.refreshAfterBuilderEdit;
    if (typeof base !== "function") return false;
    if (base.sensorStationLabelInheritance) return true;
    const wrapped = function refreshAfterBuilderEditWithSensorInheritance(...args) {
      normalizeMap(editableMap());
      normalizeRuntime();
      return base.apply(this, args);
    };
    wrapped.sensorStationLabelInheritance = true;
    wrapped.previousRefreshAfterBuilderEdit = base;
    global.refreshAfterBuilderEdit = wrapped;
    return true;
  }

  function wrapBuilderRenderer() {
    const base = global.renderWipeDownBuilder;
    if (typeof base !== "function") return false;
    if (base.sensorStationLabelInheritance) return true;
    const wrapped = function renderWipeDownBuilderWithSensorInheritance(...args) {
      normalizeMap(editableMap());
      normalizeRuntime();
      const result = base.apply(this, args);
      normalizeMap(editableMap());
      decorateSensorRows();
      return result;
    };
    wrapped.sensorStationLabelInheritance = true;
    wrapped.previousRenderWipeDownBuilder = base;
    global.renderWipeDownBuilder = wrapped;
    return true;
  }

  function wrapCompanyDefaults() {
    const service = global.LabelerCompanyDefaultsService;
    if (!service?.reconcile) return false;
    if (service.sensorStationLabelInheritanceV8) return true;
    const baseReconcile = service.reconcile.bind(service);
    global.LabelerCompanyDefaultsService = Object.freeze({
      ...service,
      async reconcile(...args) {
        const result = await baseReconcile(...args);
        const changed = normalizeRuntime();
        if (changed && typeof global.saveCurrentSettings === "function") global.saveCurrentSettings();
        return {
          ...result,
          changed: Boolean(result?.changed || changed),
          sensorStationLabelsNormalized: changed,
          companyDefaultsVersion: Math.max(Number(result?.version || 0), CATALOG_VERSION)
        };
      },
      sensorStationLabelInheritanceV8: true
    });
    return true;
  }

  function installStyles() {
    if (document.querySelector("#sensorStationLabelInheritanceStyles")) return;
    const style = document.createElement("style");
    style.id = "sensorStationLabelInheritanceStyles";
    style.textContent = `
      .sensor-inherited-label-field{display:flex;flex-direction:column;gap:4px;border-left:3px solid var(--blue);padding-left:7px}
      .sensor-inherited-label-value{min-height:32px;display:flex;align-items:center;padding:0 10px;border:1px solid var(--line);border-radius:5px;background:var(--panel-strong);font-weight:700}
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (installed) return true;
    if (!global.state
      || !driver()
      || typeof global.renderWipeDownBuilder !== "function"
      || typeof global.refreshAfterBuilderEdit !== "function"
      || typeof global.loadSavedSettings !== "function"
      || typeof global.loadMachineMapIntoRuntime !== "function") return false;

    installStyles();
    wrapLoadSavedSettings();
    wrapLoadMachineMap();
    wrapBuilderRefresh();
    wrapBuilderRenderer();
    wrapCompanyDefaults();
    const changed = normalizeRuntime();
    installed = true;

    global.LabelerSensorStationLabelInheritance = Object.freeze({
      installed: true,
      CATALOG_VERSION,
      normalizeMap,
      normalizeRuntime,
      decorateSensorRows
    });

    if (changed && typeof global.saveCurrentSettings === "function") global.saveCurrentSettings();
    global.setTimeout(() => {
      wrapCompanyDefaults();
      normalizeRuntime();
      if (typeof global.renderWipeDownBuilder === "function") global.renderWipeDownBuilder();
      if (typeof global.applyGeneratedServoProfile === "function" && global.state?.selectedBrand) {
        global.applyGeneratedServoProfile();
      }
    }, 0);
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})(typeof window !== "undefined" ? window : globalThis);
