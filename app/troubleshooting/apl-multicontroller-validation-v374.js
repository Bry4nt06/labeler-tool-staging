"use strict";

(function installAplMultiControllerValidationV374(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplMultiControllerValidationV374() {
  const CONTROLLER_FILES = Object.freeze([
    "CO85_LB1_APLCart_1.L5K",
    "CO85_LB1_APLCart_2.L5K",
    "CO85_LB1_APLCart_3.L5K",
    "CO85_LB1_APLCart_4.L5K",
    "CO85_LB1_APLCart_5.L5K",
    "CO85_LB1_APLCart_6.L5K",
    "CO85_LB2_APLCart_1.L5K",
    "CO85_LB2_APLCart_2.L5K",
    "CO85_LB2_APLCart_3.L5K",
    "CO85_LB2_APLCart_4.L5K",
    "CO85_LB2_APLCart_5.L5K",
    "CO85_LB2_APLCart_6.L5K"
  ]);

  const SOURCE_ID = "co85-apl-cart-multicontroller-v374";
  const GAP_NUMBERS = Object.freeze([8, 24, 31, 74]);
  const INACTIVE_NUMBERS = Object.freeze([40, 49]);
  const code = (number) => String(number).padStart(5, "0");

  function appendUnique(values, addition) {
    const rows = [...(values || [])];
    if (addition && !rows.includes(addition)) rows.push(addition);
    return Object.freeze(rows);
  }

  function appendSourceRef(values, addition) {
    const rows = [...(values || [])];
    if (addition && !rows.some((ref) => ref?.sourceId === addition.sourceId && ref?.locator === addition.locator)) rows.push(addition);
    return Object.freeze(rows.map((ref) => Object.freeze({ ...ref })));
  }

  return function extendLibrary(base) {
    if (!base?.getEntry || !base?.getSource || !base?.searchEntries || !base?.searchSources || !base?.validate || !Array.isArray(base.entries) || !Array.isArray(base.sources)) {
      throw new Error("ServoForge Troubleshooting is required before v374 APL multi-controller validation.");
    }

    const SOURCE = Object.freeze({
      id: SOURCE_ID,
      title: "CO85 APL Cart Multi-Controller Source Validation",
      file: "CO85 LB1/LB2 APL Cart 1-6 readable L5K set",
      files: CONTROLLER_FILES,
      kind: base.SOURCE_KIND?.CONTROL_PROJECT || "PLC/control project",
      status: "multi-controller-source-validation",
      evidenceClass: "site-plc-validation-set",
      topics: Object.freeze(["APL", "Cart", "LB1", "LB2", "PLC", "source validation", "fault logic", "warnings", "servo", "web handling", "communication"]),
      notes: "Static source comparison of twelve CO85 APL Cart exports. The set verifies repeated APL Cart failure mechanisms within these supplied controllers; it does not make CO85 tags, addresses, comparison values, timers, I/O assignments, or controller structure universal for another site."
    });

    const VALIDATION = Object.freeze({
      controllerCount: 12,
      files: CONTROLLER_FILES,
      commonStructure: Object.freeze({ programs: 16, routines: 53, executableLogicLines: 631, faultWarningLogicLines: 75 }),
      commonInstructionCounts: Object.freeze({ AFI: 1, OTE: 277, OTL: 390, OTU: 294, RES: 8, TON: 29, TOF: 6, RTO: 1, CTU: 4, MSG: 29, GSV: 5, SSV: 2, MSO: 1, MSF: 1, MAM: 7, MAS: 2, MAPC: 2 }),
      logicComparison: Object.freeze({
        baselineEquivalentControllers: 9,
        controllerSpecificVariants: 3,
        faultWarningEquivalentControllers: 10,
        faultWarningVariants: 2,
        interpretation: "The supplied CO85 carts share one dominant executable architecture. The small source deltas remain controller/revision evidence and are not promoted as family-wide settings."
      }),
      fault19: Object.freeze({
        mechanism: "LabelingData.OverallMovementPercent comparison drives Cart Fault 00019 and inhibits Cart machine/jog enable while active.",
        comparisonValueVariesByController: true,
        authority: "mechanism-family-validated-value-site-specific",
        boundary: "Read the comparison value from the matching uploaded controller/project. ServoForge does not publish a universal Fault 00019 threshold."
      }),
      unresolvedAcrossValidationSet: GAP_NUMBERS,
      inactiveLogic0AcrossValidationSet: INACTIVE_NUMBERS,
      afis: Object.freeze({
        perController: 1,
        sharedLocation: "Startprogramm / BasicRoutine watchdog-monitoring warning path",
        boundary: "AFI presence is source-proven in the supplied exports but does not establish root cause, live branch state, or a recommendation to remove/change the AFI."
      }),
      authorityBoundary: "This validation strengthens APL machine-family troubleshooting concepts only where the mechanism repeats. Every CO85 tag, address, numeric setting, rung location, controller identity, and revision remains Site PLC Evidence."
    });

    const entryById = new Map();
    const sourceRef = (locator) => Object.freeze({ sourceId: SOURCE_ID, locator });

    function enrich(entry) {
      if (!entry?.id) return entry;
      if (entry.id === "apl-cart-00019") {
        return Object.freeze({
          ...entry,
          summary: "Across the twelve supplied CO85 APL Cart exports, Fault 00019 uses the same OverallMovementPercent / label-movement mechanism, but the comparison value is not identical in every controller. Treat the mechanism as APL-family evidence and read the active comparison value from the matching controller rather than using a ServoForge default.",
          checks: appendUnique(entry.checks, "Read LabelingData.OverallMovementPercent and the comparison used by the matching uploaded controller/revision. Do not substitute a value copied from another Cart."),
          actions: appendUnique(entry.actions, "Correct the verified label-length/movement geometry or recipe condition using the approved machine-specific procedure; do not change the PLC comparison merely to clear Fault 00019."),
          sourceRefs: appendSourceRef(entry.sourceRefs, sourceRef("12-controller comparison — FaultLogic / Faults — ACC / LABEL LENGTH / Fault 00019")),
          evidenceLimits: appendUnique(entry.evidenceLimits, "The Fault 00019 comparison value varies within the supplied CO85 controller set and is therefore Site PLC Evidence, not a universal APL threshold."),
          multiControllerValidation: Object.freeze({ controllerCount: 12, mechanismValidated: true, comparisonValueUniversal: false, sourceId: SOURCE_ID })
        });
      }

      const numberMatch = /^apl-cart-(\d{5})$/.exec(entry.id);
      const number = numberMatch ? Number(numberMatch[1]) : null;
      if (GAP_NUMBERS.includes(number)) {
        return Object.freeze({
          ...entry,
          summary: `${entry.summary} The same executable-source gap remains present across all twelve supplied CO85 APL Cart exports; ServoForge still does not invent a producer for this alarm position.`,
          sourceRefs: appendSourceRef(entry.sourceRefs, sourceRef(`12-controller comparison — no executable producer verified for Cart Fault ${code(number)}`)),
          evidenceLimits: appendUnique(entry.evidenceLimits, `No executable producer was verified for Cart Fault ${code(number)} in the twelve supplied CO85 APL Cart exports. A different site/application/revision can still implement this position differently.`),
          multiControllerValidation: Object.freeze({ controllerCount: 12, producerVerified: false, sourceId: SOURCE_ID })
        });
      }

      if (INACTIVE_NUMBERS.includes(number)) {
        return Object.freeze({
          ...entry,
          summary: `${entry.summary} The inactive Logic_0 implementation is repeated across all twelve supplied CO85 APL Cart exports.`,
          sourceRefs: appendSourceRef(entry.sourceRefs, sourceRef(`12-controller comparison — Cart Fault ${code(number)} remains Logic_0/inactive`)),
          evidenceLimits: appendUnique(entry.evidenceLimits, `Cart Fault ${code(number)} is inactive in this twelve-controller CO85 validation set; do not assume another site/revision leaves the alarm position inactive.`),
          multiControllerValidation: Object.freeze({ controllerCount: 12, inactiveLogic0: true, sourceId: SOURCE_ID })
        });
      }

      return entry;
    }

    const entries = Object.freeze(base.entries.map((entry) => {
      const enriched = enrich(entry);
      entryById.set(enriched.id, enriched);
      return enriched;
    }));
    const sources = Object.freeze([...base.sources, SOURCE]);

    function normalize(value) {
      return typeof base.normalize === "function" ? base.normalize(value) : String(value || "").trim().toLowerCase();
    }

    function getSource(id) {
      return String(id || "") === SOURCE_ID ? SOURCE : base.getSource(id);
    }

    function getEntry(id) {
      return entryById.get(String(id || "")) || base.getEntry(id);
    }

    function searchEntries(query, context = {}, limit = 8) {
      return base.searchEntries(query, context, limit).map((hit) => {
        const replacement = entryById.get(hit?.id);
        return replacement ? { ...replacement, ...(hit?.searchScore != null ? { searchScore: hit.searchScore } : {}) } : hit;
      });
    }

    function sourceScore(query) {
      const q = normalize(query);
      if (!q) return 1;
      const haystack = normalize([SOURCE.id, SOURCE.title, SOURCE.file, ...(SOURCE.topics || []), ...CONTROLLER_FILES].join(" "));
      if (normalize(SOURCE.id) === q || normalize(SOURCE.title) === q) return 100;
      return q.split(/\s+/).filter(Boolean).reduce((score, term) => score + (haystack.includes(term) ? 5 : 0), 0);
    }

    function searchSources(query, limit = 20) {
      const count = Math.max(1, Number(limit) || 20);
      const newHits = sourceScore(query) > 0 ? [SOURCE] : [];
      const ordered = [...newHits, ...base.searchSources(query, Math.max(count, 24))];
      const seen = new Set();
      return ordered.filter((source) => {
        if (!source?.id || seen.has(source.id)) return false;
        seen.add(source.id);
        return true;
      }).slice(0, count);
    }

    function getAplCartMultiControllerValidation() {
      return VALIDATION;
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      if (base.getSource(SOURCE_ID)) errors.push(`v374 source duplicates existing id ${SOURCE_ID}.`);
      if (!getSource(SOURCE_ID)) errors.push("v374 multi-controller source registration failed.");
      const fault19 = getEntry("apl-cart-00019");
      if (!fault19?.multiControllerValidation || fault19.multiControllerValidation.comparisonValueUniversal !== false) errors.push("v374 Fault 00019 value boundary is missing.");
      for (const number of GAP_NUMBERS) {
        const entry = getEntry(`apl-cart-${code(number)}`);
        if (!entry?.multiControllerValidation || entry.multiControllerValidation.producerVerified !== false) errors.push(`v374 unresolved-source validation missing for Cart Fault ${code(number)}.`);
      }
      for (const number of INACTIVE_NUMBERS) {
        const entry = getEntry(`apl-cart-${code(number)}`);
        if (!entry?.multiControllerValidation?.inactiveLogic0) errors.push(`v374 inactive-source validation missing for Cart Fault ${code(number)}.`);
      }
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+apl-multicontroller-v374`,
      sources,
      entries,
      getSource,
      getEntry,
      searchEntries,
      searchSources,
      getAplCartMultiControllerValidation,
      validate
    });
  };
});
