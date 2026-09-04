"use strict";

(function installTopModulStationLocalHmiUi(global) {
  if (!global?.document) return;

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function currentEntry(result, library) {
    const code = result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
    if (!/^000\d{2}$/.test(code)) return null;
    return library.getStationLocalHmiFault?.(code) || null;
  }

  function metaFor(entry) {
    return entry?.localHmiFault || entry?.stationLocalFault || null;
  }

  function markup(entry) {
    const meta = metaFor(entry);
    if (!meta) return "";
    const mappings = meta.globalByStation || [];
    const producer = meta.directProducer || meta.producer || entry.stationControllerTrace?.directTriggerTag || "Subsystem/routine-specific producer — open the exact global Station fault for the verified producer trace.";
    const textStatus = entry.localHmiFault
      ? "Exact operator message verified in Cart 1 L5K; shared Station offset/global destination structure verified for Stations 1–6."
      : "Field PanelView text plus Cart 1 L5K producer/transport are source-proven for this live case.";
    return `<section class="sf-result-section sf-local-hmi-map" data-station-local-hmi="${esc(entry.id)}">
      <h4>Station-local HMI mapping</h4>
      <div class="sf-cause-evidence-grid">
        <div class="sf-plc-binding-cell"><small>Local HMI code</small><code>${esc(meta.localCode || entry.code)}</code></div>
        <div class="sf-plc-binding-cell"><small>Cart local fault bit</small><code>${esc(meta.localAddress)}</code></div>
        <div class="sf-plc-binding-cell"><small>Shared Station offset</small><strong>${esc(meta.stationTemplateOffset ?? meta.localNumber)}</strong></div>
        <div class="sf-plc-binding-cell"><small>Producer</small><code>${esc(producer)}</code></div>
      </div>
      <p class="sf-trace-status"><strong>Cart HMI text:</strong> ${esc(meta.operatorMessage || meta.hmiMessage || entry.title)}</p>
      <p class="sf-trace-status">${esc(textStatus)}</p>
      <div class="sf-local-hmi-stations">
        ${mappings.map((row) => `<button type="button" class="sf-local-hmi-station" data-open-global-fault="${esc(row.globalCode || row.globalNumber)}">
          <small>Station ${esc(row.station)}</small>
          <strong>Global ${esc(row.globalCode || row.globalNumber)}</strong>
          <code>${esc(row.globalAddress)}</code>
        </button>`).join("")}
      </div>
      <div class="sf-circuit-warning"><strong>Numbering boundary:</strong> A five-digit Cart code such as ${esc(meta.localCode || entry.code)} is a Station-local HMI number. The base Labeler global fault number changes with Station position. Do not collapse a local 000xx code onto an unrelated base-machine fault with the same numeric suffix.</div>
      ${entry.localHmiFault ? `<div class="sf-circuit-warning"><strong>Cross-cart confidence:</strong> ${esc(meta.sourceDiscipline)}</div>` : ""}
    </section>`;
  }

  function render() {
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getStationLocalHmiFault || !result || result.hidden) return;
    const entry = currentEntry(result, library);
    const existing = result.querySelector("[data-station-local-hmi]");
    if (!entry) {
      existing?.remove();
      return;
    }
    if (existing?.dataset.stationLocalHmi === entry.id) return;
    existing?.remove();
    const anchor = result.querySelector(".sf-result-summary");
    if (anchor) anchor.insertAdjacentHTML("afterend", markup(entry));
  }

  function openGlobal(code) {
    const input = document.getElementById("faultSearch");
    const button = document.getElementById("faultSearchButton");
    if (!input || !button || !code) return;
    input.value = code;
    button.click();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function install() {
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(() => queueMicrotask(render));
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    result.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-global-fault]");
      if (button) openGlobal(button.dataset.openGlobalFault);
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest("#faultSearchButton,.sf-search-result,[data-open-entry]")) setTimeout(render, 0);
    });
    render();
  }

  const style = document.createElement("style");
  style.textContent = `
    .sf-local-hmi-stations{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
    .sf-local-hmi-station{display:grid;gap:3px;text-align:left;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--input);color:inherit;cursor:pointer}
    .sf-local-hmi-station small{color:var(--muted);font-weight:700}.sf-local-hmi-station code{font-size:10px;overflow-wrap:anywhere}
    @media(max-width:760px){.sf-local-hmi-stations{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:460px){.sf-local-hmi-stations{grid-template-columns:1fr}}
    @media print{.sf-local-hmi-station{break-inside:avoid}}
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);
