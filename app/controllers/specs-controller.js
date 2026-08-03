"use strict";

(function installSpecsController(global) {
  const actions = global.LabelerWorkspaceActionService;

  function commit(mutate) {
    return actions.execute({ mutate, persist: true, render: "all" });
  }

  function addBottle() {
    return commit(() => {
      const id = actions.call("nextId", state.bottleSpecs) ?? state.bottleSpecs.length + 1;
      const bottleType = `New Bottle ${id}`;
      state.bottleSpecs.push({ id, bottleType, diameterTargetMm: 0, radiusReductionMm: 0 });
      state.selectedBottle = bottleType;
    });
  }

  function updateBottle(index, key, value) {
    const spec = state.bottleSpecs[index];
    if (!spec) return;
    return commit(() => {
      if (key === "bottleType") {
        const oldBottleType = spec.bottleType;
        const newBottleType = String(value || "").trim() || oldBottleType;
        spec.bottleType = newBottleType;
        if (state.selectedBottle === oldBottleType) state.selectedBottle = newBottleType;
        state.labelSpecs.forEach((label) => {
          if (label.bottleType === oldBottleType) label.bottleType = newBottleType;
        });
        return;
      }
      spec[key] = actions.number(value, spec[key]);
    });
  }

  function deleteBottle(index) {
    const spec = state.bottleSpecs[index];
    if (!spec || !global.confirm(`Delete bottle spec "${spec.bottleType}"?`)) return;
    return commit(() => {
      const deletedBottleType = spec.bottleType;
      state.bottleSpecs.splice(index, 1);
      const replacement = state.bottleSpecs[0]?.bottleType ?? "";
      if (state.selectedBottle === deletedBottleType) state.selectedBottle = replacement;
      state.labelSpecs.forEach((label) => {
        if (label.bottleType === deletedBottleType) label.bottleType = replacement;
      });
    });
  }

  function addLabel() {
    return commit(() => {
      const id = actions.call("nextId", state.labelSpecs) ?? state.labelSpecs.length + 1;
      const brand = `New Label ${id}`;
      state.labelSpecs.push({
        id,
        applicationMode: actions.call("normalizeLabelApplicationMode", state.applicationMode) || state.applicationMode,
        brand,
        specNumber: "",
        bottleType: state.selectedBottle,
        bodyLengthMm: 0,
        backLengthMm: 0,
        neckHeightMm: 0,
        neckLengthMm: 0,
        neckBottomCurveMm: 0,
        neckBottomCircumferenceMm: 0,
        codeBoxCenterMm: 0
      });
      state.selectedBrand = brand;
    });
  }

  function updateLabel(index, key, value) {
    const spec = state.labelSpecs[index];
    if (!spec) return;
    return commit(() => {
      if (key === "applicationMode") {
        spec.applicationMode = actions.call("normalizeLabelApplicationMode", value) || value;
        actions.call("ensureSelectedBrandForApplication");
        return;
      }
      const oldBrand = spec.brand;
      spec[key] = typeof spec[key] === "number" ? actions.number(value, spec[key]) : String(value ?? "");
      if (key === "brand" && state.selectedBrand === oldBrand) state.selectedBrand = spec.brand;
    });
  }

  function deleteLabel(index) {
    const spec = state.labelSpecs[index];
    if (!spec || !global.confirm(`Delete label spec "${spec.brand}"?`)) return;
    return commit(() => {
      state.labelSpecs.splice(index, 1);
      actions.call("ensureSelectedBrandForApplication");
    });
  }

  global.LabelerSpecsController = Object.freeze({
    addBottle,
    updateBottle,
    deleteBottle,
    addLabel,
    updateLabel,
    deleteLabel
  });
})(window);