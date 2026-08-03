"use strict";

(function installValidationDiagnosticsBoundary() {
  const RETRY_MS = 25;
  let installed = false;

  function driversReady() {
    return window.LabelerValidationIssueDriver && window.LabelerValidationResultAggregator;
  }

  function currentResult() {
    return state.validationResult || null;
  }

  function installStyles() {
    if (document.querySelector("#validationDiagnosticsStyles")) return;
    const style = document.createElement("style");
    style.id = "validationDiagnosticsStyles";
    style.textContent = `
      .validation-diagnostics-summary {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        align-items: stretch;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        padding: 8px;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-hi);
        box-sizing: border-box;
      }

      .validation-diagnostics-summary strong {
        grid-column: 1 / -1;
        display: block;
        width: 100%;
        min-width: 0;
        padding: 2px 4px 5px;
        font-size: 10px;
        line-height: 1.2;
        overflow-wrap: anywhere;
      }

      .validation-diagnostics-summary span {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        min-height: 32px;
        padding: 6px;
        border-radius: 5px;
        background: var(--input);
        box-sizing: border-box;
        font-size: 8px;
        line-height: 1.15;
        text-align: center;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .validation-diagnostics-summary[data-status="PASS"] strong { color: var(--health-good-text, #6df0a5); }
      .validation-diagnostics-summary[data-status="REVIEW"] strong { color: var(--health-warn-text, #ffd86d); }
      .validation-diagnostics-summary[data-status="FAIL"] strong { color: var(--health-bad-text, #ff8991); }

      @media (max-width: 430px) {
        .validation-diagnostics-summary {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderSummary() {
    const result = currentResult();
    const host = els?.validationDetails;
    if (!result || !host) return;
    host.querySelector(".validation-diagnostics-summary")?.remove();
    const summary = document.createElement("div");
    summary.className = "validation-diagnostics-summary";
    summary.dataset.status = result.status;
    summary.innerHTML = `
      <strong>Validation ${result.status}</strong>
      <span>${result.summary.bad} faults</span>
      <span>${result.summary.warn} warnings</span>
      <span>${result.summary.ok} checks</span>
      <span>${result.duplicateCount} duplicates removed</span>`;
    host.prepend(summary);
  }

  function aggregateNotes(notes) {
    const result = window.LabelerValidationResultAggregator.aggregateNotes(notes, { source: "application-validation" });
    state.validationResult = result;
    return result;
  }

  function install() {
    if (installed) return true;
    if (!driversReady() || typeof state === "undefined" || typeof validate !== "function" || typeof renderValidation !== "function") return false;
    installed = true;
    installStyles();

    const validateBeforeDiagnostics = validate;
    const wrappedValidate = function validateWithDiagnosticsBoundary(...args) {
      const notes = validateBeforeDiagnostics.apply(this, args);
      return window.LabelerValidationResultAggregator.toNotes(aggregateNotes(notes));
    };
    wrappedValidate.validationDiagnosticsBoundary = true;
    wrappedValidate.previousValidate = validateBeforeDiagnostics;
    validate = wrappedValidate;
    window.validate = wrappedValidate;

    const renderValidationBeforeDiagnostics = renderValidation;
    const wrappedRenderValidation = function renderValidationWithDiagnosticsBoundary(...args) {
      const output = renderValidationBeforeDiagnostics.apply(this, args);
      renderSummary();
      return output;
    };
    wrappedRenderValidation.validationDiagnosticsBoundary = true;
    wrappedRenderValidation.previousRenderValidation = renderValidationBeforeDiagnostics;
    renderValidation = wrappedRenderValidation;
    window.renderValidation = wrappedRenderValidation;

    window.LabelerValidationDiagnostics = Object.freeze({
      aggregateNotes,
      currentResult,
      renderSummary
    });
    return true;
  }

  function wait() {
    if (!install()) window.setTimeout(wait, RETRY_MS);
  }

  wait();
})();
