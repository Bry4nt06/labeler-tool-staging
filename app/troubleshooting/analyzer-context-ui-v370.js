"use strict";

(function installAnalyzerContextUi(global) {
  const library = global.ServoForgeTroubleshootingLibrary;
  const universal = global.ServoForgeUniversalTroubleshooting;
  if (!library || !universal) return;

  const id = (name) => document.getElementById(name);
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function installStyles() {
    if (id("sfAnalyzerContextStyles")) return;
    const style = document.createElement("style");
    style.id = "sfAnalyzerContextStyles";
    style.textContent = `
      .sf-analyzer-context-panel { border-color: rgba(82, 184, 255, .42); }
      .sf-analyzer-context-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      .sf-analyzer-context-chip { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--input); }
      .sf-analyzer-context-chip small { color: var(--muted); text-transform: uppercase; letter-spacing: .06em; font-size: 9px; }
      .sf-analyzer-context-chip strong { font-size: 12px; }
      .sf-analyzer-evidence { border-color: rgba(82, 184, 255, .36); background: rgba(82, 184, 255, .05); }
      .sf-analyzer-evidence-boundary { margin: 0 0 10px; color: var(--muted); font-size: 11px; line-height: 1.5; }
      .sf-analyzer-binding-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
      .sf-analyzer-binding { padding: 9px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--input); }
      .sf-analyzer-binding code { display: block; overflow-wrap: anywhere; color: var(--ink); }
      .sf-analyzer-binding small { display: block; margin-top: 4px; color: var(--muted); line-height: 1.4; }
      .sf-analyzer-context-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    `;
    document.head.appendChild(style);
  }

  function context() {
    return typeof library.getAnalyzerContext === "function" ? library.getAnalyzerContext() : null;
  }

  function renderPanel() {
    const panel = id("analyzerContextPanel");
    const chips = id("analyzerContextChips");
    const status = id("analyzerContextStatus");
    if (!panel || !chips || !status) return;
    const handoff = context();
    if (!handoff) {
      panel.hidden = true;
      chips.innerHTML = "";
      status.textContent = "";
      return;
    }
    panel.hidden = false;
    const controller = handoff.controller || {};
    const familyCount = handoff.families?.length || 0;
    const bindingCount = handoff.statistics?.storedBindings || handoff.bindings?.length || 0;
    const rows = [
      ["Controller", controller.expectedControllerId || controller.parsedController],
      ["Source file", controller.sourceFile],
      ["Source status", controller.sourceStatus],
      ["Families", familyCount],
      ["Mapped targets", bindingCount]
    ].filter(([, value]) => value !== null && value !== undefined && String(value).trim());
    chips.innerHTML = rows.map(([label, value]) => `<span class="sf-analyzer-context-chip"><small>${esc(label)}</small><strong>${esc(value)}</strong></span>`).join("");
    status.textContent = "Temporary controller evidence is active. Universal troubleshooting methods remain unchanged.";
  }

  function formatLocation(writer) {
    return [writer?.program, writer?.routine, writer?.rung !== null && writer?.rung !== undefined ? `rung ${writer.rung}` : "", writer?.line ? `line ${writer.line}` : ""]
      .filter(Boolean)
      .join(" / ");
  }

  function currentUniversalEntry() {
    const result = id("diagnosticResult");
    if (!result || result.hidden) return null;
    const code = String(result.querySelector(".sf-result-head h2")?.textContent || "").trim();
    if (!code.startsWith("UNIVERSAL")) return null;
    return (library.universalMethods || []).find((entry) => String(entry.code || entry.title).trim() === code) || null;
  }

  function analyzerEvidenceMarkup(entry) {
    const evidence = entry && typeof library.getAnalyzerEvidenceForEntry === "function"
      ? library.getAnalyzerEvidenceForEntry(entry)
      : null;
    if (!evidence?.bindings?.length) return "";
    const controller = evidence.controller || {};
    const rows = evidence.bindings.map((binding) => {
      const locations = (binding.writers || []).map(formatLocation).filter(Boolean);
      return `<li class="sf-analyzer-binding"><code>${esc(binding.target || "controller target")}</code><small>${esc(locations.length ? locations.join(" • ") : "Source target located; writer location not extracted")}</small></li>`;
    }).join("");
    const extra = evidence.totalBindings > evidence.bindings.length ? ` Showing ${evidence.bindings.length} of ${evidence.totalBindings} matching targets.` : "";
    return `<section class="sf-result-section sf-analyzer-evidence" data-analyzer-evidence>
      <h4>Controller-specific Analyzer evidence</h4>
      <p class="sf-analyzer-evidence-boundary"><strong>${esc(controller.parsedController || controller.expectedControllerId || "Uploaded controller")}</strong>${controller.sourceFile ? ` • ${esc(controller.sourceFile)}` : ""}. These tags and rung locations belong to the uploaded controller context only; they do not redefine the universal diagnostic method.${esc(extra)}</p>
      <ul class="sf-analyzer-binding-list">${rows}</ul>
    </section>`;
  }

  function renderResultEvidence() {
    const result = id("diagnosticResult");
    if (!result || result.hidden) return;
    result.querySelector("[data-analyzer-evidence]")?.remove();
    const entry = currentUniversalEntry();
    if (!entry) return;
    const markup = analyzerEvidenceMarkup(entry);
    if (!markup) return;
    const sourceSection = result.querySelector(".sf-result-section.sources");
    if (sourceSection) sourceSection.insertAdjacentHTML("beforebegin", markup);
    else result.insertAdjacentHTML("beforeend", markup);
  }

  function clearContext() {
    library.clearAnalyzerContext?.();
    renderPanel();
    renderResultEvidence();
  }

  function bind() {
    installStyles();
    renderPanel();
    id("clearAnalyzerContext")?.addEventListener("click", clearContext);
    const result = id("diagnosticResult");
    if (result) {
      const observer = new MutationObserver(() => global.setTimeout(renderResultEvidence, 0));
      observer.observe(result, { childList: true, subtree: false, attributes: true, attributeFilter: ["hidden"] });
      renderResultEvidence();
    }
  }

  global.ServoForgeTroubleshootingAnalyzerContextUi = Object.freeze({
    version: "v370",
    renderPanel,
    renderResultEvidence,
    clearContext
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})(window);
