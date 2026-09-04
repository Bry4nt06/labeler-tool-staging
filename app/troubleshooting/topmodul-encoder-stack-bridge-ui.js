"use strict";

(function installTopModulEncoderStackBridgeUi(root) {
  if (!root?.document) return;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const codeFor = (item) => {
    const entry = item?.entry;
    if (entry?.id === "topmodul-00067-labeler-encoder-feedback") return "00067";
    return entry?.code || (Number.isFinite(Number(entry?.number)) ? String(Number(entry.number)) : "—");
  };

  function ensureTarget() {
    const stackResults = document.getElementById("faultStackResults");
    if (!stackResults) return null;
    let target = document.getElementById("sfEncoderStackBridge");
    if (!target) {
      target = document.createElement("section");
      target.id = "sfEncoderStackBridge";
      target.className = "sf-encoder-stack-bridge";
      target.setAttribute("aria-live", "polite");
      stackResults.insertAdjacentElement("afterend", target);
    }
    return target;
  }

  function itemText(item) {
    if (!item?.entry) return "—";
    const station = Number.isFinite(Number(item.station)) ? ` · Station ${item.station}` : "";
    return `${codeFor(item)} — ${item.entry.title}${station}`;
  }

  function openTarget(analysis) {
    const input = document.getElementById("faultSearch");
    const button = document.getElementById("faultSearchButton");
    if (!input || !button || !analysis?.targetSearch) return;
    input.value = analysis.targetSearch;
    button.click();
    document.getElementById("diagnosticResult")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function render(analysis) {
    const target = ensureTarget();
    if (!target) return;
    if (!analysis?.hasEncoderEvidence) {
      target.innerHTML = "";
      target.hidden = true;
      return;
    }
    target.hidden = false;

    const scopeNote = analysis.crossScope
      ? `<div class="sf-encoder-stack-alert"><strong>Cross-scope stack:</strong> main Labeler and Station/Cart encoder evidence are both present. Their circuits remain separate.</div>`
      : "";
    const fieldNote = analysis.hasField00067
      ? `<div class="sf-encoder-stack-note"><strong>00067 provenance:</strong> ${analysis.fieldStationContextAvailable ? `Exact ${esc(analysis.stationContext.label)} evidence is also present in this stack, but co-occurrence does not prove the field 00067 came from that Cart.` : "The field HMI code proves the shared Cart-local FeedbackFault method but does not identify a Station by itself."}</div>`
      : "";
    const observed = analysis.observed.map((item, index) => `<li><strong>${index + 1}. ${esc(codeFor(item))}</strong> ${esc(item.subtype)} · ${esc(item.scope)}${item.station ? ` · Station ${esc(item.station)}` : ""}</li>`).join("");
    const groups = analysis.stationGroups.length
      ? `<div class="sf-encoder-stack-groups">${analysis.stationGroups.map((group) => `<span>Station ${esc(group.station)}: ${group.observed.map((item) => esc(item.subtype)).join(" → ")}</span>`).join("")}</div>`
      : "";

    target.innerHTML = `<div class="sf-encoder-stack-head">
        <div><span class="sf-eyebrow">Encoder evidence found</span><h3>Alarm stack → encoder isolation</h3></div>
        <button type="button" class="secondary-button" id="sfOpenEncoderIsolation">Open encoder isolation</button>
      </div>
      <div class="sf-encoder-stack-grid">
        <div><small>Station context</small><strong>${esc(analysis.stationContext.label)}</strong></div>
        <div><small>Earliest encoder alarm</small><strong>${esc(itemText(analysis.earliestObservedEncoder))}</strong></div>
        <div><small>Strongest encoder evidence</small><strong>${esc(itemText(analysis.strongestEncoderEvidence))}</strong></div>
        <div><small>Isolation target</small><strong>${esc(itemText(analysis.target))}</strong></div>
      </div>
      ${scopeNote}${fieldNote}
      <div class="sf-encoder-stack-observed"><strong>Encoder alarms in observed order</strong><ol>${observed}</ol></div>
      ${groups}
      <div class="sf-encoder-stack-no-inference"><strong>No machine-state inference:</strong> Motion, AQB feedback behavior, and fine-clock behavior remain <em>unknown</em> until verified on the machine. Alarm history never auto-selects those observations.</div>
      <p class="sf-encoder-stack-guidance">${esc(analysis.guidance)}</p>
      <p class="sf-encoder-stack-safety"><strong>Safety boundary:</strong> ${esc(analysis.safety.join(" "))}</p>`;

    document.getElementById("sfOpenEncoderIsolation")?.addEventListener("click", () => openTarget(analysis), { once: true });
  }

  function analyze() {
    const library = root.ServoForgeTroubleshootingLibrary;
    const input = document.getElementById("faultStackInput");
    if (!library?.analyzeTopModulEncoderStack || !input) return;
    render(library.analyzeTopModulEncoderStack(input.value, { machineType: "TopModul" }));
  }

  function init() {
    ensureTarget();
    const button = document.getElementById("faultStackAnalyze");
    if (!button || !root.ServoForgeTroubleshootingLibrary?.analyzeTopModulEncoderStack) return;
    button.addEventListener("click", () => setTimeout(analyze, 0));
  }

  const style = document.createElement("style");
  style.textContent = `
    .sf-encoder-stack-bridge{display:grid;gap:10px;margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:10px}
    .sf-encoder-stack-bridge[hidden]{display:none}
    .sf-encoder-stack-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .sf-encoder-stack-head h3{margin:2px 0 0}
    .sf-encoder-stack-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
    .sf-encoder-stack-grid>div{display:grid;gap:4px;padding:9px;border:1px solid var(--line);border-radius:7px;background:var(--input)}
    .sf-encoder-stack-grid small{opacity:.72;text-transform:uppercase;letter-spacing:.05em;font-size:.7rem}
    .sf-encoder-stack-alert,.sf-encoder-stack-note,.sf-encoder-stack-no-inference{padding:9px 10px;border-left:3px solid var(--line);background:var(--input);border-radius:5px;line-height:1.45}
    .sf-encoder-stack-alert{border-left-color:#d99a3b}
    .sf-encoder-stack-no-inference{border-left-color:var(--green)}
    .sf-encoder-stack-observed ol{margin:7px 0 0;padding-left:22px;display:grid;gap:4px}
    .sf-encoder-stack-groups{display:flex;flex-wrap:wrap;gap:6px}
    .sf-encoder-stack-groups span{padding:5px 8px;border:1px solid var(--line);border-radius:999px;font-size:.8rem}
    .sf-encoder-stack-guidance,.sf-encoder-stack-safety{margin:0;line-height:1.45;font-size:.86rem}
    .sf-encoder-stack-safety{opacity:.8}
    @media print{#sfOpenEncoderIsolation{display:none!important}.sf-encoder-stack-bridge{break-inside:avoid}}
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(typeof globalThis !== "undefined" ? globalThis : this);
