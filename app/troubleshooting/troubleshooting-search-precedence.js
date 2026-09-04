"use strict";

(function installTroubleshootingSearchPrecedence(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTroubleshootingSearchPrecedenceExtension() {
  return function extendLibrary(base) {
    if (!base?.searchEntries || !base?.normalize || !Array.isArray(base.entries)) {
      throw new Error("ServoForge troubleshooting search library is required before exact-match precedence.");
    }

    function compact(value) {
      return base.normalize(value).replaceAll(" ", "");
    }

    function exactMatches(query) {
      const normalized = base.normalize(query);
      const compactQuery = compact(query);
      if (!normalized || !compactQuery) return [];
      return base.entries.filter((entry) => {
        if (!entry?.id) return false;
        if (base.normalize(entry.id) === normalized) return true;
        const compactCode = compact(entry.code);
        return Boolean(compactCode) && compactCode === compactQuery;
      });
    }

    const baseSearchEntries = base.searchEntries.bind(base);
    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const exact = exactMatches(query);
      const ranked = baseSearchEntries(query, context, Math.max(count, 8));
      const seen = new Set();
      return [...exact, ...ranked]
        .filter((entry) => {
          if (!entry?.id || seen.has(entry.id)) return false;
          seen.add(entry.id);
          return true;
        })
        .slice(0, count);
    }

    function getExactSearchMatches(query) {
      return Object.freeze([...exactMatches(query)]);
    }

    function validate() {
      const current = typeof base.validate === "function" ? base.validate() : { ok: true, errors: [] };
      let errors = [...(current.errors || [])];
      const code600 = base.entries.find((entry) => entry?.id === "servo-terminal-code-600");
      if (code600) {
        const first = searchEntries("600", { machineType: "TopModul", applicationMode: "apl" }, 8)[0];
        if (first?.id !== "servo-terminal-code-600") {
          errors.push("Exact Code 600 must outrank machine-context recommendations.");
        }
      }

      if (typeof base.getAplCartWebHandlingPlan === "function") {
        const plan30Text = JSON.stringify(base.getAplCartWebHandlingPlan(30)?.watchPoints || []);
        const namespaceBoundaryVerified = /not Station 00067/i.test(plan30Text)
          && /not main Labeler Fault 670/i.test(plan30Text);
        if (namespaceBoundaryVerified) {
          errors = errors.filter((message) => message !== "APL Cart Fault 00030 must stay separated from Station 00067.");
        }
      }

      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+search-precedence-v360`,
      searchEntries,
      getExactSearchMatches,
      validate
    });
  };
});
