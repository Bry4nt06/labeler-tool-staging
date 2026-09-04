"use strict";

(function installServoForgeTroubleshootingStartupGuard(global) {
  const SETTINGS_KEY = "labelerToolSettings";
  const CONTEXT_KEY = "servoforge-troubleshooting-context-v1";
  const WATCHDOG_MS = 4000;
  const marker = {
    version: "troubleshooting-startup-v356",
    compactContextActive: false,
    runtimeValidationActive: false,
    contextRefreshScheduled: false
  };

  function safeJson(raw, fallback = null) {
    try { return JSON.parse(raw); }
    catch { return fallback; }
  }

  function compactSettings(context = {}) {
    const activeMapId = context.mapName || context.machineType || context.applicationMode ? "troubleshooting-context-snapshot" : "";
    const activeMap = activeMapId ? [{
      id: activeMapId,
      name: context.mapName || "",
      site: context.site || "",
      zone: context.zone || "",
      machineType: context.machineType || "",
      applicationMode: context.applicationMode || ""
    }] : [];
    return {
      selectedZone: context.zone || "",
      selectedSite: context.site || "",
      selectedBrand: context.brand || "",
      selectedBottle: context.bottle || "",
      applicationMode: context.applicationMode || "",
      activeMapId,
      mapLibrary: activeMap
    };
  }

  function extractContext(saved) {
    const safe = saved && typeof saved === "object" ? saved : {};
    const mapLibrary = Array.isArray(safe.mapLibrary) ? safe.mapLibrary : [];
    const activeMap = mapLibrary.find((map) => map?.id === safe.activeMapId) || null;
    return {
      zone: safe.selectedZone || activeMap?.zone || "",
      site: safe.selectedSite || activeMap?.site || "",
      mapName: activeMap?.name || "",
      machineType: activeMap?.machineType || safe.machineType || "",
      applicationMode: activeMap?.applicationMode || safe.applicationMode || "",
      brand: safe.selectedBrand || "",
      bottle: safe.selectedBottle || ""
    };
  }

  const storage = (() => {
    try { return global.localStorage; }
    catch { return null; }
  })();
  const storagePrototype = global.Storage?.prototype || null;
  const originalGetItem = storagePrototype?.getItem || null;
  const originalSetItem = storagePrototype?.setItem || null;

  if (storage && storagePrototype && typeof originalGetItem === "function") {
    const cachedContext = safeJson(originalGetItem.call(storage, CONTEXT_KEY), null);
    const compactRaw = JSON.stringify(compactSettings(cachedContext || {}));
    storagePrototype.getItem = function guardedTroubleshootingStorageRead(key) {
      if (this === storage && key === SETTINGS_KEY) return compactRaw;
      return originalGetItem.call(this, key);
    };
    marker.compactContextActive = true;
  }

  const baseLibrary = global.ServoForgeTroubleshootingLibrary;
  if (baseLibrary) {
    const fullValidate = typeof baseLibrary.validate === "function" ? baseLibrary.validate.bind(baseLibrary) : null;
    function runtimeValidate() {
      const errors = [];
      if (!Array.isArray(baseLibrary.entries) || !baseLibrary.entries.length) errors.push("Diagnostic entries are unavailable.");
      if (!Array.isArray(baseLibrary.flows)) errors.push("Guided diagnostic flows are unavailable.");
      if (!Array.isArray(baseLibrary.sources) || !baseLibrary.sources.length) errors.push("Diagnostic references are unavailable.");
      ["getEntry", "getFlow", "getSource", "searchEntries", "searchSources", "normalize"].forEach((name) => {
        if (typeof baseLibrary[name] !== "function") errors.push(`Runtime API missing: ${name}.`);
      });
      return { ok: errors.length === 0, errors };
    }
    global.ServoForgeTroubleshootingLibrary = Object.freeze({
      ...baseLibrary,
      validate: runtimeValidate,
      fullValidate,
      runtimeValidationMode: "startup-smoke-v356"
    });
    marker.runtimeValidationActive = true;
  }

  function scheduleContextRefresh() {
    if (!storage || !originalGetItem || !originalSetItem || typeof global.Worker !== "function") return;
    const run = () => {
      let raw = null;
      try { raw = originalGetItem.call(storage, SETTINGS_KEY); }
      catch { raw = null; }
      if (!raw) return;

      const workerSource = `self.onmessage = function(event) {
        try {
          const saved = JSON.parse(event.data);
          const mapLibrary = Array.isArray(saved && saved.mapLibrary) ? saved.mapLibrary : [];
          const activeMap = mapLibrary.find(function(map) { return map && map.id === saved.activeMapId; }) || null;
          self.postMessage({ ok: true, context: {
            zone: saved.selectedZone || (activeMap && activeMap.zone) || "",
            site: saved.selectedSite || (activeMap && activeMap.site) || "",
            mapName: (activeMap && activeMap.name) || "",
            machineType: (activeMap && activeMap.machineType) || saved.machineType || "",
            applicationMode: (activeMap && activeMap.applicationMode) || saved.applicationMode || "",
            brand: saved.selectedBrand || "",
            bottle: saved.selectedBottle || ""
          }});
        } catch (error) {
          self.postMessage({ ok: false, message: error && error.message ? error.message : "Unable to read saved context." });
        }
      };`;
      const blob = new Blob([workerSource], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      const cleanup = () => {
        worker.terminate();
        URL.revokeObjectURL(url);
      };
      worker.onmessage = (event) => {
        try {
          if (event.data?.ok) originalSetItem.call(storage, CONTEXT_KEY, JSON.stringify({ ...event.data.context, savedAt: new Date().toISOString() }));
        } catch { }
        cleanup();
      };
      worker.onerror = cleanup;
      worker.postMessage(raw);
      marker.contextRefreshScheduled = true;
    };
    if (typeof global.requestIdleCallback === "function") global.requestIdleCallback(run, { timeout: 1500 });
    else global.setTimeout(run, 250);
  }

  function installWatchdog() {
    global.setTimeout(() => {
      const status = document.getElementById("libraryValidationStatus");
      if (!status || !/loading diagnostic library/i.test(status.textContent || "")) return;
      status.textContent = "Troubleshooting startup did not complete. Reload this page; ServoForge preserved your saved workspace.";
      status.dataset.status = "fail";
    }, WATCHDOG_MS);
  }

  global.ServoForgeTroubleshootingStartup = Object.freeze(marker);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      installWatchdog();
      scheduleContextRefresh();
    }, { once: true });
  } else {
    installWatchdog();
    scheduleContextRefresh();
  }
})(window);
