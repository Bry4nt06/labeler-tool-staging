(function installColdGlueSlotTopologyGuard(global) {
  "use strict";

  const VERSION = "servoforge.cold-glue-slot-topology-guard.v315";

  function activeColdGlueMap() {
    try {
      const map = typeof global.activeMachineMap === "function" ? global.activeMachineMap() : null;
      return map?.applicationMode === "cold-glue" ? map : null;
    } catch {
      return null;
    }
  }

  function normalizeSlots(value, fallbackCount) {
    if (typeof global.normalizeEnabledSlots === "function") {
      return global.normalizeEnabledSlots(value, fallbackCount);
    }
    const source = Array.isArray(value) ? value : [];
    const fallback = Math.max(1, Math.min(6, Math.round(Number(fallbackCount) || 1)));
    const slots = Array.from({ length: 6 }, (_, index) => source.length ? Boolean(source[index]) : index < fallback);
    if (!slots.some(Boolean)) slots[0] = true;
    return slots;
  }

  function snapshot(map) {
    if (!map) return null;
    const enabledAggregates = normalizeSlots(map.enabledAggregates, map.aggregateCount);
    const enabledStations = normalizeSlots(map.enabledStations, map.stationCount);
    return {
      enabledAggregates: [...enabledAggregates],
      enabledStations: [...enabledStations],
      aggregateCount: enabledAggregates.filter(Boolean).length,
      stationCount: enabledStations.filter(Boolean).length,
      localStructuralMapOverride: Boolean(map.localStructuralMapOverride)
    };
  }

  function restore(map, topology) {
    if (!map || !topology) return;
    map.enabledAggregates = [...topology.enabledAggregates];
    map.enabledStations = [...topology.enabledStations];
    map.aggregateCount = topology.aggregateCount;
    map.stationCount = topology.stationCount;
    if (topology.localStructuralMapOverride) map.localStructuralMapOverride = true;

    const service = global.LabelerMapBuilderSlotService;
    if (typeof service?.mirrorColdGlueTopology === "function") {
      service.mirrorColdGlueTopology(map);
      return;
    }

    if (!global.state) return;
    const existing = global.state.coldGlueAggregateSettings
      && typeof global.state.coldGlueAggregateSettings === "object"
      ? global.state.coldGlueAggregateSettings
      : {};
    global.state.coldGlueAggregateSettings = {
      ...existing,
      enabledAggregates: [...topology.enabledAggregates],
      enabledStations: [...topology.enabledStations]
    };
  }

  function install() {
    const original = global.generatedColdGlueFixedProfile;
    if (typeof original !== "function") return false;
    if (original.coldGlueSlotTopologyGuardV315) return true;

    function generatedColdGlueWithExplicitTopology(...args) {
      const map = activeColdGlueMap();
      const topology = snapshot(map);
      // Keep the operator-selected topology visible to the map-driven generator
      // even when an older gripper normalizer tries to infer enabled slots from
      // the objects currently present on those stations.
      if (map && topology) restore(map, topology);
      try {
        return original.apply(this, args);
      } finally {
        restore(map, topology);
      }
    }

    generatedColdGlueWithExplicitTopology.coldGlueSlotTopologyGuardV315 = true;
    generatedColdGlueWithExplicitTopology.originalGenerator = original;
    global.generatedColdGlueFixedProfile = generatedColdGlueWithExplicitTopology;
    try { generatedColdGlueFixedProfile = generatedColdGlueWithExplicitTopology; } catch { }

    global.ServoForgeColdGlueSlotTopologyGuard = Object.freeze({
      installed: true,
      version: VERSION,
      snapshot,
      restore
    });
    return true;
  }

  if (!install()) {
    const timer = global.setInterval(() => {
      if (!install()) return;
      global.clearInterval(timer);
    }, 25);
  }
})(window);
