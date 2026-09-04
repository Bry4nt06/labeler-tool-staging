"use strict";

(function installTopModulRpcMethodUi(global) {
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function list(items) {
    if (!items?.length) return "";
    return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
  }

  function methodMarkup(entry) {
    const method = entry?.rpcMethod;
    if (!method) return "";
    return `<section class="sf-result-section sf-rpc-method" data-topmodul-rpc-method="${esc(entry.id)}">
      <h4>RPC / Danfoss fault method</h4>
      <div class="sf-cause-evidence-grid">
        <div class="sf-plc-binding-cell"><small>TopModul fault</small><strong>${esc(entry.code)}</strong></div>
        <div class="sf-plc-binding-cell"><small>PowerPC code</small><code>${esc(method.powerPcMessageCode)}</code></div>
        <div class="sf-plc-binding-cell"><small>RPC method</small><strong>${esc(method.code)}</strong></div>
        <div class="sf-plc-binding-cell"><small>RPC document fault</small><strong>#${esc(method.number)}</strong></div>
      </div>
      <p class="sf-trace-status"><strong>${esc(method.title)}</strong> — ${esc(method.summary)}</p>
      ${method.probableCauses?.length ? `<div class="sf-circuit-warning"><strong>Documented likely causes</strong>${list(method.probableCauses)}</div>` : ""}
      ${method.checks?.length ? `<div class="sf-circuit-warning"><strong>Diagnostic checks</strong>${list(method.checks)}</div>` : ""}
      ${method.actions?.length ? `<div class="sf-circuit-warning"><strong>Corrective direction</strong>${list(method.actions)}</div>` : ""}
      ${method.safety?.length ? `<div class="sf-circuit-warning"><strong>Safety boundary</strong>${list(method.safety)}</div>` : ""}
      <div class="sf-circuit-warning"><strong>Source discipline:</strong> ${esc(method.sourceDiscipline)}</div>
    </section>`;
  }

  function gapMarkup(entry) {
    const gap = entry?.rpcMethodGap;
    if (!gap) return "";
    return `<section class="sf-result-section sf-rpc-method-gap" data-topmodul-rpc-method-gap="${esc(entry.id)}">
      <h4>RPC method status — decoder bound, procedure not promoted</h4>
      <div class="sf-cause-evidence-grid">
        <div class="sf-plc-binding-cell"><small>TopModul fault</small><strong>${esc(entry.code)}</strong></div>
        <div class="sf-plc-binding-cell"><small>PowerPC code</small><code>${esc(gap.powerPcMessageCode)}</code></div>
        <div class="sf-plc-binding-cell"><small>Evidence</small><strong>${esc(gap.status)}</strong></div>
      </div>
      <div class="sf-circuit-warning"><strong>Why ServoForge stops here:</strong> ${esc(gap.reason)}</div>
    </section>`;
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
    if (!library?.topModulRpcMethodFaults || !result || result.hidden) return;
    const entry = currentEntry(result, library);
    result.querySelectorAll("[data-topmodul-rpc-method],[data-topmodul-rpc-method-gap]").forEach((node) => node.remove());
    if (!entry?.rpcMethod && !entry?.rpcMethodGap) return;
    const anchor = result.querySelector("[data-topmodul-circuit-trace]")
      || result.querySelector("[data-topmodul-process-trace]")
      || result.querySelector("[data-topmodul-cause-evidence]")
      || result.querySelector("[data-topmodul-plc-binding]")
      || result.querySelector(".sf-result-summary");
    if (anchor) anchor.insertAdjacentHTML("afterend", `${methodMarkup(entry)}${gapMarkup(entry)}`);
  }

  function install() {
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(() => queueMicrotask(render));
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-topmodul-open-fault],#faultSearchButton,.sf-search-result")) setTimeout(render, 0);
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);
