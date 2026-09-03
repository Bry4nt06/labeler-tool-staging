"use strict";

(function installTopModulLabelerCauseModel(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLabelerCauseModelExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulFaultRelations || !base?.getTopModulFirstFaultCandidates) {
      throw new Error("TopModul station causality model is required before Labeler causality.");
    }

    const PRIMARY = "primary";
    const SUPERVISION = "supervision";
    const SECONDARY = "secondary";
    const DISABLED = "disabled";
    const CATALOG_ONLY = "catalog-only";
    const ev = (routine, logicType, rootLikelihood, producerSignals, logicSummary, evidenceStatus = "rung-condition-bound") => Object.freeze({
      routine,
      logicType,
      rootLikelihood,
      producerSignals: Object.freeze(producerSignals),
      logicSummary,
      evidenceStatus
    });

    const rpcMessageCodes = Object.freeze({
      512: 16, 513: 17, 514: 111, 515: 33, 516: 112, 517: 35,
      518: 36, 519: 102, 521: 38, 522: 100, 523: 40, 524: 120,
      525: 121, 526: 256, 527: 1984, 528: 130, 529: 101, 532: 110
    });
    const rpcNumbers = Object.freeze(Object.keys(rpcMessageCodes).map(Number));

    const explicitEvidence = Object.freeze({
      480: ev(
        "SpeedControl_Jumps",
        "drive-controller-status",
        PRIMARY,
        ["DriveConETH_01.O_MotOK", "DriveConETH_01.O_NoFault", "E2001_MS101_MainDriveOverload"],
        "Main Drive Fault is asserted when the main-drive controller reports motor-not-OK or fault/not-ready while the overload permissive is made. The rung also removes machine/jog enable and requests safety reset."
      ),
      482: ev(
        "ContactorMonitor",
        "timed-contactor-state-mismatch",
        SUPERVISION,
        ["E2001_C102_MainDriveContactor", "E2001_C101_MainDriveContactorFB", "StartStop.EnableMainDriveOFF.DN", "E2001.T_ContactorMonitor.DN"],
        "The safety contactor monitor times three invalid command/feedback states: contactor not commanded but feedback present, contactor commanded but feedback absent, or feedback remaining after controller enable has been released. Timer done latches the contactor-monitor fault."
      ),
      490: ev(
        "ElectrBrake / StartStopControl_Jumps",
        "timed-hardware-feedback-mismatch",
        SUPERVISION,
        ["E2001_C102_MainDriveContactor", "E2001_C102_MainDriveContactorDelayFB", "ElectrBrake.HWTimerOffDel.DN", "ElectrBrake.HWTimerCon.DN", "ElectrBrake.O_HWTimerFault"],
        "The electric-brake safety routine compares the main-contactor state with its hardware-delay feedback. A mismatch persisting through the 1-second hardware-timer monitor produces O_HWTimerFault, which is latched into Fault 490."
      ),
      520: ev(
        "MessageBitField",
        "catalog-bit-not-produced",
        CATALOG_ONLY,
        ["DataExchangeStation.FaultsDTFaults[0].8"],
        "Fault 520 is named 'Lost Connection To PowerPC' in the Labeler alarm table, but DataExchangeStation.FaultsDTFaults[0].8 is not set anywhere in the readable LB1 L5K. Communication/watchdog conditions are represented elsewhere; do not invent a producer for this bit."
      ),
      640: ev(
        "FaultLogic_Jumps / PressureMonitoring",
        "pressure-monitoring",
        PRIMARY,
        ["E1501_PS101_MachineAirPressure", "PressMonitor_01.O_Fault", "PowerOnReset"],
        "The machine air-pressure switch feeds the PressureMonitoring routine; its fault output drives Fault 640 after power-on reset."
      ),
      641: ev(
        "Not located in LB1 L5K",
        "catalog-only",
        CATALOG_ONLY,
        [],
        "Fault 641 is named 'Low Air Pressure Infeed Worm' in the alarm table, but the exact Faults_LB1[40].1 producer is not present in this readable LB1 export."
      ),
      648: ev(
        "Not located in LB1 L5K",
        "catalog-only",
        CATALOG_ONLY,
        [],
        "Fault 648 is named 'Glideliner Fault' in the alarm table, but the exact Faults_LB1[40].8 producer is not present in this readable LB1 export."
      ),
      661: ev(
        "DataToStation",
        "watchdog-summary",
        SECONDARY,
        ["DataExchangeStation.OutMalfunction", "DataExchangeStation.OutServoOperating", "WatchdogErrorMessage", "E2001_MS101_MainDriveOverload"],
        "Fault 661 is a Servo Bottle Table summary/watchdog alarm. ErrorWatchdog establishes WatchdogErrorMessage; code 10 together with OutMalfunction drives this summary. Investigate the decoded 512-532 Servo Bottle Table faults first when present."
      ),
      662: ev(
        "Machine_Jumps / ServoTable",
        "disabled-input-path",
        DISABLED,
        ["ServoTable_01.I_NoSerialFault", "E2301_IO0102_O8_NoSerialFault", "Logic_1", "ServoTable_01.O_SerialFault"],
        "Fault 662 is wired from ServoTable_01.O_SerialFault, but in this LB1 revision I_NoSerialFault is driven by a parallel branch containing Logic_1. That makes the no-serial-fault input true continuously, so this alarm path is not an active producer in the supplied revision."
      ),
      669: ev(
        "ElectrBrake / StartStopControl_Jumps",
        "timed-zero-speed-safety-monitor",
        SUPERVISION,
        ["E1701_ENC101_FineClockPulse", "ElectrBrake.Counter", "ElectrBrake.SpeedActVal", "ElectrBrake.ZeroSpeedOnDel", "ElectrBrake.ZeroSpeedCon", "ElectrBrake.O_ZeroSpeedFault"],
        "Fine-clock hardware pulses increment ElectrBrake.Counter and are converted into measured speed. During a commanded brake stop, failure to reach zero speed through the staged zero-speed timers produces O_ZeroSpeedFault; that condition is latched into Fault 669."
      ),
      670: ev(
        "PulseCounters / ElectrBrake / StartStopControl_Jumps",
        "timed-fine-pulse-safety-monitor",
        SUPERVISION,
        ["E1701_ENC101_FineClockPulse", "ElectrBrake.Counter", "ElectrBrake.I_DriveEnable", "ElectrBrake.ZeroSpeed", "ElectrBrake.FinePulseCon", "ElectrBrake.O_FinePulseFault", "E2001_M_ElectrBrakeFaultEncoder"],
        "E1701_ENC101_FineClockPulse is the hardware fine-pulse input counted by ElectrBrake.Counter. With drive enable active and measured speed remaining zero, the 3000 ms FinePulseCon monitor produces O_FinePulseFault. The condition is latched and, outside the modulation suppression window, drives Fault 670."
      )
    });

    function rpcEvidence(number) {
      const code = rpcMessageCodes[number];
      if (code == null) return null;
      const word = Math.floor((number - 512) / 16);
      const bit = (number - 512) % 16;
      return ev(
        "MessageBitField / DataToStation",
        "powerpc-message-decoder",
        PRIMARY,
        [
          `DT_PowerPC_Response.LastMessage.Faultcode == ${code}`,
          "DT_PowerPC_Response.LastMessage.TypeOfFoult == 2",
          `DataExchangeStation.FaultsDTFaults[${word}].${bit}`,
          `Faults_LB1[${Math.floor(number / 16)}].${number % 16}`
        ],
        `The Servo Bottle Table PowerPC message decoder maps message fault code ${code} with TypeOfFoult 2 into DataExchangeStation.FaultsDTFaults[${word}].${bit}. DataToStation then copies that fault word into the Labeler Faults_LB1 array.`,
        "message-code-and-bitfield-bound"
      );
    }

    function stationSummaryEvidence(number) {
      if (number >= 642 && number <= 647) {
        const station = number - 641;
        return ev(
          "LabelingStation_Jumps / Aggregat",
          "station-synchronization-summary",
          SUPERVISION,
          [`DataFromLS[${station}].Par1[0].3`, `E975${station}_Agg${station}_I1_Data`, `Aggregat_0${station}.I_SynchronFault`, `Aggregat_0${station}.O_Fault[6]`, "Logic_1"],
          `Fault ${number} is the Labeler-side 'Station ${station} Not Synchronized' summary. The Aggregat routine passes I_SynchronFault to O_Fault[6]. For the supplied APL Cart 1 program, DataFromLS.Par1[0].3 is explicitly forced true with Logic_1 because this synchronization signal is documented as 'not needed in the APL; only for Cold Glue', so do not lead with this alarm for an APL cart unless another cart/revision proves otherwise.`,
          "labeler-summary-rung-bound"
        );
      }
      if (number >= 649 && number <= 654) {
        const station = number - 648;
        return ev(
          "LabelingStation_Jumps",
          "disabled-summary-placeholder",
          DISABLED,
          [`Aggregat_0${station}.O_Fault[2]`, "Logic_0", `Faults_LB1[40].${8 + station}`],
          `The generic 'Fault Labeling Station ${station}' HMI bit is gated through Logic_0 in this LB1 revision. The underlying Aggregat malfunction state can still stop/inhibit the machine, but this specific alarm bit is an inactive placeholder.`,
          "disabled-in-labeler-lb1"
        );
      }
      if (number >= 655 && number <= 660) {
        const station = number - 654;
        return ev(
          "LabelingStation_Jumps / Aggregat",
          "label-supply-autochange-summary",
          SUPERVISION,
          [`DataFromLS[${station}].Par1[0].1`, `Aggregat_0${station}.I_LackOfLabel`, `Aggregat_0${station}.O_Fault[1]`, `Aggregat_0${station}.O_Fault[4]`],
          `Fault ${number} is produced from the Station ${station} lack-of-label state when the aggregate also requires the container-stop path; otherwise the same lack-of-label condition is handled as a warning/autochange condition. Trace the shared station label-supply/end-of-reel logic before treating the Labeler summary as the root cause.`,
          "labeler-summary-rung-bound"
        );
      }
      if (number >= 663 && number <= 668) {
        const station = number - 662;
        return ev(
          "LabelingStation_Jumps / Aggregat",
          "station-not-ready-summary",
          SECONDARY,
          [`DataFromLS[${station}].Par1[0].0`, `Aggregat_0${station}.I_Ready`, `Aggregat_0${station}.T_NotReady`, `Aggregat_0${station}.O_Fault[5]`, `ETH_ComSend[${station}].O_ReadyForETHConnect_L3`],
          `Fault ${number} is a Station ${station} Not Ready summary. The Aggregat routine uses a 10-second not-ready timer and also retains the state when a selected/on station loses readiness; LabelingStation_Jumps additionally treats loss of the station Ethernet-ready path as not-ready. Drill into Station ${station} faults and communication evidence that occurred first.`,
          "labeler-summary-rung-bound"
        );
      }
      return null;
    }

    function labelerEvidenceFor(number) {
      const n = Number(number);
      if (!Number.isInteger(n)) return null;
      return explicitEvidence[n] || rpcEvidence(n) || stationSummaryEvidence(n) || null;
    }

    function evidenceRank(evidence) {
      if (!evidence) return 80;
      if (evidence.rootLikelihood === PRIMARY) return evidence.logicType.includes("direct") || evidence.logicType.includes("decoder") ? 10 : 15;
      if (evidence.rootLikelihood === SUPERVISION) return 30;
      if (evidence.rootLikelihood === SECONDARY) return 55;
      if (evidence.rootLikelihood === DISABLED) return 95;
      return 100;
    }

    function roleLabel(rootLikelihood) {
      if (rootLikelihood === PRIMARY) return "Primary/root-cause candidate";
      if (rootLikelihood === SUPERVISION) return "Supervision/derived fault";
      if (rootLikelihood === SECONDARY) return "Secondary/summary fault";
      if (rootLikelihood === DISABLED) return "Inactive in supplied LB1 revision";
      if (rootLikelihood === CATALOG_ONLY) return "Catalog-only in supplied LB1 revision";
      return "Unclassified";
    }

    function enrich(entry) {
      if (!entry?.plcFault || entry.diagnosticScope === "Station") return entry;
      const evidence = labelerEvidenceFor(entry.number);
      if (!evidence) return entry;
      return Object.freeze({
        ...entry,
        diagnosticScope: entry.diagnosticScope || "Labeler",
        labelerRungEvidence: Object.freeze({
          ...evidence,
          firstFaultRank: evidenceRank(evidence),
          roleLabel: roleLabel(evidence.rootLikelihood)
        })
      });
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);
    const evidenceFor = (entry) => entry?.stationRungEvidence || entry?.labelerRungEvidence || null;

    function annotate(candidate, injectedReason = "") {
      const item = enrich(candidate);
      const evidence = evidenceFor(item);
      if (!evidence) return injectedReason ? Object.freeze({ ...item, relationReason: injectedReason }) : item;
      const baseScore = Number(candidate.firstFaultScore ?? candidate.relationScore ?? 0);
      let boost = 0;
      let causalRole = candidate.causalRole || "related";
      let causalRoleLabel = candidate.causalRoleLabel || "Related fault";
      if (evidence.rootLikelihood === PRIMARY) {
        boost = 70;
        causalRole = "upstream-primary";
        causalRoleLabel = "Primary candidate";
      } else if (evidence.rootLikelihood === SUPERVISION) {
        boost = 30;
        causalRole = "upstream-supervision";
        causalRoleLabel = "Supervision candidate";
      } else if (evidence.rootLikelihood === SECONDARY) {
        boost = -20;
        causalRole = "downstream-summary";
        causalRoleLabel = "Summary/downstream alarm";
      } else if ([DISABLED, CATALOG_ONLY].includes(evidence.rootLikelihood)) {
        boost = -80;
        causalRole = "low-confidence";
        causalRoleLabel = "Do not lead with this";
      }
      return Object.freeze({
        ...item,
        relationReason: injectedReason || item.relationReason,
        causalRole,
        causalRoleLabel,
        firstFaultScore: baseScore + boost - Number(evidence.firstFaultRank || 0) / 10
      });
    }

    function resolve(value) {
      if (typeof value === "object" && value) return enrich(value);
      return getTopModulFault(value) || getEntry(value);
    }

    function servoBottleTableCandidates(source) {
      if (Number(source?.number) !== 661) return [];
      return rpcNumbers
        .map((number) => getTopModulFault(number))
        .filter(Boolean)
        .map((entry) => annotate({ ...entry, relationScore: 110 }, "Decoded Servo Bottle Table PowerPC fault that can explain the Fault 661 summary."));
    }

    function mergeCandidates(source, rows) {
      const combined = [...servoBottleTableCandidates(source), ...rows.map((entry) => annotate(entry))];
      const seen = new Set();
      return combined.filter((entry) => {
        if (!entry?.id || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      });
    }

    function sortCandidates(rows) {
      return rows.sort((a, b) =>
        Number(b.firstFaultScore || 0) - Number(a.firstFaultScore || 0) ||
        Number(b.relationScore || 0) - Number(a.relationScore || 0) ||
        Number(a.number) - Number(b.number)
      );
    }

    function getTopModulFaultRelations(value, limit = 10) {
      const source = resolve(value);
      const raw = base.getTopModulFaultRelations(source || value, Math.max(30, (Number(limit) || 10) * 4));
      return sortCandidates(mergeCandidates(source, raw)).slice(0, Math.max(1, Number(limit) || 10));
    }

    function getTopModulFirstFaultCandidates(value, limit = 8) {
      const source = resolve(value);
      if (!source?.plcFault) return [];
      const raw = base.getTopModulFaultRelations(source, 48);
      return sortCandidates(mergeCandidates(source, raw))
        .filter((candidate) => !["downstream-summary", "low-confidence"].includes(candidate.causalRole))
        .slice(0, Math.max(1, Number(limit) || 8));
    }

    function getTopModulFaultDrillDown(value, limit = 10) {
      const source = resolve(value);
      const original = base.getTopModulFaultDrillDown(source || value, Math.max(30, (Number(limit) || 10) * 3));
      if (!original) return null;
      const entry = enrich(original.entry);
      return Object.freeze({
        ...original,
        entry,
        related: getTopModulFaultRelations(entry, limit),
        firstFaultCandidates: getTopModulFirstFaultCandidates(entry, Math.min(6, Math.max(3, Number(limit) || 6))),
        prompt: `${original.prompt} Labeler-side ranking now distinguishes direct drive/RPC messages, safety supervision, downstream station summaries, and inactive/catalog-only alarm paths.`
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      for (const number of [480, 482, 490, 512, 515, 524, 532, 640, 642, 649, 655, 661, 662, 663, 669, 670]) {
        if (!getTopModulFault(number)?.labelerRungEvidence) errors.push(`TopModul Labeler fault ${number} lost its Labeler rung evidence.`);
      }
      if (getTopModulFault(520)?.labelerRungEvidence?.rootLikelihood !== CATALOG_ONLY) errors.push("Fault 520 must remain catalog-only for its named bit in this LB1 export.");
      if (getTopModulFault(662)?.labelerRungEvidence?.rootLikelihood !== DISABLED) errors.push("Fault 662 must remain disabled in the supplied LB1 revision.");
      if (!getTopModulFault(670)?.labelerRungEvidence?.producerSignals?.includes("E1701_ENC101_FineClockPulse")) errors.push("Fault 670 lost the fine-clock hardware input trace.");
      if (getTopModulFault(649)?.labelerRungEvidence?.rootLikelihood !== DISABLED) errors.push("Generic Station 1 Fault 649 must remain marked as a Logic_0-disabled HMI path in this LB1 revision.");
      if (labelerEvidenceFor(528)?.producerSignals?.[0] !== "DT_PowerPC_Response.LastMessage.Faultcode == 130") errors.push("PowerPC decoder message 528/130 evidence was lost.");
      if (labelerEvidenceFor(529)?.producerSignals?.[0] !== "DT_PowerPC_Response.LastMessage.Faultcode == 101") errors.push("PowerPC decoder message 529/101 evidence was lost.");
      const servoFirst = getTopModulFirstFaultCandidates(661, 8);
      if (!servoFirst.some((entry) => entry.labelerRungEvidence?.rootLikelihood === PRIMARY)) errors.push("Fault 661 first-fault ranking contains no decoded Servo Bottle Table primary fault.");
      if (servoFirst.some((entry) => Number(entry.number) === 662)) errors.push("Fault 662 must not be promoted as a first-fault candidate for Fault 661.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+topmodul-labeler-causality-v1`,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulLabelerRungEvidence: labelerEvidenceFor,
      validate
    });
  };
});
