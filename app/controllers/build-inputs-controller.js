"use strict";

(function installBuildInputsController(global) {
  const actions = global.LabelerWorkspaceActionService;

  function hasOption(options, key) {
    return Object.prototype.hasOwnProperty.call(options, key);
  }

  function commit(mutate, options = {}) {
    return actions.execute({
      mutate,
      syncMap: Boolean(options.syncMap),
      regenerate: Boolean(options.regenerate),
      persist: options.persist !== false,
      render: hasOption(options, "render") ? options.render : "all"
    });
  }

  function selectedContext() {
    const label = actions.call("selectedLabelSpec") || state.labelSpecs.find((row) => row.brand === state.selectedBrand);
    const bottle = state.bottleSpecs.find((row) => row.bottleType === state.selectedBottle);
    const bodyCirc = actions.call("bodyCircumference", bottle) ?? 0;
    const neckCirc = actions.number(label?.neckBottomCircumferenceMm, 0);
    const neckLabelDeg = actions.call("degFromMm", label?.neckBottomCurveMm, neckCirc) ?? 0;
    return { label, bottle, bodyCirc, neckCirc, neckLabelDeg };
  }

  function bottleKey(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function selectedLabel() {
    return actions.call("selectedLabelSpec")
      || state.labelSpecs.find((row) => String(row?.brand ?? "") === String(state.selectedBrand ?? ""))
      || null;
  }

  function normalizeApplicationReference(value, fallback = "center-tack") {
    const policy = global.LabelerLabelCenterlinePolicy;
    if (policy?.normalizeApplicationReference) return policy.normalizeApplicationReference(value, fallback);
    const normalized = String(value ?? "").trim().toLowerCase().replace(/[_\s]+/g, "-");
    return normalized === "leading-edge" || normalized === "leading" ? "leading-edge" : fallback;
  }

  function persistContactParameter(section, value) {
    global.LabelerBrandContactParameterDefaults?.setContactDeg?.(state, section, value);
  }

  function selectZone(value) {
    commit(() => {
      state.selectedZone = value;
      actions.call("ensureSelectedZoneAndSite");
    });
  }

  function selectSite(value) {
    commit(() => { state.selectedSite = value; }, { render: null });
  }

  let brandSelectionSequence = 0;

  function selectBrand(value) {
    const requested = String(value ?? "");
    const available = actions.call("labelSpecsForApplication") || state.labelSpecs || [];
    const selected = available.find((row) => String(row?.brand ?? "") === requested);
    if (!selected) return false;
    const requestedBrand = String(selected.brand);
    const transaction = ++brandSelectionSequence;

    const applyRequestedSelection = () => {
      state.selectedBrand = requestedBrand;
      actions.call("ensureBottleReferenceForLabel", selected);
      actions.call("applyLabelLengthStationRules");
      global.LabelerLabelCenterlinePolicy?.ensureApplicationReferenceDefaults?.(state);
    };

    const restoreBuildInputs = () => {
      global.LabelerTabsController?.setDirectTabState?.(
        "buildInputs",
        global.document?.querySelector?.('.tabs .tab[data-tab="buildInputs"]') || null
      );
    };

    return actions.execute({
      mutate() {
        applyRequestedSelection();
      },
      regenerate: true,
      persist: true,
      render: "all",
      restoreTab: "buildInputs",
      beforeRender() {
        if (String(state.selectedBrand ?? "") !== requestedBrand) {
          applyRequestedSelection();
          actions.call("applyGeneratedServoProfile");
          applyRequestedSelection();
        }
      },
      after() {
        if (transaction !== brandSelectionSequence) return;
        applyRequestedSelection();
        restoreBuildInputs();

        const settle = () => {
          if (transaction !== brandSelectionSequence) return;
          const selectionChanged = String(state.selectedBrand ?? "") !== requestedBrand;
          const activeTab = String(state.activeTab || "");
          if (selectionChanged) applyRequestedSelection();
          if (selectionChanged && typeof global.renderBuildInputs === "function") global.renderBuildInputs();
          if (selectionChanged || activeTab !== "buildInputs") restoreBuildInputs();
          if (selectionChanged || activeTab !== "buildInputs") actions.call("saveCurrentSettings");
        };

        if (typeof global.requestAnimationFrame === "function") global.requestAnimationFrame(settle);
        else if (typeof global.setTimeout === "function") global.setTimeout(settle, 0);
      }
    });
  }

  function selectBottle(value, options = {}) {
    const requestedBottleType = bottleKey(value);
    const selected = state.bottleSpecs.find((row) => bottleKey(row?.bottleType) === requestedBottleType);
    if (!selected) return false;

    const commitOptions = { regenerate: true };
    if (hasOption(options, "render")) commitOptions.render = options.render;

    return commit(() => {
      state.selectedBottle = selected.bottleType;
      const label = selectedLabel();
      if (label) label.bottleType = selected.bottleType;
    }, commitOptions);
  }

  function updateField(key, value) {
    commit(() => { state.buildInputs[key] = actions.number(value, state.buildInputs[key]); });
  }

  function updateApplicationReference(section, value) {
    const normalizedSection = String(section || "").trim().toLowerCase();
    if (!["neck", "body", "back"].includes(normalizedSection)) return false;
    const fallback = normalizedSection === "neck" ? "center-tack" : "leading-edge";
    const reference = normalizeApplicationReference(value, fallback);
    commit(() => {
      state.buildInputs = state.buildInputs || {};
      state.buildInputs[`${normalizedSection}ApplicationReference`] = reference;
      if (normalizedSection === "neck") {
        state.buildInputs.neckApplication = reference === "leading-edge" ? "Leading Edge" : "Center";
      }
      global.LabelerLabelCenterlinePolicy?.ensureApplicationReferenceDefaults?.(state);
    }, { syncMap: true, regenerate: true });
    return true;
  }

  function updateNeckApplication(value) {
    return updateApplicationReference("neck", value);
  }

  function updateCalculatedField(id, rawValue) {
    const value = actions.number(rawValue, 0);
    const context = selectedContext();
    commit(() => {
      const { label, bottle, bodyCirc, neckCirc, neckLabelDeg } = context;
      switch (id) {
        case "programNeckCurveMm":
          if (label) label.neckBottomCurveMm = Math.max(0, value);
          break;
        case "programBodyLengthMm":
          if (label) label.bodyLengthMm = Math.max(0, value);
          break;
        case "programBackLengthMm":
          if (label) label.backLengthMm = Math.max(0, value);
          break;
        case "programNeckCircMm":
          if (label) label.neckBottomCircumferenceMm = Math.max(0.001, value);
          break;
        case "programBodyCircMm":
          if (bottle) bottle.diameterTargetMm = Math.max(0.001, value) / Math.PI + 2 * actions.number(bottle.radiusReductionMm, 0);
          break;
        case "programNeckLabelDeg":
          if (label) label.neckBottomCurveMm = Math.max(0, value) / 360 * Math.max(0.001, neckCirc);
          break;
        case "programBodyLabelDeg":
          if (label) label.bodyLengthMm = Math.max(0, value) / 360 * Math.max(0.001, bodyCirc);
          break;
        case "programBackLabelDeg":
          if (label) label.backLengthMm = Math.max(0, value) / 360 * Math.max(0.001, bodyCirc);
          break;
        case "programNeckContactDeg":
          persistContactParameter("neck", value);
          state.buildInputs.neckContactMm = Math.max(0, value) / 360 * Math.max(0.001, neckCirc);
          break;
        case "programBodyContactDeg":
          persistContactParameter("body", value);
          state.buildInputs.bodyContactMm = Math.max(0, value) / 360 * Math.max(0.001, bodyCirc);
          break;
        case "programBackContactDeg":
          persistContactParameter("back", value);
          state.buildInputs.backContactMm = Math.max(0, value) / 360 * Math.max(0.001, bodyCirc);
          break;
        case "programCenterLineFrontDeg":
          if (Number.isFinite(actions.number(state.buildInputs.centerLineFrontDeg, NaN))) state.buildInputs.centerLineFrontDeg = value;
          else if (state.buildInputs.neckApplication === "Leading Edge") state.buildInputs.plateStartPositionDeg = value - neckLabelDeg / 2;
          else state.buildInputs.neckSpenderPlateDeg = value - state.buildInputs.plateStartPositionDeg + 90;
          break;
        case "programCenterLineBackDeg": {
          const front = value - 180;
          if (Number.isFinite(actions.number(state.buildInputs.centerLineFrontDeg, NaN))) state.buildInputs.centerLineFrontDeg = front;
          else if (state.buildInputs.neckApplication === "Leading Edge") state.buildInputs.plateStartPositionDeg = front - neckLabelDeg / 2;
          else state.buildInputs.neckSpenderPlateDeg = front - state.buildInputs.plateStartPositionDeg + 90;
          break;
        }
        case "programCodeBoxCenterDeg":
          if (label) label.codeBoxCenterMm = Math.max(0, value) / 360 * Math.max(0.001, bodyCirc);
          break;
        case "programHeadPitchDeg":
          state.headCount = Math.max(1, Math.min(120, Math.round(360 / Math.max(0.1, value))));
          break;
        case "programTableMapScale":
          state.autoScaleTableMap = true;
          state.referencePitchRadiusMm = Math.max(0.001, value) * state.tablePitchRadiusMm;
          break;
        case "programEncoderCountsPlateRev":
          state.encoderCountsPerRev = Math.max(1, value) / Math.max(0.001, state.servoGearRatio);
          break;
        case "programMaxMoveRatio":
          state.maxMoveRatio = Math.max(0.1, value);
          break;
        default:
          return;
      }
    }, { syncMap: true });
  }

  global.LabelerBuildInputsController = Object.freeze({
    selectZone,
    selectSite,
    selectBrand,
    selectBottle,
    updateField,
    updateApplicationReference,
    updateNeckApplication,
    updateCalculatedField
  });
})(window);
