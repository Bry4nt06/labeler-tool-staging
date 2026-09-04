"use strict";

(function installAplCartWebHandlingUi(global) {
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
    if (document.getElementById("sfAplCartWebStyles")) return;
    const style = document.createElement("style");
    style.id = "sfAplCartWebStyles";
    style.textContent = `
      .sf-apl-web{display:grid;gap:12px}
      .sf-apl-web-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
      .sf-apl-web-cell,.sf-apl-web-watch-row,.sf-apl-web-observation{padding:9px 10px;border:1px solid var(--line);border-radius:7px;background:var(--input);display:grid;gap:4px}
      .sf-apl-web-cell small,.sf-apl-web-watch-row small,.sf-apl-web-observation small{color:var(--muted);line-height:1.4}
      .sf-apl-web-cell code,.sf-apl-web-watch-row code{overflow-wrap:anywhere}
      .sf-apl-web-watch,.sf-apl-web-steps{display:grid;gap:7px}
      .sf-apl-web-step{display:grid;grid-template-columns:26px 1fr;gap:8px;padding:8px 9px;border:1px solid var(--line);border-radius:7px;background:var(--input)}
      .sf-apl-web-step>strong:first-child{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--line)}
      .sf-apl-web-step span{display:grid;gap:3px}.sf-apl-web-step small{color:var(--muted);line-height:1.4}
      .sf-apl-web-choice-row{display:flex;flex-wrap:wrap;gap:6px}.sf-apl-web-choice-row button{padding:7px 9px}
      .sf-apl-web-choice-row button[aria-pressed="true"]{border-color:var(--green);box-shadow:inset 0 0 0 1px rgba(65,200,137,.25)}
      .sf-apl-web-evaluation{padding:10px 11px;border-left:3px solid var(--line);background:var(--input);border-radius:5px;display:grid;gap:5px}
      .sf-apl-web-evaluation[data-severity="direct"]{border-left-color:var(--green)}.sf-apl-web-evaluation[data-severity="hold"]{border-left-color:#d99a3b}
      .sf-apl-web-evaluation p,.sf-apl-web-evaluation small{margin:0;line-height:1.45}.sf-apl-web-evaluation small{color:var(--muted)}
      .sf-apl-web-source,.sf-apl-web-boundary{font-size:11px;color:var(--muted);line-height:1.45}
      @media print{.sf-apl-web-choice-row{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function resultCode(result) { return result.querySelector(".sf-result-head h2")?.textContent?.trim() || ""; }

  function choiceButton(plan, group, option, selected) {
    return `<button type="button" class="secondary-button" data-apl-web-plan="${esc(plan.id)}" data-apl-web-group="${esc(group)}" data-apl-web-value="${esc(option.value)}" aria-pressed="${selected === option.value ? "true" : "false"}">${esc(option.label)}</button>`;
  }

  function observationMarkup(plan) {
    const observation = state.get(plan.id) || {};
    const groups = (plan.observations || []).map((group) => `<div><small>${esc(group.prompt)}</small><div class="sf-apl-web-choice-row">${group.choices.map((option) => choiceButton(plan, group.key, option, observation[group.key])).join("")}</div></div>`).join("");
    const evaluation = global.ServoForgeTroubleshootingLibrary?.evaluateAplCartWebHandling?.(plan.number, observation);
    return `<div class="sf-apl-web-observation">
      <strong>Read-only live isolation</strong>
      <small>These buttons only interpret states you observed in the HMI/PLC/axis diagnostics. They do not write, force, reset, bypass, or change source timers/counters/thresholds.</small>
      ${groups || `<small>No interactive producer is shown because this source entry is intentionally unresolved.</small>`}
      ${evaluation ? `<div class="sf-apl-web-evaluation" data-severity="${esc(evaluation.severity || "observe")}"><strong>${esc(evaluation.title)}</strong><p>${esc(evaluation.summary)}</p>${evaluation.next ? `<small><strong>Next:</strong> ${esc(evaluation.next)}</small>` : ""}</div>` : ""}
    </div>`;
  }

  function markup(plan) {
    return `<section class="sf-result-section sf-apl-web" data-apl-cart-web="${esc(plan.id)}">
      <h4>APL Cart label-web / encoder source isolation</h4>
      <div class="sf-apl-web-grid">
        <div class="sf-apl-web-cell"><small>Verified scope</small><strong>${esc(plan.scope)}</strong></div>
        <div class="sf-apl-web-cell"><small>Fault family</small><strong>${esc(plan.family)}</strong></div>
        <div class="sf-apl-web-cell"><small>Source status</small><strong>${esc(plan.status)}</strong></div>
        <div class="sf-apl-web-cell"><small>Producer</small><code>${esc(plan.producer)}</code></div>
      </div>
      <div class="sf-apl-web-steps">${(plan.steps || []).map((row) => `<div class="sf-apl-web-step"><strong>${esc(row.order)}</strong><span><strong>${esc(row.label)}</strong><small>${esc(row.detail)}</small></span></div>`).join("")}</div>
      <div class="sf-apl-web-watch"><strong>Watch these values before hardware replacement</strong>${(plan.watchPoints || []).map((row) => `<div class="sf-apl-web-watch-row"><code>${esc(row.tag)}</code><strong>${esc(row.role)}</strong><small>${esc(row.relationship)}</small><small>${esc(row.interpretation)}</small>${row.caution ? `<small><strong>Caution:</strong> ${esc(row.caution)}</small>` : ""}</div>`).join("")}</div>
      ${observationMarkup(plan)}
      <div class="sf-apl-web-source"><strong>PLC authority:</strong> ${esc(plan.source?.file || "CO85_LB1_APLCart_1.L5K")} • ${esc((plan.sourceRefs || []).join(" • "))}</div>
      <div class="sf-apl-web-boundary"><strong>Scope boundary:</strong> This release proves LB1 APL Cart 1 from the supplied readable export. Do not assume Cart 2-6, LB2, or another software revision is identical without readable source verification. ${esc((plan.safety || []).join(" "))}</div>
    </section>`;
  }

  function render() {
    renderQueued = false;
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getAplCartWebHandlingPlan || !result || result.hidden) return;
    const plan = library.getAplCartWebHandlingPlan(resultCode(result));
    const existing = result.querySelector("[data-apl-cart-web]");
    if (!plan) { existing?.remove(); return; }
    if (existing?.dataset.aplCartWeb === plan.id) return;
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
    const existing = result.querySelector("[data-apl-cart-web]");
    if (existing?.dataset.aplCartWeb === plan.id) existing.outerHTML = markup(plan);
    else render();
  }

  function install() {
    installStyles();
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(scheduleRender);
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    result.addEventListener("click", (event) => {
      const button = event.target.closest("[data-apl-web-group]");
      if (!button) return;
      const library = global.ServoForgeTroubleshootingLibrary;
      const plan = library?.getAplCartWebHandlingPlan?.(resultCode(result));
      if (!plan) return;
      const next = { ...(state.get(plan.id) || {}) };
      next[button.dataset.aplWebGroup] = button.dataset.aplWebValue;
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
