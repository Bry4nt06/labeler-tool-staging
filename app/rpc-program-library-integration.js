"use strict";

(function installRpcProgramLibrary(global) {
  if (global.LabelerRpcProgramLibrary?.installed) return;

  function runtimeState() {
    try { return typeof state !== "undefined" ? state : global.state; }
    catch { return global.state; }
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function text(value, max) {
    return String(value || "").trim().slice(0, max);
  }

  function profileContext() {
    const source = runtimeState();
    const map = typeof global.activeMachineMap === "function"
      ? global.activeMachineMap()
      : source?.mapLibrary?.find?.((item) => item.id === source.activeMapId);
    return {
      mapId: map?.id || source?.activeMapId || "",
      mapName: map?.name || "Unnamed Map",
      brand: source?.selectedBrand || "Unspecified brand",
      bottleType: source?.selectedBottle || "Unspecified bottle",
      applicationMode: source?.applicationMode || "apl"
    };
  }

  function persistAndRender() {
    global.saveCurrentSettings?.();
    global.LabelerLocalPersistenceController?.flush?.();
    if (typeof global.renderSimulation === "function") global.renderSimulation();
    else if (typeof global.render === "function") global.render();
  }

  function selectedProfile() {
    const source = runtimeState();
    const id = document.getElementById("servoProfileLibrarySelect")?.value || source?.activeServoProfileId || "";
    return source?.servoProfileLibrary?.find?.((entry) => entry.id === id) || null;
  }

  function saveProfile() {
    const source = runtimeState();
    if (!source) throw new Error("ServoForge workspace state is unavailable.");
    const name = text(document.getElementById("servoProfileName")?.value, 80);
    const description = text(document.getElementById("servoProfileDescription")?.value, 180);
    if (!name) {
      global.alert?.("Enter a profile name before saving the simulation.");
      document.getElementById("servoProfileName")?.focus?.();
      return null;
    }

    source.servoProfileLibrary = Array.isArray(source.servoProfileLibrary) ? source.servoProfileLibrary : [];
    const context = profileContext();
    const profile = Object.freeze({
      id: `rpc-${global.crypto?.randomUUID?.() || Date.now()}`,
      name,
      description,
      ...context,
      savedAt: new Date().toISOString(),
      schemaVersion: 1,
      simulation: clone(source.simulation || { useCustom: false, turns: [], rows: [], deletedRows: [], lines: [] })
    });
    source.servoProfileLibrary.push(profile);
    source.activeServoProfileId = profile.id;

    // Local persistence is deliberately completed before the optional Community prompt.
    persistAndRender();
    global.dispatchEvent?.(new CustomEvent("servoforge:rpc-program-saved", {
      detail: { profile: clone(profile) }
    }));
    return profile;
  }

  function loadProfile() {
    const source = runtimeState();
    const profile = selectedProfile();
    if (!source || !profile?.simulation) return false;
    source.simulation = clone(profile.simulation);
    source.activeServoProfileId = profile.id;
    persistAndRender();
    return true;
  }

  function deleteProfile() {
    const source = runtimeState();
    const profile = selectedProfile();
    if (!source || !profile) return false;
    if (!global.confirm?.(`Delete saved RPC program "${profile.name}"?`)) return false;
    source.servoProfileLibrary = source.servoProfileLibrary.filter((entry) => entry.id !== profile.id);
    source.activeServoProfileId = source.servoProfileLibrary[0]?.id || "";
    persistAndRender();
    return true;
  }

  function selectProfile() {
    const source = runtimeState();
    const select = document.getElementById("servoProfileLibrarySelect");
    if (!source || !select) return;
    source.activeServoProfileId = select.value;
    persistAndRender();
  }

  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("#saveServoProfile")) saveProfile();
    else if (event.target?.closest?.("#loadServoProfile")) loadProfile();
    else if (event.target?.closest?.("#deleteServoProfile")) deleteProfile();
  });
  document.addEventListener("change", (event) => {
    if (event.target?.matches?.("#servoProfileLibrarySelect")) selectProfile();
  });

  global.LabelerRpcProgramLibrary = Object.freeze({
    installed: true,
    version: 1,
    saveProfile,
    loadProfile,
    deleteProfile,
    selectedProfile,
    profileContext
  });
})(typeof window !== "undefined" ? window : globalThis);
