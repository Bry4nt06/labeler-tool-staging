"use strict";

(function installTopModulRpcMethodUi(global) {
  const MANAGED_SELECTOR = "[data-topmodul-rpc-method-ui]";
  let renderScheduled = false;

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

  function decoderOnlyMarkup(drillDown) {
    const methods = drillDown?.rpcDecoderOnlyMethods || [];
    if (!methods.length) return "";
    return `<section class="sf-result-section sf-rpc-decoder-methods" data-topmodul-rpc-decoder-methods>
      <h4>PLC-decoder-only RPC methods</h4>
      <p class="sf-trace-status">These PowerPC conditions are decoded in the supplied LB1 PLC and match archived RPC procedures, but this alarm table does not contain named HMI faults at those decoder positions. They are shown here under the Servo Bottle Table summary rather than created as searchable faults.</p>
      <div class="sf-circuit-device-grid">${methods.map((method) => `<div class="sf-circuit-device">
        <strong>Decoder ${esc(method.decoderPosition)}</strong>
        <span class="sf-circuit-device-copy">
          <span><strong>${esc(method.code)}</strong> — ${esc(method.title)}</span>
          <code>PowerPC message ${esc(method.powerPcMessageCode)} · RPC document fault #${esc(method.number)}</code>
          <span>${esc(method.summary)}</span>
          ${method.checks?.length ? `<span><strong>Checks:</strong> ${esc(method.checks.join(" · "))}</span>` : ""}
        </span>
      </div>`).join("")}</div>
      <div class="sf-circuit-warning"><strong>Source discipline:</strong> decoder positions are PLC evidence, not operator-facing fault numbers in this supplied LB1 alarm table.</div>
    </section>`;
  }

  function currentEntry(result, library) {
    const category = result.querySelector(".sf-entry-category")?.textContent || "";
    if (!/^TopModul PLC\s*\//i.test(category.trim())) return null;
    const code = result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
    return library.getTopModulFault?.(code) || null;
  }

  function renderKey(entry, drillDown) {
    const decoderPositions = (drillDown?.rpcDecoderOnlyMethods || [])
      .map((method) => method.decoderPosition)
      .join(",");
    return [
      entry?.id || "",
      entry?.rpcMethod?.code || "",
      entry?.rpcMethodGap?.status || "",
      decoderPositions
    ].join("|");
  }

  function render() {
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.topModulRpcMethodFaults || !result) return;

    const existing = result.querySelector(MANAGED_SELECTOR);
    if (result.hidden) {
      if (existing) existing.remove();
      return;
    }

    const entry = currentEntry(result, library);
    if (!entry) {
      if (existing) existing.remove();
      return;
    }

    const drillDown = library.getTopModulFaultDrillDown?.(entry, 12) || null;
    const body = `${methodMarkup(entry)}${gapMarkup(entry)}${decoderOnlyMarkup(drillDown)}`;
    if (!body) {
      if (existing) existing.remove();
      return;
    }

    const key = renderKey(entry, drillDown);
    if (existing?.dataset.topmodulRpcRenderKey === key) return;
    if (existing) existing.remove();

    const anchor = result.querySelector("[data-topmodul-circuit-trace]")
      || result.querySelector("[data-topmodul-process-trace]")
      || result.querySelector("[data-topmodul-cause-evidence]")
      || result.querySelector("[data-topmodul-plc-binding]")
      || result.querySelector(".sf-result-summary");
    if (!anchor) return;

    anchor.insertAdjacentHTML(
      "afterend",
      `<div data-topmodul-rpc-method-ui data-topmodul-rpc-render-key="${esc(key)}">${body}</div>`
    );
  }

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    global.setTimeout(() => {
      renderScheduled = false;
      render();
    }, 0);
  }

  function install() {
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(scheduleRender);
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-topmodul-open-fault],#faultSearchButton,.sf-search-result")) scheduleRender();
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);
