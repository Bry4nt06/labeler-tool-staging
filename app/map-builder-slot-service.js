"use strict";

(function installMapBuilderSlotService(global) {
  if (global.LabelerMapBuilderSlotService?.installed) return;

  let mutationActive = false;

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

  function normalizedSlots(machineMap, configuration) {
    return global.normalizeEnabledSlots(
      machineMap[configuration.enabledKey],
      machineMap[configuration.countKey]
    );
  }

  function mirrorColdGlueTopology(machineMap) {
    if (machineMap?.applicationMode !== "cold-glue" || !global.state) return;
    const existing = global.state.coldGlueAggregateSettings
      && typeof global.state.coldGlueAggregateSettings === "object"
      ? global.state.coldGlueAggregateSettings
      : {};
    const enabledAggregates = global.normalizeEnabledSlots(
      machineMap.enabledAggregates,
      machineMap.aggregateCount
    );
    const enabledStations = global.normalizeEnabledSlots(
      machineMap.enabledStations,
      machineMap.stationCount
    );
    global.state.coldGlueAggregateSettings = {
      ...existing,
      machineSettings: { ...(machineMap.machineSettings || existing.machineSettings || {}) },
      aggregateAngles: { ...(machineMap.aggregateAngles || existing.aggregateAngles || {}) },
      stationAngles: { ...(machineMap.stationAngles || existing.stationAngles || {}) },
      enabledAggregates: [...enabledAggregates],
      enabledStations: [...enabledStations]
    };
  }

  function setEnabled(kind, slotNumber, enabled) {
    const configuration = slotConfiguration(String(kind || ""));
    const slot = Math.round(Number(slotNumber));
    const machineMap = global.editableMachineMap?.();
    if (!configuration || !machineMap || slot < 1 || slot > 6) return false;

    const slots = normalizedSlots(machineMap, configuration);
    const nextEnabled = Boolean(enabled);
    const index = slot - 1;

    if (slots[index] === nextEnabled) return true;

    // Every machine map must retain at least one aggregate and one station.
    if (!nextEnabled && slots[index] && slots.filter(Boolean).length <= 1) {
      setStatus(`At least one ${configuration.label.toLowerCase()} must remain active.`);
      global.renderWipeDownBuilder?.();
      return false;
    }

    // A structural rerender can touch the same checkbox path while this change
    // is still being committed. Treat that as the same transaction instead of
    // entering the slot mutation stack again.
    if (mutationActive) return false;
    mutationActive = true;

    try {
      global.recordBuilderHistory?.(`${nextEnabled ? "Enable" : "Disable"} ${configuration.label} ${slot}`);
      slots[index] = nextEnabled;
      machineMap[configuration.enabledKey] = slots;
      machineMap[configuration.countKey] = slots.filter(Boolean).length;
      machineMap.localStructuralMapOverride = true;

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

      // Topology is the only runtime datum changed by this control. Do not run a
      // complete loadMachineMapIntoRuntime() and then immediately run the full
      // structural refresh again. Mirroring the Cold Glue topology here gives
      // the profile generator the new slots while keeping this one transaction.
      mirrorColdGlueTopology(machineMap);
      global.refreshAfterBuilderEdit?.({ persist: true, structural: true });

      // A legacy Cold Glue normalizer may inspect map objects while the profile
      // is being regenerated. Re-assert the explicit operator-selected topology
      // after generation so it cannot silently collapse sparse 1/3/5 layouts.
      machineMap[configuration.enabledKey] = slots;
      machineMap[configuration.countKey] = slots.filter(Boolean).length;
      mirrorColdGlueTopology(machineMap);

      global.renderWipeDownBuilder?.();
      setStatus(`${configuration.label} ${slot} ${nextEnabled ? "enabled" : "disabled"}.`);
      return true;
    } finally {
      mutationActive = false;
    }
  }

  global.LabelerMapBuilderSlotService = Object.freeze({
    installed: true,
    version: 2,
    setEnabled,
    mirrorColdGlueTopology,
    machineSlotAuthorityV135: true,
    sparseSlotTransactionGuardV315: true
  });
})(typeof window !== "undefined" ? window : globalThis);
