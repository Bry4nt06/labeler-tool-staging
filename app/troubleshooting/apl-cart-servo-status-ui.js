"use strict";

(function installAplCartServoStatusUi(global) {
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
    if (document.getElementById("sfAplCartServoStatusStyles")) return;
    const style = document.createElement("style");
    style.id = "sfAplCartServoStatusStyles";
    style.textContent = `
      .sf-apl-servo{display:grid;gap:12px}
      .sf-apl-servo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
      .sf-apl-servo-cell,.sf-apl-servo-watch-row,.sf-apl-servo-observation,.sf-apl-servo-map-row,.sf-apl-servo-hardware-row{padding:9px 10px;border:1px solid var(--line);border-radius:7px;background:var(--input);display:grid;gap:4px}
      .sf-apl-servo-cell small,.sf-apl-servo-watch-row small,.sf-apl-servo-observation small,.sf-apl-servo-map-row small,.sf-apl-servo-hardware-row small{color:var(--muted);line-height:1.4}
      .sf-apl-servo-cell code,.sf-apl-servo-watch-row code,.sf-apl-servo-map-row code,.sf-apl-servo-hardware-row code{overflow-wrap:anywhere}
      .sf-apl-servo-watch,.sf-apl-servo-steps,.sf-apl-servo-map,.sf-apl-servo-hardware{display:grid;gap:7px}
      .sf-apl-servo-step{display:grid;grid-template-columns:26px 1fr;gap:8px;padding:8px 9px;border:1px solid var(--line);border-radius:7px;background:var(--input)}
      .sf-apl-servo-step>strong:first-child{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--line)}
      .sf-apl-servo-step span{display:grid;gap:3px}.sf-apl-servo-step small{color:var(--muted);line-height:1.4}
      .sf-apl-servo-choice-row{display:flex;flex-wrap:wrap;gap:6px}.sf-apl-servo-choice-row button{padding:7px 9px}
      .sf-apl-servo-choice-row button[aria-pressed="true"]{border-color:var(--green);box-shadow:inset 0 0 0 1px rgba(65,200,137,.25)}
      .sf-apl-servo-evaluation{padding:10px 11px;border-left:3px solid var(--line);background:var(--input);border-radius:5px;display:grid;gap:5px}
      .sf-apl-servo-evaluation[data-severity="direct"]{border-left-color:var(--green)}.sf-apl-servo-evaluation[data-severity="hold"]{border-left-color:#d99a3b}
      .sf-apl-servo-evaluation p,.sf-apl-servo-evaluation small{margin:0;line-height:1.45}.sf-apl-servo-evaluation small{color:var(--muted)}
      .sf-apl-servo-source,.sf-apl-servo-boundary{font-size:11px;color:var(--muted);line-height:1.45}
      @media print{.sf-apl-servo-choice-row{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function resultCode(result) {
    return result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
  }

  function choiceButton(plan, group, option, selected) {
    return `<button type="button" class="secondary-button" data-apl-servo-plan="${esc(plan.id)}" data-apl-servo-group="${esc(group)}" data-apl-servo-value="${esc(option.value)}" aria-pressed="${selected === option.value ? "true" : "false"}">${esc(option.label)}</button>`;
  }

  function observationMarkup(plan) {
    const observation = state.get(plan.id) || {};
    const groups = (plan.observations || []).map((group) => `<div><small>${esc(group.prompt)}</small><div class="sf-apl-servo-choice-row">${group.choices.map((option) => choiceButton(plan, group.key, option, observation[group.key])).join("")}</div></div>`).join("");
    const evaluation = global.ServoForgeTroubleshootingLibrary?.evaluateAplCartServoStatus?.(plan.number, observation);
    return `<div class="sf-apl-servo-observation">
      <strong>Read-only live isolation</strong>
      <small>These buttons only interpret states you observed in normal HMI/PLC/motion-axis diagnostics. They do not write, force, reset, bypass, or change any axis/fault status.</small>
      ${groups || `<small>This source position is inactive in the supplied Cart 1 revision, so no live producer button is promoted.</small>`}
      ${evaluation ? `<div class="sf-apl-servo-evaluation" data-severity="${esc(evaluation.severity || "observe")}"><strong>${esc(evaluation.title)}</strong><p>${esc(evaluation.summary)}</p>${evaluation.next ? `<small><strong>Next:</strong> ${esc(evaluation.next)}</small>` : ""}</div>` : ""}
    </div>`;
  }

  function mapMarkup(plan) {
    return `<div class="sf-apl-servo-map"><strong>Cart-local → base-Labeler Station destinations</strong>${(plan.stationGlobalMap || []).map((row) => `<div class="sf-apl-servo-map-row"><strong>Station ${esc(row.station)} — ${esc(row.globalCode || row.globalNumber)}</strong><code>${esc(row.globalAddress || "address unavailable")}</code><small>${esc(row.title)}</small></div>`).join("")}</div>`;
  }

  function hardwareMarkup(plan) {
    if (!plan.circuitTrace) return `<div class="sf-apl-servo-hardware"><strong>Hardware route</strong><div class="sf-apl-servo-hardware-row"><small>No active hardware route is promoted because this alarm position is disabled in the supplied Cart 1 revision.</small></div></div>`;
    const devices = (plan.circuitTrace.deviceRows || []).map((row) => `<div class="sf-apl-servo-hardware-row"><strong>${esc(row.device)}</strong><small>${esc(row.description)}</small>${row.cable ? `<code>${esc(row.cable)}</code>` : ""}<small>${esc(row.terminals || "")}</small></div>`).join("");
    const pages = (plan.circuitTrace.drawingLocations || []).map((row) => `PDF ${row.pdfPage} / ${row.sheet || ""} ${row.section || ""}`).join(" • ");
    return `<div class="sf-apl-servo-hardware"><strong>Shared Station servo circuit authority</strong>${devices}<div class="sf-apl-servo-hardware-row"><small>${esc(pages)}</small></div></div>`;
  }

  function markup(plan) {
    return `<section class="sf-result-section sf-apl-servo" data-apl-cart-servo="${esc(plan.id)}">
      <h4>APL Cart local servo-axis source bridge</h4>
      <div class="sf-apl-servo-grid">
        <div class="sf-apl-servo-cell"><small>Cart-local HMI</small><strong>${esc(plan.code)} — ${esc(plan.title)}</strong></div>
        <div class="sf-apl-servo-cell"><small>Verified scope</small><strong>${esc(plan.scope)}</strong></div>
        <div class="sf-apl-servo-cell"><small>Source status</small><strong>${esc(plan.status)}</strong></div>
        <div class="sf-apl-servo-cell"><small>Local fault bit</small><code>${esc(plan.localAddress)}</code></div>
        <div class="sf-apl-servo-cell"><small>Direct producer</small><code>${esc(plan.producer)}</code></div>
        <div class="sf-apl-servo-cell"><small>Shared method</small><code>${esc(plan.sharedStationTemplateId)}</code></div>
      </div>
      <div class="sf-apl-servo-steps">${(plan.steps || []).map((row) => `<div class="sf-apl-servo-step"><strong>${esc(row.order)}</strong><span><strong>${esc(row.label)}</strong><small>${esc(row.detail)}</small></span></div>`).join("")}</div>
      <div class="sf-apl-servo-watch"><strong>Watch these values before hardware replacement</strong>${(plan.watchPoints || []).map((row) => `<div class="sf-apl-servo-watch-row"><code>${esc(row.tag)}</code><strong>${esc(row.role)}</strong><small>${esc(row.relationship)}</small><small>${esc(row.interpretation)}</small>${row.caution ? `<small><strong>Caution:</strong> ${esc(row.caution)}</small>` : ""}</div>`).join("")}</div>
      ${observationMarkup(plan)}
      ${mapMarkup(plan)}
      ${hardwareMarkup(plan)}
      <div class="sf-apl-servo-source"><strong>PLC authority:</strong> ${esc(plan.source?.file || "CO85_LB1_APLCart_1.L5K")} • ${esc((plan.sourceRefs || []).join(" • "))}</div>
      <div class="sf-apl-servo-boundary"><strong>Namespace boundary:</strong> ${esc(plan.namespaceBoundary)} <strong>Revision boundary:</strong> This release proves LB1 APL Cart 1 from the supplied readable export; do not assume Cart 2-6, LB2, or another controller revision is identical. ${esc((plan.safety || []).join(" "))}</div>
    </section>`;
  }

  function render() {
    renderQueued = false;
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getAplCartServoStatusPlan || !result || result.hidden) return;
    const plan = library.getAplCartServoStatusPlan(resultCode(result));
    const existing = result.querySelector("[data-apl-cart-servo]");
    if (!plan) { existing?.remove(); return; }
    if (existing?.dataset.aplCartServo === plan.id) return;
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
    const existing = result.querySelector("[data-apl-cart-servo]");
    if (existing?.dataset.aplCartServo === plan.id) existing.outerHTML = markup(plan);
    else render();
  }

  function install() {
    installStyles();
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(scheduleRender);
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    result.addEventListener("click", (event) => {
      const button = event.target.closest("[data-apl-servo-group]");
      if (!button) return;
      const library = global.ServoForgeTroubleshootingLibrary;
      const plan = library?.getAplCartServoStatusPlan?.(resultCode(result));
      if (!plan) return;
      const next = { ...(state.get(plan.id) || {}) };
      next[button.dataset.aplServoGroup] = button.dataset.aplServoValue;
      state.set(plan.id, next);
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
