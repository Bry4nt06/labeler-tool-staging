"use strict";

(function installTopModulFaultDrillDownUi(global) {
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installStyles() {
    if (document.getElementById("sfTopModulFaultDrillDownStyles")) return;
    const style = document.createElement("style");
    style.id = "sfTopModulFaultDrillDownStyles";
    style.textContent = `
      .sf-plc-binding-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
      .sf-plc-binding-cell { display:grid; gap:3px; padding:9px 10px; border:1px solid var(--line); border-radius:7px; background:var(--input); }
      .sf-plc-binding-cell small { color:var(--muted); font-size:9px; text-transform:uppercase; letter-spacing:.07em; }
      .sf-plc-binding-cell strong, .sf-plc-binding-cell code { overflow-wrap:anywhere; font-size:11px; }
      .sf-trace-status { margin-top:8px; color:var(--muted); font-size:11px; line-height:1.45; }
      .sf-station-trace-path { display:grid; gap:7px; margin-top:8px; }
      .sf-station-trace-step { display:grid; grid-template-columns:84px minmax(0,1fr); gap:9px; align-items:start; padding:8px 10px; border:1px solid var(--line); border-radius:7px; background:var(--input); }
      .sf-station-trace-step small { color:var(--muted); text-transform:uppercase; font-size:9px; letter-spacing:.07em; }
      .sf-station-trace-step code, .sf-station-trace-step strong { overflow-wrap:anywhere; font-size:11px; }
      .sf-related-fault-grid { display:grid; gap:7px; margin-top:8px; }
      .sf-related-fault { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:10px; align-items:center; width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:7px; background:var(--input); color:var(--ink); text-align:left; box-shadow:none; }
      .sf-related-fault:hover { border-color:var(--green); background:var(--panel-hi); }
      .sf-related-fault-code { min-width:48px; color:var(--green); font-weight:800; }
      .sf-related-fault-copy { display:grid; gap:2px; min-width:0; }
      .sf-related-fault-copy strong { font-size:12px; overflow-wrap:anywhere; }
      .sf-related-fault-copy span { color:var(--muted); font-size:10px; line-height:1.35; }
      .sf-related-fault-arrow { color:var(--muted); }
      @media (max-width:760px) { .sf-plc-binding-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:480px) { .sf-plc-binding-grid { grid-template-columns:1fr; } .sf-related-fault { grid-template-columns:auto minmax(0,1fr); } .sf-related-fault-arrow { display:none; } .sf-station-trace-step { grid-template-columns:1fr; gap:3px; } }
      @media print { body.sf-print-diagnosis .sf-related-fault, body.sf-print-diagnosis .sf-station-trace-step { break-inside:avoid; border-color:#bbb; background:transparent!important; color:#000!important; } }
    `;
    document.head.appendChild(style);
  }

  function traceStatusLabel(status) {
    if (status === "fault-bit-and-text-bound") return "Fault number, alarm text, and PLC source bit are verified. Rung-level cause and exact schematic page/component trace are not yet marked verified.";
    if (status === "station-local-trigger-and-transport-bound") return "Station-local fault bit, direct controller trigger tag, station-to-Labeler transport, and Labeler fault bit are bound. Physical I/O/component trace is still pending.";
    if (status === "station-local-fault-and-transport-bound") return "Station-local fault bit and station-to-Labeler transport are bound. The exact producing rung/condition and physical I/O/component trace are still pending.";
    return String(status || "Trace status not recorded.");
  }

  function bindingMarkup(entry) {
    const plc = entry.plcFault;
    return `<section class="sf-result-section sf-plc-binding" data-topmodul-plc-binding>
      <h4>TopModul PLC binding</h4>
      <div class="sf-plc-binding-grid">
        <div class="sf-plc-binding-cell"><small>Fault</small><strong>${esc(entry.code)}</strong></div>
        <div class="sf-plc-binding-cell"><small>PLC source</small><code>${esc(plc.address)}</code></div>
        <div class="sf-plc-binding-cell"><small>Scope</small><strong>${esc(entry.diagnosticScope || (plc.station ? "Station" : "Labeler"))}</strong></div>
        <div class="sf-plc-binding-cell"><small>Instance</small><strong>${plc.station ? `Station ${esc(plc.station)}` : "Main Labeler"}</strong></div>
        <div class="sf-plc-binding-cell"><small>Diagnostic family</small><strong>${esc(plc.family)}</strong></div>
      </div>
      <p class="sf-trace-status"><strong>Trace status:</strong> ${esc(traceStatusLabel(entry.stationControllerTrace?.traceStatus || plc.traceStatus))}</p>
    </section>`;
  }

  function stationTraceMarkup(entry) {
    const trace = entry.stationControllerTrace;
    if (!trace) return "";
    return `<section class="sf-result-section sf-station-controller-trace" data-topmodul-station-controller-trace>
      <h4>Station controller → Labeler fault path</h4>
      <div class="sf-station-trace-path">
        ${trace.directTriggerTag ? `<div class="sf-station-trace-step"><small>Controller trigger</small><code>${esc(trace.directTriggerTag)}</code></div>` : ""}
        <div class="sf-station-trace-step"><small>Local cart fault</small><code>${esc(trace.localFaultAddress)} — Fault ${esc(trace.localFaultNumber)}</code></div>
        <div class="sf-station-trace-step"><small>Cart transfer</small><code>${esc(trace.cartDataWord)}</code></div>
        <div class="sf-station-trace-step"><small>Labeler receive</small><code>${esc(trace.labelerReceiveWord)}</code></div>
        <div class="sf-station-trace-step"><small>Block copy</small><code>${esc(trace.labelerCopy)}</code></div>
        ${trace.labelerFaultAddress ? `<div class="sf-station-trace-step"><small>Labeler fault bit</small><code>${esc(trace.labelerFaultAddress)}</code></div>` : ""}
      </div>
      <p class="sf-trace-status">The transport path is PLC-source evidence, not a recommendation to force or bypass any bit. Use normal diagnostics and approved safe-work procedures.</p>
    </section>`;
  }

  function relatedMarkup(drillDown) {
    if (!drillDown?.related?.length) return "";
    return `<section class="sf-result-section sf-related-faults" data-topmodul-related-faults>
      <h4>Drill down — related PLC faults</h4>
      <p class="sf-trace-status">${esc(drillDown.prompt)}</p>
      <div class="sf-related-fault-grid">${drillDown.related.map((entry) => `
        <button type="button" class="sf-related-fault" data-topmodul-open-fault="${esc(entry.code)}">
          <span class="sf-related-fault-code">${esc(entry.code)}</span>
          <span class="sf-related-fault-copy"><strong>${esc(entry.title)}</strong><span>${esc(entry.relationReason)}</span></span>
          <span class="sf-related-fault-arrow" aria-hidden="true">›</span>
        </button>
      `).join("")}</div>
    </section>`;
  }

  function currentPlcEntry(result, library) {
    const category = result.querySelector(".sf-entry-category")?.textContent || "";
    if (!/^TopModul PLC\s*\//i.test(category.trim())) return null;
    const code = result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
    return library.getTopModulFault?.(code) || null;
  }

  function render() {
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getTopModulFaultDrillDown || !result || result.hidden) return;
    const entry = currentPlcEntry(result, library);
    if (!entry) return;
    if (result.dataset.topmodulDrilldownEntry === entry.id && result.querySelector("[data-topmodul-plc-binding]")) return;
    result.dataset.topmodulDrilldownEntry = entry.id;
    result.querySelectorAll("[data-topmodul-plc-binding],[data-topmodul-station-controller-trace],[data-topmodul-related-faults]").forEach((node) => node.remove());
    const drillDown = library.getTopModulFaultDrillDown(entry, 8);
    const summary = result.querySelector(".sf-result-summary");
    if (!summary) return;
    summary.insertAdjacentHTML("afterend", `${bindingMarkup(entry)}${stationTraceMarkup(entry)}${relatedMarkup(drillDown)}`);
  }

  function openFault(code) {
    const search = document.getElementById("faultSearch");
    const searchButton = document.getElementById("faultSearchButton");
    if (!search || !searchButton) return;
    search.value = String(code || "");
    searchButton.click();
  }

  function initialize() {
    installStyles();
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    result.addEventListener("click", (event) => {
      const button = event.target.closest("[data-topmodul-open-fault]");
      if (!button) return;
      openFault(button.dataset.topmodulOpenFault);
    });
    const observer = new MutationObserver(() => render());
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    render();
    global.ServoForgeTopModulFaultDrillDownUi = Object.freeze({ render, openFault });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})(window);
