"use strict";

(function installTopModulProcessTraceUi(global) {
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function processMarkup(entry) {
    const trace = entry?.processTrace;
    if (!trace) return "";
    const source = trace.source || {};
    const hardwareSource = trace.hardwareSource || null;
    return `<section class="sf-result-section sf-process-trace" data-topmodul-process-trace="${esc(entry.id)}">
      <h4>Process / calculation evidence</h4>
      <div class="sf-cause-evidence-grid">
        <div class="sf-plc-binding-cell"><small>Producer routine</small><code>${esc(trace.routine)}</code></div>
        <div class="sf-plc-binding-cell"><small>Evidence status</small><strong>${esc(trace.status)}</strong></div>
        <div class="sf-plc-binding-cell"><small>Confidence</small><strong>${esc(trace.confidence)}</strong></div>
        <div class="sf-plc-binding-cell"><small>PLC source</small><strong>${esc(source.file || "Cart PLC export")}</strong></div>
      </div>
      ${trace.producerSignals?.length ? `<div class="sf-cause-signal-list">${trace.producerSignals.map((signal) => `<code class="sf-cause-chip">${esc(signal)}</code>`).join("")}</div>` : ""}
      ${trace.calculationSteps?.length ? `<div class="sf-station-trace-path">${trace.calculationSteps.map((step) => `<div class="sf-station-trace-step"><small>${esc(step.label)}</small><code>${esc(step.value)}</code></div>`).join("")}</div>` : ""}
      ${trace.hardwareRows?.length ? `<div class="sf-circuit-device-grid">${trace.hardwareRows.map((row) => `<div class="sf-circuit-device">
        <strong>${esc(row.device)}</strong>
        <span class="sf-circuit-device-copy">
          <span>${esc(row.description)}${row.area ? ` — ${esc(row.area)}` : ""}</span>
          ${row.cable ? `<code>Cable ${esc(row.cable)}</code>` : ""}
          ${row.terminals ? `<code>${esc(row.terminals)}</code>` : ""}
        </span>
      </div>`).join("")}</div>` : ""}
      ${trace.drawingLocations?.length ? `<div class="sf-circuit-location-list">${trace.drawingLocations.map((location) => `<span class="sf-circuit-location"><strong>PDF ${esc(location.pdfPage)}</strong><span>${esc(location.section || location.sheet || "")}</span></span>`).join("")}</div>` : ""}
      <p class="sf-trace-status">${esc(trace.summary)}</p>
      <div class="sf-circuit-warning"><strong>PLC authority:</strong> ${esc(source.file || source.id || "Readable PLC export")}<br>${esc(source.sourceDiscipline || "")}</div>
      ${hardwareSource ? `<div class="sf-circuit-warning"><strong>Hardware authority:</strong> ${esc(hardwareSource.file)} — ${esc(hardwareSource.drawing)}${hardwareSource.revision ? ` · Rev ${esc(hardwareSource.revision)}` : ""}</div>` : ""}
      ${trace.scopeNote ? `<div class="sf-circuit-warning"><strong>Scope:</strong> ${esc(trace.scopeNote)}</div>` : ""}
      ${trace.safetyBoundary ? `<div class="sf-circuit-warning"><strong>Safety boundary:</strong> ${esc(trace.safetyBoundary)}</div>` : ""}
    </section>`;
  }

  function currentEntry(result, library) {
    const category = result.querySelector(".sf-entry-category")?.textContent || "";
    if (!/^TopModul PLC\s*\//i.test(category.trim())) return null;
    const code = result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
    return library.getTopModulFault?.(code) || null;
  }

  function render() {
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getTopModulProcessTrace || !result || result.hidden) return;
    const entry = currentEntry(result, library);
    const existing = result.querySelector("[data-topmodul-process-trace]");
    if (!entry?.processTrace) {
      existing?.remove();
      return;
    }
    if (existing?.dataset.topmodulProcessTrace === entry.id) return;
    existing?.remove();
    const anchor = result.querySelector("[data-topmodul-cause-evidence]")
      || result.querySelector("[data-topmodul-station-controller-trace]")
      || result.querySelector("[data-topmodul-plc-binding]")
      || result.querySelector(".sf-result-summary");
    if (anchor) anchor.insertAdjacentHTML("afterend", processMarkup(entry));
  }

  function install() {
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(() => queueMicrotask(render));
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-topmodul-open-fault],#faultSearchButton,.sf-search-result")) setTimeout(render, 0);
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);
