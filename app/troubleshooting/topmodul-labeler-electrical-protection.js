"use strict";

(function installTopModulLabelerElectricalProtection(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLabelerElectricalProtectionExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Labeler diagnostic layers are required before electrical-protection tracing.");
    }

    const SOURCE = base.getTopModulCircuitSource("topmodul-k407039");
    if (!SOURCE) throw new Error("K407039 TopModul circuit source is required.");

    const PLC_SOURCE = Object.freeze({
      id: "topmodul-k407039-lb1-l5k",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1",
      evidenceClass: "readable-labeler-plc-export",
      sourceDiscipline: "Fault producers and source gaps are taken from the supplied readable LB1 L5K. A named HMI alarm is not assigned to a device unless a producer is present in this revision."
    });

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const circuit = (status, confidence, plcSignals, deviceRows, drawingLocations, summary, safetyBoundary, scopeNote) => Object.freeze({
      sourceId: SOURCE.id,
      source: SOURCE,
      status,
      confidence,
      plcSignals: Object.freeze(plcSignals),
      deviceRows: freezeRows(deviceRows),
      drawingLocations: freezeRows(drawingLocations),
      summary,
      safetyBoundary,
      scopeNote
    });
    const process = (status, confidence, routine, producerSignals, calculationSteps, summary, safetyBoundary, scopeNote) => Object.freeze({
      status,
      confidence,
      routine,
      producerSignals: Object.freeze(producerSignals),
      calculationSteps: freezeRows(calculationSteps),
      hardwareRows: Object.freeze([]),
      drawingLocations: Object.freeze([]),
      source: PLC_SOURCE,
      hardwareSource: null,
      summary,
      safetyBoundary,
      scopeNote
    });
    const evidence = (routine, logicType, rootLikelihood, roleLabel, producerSignals, logicSummary) => Object.freeze({
      routine,
      logicType,
      rootLikelihood,
      roleLabel,
      producerSignals: Object.freeze(producerSignals),
      logicSummary,
      evidenceStatus: "rung-condition-bound",
      firstFaultRank: rootLikelihood === "primary" ? 10 : 50
    });

    const electricalBoundary = "Do not repeatedly reset a breaker or overload that retrips. Follow site LOTO/stored-energy requirements before opening enclosures or inspecting protected loads/wiring. Energized electrical diagnostics are for qualified personnel under the approved electrical safe-work procedure.";

    const F682 = circuit(
      "machine-specific-four-control-voltage-breaker-chain-bound",
      "exact-labeler-plc-k407039-protection-match",
      [
        "E0301_CB202_Overload_B = I0009.20",
        "E0301_CB211_Overload_C = I0009.21",
        "E0301_CB212_Overload_D = I0009.22",
        "E0301_CB221_Overload_E = I0009.23",
        "E0301_M_AllFusesOK",
        "Faults_LB1[42].10"
      ],
      [
        { device: "CB202", description: "6 A breaker — control voltage B+", area: "=EMB1.0301 +SK", cable: ".0301-W202 / B+ control-voltage circuit", terminals: "auxiliary status contact -> I/O041 I0009.20" },
        { device: "CB211", description: "4 A breaker — control voltage C+", area: "=EMB1.0301 +SK", cable: "C+ control-voltage circuit", terminals: "auxiliary status contact -> I/O041 I0009.21" },
        { device: "CB212", description: "4 A breaker — control voltage D+", area: "=EMB1.0301 +SK", cable: "D+ control-voltage circuit", terminals: "auxiliary status contact -> I/O041 I0009.22" },
        { device: "CB221", description: "4 A breaker — control voltage E+", area: "=EMB1.0301 +SK", cable: ".0301-W202 / E+ control-voltage circuit", terminals: "auxiliary status contact -> I/O041 I0009.23" }
      ],
      [
        { pdfPage: 40, sheet: "40/277", section: "B+ control voltage / CB202 / I0009.20" },
        { pdfPage: 41, sheet: "41/277", section: "C+ and D+ control voltage / CB211-CB212 / I0009.21-.22" },
        { pdfPage: 42, sheet: "42/277", section: "E+ control voltage / CB221 / I0009.23" }
      ],
      "Fault 682 'Malfunction Overcurrent' is the combined 24 V control-voltage protection alarm for four monitored breakers. OvercurrentProtection clears E0301_M_AllFusesOK when any of CB202, CB211, CB212 or CB221 is not healthy; the false AllFusesOK state drives Fault 682 and removes Machine Jog/On. This is distinct from Fault 486 Motor Starter Overload, which is a multi-source motor/load summary. Identify which of the four breaker inputs dropped before tracing the protected branch.",
      electricalBoundary,
      "The alarm does not prove all four circuits are bad. Use I0009.20-.23 to isolate B+, C+, D+ or E+ first, then inspect that branch for the reason the protection opened."
    );

    const F134 = process(
      "external-discharge-conveyor-ready-interlock-bound",
      "exact-labeler-plc-interlock-path",
      "EtherNetFullBottleConv",
      [
        "Consumed_FullBottle85_B.Interlock_Data_Bit[31]",
        "XIO(Consumed_FullBottle85_B.Interlock_Data_Bit[31])",
        "Faults_LB1[8].6",
        "Interlocks_FullBottle85_B = 1756-ENBT/A / 10.99.218.28",
        "FullBottle85_B = 1756-L61 / Slot 0"
      ],
      [
        { label: "Ready source", value: "The Labeler consumes readiness from FullBottle85_B Level 2 interlock bit 31." },
        { label: "Polarity", value: "The producer uses XIO(bit 31): a false/not-ready external state latches Fault 134." },
        { label: "Machine response", value: "With container stop closed it requests minimum-speed/container-stop behavior; with container stop open it removes Machine On." }
      ],
      "Fault 134 'Discharge Conveyor Not Ready' is a real producer, but it is not a local motor-disconnect input. The Labeler receives the readiness state from the Full Bottle Conveyor controller over Level 2. ServoForge therefore stops at `Consumed_FullBottle85_B.Interlock_Data_Bit[31]`; the physical conveyor permissive that creates that bit belongs to the external FullBottle85_B PLC and is not in the supplied Labeler project.",
      electricalBoundary,
      "If the external bit is false, inspect the Full Bottle Conveyor controller/interlocks. If the external system reports ready but the consumed bit is wrong, inspect the Level 2 data path rather than replacing a local disconnect."
    );

    const SOURCE_GAPS = Object.freeze({
      130: "Fault 130 'Main Drive Motor Disconnect Off' is named in the alarm table, but Faults_LB1[8].2 has no producer occurrence anywhere in the supplied readable LB1 L5K. The verified main-drive overload/drive paths are separate alarms and are not substituted for this missing producer.",
      131: "Fault 131 'Oil Lube Motor Disconnect Off' is named in the alarm table, but Faults_LB1[8].3 has no producer occurrence anywhere in the supplied readable LB1 L5K. ServoForge does not invent an oil-lube disconnect input for this revision.",
      132: "Fault 132 'Height Adjust Motor Disconnect Off' is named in the alarm table, but Faults_LB1[8].4 has no producer occurrence anywhere in the supplied readable LB1 L5K. The actual height-adjust overload input E2101_MS101_HeightAdjOverload = I0009.28 drives the shared Fault 486 path instead; it is not relabeled as Fault 132.",
      133: "Fault 133 'Discharge Conveyor Motor Disconnect Off' is named in the alarm table, but Faults_LB1[8].5 has no producer occurrence anywhere in the supplied readable LB1 L5K. The verified discharge-conveyor overload and PF70 drive faults are separate evidence and are not substituted for this missing producer."
    });

    function isLabelerEntry(entry) {
      return Boolean(entry?.plcFault) && entry.diagnosticScope !== "Station";
    }

    function enrich(entry) {
      if (!isLabelerEntry(entry)) return entry;
      const n = Number(entry.number);
      if (n === 682) return Object.freeze({
        ...entry,
        circuitTrace: F682,
        labelerRungEvidence: evidence("OvercurrentProtection", "multi-breaker-control-voltage-protection", "primary", "Primary electrical-protection candidate", F682.plcSignals, F682.summary)
      });
      if (n === 134) return Object.freeze({
        ...entry,
        processTrace: F134,
        labelerRungEvidence: evidence("EtherNetFullBottleConv", "external-ready-interlock", "secondary", "External readiness/interlock alarm", F134.producerSignals, F134.summary)
      });
      const reason = SOURCE_GAPS[n];
      if (reason) return Object.freeze({
        ...entry,
        sourceGap: Object.freeze({ status: "named-alarm-no-producer-in-supplied-lb1", reason })
      });
      return entry;
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);
    const getTopModulFaultRelations = (value, limit = 10) => base.getTopModulFaultRelations(value, limit).map(enrich);
    const getTopModulFirstFaultCandidates = (value, limit = 8) => base.getTopModulFirstFaultCandidates(value, limit).map(enrich);

    function getTopModulCircuitTrace(value) {
      const entry = typeof value === "object" && value ? enrich(value) : getTopModulFault(value) || getEntry(value);
      return entry?.circuitTrace || base.getTopModulCircuitTrace?.(value) || null;
    }

    function getTopModulProcessTrace(value) {
      const entry = typeof value === "object" && value ? enrich(value) : getTopModulFault(value) || getEntry(value);
      return entry?.processTrace || base.getTopModulProcessTrace?.(value) || null;
    }

    function getTopModulFaultDrillDown(value, limit = 10) {
      const original = base.getTopModulFaultDrillDown(value, limit);
      if (!original) return null;
      const entry = enrich(original.entry);
      return Object.freeze({
        ...original,
        entry,
        related: (original.related || []).map(enrich),
        firstFaultCandidates: (original.firstFaultCandidates || []).map(enrich),
        circuitTrace: entry.circuitTrace || original.circuitTrace || null,
        processTrace: entry.processTrace || original.processTrace || null,
        sourceGap: entry.sourceGap || original.sourceGap || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const f682 = getTopModulFault(682);
      if (!f682?.circuitTrace?.plcSignals?.includes("E0301_CB202_Overload_B = I0009.20")) errors.push("Fault 682 lost CB202/I0009.20 evidence.");
      if (!f682?.circuitTrace?.plcSignals?.includes("E0301_CB221_Overload_E = I0009.23")) errors.push("Fault 682 lost CB221/I0009.23 evidence.");
      if (f682?.circuitTrace?.deviceRows?.length !== 4) errors.push("Fault 682 must retain four monitored control-voltage breakers.");
      if (!/distinct from Fault 486/i.test(f682?.circuitTrace?.summary || "")) errors.push("Fault 682 must remain distinct from motor-starter overload Fault 486.");
      const f134 = getTopModulFault(134);
      if (!f134?.processTrace?.producerSignals?.includes("Consumed_FullBottle85_B.Interlock_Data_Bit[31]")) errors.push("Fault 134 lost FullBottle ready-bit evidence.");
      if (!/not a local motor-disconnect input/i.test(f134?.processTrace?.summary || "")) errors.push("Fault 134 must remain an external readiness interlock.");
      for (const number of [130, 131, 132, 133]) {
        const entry = getTopModulFault(number);
        if (!entry?.sourceGap || entry.circuitTrace || entry.processTrace) errors.push(`Fault ${number} must remain named but unpromoted in this LB1 revision.`);
      }
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+labeler-electrical-protection-v1`,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      getTopModulProcessTrace,
      topModulLabelerElectricalProtectionFaults: Object.freeze([134, 682]),
      topModulLabelerElectricalProtectionSourceGaps: Object.freeze([130, 131, 132, 133]),
      validate
    });
  };
});
