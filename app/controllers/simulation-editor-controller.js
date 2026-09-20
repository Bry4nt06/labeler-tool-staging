"use strict";

(function installSimulationEditorController(global) {
  const actions = global.LabelerWorkspaceActionService;

  function line(sourceIndex) {
    const index = Number(sourceIndex);
    return Number.isInteger(index) ? state.simulation?.lines?.[index] : null;
  }

  function renderAll(mutate) {
    return actions.execute({ mutate, persist: true, render: "all" });
  }

  function clone(value) {
    return actions.call("deepClone", value) || JSON.parse(JSON.stringify(value));
  }

  function markManualProgram() {
    state.simulation.useCustom = true;
    state.simulation.source = "manual";
  }

  function updateDraftMetadata(field, value) {
    if (!["name", "description"].includes(field)) return false;
    const key = field === "name" ? "draftName" : "draftDescription";
    const maximum = field === "name" ? 80 : 180;
    actions.execute({
      mutate() {
        if (!state.simulation || typeof state.simulation !== "object") state.simulation = {};
        state.simulation[key] = String(value || "").slice(0, maximum);
      },
      persist: true
    });
    return true;
  }

  function updateCommand(sourceIndex, value) {
    if (!line(sourceIndex)) return;
    renderAll(() => actions.call("setSimulationCommand", Number(sourceIndex), value));
  }

  function updateTableAngle(sourceIndex, value) {
    const current = line(sourceIndex);
    if (!current) return;
    renderAll(() => {
      markManualProgram();
      state.simulation.lines[sourceIndex] = {
        ...current,
        tableAngle: actions.number(value, current.tableAngle)
      };
    });
  }

  function updatePlateAngle(sourceIndex, value) {
    const current = line(sourceIndex);
    if (!current) return;
    renderAll(() => {
      markManualProgram();
      state.simulation.lines[sourceIndex] = {
        ...current,
        plateAngle: value === "" ? null : actions.number(value, current.plateAngle)
      };
    });
  }

  function updateAction(sourceIndex, value) {
    const current = line(sourceIndex);
    if (!current) return;
    actions.execute({
      mutate() {
        markManualProgram();
        state.simulation.lines[sourceIndex] = { ...current, action: String(value ?? "") };
      },
      persist: true,
      render: ["map", "simulation-map"]
    });
  }

  function deleteLine(sourceIndex) {
    if (!line(sourceIndex)) return;
    renderAll(() => actions.call("deleteSimulationLine", Number(sourceIndex)));
  }

  function addLineBeforeEnd() {
    renderAll(() => actions.call("addSimulationLineBeforeEnd"));
  }

  function profileContext() {
    const map = actions.call("activeMachineMap");
    return {
      mapId: map?.id || state.activeMapId || "",
      mapName: map?.name || "Unnamed Map",
      brand: state.selectedBrand || "Unspecified brand",
      bottleType: state.selectedBottle || "Unspecified bottle",
      applicationMode: state.applicationMode || "apl"
    };
  }

  function saveProfile(nameValue, descriptionValue) {
    const name = String(nameValue || "").trim();
    if (!name) {
      global.alert("Enter a profile name before saving.");
      document.querySelector("#servoProfileName")?.focus();
      return null;
    }
    const profile = actions.execute({
      mutate() {
        const profile = {
          id: `rpc-${global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`,
          name,
          description: String(descriptionValue || "").trim(),
          savedAt: new Date().toISOString(),
          schemaVersion: 1,
          ...profileContext(),
          simulation: clone(state.simulation)
        };
        if (!Array.isArray(state.servoProfileLibrary)) state.servoProfileLibrary = [];
        state.servoProfileLibrary.push(profile);
        state.activeServoProfileId = profile.id;
        state.simulation.draftName = name;
        state.simulation.draftDescription = profile.description;
        return profile;
      },
      persist: true,
      render: "all"
    });
    global.LabelerLocalPersistenceController?.flush?.();
    global.dispatchEvent?.(new CustomEvent("servoforge:rpc-program-saved", {
      detail: { profile: clone(profile) }
    }));
    return profile;
  }

  function selectProfile(profileId) {
    actions.execute({
      mutate() {
        state.activeServoProfileId = String(profileId || "");
      },
      persist: true,
      render: "simulation"
    });
  }

  function loadProfile(profileId) {
    const profile = state.servoProfileLibrary?.find((entry) => entry.id === profileId);
    if (!profile) return;
    if (!profile.simulation || typeof profile.simulation !== "object") {
      global.alert("This older profile does not contain custom simulation settings.");
      return;
    }
    const map = state.mapLibrary.find((entry) => entry.id === profile.mapId);
    if (!map) {
      global.alert(`The saved map “${profile.mapName || "Unknown"}” is no longer available.`);
      return;
    }
    actions.execute({
      mutate() {
        actions.call("loadMachineMapIntoRuntime", map, false);
        if (profile.applicationMode) state.applicationMode = profile.applicationMode;
        if (state.labelSpecs.some((entry) => entry.brand === profile.brand)) state.selectedBrand = profile.brand;
        if (state.bottleSpecs.some((entry) => entry.bottleType === profile.bottleType)) state.selectedBottle = profile.bottleType;
        state.simulation = clone(profile.simulation);
        state.simulation.useCustom = true;
        if (!state.simulation.source) state.simulation.source = "saved-profile";
        state.simulation.draftName = profile.name || "";
        state.simulation.draftDescription = profile.description || "";
        actions.call("ensureSimulationRows");
        state.activeServoProfileId = profile.id;
      },
      persist: true,
      render: "all"
    });
  }

  function deleteProfile(profileId) {
    const profile = state.servoProfileLibrary?.find((entry) => entry.id === profileId);
    if (!profile || !global.confirm(`Delete saved servo profile “${profile.name}”?`)) return;
    actions.execute({
      mutate() {
        state.servoProfileLibrary = state.servoProfileLibrary.filter((entry) => entry.id !== profileId);
        if (state.activeServoProfileId === profileId) state.activeServoProfileId = "";
      },
      persist: true,
      render: "all"
    });
  }

  global.LabelerSimulationEditorController = Object.freeze({
    updateDraftMetadata,
    updateCommand,
    updateTableAngle,
    updatePlateAngle,
    updateAction,
    deleteLine,
    addLineBeforeEnd,
    saveProfile,
    selectProfile,
    loadProfile,
    deleteProfile
  });
})(window);
