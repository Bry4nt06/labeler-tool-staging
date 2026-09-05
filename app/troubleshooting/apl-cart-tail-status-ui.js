"use strict";

(function installAplCartTailStatusUi(global) {
  const state = new Map();
  let renderQueued = false;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installStyles() {
    if (document.getElementById("sfAplCartTailStyles")) return;
    const style = document.createElement("style");
    style.id = "sfAplCartTailStyles";
    style.textContent = `
      .sf-apl-tail{display:grid;gap:12px}
      .sf-apl-tail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
      .sf-apl-tail-cell,.sf-apl-tail-watch-row,.sf-apl-tail-observation,.sf-apl-tail-map-row,.sf-apl-tail-hardware-row{padding:9px 10px;border:1px solid var(--line);border-radius:7px;background:var(--input);display:grid;gap:4px}
      .sf-apl-tail-cell small,.sf-apl-tail-watch-row small,.sf-apl-tail-observation small,.sf-apl-tail-map-row small,.sf-apl-tail-hardware-row small{color:var(--muted);line-height:1.4}
      .sf-apl-tail-cell code,.sf-apl-tail-watch-row code,.sf-apl-tail-map-row code,.sf-apl-tail-hardware-row code{overflow-wrap:anywhere}
      .sf-apl-tail-watch,.sf-apl-tail-steps,.sf-apl-tail-map,.sf-apl-tail-hardware{display:grid;gap:7px}
      .sf-apl-tail-step{display:grid;grid-template-columns:26px 1fr;gap:8px;padding:8px 9px;border:1px solid var(--line);border-radius:7px;background:var(--input)}
      .sf-apl-tail-step>strong:first-child{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--line)}
      .sf-apl-tail-step span{display:grid;gap:3px}.sf-apl-tail-step small{color:var(--muted);line-height:1.4}
      .sf-apl-tail-choice-row{display:flex;flex-wrap:wrap;gap:6px}.sf-apl-tail-choice-row button{padding:7px 9px}
      .sf-apl-tail-choice-row button[aria-pressed="true"]{border-color:var(--green);box-shadow:inset 0 0 0 1px rgba(65,200,137,.25)}
      .sf-apl-tail-evaluation{padding:10px 11px;border-left:3px solid var(--line);background:var(--input);border-radius:5px;display:grid;gap:5px}
      .sf-apl-tail-evaluation[data-severity="direct"]{border-left-color:var(--green)}.sf-apl-tail-evaluation[data-severity="hold"]{border-left-color:#d99a3b}
      .sf-apl-tail-evaluation p,.sf-apl-tail-evaluation small{margin:0;line-height:1.45}.sf-apl-tail-evaluation small{color:var(--muted)}
      .sf-apl-tail-source,.sf-apl-tail-boundary{font-size:11px;color:var(--muted);line-height:1.45}
      @media print{.sf-apl-tail-choice-row{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function resultCode(result) {
    return result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
  }

  function evaluationMarkup(plan) {
    if (plan.status === "catalog-only-no-producer") {
      const evaluation = global.ServoForgeTroubleshootingLibrary?.evaluateAplCartTail?.(plan.number, {});
      return evaluation ? `<div class="sf-apl-tail-evaluation" data-severity="${esc(evaluation.severity)}"><strong>${esc(evaluation.title)}</strong><p>${esc(evaluation.summary)}</p><small><strong>Next:</strong> ${esc(evaluation.next)}</small></div>` : "";
    }
    const observation = state.get(plan.number) || {};
    const evaluation = global.ServoForgeTroubleshootingLibrary?.evaluateAplCartTail?.(plan.number, observation);
    return `<div class="sf-apl-tail-observation">
      <strong>Read-only live isolation</strong>
      <small>These controls only interpret what you observed in normal diagnostics. They do not write, force, reset, or bypass any PLC/motion state.</small>
      <div class="sf-apl-tail-choice-row">
        ${["yes","no","unknown"].map((value) => `<button type="button" class="secondary-button" data-apl-tail-number="${plan.number}" data-apl-tail-value="${value}" aria-pressed="${observation.producerActive === value ? "true" : "false"}">${value === "yes" ? "Producer/state active" : value === "no" ? "Producer/state clear" : "Not verified"}</button>`).join("")}
      </div>
      ${evaluation ? `<div class="sf-apl-tail-evaluation" data-severity="${esc(evaluation.severity || "observe")}"><strong>${esc(evaluation.title)}</strong><p>${esc(evaluation.summary)}</p>${evaluation.next ? `<small><strong>Next:</strong> ${esc(evaluation.next)}</small>` : ""}</div>` : ""}
    </div>`;
  }

  function mapMarkup(plan) {
    return `<div class="sf-apl-tail-map"><strong>Cart-local → base-Labeler Station destinations</strong>${(plan.stationGlobalMap || []).map((row) => `<div class="sf-apl-tail-map-row"><strong>Station ${esc(row.station)} — ${esc(row.globalCode || row.globalNumber)}</strong><code>${esc(row.globalAddress || "address unavailable")}</code><small>${esc(row.title)}</small></div>`).join("")}</div>`;
  }

  function hardwareMarkup(plan) {
    if (!plan.circuitTrace) return `<div class="sf-apl-tail-hardware"><strong>Hardware route</strong><div class="sf-apl-tail-hardware-row"><small>No hardware route is promoted for this source-gap position.</small></div></div>`;
    const devices = (plan.circuitTrace.deviceRows || []).map((row) => `<div class="sf-apl-tail-hardware-row"><strong>${esc(row.device)}</strong><small>${esc(row.description)}</small>${row.cable ? `<code>${esc(row.cable)}</code>` : ""}<small>${esc(row.terminals || "")}</small></div>`).join("");
    const pages = (plan.circuitTrace.drawingLocations || []).map((row) => `PDF ${row.pdfPage} / ${row.sheet || ""} ${row.section || ""}`).join(" • ");
    return `<div class="sf-apl-tail-hardware"><strong>Shared Station hardware authority</strong>${devices}<div class="sf-apl-tail-hardware-row"><small>${esc(pages)}</small></div></div>`;
  }

  function markup(plan) {
    return `<section class="sf-result-section sf-apl-tail" data-apl-cart-tail="${esc(plan.code)}">
      <h4>APL Cart rewind / base-encoder source bridge</h4>
      <div class="sf-apl-tail-grid">
        <div class="sf-apl-tail-cell"><small>Cart-local HMI</small><strong>${esc(plan.code)} — ${esc(plan.title)}</strong></div>
        <div class="sf-apl-tail-cell"><small>Verified scope</small><strong>${esc(plan.scope)}</strong></div>
        <div class="sf-apl-tail-cell"><small>Source status</small><strong>${esc(plan.status)}</strong></div>
        <div class="sf-apl-tail-cell"><small>Local fault bit</small><code>${esc(plan.localAddress)}</code></div>
        <div class="sf-apl-tail-cell"><small>Producer/state</small><code>${esc(plan.producer)}</code></div>
        <div class="sf-apl-tail-cell"><small>Shared method</small><code>${esc(plan.sharedStationTemplateId)}</code></div>
      </div>
      <div class="sf-apl-tail-steps">${(plan.steps || []).map((row) => `<div class="sf-apl-tail-step"><strong>${esc(row.order)}</strong><span><strong>${esc(row.label)}</strong><small>${esc(row.detail)}</small></span></div>`).join("")}</div>
      <div class="sf-apl-tail-watch"><strong>Watch these values before hardware replacement</strong>${(plan.watchPoints || []).map((row) => `<div class="sf-apl-tail-watch-row"><code>${esc(row.tag)}</code><strong>${esc(row.role)}</strong><small>${esc(row.relationship)}</small><small>${esc(row.interpretation)}</small>${row.caution ? `<small><strong>Caution:</strong> ${esc(row.caution)}</small>` : ""}</div>`).join("")}</div>
      ${evaluationMarkup(plan)}
      ${mapMarkup(plan)}
      ${hardwareMarkup(plan)}
      <div class="sf-apl-tail-source"><strong>PLC authority:</strong> ${esc(plan.source?.file || "CO85_LB1_APLCart_1.L5K")} • ${esc((plan.sourceRefs || []).join(" • "))}</div>
      <div class="sf-apl-tail-boundary"><strong>Namespace boundary:</strong> ${esc(plan.namespaceBoundary)} <strong>Revision boundary:</strong> LB1 APL Cart 1 is the readable authority; Cart 2-6, LB2, or another controller revision must be verified separately. ${esc((plan.safety || []).join(" "))}</div>
    </section>`;
  }

  function render() {
    renderQueued = false;
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getAplCartTailPlan || !result || result.hidden) return;
    const plan = library.getAplCartTailPlan(resultCode(result));
    const existing = result.querySelector("[data-apl-cart-tail]");
    if (!plan) { existing?.remove(); return; }
    if (existing?.dataset.aplCartTail === plan.code) return;
    existing?.remove();
    const anchor = result.querySelector(".sf-result-summary");
    if (anchor) anchor.insertAdjacentHTML("afterend", markup(plan));
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    global.setTimeout(render, 0);
  }

  function refresh(plan) {
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const existing = result.querySelector("[data-apl-cart-tail]");
    if (existing?.dataset.aplCartTail === plan.code) existing.outerHTML = markup(plan);
    else render();
  }

  function install() {
    installStyles();
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(scheduleRender);
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    result.addEventListener("click", (event) => {
      const button = event.target.closest("[data-apl-tail-number]");
      if (!button) return;
      const library = global.ServoForgeTroubleshootingLibrary;
      const plan = library?.getAplCartTailPlan?.(Number(button.dataset.aplTailNumber));
      if (!plan) return;
      state.set(plan.number, { producerActive: button.dataset.aplTailValue });
      refresh(plan);
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-entry],#faultSearchButton,.sf-search-result")) scheduleRender();
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);
