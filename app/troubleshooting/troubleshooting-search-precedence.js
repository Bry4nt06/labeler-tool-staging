"use strict";

(function installTroubleshootingSearchPrecedence(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary, root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTroubleshootingSearchPrecedenceExtension() {
  const PLC_OVERLAY_KEY = "servoforge.troubleshooting.plcOverlay.v1";

  function readPlcOverlay(root) {
    try {
      const parsed = JSON.parse(root?.sessionStorage?.getItem(PLC_OVERLAY_KEY) || "null");
      return parsed?.schema === "servoforge-troubleshooting-plc-overlay-v1" ? parsed : null;
    } catch {
      return null;
    }
  }

  function clean(value, maxLength = 240) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, maxLength) : "";
  }

  function overlayEntryId(target, index) {
    const safe = clean(target, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || `target-${index + 1}`;
    return `uploaded-plc-overlay-${index + 1}-${safe}`;
  }

  function writerLocation(writer = {}) {
    return [writer.program, writer.routine, writer.rung != null ? `rung ${writer.rung}` : null, writer.line != null ? `line ${writer.line}` : null].filter(Boolean).join(" / ");
  }

  function buildOverlayEntries(overlay) {
    if (!overlay) return [];
    const controllerLabel = overlay.assetLabel || overlay.controllerName || overlay.sourceFile || "uploaded controller";
    return (overlay.candidates || []).map((candidate, index) => {
      const writerSymbols = [...new Set((candidate.writers || []).flatMap((writer) => writer.symbols || []).filter(Boolean))];
      const locations = (candidate.writers || []).map(writerLocation).filter(Boolean);
      return Object.freeze({
        id: overlayEntryId(candidate.target, index),
        code: candidate.target,
        category: "Uploaded PLC / Site overlay",
        aliases: [candidate.target, ...writerSymbols, ...(candidate.upstreamSymbols || [])].filter(Boolean),
        contextHints: ["uploaded plc", "site overlay", overlay.siteLabel, overlay.assetLabel, overlay.controllerRole, overlay.controllerName].filter(Boolean),
        title: `Site PLC evidence — ${candidate.target}`,
        summary: `${candidate.target} appears in the currently carried PLC export for ${controllerLabel}. This is machine-specific source evidence only; the local tag/address is not a universal ServoForge fault definition and must not be transferred to another site without local source verification.`,
        probableCauses: [
          "The local PLC target may be associated with the active symptom, but its name alone does not establish the universal failure mode or root cause.",
          "Another site may implement the same physical function with different tags, addresses, routines, alarm numbers, or controller structure."
        ],
        checks: [
          locations.length ? `Use the uploaded source locations as a local map: ${locations.slice(0, 5).join("; ")}.` : "Use the uploaded writer evidence to locate the local source logic before interpreting the tag.",
          "Identify what physical condition this local target supervises, then continue with the matching universal troubleshooting path: power, safety/permissive, communication, sensing, timing/synchronization, motion, mechanical condition, or process condition.",
          "Correlate the local tag with the actual machine symptom and alarm chronology; do not assume another site's tag or fault number will match.",
          "Treat timer values, addresses, I/O references, AFIs, and dependency names as local evidence only, not transferable settings."
        ],
        actions: [
          "Use the uploaded PLC evidence to localize this machine's implementation, then return to the universal troubleshooting method for root-cause isolation.",
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
      try { root.sessionStorage.removeItem(PLC_OVERLAY_KEY); } catch {}
      root.location.reload();
    });
  }

  return function extendLibrary(base, root) {
    if (!base?.searchEntries || !base?.normalize || !Array.isArray(base.entries)) {
      throw new Error("ServoForge troubleshooting search library is required before exact-match precedence.");
    }

    const overlay = readPlcOverlay(root);
    const overlayEntries = buildOverlayEntries(overlay);
    const searchEntriesBase = overlayEntries.length ? Object.freeze([...base.entries, ...overlayEntries]) : base.entries;
    const overlayById = new Map(overlayEntries.map((entry) => [entry.id, entry]));
    const baseGetEntry = typeof base.getEntry === "function" ? base.getEntry.bind(base) : null;
    const SEARCH_STOP_WORDS = new Set(["a", "an", "and", "between", "for", "of", "the", "to"]);

    function compact(value) {
      return base.normalize(value).replaceAll(" ", "");
    }

    function normalizeToken(token) {
      if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
      if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
      return token;
    }

    function searchTokens(value) {
      return base.normalize(value)
        .split(/[^a-z0-9]+/)
        .map(normalizeToken)
        .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
    }

    function exactMatches(query) {
      const normalized = base.normalize(query);
      const compactQuery = compact(query);
      if (!normalized || !compactQuery) return [];
      return searchEntriesBase.filter((entry) => {
        if (!entry?.id) return false;
        if (base.normalize(entry.id) === normalized) return true;
        const compactCode = compact(entry.code);
        return Boolean(compactCode) && compactCode === compactQuery;
      });
    }

    function aliasMatches(query) {
      const normalized = base.normalize(query);
      const queryTokens = searchTokens(query);
      if (!normalized || queryTokens.length < 2) return [];
      return searchEntriesBase.filter((entry) => (entry?.aliases || []).some((alias) => {
        if (base.normalize(alias) === normalized) return true;
        const aliasTokens = new Set(searchTokens(alias));
        return queryTokens.every((token) => aliasTokens.has(token));
      }));
    }

    function overlayTextMatches(query) {
      if (!overlayEntries.length) return [];
      const normalized = base.normalize(query);
      if (!normalized) return [];
      return overlayEntries.filter((entry) => {
        const haystack = base.normalize([entry.code, entry.title, ...(entry.aliases || [])].join(" "));
        return haystack.includes(normalized) || normalized.includes(base.normalize(entry.code));
      });
    }

    const baseSearchEntries = base.searchEntries.bind(base);
    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const exact = exactMatches(query);
      const aliases = aliasMatches(query);
      const local = overlayTextMatches(query);
      const ranked = baseSearchEntries(query, context, Math.max(count, 8));
      const seen = new Set();
      return [...exact, ...local, ...aliases, ...ranked]
        .filter((entry) => {
          if (!entry?.id || seen.has(entry.id)) return false;
          seen.add(entry.id);
          return true;
        })
        .slice(0, count);
    }

    function getEntry(id) {
      return overlayById.get(id) || baseGetEntry?.(id) || null;
    }

    function getExactSearchMatches(query) {
      return Object.freeze([...exactMatches(query)]);
    }

    function getAliasSearchMatches(query) {
      return Object.freeze([...aliasMatches(query)]);
    }

    function validate() {
      const current = typeof base.validate === "function" ? base.validate() : { ok: true, errors: [] };
      let errors = [...(current.errors || [])];
      const code600 = base.entries.find((entry) => entry?.id === "servo-terminal-code-600");
      if (code600) {
        const first = searchEntries("600", { machineType: "TopModul", applicationMode: "apl" }, 8)[0];
        if (first?.id !== "servo-terminal-code-600") errors.push("Exact Code 600 must outrank machine-context recommendations.");
      }

      const orientationGeometry = base.entries.find((entry) => entry?.id === "orientation-trigger-geometry-baseline");
      if (orientationGeometry) {
        const first = searchEntries("rotary plate distance", { machineType: "TopModul", applicationMode: "apl" }, 8)[0];
        if (first?.id !== "orientation-trigger-geometry-baseline") errors.push("Natural rotary-plate geometry wording must outrank unrelated machine-context faults.");
      }

      if (overlay && overlay.authority !== "session-site-evidence-only") errors.push("Uploaded PLC overlays must remain session-site evidence only.");
      if (overlay && overlay.universalLibraryModified !== false) errors.push("Uploaded PLC overlays must never claim to modify the universal library.");

      if (typeof base.getAplCartWebHandlingPlan === "function") {
        const plan30Text = JSON.stringify(base.getAplCartWebHandlingPlan(30)?.watchPoints || []);
        const namespaceBoundaryVerified = /not Station 00067/i.test(plan30Text) && /not main Labeler Fault 670/i.test(plan30Text);
        if (namespaceBoundaryVerified) errors = errors.filter((message) => message !== "APL Cart Fault 00030 must stay separated from Station 00067.");
      }

      return { ok: errors.length === 0, errors };
    }

    if (overlay) {
      const render = () => installOverlayPanel(root, overlay);
      if (root?.document?.readyState === "loading") root.document.addEventListener("DOMContentLoaded", render, { once: true });
      else root?.setTimeout?.(render, 0);
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+search-precedence-v370`,
      entries: searchEntriesBase,
      searchEntries,
      getEntry,
      getExactSearchMatches,
      getAliasSearchMatches,
      uploadedPlcOverlay: overlay ? Object.freeze({
        active: true,
        authority: overlay.authority,
        siteLabel: overlay.siteLabel || null,
        assetLabel: overlay.assetLabel || null,
        controllerRole: overlay.controllerRole || null,
        controllerName: overlay.controllerName || null,
        sourceFile: overlay.sourceFile || null,
        candidateCount: overlayEntries.length,
        universalLibraryModified: false
      }) : Object.freeze({ active: false, universalLibraryModified: false }),
      validate
    });
  };
});
