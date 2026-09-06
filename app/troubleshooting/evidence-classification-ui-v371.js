"use strict";

(function installTroubleshootingEvidenceClassificationUi(global) {
  const library = global.ServoForgeTroubleshootingLibrary;
  if (!library?.getEntryEvidenceClass || !library?.getFlowEvidenceClass || !library?.getSourceEvidenceClass) return;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installStyles() {
    if (document.getElementById("sfEvidenceClassificationV371Styles")) return;
    const style = document.createElement("style");
    style.id = "sfEvidenceClassificationV371Styles";
    style.textContent = `
      .sf-evidence-legend { display: grid; gap: 10px; }
      .sf-evidence-legend-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(210px,1fr)); gap: 8px; }
      .sf-evidence-legend-item { padding: 10px 11px; border: 1px solid var(--line); border-radius: 8px; background: var(--input); }
      .sf-evidence-legend-item p { margin: 7px 0 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
      .sf-evidence-badge { display: inline-flex; align-items: center; width: fit-content; margin: 4px 6px 4px 0; padding: 3px 7px; border: 1px solid var(--line); border-radius: 999px; font-size: 9px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; background: var(--input); color: var(--ink); }
      .sf-evidence-badge[data-evidence-class="universal-method"] { border-style: solid; }
      .sf-evidence-badge[data-evidence-class="machine-family-evidence"] { border-style: dashed; }
      .sf-evidence-badge[data-evidence-class="site-plc-evidence"] { border-style: double; }
      .sf-entry-card [data-evidence-badge], .sf-result-head [data-evidence-badge] { margin-top: 5px; }
      .sf-source-card [data-evidence-badge] { margin: 6px 0 2px; }
      .sf-guide-kicker [data-evidence-badge] { margin-left: 6px; vertical-align: middle; }
      @media print { .sf-evidence-legend { display: none !important; } .sf-evidence-badge { border: 1px solid #777; } }
    `;
    document.head.appendChild(style);
  }

  function badge(classification, context = "") {
    if (!classification) return "";
    const title = [classification.description, classification.reason, context].filter(Boolean).join(" ");
    return `<span class="sf-evidence-badge" data-evidence-badge data-evidence-class="${esc(classification.id)}" title="${esc(title)}">${esc(classification.label)}</span>`;
  }

  function installLegend() {
    if (document.getElementById("troubleshootingEvidenceLegend")) return;
    const hero = document.querySelector(".sf-troubleshooting-hero");
    if (!hero) return;
    const classes = [library.EVIDENCE_CLASS.UNIVERSAL, library.EVIDENCE_CLASS.MACHINE_FAMILY, library.EVIDENCE_CLASS.SITE_PLC];
    const section = document.createElement("section");
    section.id = "troubleshootingEvidenceLegend";
    section.className = "panel sf-evidence-legend";
    section.setAttribute("aria-label", "Troubleshooting evidence authority");
    section.innerHTML = `
      <div class="sf-section-heading">
        <div><span class="sf-eyebrow">Evidence authority</span><h2>How to read this troubleshooting result</h2></div>
        <p>These labels describe scope and transferability—not fault severity or confidence.</p>
      </div>
      <div class="sf-evidence-legend-grid">
        ${classes.map((item) => `<div class="sf-evidence-legend-item">${badge(item)}<p>${esc(item.description)}</p></div>`).join("")}
      </div>
    `;
    hero.insertAdjacentElement("afterend", section);
  }

  function decorateGuides() {
    document.querySelectorAll(".sf-guide-card[data-flow-id]").forEach((card) => {
      if (card.querySelector("[data-evidence-badge]")) return;
      const classification = library.getFlowEvidenceClass(card.dataset.flowId);
      const target = card.querySelector(".sf-guide-kicker") || card;
      target.insertAdjacentHTML("beforeend", badge(classification));
      card.dataset.evidenceClass = classification?.id || "";
    });
  }

  function decorateEntryCards() {
    document.querySelectorAll(".sf-entry-card[data-entry-id]").forEach((card) => {
      if (card.querySelector("[data-evidence-badge]")) return;
      const entry = library.getEntry(card.dataset.entryId);
      const classification = library.getEntryEvidenceClass(entry);
      const target = card.querySelector("header > div") || card.querySelector("header") || card;
      target.insertAdjacentHTML("beforeend", badge(classification));
      card.dataset.evidenceClass = classification?.id || "";
    });
  }

  function currentResultEntry() {
    const result = document.getElementById("diagnosticResult");
    if (!result || result.hidden) return null;
    const code = String(result.querySelector(".sf-result-head h2")?.textContent || "").trim();
    const title = String(result.querySelector(".sf-result-head p")?.textContent || "").trim();
    return library.entries.find((entry) => String(entry.code || entry.title || "").trim() === code && String(entry.title || "").trim() === title)
      || library.entries.find((entry) => String(entry.code || entry.title || "").trim() === code)
      || null;
  }

  function decorateResult() {
    const result = document.getElementById("diagnosticResult");
    if (!result || result.hidden || result.querySelector("[data-result-evidence-badge]")) return;
    const entry = currentResultEntry();
    if (!entry) return;
    const classification = library.getEntryEvidenceClass(entry);
    const target = result.querySelector(".sf-result-head > div:first-child");
    if (!target) return;
    const wrapper = document.createElement("div");
    wrapper.dataset.resultEvidenceBadge = "true";
    wrapper.innerHTML = badge(classification, classification?.activeOverlay ? "Active Analyzer carryover for this browser session." : "");
    target.appendChild(wrapper);
    result.dataset.evidenceClass = classification?.id || "";
  }

  function decorateSources() {
    document.querySelectorAll(".sf-source-card").forEach((card) => {
      if (card.querySelector("[data-evidence-badge]")) return;
      const file = String(card.querySelector("code")?.textContent || "").trim();
      const source = library.sources.find((item) => String(item.file || "").trim() === file);
      if (!source) return;
      const classification = library.getSourceEvidenceClass(source);
      const strong = card.querySelector("strong");
      if (strong) strong.insertAdjacentHTML("afterend", badge(classification));
      card.dataset.evidenceClass = classification?.id || "";
    });
  }

  function decorateOverlayPanel() {
    const panel = document.getElementById("troubleshootingPlcOverlayStatus");
    if (!panel || panel.querySelector("[data-evidence-badge]")) return;
    const classification = library.EVIDENCE_CLASS.SITE_PLC;
    const heading = panel.querySelector(".sf-section-heading > div");
    if (heading) heading.insertAdjacentHTML("beforeend", badge(classification, "Active Analyzer carryover; clearing the carried controller removes this evidence."));
    panel.dataset.evidenceClass = classification.id;
  }

  function decorate() {
    decorateGuides();
    decorateEntryCards();
    decorateResult();
    decorateSources();
    decorateOverlayPanel();
    const validation = document.getElementById("libraryValidationStatus");
    if (validation) validation.dataset.evidenceClassification = "v371";
  }

  let scheduled = false;
  function scheduleDecorate() {
    if (scheduled) return;
    scheduled = true;
    global.setTimeout(() => {
      scheduled = false;
      decorate();
    }, 0);
  }

  function initialize() {
    installStyles();
    installLegend();
    decorate();
    const main = document.querySelector("main.troubleshooting-app");
    if (main && typeof global.MutationObserver === "function") {
      const observer = new global.MutationObserver(scheduleDecorate);
      observer.observe(main, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})(window);
