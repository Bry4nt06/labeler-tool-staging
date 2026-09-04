"use strict";

(function installTopModulLabelerLubricationTrace(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLabelerLubricationTraceExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Labeler diagnostic layers are required before lubrication tracing.");
    }

    const SOURCE = base.getTopModulCircuitSource("topmodul-k407039");
    if (!SOURCE) throw new Error("K407039 TopModul circuit source is required.");

    const PLC_SOURCE = Object.freeze({
      id: "topmodul-k407039-lb1-lube-l5k",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1",
      routine: "AutoLubeControl",
      evidenceClass: "readable-labeler-plc-export",
      sourceDiscipline: "Central-lubrication timing, retry counters, alarm producers and PLC aliases are taken from the supplied readable LB1 L5K. Electrical device identities are promoted only where K407039 sheet 167/277 matches those PLC aliases."
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
    const process = (status, confidence, producerSignals, calculationSteps, hardwareRows, summary, safetyBoundary, scopeNote) => Object.freeze({
      status,
      confidence,
      routine: "AutoLubeControl",
      producerSignals: Object.freeze(producerSignals),
      calculationSteps: freezeRows(calculationSteps),
      hardwareRows: freezeRows(hardwareRows),
      drawingLocations: freezeRows([{ pdfPage: 167, sheet: "167/277", section: "Central lubrication P101 / FS102 / PS103 / C104 / MTR104" }]),
      source: PLC_SOURCE,
      hardwareSource: SOURCE,
      summary,
      safetyBoundary,
      scopeNote
    });
    const evidence = (logicType, rootLikelihood, roleLabel, producerSignals, logicSummary, firstFaultRank = 20) => Object.freeze({
      routine: "AutoLubeControl / Machine_Jumps",
      logicType,
      rootLikelihood,
      roleLabel,
      producerSignals: Object.freeze(producerSignals),
      logicSummary,
      evidenceStatus: "rung-condition-bound",
      firstFaultRank
    });

    const lubeBoundary = "Central lubrication can involve automatic motor motion and pressurized grease. Follow site LOTO/stored-energy requirements before hands-on pump, motor, pressure switch, cycle-end sensor, reservoir or wiring work. Relieve stored pressure using the approved procedure. Energized electrical diagnostics are for qualified personnel only.";

    const COMMON_CIRCUIT = circuit(
      "machine-specific-central-lubrication-hardware-bound",
      "exact-labeler-plc-k407039-lubrication-match",
      [
        "E2801_P101_CentralLubeEnd = I0010.21",
        "E2801_FS102_CentralLubeLack = I0010.22",
        "E2801_PS103_CentralLubeOverPressure = I0010.23",
        "E2801_C104_CentralLubeMotor = O0103.5"
      ],
      [
        { device: "P101", description: "Central-lubrication cycle-end sensor", area: "=EMB1.2801 +ET", cable: ".2801-W101", terminals: "TB52 -> I/O042 I0010.21; E+/E- sensor supply shown on K407039" },
        { device: "FS102", description: "Central-lubrication low-grease / lack-of-grease switch", area: "=EMB1.2801 +ET", cable: ".2801-W102 via CN102", terminals: "TB52 -> I/O042 I0010.22" },
        { device: "PS103", description: "Central-lubrication excess-pressure switch", area: "=EMB1.2801 +ET", cable: ".2801-W103 via CN103", terminals: "TB52 -> I/O042 I0010.23" },
        { device: "C104 / MTR104", description: "Central-lubrication motor contactor/output and motor", area: "=EMB1.2801 +SK / +ET", cable: ".2801-W104 via CN104", terminals: "I/O101 O0103.05 -> C104 -> MTR104" }
      ],
      [{ pdfPage: 167, sheet: "167/277", section: "Central lubrication system end, grease-low, excess-pressure and motor circuit" }],
      "K407039 sheet 167/277 binds the Labeler PLC aliases to the central-lubrication hardware: P101 cycle end at I0010.21, FS102 low grease at I0010.22, PS103 excess pressure at I0010.23 and C104/MTR104 commanded from O0103.05. The PLC AutoLubeControl routine uses those signals to distinguish pressure, duration and low-grease faults rather than treating all lubrication alarms as the same pump failure.",
      lubeBoundary,
      "Use the specific fault's process logic to decide which device/state matters first; the common hardware trace is shared across the lubrication family."
    );

    const PROCESS = Object.freeze({
      675: process(
        "central-lube-overpressure-latch-bound",
        "exact-labeler-plc-producer-and-device",
        [
          "E2801_PS103_CentralLubeOverPressure = I0010.23",
          "Lube.I_ExcessPressure",
          "XIO(Lube.I_ExcessPressure)",
          "Lube.O_PressureError",
          "Faults_LB1[42].3"
        ],
        [
          { label: "Input polarity", value: "AutoLubeControl documents I_ExcessPressure as 0 = fault / 1 = OK; PS103 feeds that state from I0010.23." },
          { label: "Fault latch", value: "A false I_ExcessPressure state drives O_PressureError and the overpressure retry counter until reset/recovery logic clears the condition." },
          { label: "Machine response", value: "O_PressureError drives Fault 675 and requests minimum-speed/container-stop behavior." }
        ],
        [
          { device: "PS103", description: "Excess-pressure switch", area: "=EMB1.2801 +ET", cable: ".2801-W103 / CN103", terminals: "I/O042 I0010.23" },
          { device: "C104 / MTR104", description: "Lubrication pump/motor command path to compare with pressure response", area: "=EMB1.2801", cable: ".2801-W104 / CN104", terminals: "O0103.05" }
        ],
        "Fault 675 is the first-level central-lubrication excess-pressure alarm. The PLC is explicitly looking for PS103/I0010.23 to indicate the healthy state; when that state drops, AutoLubeControl latches O_PressureError and Machine_Jumps presents Fault 675. Start by comparing commanded lubrication operation with the actual PS103 state and the mechanical pressure condition before assuming a PLC or HMI issue.",
        lubeBoundary,
        "Fault 690 is the excessive-retry escalation of this same pressure family; troubleshoot Fault 675 / PS103 / actual lubrication pressure before treating 690 as a separate component failure."
      ),
      676: process(
        "central-lube-cycle-duration-supervision-bound",
        "exact-labeler-plc-counter-and-cycle-end-input",
        [
          "Lube.TimeExc.PRE = 600",
          "Pulse._1Hz",
          "Lube.I_ControllerEnable",
          "Lube.On",
          "E2801_P101_CentralLubeEnd = I0010.21",
          "Lube.OnsEnd",
          "Lube.O_DurationError",
          "Faults_LB1[42].4"
        ],
        [
          { label: "Duration preset", value: "AutoLubeControl sets Lube.TimeExc.PRE = 600." },
          { label: "Time base", value: "The counter advances from Pulse._1Hz while controller enable is present; when lubrication is off the counter is reset." },
          { label: "Expected completion", value: "P101/I0010.21 creates Lube.OnsEnd when the lubrication cycle reaches its end condition." },
          { label: "Fault threshold", value: "If TimeExc reaches done before a successful cycle completion/reset, O_DurationError is latched and Fault 676 is asserted." },
          { label: "Nominal supervision window", value: "600 one-second pulses = approximately 600 seconds / 10 minutes in this PLC implementation." }
        ],
        [
          { device: "P101", description: "Cycle-end sensor whose transition terminates/acknowledges a lubrication cycle", area: "=EMB1.2801 +ET", cable: ".2801-W101", terminals: "I/O042 I0010.21" },
          { device: "C104 / MTR104", description: "Lubrication motor path that must actually run for the cycle to progress", area: "=EMB1.2801", cable: ".2801-W104 / CN104", terminals: "O0103.05" }
        ],
        "Fault 676 is a cycle-duration supervision alarm, not an overpressure alarm. AutoLubeControl expects the lubrication cycle to complete through P101 before the 600-count 1 Hz duration supervision reaches done. A stalled pump/motor, blocked lubrication path, failed/misadjusted P101 cycle-end signal or other condition that prevents cycle completion can all produce the same duration result.",
        lubeBoundary,
        "Fault 689 is the excessive-retry escalation of this duration family. Confirm the first-level Fault 676 cycle-end problem and P101 behavior before diagnosing 689 separately."
      ),
      677: process(
        "central-lube-low-grease-latch-bound",
        "exact-labeler-plc-producer-and-device",
        [
          "E2801_FS102_CentralLubeLack = I0010.22",
          "Lube.I_LackOfGrease",
          "Lube.OnsLack",
          "Lube.O_LowGreaseError",
          "Faults_LB1[42].5"
        ],
        [
          { label: "Field input", value: "FS102 feeds I0010.22 and is copied directly into Lube.I_LackOfGrease." },
          { label: "One-shot/latch", value: "A true lack-of-grease input creates OnsLack; O_LowGreaseError remains latched until the reset logic clears it." },
          { label: "Alarm output", value: "O_LowGreaseError directly drives Fault 677." }
        ],
        [
          { device: "FS102", description: "Low-grease / reservoir level switch", area: "=EMB1.2801 +ET", cable: ".2801-W102 / CN102", terminals: "I/O042 I0010.22" }
        ],
        "Fault 677 is the low-grease state from FS102/I0010.22. Unlike Faults 675/676, it is not a timing or pressure calculation. Confirm actual lubricant level/condition and the FS102 state/wiring before investigating unrelated pump or pressure logic.",
        lubeBoundary,
        "Do not defeat the low-grease signal to keep the machine running; loss of lubrication can damage machine components."
      ),
      689: process(
        "central-lube-duration-excessive-retries-bound",
        "exact-labeler-plc-retry-counter",
        [
          "Lube.DurationErrors.PRE = 4",
          "Lube.O_DurationError",
          "Lube.DurationErrors.DN",
          "E2801_P101_CentralLubeEnd = I0010.21",
          "Lube.OnsEnd",
          "Lube.O_DurationErrorEx",
          "Faults_LB1[43].1"
        ],
        [
          { label: "Retry preset", value: "AutoLubeControl sets DurationErrors.PRE = 4." },
          { label: "Underlying fault", value: "Duration-error occurrences increment the duration retry counter." },
          { label: "Successful cycle evidence", value: "The P101-derived cycle-end one-shot resets DurationErrors." },
          { label: "Escalation", value: "When DurationErrors.DN is reached, O_DurationErrorEx drives Fault 689 and Machine_Jumps removes Machine On enable." }
        ],
        [
          { device: "P101", description: "Cycle-end sensor used to prove successful lubrication completion", area: "=EMB1.2801 +ET", cable: ".2801-W101", terminals: "I/O042 I0010.21" },
          { device: "C104 / MTR104", description: "Lubrication motor/pump path", area: "=EMB1.2801", cable: ".2801-W104 / CN104", terminals: "O0103.05" }
        ],
        "Fault 689 is not a new lubrication failure mode; it is the escalation of repeated Fault 676-style duration failures. The PLC uses a four-count DurationErrors counter and clears that retry history when a P101 cycle-end event proves a completed lubrication cycle. Diagnose why the cycle is failing to complete rather than treating the retry alarm as a separate sensor.",
        lubeBoundary,
        "Fault 676 is the stronger first-fault candidate. Use alarm history to determine whether 676 preceded 689."
      ),
      690: process(
        "central-lube-overpressure-excessive-retries-bound",
        "exact-labeler-plc-retry-counter",
        [
          "Lube.OverpressureErrors.PRE = 4",
          "E2801_PS103_CentralLubeOverPressure = I0010.23",
          "Lube.O_PressureError",
          "Lube.OverpressureErrors.DN",
          "Lube.O_PressureErrorEx",
          "Faults_LB1[43].2"
        ],
        [
          { label: "Retry preset", value: "AutoLubeControl sets OverpressureErrors.PRE = 4." },
          { label: "Underlying fault", value: "The same PS103/I_ExcessPressure path that creates Fault 675 feeds the overpressure retry counter." },
          { label: "Healthy-state reset", value: "When I_ExcessPressure returns healthy, the PLC resets OverpressureErrors." },
          { label: "Escalation", value: "When OverpressureErrors.DN is reached, O_PressureErrorEx drives Fault 690 and Machine_Jumps removes Machine On enable." }
        ],
        [
          { device: "PS103", description: "Excess-pressure switch feeding the underlying overpressure condition", area: "=EMB1.2801 +ET", cable: ".2801-W103 / CN103", terminals: "I/O042 I0010.23" },
          { device: "C104 / MTR104", description: "Lubrication motor/pump path to compare against actual pressure response", area: "=EMB1.2801", cable: ".2801-W104 / CN104", terminals: "O0103.05" }
        ],
        "Fault 690 is the excessive-retry escalation of the Fault 675 overpressure family. It proves the PLC's four-count overpressure retry state reached done; it does not identify a new physical device. Start with PS103, actual lubrication pressure and the pump/distribution path that produced the first-level pressure errors.",
        lubeBoundary,
        "Fault 675 is the stronger first-fault candidate. Use actual pressure and alarm history to determine why the overpressure condition recurs."
      )
    });

    const EVIDENCE = Object.freeze({
      675: evidence("pressure-input-latch", "primary", "Primary lubrication pressure fault", PROCESS[675].producerSignals, PROCESS[675].summary, 10),
      676: evidence("cycle-duration-supervision", "supervision", "Lubrication cycle-duration supervision", PROCESS[676].producerSignals, PROCESS[676].summary, 18),
      677: evidence("low-grease-input-latch", "primary", "Primary lubricant-level fault", PROCESS[677].producerSignals, PROCESS[677].summary, 10),
      689: evidence("duration-retry-escalation", "secondary", "Escalation after repeated duration faults", PROCESS[689].producerSignals, PROCESS[689].summary, 80),
      690: evidence("pressure-retry-escalation", "secondary", "Escalation after repeated pressure faults", PROCESS[690].producerSignals, PROCESS[690].summary, 80)
    });

    function isLabelerEntry(entry) {
      return Boolean(entry?.plcFault) && entry.diagnosticScope !== "Station";
    }

    function enrich(entry) {
      if (!isLabelerEntry(entry)) return entry;
      const n = Number(entry.number);
      const trace = PROCESS[n];
      if (!trace) return entry;
      return Object.freeze({
        ...entry,
        processTrace: trace,
        circuitTrace: COMMON_CIRCUIT,
        labelerRungEvidence: EVIDENCE[n]
      });
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);

    function dedupe(entries, limit) {
      const out = [];
      const seen = new Set();
      for (const entry of entries) {
        if (!entry?.id || seen.has(entry.id)) continue;
        seen.add(entry.id);
        out.push(entry);
        if (out.length >= limit) break;
      }
      return out;
    }

    function counterpartRelations(source) {
      const n = Number(source?.number);
      if (n === 675) {
        const escalation = getTopModulFault(690);
        return escalation ? [{ ...escalation, relationScore: 120, relationReason: "Four-count excessive-retry escalation of the same PS103 overpressure family", causalRole: "downstream-summary", causalRoleLabel: "Escalation" }] : [];
      }
      if (n === 676) {
        const escalation = getTopModulFault(689);
        return escalation ? [{ ...escalation, relationScore: 120, relationReason: "Four-count excessive-retry escalation of the same cycle-duration family", causalRole: "downstream-summary", causalRoleLabel: "Escalation" }] : [];
      }
      if (n === 689) {
        const first = getTopModulFault(676);
        return first ? [{ ...first, relationScore: 160, relationReason: "Underlying first-level duration fault that increments the retry counter", causalRole: "upstream-prerequisite", causalRoleLabel: "Start here" }] : [];
      }
      if (n === 690) {
        const first = getTopModulFault(675);
        return first ? [{ ...first, relationScore: 160, relationReason: "Underlying first-level overpressure fault that increments the retry counter", causalRole: "upstream-prerequisite", causalRoleLabel: "Start here" }] : [];
      }
      return [];
    }

    function getTopModulFaultRelations(value, limit = 10) {
      const source = typeof value === "object" && value ? enrich(value) : getTopModulFault(value);
      const raw = base.getTopModulFaultRelations(value, Math.max(20, Number(limit) || 10)).map(enrich);
      return dedupe([...counterpartRelations(source), ...raw], Math.max(1, Number(limit) || 10));
    }

    function getTopModulFirstFaultCandidates(value, limit = 8) {
      const source = typeof value === "object" && value ? enrich(value) : getTopModulFault(value);
      const n = Number(source?.number);
      const explicit = n === 689 ? [getTopModulFault(676)] : n === 690 ? [getTopModulFault(675)] : [];
      const raw = base.getTopModulFirstFaultCandidates(value, Math.max(16, Number(limit) || 8)).map(enrich);
      return dedupe([...explicit.filter(Boolean), ...raw], Math.max(1, Number(limit) || 8));
    }

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
        related: getTopModulFaultRelations(entry, limit),
        firstFaultCandidates: getTopModulFirstFaultCandidates(entry, Math.min(8, Math.max(4, Number(limit) || 8))),
        circuitTrace: entry.circuitTrace || original.circuitTrace || null,
        processTrace: entry.processTrace || original.processTrace || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const f675 = getTopModulFault(675);
      if (!f675?.processTrace?.producerSignals?.includes("E2801_PS103_CentralLubeOverPressure = I0010.23")) errors.push("Fault 675 lost PS103/I0010.23 evidence.");
      if (!f675?.circuitTrace?.deviceRows?.some((row) => row.device === "PS103")) errors.push("Fault 675 lost PS103 circuit evidence.");
      const f676 = getTopModulFault(676);
      if (!f676?.processTrace?.producerSignals?.includes("Lube.TimeExc.PRE = 600")) errors.push("Fault 676 lost the 600-count duration preset.");
      if (!f676?.processTrace?.producerSignals?.includes("E2801_P101_CentralLubeEnd = I0010.21")) errors.push("Fault 676 lost P101 cycle-end evidence.");
      const f677 = getTopModulFault(677);
      if (!f677?.processTrace?.producerSignals?.includes("E2801_FS102_CentralLubeLack = I0010.22")) errors.push("Fault 677 lost FS102/I0010.22 evidence.");
      const f689 = getTopModulFault(689);
      if (!f689?.processTrace?.producerSignals?.includes("Lube.DurationErrors.PRE = 4")) errors.push("Fault 689 lost the four-count duration retry evidence.");
      const f690 = getTopModulFault(690);
      if (!f690?.processTrace?.producerSignals?.includes("Lube.OverpressureErrors.PRE = 4")) errors.push("Fault 690 lost the four-count pressure retry evidence.");
      if (getTopModulFirstFaultCandidates(689, 4)?.[0]?.number !== 676) errors.push("Fault 689 must start with underlying Fault 676.");
      if (getTopModulFirstFaultCandidates(690, 4)?.[0]?.number !== 675) errors.push("Fault 690 must start with underlying Fault 675.");
      if (!f675?.circuitTrace?.deviceRows?.some((row) => /MTR104/.test(row.device))) errors.push("Lubrication circuit lost C104/MTR104 pump/motor evidence.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+labeler-lubrication-v1`,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      getTopModulProcessTrace,
      topModulLabelerLubricationFaults: Object.freeze([675, 676, 677, 689, 690]),
      validate
    });
  };
});
