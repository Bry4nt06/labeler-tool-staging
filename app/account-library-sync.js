"use strict";

(() => {
  const API_URL = "/api/user/library";
  const SYNC_INTERVAL_MS = 2500;
  let initialized = false;
  let syncing = false;
  let lastFingerprint = "";
  let timer = null;

  function clone(value) {
    try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
  }

  function normalized(value) {
    return String(value || "").trim().toLowerCase();
  }

  function cleanString(value) {
    return String(value || "").trim();
  }

  function accountWorkspaceSnapshot() {
    return {
      schemaVersion: 2,
      mapLibrary: clone(Array.isArray(state.mapLibrary) ? state.mapLibrary : []),
      servoProfileLibrary: clone(Array.isArray(state.servoProfileLibrary) ? state.servoProfileLibrary : []),
      bottleSpecs: clone(Array.isArray(state.bottleSpecs) ? state.bottleSpecs : []),
      labelSpecs: clone(Array.isArray(state.labelSpecs) ? state.labelSpecs : []),
      machineTypes: [...new Set((Array.isArray(state.machineTypes) ? state.machineTypes : []).map(cleanString).filter(Boolean))],
      zoneSiteConfiguration: clone(state.zoneSiteConfiguration && typeof state.zoneSiteConfiguration === "object" ? state.zoneSiteConfiguration : {}),
      selectedBrand: cleanString(state.selectedBrand),
      selectedBottle: cleanString(state.selectedBottle),
      selectedZone: cleanString(state.selectedZone),
      selectedSite: cleanString(state.selectedSite),
      activeMapId: cleanString(state.activeMapId),
      activeServoProfileId: cleanString(state.activeServoProfileId),
      savedAt: new Date().toISOString()
    };
  }

  function stableSnapshotForFingerprint() {
    const snapshot = accountWorkspaceSnapshot();
    delete snapshot.savedAt;
    return snapshot;
  }

  function fingerprint() {
    try { return JSON.stringify(stableSnapshotForFingerprint()); } catch { return ""; }
  }

  function applyRemoteWorkspace(remote) {
    if (!remote || typeof remote !== "object") return false;

    // Once an account has cloud data, that account is authoritative for the
    // portable catalog. A different PC must not silently merge stale browser
    // records back into the user's account during startup.
    if (Array.isArray(remote.mapLibrary)) state.mapLibrary = clone(remote.mapLibrary);
    if (Array.isArray(remote.servoProfileLibrary)) state.servoProfileLibrary = clone(remote.servoProfileLibrary);
    if (Array.isArray(remote.bottleSpecs)) state.bottleSpecs = clone(remote.bottleSpecs);
    if (Array.isArray(remote.labelSpecs)) state.labelSpecs = clone(remote.labelSpecs);
    if (Array.isArray(remote.machineTypes)) {
      state.machineTypes = [...new Set(remote.machineTypes.map(cleanString).filter(Boolean))];
    }
    if (remote.zoneSiteConfiguration && typeof remote.zoneSiteConfiguration === "object") {
      state.zoneSiteConfiguration = clone(remote.zoneSiteConfiguration);
      if (typeof ensureSelectedZoneAndSite === "function") ensureSelectedZoneAndSite();
    }

    const assignIfPresent = (key) => {
      if (!Object.hasOwn(remote, key)) return;
      const value = cleanString(remote[key]);
      if (value) state[key] = value;
    };
    ["selectedBrand", "selectedBottle", "selectedZone", "selectedSite", "activeMapId", "activeServoProfileId"].forEach(assignIfPresent);
    return true;
  }

  async function request(method, body) {
    const response = await fetch(API_URL, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Account workspace request failed (${response.status}).`);
    return payload;
  }

  async function syncNow({ force = false } = {}) {
    if (!initialized || syncing) return false;
    const currentFingerprint = fingerprint();
    if (!force && currentFingerprint && currentFingerprint === lastFingerprint) return false;
    syncing = true;
    try {
      await request("PUT", { library: accountWorkspaceSnapshot() });
      lastFingerprint = fingerprint();
      return true;
    } catch (error) {
      console.error("ServoForge account workspace sync failed", error);
      return false;
    } finally {
      syncing = false;
    }
  }

  async function restore() {
    try {
      const result = await request("GET");
      initialized = true;

      if (result.library) {
        applyRemoteWorkspace(result.library);
        if (typeof saveCurrentSettings === "function") saveCurrentSettings();
      }

      lastFingerprint = fingerprint();

      // The first browser used by an account becomes the seed only when the
      // account has no cloud workspace yet. Every later PC restores from the
      // cloud first and never overwrites it with stale localStorage on login.
      if (!result.library) await syncNow({ force: true });
      startWatch();
      return { restored: Boolean(result.library), updatedAt: result.updatedAt || null };
    } catch (error) {
      initialized = true;
      lastFingerprint = fingerprint();
      startWatch();
      console.error("ServoForge account workspace restore failed", error);
      return { restored: false, error: error.message || String(error) };
    }
  }

  function startWatch() {
    if (timer) return;
    timer = window.setInterval(() => {
      if (fingerprint() !== lastFingerprint) void syncNow();
    }, SYNC_INTERVAL_MS);
  }

  function stopWatch() {
    if (!timer) return;
    window.clearInterval(timer);
    timer = null;
  }

  window.ServoForgeAccountLibrarySync = Object.freeze({
    restore,
    syncNow,
    startWatch,
    stopWatch,
    snapshot: accountWorkspaceSnapshot,
    get initialized() { return initialized; }
  });
})();
