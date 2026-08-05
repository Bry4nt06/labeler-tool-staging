"use strict";

(function installSensorStationLabelInheritance(global) {
  if (global.LabelerSensorStationLabelInheritance?.installed) return;

  const RETRY_MS = 50;
  const CATALOG_VERSION = 10;
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
    const field = document.createElement("div");
    field.className = "sensor-inherited-label-field sensor-grid-field";
    field.innerHTML = `<span class="sensor-field-caption">Inspection label</span><strong class="sensor-inherited-label-value">${policy.sectionLabel(section)} label</strong><small>${policy.stationPairLabel(section)}</small>`;
    return field;
  }

  function removeSensorLabelSelectors(row) {
    row.querySelectorAll(".map-object-orientation-fields").forEach((node) => node.remove());
    row.querySelectorAll("label").forEach((label) => {
      const text = String(label.textContent || "").replace(/\s+/g, " ").trim();
      const hasLabelSelector = label.querySelector(
        "[data-station-section], [data-object-orientation-field='orientationLabelSection'], [data-corrected-orientation-field='orientationLabelSection']"
      );
      if (hasLabelSelector || /^(?:Label use|Target label|Inspection label|Station application|Coding label)\b/i.test(text)) {
        label.remove();
      }
    });
  }

  function labelForControl(row, selector, className) {
    const label = row.querySelector(selector)?.closest("label");
    if (label && className) label.classList.add("sensor-grid-field", className);
    return label;
  }

  function relabelSensorEnabled(row, item) {
    const label = labelForControl(row, '[data-builder-field="servoAssist"]', "sensor-field-enabled");
    if (!label) return null;
    const textNode = [...label.childNodes].find((node) => node.nodeType === 3 && String(node.textContent || "").trim());
    if (textNode && textNode.textContent !== " Sensor enabled") textNode.textContent = " Sensor enabled";
    const small = label.querySelector("small");
    const section = driver().sectionForStation(item.station);
    const message = `Orient for the ${driver().sectionLabel(section).toLowerCase()} label view.`;
    if (small && small.textContent !== message) small.textContent = message;
    return label;
  }

  function updateInheritedField(row, item) {
    const grid = row.querySelector(".builder-row-grid");
    if (!grid) return null;
    const section = driver().sectionForStation(item.station);
    const expectedValue = `${driver().sectionLabel(section)} label`;
    const expectedHelp = driver().stationPairLabel(section);
    let field = grid.querySelector(".sensor-inherited-label-field");
    if (!field) {
      field = inheritedLabelField(item);
      grid.appendChild(field);
      return field;
    }
    const value = field.querySelector(".sensor-inherited-label-value");
    const help = field.querySelector("small");
    if (value && value.textContent !== expectedValue) value.textContent = expectedValue;
    if (help && help.textContent !== expectedHelp) help.textContent = expectedHelp;
    return field;
  }

  function compactSensorGrid(row, item) {
    const grid = row.querySelector(".builder-row-grid");
    if (!grid) return;
    row.classList.add("sensor-station-inherited-row");

    const enabled = relabelSensorEnabled(row, item);
    const station = labelForControl(row, '[data-builder-field="station"]', "sensor-field-station");
    const placement = labelForControl(row, '[data-builder-field="angle"]', "sensor-field-placement");
    const inherited = updateInheritedField(row, item);
    const required = labelForControl(row, '[data-builder-field="requiredVisibilityPercent"]', "sensor-field-required");
    const status = row.querySelector(".sensor-inline-status");

    if (required) {
      const small = required.querySelector("small");
      if (small) small.textContent = "1% edge view • 100% centered.";
    }
    if (status) status.classList.add("sensor-grid-field", "sensor-field-status");

    [enabled, station, placement, inherited, required, status]
      .filter(Boolean)
      .forEach((node) => grid.appendChild(node));
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
      compactSensorGrid(row, item);

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
    wrapFunction("loadSavedSettings", "sensorStationLabelInheritanceV10", () => normalizeRuntime());
    wrapFunction("loadMachineMapIntoRuntime", "sensorStationLabelInheritanceV10", ([map]) => normalizeMap(map));
    wrapFunction("refreshAfterBuilderEdit", "sensorStationLabelInheritanceV10", () => normalizeMap(editableMap()));
    wrapFunction("renderWipeDownBuilder", "sensorStationLabelInheritanceV10", () => {
      normalizeMap(editableMap());
      decorateSensorRows();
    });

    const service = global.LabelerCompanyDefaultsService;
    if (service?.reconcile && !service.sensorStationLabelInheritanceV10) {
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
        sensorStationLabelInheritanceV10: true
      });
    }
  }

  function installStyles() {
    const existing = document.querySelector("#sensorStationLabelInheritanceStyles");
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = "sensorStationLabelInheritanceStyles";
    style.textContent = `
      .sensor-station-inherited-row .builder-object-editor{padding-bottom:8px}
      .sensor-station-inherited-row .builder-row-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        align-items:stretch;
      }
      .sensor-station-inherited-row .builder-row-grid>.sensor-grid-field{min-width:0;margin:0}
      .sensor-station-inherited-row .sensor-grid-field{
        min-height:64px;
        padding:7px 8px;
        border:1px solid var(--line);
        border-radius:6px;
        background:color-mix(in srgb,var(--panel-hi) 78%,var(--input));
      }
      .sensor-station-inherited-row label.sensor-grid-field{display:flex;flex-direction:column;gap:4px}
      .sensor-station-inherited-row label.sensor-grid-field input:not([type="checkbox"]),
      .sensor-station-inherited-row label.sensor-grid-field select{height:31px;min-height:31px}
      .sensor-station-inherited-row .sensor-field-enabled{justify-content:center}
      .sensor-station-inherited-row .sensor-field-enabled small,
      .sensor-station-inherited-row .sensor-field-required small,
      .sensor-inherited-label-field small{font-size:9px;line-height:1.15;color:var(--muted)}
      .sensor-inherited-label-field{display:flex;flex-direction:column;justify-content:center;gap:3px}
      .sensor-field-caption{font-size:10px;font-weight:700;color:var(--muted)}
      .sensor-inherited-label-value{font-size:14px;line-height:1.1;color:var(--ink)}
      .sensor-station-inherited-row .sensor-inline-status{
        display:flex;
        flex-direction:column;
        justify-content:center;
        align-items:flex-start;
        gap:3px;
      }
      .sensor-station-inherited-row .sensor-inline-status strong{font-size:14px;line-height:1.1}
      .sensor-station-inherited-row .sensor-inline-status span{font-size:10px;line-height:1.2}
      .sensor-station-inherited-row .builder-object-actions{margin-top:8px}
      @media (max-width:1500px){
        .sensor-station-inherited-row .builder-row-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
      @media (max-width:700px){
        .sensor-station-inherited-row .builder-row-grid{grid-template-columns:1fr}
      }
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
