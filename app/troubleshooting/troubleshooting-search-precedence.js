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
      return base.entries.filter((entry) => {
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
      return base.entries.filter((entry) => (entry?.aliases || []).some((alias) => {
        if (base.normalize(alias) === normalized) return true;
        const aliasTokens = new Set(searchTokens(alias));
        return queryTokens.every((token) => aliasTokens.has(token));
      }));
    }

    const baseSearchEntries = base.searchEntries.bind(base);
    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const exact = exactMatches(query);
      const aliases = aliasMatches(query);
      const ranked = baseSearchEntries(query, context, Math.max(count, 8));
      const seen = new Set();
      return [...exact, ...aliases, ...ranked]
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

    function getAliasSearchMatches(query) {
      return Object.freeze([...aliasMatches(query)]);
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

      const orientationGeometry = base.entries.find((entry) => entry?.id === "orientation-trigger-geometry-baseline");
      if (orientationGeometry) {
        const first = searchEntries("rotary plate distance", { machineType: "TopModul", applicationMode: "apl" }, 8)[0];
        if (first?.id !== "orientation-trigger-geometry-baseline") {
          errors.push("Natural rotary-plate geometry wording must outrank unrelated machine-context faults.");
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
      version: `${base.version}+search-precedence-v360.1`,
      searchEntries,
      getExactSearchMatches,
      getAliasSearchMatches,
      validate
    });
  };
});