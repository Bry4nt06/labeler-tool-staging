"use strict";

(function installTopModulLabelerSafetyCircuit(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLabelerSafetyCircuitExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Labeler diagnostic layers are required before safety tracing.");
    }

    const SOURCE = base.getTopModulCircuitSource("topmodul-k407039");
    if (!SOURCE) throw new Error("K407039 TopModul circuit source is required.");

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

    const safetyBoundary = "Safety circuit: never jumper, bypass, force or defeat an E-stop, guard switch, safety relay, contactor feedback or PLC safety-status input. Use approved safety verification/LOTO procedures. Energized safety-circuit measurements are for qualified personnel under site rules.";

    const estopDevice = (faultNumber, tag, input, device, description, pdfPage, section) => circuit(
      "machine-specific-direct-estop-device-bound",
      "exact-labeler-plc-k407039-input-match",
      [tag, input, "PowerOnReset", `Fault ${String(faultNumber).padStart(3, "0")}`],
      [{ device, description, area: "TopModul safety chain", cable: "K407039 .1101 E-stop circuit", terminals: `${tag} aliases ${input}` }],
      [{ pdfPage, section }],
      `Fault ${String(faultNumber).padStart(3, "0")} is the direct operator/device E-stop indication for ${device}. In the Labeler PLC, the alarm is true when ${tag} is false after PowerOnReset. This is more specific than the aggregate Fault 680 safety-circuit mismatch and should be checked first when both are present.`,
      safetyBoundary,
      "One Labeler E-stop diagnostic family is reused across device instances. The exact fault number supplies the physical E-stop input; it does not create a separate troubleshooting platform."
    );

    const guardDevice = (faultNumber, tag, input, device, description, cable, pdfPage, section) => circuit(
      "machine-specific-direct-guard-device-bound",
      "exact-labeler-plc-k407039-input-match",
      [tag, input, `Fault ${String(faultNumber).padStart(3, "0")}`],
      [{ device, description, area: "TopModul guarding", cable, terminals: `${tag} aliases ${input}` }],
      [{ pdfPage, section }],
      `Fault ${String(faultNumber).padStart(3, "0")} is the retained open-guard indication for ${device}. The Guarding routine latches the corresponding GuardOpen bit when the PLC sees the physical guard input in the open state and keeps the alarm active until the guard/reset sequence is satisfied. This is a direct device/state alarm, distinct from Fault 681 safety-circuit feedback mismatch.`,
      safetyBoundary,
      "One Labeler guard diagnostic family is reused across door/labeling-station guard instances. The fault instance supplies the actual switch or relay input."
    );

    const TRACES = Object.freeze({
      1: estopDevice(1, "E1101_PB152_EStopInfeedPendant", "I0009.01", "PB152", "E-stop — infeed pendant", 81, "E-stop pendant circuit PB152 / I0009.01"),
      2: estopDevice(2, "E1101_PB153_EStopDischargePendant", "I0009.02", "PB153", "E-stop — discharge pendant", 81, "E-stop pendant circuit PB153 / I0009.02"),
      5: estopDevice(5, "E1101_PB151_EStopOCP", "I0009.00", "PB151", "E-stop — operator control panel", 81, "E-stop OCP circuit PB151 / I0009.00"),
      6: estopDevice(6, "E1101_PB154_EStopDischargeOCP", "I0009.03", "PB154", "E-stop — discharge operator control panel", 81, "E-stop discharge OCP circuit PB154 / I0009.03"),
      7: estopDevice(7, "E1101_FM1_EStopEM", "I0009.04", "FM1", "E-stop input from external/foreign machine", 83, "External-machine E-stop interface / I0009.04"),
      8: estopDevice(8, "E1101_Agg1_EStop", "I0009.09", "Labeling Station 1 E-stop input", "E-stop feedback from labeling station 1", 78, "Labeling-station E-stop inputs / I0009.09"),
      9: estopDevice(9, "E1101_Agg2_EStop", "I0009.10", "Labeling Station 2 E-stop input", "E-stop feedback from labeling station 2", 78, "Labeling-station E-stop inputs / I0009.10"),
      10: estopDevice(10, "E1101_Agg3_EStop", "I0009.11", "Labeling Station 3 E-stop input", "E-stop feedback from labeling station 3", 79, "Labeling-station E-stop inputs / I0009.11"),
      11: estopDevice(11, "E1101_Agg4_EStop", "I0009.12", "Labeling Station 4 E-stop input", "E-stop feedback from labeling station 4", 79, "Labeling-station E-stop inputs / I0009.12"),
      12: estopDevice(12, "E1101_Agg5_EStop", "I0009.13", "Labeling Station 5 E-stop input", "E-stop feedback from labeling station 5", 80, "Labeling-station E-stop inputs / I0009.13"),
      13: estopDevice(13, "E1101_Agg6_EStop", "I0009.14", "Labeling Station 6 E-stop input", "E-stop feedback from labeling station 6", 80, "Labeling-station E-stop inputs / I0009.14"),

      33: guardDevice(33, "E1201_LS101_Door1_Table", "I0008.00", "LS101", "Guard door 1 — front table", ".1201-W101", 91, "Guard door 1 LS101 / I0008.00"),
      34: guardDevice(34, "E1201_LS102_Door2_Table", "I0008.01", "LS102", "Guard door 2 — front table", ".1201-W102", 91, "Guard door 2 LS102 / I0008.01"),
      35: guardDevice(35, "E1201_LS103_Door3_Table", "I0008.02", "LS103", "Guard door 3 — front table", ".1201-W103", 91, "Guard door 3 LS103 / I0008.02"),
      36: guardDevice(36, "E1201_LS104_Door4_Table", "I0008.03", "LS104", "Guard door 4 — front table", ".1201-W104", 91, "Guard door 4 LS104 / I0008.03"),
      37: guardDevice(37, "E1201_LS141_Door5_Carrousel", "I0008.06", "LS141", "Guard door 5 — carousel", ".1201-W141", 93, "Carousel guard door 5 LS141 / I0008.06"),
      38: guardDevice(38, "E1201_LS142_Door6_Carrousel", "I0008.07", "LS142", "Guard door 6 — carousel", ".1201-W142", 93, "Carousel guard door 6 LS142 / I0008.07"),
      39: guardDevice(39, "E1201_LS111_Door7_Table", "I0008.04", "LS111", "Guard door 7 — front table", ".1201-W111", 92, "Guard door 7 LS111 / I0008.04"),
      48: guardDevice(48, "E1201_CR162_Agg1Guarding", "I0008.08", "CR162", "Labeling Station 1 guarding relay/input", "CN201 / TB52 guarding circuit", 94, "Station 1 guard relay CR162 / I0008.08"),
      49: guardDevice(49, "E1201_CR172_Agg2Guarding", "I0008.09", "CR172", "Labeling Station 2 guarding relay/input", "CN202 / TB52 guarding circuit", 95, "Station 2 guard relay CR172 / I0008.09"),
      50: guardDevice(50, "E1201_CR182_Agg3Guarding", "I0008.10", "CR182", "Labeling Station 3 guarding relay/input", "CN211 / TB52 guarding circuit", 96, "Station 3 guard relay CR182 / I0008.10"),
      51: guardDevice(51, "E1201_CR192_Agg4Guarding", "I0008.11", "CR192", "Labeling Station 4 guarding relay/input", "CN212 / TB52 guarding circuit", 97, "Station 4 guard relay CR192 / I0008.11"),
      52: guardDevice(52, "E1201_CR202_Agg5Guarding", "I0008.12", "CR202", "Labeling Station 5 guarding relay/input", "CN221 / TB52 guarding circuit", 98, "Station 5 guard relay CR202 / I0008.12"),
      53: guardDevice(53, "E1201_CR212_Agg6Guarding", "I0008.13", "CR212", "Labeling Station 6 guarding relay/input", "CN222 / TB52 guarding circuit", 99, "Station 6 guard relay CR212 / I0008.13"),

      680: circuit(
        "machine-specific-estop-safety-circuit-monitor-bound",
        "exact-labeler-plc-k407039-safety-match",
        [
          "E1101.M_EStopChaine",
          "E1101.M_EStopChaineForMach",
          "E1101_C201_EStopToEM",
          "E1101_C201_EStopToEM_FB",
          "E1101_CR211_EStopChainFB",
          "E1101_C223_EStopToLabelingStations",
          "E1101_C223_EStopToLabelingStationsFB",
          "E1101.T_EStopDelay",
          "E1101.T_EStopSafetyCircuit",
          "E1101.M_EStopFaultSafetyCircuit",
          "Faults_LB1[42].8"
        ],
        [
          { device: "C201", description: "E-stop output/feedback to external machine", area: "+SK", cable: ".1101 safety circuit", terminals: "O0101.04 command / I0009.06 feedback" },
          { device: "CR211", description: "Main E-stop chain feedback relay", area: "+SK", cable: ".1101 safety circuit", terminals: "I0009.07 E-stop chain feedback" },
          { device: "C223", description: "E-stop output/feedback to labeling stations", area: "+SK", cable: ".1101 safety circuit", terminals: "O0101.06 command / I0009.08 feedback" }
        ],
        [
          { pdfPage: 83, section: "External-machine E-stop C201 and main-chain CR211 feedback" },
          { pdfPage: 85, section: "E-stop to labeling stations C223 command/feedback" }
        ],
        "Fault 680 is not the same as one pressed E-stop. The EmergencyStop routine compares the software E-stop chain states with the hardware feedback from C201, CR211 and C223. After PowerOnReset and outside labeling-station change mode, a mismatch is supervised through a 2000 ms EStopSafetyCircuit timer; the main-machine chain also uses a 3500 ms feedback delay. If a specific Fault 001/002/005-013 is active, start with that device. If no specific E-stop is active, Fault 680 points toward command/feedback disagreement, delayed relay feedback, connector/wiring or a broken safety-chain condition.",
        safetyBoundary,
        "This is a safety-circuit consistency fault. ServoForge deliberately separates it from the individual E-stop device alarms."
      ),
      681: circuit(
        "machine-specific-guard-safety-circuit-monitor-bound",
        "exact-labeler-plc-k407039-safety-match",
        [
          "E1201.M_GuardChain",
          "E1201_CR231_GuardChainFB",
          "E1201_C223_GuardsToLabelingStations",
          "E1201_C223_GuardsToLabelingStationsFB",
          "E1201.T_GuardRelayDelay",
          "E1201.T_GuardSafetyCircuit",
          "E1201.M_GuardFaultSafetyCircuit",
          "Faults_LB1[42].9"
        ],
        [
          { device: "CR231", description: "Main guard-chain feedback relay", area: "+SK", cable: ".1201 guard safety circuit", terminals: "guard-chain hardware feedback" },
          { device: "C223 guard path", description: "Guard release command/feedback to labeling stations", area: "+SK", cable: ".1201 guard safety circuit", terminals: "command vs feedback monitored in Guarding routine" }
        ],
        [
          { pdfPage: 90, section: "TopModul guard switch chain overview" },
          { pdfPage: 94, section: "Start of labeling-station guard relay chain" },
          { pdfPage: 99, section: "Labeling-station guard relay chain continuation" }
        ],
        "Fault 681 is the guard safety-circuit consistency alarm, not merely an open door. The Guarding routine compares the logical guard chain, main guard-chain feedback, jogging/inching contactor feedback and the guard output/feedback to the labeling stations. A 3500 ms relay-delay timer is used when the guard chain changes, followed by a 2000 ms GuardSafetyCircuit mismatch timer. Specific Faults 033-039 or 048-053 identify the physical open guard/relay instance and should be checked before treating 681 as a generic relay problem.",
        safetyBoundary,
        "This fault can coexist with a specific open-guard alarm. The specific device fault identifies the open input; 681 means the commanded/logical state does not agree with the monitored safety feedback."
      )
    });

    const INACTIVE_NAMED = Object.freeze({
      14: "Fault 014 E-Stop Laser Coder is named in the alarm table, but the only producer rung in this supplied Labeler revision contains XIC(Laser_01.O_LaserEStop) and XIO(Laser_01.O_LaserEStop) in series, so that rung cannot energize the fault bit. ServoForge retains the named alarm without promoting a physical cause from this revision."
    });

    function isLabelerEntry(entry) {
      return Boolean(entry?.plcFault) && entry.diagnosticScope !== "Station" && !entry.plcFault?.station;
    }

    function traceForEntry(entry) {
      if (!isLabelerEntry(entry)) return null;
      return TRACES[Number(entry.number)] || null;
    }

    function sourceGapForEntry(entry) {
      if (!isLabelerEntry(entry)) return null;
      const reason = INACTIVE_NAMED[Number(entry.number)];
      return reason ? Object.freeze({ status: "named-but-producer-inactive-in-this-revision", reason }) : null;
    }

    function enrich(entry) {
      if (!entry?.plcFault) return entry;
      const trace = traceForEntry(entry);
      const sourceGap = sourceGapForEntry(entry);
      if (trace || sourceGap) return Object.freeze({ ...entry, ...(trace ? { circuitTrace: trace } : {}), ...(sourceGap ? { sourceGap } : {}) });
      return entry;
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);
    const getTopModulFaultRelations = (value, limit = 10) => base.getTopModulFaultRelations(value, limit).map(enrich);
    const getTopModulFirstFaultCandidates = (value, limit = 8) => base.getTopModulFirstFaultCandidates(value, limit).map(enrich);

    function getTopModulCircuitTrace(value) {
      const entry = typeof value === "object" && value ? enrich(value) : getTopModulFault(value) || getEntry(value);
      return entry?.circuitTrace || base.getTopModulCircuitTrace(value);
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
        sourceGap: entry.sourceGap || original.sourceGap || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      for (const fault of [1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 33, 34, 35, 36, 37, 38, 39, 48, 49, 50, 51, 52, 53, 680, 681]) {
        const trace = getTopModulFault(fault)?.circuitTrace;
        if (!trace) errors.push(`Labeler safety Fault ${fault} lost its circuit trace.`);
        if (trace?.source?.drawing !== "K407039-001") errors.push(`Labeler safety Fault ${fault} lost K407039 provenance.`);
      }
      if (!getTopModulFault(680)?.circuitTrace?.plcSignals?.includes("E1101.M_EStopFaultSafetyCircuit")) errors.push("Fault 680 lost E-stop safety mismatch evidence.");
      if (!getTopModulFault(681)?.circuitTrace?.plcSignals?.includes("E1201.M_GuardFaultSafetyCircuit")) errors.push("Fault 681 lost guard safety mismatch evidence.");
      if (!getTopModulFault(33)?.circuitTrace?.deviceRows?.some((row) => row.device === "LS101")) errors.push("Fault 033 lost LS101 evidence.");
      if (!getTopModulFault(53)?.circuitTrace?.deviceRows?.some((row) => row.device === "CR212")) errors.push("Fault 053 lost CR212 evidence.");
      const laser = getTopModulFault(14);
      if (!laser?.sourceGap || laser.circuitTrace) errors.push("Fault 014 must remain named but unpromoted for this Labeler revision.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+labeler-safety-circuit-v1`,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      topModulLabelerSafetyFaults: Object.freeze(Object.keys(TRACES).map(Number)),
      validate
    });
  };
});
