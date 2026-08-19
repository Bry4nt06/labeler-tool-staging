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

  function keyForMap(item) {
    return normalized(item?.id) || `${normalized(item?.applicationMode)}|${normalized(item?.name)}`;
  }

  function keyForServo(item) {
    return normalized(item?.id) || `${normalized(item?.mapId)}|${normalized(item?.name)}`;
  }

  function keyForBottle(item) {
    return normalized(item?.id) || normalized(item?.bottleType);
  }

  function keyForBrand(item) {
    return `${normalized(item?.brand)}|${normalized(item?.bottleType)}|${normalized(item?.applicationMode)}`;
  }

  function mergeRecords(localItems, remoteItems, keyFor) {
    const result = Array.isArray(localItems) ? localItems.map(clone) : [];
    const index = new Map();
    result.forEach((item, position) => {
      const key = keyFor(item);
      if (key) index.set(key, position);
    });
    (Array.isArray(remoteItems) ? remoteItems : []).forEach((item) => {
      const key = keyFor(item);
      if (!key) return;
      if (index.has(key)) result[index.get(key)] = clone(item);
      else {
        index.set(key, result.length);
        result.push(clone(item));
      }
    });
    return result;
  }

  function librarySnapshot() {
    return {
      schemaVersion: 1,
      mapLibrary: clone(Array.isArray(state.mapLibrary) ? state.mapLibrary : []),
      servoProfileLibrary: clone(Array.isArray(state.servoProfileLibrary) ? state.servoProfileLibrary : []),
      bottleSpecs: clone(Array.isArray(state.bottleSpecs) ? state.bottleSpecs : []),
      labelSpecs: clone(Array.isArray(state.labelSpecs) ? state.labelSpecs : []),
      machineTypes: [...new Set((Array.isArray(state.machineTypes) ? state.machineTypes : []).map((value) => String(value).trim()).filter(Boolean))],
      savedAt: new Date().toISOString()
    };
  }

  function stableSnapshotForFingerprint() {
    const snapshot = librarySnapshot();
    delete snapshot.savedAt;
    return snapshot;
  }

  function fingerprint() {
    try { return JSON.stringify(stableSnapshotForFingerprint()); } catch { return ""; }
  }

  function applyRemoteLibrary(remote) {
    if (!remote || typeof remote !== "object") return false;
    state.mapLibrary = mergeRecords(state.mapLibrary, remote.mapLibrary, keyForMap);
    state.servoProfileLibrary = mergeRecords(state.servoProfileLibrary, remote.servoProfileLibrary, keyForServo);
    state.bottleSpecs = mergeRecords(state.bottleSpecs, remote.bottleSpecs, keyForBottle);
    state.labelSpecs = mergeRecords(state.labelSpecs, remote.labelSpecs, keyForBrand);
    state.machineTypes = [...new Set([
      ...(Array.isArray(state.machineTypes) ? state.machineTypes : []),
      ...(Array.isArray(remote.machineTypes) ? remote.machineTypes : [])
    ].map((value) => String(value).trim()).filter(Boolean))];
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
    if (!response.ok) throw new Error(payload.error || `Account library request failed (${response.status}).`);
    return payload;
  }

  async function syncNow({ force = false } = {}) {
    if (!initialized || syncing) return false;
    const currentFingerprint = fingerprint();
    if (!force && currentFingerprint && currentFingerprint === lastFingerprint) return false;
    syncing = true;
    try {
      await request("PUT", { library: librarySnapshot() });
      lastFingerprint = fingerprint();
      return true;
    } catch (error) {
      console.error("ServoForge account library sync failed", error);
      return false;
    } finally {
      syncing = false;
    }
  }

  async function restore() {
    try {
      const result = await request("GET");
      if (result.library) applyRemoteLibrary(result.library);
      initialized = true;
      if (typeof saveCurrentSettings === "function") saveCurrentSettings();
      lastFingerprint = fingerprint();
      if (!result.library) await syncNow({ force: true });
      startWatch();
      return { restored: Boolean(result.library), updatedAt: result.updatedAt || null };
    } catch (error) {
      initialized = true;
      lastFingerprint = fingerprint();
      startWatch();
      console.error("ServoForge account library restore failed", error);
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
    snapshot: librarySnapshot,
    get initialized() { return initialized; }
  });
})();
