"use strict";

(function installSensorStationLabelInheritance(global) {
  if (global.LabelerSensorStationLabelInheritance?.installed) return;

  const RETRY_MS = 50;
  const CATALOG_VERSION = 9;
  const DEFAULT_MAP_IDS = new Set([
    "map-l85-workbook-reference-3-label-apl",
    "map-45h-topmodul-3-label-apl-wipe-down-pads"
  ]);
  let installed = false;
  let observer = null;
  let enforceTimer = null;
  let regenerationTimer = null;

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
    if (!global.state || !driver()) return false;
    let changed = false;
    (Array.isArray(global.state.mapLibrary) ? global.state.mapLibrary : []).forEach((map) => {
      if (normalizeMap(map)) changed = true;
    });
    if (Array.isArray(global.state.aplMapObjects)) {
      global.state.aplMapObjects.forEach((item) => {
        if (driver().normalizeSensor(item, { rename: true })) changed = true;
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
      if (label.classList.contains("sensor-inherited-label-field")) return;
      const text = String(label.textContent || "").replace(/\s+/g, " ").trim();
      const hasLabelSelector = label.querySelector(
        "[data-station-section], [data-object-orientation-field='orientationLabelSection'], [data-corrected-orientation-field='orientationLabelSection']"
      );
      if (hasLabelSelector || /^(?:Label use|Target label|Inspection label|Station application|Coding label)\b/i.test(text)) {
        label.remove();
      }
    });
  }

  function relabelSensorEnabled(row, item) {
    const checkbox = row.querySelector('[data-builder-field="servoAssist"]');
    const label = checkbox?.closest("label");
    if (!label) return;
    const textNode = [...label.childNodes].find((node) => node.nodeType === 3 && String(node.textContent || "").trim());
    if (textNode && textNode.textContent !== " Sensor enabled") textNode.textContent = " Sensor enabled";
    const small = label.querySelector("small");
    const section = driver().sectionForStation(item.station);
    const message = `When enabled, ServoForge orients the bottle to meet the required view of the ${driver().sectionLabel(section).toLowerCase()} label.`;
    if (small && small.textContent !== message) small.textContent = message;
  }

  function updateInheritedField(row, item) {
    const grid = row.querySelector(".builder-row-grid");
    if (!grid) return;
    const section = driver().sectionForStation(item.station);
    const expectedValue = `${driver().sectionLabel(section)} label`;
    const expectedHelp = `Inherited from ${driver().stationPairLabel(section)}. This sensor only inspects that label.`;
    let field = grid.querySelector(".sensor-inherited-label-field");
    if (!field) {
      field = inheritedLabelField(item);
      const stationLabel = grid.querySelector('[data-builder-field="station"]')?.closest("label");
      if (stationLabel?.nextSibling) grid.insertBefore(field, stationLabel.nextSibling);
      else grid.appendChild(field);
      return;
    }
    const value = field.querySelector(".sensor-inherited-label-value");
    const help = field.querySelector("small");
    if (value && value.textContent !== expectedValue) value.textContent = expectedValue;
    if (help && help.textContent !== expectedHelp) help.textContent = expectedHelp;
  }

  function decorateSensorRows() {
    const map = activeMap();
    const policy = driver();
    if (!map || !policy) return false;
    let changed = false;
    document.querySelectorAll(".wipe-builder-row[data-builder-object-id]").forEach((row) => {
      const item = sensorForRow(row, map);
      if (!item) return;
      if (policy.normalizeSensor(item, { rename: true })) changed = true;
      removeSensorLabelSelectors(row);
      updateInheritedField(row, item);
      relabelSensorEnabled(row, item);

      const status = row.querySelector(".sensor-inline-status span");
      const section = policy.sectionForStation(item.station);
      const statusText = status ? String(status.textContent || "").replace(/\s*•\s*(?:Neck|Body|Back) label$/i, "") : "";
      const expectedStatus = `${statusText} • ${policy.sectionLabel(section)} label`;
      if (status && status.textContent !== expectedStatus) status.textContent = expectedStatus;

      const title = row.querySelector("summary strong");
      const nameInput = row.querySelector('[data-builder-field="name"]');
      if (title && title.textContent !== item.name) title.textContent = item.name;
      if (nameInput && nameInput.value !== item.name) nameInput.value = item.name;
    });
    return changed;
  }

  function scheduleRegeneration() {
    if (regenerationTimer) return;
    regenerationTimer = global.setTimeout(() => {
      regenerationTimer = null;
      try {
        global.saveCurrentSettings?.();
        if (global.state?.selectedBrand) global.applyGeneratedServoProfile?.();
        global.renderValidation?.();
      } catch (error) {
        console.error("Unable to apply station-pair sensor labels.", error);
      }
    }, 0);
  }

  function enforceSensorPolicy() {
    enforceTimer = null;
    const changed = normalizeRuntime();
    const rowChanged = decorateSensorRows();
    if (changed || rowChanged) scheduleRegeneration();
    return changed || rowChanged;
  }

  function enforceSoon() {
    if (enforceTimer) return;
    enforceTimer = global.setTimeout(enforceSensorPolicy, 0);
  }

  function installObserver() {
    if (observer || typeof MutationObserver !== "function" || !document.documentElement) return;
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "childList" && mutation.addedNodes.length)) enforceSoon();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function wrapFunction(name, marker, after) {
    const base = global[name];
    if (typeof base !== "function") return false;
    if (base[marker]) return true;
    const wrapped = function sensorStationLabelWrappedFunction(...args) {
      const result = base.apply(this, args);
      after(args, result);
      enforceSoon();
      return result;
    };
    wrapped[marker] = true;
    wrapped.previousFunction = base;
    global[name] = wrapped;
    return true;
  }

  function installHooks() {
    wrapFunction("loadSavedSettings", "sensorStationLabelInheritanceV9", () => normalizeRuntime());
    wrapFunction("loadMachineMapIntoRuntime", "sensorStationLabelInheritanceV9", ([map]) => normalizeMap(map));
    wrapFunction("refreshAfterBuilderEdit", "sensorStationLabelInheritanceV9", () => normalizeMap(editableMap()));
    wrapFunction("renderWipeDownBuilder", "sensorStationLabelInheritanceV9", () => {
      normalizeMap(editableMap());
      decorateSensorRows();
    });

    const service = global.LabelerCompanyDefaultsService;
    if (service?.reconcile && !service.sensorStationLabelInheritanceV9) {
      const baseReconcile = service.reconcile.bind(service);
      global.LabelerCompanyDefaultsService = Object.freeze({
        ...service,
        async reconcile(...args) {
          const result = await baseReconcile(...args);
          const changed = normalizeRuntime();
          if (changed) global.saveCurrentSettings?.();
          enforceSoon();
          return {
            ...result,
            changed: Boolean(result?.changed || changed),
            sensorStationLabelsNormalized: changed,
            companyDefaultsVersion: Math.max(Number(result?.version || 0), CATALOG_VERSION)
          };
        },
        sensorStationLabelInheritanceV9: true
      });
    }
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
    installObserver();
    installStyles();
    installHooks();
    if (installed) {
      enforceSoon();
      return true;
    }
    if (!driver() || !global.state) return false;

    installed = true;
    global.LabelerSensorStationLabelInheritance = Object.freeze({
      installed: true,
      CATALOG_VERSION,
      normalizeMap,
      normalizeRuntime,
      decorateSensorRows,
      enforceSensorPolicy
    });

    enforceSensorPolicy();
    [50, 250, 750, 1500].forEach((delay) => global.setTimeout(() => {
      installHooks();
      enforceSensorPolicy();
    }, delay));
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})(typeof window !== "undefined" ? window : globalThis);
