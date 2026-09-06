"use strict";

(function installUniversalTroubleshootingHandoffUi(global) {
  const library = global.ServoForgeTroubleshootingLibrary;
  if (!library?.getUniversalHandoff || !library?.getUniversalMethod) return;

  const HANDOFF_SESSION_KEY = "servoforge.troubleshooting.universalHandoff.v1";

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeJson(raw, fallback = null) {
    try { return JSON.parse(raw); }
    catch { return fallback; }
  }

  function installStyles() {
    if (document.getElementById("sfUniversalHandoffV372Styles")) return;
    const style = document.createElement("style");
    style.id = "sfUniversalHandoffV372Styles";
    style.textContent = `
      .sf-universal-handoff { border: 1px solid var(--line); border-radius: 9px; padding: 12px; background: var(--input); }
      .sf-universal-handoff h4 { margin: 0 0 7px; }
      .sf-universal-handoff p { margin: 6px 0; line-height: 1.5; }
      .sf-universal-handoff-primary { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 9px 0; }
      .sf-universal-handoff-primary strong { font-size: 13px; }
      .sf-universal-handoff-confidence { display: inline-flex; padding: 2px 6px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
      .sf-universal-handoff-actions { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 9px; }
      .sf-universal-handoff-note { color: var(--muted); font-size: 11px; }
      .sf-universal-handoff-context { margin: 0 0 12px; padding: 10px 11px; border: 1px dashed var(--line); border-radius: 8px; background: var(--input); }
      .sf-universal-handoff-context strong { display: block; margin-bottom: 4px; }
      .sf-universal-handoff-card-note { display: block; margin-top: 7px; color: var(--muted); font-size: 10px; line-height: 1.4; }
      .sf-universal-overlay-routing { margin-top: 7px; color: var(--muted); font-size: 11px; line-height: 1.45; }
      @media print { .sf-universal-handoff-actions, .sf-universal-overlay-routing { display: none !important; } }
    `;
    document.head.appendChild(style);
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

  function readActiveHandoff() {
    try {
      const parsed = safeJson(global.sessionStorage?.getItem(HANDOFF_SESSION_KEY), null);
      return parsed?.schema === library.UNIVERSAL_HANDOFF_SCHEMA ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeActiveHandoff(handoff, methodEntryId) {
    if (!handoff || !methodEntryId) return;
    const selected = [handoff.primary, ...(handoff.alternatives || [])].find((item) => item.entryId === methodEntryId) || handoff.primary;
    const payload = {
      schema: handoff.schema,
      authority: "routing-hint-only",
      sourceEntryId: handoff.sourceEntryId,
      sourceTarget: handoff.sourceTarget,
      sourceAuthority: handoff.sourceAuthority,
      methodEntryId,
      methodLabel: selected?.label || "Universal Method",
      createdAt: new Date().toISOString(),
      boundary: handoff.boundary
    };
    try { global.sessionStorage?.setItem(HANDOFF_SESSION_KEY, JSON.stringify(payload)); } catch {}
  }

  function routeButton(item, primary = false) {
    if (!item?.entryId) return "";
    const method = library.getUniversalMethod(item.entryId);
    if (!method) return "";
    const label = primary ? `Open universal ${item.label} method` : `Alternative: ${item.label}`;
    return `<button type="button" ${primary ? "" : "class=\"secondary-button\""} data-universal-handoff-entry="${esc(item.entryId)}">${esc(label)}</button>`;
  }

  function handoffMarkup(handoff) {
    if (!handoff?.primary) return "";
    const primary = handoff.primary;
    const alternatives = handoff.alternatives || [];
    const evidenceSummary = primary.signals?.length
      ? primary.signals.slice(0, 3).join(" • ")
      : "The carried PLC evidence does not expose a stronger physical failure mechanism yet.";
    return `
      <section class="sf-result-section sf-universal-handoff" data-universal-handoff-panel>
        <h4>Continue with Universal Method</h4>
        <p>ServoForge used this controller's temporary PLC evidence only to rank the next transferable troubleshooting method. This is a routing hint—not proof of root cause.</p>
        <div class="sf-universal-handoff-primary">
          <strong>${esc(primary.label)}</strong>
          <span class="sf-universal-handoff-confidence">${esc(primary.confidence)} routing confidence</span>
        </div>
        <p class="sf-universal-handoff-note">Why it ranked here: ${esc(evidenceSummary)}.</p>
        <p class="sf-universal-handoff-note">${esc(handoff.boundary)}</p>
        <div class="sf-universal-handoff-actions">
          ${routeButton(primary, true)}
          ${alternatives.map((item) => routeButton(item, false)).join("")}
        </div>
      </section>
    `;
  }

  function decorateSiteResult() {
    const result = document.getElementById("diagnosticResult");
    if (!result || result.hidden || result.querySelector("[data-universal-handoff-panel]")) return;
    const entry = currentResultEntry();
    if (!entry?.uploadedPlcOverlay) return;
    const handoff = library.getUniversalHandoff(entry);
    if (!handoff) return;
    const summary = result.querySelector(".sf-result-summary");
    if (summary) summary.insertAdjacentHTML("afterend", handoffMarkup(handoff));
    else result.insertAdjacentHTML("beforeend", handoffMarkup(handoff));
    result.dataset.universalHandoff = handoff.primary.entryId;
  }

  function decorateUniversalArrival() {
    const result = document.getElementById("diagnosticResult");
    if (!result || result.hidden || result.querySelector("[data-universal-handoff-context]")) return;
    const entry = currentResultEntry();
    const active = readActiveHandoff();
    if (!entry || !active || entry.id !== active.methodEntryId) return;
    const head = result.querySelector(".sf-result-head");
    if (!head) return;
    const context = document.createElement("div");
    context.className = "sf-universal-handoff-context";
    context.dataset.universalHandoffContext = "true";
    context.innerHTML = `
      <strong>Handoff from Site PLC Evidence</strong>
      <span>${esc(active.sourceTarget || "Local PLC target")} → ${esc(active.methodLabel || "Universal Method")}</span>
      <p class="sf-universal-handoff-note">The local tag/rung remains site-specific. The diagnostic below is the transferable failure-isolation method.</p>
      <div class="sf-universal-handoff-actions"><button type="button" class="secondary-button" data-universal-handoff-back>Back to site PLC evidence</button></div>
    `;
    head.insertAdjacentElement("afterend", context);
  }

  function decorateSiteCards() {
    document.querySelectorAll(".sf-entry-card[data-entry-id]").forEach((card) => {
      if (card.querySelector("[data-universal-handoff-card-note]")) return;
      const entry = library.getEntry(card.dataset.entryId);
      if (!entry?.uploadedPlcOverlay) return;
      const handoff = library.getUniversalHandoff(entry);
      if (!handoff?.primary) return;
      const note = document.createElement("span");
      note.className = "sf-universal-handoff-card-note";
      note.dataset.universalHandoffCardNote = "true";
      note.textContent = `Universal handoff: ${handoff.primary.label} (${handoff.primary.confidence} routing confidence)`;
      card.appendChild(note);
    });
  }

  function decorateOverlayPanel() {
    const panel = document.getElementById("troubleshootingPlcOverlayStatus");
    if (!panel || panel.querySelector("[data-universal-overlay-routing]")) return;
    const siteEntries = library.entries.filter((entry) => entry?.uploadedPlcOverlay);
    if (!siteEntries.length) return;
    const counts = new Map();
    for (const entry of siteEntries) {
      const handoff = library.getUniversalHandoff(entry);
      const label = handoff?.primary?.label;
      if (label) counts.set(label, (counts.get(label) || 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const row = document.createElement("p");
    row.className = "sf-universal-overlay-routing";
    row.dataset.universalOverlayRouting = "true";
    row.textContent = top.length
      ? `Universal routing ready for ${siteEntries.length} carried target(s). Most common first-pass methods: ${top.map(([label, count]) => `${label} (${count})`).join(" • ")}.`
      : `Universal routing ready for ${siteEntries.length} carried target(s).`;
    panel.appendChild(row);
  }

  function openUniversalMethod(entryId) {
    const current = currentResultEntry();
    const handoff = current?.uploadedPlcOverlay ? library.getUniversalHandoff(current) : null;
    const method = library.getUniversalMethod(entryId);
    if (!handoff || !method) return;
    writeActiveHandoff(handoff, entryId);
    const search = document.getElementById("faultSearch");
    const searchButton = document.getElementById("faultSearchButton");
    if (!search || !searchButton) return;
    search.value = method.code;
    searchButton.click();
  }

  function backToSiteEvidence() {
    const active = readActiveHandoff();
    if (!active?.sourceTarget) return;
    const search = document.getElementById("faultSearch");
    const searchButton = document.getElementById("faultSearchButton");
    if (!search || !searchButton) return;
    search.value = active.sourceTarget;
    searchButton.click();
  }

  function decorate() {
    decorateSiteCards();
    decorateSiteResult();
    decorateUniversalArrival();
    decorateOverlayPanel();
    const validation = document.getElementById("libraryValidationStatus");
    if (validation) validation.dataset.universalHandoff = "v372";
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

  function bind() {
    const main = document.querySelector("main.troubleshooting-app");
    if (!main || main.dataset.universalHandoffBound === "true") return;
    main.dataset.universalHandoffBound = "true";
    main.addEventListener("click", (event) => {
      const route = event.target.closest("[data-universal-handoff-entry]");
      if (route) {
        openUniversalMethod(route.dataset.universalHandoffEntry);
        return;
      }
      if (event.target.closest("[data-universal-handoff-back]")) backToSiteEvidence();
    });
  }

  function initialize() {
    installStyles();
    bind();
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
