"use strict";

(function installTopModulEncoderEvidence(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulEncoderEvidenceExtension() {
  return function extendLibrary(base) {
    if (!base?.analyzeTopModulFaultStack || !base?.getTopModulEncoderIsolationPlan || !base?.getStationFaultVariant) {
      throw new Error("TopModul alarm-stack and encoder-isolation layers are required before encoder evidence synthesis.");
    }

    const OFFSETS = Object.freeze([64, 65, 66, 67, 68, 69]);
    const FIELD_ID = "topmodul-00067-labeler-encoder-feedback";
    const SUBTYPES = Object.freeze({
      64: Object.freeze({ label: "Module Fault", producer: "BaseMachineEncoderAxis.ModuleFault" }),
      65: Object.freeze({ label: "Module Hardware Fault", producer: "BaseMachineEncoderAxis.ModuleHardwareFault" }),
      66: Object.freeze({ label: "Module Sync Fault", producer: "BaseMachineEncoderAxis.ModuleSyncFault" }),
      67: Object.freeze({ label: "Feedback Fault", producer: "BaseMachineEncoderAxis.FeedbackFault" }),
      68: Object.freeze({ label: "Feedback Noise Fault", producer: "BaseMachineEncoderAxis.FeedbackNoiseFault" }),
      69: Object.freeze({ label: "Timer Event Fault", producer: "BaseMachineEncoderAxis.TimerEventFault" })
    });

    const OBSERVE = "Use normal HMI/PLC/motion-axis diagnostics only. Do not force encoder status, motion-axis bits, Station fault words, or Cart-to-Labeler transport data.";
    const LOTO = "Prevent unexpected Station/servo motion and follow site LOTO/stored-energy requirements before hands-on encoder, CN131/W131, module, connector, or cabinet work.";
    const ELECTRICAL = "Energized electrical/signal measurements are for qualified personnel under the site's approved electrical safe-work procedure.";

    function stationCoordinates(number) {
      const n = Number(number);
      if (!Number.isInteger(n) || n < 1024 || n >= 1504) return null;
      const station = Math.floor((n - 1024) / 80) + 1;
      const offset = (n - 1024) % 80;
      if (station < 1 || station > 6) return null;
      return { station, offset };
    }

    function encoderCoordinates(entry, options = {}) {
      if (!entry) return null;
      if (entry.id === FIELD_ID || /^topmodul-00067/i.test(String(entry.id || ""))) {
        const explicit = Number(options.station);
        return { station: Number.isInteger(explicit) && explicit >= 1 && explicit <= 6 ? explicit : null, offset: 67, fieldObserved: true };
      }
      const coordinates = stationCoordinates(entry.number);
      if (!coordinates || !OFFSETS.includes(coordinates.offset)) return null;
      return { ...coordinates, fieldObserved: false };
    }

    function stationFor(entry) {
      const tagged = Number(entry?.plcFault?.station);
      if (Number.isInteger(tagged) && tagged >= 1 && tagged <= 6) return tagged;
      return stationCoordinates(entry?.number)?.station || null;
    }

    function normalizeObservation(observation = {}) {
      const motion = ["yes", "no", "unknown"].includes(String(observation.motion)) ? String(observation.motion) : "unknown";
      const rawFeedback = String(observation.feedback || "unknown");
      const feedback = rawFeedback === "absent" ? "frozen" : rawFeedback === "noisy" ? "intermittent" : ["changing", "frozen", "intermittent", "unknown"].includes(rawFeedback) ? rawFeedback : "unknown";
      return Object.freeze({ motion, feedback });
    }

    function observationFor(group, globalObservation, options, groupCount) {
      const byStation = options?.observationsByStation || {};
      const key = group.station == null ? "unknown" : String(group.station);
      if (byStation && byStation[key]) return normalizeObservation(byStation[key]);
      if (groupCount === 1) return normalizeObservation(globalObservation);
      return normalizeObservation({});
    }

    function nextCheck(offset, observation) {
      if (offset === 64) return "Read BaseMachineEncoderAxis.ModuleFault and the 1756-M02AE/module diagnostic state before opening the encoder cable path.";
      if (offset === 65) return "Read BaseMachineEncoderAxis.ModuleHardwareFault and module hardware diagnostics; do not substitute a feedback-cable diagnosis for a hardware-status fault.";
      if (offset === 66) return "Compare BaseMachineEncoderAxis.ModuleSyncFault with timing/synchronization and any motion-group or communication evidence that appeared first.";
      if (offset === 68) return "Prioritize intermittent signal integrity: FeedbackNoiseFault chronology, CN131/W131 connection, shielding/termination, encoder-source stability, and module-channel diagnostics under the safe-work boundary.";
      if (offset === 69) return "Read BaseMachineEncoderAxis.TimerEventFault and the module event/timing history before replacing the encoder or changing parameters.";
      if (observation.motion === "no") return "Resolve the earlier no-motion, inhibit, drive, safety, contactor, or readiness condition first; then reproduce FeedbackFault only if motion is expected.";
      if (observation.motion === "yes" && observation.feedback === "frozen") return "Confirm FeedbackFault while motion is present, then isolate EEP_APL_Slot11:Ch0 / 1756-M02AE Ch0 -> CN131 / 2001-W131 -> CHA/CHB/CHZ using the approved safe-work procedure.";
      if (observation.motion === "yes" && observation.feedback === "intermittent") return "Cross-check offset 068 Feedback Noise first, then inspect the verified AQB signal-integrity path rather than changing encoder parameters.";
      if (observation.motion === "yes" && observation.feedback === "changing") return "Compare Module, Hardware, Sync, Noise, and Timer Event status/chronology before condemning the encoder because counts are still changing.";
      return "Confirm actual motion first, then classify AQB feedback as changing, frozen/absent, or intermittent/noisy before entering the physical feedback route.";
    }

    function scoreCandidate(offset, observed, earliestIndex, observation) {
      let score = 100;
      if (observed) {
        score -= 45;
        score += Math.max(0, Number(observed.observedIndex) || 0) * 3;
        if (observed.observedIndex === earliestIndex) score -= 5;
      }

      if (observation.motion === "no") {
        if (offset === 67) score += 30;
        if (offset === 68) score += 20;
      } else if (observation.motion === "yes" && observation.feedback === "frozen") {
        if (offset === 67) score -= 45;
        else if (offset === 68) score -= 8;
        else score += 8;
      } else if (observation.motion === "yes" && observation.feedback === "intermittent") {
        if (offset === 68) score -= 45;
        else if (offset === 67) score -= 20;
        else score += 8;
      } else if (observation.motion === "yes" && observation.feedback === "changing") {
        if (offset === 67) score += 28;
        else if (observed) score -= 15;
      }
      return score;
    }

    function candidateReason(offset, observed, observation) {
      const reasons = [`Direct status producer: ${SUBTYPES[offset].producer}.`];
      if (observed) reasons.push(`Observed in the supplied alarm stack at position ${observed.observedIndex + 1}.`);
      else reasons.push("Not observed in this stack; retained only as a sibling cross-check.");
      if (observation.motion === "no" && offset === 67) reasons.push("Actual motion is absent, so physical AQB feedback isolation is held until the no-motion condition is resolved.");
      if (observation.motion === "yes" && observation.feedback === "frozen" && offset === 67) reasons.push("Actual motion plus frozen/absent AQB feedback directly matches the FeedbackFault isolation route.");
      if (observation.motion === "yes" && observation.feedback === "intermittent" && offset === 68) reasons.push("Intermittent/noisy AQB behavior directly favors the Feedback Noise subtype and signal-integrity checks.");
      if (observation.motion === "yes" && observation.feedback === "intermittent" && offset === 67) reasons.push("Feedback Fault remains relevant, but Feedback Noise is the more specific observation match.");
      if (observation.motion === "yes" && observation.feedback === "changing" && offset === 67) reasons.push("Changing AQB counts reduce confidence that a persistent open/frozen feedback path is the immediate condition.");
      if (observation.motion === "yes" && observation.feedback === "changing" && observed && offset !== 67) reasons.push("This non-feedback subtype is observed while counts are changing, so its exact module/status producer deserves priority over automatic encoder replacement.");
      return Object.freeze(reasons);
    }

    function makeGroup(rawItems, station, fieldObserved, stackAnalysis, observation, options, groupCount) {
      const observedByOffset = new Map();
      for (const item of rawItems) {
        const coordinates = encoderCoordinates(item.entry, options);
        if (!coordinates) continue;
        const existing = observedByOffset.get(coordinates.offset);
        if (!existing || item.observedIndex < existing.observedIndex) observedByOffset.set(coordinates.offset, item);
      }
      const observedRows = [...observedByOffset.entries()].map(([offset, item]) => Object.freeze({
        offset,
        localCode: String(offset).padStart(3, "0"),
        number: Number.isFinite(Number(item.entry?.number)) && !item.entry?.id?.startsWith("topmodul-00067") ? Number(item.entry.number) : null,
        title: item.entry?.title || SUBTYPES[offset].label,
        observedIndex: item.observedIndex,
        token: item.token,
        entry: item.entry
      })).sort((a, b) => a.observedIndex - b.observedIndex);
      const earliestIndex = observedRows.length ? observedRows[0].observedIndex : Infinity;
      const appliedObservation = observationFor({ station }, observation, options, groupCount);

      const ranked = OFFSETS.map((offset) => {
        const observed = observedRows.find((row) => row.offset === offset) || null;
        const variant = station ? base.getStationFaultVariant(offset, station) : null;
        return Object.freeze({
          offset,
          localCode: String(offset).padStart(3, "0"),
          number: variant?.number ? Number(variant.number) : null,
          title: variant?.title || SUBTYPES[offset].label,
          producer: SUBTYPES[offset].producer,
          observed: Boolean(observed),
          observedIndex: observed?.observedIndex ?? null,
          score: scoreCandidate(offset, observed, earliestIndex, appliedObservation),
          reasons: candidateReason(offset, observed, appliedObservation),
          nextCheck: nextCheck(offset, appliedObservation)
        });
      }).sort((a, b) => a.score - b.score || (a.observedIndex ?? 999) - (b.observedIndex ?? 999) || a.offset - b.offset);

      const encoderIds = new Set(rawItems.map((item) => item.entry?.id));
      const upstream = (stackAnalysis.recommended || []).filter((item) => {
        if (!item?.entry || encoderIds.has(item.entry.id) || Number(item.entry.number) === 670) return false;
        if (["source-gap", "disabled", "catalog-only"].includes(item.role)) return false;
        const candidateStation = stationFor(item.entry);
        if (station && candidateStation && candidateStation !== station) return false;
        return item.observedIndex < earliestIndex || item.investigationScore <= (ranked[0]?.score ?? 100);
      }).slice(0, 3).map((item) => Object.freeze({
        number: Number.isFinite(Number(item.entry.number)) ? Number(item.entry.number) : null,
        code: item.entry.code || "",
        title: item.entry.title,
        role: item.role,
        observedIndex: item.observedIndex,
        investigationScore: item.investigationScore,
        entry: item.entry
      }));

      const holdPhysicalFeedback = appliedObservation.motion === "no";
      const strongest = ranked[0] || null;
      const firstObserved = observedRows[0] || null;
      const chronologyAgreement = Boolean(firstObserved && strongest && firstObserved.offset === strongest.offset);
      return Object.freeze({
        id: `encoder-evidence-${station || "unknown"}`,
        station: station || null,
        fieldObserved: Boolean(fieldObserved),
        observation: appliedObservation,
        observed: Object.freeze(observedRows),
        ranked: Object.freeze(ranked),
        strongest,
        firstObserved,
        chronologyAgreement,
        holdPhysicalFeedback,
        upstreamCandidates: Object.freeze(upstream),
        recommendedUpstream: holdPhysicalFeedback ? upstream[0] || null : null,
        guidance: holdPhysicalFeedback
          ? "Actual motion is absent. Preserve the encoder alarm as evidence, but resolve the earlier no-motion/inhibit condition before opening the AQB feedback circuit."
          : "Ranking combines observed alarm order with the v348 motion/feedback observation. It prioritizes diagnostic relevance only; it does not prove which component failed.",
        safety: Object.freeze([OBSERVE, LOTO, ELECTRICAL])
      });
    }

    function analyzeTopModulEncoderEvidence(input, observation = {}, options = {}) {
      const stackAnalysis = base.analyzeTopModulFaultStack(input, { machineType: "TopModul", ...(options.context || {}) });
      const groups = new Map();
      let mainItem = null;

      for (const item of stackAnalysis.observed || []) {
        if (Number(item.entry?.number) === 670 && item.entry?.plcFault) {
          mainItem = item;
          continue;
        }
        const coordinates = encoderCoordinates(item.entry, options);
        if (!coordinates) continue;
        const key = coordinates.station == null ? "unknown" : String(coordinates.station);
        if (!groups.has(key)) groups.set(key, { station: coordinates.station, fieldObserved: coordinates.fieldObserved, items: [] });
        const group = groups.get(key);
        group.fieldObserved = group.fieldObserved || coordinates.fieldObserved;
        group.items.push(item);
      }

      const groupCount = groups.size;
      const stationGroups = [...groups.values()].map((group) => makeGroup(group.items, group.station, group.fieldObserved, stackAnalysis, observation, options, groupCount));
      stationGroups.sort((a, b) => {
        const ai = a.firstObserved?.observedIndex ?? 999;
        const bi = b.firstObserved?.observedIndex ?? 999;
        return ai - bi || (a.station ?? 99) - (b.station ?? 99);
      });

      let mainLabeler = null;
      if (mainItem) {
        const plan = base.getTopModulEncoderIsolationPlan(670);
        const mainObservation = options.mainObservation || (stationGroups.length ? {} : observation);
        mainLabeler = Object.freeze({
          entry: mainItem.entry,
          observedIndex: mainItem.observedIndex,
          plan,
          observation: Object.freeze({ ...mainObservation }),
          evaluation: plan?.evaluate ? plan.evaluate(mainObservation) : null,
          guidance: "Fault 670 is the base Labeler fine-clock system and is never ranked inside a Station/Cart 064-069 encoder family."
        });
      }

      const warnings = [];
      if (stationGroups.length > 1) warnings.push("Encoder alarms span more than one Station/Cart scope. ServoForge keeps each station separate; do not merge their module/cable evidence into one replacement decision.");
      if (stationGroups.some((group) => group.station == null)) warnings.push("Field HMI 00067 does not identify a Station number by itself. ServoForge keeps the station unknown unless an explicit station context is supplied.");
      if (mainLabeler && stationGroups.length) warnings.push("The stack contains both Station/Cart encoder evidence and base Labeler Fault 670. These are separate encoder systems and are analyzed independently.");

      return Object.freeze({
        input: String(input || ""),
        stackAnalysis,
        stationGroups: Object.freeze(stationGroups),
        mainLabeler,
        multiStation: stationGroups.length > 1,
        warnings: Object.freeze(warnings),
        guidance: "Use chronology plus verified producer status and observed motion/feedback behavior. The ranking is an isolation aid, not proof of causality and not authorization to bypass encoder supervision or safety logic."
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];

      const noise = analyzeTopModulEncoderEvidence("1092, 1091", { motion: "yes", feedback: "intermittent" });
      if (noise.stationGroups[0]?.strongest?.offset !== 68) errors.push("v349 must prioritize Feedback Noise for intermittent/noisy feedback evidence.");

      const changing = analyzeTopModulEncoderEvidence("1091, 1090", { motion: "yes", feedback: "changing" });
      if (changing.stationGroups[0]?.strongest?.offset !== 66) errors.push("v349 must prioritize observed Sync evidence over FeedbackFault when AQB counts are changing.");

      const noMotion = analyzeTopModulEncoderEvidence("1029, 1091", { motion: "no" });
      if (!noMotion.stationGroups[0]?.holdPhysicalFeedback) errors.push("v349 must hold physical feedback isolation when actual motion is absent.");
      if (noMotion.stationGroups[0]?.recommendedUpstream?.number !== 1029) errors.push("v349 should surface earlier Station main-contactor evidence before a no-motion FeedbackFault route.");

      const field = analyzeTopModulEncoderEvidence("00067", { motion: "yes", feedback: "frozen" });
      if (field.stationGroups[0]?.station !== null) errors.push("v349 must not invent a Station number for field HMI 00067.");
      if (field.stationGroups[0]?.strongest?.offset !== 67) errors.push("v349 field 00067 frozen-feedback evidence must remain local Feedback Fault 067.");

      const mixed = analyzeTopModulEncoderEvidence("1091, 1172", { motion: "yes", feedback: "intermittent" });
      if (!mixed.multiStation || mixed.stationGroups.length !== 2) errors.push("v349 must keep mixed-station encoder alarms in separate groups.");

      const parallel = analyzeTopModulEncoderEvidence("670, 1091", { motion: "yes", feedback: "frozen" }, { mainObservation: { motion: "yes", fineClock: "changing" } });
      if (!parallel.mainLabeler || parallel.stationGroups.length !== 1) errors.push("v349 must analyze base Fault 670 separately from Station encoder evidence.");
      if (parallel.stationGroups[0]?.ranked?.some((candidate) => candidate.number === 670)) errors.push("v349 must never fold Fault 670 into the Station 064-069 ranking.");

      const separate67 = analyzeTopModulEncoderEvidence("00067, 067", { motion: "yes", feedback: "frozen" });
      if (separate67.stationGroups.length !== 1 || separate67.stackAnalysis.observed[1]?.entry?.title !== "Labeling Station Change Mode Active") errors.push("v349 must keep field 00067 separate from base PLC Fault 067 Change Mode.");

      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+encoder-evidence-v1`,
      analyzeTopModulEncoderEvidence,
      topModulEncoderEvidenceOffsets: OFFSETS,
      validate
    });
  };
});
