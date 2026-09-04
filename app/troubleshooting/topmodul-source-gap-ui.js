"use strict";

(function installTopModulSourceGapUi(global) {
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function currentEntry(result, library) {
    const category = result.querySelector(".sf-entry-category")?.textContent || "";
    if (!/^TopModul PLC\s*\//i.test(category.trim())) return null;
    const code = result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
    return library.getTopModulFault?.(code) || null;
  }

  function render() {
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getStationSourceGap || !result || result.hidden) return;
    const entry = currentEntry(result, library);
    const existing = result.querySelector("[data-topmodul-source-gap]");
    if (!entry?.sourceGap) {
      existing?.remove();
      return;
    }
    if (existing?.dataset.topmodulSourceGap === entry.id) return;
    existing?.remove();
    const markup = `<section class="sf-result-section sf-source-gap" data-topmodul-source-gap="${esc(entry.id)}">
      <h4>Source status — no producer promoted</h4>
      <div class="sf-circuit-warning"><strong>Status:</strong> ${esc(entry.sourceGap.status)}<br>${esc(entry.sourceGap.reason)}</div>
      <p class="sf-trace-status">ServoForge keeps the HMI/PLC alarm-table entry searchable, but it will not invent a rung, device, cable, or corrective path when the supplied Cart revision does not contain a verified producer.</p>
    </section>`;
    const anchor = result.querySelector("[data-topmodul-cause-evidence]")
      || result.querySelector("[data-topmodul-station-controller-trace]")
      || result.querySelector("[data-topmodul-plc-binding]")
      || result.querySelector(".sf-result-summary");
    if (anchor) anchor.insertAdjacentHTML("afterend", markup);
  }

  function install() {
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(() => queueMicrotask(render));
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);
