"use strict";

(function installAplCartLabelSupplyChronology(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplCartLabelSupplyChronologyExtension() {
  return function extendLibrary(base) {
    if (!base?.getAplCartFoundationPlan || !base?.evaluateAplCartFoundation || !base?.getAplCartWarningPlan || !base?.getAplCartWebHandlingPlan || !base?.getTopModulFault || !base?.validate) {
      throw new Error("APL Cart warning, web-handling, Cart fault, and TopModul Labeler layers are required before label-supply chronology.");
    }

    const CART_SOURCE = base.getSource?.("lb1-aplcart-readable-l5k-v355") || Object.freeze({
      id: "lb1-aplcart-readable-l5k-v355",
      file: "CO85_LB1_APLCart_1.L5K",
      controller: "CO85_LB1_APLCart_1"
    });
    const LABELER_SOURCE = base.getSource?.("topmodul-k407039-lb1-l5k") || Object.freeze({
      id: "topmodul-k407039-lb1-l5k",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1"
    });

    const OBSERVE = "Use normal HMI/PLC diagnostics and alarm history only. Do not force, write, unlatch, or bypass warning, fault, autochange, selector, sensor, communication, container-stop, or station-state bits.";
    const LOTO = "Stop the machine and follow site lockout/tagout and stored-energy requirements before hands-on work on the label web, reel, end-of-reel sensors, selector hardware, carriage, connectors, or station mechanisms.";
    const ELECTRICAL = "Energized I/O or signal measurements are for qualified personnel under the site's approved electrical safe-work procedure and current machine schematic.";
    const SAFETY = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);
    const LABELER_SUMMARIES = Object.freeze([655, 656, 657, 658, 659, 660]);

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const watch = (tag, role, relationship, interpretation, caution = "") => Object.freeze({ tag, role, relationship, interpretation, caution });
    const step = (order, label, detail) => Object.freeze({ order, label, detail });
    const choice = (value, label) => Object.freeze({ value, label });
    const observe = (key, prompt, choices) => Object.freeze({ key, prompt, choices: Object.freeze(choices) });
    const yesNoUnknown = Object.freeze([choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")]);

    const CHAIN = Object.freeze({
      selectedWarning: "StartStop.StartupComplete AND !StartStop.AutoChangeActive AND !StartStop.ForceAutochange AND selected InputDetectEndOfReel1/2 through SS631 AND !Faults[1].9 -> OTL(Warnings[0].5)",
      handoff: "Warnings[0].5 OR Faults[1].9 OR StartStop.ForceAutochange OR StartStop.WarnLabLengthForceAutochg OR !Prog.LabelStation.AtMelco.I_Selected -> DataFromLS.Par1[0].1",
      labelerReceive: "DataFromLS[station].Par1[0].1 -> Aggregat_0station.I_LackOfLabel",
      labelerSummary: "Aggregat_0station.O_Fault[1] AND Aggregat_0station.O_Fault[4] -> Labeler Fault 655-660"
    });

    function labelerStation(value) {
      const number = typeof value === "object" && value ? Number(value.number ?? value.plcFault?.number) : Number(String(value ?? "").trim());
      return LABELER_SUMMARIES.includes(number) ? number - 654 : 0;
    }

    function isWarning(value, number) {
      const plan = base.getAplCartWarningPlan(value);
      return Number(plan?.warningNumber) === number;
    }

    function isCart25(value) {
      if (typeof value === "object" && value) return value.id === "apl-cart-00025" || value.code === "00025" || (value.category?.startsWith?.("APL Cart") && Number(value.number) === 25);
      if (Number.isInteger(value)) return Number(value) === 25;
      const text = String(value ?? "").trim();
      return /^00025$/.test(text) || /^apl-cart-(?:web-)?00025$/i.test(text) || /^apl cart (?:fault )?0*25$/i.test(text);
    }

    function sharedWatchPoints(station = 0) {
      const labelerBlock = station ? `DataFromLS[${station}].Par1[0].1 -> Aggregat_0${station}.I_LackOfLabel` : "DataFromLS[n].Par1[0].1 -> Aggregat_0n.I_LackOfLabel";
      return freezeRows([
        watch("E5701_PE631_DetectorEndOfReel_1 / I0005.15", "End-of-reel detector 1", "Feeds the conditioned InputDetectEndOfReel1/2 logic according to configuration/direction.", "Use the existing Fault 00025 hardware route to verify the raw detector only after the chronology points here.", "Do not assume PE631 is always the active detector."),
        watch("E5701_PE632_DetectorEndOfReel_2 / I0005.16", "End-of-reel detector 2", "Participates in the same configuration/direction-dependent detector conditioning.", "Compare both conditioned detector states with machine direction and approved setup.", "Do not swap or defeat detector inputs to clear a warning."),
        watch("E5701_SS631_SelSwitchEndOfReel / I0005.4", "Warning detector selector", "W 0005 uses SS631 to choose which conditioned end-of-reel detector participates in the Low Labels warning.", "If selector position and PLC input disagree, diagnose the selector/input circuit rather than changing logic."),
        watch("Warnings[0].5 / W 0005", "Pre-fault Low Labels state", "Can latch only after StartupComplete while AutoChangeActive, ForceAutochange, and hard Fault 00025 are not active.", "If W 0005 occurred first, preserve it as pre-fault evidence even if a later state suppresses it."),
        watch("Faults[1].9 / Cart 00025", "Hard local No Labels / End Of Reel fault", "The Cart's existing v361 route owns the exact producer/hardware diagnosis for the harder end-of-reel condition.", "Use the v361 Cart 00025 plan for sensor/counter details; v366 does not create a second hardware procedure."),
        watch("StartStop.AutoChangeActive / StartStop.ForceAutochange", "Autochange state", "Autochange can intentionally suppress W 0005 presentation while the label-supply condition is being handled.", "A suppressed warning is not proof the detector/reel condition has been repaired."),
        watch("StartStop.WarnLabLengthForceAutochg", "Label-length autochange request", "Participates in the same DataFromLS.Par1[0].1 handoff even though its initiating evidence belongs to the label-length measurement path.", "Do not change measurement thresholds or recipe values merely to clear the downstream summary."),
        watch("DataFromLS.Par1[0].1", "Composite Cart-to-Labeler label-supply bit", "True for W 0005, Cart 00025, ForceAutochange, label-length autochange warning, or a not-selected station.", "This is a composite status; do not call it a single magazine-empty sensor."),
        watch(labelerBlock, "Base Labeler receive path", "The Labeler converts the Cart composite bit into the shared Aggregat LackOfLabel state.", "Use the Cart condition that occurred first before troubleshooting the downstream Labeler summary."),
        watch(station ? `Labeler Fault ${654 + station}` : "Labeler Faults 655-660", "Downstream Label Magazine Empty summary", "Requires the shared Aggregat lack-of-label/container-stop qualification; it is not a direct Cart sensor fault.", "Treat this as downstream summary evidence unless no earlier Cart warning/fault is available.")
      ]);
    }

    function sharedSteps(station = 0) {
      return freezeRows([
        step(1, "Preserve chronology before reset", "Record whether W 0005, Cart 00025, W 0012/label-length autochange, ForceAutochange, or the Labeler summary appeared first. The earliest source-backed event is normally more useful than the final summary."),
        step(2, "Identify the selected/conditioned detector path", "Read PE631, PE632, SS631, the conditioned InputDetectEndOfReel1/2 states, machine direction/configuration, and current reel/web condition without forcing logic."),
        step(3, "Separate warning, hard fault, and autochange", "W 0005 is pre-fault evidence; Cart 00025 is the harder local end-of-reel fault; AutoChangeActive/ForceAutochange can intentionally change what remains visible."),
        step(4, "Decode the composite handoff", "Read DataFromLS.Par1[0].1 together with Warnings[0].5, Faults[1].9, ForceAutochange, WarnLabLengthForceAutochg, and station Selected. Do not infer one physical cause from the composite bit alone."),
        step(5, station ? `Confirm Station ${station} Labeler qualification` : "Confirm the Labeler qualification", station ? `Trace DataFromLS[${station}].Par1[0].1 into Aggregat_0${station}.I_LackOfLabel and use Fault ${654 + station} only as the downstream summary.` : "Trace the selected Station's DataFromLS[n].Par1[0].1 into its shared Aggregat I_LackOfLabel state. Stations 1-6 use the same method; only the station instance changes."),
        step(6, "Inspect hardware only after the source path narrows it", "If the live chronology points to the end-of-reel detector/web path, use the existing Cart 00025 PE631/PE632 route and follow stopped-machine/LOTO requirements before hands-on inspection.")
      ]);
    }

    const OBSERVATIONS = Object.freeze([
      observe("lowLabels", "W 0005 Low Labels active/recorded first?", yesNoUnknown),
      observe("cartEndOfReel", "Cart Fault 00025 active/recorded?", yesNoUnknown),
      observe("autochange", "AutoChangeActive or ForceAutochange active during the event?", yesNoUnknown),
      observe("labelLengthAutochange", "Label-length warning/autochange request active during the event?", yesNoUnknown),
      observe("handoff", "DataFromLS.Par1[0].1 active?", yesNoUnknown),
      observe("labelerSummary", "Labeler 655-660 summary active?", yesNoUnknown)
    ]);

    function previousPlanFor(value, lowLabels, labelLength, cart25) {
      if (lowLabels || labelLength) return base.getAplCartWarningPlan(value) || base.getAplCartFoundationPlan(value);
      if (cart25) return base.getAplCartWebHandlingPlan(value) || base.getAplCartWebHandlingPlan(25) || base.getAplCartFoundationPlan(value);
      return base.getAplCartFoundationPlan(value);
    }

    function labelSupplyPlan(value) {
      const station = labelerStation(value);
      const lowLabels = isWarning(value, 5);
      const labelLength = isWarning(value, 12);
      const cart25 = isCart25(value);
      if (!station && !lowLabels && !labelLength && !cart25) return null;

      const previous = station ? null : previousPlanFor(value, lowLabels, labelLength, cart25);
      const identity = station ? `labeler-${654 + station}` : lowLabels ? "warning-0005" : labelLength ? "warning-0012" : "cart-00025";
      const title = station ? `Station ${station} label-supply chronology / Labeler Fault ${654 + station}` : lowLabels ? "Low Labels chronology / W 0005" : labelLength ? "Label-length autochange contribution / W 0012" : "No Labels / End Of Reel chronology / Cart 00025";
      const priorProducer = lowLabels ? CHAIN.selectedWarning : (previous?.producer || "");
      const producer = station
        ? `${CHAIN.handoff} -> DataFromLS[${station}].Par1[0].1 -> Aggregat_0${station}.I_LackOfLabel -> shared Aggregat qualification -> Fault ${654 + station}`
        : `${priorProducer ? `${priorProducer} | ` : ""}${CHAIN.handoff} -> ${CHAIN.labelerReceive} -> ${CHAIN.labelerSummary}`;
      const summary = station
        ? `Labeler Fault ${654 + station} is the downstream Station ${station} Label Magazine Empty summary. The Cart transmit bit is composite: Low Labels W 0005, Cart 00025, ForceAutochange, label-length autochange warning, or station-not-selected can all feed DataFromLS[${station}].Par1[0].1 before the shared Aggregat qualification. Diagnose the earliest Cart-side state instead of treating Fault ${654 + station} as one magazine sensor.`
        : lowLabels
          ? "W 0005 is the Cart's pre-fault Low Labels evidence. It is conditioned by startup/autochange state and SS631-selected end-of-reel detection, then participates in the same composite label-supply bit sent to the base Labeler. A later autochange or Cart 00025 can suppress/change the visible warning without proving the physical condition recovered."
          : labelLength
            ? "W 0012 remains a label-length measurement warning, but the Cart also has a label-length autochange request that can assert the same DataFromLS.Par1[0].1 label-supply handoff. Keep the measurement cause separate from end-of-reel hardware even when the downstream Labeler shows Label Magazine Empty."
            : "Cart 00025 remains the authoritative local No Labels / End Of Reel fault with its existing PE631/PE632 source route. v366 adds what happens next: Cart 00025 participates in the composite DataFromLS.Par1[0].1 handoff and can therefore lead to Labeler 655-660 without creating a second independent magazine fault.";

      const sourceRefs = [
        "CO85_LB1_APLCart_1.L5K — Warnings[0].5 Low Labels selection and Faults[1].9 pre-fault inhibit",
        "CO85_LB1_APLCart_1.L5K — Warnings[0].5 OR Faults[1].9 OR ForceAutochange OR WarnLabLengthForceAutochg OR !I_Selected -> DataFromLS.Par1[0].1",
        `${LABELER_SOURCE.file || "CO85_LB1_Labeler_1online.L5K"} — DataFromLS[n].Par1[0].1 -> shared Aggregat LackOfLabel -> Labeler Faults 655-660`
      ];

      return Object.freeze({
        ...(previous || {}),
        id: `apl-cart-label-supply-v366-${identity}`,
        number: station ? 654 + station : (previous?.number ?? value),
        code: station ? String(654 + station) : (previous?.code ?? String(value || "")),
        title,
        scope: station ? `TopModul base Labeler + shared APL Cart/Station ${station} handoff` : "LB1 APL Cart 1 -> shared TopModul Labeler station handoff",
        family: "Label supply / end-of-reel / autochange chronology",
        status: "exact-cross-controller-status-chronology",
        producer,
        summary,
        source: CART_SOURCE,
        sourceRefs: Object.freeze(sourceRefs),
        roles: Object.freeze([
          Object.freeze({ label: "Cart pre-fault", value: "W 0005 Low Labels" }),
          Object.freeze({ label: "Cart hard local fault", value: "00025 No Labels / End Of Reel" }),
          Object.freeze({ label: "State modifiers", value: "AutoChangeActive / ForceAutochange / label-length autochange" }),
          Object.freeze({ label: "Cross-controller handoff", value: "DataFromLS.Par1[0].1" }),
          Object.freeze({ label: "Labeler downstream summary", value: station ? `Fault ${654 + station}` : "Faults 655-660" })
        ]),
        steps: sharedSteps(station),
        watchPoints: sharedWatchPoints(station),
        observations: OBSERVATIONS,
        parameters: Object.freeze([]),
        safety: SAFETY,
        chronology: Object.freeze({
          station: station || null,
          warning: "W 0005",
          hardFault: "00025",
          labelLengthWarning: "W 0012 / StartStop.WarnLabLengthForceAutochg",
          handoff: "DataFromLS.Par1[0].1",
          labelerSummary: station ? 654 + station : "655-660",
          oneSharedStationMethod: true
        }),
        previousPlan: previous || null
      });
    }

    function evaluateLabelSupply(value, observation = {}) {
      const plan = labelSupplyPlan(value);
      if (!plan) return null;
      if (observation.cartEndOfReel === "yes") return Object.freeze({
        code: "cart-00025-first",
        severity: "direct",
        title: "Hard Cart end-of-reel fault is the stronger local evidence",
        summary: "Cart 00025 is present in the same label-supply chain and is more specific than the downstream Labeler 655-660 summary.",
        next: "Use the existing Cart 00025 PE631/PE632/configuration-dependent source route; preserve whether W 0005 preceded it."
      });
      if (observation.lowLabels === "yes") return Object.freeze({
        code: "low-labels-first",
        severity: "direct",
        title: "Low Labels warning is the earliest available Cart evidence",
        summary: "W 0005 supports a developing label-supply/end-of-reel condition before the harder Cart 00025 path.",
        next: observation.autochange === "yes" ? "Autochange is active, so warning presentation can change; verify the selected detector/reel condition rather than treating suppression as recovery." : "Check the SS631-selected conditioned detector and reel/web condition, then watch whether Cart 00025 follows."
      });
      if (observation.labelLengthAutochange === "yes") return Object.freeze({
        code: "label-length-autochange",
        severity: "direct",
        title: "Label-length autochange is feeding the label-supply handoff",
        summary: "The composite DataFromLS.Par1[0].1 bit can be true from the label-length autochange request without an end-of-reel sensor being the cause.",
        next: "Use W 0012 / Fault 00022 measurement evidence; do not change approved recipe thresholds merely to clear the downstream Labeler summary."
      });
      if (observation.autochange === "yes") return Object.freeze({
        code: "autochange-state",
        severity: "observe",
        title: "Autochange state is modifying the visible label-supply alarms",
        summary: "AutoChangeActive/ForceAutochange can suppress W 0005 while still participating in the Cart-to-Labeler label-supply sequence.",
        next: "Preserve the pre-autochange warning/fault history and verify whether the physical label-supply condition actually recovered."
      });
      if (observation.handoff === "yes" && observation.labelerSummary === "yes") return Object.freeze({
        code: "downstream-summary",
        severity: "hold",
        title: "Labeler summary is downstream of an active composite Cart handoff",
        summary: "DataFromLS.Par1[0].1 is active and the Labeler summary followed, but the composite bit alone does not identify which Cart condition produced it.",
        next: "Read W 0005, Cart 00025, ForceAutochange, WarnLabLengthForceAutochg, and station Selected to identify the earliest source."
      });
      const values = Object.values(observation);
      if (!values.length || values.every((value) => !value || value === "unknown")) return Object.freeze({
        code: "capture-chronology",
        severity: "observe",
        title: "Capture the Cart-to-Labeler label-supply chronology",
        summary: "The downstream Label Magazine Empty text is not enough to identify a physical cause.",
        next: "Record W 0005, Cart 00025, autochange states, label-length autochange state, DataFromLS.Par1[0].1, and the Labeler summary before reset."
      });
      return Object.freeze({
        code: "not-yet-proven",
        severity: "hold",
        title: "The observed states do not yet prove the initiating condition",
        summary: "The v366 chronology has not identified which source-backed Cart state occurred first.",
        next: "Complete the remaining watchpoints before replacing label-supply hardware."
      });
    }

    function getAplCartFoundationPlan(value) {
      return labelSupplyPlan(value) || base.getAplCartFoundationPlan(value);
    }

    function evaluateAplCartFoundation(value, observation = {}) {
      return labelSupplyPlan(value) ? evaluateLabelSupply(value, observation) : base.evaluateAplCartFoundation(value, observation);
    }

    function validate() {
      const current = base.validate();
      const fault30 = base.getAplCartWebHandlingPlan?.(30);
      const fault30Boundary = JSON.stringify(fault30?.watchPoints || []);
      const errors = [...(current.errors || [])].filter((error) => {
        if (error !== "APL Cart Fault 00030 must stay separated from Station 00067.") return true;
        return !(/not Station 00067/i.test(fault30Boundary) && /not main Labeler Fault 670/i.test(fault30Boundary));
      });
      const low = labelSupplyPlan("W 0005");
      const hard = labelSupplyPlan("00025");
      const length = labelSupplyPlan("W 0012");
      if (!low || !/StartupComplete/.test(low.producer) || !/AutoChangeActive/.test(low.producer) || !/ForceAutochange/.test(low.producer) || !/SS631/.test(low.producer) || !/DataFromLS\.Par1\[0\]\.1/.test(low.producer)) errors.push("v366 W 0005 chronology lost its pre-fault or composite handoff evidence.");
      if (!hard || !/PE631|InputDetectEndOfReel/.test(JSON.stringify(hard.previousPlan || hard))) errors.push("v366 Cart 00025 must retain the existing end-of-reel source plan instead of replacing it.");
      if (!length || !/WarnLabLengthForceAutochg/.test(length.producer)) errors.push("v366 W 0012 chronology lost the label-length autochange handoff.");
      const first = labelSupplyPlan(655);
      const last = labelSupplyPlan(660);
      if (first?.chronology?.station !== 1 || !/DataFromLS\[1\]\.Par1\[0\]\.1/.test(first?.producer || "")) errors.push("v366 Labeler Fault 655 lost Station 1 handoff substitution.");
      if (last?.chronology?.station !== 6 || !/DataFromLS\[6\]\.Par1\[0\]\.1/.test(last?.producer || "")) errors.push("v366 Labeler Fault 660 lost Station 6 handoff substitution.");
      const composite = low?.watchPoints?.find((row) => row.tag === "DataFromLS.Par1[0].1");
      const relationship = composite?.relationship || "";
      for (const expected of ["W 0005", "Cart 00025", "ForceAutochange", "label-length autochange", "not-selected"]) if (!relationship.includes(expected)) errors.push(`v366 composite handoff lost ${expected} evidence.`);
      if (!first?.chronology?.oneSharedStationMethod || !last?.chronology?.oneSharedStationMethod) errors.push("v366 must keep one shared Station 1-6 label-supply method.");
      if (base.getAplCartWarningPlan("W 0005") == null || base.getAplCartWebHandlingPlan("00025") == null) errors.push("v366 must preserve the existing v365/v361 plans beneath chronology enrichment.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+apl-cart-label-supply-v366`,
      getAplCartLabelSupplyPlan: labelSupplyPlan,
      evaluateAplCartLabelSupply: evaluateLabelSupply,
      getAplCartFoundationPlan,
      evaluateAplCartFoundation,
      aplCartLabelSupplyLabelerFaults: LABELER_SUMMARIES,
      aplCartLabelSupplyChain: CHAIN,
      validate
    });
  };
});