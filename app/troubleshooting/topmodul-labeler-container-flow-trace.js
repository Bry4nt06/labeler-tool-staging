"use strict";

(function installTopModulLabelerContainerFlow(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLabelerContainerFlowExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Labeler diagnostic layers are required before container-flow tracing.");
    }

    const HARDWARE_SOURCE = base.getTopModulCircuitSource("topmodul-k407039");
    if (!HARDWARE_SOURCE) throw new Error("K407039 TopModul circuit source is required.");

    const PLC_SOURCE = Object.freeze({
      id: "topmodul-k407039-lb1-l5k",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1",
      evidenceClass: "readable-labeler-plc-export",
      sourceDiscipline: "Producer conditions, timers, counters, aliases and external interlock bits are taken from the supplied readable K407-039 LB1 L5K. Hardware is only named where K407039-001 or the PLC alias explicitly identifies it."
    });

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const process = (status, confidence, routine, producerSignals, calculationSteps, hardwareRows, drawingLocations, summary, safetyBoundary, scopeNote) => Object.freeze({
      status,
      confidence,
      routine,
      producerSignals: Object.freeze(producerSignals),
      calculationSteps: freezeRows(calculationSteps),
      hardwareRows: freezeRows(hardwareRows),
      drawingLocations: freezeRows(drawingLocations),
      source: PLC_SOURCE,
      hardwareSource: hardwareRows.length ? HARDWARE_SOURCE : null,
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
      firstFaultRank: rootLikelihood === "primary" ? 10 : rootLikelihood === "supervision" ? 30 : 60
    });

    const motionBoundary = "Observe from normal diagnostics first. Stop the machine and follow site LOTO/stored-energy procedures before sensor alignment, guarded-area access, conveyor/infeed mechanical work, or wiring inspection. Do not force inputs or bypass container-stop, jam, inspection or safety logic.";
    const inspectionBoundary = "Treat Heuft/rejector signals as external machine interfaces. Use normal diagnostic/status screens before field wiring work. Do not defeat inspection/reject functions to keep production running; apply the approved LOTO/electrical safe-work procedure for hands-on work.";

    const PROCESS = Object.freeze({
      678: process(
        "tracked-three-sensor-broken-container-detection-bound",
        "exact-labeler-plc-k407039-sensor-match",
        "FaultLogic_Jumps / ContainerBroken",
        [
          "E1701_P181_BrokenContainer1 = Local:7:I.Data.3",
          "E1701_P182_BrokenContainer2 = Local:7:I.Data.4",
          "E1701_P183_BrokenContainer3 = Local:7:I.Data.5",
          "ContBroken.Detect1RegPointer / Detect2RegPointer / Detect3RegPointer",
          "E1701_ENC101_ClockPulse",
          "E2001_AFD101_MainDriveEnable",
          "E4001_SOL101_ContainerStopValve",
          "ContBroken.O_Fault",
          "Faults_LB1[42].6"
        ],
        [
          { label: "Three detection points", value: "P181, P182 and P183 are separate broken-container proximity inputs at I0007.03, I0007.04 and I0007.05." },
          { label: "Position tracking", value: "Each detection input is evaluated against its tracking-register pointer, not as a simple one-scan alarm." },
          { label: "Motion reference", value: "Main-drive state and ENC101 clock pulses participate in the tracked detection sequence." },
          { label: "Fault output", value: "A valid tracked detection with its override off drives ContBroken.O_Fault -> Fault 678." }
        ],
        [
          { device: "P181", description: "Broken-container detection system sensor 1", area: "+MK =EMB1.1701", cable: ".1701-P181 / configured sensor lead", terminals: "I/O031 I0007.03 / Local:7:I.Data.3" },
          { device: "P182", description: "Broken-container detection system sensor 2", area: "+MK =EMB1.1701", cable: ".1701-P182 / configured sensor lead", terminals: "I/O031 I0007.04 / Local:7:I.Data.4" },
          { device: "P183", description: "Broken-container detection system sensor 3", area: "+MK =EMB1.1701", cable: ".1701-P183 / configured sensor lead", terminals: "I/O031 I0007.05 / Local:7:I.Data.5" }
        ],
        [{ pdfPage: 119, sheet: "119/277", section: "Broken container detection system P181/P182/P183 and I0007.03-.05" }],
        "Fault 678 is a tracked three-sensor broken-container diagnosis, not a generic 'one photoeye is blocked' alarm. The PLC correlates P181/P182/P183 with bottle-position tracking and machine motion. Check which detection channel/tracking diagnostic actually triggered before adjusting all three sensors or replacing hardware.",
        motionBoundary,
        "The PLC also contains false-trigger diagnostic buffers for the three sensors. Use those and actual bottle position to separate a real broken-container event from a sensor/target/timing problem."
      ),

      679: process(
        "container-stop-speed-mismatch-timer-bound",
        "exact-labeler-plc-producer",
        "SpeedControl_Jumps / ContainerStop",
        [
          "E4001_M_SpeedSensorOpenContainerStop",
          "FullBottleCloseBottleStop",
          "SpeedRange.O_InRange1",
          "ContStop.I_ContStopOnOff",
          "ContStop.O_ContStop",
          "ContStop.DelSpeedFault.PRE = 15000",
          "ContStop.O_SpeedFault",
          "ContStop.I_ClutchEnable = Logic_0",
          "ContStop.I_SensorClutch = Logic_0",
          "Faults_LB1[42].7"
        ],
        [
          { label: "Requested state", value: "I_ContStopOnOff = SpeedSensorOpenContainerStop AND NOT FullBottleCloseBottleStop" },
          { label: "Speed permissive", value: "I_SpeedOk = SpeedRange.O_InRange1" },
          { label: "Fault condition", value: "Requested container-stop state and actual O_ContStop disagree while speed is outside the valid range." },
          { label: "Timer", value: "DelSpeedFault preset is 15000 ms; timer done produces O_SpeedFault -> Fault 679." },
          { label: "Revision note", value: "I_ClutchEnable and I_SensorClutch are both driven by Logic_0 in this LB1 revision." }
        ],
        [
          { device: "SOL101", description: "Container-stop valve output", area: "=EMB1.4001", cable: "container-stop output circuit", terminals: "E4001_SOL101_ContainerStopValve = O0103.13" }
        ],
        [],
        "Despite the HMI wording 'Speed Too High For Infeed Worm Clutching', the active producer in this LB1 export is the ContainerStop routine's 15-second speed/state mismatch. The clutch-enable and clutch-sensor inputs are disabled with Logic_0. Diagnose the requested container-stop state, actual SOL101 state and SpeedRange.O_InRange1 before treating the infeed-worm clutch sensor as the cause.",
        motionBoundary,
        "This is revision-specific PLC evidence. Do not infer a clutch hardware failure from the alarm text when the supplied program does not use the clutch inputs."
      ),

      683: process(
        "infeed-gap-primary-and-prewarning-sensor-bound",
        "exact-labeler-plc-k407039-sensor-match",
        "FaultLogic_Jumps / InfeedMonitor",
        [
          "E3901_PE101_InfeedMonitoringDetection1 = I0010.24",
          "E3901_PE103_InfeedMonitoringDetection2 = I0010.25",
          "E3901_PB102_InfeedMonitoringReset = I0010.12",
          "E4001_SOL101_ContainerStopValve",
          "InFeedMon_01.O_InFeedFault",
          "InFeedMon_02.O_InFeedFault -> Warning",
          "Faults_LB1[42].11"
        ],
        [
          { label: "Primary detector", value: "PE101 is the detection-unit-1 input used by InFeedMon_01; its fault output drives Fault 683." },
          { label: "Container stop", value: "The monitor also receives the actual container-stop valve state." },
          { label: "Secondary detector", value: "PE103 is mounted farther from the machine and feeds InFeedMon_02 as an earlier warning/min-speed path, not Fault 683 itself." },
          { label: "Reset", value: "PB102 is the dedicated infeed-monitoring reset input." }
        ],
        [
          { device: "PE101", description: "Infeed gap detector — detection unit 1", area: "+TBB =EMB1.3901", cable: ".3901-W101", terminals: "I/O042 I0010.24 via TB52" },
          { device: "PE103", description: "Infeed gap detector — detection unit 2 / upstream prewarning", area: "+TBB =EMB1.3901", cable: ".3901-W103", terminals: "I/O042 I0010.25 via TB52" },
          { device: "PB102", description: "Reset infeed gap detector", area: "+TBB =EMB1.3901", cable: ".3901-W102", terminals: "I/O042 I0010.12; reset lamp O0102.10" }
        ],
        [{ pdfPage: 168, sheet: "168/277", section: "Infeed gap detector PE101/PE103, reset PB102 and I0010.24/.25/.12" }],
        "Fault 683 is specifically the PE101/InFeedMon_01 infeed-gap fault. PE103 is an upstream early-warning sensor whose PLC comment says it is intended to slow the machine to minimum speed before the gap reaches PE101. If only the warning path is active, do not troubleshoot it as Fault 683; if 683 is active, compare PE101 state, container-stop state and reset history first.",
        motionBoundary,
        "The HMI override is also in the producer path. Verify the normal configured state rather than forcing either sensor input."
      ),

      684: process(
        "infeed-worm-clutch-overload-sensor-bound",
        "exact-labeler-plc-k407039-sensor-match",
        "FaultLogic_Jumps / ClutchOverload",
        [
          "E1501_P131_InfeedWormClutch = I0010.19",
          "ClutchOverl_01.I_Sensor",
          "ClutchOverl_01.O_Fault",
          "ControlOut.ResetGeneral",
          "Faults_LB1[42].12"
        ],
        [
          { label: "Physical input", value: "P131 'Infeed Worm Clutch Overload' is PLC input I0010.19." },
          { label: "Fault logic", value: "The ClutchOverload routine latches O_Fault from the sensor state after power-on/reset conditions are satisfied." },
          { label: "Machine response", value: "Fault 684 removes Machine Jog and Machine On enables until the actual condition is corrected/reset." }
        ],
        [{ device: "P131", description: "Proximity sensor — infeed worm clutch overload monitoring", area: "+ET =EMB1.1501", cable: ".1501-W131", terminals: "I/O042 I0010.19 via TB53" }],
        [{ pdfPage: 112, sheet: "112/277", section: "P131 monitoring infeed worm / I0010.19 / W131" }],
        "Fault 684 is the direct infeed-worm clutch-overload sensor path. Confirm actual clutch/mechanical condition and P131 state before adjusting the prox. A sensor that disagrees with the physical clutch state points toward alignment/device/wiring; a correctly changing P131 with a real trip points back to the worm/clutch mechanics.",
        motionBoundary,
        "Do not defeat the clutch overload input. Resolve mechanical binding or overload before reset."
      ),

      685: process(
        "discharge-backup-pulse-delay-bound",
        "exact-labeler-plc-k407039-sensor-match",
        "FaultLogic_Jumps / SafetyBackup",
        [
          "E1501_PE202_BackupDischarge = I0010.20",
          "E1701_ENC101_ClockPulse",
          "Data_To_HMI_Labeler85_1[389]",
          "SafeBackup_01.I_OnDel",
          "SafeBackup_01.O_BackupFault",
          "Faults_LB1[42].13"
        ],
        [
          { label: "Backup sensor", value: "PE202 is the local discharge-backup input I0010.20." },
          { label: "Delay basis", value: "SafetyBackup uses main-encoder clock pulses and HMI parameter 389 as the on-delay count." },
          { label: "Fault action", value: "Persistent backup produces O_BackupFault -> Fault 685 and removes Machine Jog/On." }
        ],
        [{ device: "PE202", description: "Photoelectric sensor — backup discharge conveyor", area: "+TBB =EMB1.1501", cable: ".1501-W202", terminals: "I/O042 I0010.20 via TB53" }],
        [{ pdfPage: 113, sheet: "113/277", section: "PE202 back-up discharge 1 / I0010.20 / W202" }],
        "Fault 685 is a timed discharge-backup condition from PE202, not simply the instantaneous state of the photoeye. The SafetyBackup routine counts the configured delay using ENC101 clock pulses before latching the fault. Check whether bottles are genuinely backed up and whether PE202 remains made for the configured interval before treating the sensor as failed.",
        motionBoundary,
        "A blocked/dirty/misaligned PE202 and a real downstream accumulation can look identical at the PLC input; compare physical flow to input state."
      ),

      686: process(
        "external-reject-conveyor-full-interlock-plus-delay-bound",
        "exact-labeler-plc-interlock-path",
        "EtherNetFullBottleConv / FaultLogic_Jumps / SafetyBackup",
        [
          "Consumed_FullBottle85_B.Interlock_Data_Bit[33]",
          "E1501_M_RejectionConveyorFull",
          "Pulse._1Hz",
          "Data_To_HMI_Labeler85_1[390]",
          "SafeBackup_02.O_BackupFault",
          "Faults_LB1[42].14"
        ],
        [
          { label: "External source", value: "FullBottle85_B Level 2 interlock bit 33 is inverted into E1501_M_RejectionConveyorFull." },
          { label: "Local supervision", value: "The internal flag feeds SafetyBackup_02 using the 1 Hz pulse and HMI delay parameter 390." },
          { label: "Fault output", value: "Persistent external conveyor-full state produces Fault 686 and requests minimum speed/container-stop behavior." }
        ],
        [],
        [],
        "Fault 686 does not originate from a locally named reject-conveyor sensor in this Labeler PLC. It originates in `Consumed_FullBottle85_B.Interlock_Data_Bit[33]`, received from the Full Bottle Conveyor controller over Level 2, and is then time-supervised locally. ServoForge therefore stops at the external interlock boundary unless the Full Bottle Conveyor PLC/source is supplied.",
        motionBoundary,
        "Do not invent a local photoeye for Fault 686. If the Labeler receives the bit incorrectly, check the Level 2 interlock source/communications; if the bit reflects reality, troubleshoot the reject/full-bottle conveyor system at its own controller."
      ),

      694: process(
        "external-full-bottle-interlock-direct-latch-bound",
        "exact-labeler-plc-interlock-path",
        "EtherNetFullBottleConv",
        [
          "Consumed_FullBottle85_B.Interlock_Data_Bit[27]",
          "Interlocks_FullBottle85_B = 1756-ENBT/A / 10.99.218.28",
          "FullBottle85_B = 1756-L61 / Slot 0",
          "Faults_LB1[43].6"
        ],
        [
          { label: "Source controller", value: "FullBottle85_B CPU produces the consumed Level 2 interlock data through Interlocks_FullBottle85_B." },
          { label: "Fault bit", value: "Interlock_Data_Bit[27] directly latches Fault 694 and removes Machine On." },
          { label: "Reset behavior", value: "The Labeler only unlatches 694 after bit 27 clears and Reset General is requested." }
        ],
        [],
        [],
        "Fault 694 'Reject Conveyor / inside Lane / backed up' is a direct external Level 2 interlock from the Full Bottle Conveyor PLC, not a local K407039 sensor producer. The readable project identifies the remote ENBT as 1756-ENBT/A at 10.99.218.28 with FullBottle85_B CPU behind it. The physical conveyor sensor/logic that creates bit 27 is outside the supplied Labeler program, so ServoForge preserves that boundary.",
        motionBoundary,
        "If bit 27 is active, the next authoritative evidence is the Full Bottle Conveyor controller. Do not guess which external lane sensor is responsible from the Labeler alarm text alone."
      ),

      695: process(
        "direct-heuft-reject-fault-interface-bound",
        "exact-labeler-plc-k407039-interface-match",
        "Machine_Jumps / Inspection",
        [
          "E9712_HeuftRejectFault = I0011.21",
          "Inspection_01.I_RejectFault",
          "Inspection_01.O_RejectFault",
          "Faults_LB1[43].7"
        ],
        [
          { label: "External input", value: "Heuft reject fault arrives directly on I0011.21." },
          { label: "Inspection block", value: "The input feeds Inspection_01.I_RejectFault; O_RejectFault drives Fault 695." },
          { label: "Machine response", value: "Fault 695 removes Machine On." }
        ],
        [{ device: "Heuft / A999 reject-fault interface", description: "External label-inspection/reject system fault signal", area: "=EMB1.9712 +SK / =FM12 +SS", cable: ".9712-W159", terminals: "I/O061 I0011.21 through CN151-CN154 interface" }],
        [{ pdfPage: 193, sheet: "193/277", section: "Label inspection unit — fault rejection I0011.21 / W159 / CN151-CN154" }],
        "Fault 695 is a direct Heuft reject-system fault input. The Labeler is not diagnosing the rejector internally here; it is reporting the external system's fault signal. Check the Heuft/rejector diagnostic first, then the I0011.21 interface only if the Heuft state and Labeler input disagree.",
        inspectionBoundary,
        "This is an external-system interface fault. The cause may be wholly inside the Heuft system even when the Labeler wiring is healthy."
      ),

      710: process(
        "site-added-rejector-jam-tracking-counter-bound",
        "exact-labeler-plc-custom-logic-with-unnamed-inputs",
        "SafetyBackup custom Heuft jam logic",
        [
          "Heuft_Jam_Test_Bit = 1 in supplied export",
          "Bottle_Tracking[3].17",
          "Bottle_Tracking[3].26",
          "Rejector_1_Bad_Counter",
          "Rejector_2_Bad_Counter",
          "I0010.26",
          "I0010.27",
          "VSD85LB1_Node3:O.CommandedFreq > 6500",
          "VSD85LB1_Node4:O.CommandedFreq > 6500",
          "E1701_ENC101_ClockPulse",
          "Faults_LB1[44].6"
        ],
        [
          { label: "Enable gate", value: "Heuft_Jam_Test_Bit is initialized to 1 in this export and has no other write instruction located." },
          { label: "Reject tracking", value: "Tracked bottles at positions 17 and 26 increment rejector bad counters while both drives are commanded above 6500 and no inhibiting Heuft/broken-container fault is active." },
          { label: "Confirmation/reset inputs", value: "Raw inputs I0010.26 and I0010.27 reset their respective bad counters on confirmation transitions." },
          { label: "Fault output", value: "Either bad counter done condition, or retained 710 without reset, drives Fault 710 while the enable gate is true." }
        ],
        [],
        [{ pdfPage: 56, sheet: "56/277", section: "I0010.26 and I0010.27 exist in I/O list but are unnamed (*) in K407039" }],
        "Fault 710 is custom rejector-jam tracking logic, not a simple Heuft fault contact. It compares expected reject events from bottle tracking against two raw confirmation inputs. The supplied export initializes `Heuft_Jam_Test_Bit` to 1 and contains no located writes that turn it off, so this logic appears enabled in this revision. However, K407039 leaves I0010.26 and I0010.27 unnamed; ServoForge therefore does not invent physical sensor names for them.",
        inspectionBoundary,
        "Use bottle tracking, the two rejector counters and raw input transitions to determine which reject path failed to confirm. Physical device identity for I0010.26/.27 requires additional machine documentation or field verification."
      )
    });

    const SOURCE_GAPS = Object.freeze({
      693: "Fault 693 'Discharge conveyor manually stopped on BP82' is named in the LB1 alarm table, but Faults_LB1[43].5 has no producer occurrence anywhere in the supplied readable Labeler L5K. ServoForge keeps the alarm searchable but does not invent a BP82 input or circuit path for this revision.",
      696: "Fault 696 'Heuft Low Air Pressure' has a real external input E9712_HeuftAirPressureFault = I0011.22 and K407039 shows the Heuft air-pressure-too-low interface. However, the only Faults_LB1[43].8 producer is gated by AFI() immediately after Inspection_01.O_AirPressureFault, so the alarm bit is disabled in this supplied LB1 revision. The input can still be observed diagnostically, but ServoForge does not promote it as an active fault producer."
    });

    function processForEntry(entry) {
      if (!entry?.plcFault || entry.diagnosticScope === "Station") return null;
      return PROCESS[Number(entry.number)] || null;
    }

    function sourceGapForEntry(entry) {
      if (!entry?.plcFault || entry.diagnosticScope === "Station") return null;
      const reason = SOURCE_GAPS[Number(entry.number)];
      if (!reason) return null;
      return Object.freeze({
        status: Number(entry.number) === 696 ? "named-input-present-but-producer-disabled-by-afi" : "named-alarm-no-producer-in-supplied-lb1",
        reason
      });
    }

    function rungForEntry(entry) {
      const n = Number(entry?.number);
      const trace = PROCESS[n];
      if (!trace) return null;
      const role = [686, 694].includes(n) ? "supervision" : "primary";
      const type = {
        678: "tracked-container-detection",
        679: "timed-speed-state-mismatch",
        683: "infeed-gap-supervision",
        684: "clutch-overload-input",
        685: "timed-discharge-backup",
        686: "external-conveyor-summary",
        694: "external-interlock-latch",
        695: "external-inspection-fault",
        710: "reject-confirmation-counter"
      }[n] || "container-flow";
      return evidence(trace.routine, type, role, role === "primary" ? "Primary/root-cause candidate" : "Supervision/external summary", trace.producerSignals, trace.summary);
    }

    function enrich(entry) {
      if (!entry?.plcFault) return entry;
      const trace = processForEntry(entry);
      const gap = sourceGapForEntry(entry);
      const rung = rungForEntry(entry);
      if (!trace && !gap && !rung) return entry;
      return Object.freeze({
        ...entry,
        ...(trace ? { processTrace: trace } : {}),
        ...(gap ? { sourceGap: gap } : {}),
        ...(rung ? { labelerRungEvidence: rung } : {})
      });
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);
    const getTopModulFaultRelations = (value, limit = 10) => base.getTopModulFaultRelations(value, limit).map(enrich);
    const getTopModulFirstFaultCandidates = (value, limit = 8) => base.getTopModulFirstFaultCandidates(value, limit).map(enrich);

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
        processTrace: entry.processTrace || original.processTrace || null,
        sourceGap: entry.sourceGap || original.sourceGap || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      for (const number of [678, 679, 683, 684, 685, 686, 694, 695, 710]) {
        const entry = getTopModulFault(number);
        if (!entry?.processTrace) errors.push(`Labeler container-flow Fault ${number} lost process evidence.`);
        if (!entry?.labelerRungEvidence) errors.push(`Labeler container-flow Fault ${number} lost producer classification.`);
      }
      if (!getTopModulFault(678)?.processTrace?.hardwareRows?.some((row) => row.device === "P181" && /I0007\.03/.test(row.terminals))) errors.push("Fault 678 lost P181/I0007.03 evidence.");
      if (!getTopModulFault(679)?.processTrace?.producerSignals?.includes("ContStop.I_ClutchEnable = Logic_0")) errors.push("Fault 679 lost clutch-disable revision evidence.");
      if (!getTopModulFault(683)?.processTrace?.hardwareRows?.some((row) => row.device === "PE101" && /I0010\.24/.test(row.terminals))) errors.push("Fault 683 lost PE101/I0010.24 evidence.");
      if (!getTopModulFault(684)?.processTrace?.hardwareRows?.some((row) => row.device === "P131" && /I0010\.19/.test(row.terminals))) errors.push("Fault 684 lost P131/I0010.19 evidence.");
      if (!getTopModulFault(685)?.processTrace?.hardwareRows?.some((row) => row.device === "PE202" && /I0010\.20/.test(row.terminals))) errors.push("Fault 685 lost PE202/I0010.20 evidence.");
      if (!getTopModulFault(686)?.processTrace?.producerSignals?.includes("Consumed_FullBottle85_B.Interlock_Data_Bit[33]")) errors.push("Fault 686 lost FullBottle bit 33 evidence.");
      if (!getTopModulFault(694)?.processTrace?.producerSignals?.includes("Consumed_FullBottle85_B.Interlock_Data_Bit[27]")) errors.push("Fault 694 lost FullBottle bit 27 evidence.");
      if (!getTopModulFault(695)?.processTrace?.hardwareRows?.some((row) => /Heuft/.test(row.device) && /I0011\.21/.test(row.terminals))) errors.push("Fault 695 lost Heuft reject I0011.21 evidence.");
      if (!getTopModulFault(710)?.processTrace?.producerSignals?.includes("Heuft_Jam_Test_Bit = 1 in supplied export")) errors.push("Fault 710 lost custom enable-gate evidence.");
      const f693 = getTopModulFault(693);
      if (!f693?.sourceGap || f693.processTrace) errors.push("Fault 693 must remain named but unpromoted with no producer.");
      const f696 = getTopModulFault(696);
      if (!f696?.sourceGap || f696.processTrace) errors.push("Fault 696 must remain disabled by AFI with no promoted process route.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+labeler-container-flow-v1`,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulProcessTrace,
      topModulLabelerContainerFlowFaults: Object.freeze([678, 679, 683, 684, 685, 686, 694, 695, 710]),
      topModulLabelerContainerFlowSourceGaps: Object.freeze([693, 696]),
      validate
    });
  };
});
