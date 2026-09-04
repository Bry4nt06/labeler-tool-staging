"use strict";

(function installTopModulAlarmStackUi(root) {
  if (!root?.document) return;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const codeFor = (entry) => entry?.code || (Number.isFinite(Number(entry?.number)) ? String(entry.number).padStart(3, "0") : "—");

  function ensurePanel() {
    if (document.getElementById("faultStackInput")) return;
    const searchPanel = document.querySelector(".sf-search-panel");
    if (!searchPanel) return;
    const panel = document.createElement("section");
    panel.className = "sf-search-panel panel sf-stack-panel";
    panel.setAttribute("aria-labelledby", "faultStackHeading");
    panel.innerHTML = `<div class="sf-section-heading">
      <div><span class="sf-eyebrow">Multiple alarms?</span><h2 id="faultStackHeading">Alarm stack / first-fault analyzer</h2></div>
      <p>Paste alarms in the order they appeared. ServoForge preserves that chronology and separately ranks the strongest verified PLC evidence.</p>
    </div>
    <textarea id="faultStackInput" class="sf-stack-input" spellcheck="false" placeholder="Example: 673, 674, 695\nOr: 663, 1091\nField HMI code 00067 stays separate from PLC Fault 067."></textarea>
    <div class="sf-stack-actions"><button id="faultStackAnalyze" type="button">Analyze alarm stack</button><span class="sf-stack-help">Ctrl/⌘ + Enter also analyzes.</span></div>
    <div id="faultStackResults" class="sf-stack-results" aria-live="polite"></div>`;
    searchPanel.insertAdjacentElement("afterend", panel);
  }

  function openDiagnostic(entry) {
    const input = document.getElementById("faultSearch");
    const button = document.getElementById("faultSearchButton");
    if (!input || !button) return;
    input.value = entry?.id === "topmodul-00067-labeler-encoder-feedback" ? "00067" : codeFor(entry);
    button.click();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderItem(item, index, mode) {
    const entry = item.entry;
    const upstream = item.upstreamCandidatesInStack?.length
      ? `<p class="sf-stack-note"><strong>Earlier/stronger candidates in this stack:</strong> ${item.upstreamCandidatesInStack.map((row) => `${escapeHtml(String(row.number).padStart(3, "0"))} ${escapeHtml(row.title)}${row.appearedEarlier ? " (appeared earlier)" : ""}`).join("; ")}</p>`
      : "";
    const supports = item.downstreamItemsSupported?.length
      ? `<p class="sf-stack-note"><strong>May explain downstream entries in this stack:</strong> ${item.downstreamItemsSupported.map((row) => `${escapeHtml(String(row.number).padStart(3, "0"))} ${escapeHtml(row.title)}`).join("; ")}</p>`
      : "";
    return `<button type="button" class="sf-stack-card" data-stack-entry-id="${escapeHtml(entry.id)}">
      <span class="sf-stack-rank">${mode === "observed" ? `Observed ${index + 1}` : `Priority ${index + 1}`}</span>
      <strong>${escapeHtml(codeFor(entry))} — ${escapeHtml(entry.title)}</strong>
      <span class="sf-stack-role">${escapeHtml(item.roleLabel)}${mode === "recommended" ? ` · score ${item.investigationScore}` : ""}</span>
      ${upstream}${supports}
    </button>`;
  }

  function renderAnalysis(analysis) {
    const target = document.getElementById("faultStackResults");
    if (!target) return;
    if (!analysis.observed.length) {
      target.innerHTML = `<p class="sf-stack-empty">No recognized TopModul faults were found. Enter exact fault numbers such as <strong>1091</strong>, <strong>673</strong>, or field HMI code <strong>00067</strong>.</p>`;
      return;
    }

    const disagreement = analysis.chronologyAgreement
      ? `<p class="sf-stack-callout"><strong>Chronology and evidence agree:</strong> ${escapeHtml(codeFor(analysis.earliestObserved.entry))} is both the first observed item and the strongest current investigation candidate.</p>`
      : `<p class="sf-stack-callout"><strong>Chronology/evidence split:</strong> first observed was ${escapeHtml(codeFor(analysis.earliestObserved.entry))}, while verified evidence currently prioritizes ${escapeHtml(codeFor(analysis.strongestEvidence.entry))}. Keep both facts; do not replace the chronology with the ranking.</p>`;

    const unresolved = analysis.unresolved.length
      ? `<p class="sf-stack-unresolved"><strong>Not resolved:</strong> ${analysis.unresolved.map((row) => escapeHtml(row.token)).join(", ")}</p>`
      : "";

    target.innerHTML = `${disagreement}
      <div class="sf-stack-summary">Resolved ${analysis.counts.resolved} · direct/verified ${analysis.counts.direct} · summaries/escalations ${analysis.counts.summaries} · gaps/inactive ${analysis.counts.gaps}</div>
      <div class="sf-stack-columns">
        <section><h3>Observed order</h3><p>Exactly as entered from alarm history.</p><div class="sf-stack-list">${analysis.observed.map((item, index) => renderItem(item, index, "observed")).join("")}</div></section>
        <section><h3>Investigation order</h3><p>PLC evidence priority; not a claim of causality.</p><div class="sf-stack-list">${analysis.recommended.map((item, index) => renderItem(item, index, "recommended")).join("")}</div></section>
      </div>
      ${unresolved}<p class="sf-stack-guidance">${escapeHtml(analysis.guidance)}</p>`;

    target.querySelectorAll("[data-stack-entry-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-stack-entry-id");
        const entry = root.ServoForgeTroubleshootingLibrary?.getEntry?.(id) || analysis.observed.find((item) => item.entry.id === id)?.entry;
        if (entry) openDiagnostic(entry);
      });
    });
  }

  function init() {
    ensurePanel();
    const library = root.ServoForgeTroubleshootingLibrary;
    const input = document.getElementById("faultStackInput");
    const button = document.getElementById("faultStackAnalyze");
    if (!library?.analyzeTopModulFaultStack || !input || !button) return;

    button.addEventListener("click", () => renderAnalysis(library.analyzeTopModulFaultStack(input.value, { machineType: "TopModul" })));
    input.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") button.click();
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    .sf-stack-input{width:100%;min-height:88px;resize:vertical;padding:12px;border-radius:10px;font:inherit}
    .sf-stack-actions{display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap}
    .sf-stack-help{font-size:.85rem;opacity:.75}
    .sf-stack-results{margin-top:10px}
    .sf-stack-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:14px}
    .sf-stack-list{display:grid;gap:8px}
    .sf-stack-card{display:grid;gap:4px;width:100%;text-align:left;padding:12px;border-radius:10px;border:1px solid currentColor;background:transparent;cursor:pointer}
    .sf-stack-rank,.sf-stack-role{font-size:.78rem;opacity:.75}
    .sf-stack-note{font-size:.78rem;margin:4px 0 0;opacity:.85}
    .sf-stack-callout,.sf-stack-guidance,.sf-stack-unresolved{margin:12px 0 0}
    .sf-stack-summary{margin-top:10px;font-size:.85rem;font-weight:600}
    @media(max-width:760px){.sf-stack-columns{grid-template-columns:1fr}}
    @media print{.sf-stack-card{break-inside:avoid}.sf-stack-actions{display:none}}
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(typeof globalThis !== "undefined" ? globalThis : this);
