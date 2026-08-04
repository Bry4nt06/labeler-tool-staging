"use strict";

(function installSensorActivationController(global) {
  if (global.LabelerSensorActivationController?.installed) return;

  const VALID_SECTIONS = new Set(["neck", "body", "back"]);
  const STYLE_ID = "servoforgeSensorActivationStyles";
  let renderBuilderWrapped = false;
  let renderMapWrapped = false;
  let validationWrapped = false;
  let profileWrapped = false;
  let driverPatched = false;

  function machineMap(source = null) {
    if (source) return source;
    try { return typeof activeMachineMap === "function" ? activeMachineMap() : null; }
    catch { return null; }
  }

  function applications() {
    try {
      if (typeof selectedLabelApplicationState === "function") {
        const result = selectedLabelApplicationState();
        return {
          neck: Boolean(result?.neck),
          body: Boolean(result?.body),
          back: Boolean(result?.back)
        };
      }
    } catch { }
    return { neck: true, body: true, back: true };
  }

  function sectionForSensor(sensor, sourceMap = null) {
    if (sensor?.kind !== "sensor") return "none";
    const explicit = String(
      sensor.orientationLabelSection
      || sensor.labelSection
      || "auto"
    ).trim().toLowerCase();
    if (VALID_SECTIONS.has(explicit)) return explicit;
    const map = machineMap(sourceMap);
    const station = Number(sensor.station);
    try {
      const inferred = typeof inferAplStationSections === "function"
        ? inferAplStationSections(map)?.[String(station)]
        : map?.stationSections?.[String(station)];
      if (VALID_SECTIONS.has(inferred)) return inferred;
    } catch { }
    try {
      const fallback = typeof labelSectionForStation === "function"
        ? labelSectionForStation(station)
        : "none";
      if (VALID_SECTIONS.has(fallback)) return fallback;
    } catch { }
    return "none";
  }

  function status(sensor, sourceMap = null) {
    const section = sectionForSensor(sensor, sourceMap);
    const manualEnabled = sensor?.enabled !== false;
    const active = applications();
    const labelPresent = !VALID_SECTIONS.has(section) || Boolean(active[section]);
    const autoDisabled = manualEnabled && VALID_SECTIONS.has(section) && !labelPresent;
    return {
      section,
      manualEnabled,
      labelPresent,
      autoDisabled,
      enabled: manualEnabled && labelPresent,
      reason: !manualEnabled
        ? "Disabled in Map Builder"
        : autoDisabled
          ? `Automatically disabled because the selected Brand has no ${section} label.`
          : "Active"
    };
  }

  function isEnabled(sensor, sourceMap = null) {
    return Boolean(status(sensor, sourceMap).enabled);
  }

  function findSensor(objectId, sourceMap = null) {
    const map = machineMap(sourceMap);
    return map?.objects?.find((item) => item?.kind === "sensor" && String(item.id) === String(objectId)) || null;
  }

  function disabledSensorIds(sourceMap = null) {
    const map = machineMap(sourceMap);
    return new Set((map?.objects || [])
      .filter((item) => item?.kind === "sensor" && !isEnabled(item, map))
      .map((item) => String(item.id)));
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .sensor-activation-control {
        grid-column: 1 / -1;
        display: grid;
        gap: 4px;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: color-mix(in srgb, var(--input) 88%, transparent);
      }
      .sensor-activation-control > span {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
      }
      .sensor-activation-control small { line-height: 1.35; }
      .wipe-builder-row.sensor-object-disabled {
        opacity: .76;
        border-color: color-mix(in srgb, var(--health-info, #59aee9) 58%, var(--line)) !important;
      }
      .wipe-builder-row.sensor-object-disabled .sensor-inline-status {
        border-left-color: var(--health-info, #59aee9) !important;
        background: var(--health-info-bg, rgba(58,139,201,.13)) !important;
      }
      #mapSvg [data-map-object-id][data-sensor-disabled="true"] {
        opacity: .48;
        filter: saturate(.45);
      }
    `;
    document.head.appendChild(style);
  }

  function decorateSensorRow(row, sensor, sourceMap) {
    const grid = row.querySelector(".builder-row-grid");
    if (!grid) return;
    const current = status(sensor, sourceMap);
    let control = grid.querySelector(".sensor-activation-control");
    if (!control) {
      control = document.createElement("label");
      control.className = "sensor-activation-control";
      control.innerHTML = `<span><input type="checkbox" data-sensor-enabled> Sensor enabled</span><small data-sensor-enabled-note></small>`;
      grid.prepend(control);
    }
    const checkbox = control.querySelector("[data-sensor-enabled]");
    const note = control.querySelector("[data-sensor-enabled-note]");
    checkbox.checked = current.manualEnabled;
    checkbox.indeterminate = current.autoDisabled;
    checkbox.dataset.sensorObjectId = String(sensor.id);
    note.textContent = current.reason;
    row.classList.toggle("sensor-object-disabled", !current.enabled);
    row.dataset.sensorEffectiveEnabled = String(current.enabled);

    const inlineStatus = row.querySelector(".sensor-inline-status");
    if (inlineStatus && !current.enabled) {
      inlineStatus.classList.remove("sensor-status-pass", "sensor-status-fail");
      inlineStatus.dataset.health = "info";
      const strong = inlineStatus.querySelector("strong");
      const span = inlineStatus.querySelector("span");
      if (strong) strong.textContent = "Sensor disabled";
      if (span) span.textContent = current.reason;
    }
  }

  function decorateBuilder() {
    const map = machineMap();
    if (!map) return;
    document.querySelectorAll("#wipeBuilderList .wipe-builder-row[data-builder-object-id]").forEach((row) => {
      const sensor = findSensor(row.dataset.builderObjectId, map);
      if (sensor) decorateSensorRow(row, sensor, map);
    });
  }

  function decorateMap() {
    const map = machineMap();
    if (!map) return;
    document.querySelectorAll("#mapSvg [data-map-object-id]").forEach((node) => {
      const sensor = findSensor(node.dataset.mapObjectId, map);
      if (!sensor) return;
      const current = status(sensor, map);
      node.dataset.sensorDisabled = String(!current.enabled);
      node.setAttribute("aria-label", `${sensor.name || "Label Sensor"}: ${current.reason}`);
    });
  }

  function updateSensor(objectId, enabled) {
    const map = machineMap();
    const sensor = findSensor(objectId, map);
    if (!sensor) return false;
    if (typeof recordBuilderHistory === "function") recordBuilderHistory(`${enabled ? "Enable" : "Disable"} ${sensor.name || "Label Sensor"}`);
    sensor.enabled = Boolean(enabled);
    if (typeof refreshAfterBuilderEdit === "function") refreshAfterBuilderEdit({ persist: true });
    else {
      if (typeof applyGeneratedServoProfile === "function") applyGeneratedServoProfile();
      if (typeof saveCurrentSettings === "function") saveCurrentSettings();
      if (typeof render === "function") render();
    }
    if (typeof renderWipeDownBuilder === "function") renderWipeDownBuilder();
    return true;
  }

  function filterDisabledSensorNotes(notes) {
    const disabled = disabledSensorIds();
    if (!disabled.size) return Array.isArray(notes) ? notes : [];
    return (Array.isArray(notes) ? notes : []).filter((note) => {
      const objectId = note?.[2]?.objectId || note?.metadata?.objectId || note?.objectId;
      if (objectId && disabled.has(String(objectId))) return false;
      return true;
    });
  }

  function updateValidationResult(notes) {
    if (typeof state === "undefined") return;
    const summary = { bad: 0, warn: 0, info: 0, ok: 0, total: 0 };
    notes.forEach((note) => {
      const level = ["bad", "warn", "info", "ok"].includes(note?.[0]) ? note[0] : "warn";
      summary[level] += 1;
      summary.total += 1;
    });
    state.validationResult = {
      ...(state.validationResult || {}),
      valid: summary.bad === 0,
      status: summary.bad ? "FAIL" : summary.warn ? "REVIEW" : "PASS",
      summary,
      sourceCount: summary.total,
      issues: notes.map((note) => ({ level: note[0], message: note[1], metadata: note[2] || {} }))
    };
  }

  function pruneMotionIssues() {
    const disabled = disabledSensorIds();
    if (!disabled.size || !Array.isArray(state?.motionPlan?.issues)) return;
    state.motionPlan.issues = state.motionPlan.issues.filter((issue) => {
      const objectId = issue?.objectId || issue?.metadata?.objectId;
      return !objectId || !disabled.has(String(objectId));
    });
  }

  function patchOrientationDriver() {
    if (driverPatched) return true;
    const base = global.LabelerDriverRegistry?.resolve?.("profile.mapObjectOrientation")
      || global.LabelerMapObjectOrientationDriver;
    if (!base) return false;
    const patched = Object.freeze({
      ...base,
      enabled(item) {
        if (item?.kind === "sensor") {
          return isEnabled(item) && Boolean(item.orientBottle ?? item.servoAssist);
        }
        return base.enabled(item);
      }
    });
    global.LabelerMapObjectOrientationDriver = patched;
    global.LabelerDriverRegistry?.register?.("profile.mapObjectOrientation", patched, {
      dependencies: ["profile.coderOrientation"],
      source: "app/controllers/sensor-activation-controller.js",
      replace: true
    });
    driverPatched = true;
    return true;
  }

  function patchProfileGeneration() {
    if (profileWrapped || typeof global.generatedAplMapDrivenProfile !== "function") return profileWrapped;
    const base = global.generatedAplMapDrivenProfile;
    global.generatedAplMapDrivenProfile = function generatedAplMapDrivenProfileWithSensorActivation(map, ...args) {
      const changed = [];
      (map?.objects || []).forEach((item) => {
        if (item?.kind !== "sensor" || isEnabled(item, map) || !item.servoAssist) return;
        changed.push([item, item.servoAssist]);
        item.servoAssist = false;
      });
      try {
        return base.call(this, map, ...args);
      } finally {
        changed.forEach(([item, servoAssist]) => { item.servoAssist = servoAssist; });
      }
    };
    profileWrapped = true;
    return true;
  }

  function patchValidation() {
    if (validationWrapped || typeof global.validate !== "function") return validationWrapped;
    const base = global.validate;
    global.validate = function validateWithSensorActivation(...args) {
      pruneMotionIssues();
      const notes = filterDisabledSensorNotes(base.apply(this, args));
      updateValidationResult(notes);
      return notes;
    };
    validationWrapped = true;
    return true;
  }

  function patchRenderers() {
    if (!renderBuilderWrapped && typeof global.renderWipeDownBuilder === "function") {
      const base = global.renderWipeDownBuilder;
      global.renderWipeDownBuilder = function renderWipeDownBuilderWithSensorActivation(...args) {
        const result = base.apply(this, args);
        decorateBuilder();
        return result;
      };
      renderBuilderWrapped = true;
    }
    if (!renderMapWrapped && typeof global.renderMap === "function") {
      const base = global.renderMap;
      global.renderMap = function renderMapWithSensorActivation(...args) {
        const result = base.apply(this, args);
        decorateMap();
        return result;
      };
      renderMapWrapped = true;
    }
    return renderBuilderWrapped && renderMapWrapped;
  }

  function install() {
    installStyles();
    const complete = patchOrientationDriver()
      && patchProfileGeneration()
      && patchValidation()
      && patchRenderers();
    if (complete) {
      decorateBuilder();
      decorateMap();
    }
    return complete;
  }

  document.addEventListener("change", (event) => {
    const input = event.target?.closest?.("[data-sensor-enabled]");
    if (!input) return;
    event.stopImmediatePropagation();
    updateSensor(input.dataset.sensorObjectId, input.checked);
  }, true);

  const retry = () => {
    if (!install()) global.setTimeout(retry, 50);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();

  global.LabelerSensorActivationController = Object.freeze({
    installed: true,
    sectionForSensor,
    status,
    isEnabled,
    disabledSensorIds,
    filterDisabledSensorNotes,
    updateSensor,
    refresh() {
      decorateBuilder();
      decorateMap();
    }
  });
})(window);
