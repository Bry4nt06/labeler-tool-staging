"use strict";

function specificationAttributeValue(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function specificationActionIcon(kind) {
  if (kind === "duplicate") {
    return '<svg class="spec-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  }
  return '<svg class="spec-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>';
}

function specificationDeleteButton(label) {
  const description = specificationAttributeValue(label || "specification");
  return `<button class="danger small-button spec-icon-button spec-delete-button" type="button" title="Delete ${description}" aria-label="Delete ${description}">${specificationActionIcon("delete")}</button>`;
}

function specificationInfoHeader(label, title, tooltip, ariaLabel) {
  const safeTitle = specificationAttributeValue(title || label);
  const safeTooltip = specificationAttributeValue(tooltip || title || label);
  const safeAria = specificationAttributeValue(ariaLabel || `About ${label}`);
  return `<span class="spec-header-stack" title="${safeTitle}"><span class="spec-header-label">${label}</span><button class="info-tip spec-header-info" type="button" title="${safeTooltip}" aria-label="${safeAria}">i</button></span>`;
}

function renderBottleSpecs() {
  els.bottleSpecs.innerHTML = `<div class="table-tools"><button id="addBottleSpec" type="button">Add Bottle</button></div><table><thead><tr><th>#</th><th>Bottle Type</th><th class="num">${specificationInfoHeader("Dia Target", "Diameter Target (mm)", "Target bottle diameter in mm.", "About Diameter Target")}</th><th class="num">${specificationInfoHeader("Radius Red.", "Radius Reduction (mm)", "Radius reduction applied to calculate the effective body/back diameter.", "About Radius Reduction")}</th><th class="num">${specificationInfoHeader("Body/Back Dia", "Body/Back Diameter (mm)", "Effective body/back bottle diameter after radius reduction, in mm.", "About Body and Back Diameter")}</th><th class="num">${specificationInfoHeader("Body/Back Circ", "Body/Back Circumference (mm)", "Effective body/back circumference calculated from the body/back diameter, in mm.", "About Body and Back Circumference")}</th><th>Action</th></tr></thead><tbody></tbody></table>`;
  const body = els.bottleSpecs.querySelector("tbody");
  state.bottleSpecs.forEach((spec, index) => {
    const tr = document.createElement("tr");
    tr.dataset.specLibrary = "bottle";
    tr.dataset.specIndex = String(index);
    tr.dataset.specId = String(spec.id);
    tr.innerHTML = `<td>${spec.id}</td><td><input data-spec-field="bottleType" value="${specificationAttributeValue(spec.bottleType)}"></td><td><input data-spec-field="diameterTargetMm" class="num" type="number" step="0.001" value="${specificationAttributeValue(spec.diameterTargetMm)}"></td><td><input data-spec-field="radiusReductionMm" class="num" type="number" step="0.001" value="${specificationAttributeValue(spec.radiusReductionMm)}"></td><td class="num">${fmt(bodyDiameter(spec), 3)}</td><td class="num">${fmt(bodyCircumference(spec), 3)}</td><td>${specificationDeleteButton(spec.bottleType)}</td>`;
    body.appendChild(tr);
  });
}

function renderLabelSpecs() {
  els.labelSpecs.innerHTML = `
    <div class="table-tools">
      <span class="table-tool-note">Assign each brand to APL or Cold Glue. Build selections are filtered by the active application map.</span>
      <button id="addLabelSpec" type="button">Add Label</button>
    </div>
    <table><thead><tr><th>#</th><th>Brand</th><th title="Application">App</th><th class="num">${specificationInfoHeader("Body L", "Body Length", "Body label length in mm from the approved label drawing.", "About Body Label Length")}</th><th class="num">${specificationInfoHeader("Back L", "Back Length", "Back label length in mm from the approved label drawing.", "About Back Label Length")}</th><th class="num">${specificationInfoHeader("Neck Ht", "Neck Height", "Measure the vertical height of the neck label from its bottom edge to its top edge on the approved label drawing.", "About Neck Height")}</th><th class="num">${specificationInfoHeader("Neck L", "Neck Length", "Neck label length in mm from the approved label drawing.", "About Neck Label Length")}</th><th class="num">${specificationInfoHeader("Neck Curve", "Neck Curve Bottom", "Use the developed label width along the lower curved edge of the neck label from the approved label drawing.", "About Neck Curve Bottom")}</th><th class="num">${specificationInfoHeader("Neck Circ", "Neck Bottom Circumference", "Measure the bottle circumference at the exact height where the bottom edge of the neck label sits.", "About Neck Bottom Circumference")}</th><th class="num">${specificationInfoHeader("Code Box Ctr", "Code Box Center from Left Edge", "On the approved label drawing, measure from the label's left edge to the center of the coding box.", "About Code Box Center")}</th><th>Action</th></tr></thead><tbody></tbody></table>`;
  const labelSpecsTable = els.labelSpecs.querySelector("table");
  labelSpecsTable.classList.add("label-specs-table");
  labelSpecsTable.insertAdjacentHTML("afterbegin", '<colgroup><col class="label-col-id"><col class="label-col-brand"><col class="label-col-application"><col class="label-col-short"><col class="label-col-short"><col class="label-col-neck-height"><col class="label-col-neck-length"><col class="label-col-curve"><col class="label-col-circ"><col class="label-col-code"><col class="label-col-action"></colgroup>');
  const body = els.labelSpecs.querySelector("tbody");
  state.labelSpecs.forEach((spec, index) => {
    spec.applicationMode = normalizeLabelApplicationMode(spec.applicationMode);
    const tr = document.createElement("tr");
    tr.dataset.specLibrary = "label";
    tr.dataset.specIndex = String(index);
    tr.dataset.specId = String(spec.id);
    if (String(spec.brand ?? "") === String(state.selectedBrand ?? "")) {
      tr.classList.add("selected-brand-spec");
      tr.setAttribute("aria-current", "true");
      tr.title = "Currently selected Brand Recipe";
    }
    tr.innerHTML = `<td>${spec.id}</td><td><input data-spec-field="brand" value="${specificationAttributeValue(spec.brand)}"></td><td><select data-spec-field="applicationMode" aria-label="Application for ${specificationAttributeValue(spec.brand || "label")}"><option value="apl"${spec.applicationMode === "apl" ? " selected" : ""}>APL</option><option value="cold-glue"${spec.applicationMode === "cold-glue" ? " selected" : ""}>Cold Glue</option></select></td><td><input data-spec-field="bodyLengthMm" class="num" type="number" step="0.001" value="${specificationAttributeValue(spec.bodyLengthMm)}"></td><td><input data-spec-field="backLengthMm" class="num" type="number" step="0.001" value="${specificationAttributeValue(spec.backLengthMm)}"></td><td><input data-spec-field="neckHeightMm" class="num" type="number" step="0.001" value="${specificationAttributeValue(spec.neckHeightMm)}"></td><td><input data-spec-field="neckLengthMm" class="num" type="number" step="0.001" value="${specificationAttributeValue(spec.neckLengthMm)}"></td><td><input data-spec-field="neckBottomCurveMm" class="num" type="number" step="0.001" value="${specificationAttributeValue(spec.neckBottomCurveMm)}"></td><td><input data-spec-field="neckBottomCircumferenceMm" class="num" type="number" step="0.001" value="${specificationAttributeValue(spec.neckBottomCircumferenceMm)}"></td><td><input data-spec-field="codeBoxCenterMm" class="num" type="number" step="0.001" value="${specificationAttributeValue(spec.codeBoxCenterMm)}"></td><td>${specificationDeleteButton(spec.brand)}</td>`;
    body.appendChild(tr);
  });
}

window.LabelerSpecificationTableRenderer = Object.freeze({
  renderBottleSpecs,
  renderLabelSpecs,
  specificationInfoHeader
});
