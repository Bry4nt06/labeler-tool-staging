"use strict";

(function installTopModulLabelerOperatingStateTrace(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLabelerOperatingStateTraceExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getStationFaultVariant || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul station and Labeler diagnostic layers are required before operating-state tracing.");
    }

    const SOURCE = base.getTopModulCircuitSource("topmodul-k407039");
    if (!SOURCE) throw new Error("K407039 TopModul circuit source is required.");

    const PLC_SOURCE = Object.freeze({
      id: "topmodul-k407039-lb1-operating-state-l5k",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1",
      evidenceClass: "readable-labeler-plc-export",
      sourceDiscipline: "Operating-state, override and station-interface producers are taken from the supplied readable LB1 L5K. Six-station groups reuse one Labeler-side method only where the same Aggregat routine and repeated station call structure are present."
    });

    const CART_SOURCE = Object.freeze({
      id: "co85-lb1-apl-cart-1-l5k-operating-state",
      file: "CO85_LB1_APLCart_1.L5K",
      controller: "CO85_LB1_APLCart_1",
      evidenceClass: "readable-cart-plc-export",
      sourceDiscipline: "Cart-side cyclic bit semantics are verified directly for Cart 1 only. They are not silently generalized to the internal programs of Carts 2-6 without another readable cart export."
    });

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const process = (status, confidence, routine, producerSignals, calculationSteps, hardwareRows, drawingLocations, summary, safetyBoundary, scopeNote, source = PLC_SOURCE) => Object.freeze({
      status,
      confidence,
      routine,
      producerSignals: Object.freeze(producerSignals),
      calculationSteps: freezeRows(calculationSteps),
      hardwareRows: freezeRows(hardwareRows),
      drawingLocations: freezeRows(drawingLocations),
      source,
      hardwareSource: hardwareRows.length ? SOURCE : null,
      summary,
      safetyBoundary,
      scopeNote
    });
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
    const evidence = (routine, logicType, rootLikelihood, roleLabel, producerSignals, logicSummary, firstFaultRank = 30, evidenceStatus = "rung-condition-bound") => Object.freeze({
      routine,
      logicType,
      rootLikelihood,
      roleLabel,
      producerSignals: Object.freeze(producerSignals),
      logicSummary,
      evidenceStatus,
      firstFaultRank
    });

    const stationBoundary = "Do not bypass station plug/connector, synchronization, readiness, guarding, E-stop or communication interlocks. Stop the machine and follow site LOTO/stored-energy requirements before disconnecting station plugs or performing hands-on electrical work. Energized electrical diagnostics are for qualified personnel only.";
    const overrideBoundary = "An override alarm is an intentional operating state, not a repair instruction. Do not enable or retain an inspection, coder or broken-container override merely to suppress an underlying fault. Follow site quality/safety authorization for any override use.";

    const connectorInputs = Object.freeze([3, 8, 13, 19, 24, 29]);
    const dataInputs = Object.freeze([0, 5, 10, 16, 21, 26]);
    const connectorPages = Object.freeze([198, 204, 210, 216, 222, 228]);

    const ss501Trace = process(
      "setup-mode-switch-state-bound-with-source-polarity-conflict",
      "exact-plc-producer-and-exact-device-with-conflicting-drawing-annotation",
      "Machine_Jumps / operating mode",
      [
        "E0901_SS501_OperatingMode = I0010.1",
        "XIO(E0901_SS501_OperatingMode) OTE(Faults_LB1[4].0)",
        "PLC tag description: Low = Setup / High = Run"
      ],
      [
        { label: "PLC fault semantics", value: "Fault 064 is true when E0901_SS501_OperatingMode/I0010.1 is false because the rung uses XIO." },
        { label: "PLC tag description", value: "The readable L5K explicitly documents Low = Setup and High = Run." },
        { label: "Drawing conflict", value: "K407039 page 73 labels the same SS501 circuit 'production = 0 / set-up mode = 1', which conflicts with the PLC tag/rung semantics." },
        { label: "ServoForge authority", value: "For live Fault 064 interpretation, ServoForge follows the executable PLC rung and tag description and exposes the drawing polarity note as conflicting source evidence." }
      ],
      [{ device: "SS501", description: "Operating-mode selector switch", area: "=EMB1.0901 +KK2", cable: ".0901-W201", terminals: "TB52 -> I/O042 I0010.01" }],
      [{ pdfPage: 73, sheet: "73/277", section: "SS501 operating-mode selector input" }],
      "Fault 064 is an operating-mode state, not evidence that a machine component failed. In the executable LB1 PLC it is asserted when SS501/I0010.1 is low, which the L5K tag identifies as Setup. The supplied drawing carries the opposite textual polarity annotation; ServoForge keeps that discrepancy visible rather than silently choosing the drawing wording.",
      stationBoundary,
      "Do not troubleshoot Fault 064 as an electrical failure unless the physical selector position and PLC input disagree. If they disagree, diagnose SS501/I0010.1 and its circuit rather than changing logic to match the drawing note."
    );

    const ss501Circuit = circuit(
      "machine-specific-operating-mode-selector-bound-with-source-conflict",
      "exact-k407039-device-and-plc-alias",
      ["E0901_SS501_OperatingMode = I0010.1"],
      [{ device: "SS501", description: "Operating-mode selector switch", area: "=EMB1.0901 +KK2", cable: ".0901-W201", terminals: "TB52 -> I/O042 I0010.01" }],
      [{ pdfPage: 73, sheet: "73/277", section: "SS501 operating-mode selector" }],
      "SS501 and I0010.01 are an exact drawing/PLC hardware match. The drawing's production/setup polarity annotation conflicts with the L5K tag description and executable Fault 064 rung; that conflict is preserved as source metadata rather than resolved by assumption.",
      stationBoundary,
      "Executable PLC behavior is the authority for whether Fault 064 is active in this software revision."
    );

    function stationConnectorProcess(station) {
      const fault = 67 + station;
      const input = connectorInputs[station - 1];
      return process(
        "shared-station-plug-connected-supervision-bound",
        "exact-labeler-plc-producer-and-k407039-station-interface",
        "LabelingStation_Jumps",
        [
          `E975${station}_Agg${station}_I4_Connected = I0012.${input}`,
          "XIO(E975x_M_LabelingStationChangeMode)",
          `XIO(E975${station}_Agg${station}_I4_Connected)`,
          `OTE(Faults_LB1[${Math.floor(fault / 16)}].${fault % 16})`,
          "OTL(E1201_C301_LabelingStationChange)",
          "OTU(Control.EnableMachineOn)"
        ],
        [
          { label: "Normal supervision", value: "The six station-interface rungs are evaluated while Labeling Station Change Mode is OFF." },
          { label: "Fault condition", value: `Station ${station} Plug Connected input E975${station}_Agg${station}_I4_Connected/I0012.${input} is false.` },
          { label: "Machine response", value: "The PLC asserts the station Connector Open alarm, unlatches Machine On enable and latches the station-change relay/state." },
          { label: "Change-mode behavior", value: "Station Change Mode intentionally suppresses the normal station-interface rung while carts are being changed." }
        ],
        [{ device: `Station ${station} plug / fitted feedback`, description: `Labeling Station ${station} fitted/plug-connected feedback`, area: `=EMB1.975${station}`, cable: `station ${station} interface`, terminals: `I0012.${String(input).padStart(2, "0")}` }],
        [{ pdfPage: connectorPages[station - 1], sheet: `${connectorPages[station - 1]}/277`, section: `Labeling Station ${station} signal transmission / station fitted input` }],
        `Fault ${String(fault).padStart(3, "0")} is the Labeler-side Station ${station} connector-open condition. The same method is repeated for all six station positions; the instance-specific input and K407039 page change, but the diagnostic logic does not. Confirm whether the cart is intentionally in change mode before treating an open fitted/plug feedback as a wiring or connector problem.`,
        stationBoundary,
        "Shared Labeler-side Station method. Six duplicated troubleshooting trees are intentionally avoided."
      );
    }

    function stationConnectorCircuit(station) {
      const input = connectorInputs[station - 1];
      return circuit(
        "machine-specific-shared-station-plug-interface-bound",
        "exact-k407039-station-instance",
        [`E975${station}_Agg${station}_I4_Connected = I0012.${input}`],
        [{ device: `Station ${station} fitted / plug-connected contact`, description: `Station ${station} connector-present feedback into the Labeler I/O`, area: `=EMB1.975${station}`, cable: `station ${station} interface harness`, terminals: `I/O062 I0012.${String(input).padStart(2, "0")}` }],
        [{ pdfPage: connectorPages[station - 1], sheet: `${connectorPages[station - 1]}/277`, section: `Labeling Station ${station} fitted / plug-connected signal` }],
        `K407039 provides a separate repeated signal-transmission sheet for Station ${station}; ServoForge uses the station instance only to substitute the verified input and drawing page.`,
        stationBoundary,
        "Do not jumper the fitted/plug feedback. Diagnose the connector, mating hardware and wiring under the approved safe-work procedure."
      );
    }

    function stationSyncProcess(station) {
      const fault = 641 + station;
      const dataInput = dataInputs[station - 1];
      return process(
        "shared-labeler-station-synchronization-summary-bound",
        "exact-labeler-aggregat-producer-cart1-cyclic-bit-semantics-only",
        "LabelingStation_Jumps -> Aggregat",
        [
          `XIO(DataFromLS[${station}].Par1[0].3)`,
          `E975${station}_Agg${station}_I1_Data = I0012.${dataInput}`,
          `OTE(Aggregat_0${station}.I_SynchronFault)`,
          "Aggregat_xx: XIC(I_SynchronFault) XIC(I_PowerOnReset) OTE(O_Fault[6])",
          `XIC(Aggregat_0${station}.O_Fault[6]) -> OTE(Faults_LB1[${Math.floor(fault / 16)}].${fault % 16})`
        ],
        [
          { label: "Labeler receive bit", value: `Station ${station} cyclic DataFromLS[${station}].Par1[0].3 is treated as the synchronization-healthy bit; the Labeler tests it false.` },
          { label: "Physical/data gate", value: `The Station ${station} Data input E975${station}_Agg${station}_I1_Data/I0012.${dataInput} must also be true before I_SynchronFault is asserted.` },
          { label: "Shared Aggregat method", value: "I_SynchronFault becomes O_Fault[6] after Power On Reset, and O_Fault[6] drives the Station Not Synchronized HMI alarm and removes Jog/Machine On." },
          { label: "Cart 1 source caveat", value: "The supplied readable Cart 1 program drives its outgoing DataFromLS.Par1[0].3 with Logic_1. Therefore Cart 1 does not transmit its internal Station Fault 031 through this bit in this revision." }
        ],
        [{ device: `Station ${station} cyclic/data interface`, description: `Labeler-side data-present input accompanying the cyclic synchronization bit`, area: `=EMB1.975${station}`, cable: `station ${station} signal / Level 3 communication`, terminals: `Data input I0012.${String(dataInput).padStart(2, "0")}; cyclic DataFromLS[${station}].Par1[0].3` }],
        [{ pdfPage: connectorPages[station - 1], sheet: `${connectorPages[station - 1]}/277`, section: `Labeling Station ${station} data signal transmission` }],
        `Fault ${fault} is a Labeler-side synchronization summary produced by the shared Aggregat method. It does not prove a servo synchronization fault by itself. For Cart 1, the supplied station PLC forces the transmitted synchronization-health bit true with Logic_1, so this Labeler alarm path should be interpreted primarily as interface/cyclic-data evidence unless another station-specific fault provides the actual motion cause.`,
        stationBoundary,
        "The six Labeler-side instances are structurally identical. Cart-internal semantics are directly verified only for the supplied Cart 1 L5K.",
        CART_SOURCE
      );
    }

    function stationMagazineProcess(station) {
      const fault = 654 + station;
      const autoChange = Math.ceil(station / 2);
      return process(
        "shared-station-label-supply-summary-bound",
        "exact-labeler-aggregat-producer-cart1-transmit-semantics-only",
        "LabelingStation_Jumps -> Aggregat",
        [
          `DataFromLS[${station}].Par1[0].1 -> Aggregat_0${station}.I_LackOfLabel`,
          "Aggregat_xx: I_LackOfLabel + selected + PowerOnReset + EStopRelease -> O_Fault[1]",
          "Aggregat_xx: I_ContStopLock + selected + PowerOnReset + !Overload + !O_Fault[6] -> O_Fault[4]",
          `O_Fault[1] + O_Fault[4] -> Fault ${fault}`,
          `AutoChange_0${autoChange}.O_AutoChangeOn modifies warning/fault behavior`
        ],
        [
          { label: "Station report", value: `The Labeler receives Station ${station} lack-of-label state through DataFromLS[${station}].Par1[0].1.` },
          { label: "Shared fault qualification", value: "The shared Aggregat routine only promotes the HMI magazine-empty fault when lack-of-label O_Fault[1] is combined with close-container-stop O_Fault[4]. Otherwise it can remain a warning/state indication." },
          { label: "Autochange", value: `Stations ${autoChange * 2 - 1}/${autoChange * 2} share AutoChange_0${autoChange}; autochange state changes whether the condition is a warning or machine-stopping fault.` },
          { label: "Cart 1 transmit semantics", value: "In the supplied Cart 1 L5K, DataFromLS.Par1[0].1 is true for Warning 005 Low Labels, Fault 025 No labels/end of reel, ForceAutochange, or label-length autochange warning. The Labeler alarm therefore summarizes station label-supply/autochange state rather than one physical photoeye." }
        ],
        [],
        [],
        `Fault ${fault} is a shared Labeler-side label-supply summary for Station ${station}. Do not interpret it as proof that one specific end-of-reel sensor failed. The station report can represent low labels, no-label/end-of-reel or autochange-related states; the local Station diagnostics (especially Fault 025 / end-of-reel and its PE631/PE632 path) are more specific evidence.`,
        stationBoundary,
        "One shared method covers Stations 1-6. Use the exact station-local fault/history to decide which label-supply sensor or web condition to inspect."
      );
    }

    function stationNotReadyProcess(station) {
      const fault = 662 + station;
      const dataInput = dataInputs[station - 1];
      return process(
        "shared-station-not-ready-summary-and-communication-fallback-bound",
        "exact-labeler-aggregat-producer",
        "LabelingStation_Jumps -> Aggregat",
        [
          `DataFromLS[${station}].Par1[0].0 -> Aggregat_0${station}.I_Ready`,
          "Aggregat_xx.T_NotReady.PRE = 10000",
          "Aggregat_xx.O_Fault[5] = delayed/persistent not-ready condition",
          `E975${station}_Agg${station}_I1_Data = I0012.${dataInput}`,
          `ETH_ComSend[${station}].O_ReadyForETHConnect_L3`,
          `[O_Fault[5] OR (Data input AND !ReadyForETHConnect_L3)] -> Fault ${fault}`
        ],
        [
          { label: "Ready source", value: `Station ${station} cyclic DataFromLS[${station}].Par1[0].0 feeds the shared Aggregat I_Ready input.` },
          { label: "Not-ready timer", value: "The shared Aggregat routine uses a 10,000 ms T_NotReady preset and also retains the fault while the aggregate remains selected/on/main-drive-enabled until reset/recovery conditions are met." },
          { label: "Communication fallback", value: `The Labeler can also assert Fault ${fault} when the physical Station ${station} Data input is present but ETH_ComSend[${station}].O_ReadyForETHConnect_L3 is false.` },
          { label: "Diagnostic interpretation", value: "Not Ready is therefore a summary/state alarm. Look for the station-local fault or communication condition that occurred first before troubleshooting the summary itself." }
        ],
        [{ device: `Station ${station} data / cyclic interface`, description: `Physical data-present plus Level 3 cyclic communication used by the Not Ready summary`, area: `=EMB1.975${station}`, cable: `station ${station} interface / Level 3 Ethernet`, terminals: `I0012.${String(dataInput).padStart(2, "0")} + ETH_ComSend[${station}]` }],
        [{ pdfPage: connectorPages[station - 1], sheet: `${connectorPages[station - 1]}/277`, section: `Labeling Station ${station} data signal` }],
        `Fault ${fault} is intentionally treated as a downstream Station ${station} readiness summary. The Labeler can reach it from the shared 10-second aggregate Not Ready state or from a data-present / Level 3-connection-not-ready condition. ServoForge should route the technician toward specific local station or communication faults first.`,
        stationBoundary,
        "Shared Labeler-side method; station instance changes only the data block, I/O alias, ETH_ComSend index and drawing page."
      );
    }

    const staticProcess = Object.freeze({
      64: ss501Trace,
      67: process(
        "hmi-commanded-station-change-mode-state-bound",
        "exact-labeler-plc-state-machine",
        "LabelingStationChangeMode",
        [
          "Buffered_Data_From_HMI[127].15 + StartStop.ZeroSpeed -> OTL(E975x_M_LabelingStationChangeMode)",
          "Buffered_Data_From_HMI[127].14 -> OTU(E975x_M_LabelingStationChangeMode)",
          "XIC(E975x_M_LabelingStationChangeMode) -> Faults_LB1[4].3",
          "OTU(Control.EnableMachineJog)",
          "OTU(Control.EnableMachineOn)",
          "OTL(E1201_C301_LabelingStationChange)"
        ],
        [
          { label: "Entry", value: "The HMI station-change request can latch the mode only when StartStop.ZeroSpeed is true." },
          { label: "Active state", value: "While E975x_M_LabelingStationChangeMode is true, Fault 067 is displayed, Machine Jog and Machine On enables are removed, and the station-change relay/state is latched." },
          { label: "Exit", value: "The separate HMI change-mode-off command unlatches E975x_M_LabelingStationChangeMode." }
        ],
        [],
        [],
        "Fault 067 is an intentional Labeling Station Change Mode state, not a hardware failure. If it appears unexpectedly, verify the HMI change-mode command/state and zero-speed sequence rather than replacing station hardware.",
        stationBoundary,
        "This alarm intentionally inhibits normal station operation while a labeling station is being changed."
      ),
      80: process(
        "inspection-override-state-bound",
        "exact-labeler-plc-output-state",
        "Inspection",
        ["Inspection_01.O_FaultOverrideOn", "OTE(Faults_LB1[5].0)", "Data_To_HMI_Labeler85_1[380].13"],
        [{ label: "Meaning", value: "Fault 080 follows the Inspection routine's active fault-override output." }],
        [], [],
        "Fault 080 is an informational/quality state showing that label inspection fault handling is overridden. Diagnose the reason the override was enabled and the underlying inspection condition; do not treat the override indicator itself as failed hardware.",
        overrideBoundary,
        "Quality/inspection override state; not a root-cause hardware fault."
      ),
      81: process(
        "laser-coder-override-state-bound",
        "exact-labeler-plc-output-state",
        "LaserCoder",
        ["Laser_01.O_FaultOverride", "OTE(Faults_LB1[5].1)", "Data_To_HMI_Labeler85_1[380].15"],
        [{ label: "Meaning", value: "Fault 081 follows the LaserCoder routine's active fault-override output." }, { label: "Downstream use", value: "Other warning/test logic uses Fault 081 as an inhibit, so the override state can suppress additional coder-related indications." }],
        [], [],
        "Fault 081 means Laser Coder fault handling is overridden. It is an operating-state indicator, not evidence that the coder or Labeler I/O failed. Restore normal fault handling under the approved quality/controls procedure and diagnose the underlying coder condition.",
        overrideBoundary,
        "Do not use the override to mask a persistent coder fault."
      ),
      82: process(
        "broken-container-detection-override-state-bound",
        "exact-labeler-plc-output-state",
        "ContainerBroken",
        ["ContBroken.O_OverrideOnMMI", "OTE(Faults_LB1[5].2)", "Data_To_HMI_Labeler85_1[380].1"],
        [{ label: "Meaning", value: "Fault 082 follows the ContainerBroken routine's HMI override-active output." }, { label: "Underlying system", value: "The actual broken-container detection fault remains Fault 678 and uses P181/P182/P183 tracking evidence from v340." }],
        [], [],
        "Fault 082 means the broken-container detection function is overridden. It is not the same as Fault 678 Broken Container Detected. Treat 678 and its P181/P182/P183 tracking logic as the actual detection fault path.",
        overrideBoundary,
        "Do not leave broken-container detection overridden to avoid nuisance trips; restore and diagnose the detector/tracking system under site quality/safety rules."
      )
    });

    const SOURCE_GAPS = Object.freeze({
      648: Object.freeze({ status: "named-alarm-no-producer-in-supplied-lb1", reason: "Fault 648 'Glideliner Fault' is named in the LB1 alarm table, but Faults_LB1[40].8 has no producer occurrence anywhere in the supplied readable Labeler L5K. ServoForge keeps it searchable but does not invent a Glideliner input or circuit." })
    });

    function stationFromGroup(number, first, last) {
      return number >= first && number <= last ? number - first + 1 : 0;
    }

    function buildTrace(entry) {
      const n = Number(entry?.number);
      if (staticProcess[n]) return { processTrace: staticProcess[n], ...(n === 64 ? { circuitTrace: ss501Circuit } : {}) };
      let station = stationFromGroup(n, 68, 73);
      if (station) return { processTrace: stationConnectorProcess(station), circuitTrace: stationConnectorCircuit(station) };
      station = stationFromGroup(n, 642, 647);
      if (station) return { processTrace: stationSyncProcess(station) };
      station = stationFromGroup(n, 649, 654);
      if (station) {
        return {
          processTrace: process(
            "shared-generic-station-malfunction-input-with-hmi-output-disabled",
            "exact-labeler-aggregat-producer-and-logic0-gate",
            "LabelingStation_Jumps -> Aggregat",
            [
              `XIO(E975${station}_Agg${station}_I3_NoMalfunction) -> Aggregat_0${station}.I_Malfunction`,
              "Aggregat_xx: I_Malfunction + selected + PowerOnReset + EStopRelease -> O_Fault[2]",
              `XIC(Aggregat_0${station}.O_Fault[2]) XIC(Logic_0) OTE(Fault ${n})`,
              "O_Fault[2] still removes Jog/Machine On when autochange is not active"
            ],
            [
              { label: "Real internal condition", value: `Station ${station} No Malfunction feedback can create the shared Aggregat O_Fault[2] malfunction state.` },
              { label: "HMI alarm gate", value: `The only producer for generic Fault ${n} additionally requires Logic_0, so this named HMI bit cannot energize in the supplied LB1 revision.` },
              { label: "Machine behavior", value: "The underlying O_Fault[2] remains operationally meaningful and can still inhibit machine operation even though the generic HMI fault output is disabled." }
            ],
            [{ device: `Station ${station} No Malfunction feedback`, description: `Station ${station} interface health input`, area: `=EMB1.975${station}`, cable: `station ${station} interface`, terminals: `E975${station}_Agg${station}_I3_NoMalfunction` }],
            [{ pdfPage: connectorPages[station - 1], sheet: `${connectorPages[station - 1]}/277`, section: `Labeling Station ${station} signal transmission` }],
            `Fault ${n} is a named generic station-malfunction alarm whose HMI output is disabled by Logic_0 in this LB1 revision. The underlying station malfunction state is real and still affects machine operation, so ServoForge routes technicians to the specific Station ${station} local faults rather than treating ${n} as an active root-cause alarm.`,
            stationBoundary,
            "Named HMI alarm path disabled; underlying station malfunction input remains real."
          ),
          sourceGap: Object.freeze({ status: "hmi-output-disabled-by-logic0-in-supplied-lb1", reason: `Fault ${n} requires XIC(Logic_0) in its only HMI producer. The underlying Aggregat_0${station}.O_Fault[2] malfunction state remains active and should be diagnosed through the specific station fault set.` })
        };
      }
      station = stationFromGroup(n, 655, 660);
      if (station) return { processTrace: stationMagazineProcess(station) };
      station = stationFromGroup(n, 663, 668);
      if (station) return { processTrace: stationNotReadyProcess(station) };
      return {};
    }

    function roleFor(entry) {
      const n = Number(entry?.number);
      if ([64, 67, 80, 81, 82].includes(n)) return evidence("Operating state / override", "operating-state", "secondary", "Operating-state indicator", entry.processTrace?.producerSignals || [], entry.processTrace?.summary || "Operating-state indication.", 90);
      if (n >= 68 && n <= 73) return evidence("LabelingStation_Jumps", "direct-station-interface-input", "primary", "Station connector state", entry.processTrace?.producerSignals || [], entry.processTrace?.summary || "Station connector state.", 12);
      if (n >= 642 && n <= 647) return evidence("LabelingStation_Jumps -> Aggregat", "station-synchronization-summary", "secondary", "Station synchronization summary", entry.processTrace?.producerSignals || [], entry.processTrace?.summary || "Synchronization summary.", 55);
      if (n >= 649 && n <= 654) return evidence("LabelingStation_Jumps -> Aggregat", "generic-malfunction-output-disabled", "disabled", "HMI output disabled", entry.processTrace?.producerSignals || [], entry.processTrace?.summary || "Disabled generic fault.", 100, "logic0-disabled-hmi-output");
      if (n >= 655 && n <= 660) return evidence("LabelingStation_Jumps -> Aggregat", "label-supply-summary", "supervision", "Station label-supply summary", entry.processTrace?.producerSignals || [], entry.processTrace?.summary || "Label supply summary.", 45);
      if (n >= 663 && n <= 668) return evidence("LabelingStation_Jumps -> Aggregat", "station-not-ready-summary", "secondary", "Station readiness summary", entry.processTrace?.producerSignals || [], entry.processTrace?.summary || "Not-ready summary.", 70);
      return null;
    }

    function isLabelerEntry(entry) {
      return Boolean(entry?.plcFault) && entry.diagnosticScope !== "Station";
    }

    function enrich(entry) {
      if (!isLabelerEntry(entry)) return entry;
      const n = Number(entry.number);
      if (SOURCE_GAPS[n]) return Object.freeze({ ...entry, sourceGap: SOURCE_GAPS[n] });
      const details = buildTrace(entry);
      if (!details.processTrace && !details.circuitTrace && !details.sourceGap) return entry;
      const candidate = Object.freeze({ ...entry, ...details });
      const rung = roleFor(candidate);
      return Object.freeze({ ...candidate, ...(rung ? { labelerRungEvidence: rung } : {}) });
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);
    const getTopModulFaultRelations = (value, limit = 10) => base.getTopModulFaultRelations(value, limit).map(enrich);
    const getTopModulFirstFaultCandidates = (value, limit = 8) => base.getTopModulFirstFaultCandidates(value, Math.max(16, Number(limit) || 8)).map(enrich)
      .filter((candidate) => candidate?.labelerRungEvidence?.rootLikelihood !== "disabled")
      .slice(0, Math.max(1, Number(limit) || 8));

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
        firstFaultCandidates: getTopModulFirstFaultCandidates(entry, Math.min(8, Math.max(4, Number(limit) || 8))),
        circuitTrace: entry.circuitTrace || original.circuitTrace || null,
        processTrace: entry.processTrace || original.processTrace || null,
        sourceGap: entry.sourceGap || original.sourceGap || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const f64 = getTopModulFault(64);
      if (!f64?.processTrace?.producerSignals?.includes("E0901_SS501_OperatingMode = I0010.1")) errors.push("Fault 064 lost SS501/I0010.1 evidence.");
      if (!/conflict/i.test(f64?.processTrace?.status || "")) errors.push("Fault 064 must retain the PLC/drawing polarity conflict.");
      if (!f64?.circuitTrace?.drawingLocations?.some((row) => Number(row.pdfPage) === 73)) errors.push("Fault 064 lost K407039 page 73 evidence.");
      const f67 = getTopModulFault(67);
      if (!f67?.processTrace?.producerSignals?.some((s) => s.includes("StartStop.ZeroSpeed"))) errors.push("Fault 067 lost zero-speed station-change entry evidence.");
      for (let station = 1; station <= 6; station += 1) {
        const connector = getTopModulFault(67 + station);
        if (!connector?.processTrace?.producerSignals?.some((s) => s.includes(`E975${station}_Agg${station}_I4_Connected`))) errors.push(`Station ${station} connector fault lost I4 connected evidence.`);
        if (!connector?.circuitTrace?.drawingLocations?.some((row) => Number(row.pdfPage) === connectorPages[station - 1])) errors.push(`Station ${station} connector fault lost its drawing page.`);
        const sync = getTopModulFault(641 + station);
        if (!sync?.processTrace?.producerSignals?.some((s) => s.includes(`DataFromLS[${station}].Par1[0].3`))) errors.push(`Station ${station} synchronization summary lost cyclic bit evidence.`);
        const generic = getTopModulFault(648 + station);
        if (generic?.labelerRungEvidence?.rootLikelihood !== "disabled" || !generic?.sourceGap) errors.push(`Generic Station ${station} fault must remain Logic_0-disabled at the HMI output.`);
        const magazine = getTopModulFault(654 + station);
        if (!magazine?.processTrace?.producerSignals?.some((s) => s.includes(`DataFromLS[${station}].Par1[0].1`))) errors.push(`Station ${station} magazine summary lost label-supply cyclic bit.`);
        const notReady = getTopModulFault(662 + station);
        if (!notReady?.processTrace?.producerSignals?.includes("Aggregat_xx.T_NotReady.PRE = 10000")) errors.push(`Station ${station} Not Ready lost 10-second supervision evidence.`);
      }
      if (!getTopModulFault(80)?.processTrace?.producerSignals?.includes("Inspection_01.O_FaultOverrideOn")) errors.push("Fault 080 lost inspection override evidence.");
      if (!getTopModulFault(81)?.processTrace?.producerSignals?.includes("Laser_01.O_FaultOverride")) errors.push("Fault 081 lost laser override evidence.");
      if (!getTopModulFault(82)?.processTrace?.producerSignals?.includes("ContBroken.O_OverrideOnMMI")) errors.push("Fault 082 lost broken-container override evidence.");
      const f648 = getTopModulFault(648);
      if (!f648?.sourceGap || f648?.processTrace) errors.push("Fault 648 Glideliner must remain named but unpromoted in the supplied LB1 revision.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+labeler-operating-state-v1`,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      getTopModulProcessTrace,
      topModulLabelerOperatingStateFaults: Object.freeze([64, 67, 68, 69, 70, 71, 72, 73, 80, 81, 82, 642, 643, 644, 645, 646, 647, 649, 650, 651, 652, 653, 654, 655, 656, 657, 658, 659, 660, 663, 664, 665, 666, 667, 668]),
      topModulLabelerOperatingStateSourceGaps: Object.freeze([648, 649, 650, 651, 652, 653, 654]),
      validate
    });
  };
});
