"use strict";

(function installSpecificationRequiredFieldsController(global) {
  if (global.LabelerSpecificationRequiredFieldsController?.installed) return;

  const DIALOG_ID = "specificationRequiredDialog";
  const STYLE_ID = "specificationRequiredBlankOnlyStyles";
  const LABEL_NUMERIC_FIELDS = Object.freeze([
    "bodyLengthMm",
    "backLengthMm",
    "neckHeightMm",
    "neckLengthMm",
    "neckBottomCurveMm",
    "neckBottomCircumferenceMm",
    "codeBoxCenterMm"
  ]);
  const BOTTLE_NUMERIC_FIELDS = Object.freeze([
    "diameterTargetMm",
    "radiusReductionMm"
  ]);
  const FIELD_NAMES = Object.freeze({
    bottleType: "Bottle Type",
    diameterTargetMm: "Diameter Target",
    radiusReductionMm: "Radius Reduction",
    brand: "Brand",
    applicationMode: "Application",
    bodyLengthMm: "Body Length",
    backLengthMm: "Back Length",
    neckHeightMm: "Neck Height",
    neckLengthMm: "Neck Length",
    neckBottomCurveMm: "Neck Curve Bottom",
    neckBottomCircumferenceMm: "Neck Bottom Circumference",
    codeBoxCenterMm: "Code Box Center"
  });

  function runtimeState() {
    try { return typeof state !== "undefined" ? state : global.state; }
    catch { return global.state; }
  }

  function blank(value) {
    return value === null || value === undefined || String(value).trim() === "";
  }

  function validNumber(value) {
    if (blank(value)) return false;
    return Number.isFinite(Number(value));
  }

  function addIssue(issues, library, index, field, rowName) {
    issues.push({
      library,
      index,
      field,
      rowName,
      message: `${FIELD_NAMES[field] || field} is blank or invalid.`
    });
  }

  function validateBottle(spec, index, issues) {
    const rowName = String(spec?.bottleType || `Bottle row ${index + 1}`);
    if (blank(spec?.bottleType)) addIssue(issues, "bottle", index, "bottleType", rowName);
    BOTTLE_NUMERIC_FIELDS.forEach((field) => {
      if (!validNumber(spec?.[field])) addIssue(issues, "bottle", index, field, rowName);
    });
  }

  function validateLabel(spec, index, issues) {
    const rowName = String(spec?.brand || `Label row ${index + 1}`);
    ["brand", "applicationMode"].forEach((field) => {
      if (blank(spec?.[field])) addIssue(issues, "label", index, field, rowName);
    });
    LABEL_NUMERIC_FIELDS.forEach((field) => {
      if (!validNumber(spec?.[field])) addIssue(issues, "label", index, field, rowName);
    });
  }

  function validateSpecifications(source = runtimeState()) {
    const issues = [];
    (Array.isArray(source?.bottleSpecs) ? source.bottleSpecs : [])
      .forEach((spec, index) => validateBottle(spec, index, issues));
    (Array.isArray(source?.labelSpecs) ? source.labelSpecs : [])
      .forEach((spec, index) => validateLabel(spec, index, issues));
    return issues;
  }

  // Specification completeness is advisory only. Editing Specs must never be
  // blocked by blank fields, partially entered dimensions, or a missing legacy
  // Spec # value. Consumers may still inspect validateState() for diagnostics.
  global.LabelerSpecificationRequirements = Object.freeze({
    blankOnly: true,
    zeroIsComplete: true,
    blocking: false,
    advisoryOnly: true,
    validateState: validateSpecifications,
    validateBottle,
    validateLabel
  });

  function clearLegacyGuardUi() {
    if (typeof document === "undefined") return;

    document.getElementById(DIALOG_ID)?.remove?.();
    document.getElementById(STYLE_ID)?.remove?.();
    document.querySelectorAll("#specs .spec-required-missing").forEach((control) => {
      control.classList.remove("spec-required-missing");
      control.removeAttribute("aria-invalid");
      control.removeAttribute("data-required-message");
    });
    document.querySelectorAll("#specs tr.spec-row-has-required-fields")
      .forEach((row) => row.classList.remove("spec-row-has-required-fields"));
  }

  function showRequiredDialog() {
    clearLegacyGuardUi();
    return false;
  }

  function validateAndPrompt() {
    clearLegacyGuardUi();
    return true;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", clearLegacyGuardUi, { once: true });
    } else {
      clearLegacyGuardUi();
    }
  }

  global.LabelerSpecificationRequiredFieldsController = Object.freeze({
    installed: true,
    version: 2,
    blocking: false,
    advisoryOnly: true,
    zeroIsComplete: true,
    validateSpecifications,
    validateAndPrompt,
    showRequiredDialog,
    clearLegacyGuardUi
  });
})(typeof window !== "undefined" ? window : globalThis);
