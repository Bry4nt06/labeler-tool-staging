"use strict";

(function installTopModulAlarmStackAnalyzer(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulAlarmStackAnalyzerExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.searchEntries) {
      throw new Error("TopModul fault catalog and diagnostic layers are required before alarm-stack analysis.");
    }

    const ROLE_PRIORITY = Object.freeze({
      "direct-producer": 10,
      "field-observed": 16,
      "verified-producer": 22,
      supervision: 42,
      escalation: 52,
      "downstream-summary": 70,
      "catalog-only": 82,
      disabled: 96,
      "source-gap": 100
    });

    const ROLE_LABELS = Object.freeze({
      "direct-producer": "Direct PLC producer",
      "field-observed": "Field-observed HMI case",
      "verified-producer": "Verified producer",
      supervision: "Supervision / state",
      escalation: "Escalation / repeated-event fault",
      "downstream-summary": "Downstream summary",
      "catalog-only": "Catalog-only binding",
      disabled: "Disabled / inactive path",
      "source-gap": "Source gap"
    });

    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
    const normalize = (value) => base.normalize ? base.normalize(value) : String(value || "").trim().toLowerCase();
    const evidenceFor = (entry) => entry?.labelerRungEvidence || entry?.stationRungEvidence || entry?.rungEvidence || null;

    function classify(entry) {
      if (!entry) return "catalog-only";
      if (!entry.plcFault && /^topmodul-00067/i.test(String(entry.id || ""))) return "field-observed";
      const evidence = evidenceFor(entry);
      if (evidence?.rootLikelihood === "disabled") return "disabled";
      if (entry.sourceGap && !entry.processTrace) return "source-gap";
      if (evidence?.rootLikelihood === "primary") return "direct-producer";
      if (evidence?.rootLikelihood === "secondary") return "downstream-summary";
      if (evidence?.rootLikelihood === "supervision") return "supervision";
      const traceText = normalize([entry.processTrace?.status, entry.processTrace?.routine, entry.processTrace?.summary].filter(Boolean).join(" "));
      if (/(retry|retries|escalat|consecutive|counter|repeated event)/.test(traceText)) return "escalation";
      if (entry.processTrace) return "verified-producer";
      if (entry.sourceGap) return "source-gap";
      return "catalog-only";
    }

    function basePriority(entry, role) {
      const rolePriority = ROLE_PRIORITY[role] ?? 82;
      const evidenceRank = Number(evidenceFor(entry)?.firstFaultRank);
      if (!Number.isFinite(evidenceRank)) return rolePriority;
      return Math.round((rolePriority * 2 + clamp(evidenceRank, 0, 100)) / 3);
    }

    function extractTokens(input) {
      if (Array.isArray(input)) return input.map((value) => String(value || "").trim()).filter(Boolean);
      const text = String(input || "").trim();
      if (!text) return [];
      const numeric = text.match(/\b00067\b|\b\d{3,4}\b/g) || [];
      if (numeric.length) return numeric;
      return text.split(/[\n,;>|]+/).map((value) => value.trim()).filter(Boolean);
    }

    function resolveToken(token, context = {}) {
      const raw = String(token || "").trim();
      if (!raw) return null;
      if (raw === "00067") {
        const field = base.searchEntries("00067", { ...context, machineType: context.machineType || "TopModul" }, 5)
          .find((entry) => entry?.id === "topmodul-00067-labeler-encoder-feedback");
        return field || null;
      }
      if (/^\d{3,4}$/.test(raw)) {
        const exact = base.getTopModulFault(Number(raw));
        if (exact) return exact;
      }
      const result = base.searchEntries(raw, { ...context, machineType: context.machineType || "TopModul" }, 3)[0];
      return result || null;
    }

    function candidateNumbersFor(entry) {
      if (!entry?.plcFault || !base.getTopModulFirstFaultCandidates) return [];
      let candidates = [];
      try {
        candidates = base.getTopModulFirstFaultCandidates(entry.number, 16) || [];
      } catch (_) {
        candidates = [];
      }
      return candidates.map((candidate) => Number(candidate?.number)).filter(Number.isFinite);
    }

    function relationReason(entry, other) {
      if (!entry?.plcFault || !other?.plcFault || !base.getTopModulFaultRelations) return "";
      try {
        const related = base.getTopModulFaultRelations(entry.number, 16) || [];
        return related.find((candidate) => Number(candidate?.number) === Number(other.number))?.relationReason || "";
      } catch (_) {
        return "";
      }
    }

    function analyzeTopModulFaultStack(input, context = {}) {
      const tokens = extractTokens(input);
      const observed = [];
      const unresolved = [];
      const seen = new Set();

      tokens.forEach((token, tokenIndex) => {
        const entry = resolveToken(token, context);
        if (!entry) {
          unresolved.push(Object.freeze({ token, observedIndex: tokenIndex }));
          return;
        }
        const key = String(entry.id || `${entry.code}:${entry.title}`);
        if (seen.has(key)) return;
        seen.add(key);
        const role = classify(entry);
        observed.push({
          entry,
          token: String(token),
          observedIndex: observed.length,
          role,
          roleLabel: ROLE_LABELS[role] || role,
          priority: basePriority(entry, role),
          upstreamCandidatesInStack: [],
          downstreamItemsSupported: [],
          relatedInStack: []
        });
      });

      const byNumber = new Map(observed.filter((item) => Number.isFinite(Number(item.entry?.number))).map((item) => [Number(item.entry.number), item]));

      for (const item of observed) {
        const candidates = candidateNumbersFor(item.entry);
        for (const candidateNumber of candidates) {
          const upstream = byNumber.get(candidateNumber);
          if (!upstream || upstream === item) continue;
          item.upstreamCandidatesInStack.push(Object.freeze({
            number: candidateNumber,
            observedIndex: upstream.observedIndex,
            title: upstream.entry.title,
            appearedEarlier: upstream.observedIndex < item.observedIndex
          }));
          upstream.downstreamItemsSupported.push(Object.freeze({
            number: Number(item.entry.number),
            observedIndex: item.observedIndex,
            title: item.entry.title
          }));
        }
      }

      for (let i = 0; i < observed.length; i += 1) {
        for (let j = i + 1; j < observed.length; j += 1) {
          const a = observed[i];
          const b = observed[j];
          const reasonAB = relationReason(a.entry, b.entry);
          const reasonBA = relationReason(b.entry, a.entry);
          if (reasonAB) a.relatedInStack.push(Object.freeze({ number: Number(b.entry.number), title: b.entry.title, reason: reasonAB }));
          if (reasonBA) b.relatedInStack.push(Object.freeze({ number: Number(a.entry.number), title: a.entry.title, reason: reasonBA }));
        }
      }

      const immutableObserved = observed.map((item) => Object.freeze({
        ...item,
        upstreamCandidatesInStack: Object.freeze([...item.upstreamCandidatesInStack]),
        downstreamItemsSupported: Object.freeze([...item.downstreamItemsSupported]),
        relatedInStack: Object.freeze([...item.relatedInStack])
      }));

      const recommended = immutableObserved.map((item) => {
        const supportAdjustment = Math.min(12, item.downstreamItemsSupported.length * 4);
        const sourceGapPenalty = item.role === "source-gap" || item.role === "disabled" ? 8 : 0;
        return Object.freeze({ ...item, investigationScore: Math.max(0, item.priority - supportAdjustment + sourceGapPenalty) });
      }).sort((a, b) => a.investigationScore - b.investigationScore || a.observedIndex - b.observedIndex);

      const earliest = immutableObserved[0] || null;
      const strongest = recommended[0] || null;
      const chronologyAgreement = Boolean(earliest && strongest && earliest.entry.id === strongest.entry.id);
      const directCount = immutableObserved.filter((item) => ["direct-producer", "verified-producer", "field-observed"].includes(item.role)).length;
      const summaryCount = immutableObserved.filter((item) => ["downstream-summary", "supervision", "escalation"].includes(item.role)).length;
      const gapCount = immutableObserved.filter((item) => ["source-gap", "disabled", "catalog-only"].includes(item.role)).length;

      return Object.freeze({
        input: String(input || ""),
        observed: Object.freeze(immutableObserved),
        recommended: Object.freeze(recommended),
        unresolved: Object.freeze(unresolved),
        chronologyAgreement,
        earliestObserved: earliest,
        strongestEvidence: strongest,
        counts: Object.freeze({ resolved: immutableObserved.length, direct: directCount, summaries: summaryCount, gaps: gapCount, unresolved: unresolved.length }),
        guidance: "Observed HMI order is preserved as evidence. The investigation ranking uses verified PLC role/first-fault evidence and never proves causality by itself. When the two disagree, review the earliest alarm and the stronger producer evidence together before replacing hardware or changing parameters."
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const fieldVsPlc = analyzeTopModulFaultStack("00067, 067");
      if (fieldVsPlc.observed[0]?.entry?.id !== "topmodul-00067-labeler-encoder-feedback") errors.push("Alarm stack lost field-observed 00067 authority.");
      if (fieldVsPlc.observed[1]?.entry?.number !== 67) errors.push("Alarm stack lost separate PLC Fault 067 resolution.");
      const station = analyzeTopModulFaultStack("663, 1091");
      const f663 = station.recommended.find((item) => item.entry.number === 663);
      const f1091 = station.recommended.find((item) => item.entry.number === 1091);
      if (!f663 || !f1091 || f1091.investigationScore >= f663.investigationScore) errors.push("Station encoder producer should rank ahead of Station Not Ready summary.");
      const gaps = analyzeTopModulFaultStack("719, 489, 641, 697");
      if (gaps.recommended[0]?.entry?.number !== 719) errors.push("Verified Fault 719 should rank ahead of source-gap alarms.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+alarm-stack-analyzer-v1`,
      analyzeTopModulFaultStack,
      topModulAlarmStackRoles: ROLE_LABELS,
      validate
    });
  };
});
