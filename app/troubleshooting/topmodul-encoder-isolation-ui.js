"use strict";

(function installTopModulEncoderIsolationUi(global) {
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
    if (document.getElementById("sfTopModulEncoderIsolationStyles")) return;
    const style = document.createElement("style");
    style.id = "sfTopModulEncoderIsolationStyles";
    style.textContent = `
      .sf-encoder-isolation { display:grid; gap:12px; }
      .sf-encoder-scope-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; }
      .sf-encoder-scope-cell { padding:9px 10px; border:1px solid var(--line); border-radius:7px; background:var(--input); display:grid; gap:4px; }
      .sf-encoder-scope-cell small { color:var(--muted); text-transform:uppercase; letter-spacing:.05em; font-size:9px; }
      .sf-encoder-scope-cell code,.sf-encoder-scope-cell strong { overflow-wrap:anywhere; }
      .sf-encoder-steps { display:grid; gap:7px; }
      .sf-encoder-step { display:grid; grid-template-columns:26px 1fr; gap:8px; padding:8px 9px; border:1px solid var(--line); border-radius:7px; background:var(--input); }
      .sf-encoder-step > strong:first-child { width:24px; height:24px; border-radius:999px; display:grid; place-items:center; border:1px solid var(--line); }
      .sf-encoder-step span { display:grid; gap:3px; }
      .sf-encoder-step small { color:var(--muted); line-height:1.4; }
      .sf-encoder-observation { display:grid; gap:8px; padding:10px; border:1px solid var(--line); border-radius:7px; }
      .sf-encoder-choice-row { display:flex; flex-wrap:wrap; gap:6px; }
      .sf-encoder-choice-row button { padding:7px 9px; }
      .sf-encoder-choice-row button[aria-pressed="true"] { border-color:var(--green); box-shadow:inset 0 0 0 1px rgba(65,200,137,.25); }
      .sf-encoder-evaluation { padding:10px 11px; border-left:3px solid var(--line); background:var(--input); border-radius:5px; display:grid; gap:5px; }
      .sf-encoder-evaluation[data-severity="direct"] { border-left-color:var(--green); }
      .sf-encoder-evaluation[data-severity="hold"] { border-left-color:#d99a3b; }
      .sf-encoder-evaluation p,.sf-encoder-evaluation small { margin:0; line-height:1.45; }
      .sf-encoder-evaluation small { color:var(--muted); }
      .sf-encoder-siblings { display:flex; flex-wrap:wrap; gap:6px; }
      .sf-encoder-sibling { border:1px solid var(--line); border-radius:999px; padding:5px 8px; background:var(--input); font-size:10px; }
      button.sf-encoder-sibling { cursor:pointer; color:var(--ink); }
      .sf-encoder-boundary { font-size:11px; color:var(--muted); line-height:1.45; }
      @media print { .sf-encoder-choice-row { display:none !important; } }
    `;
    document.head.appendChild(style);
  }

  function resultCode(result) {
    return result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
  }

  function choiceButton(group, value, label, selected) {
    return `<button type="button" class="secondary-button" data-encoder-group="${esc(group)}" data-encoder-value="${esc(value)}" aria-pressed="${selected === value ? "true" : "false"}">${esc(label)}</button>`;
  }

  function evaluationMarkup(plan, observation) {
    const result = plan.evaluate(observation || {});
    if (!result) return "";
    return `<div class="sf-encoder-evaluation" data-severity="${esc(result.severity || "observe")}">
      <strong>${esc(result.title)}</strong>
      <p>${esc(result.summary)}</p>
      ${result.next ? `<small><strong>Next:</strong> ${esc(result.next)}</small>` : ""}
    </div>`;
  }

  function observationsMarkup(plan, observation) {
    if (plan.localOffset === 67) {
      return `<div class="sf-encoder-observation">
        <strong>Observed machine state</strong>
        <small>Use actual machine/axis diagnostics. These buttons do not write to the PLC.</small>
        <div><small>Is actual Station/base-machine encoder motion occurring?</small><div class="sf-encoder-choice-row">
          ${choiceButton("motion", "yes", "Motion present", observation.motion)}
          ${choiceButton("motion", "no", "No motion", observation.motion)}
          ${choiceButton("motion", "unknown", "Not verified", observation.motion)}
        </div></div>
        <div><small>What is the AQB feedback doing?</small><div class="sf-encoder-choice-row">
          ${choiceButton("feedback", "changing", "Changing", observation.feedback)}
          ${choiceButton("feedback", "frozen", "Frozen / absent", observation.feedback)}
          ${choiceButton("feedback", "intermittent", "Intermittent / noisy", observation.feedback)}
          ${choiceButton("feedback", "unknown", "Not verified", observation.feedback)}
        </div></div>
        ${evaluationMarkup(plan, observation)}
      </div>`;
    }
    if (plan.entry?.number === 670) {
      return `<div class="sf-encoder-observation">
        <strong>Observed main-machine state</strong>
        <small>Use normal drive/encoder diagnostics only. No force or bypass action is performed.</small>
        <div><small>Is actual main-machine motion occurring?</small><div class="sf-encoder-choice-row">
          ${choiceButton("motion", "yes", "Motion present", observation.motion)}
          ${choiceButton("motion", "no", "No motion", observation.motion)}
          ${choiceButton("motion", "unknown", "Not verified", observation.motion)}
        </div></div>
        <div><small>What is the fine-clock input doing?</small><div class="sf-encoder-choice-row">
          ${choiceButton("fineClock", "changing", "Pulses changing", observation.fineClock)}
          ${choiceButton("fineClock", "absent", "Absent / frozen", observation.fineClock)}
          ${choiceButton("fineClock", "unknown", "Not verified", observation.fineClock)}
        </div></div>
        ${evaluationMarkup(plan, observation)}
      </div>`;
    }
    return `<div class="sf-encoder-observation">${evaluationMarkup(plan, observation)}</div>`;
  }

  function siblingMarkup(plan) {
    const rows = plan.siblings || [];
    if (!rows.length) return "";
    return `<div><strong>Encoder-family cross-check</strong><div class="sf-encoder-siblings">${rows.map((row) => {
      const label = row.number ? `${row.number} · ${row.title}` : `Local ${row.localCode} · ${row.title}`;
      return row.number
        ? `<button type="button" class="sf-encoder-sibling" data-encoder-open-fault="${esc(row.number)}">${esc(label)}</button>`
        : `<span class="sf-encoder-sibling">${esc(label)}</span>`;
    }).join("")}</div></div>`;
  }

  function markup(plan) {
    const observation = state.get(plan.id) || {};
    return `<section class="sf-result-section sf-encoder-isolation" data-topmodul-encoder-isolation="${esc(plan.id)}">
      <h4>Encoder isolation — verified scope</h4>
      <div class="sf-encoder-scope-grid">
        <div class="sf-encoder-scope-cell"><small>Scope</small><strong>${esc(plan.scope)}</strong></div>
        <div class="sf-encoder-scope-cell"><small>Station</small><strong>${esc(plan.station || "Shared / identify cart")}</strong></div>
        <div class="sf-encoder-scope-cell"><small>Subtype</small><strong>${esc(plan.subtype?.label || "Encoder supervision")}</strong></div>
        <div class="sf-encoder-scope-cell"><small>Direct producer</small><code>${esc(plan.producer)}</code></div>
      </div>
      <div class="sf-encoder-steps">${(plan.steps || []).map((step) => `<div class="sf-encoder-step"><strong>${esc(step.order)}</strong><span><strong>${esc(step.label)}</strong><small>${esc(step.detail)}</small></span></div>`).join("")}</div>
      ${observationsMarkup(plan, observation)}
      ${siblingMarkup(plan)}
      <div class="sf-encoder-boundary"><strong>Boundary:</strong> ${esc((plan.safety || []).join(" "))}</div>
    </section>`;
  }

  function resolvePlan(result, library) {
    const code = resultCode(result);
    if (!code) return null;
    return library.getTopModulEncoderIsolationPlan?.(code) || null;
  }

  function render() {
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getTopModulEncoderIsolationPlan || !result || result.hidden) return;
    const plan = resolvePlan(result, library);
    const existing = result.querySelector("[data-topmodul-encoder-isolation]");
    if (!plan) {
      existing?.remove();
      return;
    }
    if (existing?.dataset.topmodulEncoderIsolation === plan.id) {
      existing.outerHTML = markup(plan);
      return;
    }
    existing?.remove();
    const anchor = result.querySelector("[data-topmodul-process-trace]")
      || result.querySelector("[data-topmodul-cause-evidence]")
      || result.querySelector("[data-topmodul-plc-binding]")
      || result.querySelector(".sf-result-summary");
    if (anchor) anchor.insertAdjacentHTML("afterend", markup(plan));
  }

  function openFault(number) {
    const input = document.getElementById("faultSearch");
    const button = document.getElementById("faultSearchButton");
    if (!input || !button) return;
    input.value = String(number);
    button.click();
  }

  function install() {
    installStyles();
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(() => queueMicrotask(render));
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    result.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-encoder-group]");
      if (choice) {
        const library = global.ServoForgeTroubleshootingLibrary;
        const plan = resolvePlan(result, library);
        if (!plan) return;
        const next = { ...(state.get(plan.id) || {}) };
        next[choice.dataset.encoderGroup] = choice.dataset.encoderValue;
        state.set(plan.id, next);
        render();
        return;
      }
      const fault = event.target.closest("[data-encoder-open-fault]");
      if (fault) openFault(fault.dataset.encoderOpenFault);
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-entry],[data-topmodul-open-fault],#faultSearchButton,.sf-search-result")) setTimeout(render, 0);
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);
