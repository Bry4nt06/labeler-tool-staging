"use strict";

(function installTopModulEncoderEvidenceUi(root) {
  if (!root?.document) return;

  const observationsByStation = new Map();
  let mainObservation = {};

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function ensureTarget() {
    const stackResults = document.getElementById("faultStackResults");
    if (!stackResults) return null;
    let target = document.getElementById("encoderEvidenceResults");
    if (!target) {
      target = document.createElement("section");
      target.id = "encoderEvidenceResults";
      target.className = "sf-encoder-evidence-results";
      target.hidden = true;
      stackResults.insertAdjacentElement("afterend", target);
    }
    return target;
  }

  function currentObservationMap() {
    const result = {};
    for (const [key, value] of observationsByStation.entries()) result[key] = { ...value };
    return result;
  }

  function openFault(number) {
    if (!number) return;
    const input = document.getElementById("faultSearch");
    const button = document.getElementById("faultSearchButton");
    if (!input || !button) return;
    input.value = String(number);
    button.click();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function candidateMarkup(candidate, index) {
    const code = candidate.number ? String(candidate.number) : `Local ${candidate.localCode}`;
    const observed = candidate.observed ? "Observed in stack" : "Sibling cross-check";
    const body = `<span class="sf-encoder-evidence-rank">${index === 0 ? "Highest current relevance" : `Rank ${index + 1}`} · score ${esc(candidate.score)}</span>
      <strong>${esc(code)} — ${esc(candidate.title)}</strong>
      <code>${esc(candidate.producer)}</code>
      <span class="sf-encoder-evidence-role">${esc(observed)}</span>
      <p>${esc(candidate.reasons.join(" "))}</p>
      <small><strong>Next:</strong> ${esc(candidate.nextCheck)}</small>`;
    return candidate.number
      ? `<button type="button" class="sf-encoder-evidence-card" data-encoder-evidence-open="${esc(candidate.number)}">${body}</button>`
      : `<div class="sf-encoder-evidence-card">${body}</div>`;
  }

  function groupMarkup(group) {
    const scope = group.station ? `Station ${group.station}` : "Station unknown — field 00067";
    const chronology = group.observed.length
      ? group.observed.map((row) => `${row.number || `Local ${row.localCode}`} ${row.title}`).join(" → ")
      : "No Station encoder subtype was resolved from the stack.";
    const split = group.chronologyAgreement
      ? "The first observed encoder subtype and current evidence ranking agree."
      : "The first observed encoder subtype and current evidence ranking differ; preserve both facts and use the observation to decide the next check.";
    const upstream = group.recommendedUpstream
      ? `<div class="sf-encoder-evidence-upstream"><strong>Hold physical encoder isolation:</strong> actual motion is absent. Earlier/stronger evidence in this stack is ${esc(group.recommendedUpstream.number || group.recommendedUpstream.code)} — ${esc(group.recommendedUpstream.title)}.</div>`
      : "";
    return `<section class="sf-encoder-evidence-group">
      <div class="sf-encoder-evidence-head"><div><span>${esc(scope)}</span><h4>Encoder evidence ranking</h4></div><span>${esc(group.observation.motion)} motion · ${esc(group.observation.feedback)} feedback</span></div>
      <p class="sf-encoder-evidence-chronology"><strong>Observed encoder order:</strong> ${esc(chronology)}</p>
      <p class="sf-encoder-evidence-split">${esc(split)}</p>
      ${upstream}
      <div class="sf-encoder-evidence-grid">${group.ranked.slice(0, 3).map(candidateMarkup).join("")}</div>
      <p class="sf-encoder-evidence-guidance">${esc(group.guidance)}</p>
    </section>`;
  }

  function mainMarkup(main) {
    if (!main) return "";
    const evaluation = main.evaluation;
    return `<section class="sf-encoder-evidence-group sf-encoder-evidence-main">
      <div class="sf-encoder-evidence-head"><div><span>Base Labeler</span><h4>Fault 670 kept separate</h4></div></div>
      <p>${esc(main.guidance)}</p>
      ${evaluation ? `<div class="sf-encoder-evidence-upstream"><strong>${esc(evaluation.title)}</strong><br>${esc(evaluation.summary)}${evaluation.next ? `<br><small><strong>Next:</strong> ${esc(evaluation.next)}</small>` : ""}</div>` : ""}
    </section>`;
  }

  function renderEvidence() {
    const target = ensureTarget();
    const input = document.getElementById("faultStackInput");
    const library = root.ServoForgeTroubleshootingLibrary;
    if (!target || !input || !library?.analyzeTopModulEncoderEvidence) return;
    const text = input.value.trim();
    if (!text) {
      target.hidden = true;
      target.innerHTML = "";
      return;
    }

    const result = library.analyzeTopModulEncoderEvidence(text, {}, {
      observationsByStation: currentObservationMap(),
      mainObservation
    });
    if (!result.stationGroups.length && !result.mainLabeler) {
      target.hidden = true;
      target.innerHTML = "";
      return;
    }

    const warnings = result.warnings.length
      ? `<div class="sf-encoder-evidence-warnings">${result.warnings.map((warning) => `<p><strong>Scope:</strong> ${esc(warning)}</p>`).join("")}</div>`
      : "";
    target.hidden = false;
    target.innerHTML = `<div class="sf-encoder-evidence-title"><span class="sf-eyebrow">v349 evidence synthesis</span><h3>Encoder chronology + observation</h3><p>ServoForge combines the alarm order with the verified v348 motion/feedback observation. This ranks <strong>diagnostic relevance, not causality</strong>.</p></div>
      ${warnings}
      ${result.stationGroups.map(groupMarkup).join("")}
      ${mainMarkup(result.mainLabeler)}
      <p class="sf-encoder-evidence-boundary">${esc(result.guidance)}</p>`;
  }

  function readEncoderObservation(section) {
    const observation = {};
    section.querySelectorAll("[data-encoder-group][aria-pressed=\"true\"]").forEach((button) => {
      observation[button.dataset.encoderGroup] = button.dataset.encoderValue;
    });
    return observation;
  }

  function dispatchObservationFromDiagnostic() {
    const section = document.querySelector("[data-topmodul-encoder-isolation]");
    const library = root.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!section || !library?.getTopModulEncoderIsolationPlan || !result || result.hidden) return;
    const code = result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
    const plan = library.getTopModulEncoderIsolationPlan(code);
    if (!plan) return;
    document.dispatchEvent(new CustomEvent("servoforge:encoder-observation", {
      detail: {
        planId: plan.id,
        scope: plan.scope,
        station: plan.station || null,
        number: plan.entry?.number || null,
        entryId: plan.entry?.id || "",
        observation: readEncoderObservation(section)
      }
    }));
  }

  function install() {
    const target = ensureTarget();
    const analyze = document.getElementById("faultStackAnalyze");
    if (!target || !analyze) return;

    analyze.addEventListener("click", () => queueMicrotask(renderEvidence));
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-encoder-group]")) queueMicrotask(dispatchObservationFromDiagnostic);
      const open = event.target.closest("[data-encoder-evidence-open]");
      if (open) openFault(open.dataset.encoderEvidenceOpen);
    });
    document.addEventListener("servoforge:encoder-observation", (event) => {
      const detail = event.detail || {};
      if (detail.scope === "Main Labeler encoder / fine clock" || Number(detail.number) === 670) {
        mainObservation = { ...(detail.observation || {}) };
      } else {
        const key = detail.station == null ? "unknown" : String(detail.station);
        observationsByStation.set(key, { ...(detail.observation || {}) });
      }
      renderEvidence();
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    .sf-encoder-evidence-results{margin-top:14px;display:grid;gap:12px}
    .sf-encoder-evidence-results[hidden]{display:none}
    .sf-encoder-evidence-title{display:grid;gap:4px}.sf-encoder-evidence-title h3,.sf-encoder-evidence-title p{margin:0}
    .sf-encoder-evidence-warnings{display:grid;gap:6px}.sf-encoder-evidence-warnings p{margin:0;padding:9px 10px;border:1px solid var(--line);border-radius:8px}
    .sf-encoder-evidence-group{display:grid;gap:9px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
    .sf-encoder-evidence-head{display:flex;justify-content:space-between;gap:10px;align-items:start;flex-wrap:wrap}.sf-encoder-evidence-head h4,.sf-encoder-evidence-head span{margin:0}.sf-encoder-evidence-head>span{font-size:.8rem;opacity:.75}
    .sf-encoder-evidence-chronology,.sf-encoder-evidence-split,.sf-encoder-evidence-guidance{margin:0;line-height:1.45}
    .sf-encoder-evidence-upstream{padding:9px 10px;border-left:3px solid #d99a3b;background:var(--input);border-radius:6px;line-height:1.45}
    .sf-encoder-evidence-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}
    .sf-encoder-evidence-card{display:grid;gap:5px;text-align:left;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--input);color:var(--ink)}
    button.sf-encoder-evidence-card{cursor:pointer}.sf-encoder-evidence-card p,.sf-encoder-evidence-card small{margin:0;line-height:1.4}.sf-encoder-evidence-card code{overflow-wrap:anywhere}
    .sf-encoder-evidence-rank,.sf-encoder-evidence-role{font-size:.75rem;opacity:.75}.sf-encoder-evidence-boundary{margin:0;font-size:.82rem;opacity:.8;line-height:1.45}
    @media print{button.sf-encoder-evidence-card{break-inside:avoid}}
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(typeof globalThis !== "undefined" ? globalThis : this);
