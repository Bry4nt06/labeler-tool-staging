"use strict";

function selectedBottleSpec() {
  return state.bottleSpecs.find((spec) => spec.bottleType === state.selectedBottle) ?? null;
}

function selectedLabelSpec() {
  return state.labelSpecs.find((spec) => spec.brand === state.selectedBrand) ?? null;
}

function selectedNeckWrapPlan() {
  const label = selectedLabelSpec();
  const geometry = window.LabelerGeometryDriver;
  if (!label || typeof geometry?.neckWrapPlan !== "function") return null;
  return geometry.neckWrapPlan({
    labelLengthMm: label.neckBottomCurveMm,
    circumferenceMm: label.neckBottomCircumferenceMm,
    wrapType: label.neckWrapType,
    overlapEdge: label.neckOverlapEdge,
    overlapTargetMm: label.neckOverlapTargetMm,
    seamWipeEnabled: label.neckSeamWipeEnabled,
    seamOverWipeDeg: label.neckSeamOverWipeDeg
  });
}

function normalizeLabelApplicationMode(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return normalized === "cold-glue" || normalized === "coldglue" ? "cold-glue" : "apl";
}

function labelSpecMatchesApplication(spec, mode = state.applicationMode) {
  return normalizeLabelApplicationMode(spec?.applicationMode) === normalizeLabelApplicationMode(mode);
}

function labelSpecsForApplication(mode = state.applicationMode) {
  return state.labelSpecs.filter((spec) => labelSpecMatchesApplication(spec, mode));
}

function bottleTypeExists(bottleType) {
  if (!Array.isArray(state.bottleSpecs)) return Boolean(bottleType);
  return state.bottleSpecs.some((spec) => spec.bottleType === bottleType);
}

function ensureBottleReferenceForLabel(label = null) {
  if (label?.bottleType && bottleTypeExists(label.bottleType)) {
    state.selectedBottle = label.bottleType;
    return label.bottleType;
  }
  const fallback = bottleTypeExists(state.selectedBottle)
    ? state.selectedBottle
    : state.bottleSpecs?.find((spec) => spec.bottleType)?.bottleType || "";
  state.selectedBottle = fallback;
  if (label && fallback) label.bottleType = fallback;
  return fallback;
}

function ensureSelectedBrandForApplication() {
  // Legacy name retained for callers. Build recipe selection is independent of
  // the label catalog's APL/Cold Glue metadata; the active machine map owns the
  // generated program type.
  const available = Array.isArray(state.labelSpecs) ? state.labelSpecs : [];
  const selected = available.find((spec) => spec.brand === state.selectedBrand);
  if (selected) {
    if (!bottleTypeExists(selected.bottleType)) ensureBottleReferenceForLabel(selected);
    else if (!bottleTypeExists(state.selectedBottle)) state.selectedBottle = selected.bottleType;
    return selected;
  }

  const fallback = available[0] || null;
  state.selectedBrand = fallback?.brand || "";
  ensureBottleReferenceForLabel(fallback);
  return fallback;
}
