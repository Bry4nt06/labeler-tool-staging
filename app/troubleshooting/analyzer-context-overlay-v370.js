"use strict";

(function installAnalyzerContextOverlay(root, factory) {
  const extendLibrary = factory(root?.ServoForgeUniversalTroubleshooting);
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary, root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAnalyzerContextOverlay(universal) {
  return function extendLibrary(base, root = typeof globalThis !== "undefined" ? globalThis : null) {
    if (!base?.searchEntries || !base?.getEntry || !universal?.validHandoff) {
      throw new Error("Universal troubleshooting core and final search library are required before Analyzer context overlay v370.");
    }

    let handoff = readHandoff();
    const baseGetEntry = base.getEntry.bind(base);
    const baseSearchEntries = base.searchEntries.bind(base);

    function safeJson(raw, fallback = null) {
      try { return JSON.parse(raw); }
      catch { return fallback; }
    }

    function readHandoff() {
      let value = null;
      try { value = safeJson(root?.localStorage?.getItem(universal.STORAGE_KEY), null); }
      catch { value = null; }
      return universal.validHandoff(value) ? value : null;
    }

    function getAnalyzerContext() {
      return handoff;
    }

    function refreshAnalyzerContext() {
      handoff = readHandoff();
      return handoff;
    }

    function clearAnalyzerContext() {
      try { root?.localStorage?.removeItem(universal.STORAGE_KEY); }
      catch { }
      handoff = null;
      return null;
    }

    function specificBindingMatches(query) {
      if (!handoff) return [];
      const normalizedQuery = universal.normalize(query);
      if (!normalizedQuery) return [];
      return (handoff.bindings || []).filter((binding) => {
        const target = universal.normalize(binding?.target);
        if (!target) return false;
        if (target === normalizedQuery) return true;
        // Partial controller-tag lookup is useful for symbolic names, but short
        // numeric searches must remain owned by normal exact fault-code routing.
        if (normalizedQuery.length < 5 || /^\d+$/.test(normalizedQuery)) return false;
        return target.includes(normalizedQuery);
      });
    }

    function analyzerEvidenceFor(entry) {
      if (!handoff || !entry || entry.methodClass !== "universal") return null;
      return universal.evidenceForEntry(entry, handoff);
    }

    function decorate(entry) {
      if (!entry) return entry;
      const evidence = analyzerEvidenceFor(entry);
      return evidence ? Object.freeze({ ...entry, analyzerEvidence: evidence }) : entry;
    }

    function getEntry(id) {
      return decorate(baseGetEntry(id));
    }

    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const matches = specificBindingMatches(query);
      const preferred = [];
      if (matches.length && typeof base.getUniversalMethod === "function") {
        const seenFamilies = new Set();
        for (const binding of matches) {
          if (!binding?.familyId || seenFamilies.has(binding.familyId)) continue;
          seenFamilies.add(binding.familyId);
          const method = base.getUniversalMethod(binding.familyId);
          if (method) preferred.push(method);
        }
      }
      const ranked = baseSearchEntries(query, context, Math.max(count, 8));
      const seen = new Set();
      return [...preferred, ...ranked]
        .filter((entry) => {
          if (!entry?.id || seen.has(entry.id)) return false;
          seen.add(entry.id);
          return true;
        })
        .slice(0, count)
        .map(decorate);
    }

    function validate() {
      const current = typeof base.validate === "function" ? base.validate() : { ok: true, errors: [] };
      const errors = [...(current.errors || [])];
      if (handoff && !universal.validHandoff(handoff)) errors.push("Analyzer troubleshooting handoff is invalid.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+analyzer-context-v370`,
      getEntry,
      searchEntries,
      getAnalyzerContext,
      refreshAnalyzerContext,
      clearAnalyzerContext,
      getAnalyzerBindingMatches: specificBindingMatches,
      getAnalyzerEvidenceForEntry: analyzerEvidenceFor,
      validate
    });
  };
});
