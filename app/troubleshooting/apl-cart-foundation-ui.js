"use strict";

(function installAplCartFoundationUi(global) {
  const state = new Map();

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installStyles() {
    if (document.getElementById("sfAplCartFoundationStyles")) return;
    const style = document.createElement("style");
    style.id = "sfAplCartFoundationStyles";
    style.textContent = `
      .sf-apl-cart-foundation{display:grid;gap:12px}
      .sf-apl-cart-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
      .sf-apl-cart-cell,.sf-apl-cart-watch-row,.sf-apl-cart-observation{padding:9px 10px;border:1px solid var(--line);border-radius:7px;background:var(--input);display:grid;gap:4px}
      .sf-apl-cart-cell small,.sf-apl-cart-watch-row small,.sf-apl-cart-observation small{color:var(--muted);line-height:1.4}
      .sf-apl-cart-cell code,.sf-apl-cart-watch-row code{overflow-wrap:anywhere}
      .sf-apl-cart-watch,.sf-apl-cart-steps{display:grid;gap:7px}
      .sf-apl-cart-step{display:grid;grid-template-columns:26px 1fr;gap:8px;padding:8px 9px;border:1px solid var(--line);border-radius:7px;background:var(--input)}
      .sf-apl-cart-step>strong:first-child{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--line)}
      .sf-apl-cart-step span{display:grid;gap:3px}
      .sf-apl-cart-step small{color:var(--muted);line-height:1.4}
      .sf-apl-cart-observation{gap:9px}
      .sf-apl-cart-choice-row{display:flex;flex-wrap:wrap;gap:6px}
      .sf-apl-cart-choice-row button{padding:7px 9px}
      .sf-apl-cart-choice-row button[aria-pressed="true"]{border-color:var(--green);box-shadow:inset 0 0 0 1px rgba(65,200,137,.25)}
      .sf-apl-cart-evaluation{padding:10px 11px;border-left:3px solid var(--line);background:var(--input);border-radius:5px;display:grid;gap:5px}
      .sf-apl-cart-evaluation[data-severity="direct"]{border-left-color:var(--green)}
      .sf-apl-cart-evaluation[data-severity="hold"]{border-left-color:#d99a3b}
      .sf-apl-cart-evaluation p,.sf-apl-cart-evaluation small{margin:0;line-height:1.45}
      .sf-apl-cart-evaluation small{color:var(--muted)}
      .sf-apl-cart-source,.sf-apl-cart-boundary{font-size:11px;color:var(--muted);line-height:1.45}
      @media print{.sf-apl-cart-choice-row{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function resultCode(result) {
    return result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
  }

  function choiceButton(plan, group, option, selected) {
    return `<button type="button" class="secondary-button" data-apl-cart-plan="${esc(plan.id)}" data-apl-cart-group="${esc(group)}" data-apl-cart-value="${esc(option.value)}" aria-pressed="${selected === option.value ? "true" : "false"}">${esc(option.label)}</button>`;
  }

  function observationMarkup(plan) {
    const observation = state.get(plan.id) || {};
    const groups = (plan.observations || []).map((group) => `<div><small>${esc(group.prompt)}</small><div class="sf-apl-cart-choice-row">${group.choices.map((option) => choiceButton(plan, group.key, option, observation[group.key])).join("")}</div></div>`).join("");
    const evaluation = global.ServoForgeTroubleshootingLibrary?.evaluateAplCartFoundation?.(plan.number, observation);
    return `<div class="sf-apl-cart-observation">
      <strong>Read-only live isolation</strong>
      <small>These controls interpret observed PLC states only. They do not write, force, reset, bypass, or change timers/thresholds.</small>
      ${groups || `<small>This source entry intentionally has no interactive producer because the executable source chain is unresolved.</small>`}
      ${evaluation ? `<div class="sf-apl-cart-evaluation" data-severity="${esc(evaluation.severity || "observe")}"><strong>${esc(evaluation.title)}</strong><p>${esc(evaluation.summary)}</p>${evaluation.next ? `<small><strong>Next:</strong> ${esc(evaluation.next)}</small>` : ""}</div>` : ""}
    </div>`;
  }

  function markup(plan) {
    return `<section class="sf-result-section sf-apl-cart-foundation" data-apl-cart-foundation="${esc(plan.id)}">
      <h4>APL Cart source isolation</h4>
      <div class="sf-apl-cart-grid">
        <div class="sf-apl-cart-cell"><small>Verified scope</small><strong>${esc(plan.scope)}</strong></div>
        <div class="sf-apl-cart-cell"><small>Fault family</small><strong>${esc(plan.family)}</strong></div>
        <div class="sf-apl-cart-cell"><small>Source status</small><strong>${esc(plan.status)}</strong></div>
        <div class="sf-apl-cart-cell"><small>Producer</small><code>${esc(plan.producer)}</code></div>
      </div>
      <div class="sf-apl-cart-steps">${(plan.steps || []).map((row) => `<div class="sf-apl-cart-step"><strong>${esc(row.order)}</strong><span><strong>${esc(row.label)}</strong><small>${esc(row.detail)}</small></span></div>`).join("")}</div>
      <div class="sf-apl-cart-watch"><strong>Watch these values before hardware replacement</strong>${(plan.watchPoints || []).map((row) => `<div class="sf-apl-cart-watch-row"><code>${esc(row.tag)}</code><strong>${esc(row.role)}</strong><small>${esc(row.relationship)}</small><small>${esc(row.interpretation)}</small>${row.caution ? `<small><strong>Caution:</strong> ${esc(row.caution)}</small>` : ""}</div>`).join("")}</div>
      ${observationMarkup(plan)}
      <div class="sf-apl-cart-source"><strong>PLC authority:</strong> ${esc(plan.source?.file || "")} • ${esc(plan.source?.controller || "")} • ${esc((plan.sourceRefs || []).join(" • "))}</div>
      <div class="sf-apl-cart-boundary"><strong>Scope boundary:</strong> This release verifies LB1 APL Cart 1 from the supplied readable export. Do not assume another Cart/controller revision is identical without source verification. ${esc((plan.safety || []).join(" "))}</div>
    </section>`;
  }

  function render() {
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getAplCartFoundationPlan || !result || result.hidden) return;
    const plan = library.getAplCartFoundationPlan(resultCode(result));
    const existing = result.querySelector("[data-apl-cart-foundation]");
    if (!plan) {
      existing?.remove();
      return;
    }
    if (existing?.dataset.aplCartFoundation === plan.id) return;
    existing?.remove();
    const anchor = result.querySelector(".sf-result-summary");
    if (anchor) anchor.insertAdjacentHTML("afterend", markup(plan));
  }

  function refresh(plan) {
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const existing = result.querySelector("[data-apl-cart-foundation]");
    if (existing?.dataset.aplCartFoundation === plan.id) existing.outerHTML = markup(plan);
    else render();
  }

  function install() {
    installStyles();
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(() => queueMicrotask(render));
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    result.addEventListener("click", (event) => {
      const button = event.target.closest("[data-apl-cart-group]");
      if (!button) return;
      const library = global.ServoForgeTroubleshootingLibrary;
      const plan = library?.getAplCartFoundationPlan?.(resultCode(result));
      if (!plan) return;
      const next = { ...(state.get(plan.id) || {}) };
      next[button.dataset.aplCartGroup] = button.dataset.aplCartValue;
      state.set(plan.id, next);
      refresh(plan);
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-entry],#faultSearchButton,.sf-search-result")) setTimeout(render, 0);
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);
