"use strict";

(function installRpcDanfossGuidesUi(global) {
  let renderTimer = null;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installStyles() {
    if (document.getElementById("sfRpcDanfossGuideStyles")) return;
    const style = document.createElement("style");
    style.id = "sfRpcDanfossGuideStyles";
    style.textContent = `
      .sf-rpc-danfoss-guide { display:grid; gap:10px; }
      .sf-rpc-danfoss-limits { display:grid; gap:6px; margin:0; padding-left:20px; }
      .sf-rpc-danfoss-related { display:flex; flex-wrap:wrap; gap:7px; }
      .sf-rpc-danfoss-related button { text-align:left; }
      .sf-rpc-danfoss-scope { padding:9px 10px; border-left:3px solid #d99a3b; background:var(--input); border-radius:5px; line-height:1.45; }
      @media print { .sf-rpc-danfoss-related { display:none !important; } }
    `;
    document.head.appendChild(style);
  }

  function currentGuide(result, library) {
    const heading = result.querySelector(".sf-result-head h2")?.textContent?.trim() || "";
    return library.getRpcDanfossGuide?.(heading) || null;
  }

  function markup(entry, library) {
    const related = (entry.related || [])
      .map((id) => library.getEntry?.(id))
      .filter(Boolean);
    const scope = entry.id === "servo-terminal-code-600"
      ? "Legacy Power-PC scope: verify the installed RPC/controller generation before using the archived Code 600 procedure."
      : entry.id === "rpc-servomotor-replacement-guide"
        ? "Maintenance scope: use this only after the fault has been isolated and the exact machine-specific replacement procedure is available."
        : "Electrical diagnostic scope: use DTS-5/RPC screens as evidence only; machine-specific limits, fuse relationships, CAN settings, and wiring come from the current machine documentation.";

    return `<section class="sf-result-section sf-rpc-danfoss-guide" data-rpc-danfoss-guide-ui="${esc(entry.id)}">
      <h4>RPC / Danfoss source boundaries</h4>
      <div class="sf-rpc-danfoss-scope"><strong>Scope:</strong> ${esc(scope)}</div>
      <div>
        <strong>Evidence limits</strong>
        <ul class="sf-rpc-danfoss-limits">${(entry.evidenceLimits || []).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
      </div>
      <div>
        <strong>Related existing diagnostics</strong>
        <div class="sf-rpc-danfoss-related">${related.map((item) => `<button type="button" class="secondary-button" data-rpc-danfoss-open="${esc(item.id)}">${esc(item.code || item.title)} — ${esc(item.title)}</button>`).join("")}</div>
      </div>
    </section>`;
  }

  function render() {
    const library = global.ServoForgeTroubleshootingLibrary;
    const result = document.getElementById("diagnosticResult");
    if (!library?.getRpcDanfossGuide || !result || result.hidden) return;
    const entry = currentGuide(result, library);
    const existing = result.querySelector("[data-rpc-danfoss-guide-ui]");
    if (!entry) {
      existing?.remove();
      return;
    }
    if (existing?.dataset.rpcDanfossGuideUi === entry.id) return;
    existing?.remove();
    const anchor = result.querySelector(".sf-result-summary") || result.querySelector(".sf-result-head");
    if (anchor) anchor.insertAdjacentHTML("afterend", markup(entry, library));
  }

  function scheduleRender() {
    if (renderTimer !== null) return;
    renderTimer = global.setTimeout(() => {
      renderTimer = null;
      render();
    }, 0);
  }

  function openRelated(id) {
    const library = global.ServoForgeTroubleshootingLibrary;
    const entry = library?.getEntry?.(id);
    const input = document.getElementById("faultSearch");
    const button = document.getElementById("faultSearchButton");
    if (!entry || !input || !button) return;
    input.value = entry.code || entry.title;
    button.click();
  }

  function install() {
    installStyles();
    const result = document.getElementById("diagnosticResult");
    if (!result) return;
    const observer = new MutationObserver(scheduleRender);
    observer.observe(result, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    result.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-rpc-danfoss-open]");
      if (button) openRelated(button.dataset.rpcDanfossOpen);
    });
    document.addEventListener("click", (event) => {
      if (event.target.closest?.("[data-open-entry],#faultSearchButton,.sf-search-result")) global.setTimeout(render, 0);
    });
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);
