"use strict";

(function installMapBuilderSlotService(global) {
  if (global.LabelerMapBuilderSlotService?.installed) return;

  function slotConfiguration(kind) {
    if (kind === "aggregate") {
      return {
        enabledKey: "enabledAggregates",
        countKey: "aggregateCount",
        label: "Aggregate"
      };
    }
    if (kind === "station") {
      return {
        enabledKey: "enabledStations",
        countKey: "stationCount",
        label: "Station"
      };
    }
    return null;
  }

  function setStatus(message) {
    const status = global.document?.querySelector?.("#builderStatus");
    if (!status) return;
    status.textContent = message;
    status.classList?.remove?.("status-bad");
  }

  function setEnabled(kind, slotNumber, enabled) {
    const configuration = slotConfiguration(String(kind || ""));
    const slot = Math.round(Number(slotNumber));
    const machineMap = global.editableMachineMap?.();
    if (!configuration || !machineMap || slot < 1 || slot > 6) return false;

    const slots = global.normalizeEnabledSlots(
      machineMap[configuration.enabledKey],
      machineMap[configuration.countKey]
    );
    const nextEnabled = Boolean(enabled);
    const index = slot - 1;

    if (slots[index] === nextEnabled) return true;

    // Every machine map must retain at least one aggregate and one station.
    // If the user tries to remove the final active slot, restore the checkbox
    // through the normal Map Builder rerender instead of allowing an invalid map.
    if (!nextEnabled && slots[index] && slots.filter(Boolean).length <= 1) {
      setStatus(`At least one ${configuration.label.toLowerCase()} must remain active.`);
      global.renderWipeDownBuilder?.();
      return false;
    }

    global.recordBuilderHistory?.(`${nextEnabled ? "Enable" : "Disable"} ${configuration.label} ${slot}`);
    slots[index] = nextEnabled;
    machineMap[configuration.enabledKey] = slots;
    machineMap[configuration.countKey] = slots.filter(Boolean).length;

    if (kind === "aggregate") {
      machineMap.aggregateAngles = global.normalizeAggregateAngles?.(
        machineMap.aggregateAngles,
        machineMap.applicationMode,
        machineMap.objects || []
      ) || machineMap.aggregateAngles;
      machineMap.spenderPlateAngles = global.normalizeSpenderPlateAngles?.(
        machineMap.spenderPlateAngles
      ) || machineMap.spenderPlateAngles;
    }

    if (kind === "station" && nextEnabled && machineMap.applicationMode === "apl") {
      global.ensureAplObjectsForNewStations?.(machineMap);
    }

    // Reload the edited map into runtime before regeneration so Cold Glue's
    // aggregate settings mirror and all downstream planners see the new slot
    // immediately, not on the next page load.
    global.loadMachineMapIntoRuntime?.(machineMap, false);
    global.refreshAfterBuilderEdit?.({ persist: true, structural: true });
    global.renderWipeDownBuilder?.();
    setStatus(`${configuration.label} ${slot} ${nextEnabled ? "enabled" : "disabled"}.`);
    return true;
  }

  global.LabelerMapBuilderSlotService = Object.freeze({
    installed: true,
    version: 1,
    setEnabled,
    machineSlotAuthorityV135: true
  });
})(typeof window !== "undefined" ? window : globalThis);
