"use strict";

(function installTopModulEncoderVerificationUi(root) {
  if (!root?.document) return;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function resultCode(result) {
    return result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
  }

  function statusRowsMarkup(plan) {
    return `<div class="sf-encoder-verify-table-wrap"><table class="sf-encoder-verify-table">
      <thead><tr><th>Local</th><th>${plan.station ? "Global" : "Status"}</th><th>Direct axis tag</th><th>Axis / application behavior</th></tr></thead>
      <tbody>${plan.statusRows.map((row) => `<tr${row.offset === plan.localOffset ? ' class="is-direct"' : ""}>
        <td><strong>${esc(row.localCode)}</strong><br><small>${esc(row.label)}</small></td>
        <td>${row.globalNumber ? `<strong>${esc(row.globalNumber)}</strong><br><code>${esc(row.globalAddress)}</code>` : row.offset === plan.localOffset ? "Current subtype" : "Sibling"}</td>
        <td><code>${esc(row.tag)}</code></td>
        <td><small>${esc(row.axisAction)}. ${esc(row.applicationResponse)}</small></td>
      </tr>`).join("")}</tbody>
    </table></div>`;
  }

  function watchMarkup(plan) {
    return `<div class="sf-encoder-watch-grid">${plan.runtimeWatchPoints.map((row) => `<article class="sf-encoder-watch-card">
      <span>${esc(row.role)}</span>
      <code>${esc(row.tag)}</code>
      <p>${esc(row.interpretation)}</p>
      <small><strong>PLC relationship:</strong> ${esc(row.sourceRelationship)}</small>
      ${row.caution ? `<small><strong>Caution:</strong> ${esc(row.caution)}</small>` : ""}
    </article>`).join("")}</div>`;
  }

  function configurationMarkup(config) {
    const rows = [
      ["Module", `${config.module} · ${config.catalogNumber} · Slot ${config.slot}`],
      ["Motion channel", config.motionChannel],
      ["Axis", config.axis],
      ["Axis type", config.axisType],
      ["Feedback", config.feedbackType],
      ["Feedback fault action", config.feedbackFaultAction],
      ["Feedback noise action", config.feedbackNoiseFaultAction],
      ["Conversion / unwind", `${config.conversionConstant} / ${config.positionUnwind}`]
    ];
    return `<div class="sf-encoder-config-grid">${rows.map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join("")}</div>`;
  }

  function rulesMarkup(plan) {
    return `<div class="sf-encoder-verify-rules">${plan.interpretationRules.map((rule, index) => `<article>
      <strong>${index + 1}. ${esc(rule.when)}</strong>
      <p>${esc(rule.meaning)}</p>
      <small><strong>Next:</strong> ${esc(rule.next)}</small>
    </article>`).join("")}</div>`;
  }

  function markup(plan) {
    const scope = plan.station ? `Station ${plan.station}` : "Shared Cart method / Station not identified";
    return `<section class="sf-result-section sf-encoder-verification" data-topmodul-encoder-verification="${esc(plan.id)}">
      <div class="sf-encoder-verify-heading"><div><span class="sf-eyebrow">v350 read-only verification</span><h4>PLC encoder verification points</h4></div><span>${esc(scope)}</span></div>
      <p>${esc(plan.guidance)}</p>
      <div class="sf-encoder-direct-status"><strong>Current subtype</strong><code>${esc(plan.directStatus.tag)}</code><span>Local ${esc(plan.directStatus.localCode)} · ${esc(plan.directStatus.label)}${plan.directStatus.globalNumber ? ` · Global ${esc(plan.directStatus.globalNumber)}` : ""}</span></div>
      <h5>Watch these values before hardware replacement</h5>
      ${watchMarkup(plan)}
      <h5>Exact axis configuration in the supplied Cart PLC</h5>
      ${configurationMarkup(plan.configuration)}
      <h5>Six encoder status producers — one shared method</h5>
      ${statusRowsMarkup(plan)}
      <h5>How to interpret disagreement</h5>
      ${rulesMarkup(plan)}
      <p class="sf-encoder-verify-authority"><strong>Source boundary:</strong> ${esc(plan.authority)}</p>
      <p class="sf-encoder-verify-safety"><strong>Safety:</strong> ${esc(plan.safety.join(" "))}</p>
    </section>`;
  }

  function render() {
    const library = root.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getTopModulEncoderVerification || !result || result.hidden) return;
    const plan = library.getTopModulEncoderVerification(resultCode(result));
    const existing = result.querySelector("[data-topmodul-encoder-verification]");
    if (!plan) {
      existing?.remove();
      return;
    }
    if (existing?.dataset.topmodulEncoderVerification === plan.id) return;
    existing?.remove();
    const anchor = result.querySelector("[data-topmodul-encoder-isolation]")
      || result.querySelector("[data-topmodul-process-trace]")
      || result.querySelector("[data-topmodul-plc-binding]")
      || result.querySelector(".sf-result-summary");
    if (anchor) anchor.insertAdjacentHTML("afterend", markup(plan));
  }

  function install() {
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(() => queueMicrotask(render));
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-entry],[data-topmodul-open-fault],[data-encoder-open-fault],[data-encoder-stack-open],#faultSearchButton,.sf-search-result")) setTimeout(render, 0);
    });
    render();
  }

  const style = document.createElement("style");
  style.textContent = `
    .sf-encoder-verification{display:grid;gap:11px}.sf-encoder-verification h4,.sf-encoder-verification h5,.sf-encoder-verification p{margin:0}
    .sf-encoder-verify-heading{display:flex;justify-content:space-between;gap:10px;align-items:start;flex-wrap:wrap}.sf-encoder-verify-heading>span{font-size:.8rem;color:var(--muted)}
    .sf-encoder-direct-status{display:grid;grid-template-columns:auto minmax(220px,1fr) auto;gap:8px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--input)}.sf-encoder-direct-status code{overflow-wrap:anywhere}.sf-encoder-direct-status span{font-size:.8rem;color:var(--muted)}
    .sf-encoder-watch-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}.sf-encoder-watch-card{display:grid;gap:5px;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--input)}.sf-encoder-watch-card>span{font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.sf-encoder-watch-card code{overflow-wrap:anywhere}.sf-encoder-watch-card p,.sf-encoder-watch-card small{line-height:1.4}
    .sf-encoder-config-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px}.sf-encoder-config-grid>div{display:grid;gap:3px;padding:8px 9px;border:1px solid var(--line);border-radius:7px;background:var(--input)}.sf-encoder-config-grid small{color:var(--muted);text-transform:uppercase;font-size:.68rem;letter-spacing:.04em}.sf-encoder-config-grid strong{overflow-wrap:anywhere}
    .sf-encoder-verify-table-wrap{overflow-x:auto}.sf-encoder-verify-table{width:100%;border-collapse:collapse;font-size:.82rem}.sf-encoder-verify-table th,.sf-encoder-verify-table td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}.sf-encoder-verify-table tr.is-direct{outline:1px solid var(--green);outline-offset:-1px}.sf-encoder-verify-table code{overflow-wrap:anywhere}
    .sf-encoder-verify-rules{display:grid;gap:7px}.sf-encoder-verify-rules article{display:grid;gap:4px;padding:9px 10px;border-left:3px solid var(--line);background:var(--input);border-radius:6px}.sf-encoder-verify-rules p,.sf-encoder-verify-rules small{line-height:1.4}
    .sf-encoder-verify-authority,.sf-encoder-verify-safety{font-size:.82rem;color:var(--muted);line-height:1.45}
    @media(max-width:700px){.sf-encoder-direct-status{grid-template-columns:1fr}.sf-encoder-verify-table{min-width:720px}}
    @media print{.sf-encoder-watch-card,.sf-encoder-verify-rules article{break-inside:avoid}}
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(typeof globalThis !== "undefined" ? globalThis : this);
