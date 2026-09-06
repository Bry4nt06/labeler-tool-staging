"use strict";

(function installAplCartAlarmStack(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplCartAlarmStackExtension() {
  return function extendLibrary(base) {
    if (!base?.analyzeTopModulFaultStack || !base?.getEntry || !base?.normalize) {
      throw new Error("TopModul alarm-stack analysis and APL Cart diagnostic layers are required before v365 Cart stack analysis.");
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
      ...(base.topModulAlarmStackRoles || {}),
      "direct-producer": "Direct PLC producer",
      "field-observed": "Field-observed HMI case",
      "verified-producer": "Verified producer",
      supervision: "Supervision / state",
      escalation: "Escalation / repeated-event fault",
      "downstream-summary": "Downstream / recovery summary",
      "catalog-only": "Catalog-only binding",
      disabled: "Disabled / inactive path",
      "source-gap": "Source gap"
    });

    const CART_DOWNSTREAM = new Set([4, 14, 16, 20]);
    const CART_SUPERVISION = new Set([2, 5, 9, 10, 17, 22, 26, 28, 29, 30, 60]);
    const CART_EXACT_RELATIONS = Object.freeze([
      Object.freeze({ upstream: 3, downstream: 4, reason: "Cart 00004 is explicitly built from the preceding LS143/Faults[0].3 state, then self-holds until ResetGeneral." })
    ]);

    const cartCode = (number) => String(Number(number)).padStart(5, "0");
    const cartKey = (number) => `apl:${Number(number)}`;
    const normalize = (value) => base.normalize(value);

    function extractTokens(input) {
      if (Array.isArray(input)) return input.map((value) => String(value || "").trim()).filter(Boolean);
      const text = String(input || "").trim();
      if (!text) return [];
      const numeric = text.match(/\b\d{5}\b|\b\d{3,4}\b/g) || [];
      if (numeric.length) return numeric;
      return text.split(/[\n,;>|]+/).map((value) => value.trim()).filter(Boolean);
    }

    function getCartPlan(number) {
      const n = Number(number);
      const readers = [
        base.getAplCartCorePlan,
        base.getAplCartFoundationPlan,
        base.getAplCartWebHandlingPlan,
        base.getAplCartServoStatusPlan,
        base.getAplCartTailPlan
      ].filter((reader) => typeof reader === "function");
      for (const reader of readers) {
        try {
          const plan = reader.call(base, n);
          if (plan && Number(plan.number) === n) return plan;
        } catch (_) {
          // A plan reader may intentionally reject a number outside its family.
        }
      }
      return null;
    }

    function getCartEntry(rawCode) {
      if (rawCode === "00067") return null;
      return base.getEntry(`apl-cart-${rawCode}`) || null;
    }

    function cartRole(entry, plan) {
      const n = Number(entry?.number);
      const status = normalize(plan?.status || "");
      if (entry?.sourceGap || /catalog only|no producer|no executable|source gap/.test(status)) return "source-gap";
      if (/inactive|logic0|disabled/.test(status)) return "disabled";
      if (CART_DOWNSTREAM.has(n) || /secondary|recovery|reset state|summary/.test(status)) return "downstream-summary";
      if (CART_SUPERVISION.has(n) || /supervision|timed|monitor|latch/.test(status)) return "supervision";
      if (/exact plc producer|source proven direct|direct servo status|direct status/.test(status)) return "direct-producer";
      if (/source proven|exact plc|producer/.test(status)) return "verified-producer";
      return "catalog-only";
    }

    function cartPriority(role) {
      return ROLE_PRIORITY[role] ?? ROLE_PRIORITY["catalog-only"];
    }

    function resolveBaseToken(token, context) {
      const analysis = base.analyzeTopModulFaultStack(String(token), context);
      return analysis?.observed?.[0] || null;
    }

    function namespaceFor(entry, cartLocal = false) {
      if (cartLocal) return Object.freeze({ id: "apl-cart", label: "APL Cart-local" });
      if (entry?.id === "topmodul-00067-labeler-encoder-feedback") return Object.freeze({ id: "field-hmi", label: "Field HMI observation" });
      if (entry?.diagnosticScope === "Station" || entry?.plcFault?.station) return Object.freeze({ id: "labeler-station", label: "Base Labeler / Station instance" });
      return Object.freeze({ id: "labeler", label: "Base Labeler PLC" });
    }

    function baseFullAnalysis(tokens, context) {
      if (!tokens.length) return null;
      try {
        return base.analyzeTopModulFaultStack(tokens.join(", "), context);
      } catch (_) {
        return null;
      }
    }

    function copyBaseRelations(item, sourceItem) {
      if (!sourceItem) return item;
      item.upstreamCandidatesInStack.push(...(sourceItem.upstreamCandidatesInStack || []));
      item.downstreamItemsSupported.push(...(sourceItem.downstreamItemsSupported || []));
      item.relatedInStack.push(...(sourceItem.relatedInStack || []));
      return item;
    }

    function addCartExactRelations(observed) {
      const byCartNumber = new Map(observed.filter((item) => item.namespace?.id === "apl-cart").map((item) => [Number(item.entry.number), item]));
      for (const relation of CART_EXACT_RELATIONS) {
        const upstream = byCartNumber.get(relation.upstream);
        const downstream = byCartNumber.get(relation.downstream);
        if (!upstream || !downstream) continue;
        downstream.upstreamCandidatesInStack.push(Object.freeze({
          number: relation.upstream,
          code: cartCode(relation.upstream),
          namespace: "APL Cart-local",
          observedIndex: upstream.observedIndex,
          title: upstream.entry.title,
          appearedEarlier: upstream.observedIndex < downstream.observedIndex,
          reason: relation.reason
        }));
        upstream.downstreamItemsSupported.push(Object.freeze({
          number: relation.downstream,
          code: cartCode(relation.downstream),
          namespace: "APL Cart-local",
          observedIndex: downstream.observedIndex,
          title: downstream.entry.title,
          reason: relation.reason
        }));
        upstream.relatedInStack.push(Object.freeze({ number: relation.downstream, code: cartCode(relation.downstream), title: downstream.entry.title, reason: relation.reason }));
        downstream.relatedInStack.push(Object.freeze({ number: relation.upstream, code: cartCode(relation.upstream), title: upstream.entry.title, reason: relation.reason }));
      }
    }

    function analyzeTopModulFaultStack(input, context = {}) {
      const tokens = extractTokens(input);
      const observed = [];
      const unresolved = [];
      const seen = new Set();
      const baseTokens = tokens.filter((token) => !/^\d{5}$/.test(String(token)) || String(token) === "00067");
      const fullBase = baseFullAnalysis(baseTokens, context);
      const baseById = new Map((fullBase?.observed || []).map((item) => [item.entry.id, item]));

      tokens.forEach((token, sourceIndex) => {
        const raw = String(token || "").trim();
        const isFiveDigit = /^\d{5}$/.test(raw);
        const isField00067 = raw === "00067";

        if (isFiveDigit && !isField00067) {
          const entry = getCartEntry(raw);
          const number = Number(raw);
          const plan = entry ? getCartPlan(number) : null;
          if (!entry || !plan) {
            unresolved.push(Object.freeze({ token: raw, observedIndex: sourceIndex, namespace: "APL Cart-local" }));
            return;
          }
          if (seen.has(entry.id)) return;
          seen.add(entry.id);
          const role = cartRole(entry, plan);
          observed.push({
            entry,
            token: raw,
            observedIndex: observed.length,
            role,
            roleLabel: ROLE_LABELS[role] || role,
            priority: cartPriority(role),
            namespace: namespaceFor(entry, true),
            cartPlan: plan,
            upstreamCandidatesInStack: [],
            downstreamItemsSupported: [],
            relatedInStack: []
          });
          return;
        }

        const baseItem = resolveBaseToken(raw, context);
        if (!baseItem?.entry) {
          unresolved.push(Object.freeze({ token: raw, observedIndex: sourceIndex, namespace: "TopModul / Labeler" }));
          return;
        }
        if (seen.has(baseItem.entry.id)) return;
        seen.add(baseItem.entry.id);
        const item = {
          entry: baseItem.entry,
          token: raw,
          observedIndex: observed.length,
          role: baseItem.role,
          roleLabel: baseItem.roleLabel,
          priority: Number(baseItem.priority ?? ROLE_PRIORITY[baseItem.role] ?? 82),
          namespace: namespaceFor(baseItem.entry, false),
          upstreamCandidatesInStack: [],
          downstreamItemsSupported: [],
          relatedInStack: []
        };
        copyBaseRelations(item, baseById.get(baseItem.entry.id));
        observed.push(item);
      });

      addCartExactRelations(observed);

      const immutableObserved = observed.map((item) => Object.freeze({
        ...item,
        upstreamCandidatesInStack: Object.freeze([...item.upstreamCandidatesInStack]),
        downstreamItemsSupported: Object.freeze([...item.downstreamItemsSupported]),
        relatedInStack: Object.freeze([...item.relatedInStack])
      }));

      const recommended = immutableObserved.map((item) => {
        const supportAdjustment = Math.min(12, item.downstreamItemsSupported.length * 4);
        const gapPenalty = ["source-gap", "disabled"].includes(item.role) ? 8 : 0;
        return Object.freeze({ ...item, investigationScore: Math.max(0, Number(item.priority) - supportAdjustment + gapPenalty) });
      }).sort((a, b) => a.investigationScore - b.investigationScore || a.observedIndex - b.observedIndex);

      const earliest = immutableObserved[0] || null;
      const strongest = recommended[0] || null;
      const chronologyAgreement = Boolean(earliest && strongest && earliest.entry.id === strongest.entry.id);
      const directCount = immutableObserved.filter((item) => ["direct-producer", "verified-producer", "field-observed"].includes(item.role)).length;
      const summaryCount = immutableObserved.filter((item) => ["downstream-summary", "supervision", "escalation"].includes(item.role)).length;
      const gapCount = immutableObserved.filter((item) => ["source-gap", "disabled", "catalog-only"].includes(item.role)).length;

      return Object.freeze({
        input: Array.isArray(input) ? input.join(", ") : String(input || ""),
        observed: Object.freeze(immutableObserved),
        recommended: Object.freeze(recommended),
        unresolved: Object.freeze(unresolved),
        chronologyAgreement,
        earliestObserved: earliest,
        strongestEvidence: strongest,
        counts: Object.freeze({ resolved: immutableObserved.length, direct: directCount, summaries: summaryCount, gaps: gapCount, unresolved: unresolved.length }),
        guidance: "Alarm chronology is preserved exactly as entered. APL Cart five-digit alarms, field HMI observations, base Labeler PLC faults, and Station-instance faults stay in separate namespaces. Investigation order reflects source-backed producer specificity and verified dependencies; it is diagnostic relevance, not proof that one alarm caused another."
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];

      const guardRecovery = analyzeTopModulFaultStack("00003, 00004, 00031", { machineType: "TopModul", applicationMode: "apl" });
      if (guardRecovery.observed[0]?.entry?.id !== "apl-cart-00003") errors.push("v365 lost Cart-local 00003 exact identity.");
      if (guardRecovery.strongestEvidence?.entry?.id !== "apl-cart-00003") errors.push("Cart 00003 must rank ahead of its 00004 recovery state and source-gap 00031.");
      const f4 = guardRecovery.observed.find((item) => item.entry.id === "apl-cart-00004");
      if (!f4?.upstreamCandidatesInStack?.some((row) => row.code === "00003")) errors.push("Cart 00004 lost its proven 00003 upstream relationship.");
      const f31 = guardRecovery.observed.find((item) => item.entry.id === "apl-cart-00031");
      if (f31?.role !== "source-gap") errors.push("Cart 00031 must remain a source gap in stack analysis.");

      const controllerSpecific = analyzeTopModulFaultStack("00002, 00011", { machineType: "TopModul", applicationMode: "apl" });
      if (controllerSpecific.strongestEvidence?.entry?.id !== "apl-cart-00011") errors.push("Specific Cart Ethernet module fault 00011 must rank ahead of general controller I/O supervision 00002.");

      const syncSpecific = analyzeTopModulFaultStack("00016, 00053", { machineType: "TopModul", applicationMode: "apl" });
      if (syncSpecific.strongestEvidence?.entry?.id !== "apl-cart-00053") errors.push("Specific Cart SERCOS fault 00053 must rank ahead of motion-group Not Synchronized 00016.");

      const inactive = analyzeTopModulFaultStack("00040, 00049, 00074", { machineType: "TopModul", applicationMode: "apl" });
      if (!inactive.observed.some((item) => item.entry.id === "apl-cart-00040" && item.role === "disabled")) errors.push("Cart 00040 must remain disabled in stack analysis.");
      if (!inactive.observed.some((item) => item.entry.id === "apl-cart-00049" && item.role === "disabled")) errors.push("Cart 00049 must remain disabled in stack analysis.");
      if (!inactive.observed.some((item) => item.entry.id === "apl-cart-00074" && item.role === "source-gap")) errors.push("Cart 00074 must remain source-gap in stack analysis.");

      const mixed = analyzeTopModulFaultStack("00067, 1091, 663", { machineType: "TopModul", applicationMode: "apl" });
      if (mixed.observed[0]?.entry?.id !== "topmodul-00067-labeler-encoder-feedback") errors.push("Field 00067 authority must survive mixed Cart/Labeler stack analysis.");
      if (!mixed.observed.some((item) => item.entry?.number === 1091)) errors.push("Mixed stack lost Station-instance 1091.");
      if (!mixed.observed.some((item) => item.entry?.number === 663)) errors.push("Mixed stack lost base Labeler 663.");

      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+apl-cart-alarm-stack-v365`,
      analyzeTopModulFaultStack,
      aplCartAlarmStackRoles: ROLE_LABELS,
      aplCartAlarmStackExactRelations: CART_EXACT_RELATIONS,
      validate
    });
  };
});
