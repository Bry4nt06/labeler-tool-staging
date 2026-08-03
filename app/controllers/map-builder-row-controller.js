"use strict";

(function installMapBuilderRowController(global) {
  if (global.LabelerMapBuilderRowController?.installed) return;

  const booleanFields = new Set([
    "servoAssist",
    "holdBottleAngle",
    "holdCurrentBottleAngle"
  ]);
  const textFields = new Set(["name", "side", "role"]);
  const rerenderFields = new Set([
    "station",
    "holdBottleAngle",
    "holdCurrentBottleAngle"
  ]);

  function builderContains(node) {
    return Boolean(typeof els !== "undefined" && els.wipeBuilderList?.contains(node));
  }

  function rowContext(target) {
    const row = target?.closest?.(".wipe-builder-row[data-builder-object-id]");
    if (!row || !builderContains(row)) return null;
    return { row, objectId: String(row.dataset.builderObjectId || "") };
  }

  function editableObject(objectId) {
    const editable = typeof editableMachineMap === "function" ? editableMachineMap() : null;
    if (!editable || !Array.isArray(editable.objects)) return null;
    const index = editable.objects.findIndex((entry) => String(entry?.id) === String(objectId));
    if (index < 0) return null;
    const item = normalizeBuilderObject(editable.objects[index], editable.applicationMode, editable.stationCount);
    return { editable, index, item };
  }

  function consume(event, preventDefault = false) {
    if (preventDefault) event.preventDefault();
    event.stopImmediatePropagation();
  }

  function recordFieldHistory(target) {
    const context = rowContext(target);
    if (!context || !target.dataset?.builderField) return false;
    if (target.dataset.builderHistoryRecorded === "true") return true;
    const resolved = editableObject(context.objectId);
    if (!resolved) return false;
    recordBuilderHistory(`Edit ${resolved.item.name}`);
    target.dataset.builderHistoryRecorded = "true";
    return true;
  }

  function updateField(target, persist = false) {
    const context = rowContext(target);
    const field = target.dataset?.builderField;
    if (!context || !field) return false;

    const booleanField = booleanFields.has(field);
    const numericField = !booleanField && !textFields.has(field);
    if (numericField && ["", "-", ".", "-."].includes(String(target.value))) return true;

    const resolved = editableObject(context.objectId);
    if (!resolved) return false;
    const { editable, index, item } = resolved;
    item[field] = booleanField
      ? Boolean(target.checked)
      : numericField
        ? num(target.value, item[field])
        : target.value;
    if (field === "angle") item.start = item.end = item.angle;
    editable.objects[index] = normalizeBuilderObject(item, editable.applicationMode, editable.stationCount);

    if (field === "name") {
      const summaryName = context.row.querySelector("summary strong");
      if (summaryName) summaryName.textContent = editable.objects[index].name;
    }

    refreshAfterBuilderEdit({ persist: true });
    if (persist && rerenderFields.has(field)) renderWipeDownBuilder();
    return true;
  }

  function updateStationSection(target) {
    const context = rowContext(target);
    if (!context || !target.matches?.("[data-station-section]")) return false;
    const resolved = editableObject(context.objectId);
    if (!resolved) return false;
    const { editable, item } = resolved;
    editable.stationSections = editable.stationSections && typeof editable.stationSections === "object"
      ? editable.stationSections
      : {};
    const key = String(item.station);
    if (target.value === "auto") delete editable.stationSections[key];
    else editable.stationSections[key] = target.value;
    refreshAfterBuilderEdit({ persist: true });
    renderWipeDownBuilder();
    return true;
  }

  function selectObject(objectId) {
    if (!objectId) return false;
    state.selectedMapObjectId = objectId;
    global.requestAnimationFrame(renderMap);
    return true;
  }

  function removeObject(objectId) {
    const resolved = editableObject(objectId);
    if (!resolved) return false;
    recordBuilderHistory(`Remove ${resolved.item.name}`);
    resolved.editable.objects.splice(resolved.index, 1);
    refreshAfterBuilderEdit({ persist: true });
    renderWipeDownBuilder();
    return true;
  }

  function duplicateObject(objectId) {
    const resolved = editableObject(objectId);
    if (!resolved) return false;
    const { editable, item } = resolved;
    recordBuilderHistory(`Duplicate ${item.name}`);
    editable.objects.push(normalizeBuilderObject({
      ...deepClone(item),
      id: uniqueMapId(editable.applicationMode),
      name: `${item.name} Copy`
    }, editable.applicationMode, editable.stationCount));
    builderExpandedStation = String(item.kind === "coding" ? "coding" : item.station);
    refreshAfterBuilderEdit({ persist: true });
    renderWipeDownBuilder();
    return true;
  }

  function duplicateStation(sourceStation) {
    const station = Math.round(num(sourceStation, NaN));
    const editable = typeof editableMachineMap === "function" ? editableMachineMap() : null;
    if (!editable || !Number.isFinite(station)) return false;

    const targetRaw = global.prompt(`Duplicate Station ${station} to which station number?`, "");
    const targetStation = Math.round(num(targetRaw, NaN));
    if (!Number.isFinite(targetStation)
      || !activeSlotNumbers(editable.enabledStations).includes(targetStation)
      || targetStation === station) return false;

    const entries = editable.objects.filter((raw) => (
      itemApplicationMode(raw) === state.applicationMode
      && raw.kind !== "coding"
      && Number(raw.station) === station
    ));
    if (!entries.length) return false;

    recordBuilderHistory(`Duplicate Station ${station}`);
    const sourceAngle = num(editable.aggregateAngles?.[String(station)], 0);
    const targetAngle = num(editable.aggregateAngles?.[String(targetStation)], sourceAngle);
    const offset = targetAngle - sourceAngle;
    entries.forEach((raw) => {
      const copy = normalizeBuilderObject({
        ...deepClone(raw),
        id: uniqueMapId(editable.applicationMode),
        name: `${raw.name} - Station ${targetStation}`,
        station: targetStation
      }, editable.applicationMode, editable.stationCount);
      if (Number.isFinite(Number(copy.angle))) copy.angle += offset;
      copy.start += offset;
      copy.end += offset;
      editable.objects.push(copy);
    });
    refreshAfterBuilderEdit({ persist: true });
    builderExpandedStation = String(targetStation);
    renderWipeDownBuilder();
    return true;
  }

  document.addEventListener("focus", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !recordFieldHistory(target)) return;
    consume(event);
  }, true);

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !updateField(target, false)) return;
    consume(event);
  }, true);

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (updateStationSection(target) || updateField(target, true)) consume(event);
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const removeButton = target.closest(".builder-remove");
    if (removeButton) {
      const context = rowContext(removeButton);
      if (context && removeObject(context.objectId)) consume(event, true);
      return;
    }

    const duplicateButton = target.closest(".builder-duplicate");
    if (duplicateButton) {
      const context = rowContext(duplicateButton);
      if (context && duplicateObject(context.objectId)) consume(event, true);
      return;
    }

    const duplicateStationButton = target.closest(".builder-duplicate-station");
    if (duplicateStationButton && builderContains(duplicateStationButton)) {
      const group = duplicateStationButton.closest(".configured-station-group[data-station-group]");
      if (group && duplicateStation(group.dataset.stationGroup)) consume(event, true);
      return;
    }

    const summary = target.closest("summary");
    const context = summary ? rowContext(summary) : null;
    if (context && selectObject(context.objectId)) consume(event);
  }, true);

  global.LabelerMapBuilderRowController = Object.freeze({
    installed: true,
    rowContext,
    recordFieldHistory,
    updateField,
    updateStationSection,
    selectObject,
    removeObject,
    duplicateObject,
    duplicateStation
  });
})(window);
