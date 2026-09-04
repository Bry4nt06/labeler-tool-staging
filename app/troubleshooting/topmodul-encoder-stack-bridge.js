"use strict";

(function installTopModulEncoderStackBridge(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulEncoderStackBridgeExtension() {
  return function extendLibrary(base) {
    if (!base?.analyzeTopModulFaultStack || !base?.getTopModulEncoderIsolationPlan) {
      throw new Error("TopModul alarm-stack and encoder-isolation layers are required before the encoder stack bridge.");
    }

    const FIELD_00067_ID = "topmodul-00067-labeler-encoder-feedback";
    const SAFETY = Object.freeze([
      "Alarm-stack ranking is diagnostic relevance, not proof of causality. Preserve the actual HMI chronology and machine state.",
      "Do not force encoder inputs, motion-axis status, Station fault bits, or Cart-to-Labeler transport words.",
      "Prevent unexpected Station/servo motion and follow site LOTO/stored-energy requirements before hands-on encoder, connector, module, or cabinet work.",
      "Energized electrical/signal measurements are for qualified personnel under the site's approved electrical safe-work procedure."
    ]);

    const freeze = (value) => Object.freeze(value);
    const uniqueNumbers = (values) => [...new Set(values.filter(Number.isFinite))].sort((a, b) => a - b);
    const stationNumber = (value) => {
      if (value == null || value === "") return null;
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 6 ? n : null;
    };
    const optionalNumber = (value) => {
      if (value == null || value === "") return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    function encoderItem(item) {
      if (!item?.entry) return null;
      const plan = base.getTopModulEncoderIsolationPlan(item.entry);
      if (!plan) return null;
      return freeze({
        entry: item.entry,
        plan,
        observedIndex: item.observedIndex,
        role: item.role,
        roleLabel: item.roleLabel,
        priority: item.priority,
        investigationScore: optionalNumber(item.investigationScore),
        station: stationNumber(plan.station),
        scope: plan.scope,
        localOffset: optionalNumber(plan.localOffset),
        subtype: plan.subtype?.label || "Encoder supervision",
        producer: plan.producer
      });
    }

    function stationContextFor(items) {
      const stations = uniqueNumbers(items.map((item) => item.station));
      const hasField00067 = items.some((item) => item.entry?.id === FIELD_00067_ID);
      const hasMain = items.some((item) => /^Main Labeler encoder/i.test(String(item.scope || "")));
      if (stations.length > 1) return freeze({ kind: "multiple", stations: freeze(stations), label: `Multiple Stations (${stations.join(", ")})`, exact: false });
      if (stations.length === 1) return freeze({ kind: "single", stations: freeze(stations), station: stations[0], label: `Station ${stations[0]}`, exact: true });
      if (hasField00067) return freeze({ kind: "unknown", stations: freeze([]), label: "Station not identified by HMI 00067 alone", exact: false });
      if (hasMain) return freeze({ kind: "not-applicable", stations: freeze([]), label: "Main Labeler / no Station instance", exact: true });
      return freeze({ kind: "unknown", stations: freeze([]), label: "Station not identified", exact: false });
    }

    function stationGroups(items) {
      const groups = new Map();
      for (const item of items) {
        if (!Number.isFinite(item.station)) continue;
        const station = item.station;
        if (!groups.has(station)) groups.set(station, []);
        groups.get(station).push(item);
      }
      return freeze([...groups.entries()].sort((a, b) => a[0] - b[0]).map(([station, rows]) => freeze({
        station,
        observed: freeze(rows.slice().sort((a, b) => a.observedIndex - b.observedIndex))
      })));
    }

    function targetSearchFor(item) {
      if (!item?.entry) return "";
      if (item.entry.id === FIELD_00067_ID) return "00067";
      if (Number.isFinite(Number(item.entry.number))) return String(Number(item.entry.number));
      return String(item.entry.code || "");
    }

    function guidanceFor(result) {
      const notes = [];
      if (result.crossScope) notes.push("The stack contains both Station/Cart and main-Labeler encoder evidence. Keep those circuits and producers separate.");
      if (result.stationContext.kind === "multiple") notes.push("Encoder alarms are present from more than one Station. Do not collapse them into one Cart diagnosis.");
      if (result.hasField00067 && result.stationContext.kind === "single") notes.push(`The same stack contains exact Station ${result.stationContext.station} encoder evidence. That supplies useful Station context, but co-occurrence alone does not prove the field HMI 00067 originated from that Cart.`);
      if (result.hasField00067 && result.stationContext.kind === "unknown") notes.push("Field HMI 00067 proves the shared Cart-local FeedbackFault method, but the HMI code by itself does not identify which Station instance produced it.");
      notes.push("Motion, AQB feedback behavior, and fine-clock behavior are not inferred from alarm history. Open the isolation target and enter those observations only after verifying them on the machine.");
      notes.push("The recommended target follows the existing alarm-stack evidence ranking; observed order remains independently preserved.");
      return notes.join(" ");
    }

    function analyzeTopModulEncoderStack(input, context = {}) {
      const stack = base.analyzeTopModulFaultStack(input, { ...context, machineType: context.machineType || "TopModul" });
      const observed = freeze(stack.observed.map(encoderItem).filter(Boolean));
      const recommended = freeze(stack.recommended.map(encoderItem).filter(Boolean));
      if (!observed.length) {
        return freeze({
          hasEncoderEvidence: false,
          input: String(input || ""),
          stack,
          observed,
          recommended,
          earliestObservedEncoder: null,
          strongestEncoderEvidence: null,
          target: null,
          targetSearch: "",
          stationContext: freeze({ kind: "none", stations: freeze([]), label: "No encoder evidence in this stack", exact: false }),
          stationGroups: freeze([]),
          scopes: freeze([]),
          crossScope: false,
          hasField00067: false,
          fieldStationContextAvailable: false,
          observationAssumptions: freeze({ inferred: false, motion: "unknown", feedback: "unknown", fineClock: "unknown" }),
          safety: SAFETY,
          guidance: "No source-backed TopModul encoder isolation case is present in this alarm stack."
        });
      }

      const earliestObservedEncoder = observed[0];
      const strongestEncoderEvidence = recommended[0] || earliestObservedEncoder;
      const target = strongestEncoderEvidence || earliestObservedEncoder;
      const stationContext = stationContextFor(observed);
      const scopes = freeze([...new Set(observed.map((item) => item.scope))]);
      const hasField00067 = observed.some((item) => item.entry.id === FIELD_00067_ID);
      const result = {
        hasEncoderEvidence: true,
        input: String(input || ""),
        stack,
        observed,
        recommended,
        earliestObservedEncoder,
        strongestEncoderEvidence,
        target,
        targetSearch: targetSearchFor(target),
        stationContext,
        stationGroups: stationGroups(observed),
        scopes,
        crossScope: scopes.length > 1,
        hasField00067,
        fieldStationContextAvailable: hasField00067 && stationContext.kind === "single",
        observationAssumptions: freeze({ inferred: false, motion: "unknown", feedback: "unknown", fineClock: "unknown" }),
        safety: SAFETY
      };
      return freeze({ ...result, guidance: guidanceFor(result) });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];

      const field = analyzeTopModulEncoderStack("00067");
      if (!field.hasEncoderEvidence || field.target?.entry?.id !== FIELD_00067_ID) errors.push("v349 lost field HMI 00067 encoder-stack resolution.");
      if (field.stationContext.kind !== "unknown" || field.observationAssumptions.inferred !== false) errors.push("v349 must not infer Station or motion/feedback state from HMI 00067 alone.");

      const fieldWithStation = analyzeTopModulEncoderStack("00067, 1091");
      if (fieldWithStation.stationContext.station !== 1 || !fieldWithStation.fieldStationContextAvailable) errors.push("v349 lost exact Station 1 context when global 1091 accompanies field 00067.");
      if (!/co-occurrence alone does not prove/i.test(fieldWithStation.guidance)) errors.push("v349 must preserve the field/global Station provenance caveat.");

      const sameStation = analyzeTopModulEncoderStack("1092, 1091");
      if (sameStation.stationGroups[0]?.station !== 1 || sameStation.stationGroups[0]?.observed?.length !== 2) errors.push("v349 must retain multiple encoder subtypes for one Station.");
      const analyzerTarget = sameStation.stack.recommended.find((item) => base.getTopModulEncoderIsolationPlan(item.entry));
      if (sameStation.target?.entry?.id !== analyzerTarget?.entry?.id) errors.push("v349 must inherit encoder target order from the alarm-stack analyzer rather than inventing a new causal hierarchy.");

      const multi = analyzeTopModulEncoderStack("1091, 1171");
      if (multi.stationContext.kind !== "multiple" || multi.stationContext.stations.length !== 2) errors.push("v349 must not collapse encoder evidence from multiple Stations.");

      const crossScope = analyzeTopModulEncoderStack("670, 1091");
      if (!crossScope.crossScope || crossScope.scopes.length !== 2) errors.push("v349 must keep main Labeler and Station encoder scopes separate in one stack.");

      const changeMode = analyzeTopModulEncoderStack("067, 1091");
      if (changeMode.observed.length !== 1 || changeMode.observed[0]?.entry?.number !== 1091) errors.push("v349 must exclude base Labeler PLC Fault 067 Change Mode from encoder isolation evidence.");

      const nonEncoder = analyzeTopModulEncoderStack("673, 674");
      if (nonEncoder.hasEncoderEvidence || nonEncoder.target) errors.push("v349 must remain silent for non-encoder alarm stacks.");

      return { ok: errors.length === 0, errors };
    }

    return freeze({
      ...base,
      version: `${base.version}+encoder-stack-bridge-v1`,
      analyzeTopModulEncoderStack,
      validate
    });
  };
});
