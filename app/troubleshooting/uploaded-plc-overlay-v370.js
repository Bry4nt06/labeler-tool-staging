"use strict";

(function installUploadedPlcOverlay(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createUploadedPlcOverlayExtension() {
  const STORAGE_KEY = "servoforge.troubleshooting.plcOverlay.v1";

  function clean(value, maxLength = 240) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, maxLength) : "";
  }

  function readOverlay(root) {
    try {
      const parsed = JSON.parse(root?.sessionStorage?.getItem(STORAGE_KEY) || "null");
      return parsed?.schema === "servoforge-troubleshooting-plc-overlay-v1" ? parsed : null;
    } catch {
      return null;
    }
  }

  function entryId(target, index) {
    const safe = clean(target, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || `target-${index + 1}`;
    return `uploaded-plc-overlay-${index + 1}-${safe}`;
  }

  function writerLocation(writer = {}) {
    return [writer.program, writer.routine, writer.rung != null ? `rung ${writer.rung}` : null, writer.line != null ? `line ${writer.line}` : null].filter(Boolean).join(" / ");
  }

  function buildEntries(overlay) {
    if (!overlay) return [];
    const controllerLabel = overlay.assetLabel || overlay.controllerName || overlay.sourceFile || "uploaded controller";
    return (overlay.candidates || []).map((candidate, index) => {
      const writerSymbols = [...new Set((candidate.writers || []).flatMap((writer) => writer.symbols || []).filter(Boolean))];
      const aliases = [candidate.target, ...writerSymbols, ...(candidate.upstreamSymbols || [])].filter(Boolean);
      const locations = (candidate.writers || []).map(writerLocation).filter(Boolean);
      return Object.freeze({
        id: entryId(candidate.target, index),
        code: candidate.target,
        category: "Uploaded PLC / Site overlay",
        aliases,
        contextHints: ["uploaded plc", "site overlay", overlay.siteLabel, overlay.assetLabel, overlay.controllerRole, overlay.controllerName].filter(Boolean),
        title: `Site PLC evidence — ${candidate.target}`,
        summary: `${candidate.target} appears in the currently carried PLC export for ${controllerLabel}. This is machine-specific source evidence only; the tag/address is not a universal ServoForge fault definition and must not be transferred to another site without local source verification.`,
        probableCauses: [
          "The local PLC target may be associated with the active symptom, but its name alone does not establish the universal failure mode or root cause.",
          "A site-specific implementation may use different tag names, addresses, routines, or alarm numbering for the same physical failure mechanism."
        ],
        checks: [
          locations.length ? `Use the uploaded source locations as a local map: ${locations.slice(0, 5).join("; ")}.` : "Use the uploaded PLC writer evidence to locate the local source logic before interpreting the tag.",
          "Identify what physical condition the local target supervises, then continue with the matching universal troubleshooting path: power, safety/permissive, communication, sensing, timing/synchronization, motion, mechanical condition, or process condition.",
          "Correlate local tag state with the actual machine symptom and chronology; do not assume that the tag name or alarm number used at another site will match this controller.",
          "Treat timer values, addresses, I/O references, and dependency names as local evidence only. Do not copy them to another machine as settings or standards."
        ],
        actions: [
          "Use the uploaded PLC evidence to localize this machine's implementation, then return to the universal diagnostic method for root-cause isolation.",
          "Do not modify PLC logic, force bits, bypass interlocks, or change machine parameters merely because the uploaded source exposes a tag or rung."
        ],
        safety: [
          "Use normal HMI/PLC diagnostics and source review first. Do not force outputs, defeat guards, or bypass safety/interlock logic.",
          "Follow the site's lockout/tagout and stored-energy procedures before hands-on mechanical, wiring, connector, cabinet, or servo work.",
          "Energized electrical or signal measurements are for qualified personnel under the site's approved electrical safe-work program."
        ],
        sourceRefs: [],
        uploadedPlcOverlay: Object.freeze({
          authority: overlay.authority,
          sourceFile: overlay.sourceFile,
          controllerName: overlay.controllerName,
          siteLabel: overlay.siteLabel,
          assetLabel: overlay.assetLabel,
          controllerRole: overlay.controllerRole,
          target: candidate.target,
          writers: candidate.writers || [],
          resets: candidate.resets || [],
          relatedTimers: candidate.relatedTimers || [],
          relatedCounters: candidate.relatedCounters || [],
          ioReferences: candidate.ioReferences || [],
          motionReferences: candidate.motionReferences || [],
          upstreamSymbols: candidate.upstreamSymbols || []
        })
      });
    });
  }

  function installOverlayPanel(root, overlay) {
    if (!root?.document || !overlay || root.document.getElementById("troubleshootingPlcOverlayStatus")) return;
    const contextPanel = root.document.querySelector(".sf-context-panel");
    if (!contextPanel) return;
    const panel = root.document.createElement("section");
    panel.id = "troubleshootingPlcOverlayStatus";
    panel.className = "panel";
    const controller = clean(overlay.assetLabel || overlay.controllerName || overlay.sourceFile || "Uploaded controller");
    const site = clean(overlay.siteLabel);
    panel.innerHTML = `<div class="sf-section-heading"><div><span class="sf-eyebrow">Site PLC overlay</span><h2>${controller}</h2></div><button id="troubleshootingPlcOverlayClear" type="button" class="secondary-button">Clear carried controller</button></div><p>${site ? `${site} • ` : ""}${(overlay.candidates || []).length} machine-specific PLC target(s) available for this browser session. Local tags and addresses can assist search, but they do not replace or modify the universal troubleshooting library.</p>`;
    contextPanel.insertAdjacentElement("afterend", panel);
    root.document.getElementById("troubleshootingPlcOverlayClear")?.addEventListener("click", () => {
      try { root.sessionStorage.removeItem(STORAGE_KEY); } catch {}
      root.location.reload();
    });
  }

  return function extendLibrary(base, root) {
    if (!base?.searchEntries || !base?.normalize) throw new Error("ServoForge troubleshooting library is required before the uploaded PLC overlay.");
    const overlay = readOverlay(root);
    if (!overlay) return base;
    const overlayEntries = buildEntries(overlay);
    const overlayById = new Map(overlayEntries.map((entry) => [entry.id, entry]));
    const baseSearchEntries = base.searchEntries.bind(base);
    const baseGetEntry = typeof base.getEntry === "function" ? base.getEntry.bind(base) : null;

    function overlayMatches(query) {
      const normalized = base.normalize(query);
      if (!normalized) return [];
      return overlayEntries.filter((entry) => {
        const haystack = base.normalize([entry.code, entry.title, ...(entry.aliases || [])].join(" "));
        return haystack.includes(normalized) || normalized.includes(base.normalize(entry.code));
      });
    }

    function searchEntries(query, context = {}) {
      const local = overlayMatches(query);
      const standard = baseSearchEntries(query, context) || [];
      const seen = new Set(local.map((entry) => entry.id));
      return [...local, ...standard.filter((entry) => !seen.has(entry.id))];
    }

    function getEntry(id) {
      return overlayById.get(id) || baseGetEntry?.(id) || null;
    }

    const extended = Object.freeze({
      ...base,
      entries: Object.freeze([...(base.entries || []), ...overlayEntries]),
      searchEntries,
      getEntry,
      uploadedPlcOverlay: Object.freeze({
        active: true,
        authority: overlay.authority,
        siteLabel: overlay.siteLabel || null,
        assetLabel: overlay.assetLabel || null,
        controllerRole: overlay.controllerRole || null,
        controllerName: overlay.controllerName || null,
        sourceFile: overlay.sourceFile || null,
        candidateCount: overlayEntries.length,
        universalLibraryModified: false
      })
    });

    const render = () => installOverlayPanel(root, overlay);
    if (root?.document?.readyState === "loading") root.document.addEventListener("DOMContentLoaded", render, { once: true });
    else root?.setTimeout?.(render, 0);
    return extended;
  };
});
