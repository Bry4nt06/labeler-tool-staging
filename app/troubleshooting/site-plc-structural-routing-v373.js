"use strict";

(function installSitePlcStructuralRouting(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary, root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createSitePlcStructuralRouting() {
  const OVERLAY_KEY = "servoforge.troubleshooting.plcOverlay.v1";

  function readOverlay(root) {
    try {
      const parsed = JSON.parse(root?.sessionStorage?.getItem(OVERLAY_KEY) || "null");
      return parsed?.schema === "servoforge-troubleshooting-plc-overlay-v1" ? parsed : null;
    } catch {
      return null;
    }
  }

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function searchable(value) {
    return String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/[_./:\[\]()\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function structuralEvidenceIsBounded(value) {
    if (!value) return true;
    if (value.authority !== "static-site-structure-only") return false;
    if (value.interlock && value.interlock.runtimeGateStateProven !== false) return false;
    if (value.interlock && value.interlock.booleanBranchSemanticsProven !== false) return false;
    if (value.recovery && value.recovery.causeClearedProven !== false) return false;
    if (value.recovery && value.recovery.safeToResetProven !== false) return false;
    if (value.afi && value.afi.causeProven !== false) return false;
    if (value.afi && value.afi.wholeRoutineDisabledProven !== false) return false;
    return true;
  }

  function enrichEntries(base, overlay) {
    if (!overlay?.candidates?.length) return { entries: base.entries, byId: new Map() };
    const structuralByTarget = new Map(
      overlay.candidates
        .filter((candidate) => candidate?.target && candidate?.structuralEvidence)
        .map((candidate) => [String(candidate.target), candidate.structuralEvidence])
    );
    const byId = new Map();
    const entries = base.entries.map((entry) => {
      const target = entry?.uploadedPlcOverlay?.target;
      const structuralEvidence = target ? structuralByTarget.get(String(target)) : null;
      if (!structuralEvidence) return entry;
      const enriched = Object.freeze({
        ...entry,
        uploadedPlcOverlay: Object.freeze({
          ...entry.uploadedPlcOverlay,
          structuralEvidence
        })
      });
      byId.set(enriched.id, enriched);
      return enriched;
    });
    return { entries: Object.freeze(entries), byId };
  }

  function rerank(base, entry, handoff) {
    const structural = entry?.uploadedPlcOverlay?.structuralEvidence;
    if (!structural || !handoff?.primary || !Array.isArray(base.UNIVERSAL_HANDOFF_DOMAINS)) return handoff;

    const domainOrder = new Map(base.UNIVERSAL_HANDOFF_DOMAINS.map((domain, index) => [domain.id, index]));
    const scores = new Map(base.UNIVERSAL_HANDOFF_DOMAINS.map((domain) => [domain.id, {
      domainId: domain.id,
      label: domain.label,
      entryId: domain.entryId,
      pattern: domain.pattern,
      score: 0,
      signals: []
    }]));

    function add(domainId, points, signal) {
      const item = scores.get(domainId);
      if (!item) return;
      item.score += points;
      if (signal) item.signals.push(signal);
    }

    for (const item of [handoff.primary, ...(handoff.alternatives || [])]) {
      if (!item?.domainId) continue;
      add(item.domainId, Number(item.score || 0), ...(item.signals?.length ? [] : [null]));
      const target = scores.get(item.domainId);
      if (target) target.signals.push(...(item.signals || []));
    }

    const interlock = structural.interlock;
    if (interlock) {
      add("control-sequence", 2, "source-visible interlock/permissive path exists (static structure only)");
      const gateText = searchable([...(interlock.gateSymbols || []), ...(interlock.paths || []).flatMap((path) => path.gateSymbols || [])].join(" "));
      for (const domain of base.UNIVERSAL_HANDOFF_DOMAINS) {
        if (gateText && domain.pattern?.test(gateText)) {
          add(domain.id, 6, `${domain.label.toLowerCase()} terminology appears in source-visible gate symbols`);
        }
      }
    }

    const recovery = structural.recovery;
    if (recovery) {
      add("control-sequence", recovery.sourcePairLocated ? 5 : 4, recovery.sourcePairLocated
        ? "source-visible latch/unlatch relationship is paired (runtime state and reset safety not proven)"
        : "source-visible recovery/reset structure exists (runtime state and reset safety not proven)");
      const gateText = searchable([...(recovery.gateSymbols || []), ...(recovery.paths || []).flatMap((path) => path.gateSymbols || [])].join(" "));
      for (const domain of base.UNIVERSAL_HANDOFF_DOMAINS) {
        if (gateText && domain.pattern?.test(gateText)) {
          add(domain.id, 5, `${domain.label.toLowerCase()} terminology appears in recovery-path gate symbols`);
        }
      }
    }

    const afi = structural.afi;
    if (afi?.sameWriterRungCount) {
      add("control-sequence", 7, `AFI appears on the same source rung as this writer (${afi.sameWriterRungCount} source location${afi.sameWriterRungCount === 1 ? "" : "s"}; causality not proven)`);
    }

    const ranked = [...scores.values()]
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (domainOrder.get(a.domainId) ?? 999) - (domainOrder.get(b.domainId) ?? 999));
    if (!ranked.length) return handoff;

    function result(item) {
      return Object.freeze({
        domainId: item.domainId,
        label: item.label,
        entryId: item.entryId,
        score: item.score,
        confidence: item.score >= 10 ? "high" : item.score >= 6 ? "medium" : "low",
        signals: Object.freeze(unique(item.signals))
      });
    }

    const primary = result(ranked[0]);
    const alternatives = ranked.slice(1)
      .filter((item) => item.score >= 3 && item.score >= ranked[0].score - 5)
      .slice(0, 3)
      .map(result);

    return Object.freeze({
      ...handoff,
      primary,
      alternatives: Object.freeze(alternatives),
      structuralEvidenceVersion: "v373",
      structuralEvidenceAuthority: "static-site-structure-only",
      boundary: `${handoff.boundary} v373 structural routing additionally does not prove current interlock/permissive gate state, complete Boolean branch semantics, cause-clear/reset safety, AFI causality, adjacent-branch state, or whole-routine disablement.`
    });
  }

  return function extendLibrary(base, root) {
    if (!base?.entries || typeof base.getEntry !== "function" || typeof base.searchEntries !== "function" || typeof base.getUniversalHandoff !== "function") {
      throw new Error("ServoForge v372 universal handoff library is required before structural site routing v373.");
    }

    const overlay = readOverlay(root);
    const enriched = enrichEntries(base, overlay);
    const baseGetEntry = base.getEntry.bind(base);
    const baseSearch = base.searchEntries.bind(base);
    const baseHandoff = base.getUniversalHandoff.bind(base);

    function getEntry(id) {
      return enriched.byId.get(id) || baseGetEntry(id) || null;
    }

    function searchEntries(query, context = {}, limit = 8) {
      return baseSearch(query, context, limit).map((entry) => enriched.byId.get(entry.id) || entry);
    }

    function getUniversalHandoff(entryOrId) {
      const entry = typeof entryOrId === "string" ? getEntry(entryOrId) : (enriched.byId.get(entryOrId?.id) || entryOrId);
      const handoff = baseHandoff(entry);
      return rerank(base, entry, handoff);
    }

    function validate() {
      const current = typeof base.validate === "function" ? base.validate() : { ok: true, errors: [] };
      const errors = [...(current.errors || [])];
      for (const entry of enriched.entries) {
        const structural = entry?.uploadedPlcOverlay?.structuralEvidence;
        if (structural && !structuralEvidenceIsBounded(structural)) {
          errors.push(`Structural PLC evidence escaped its static/site boundary for ${entry.id}.`);
        }
      }
      if (overlay?.structuralEvidenceVersion && overlay.authority !== "session-site-evidence-only") {
        errors.push("Structural PLC overlay must remain session-site evidence only.");
      }
      if (overlay?.structuralEvidenceVersion && overlay.universalLibraryModified !== false) {
        errors.push("Structural PLC overlay must never modify the universal library.");
      }
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+site-plc-structural-routing-v373`,
      entries: enriched.entries,
      getEntry,
      searchEntries,
      getUniversalHandoff,
      sitePlcStructuralRouting: Object.freeze({
        version: "v373",
        active: Boolean(overlay?.structuralEvidenceVersion),
        authority: overlay?.authority || null,
        structuralEvidenceVersion: overlay?.structuralEvidenceVersion || null,
        universalLibraryModified: false
      }),
      validate
    });
  };
});
