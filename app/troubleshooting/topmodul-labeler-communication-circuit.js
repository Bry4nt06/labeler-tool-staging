"use strict";

(function installTopModulLabelerCommunicationCircuit(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLabelerCommunicationCircuitExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Labeler circuit layers are required before communication tracing.");
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
    const evidence = (routine, logicType, rootLikelihood, roleLabel, producerSignals, logicSummary) => Object.freeze({
      routine,
      logicType,
      rootLikelihood,
      roleLabel,
      producerSignals: Object.freeze(producerSignals),
      logicSummary,
      evidenceStatus: "rung-condition-and-hardware-bound",
      firstFaultRank: rootLikelihood === "primary" ? 10 : rootLikelihood === "supervision" ? 30 : 60
    });

    const networkBoundary = "Use controller/module diagnostics before disturbing network hardware. Follow site LOTO/electrical safe-work requirements before opening enclosures, reseating backplane modules, or handling field wiring. Do not force communication-health bits or bypass machine interlocks to keep running.";
    const fuseBoundary = "Do not repeatedly reset an electronic-fuse/output-module fault. Identify the affected module/channel and downstream load first. Hands-on output wiring work requires the approved stopped/LOTO condition; energized electrical diagnostics are for qualified personnel only.";

    const TRACES = Object.freeze({
      160: circuit(
        "machine-specific-hmi-watchdog-and-level1-path-bound",
        "exact-labeler-plc-k407039-network-match",
        ["Buffered_Data_From_HMI[3].1", "E0901_Watchdog.I_ToggleBit", "Monitoring", "E0901_Watchdog.O_Error", "Faults_LB1[10].0"],
        [
          { device: "A101 / HMI", description: "Operator visualization computer/HMI on Level 1", area: "=.0501 +SK / =.0901 +KK2", cable: ".0501-W231 network path", terminals: "K407039 overview shows HMI IP 10.99.219.141 on Level 1" },
          { device: "COM232", description: "1756-ENBT/A HMI_Communications module, local chassis Slot 1", area: "=.0501 +SK", cable: ".0501-W231", terminals: "IP 10.99.219.31" },
          { device: "A204", description: "Level 1 external/network switch path between HMI and COM232", area: "=.0501 +SK", cable: ".0501-W231 / CN231", terminals: "Network path shown on K407039 Level 1 drawing" }
        ],
        [
          { pdfPage: 44, sheet: "44/277", section: "Level 1 HMI network — A101/A204/COM232 and W231" },
          { pdfPage: 63, sheet: "63/277", section: "HMI_Communications COM232, 1756-ENBT, IP 10.99.219.31" }
        ],
        "Fault 160 is an application-level HMI heartbeat/watchdog fault. DataToAndFromHMI_Jumps copies the HMI toggle bit into E0901_Watchdog; Monitoring asserts O_Error when the expected toggle communication is not maintained, and that drives Faults_LB1[10].0. This is not the same as Fault 161: the HMI can lose heartbeat while the Slot 1 ENBT remains electrically healthy, and Fault 161 can report a module fault independently of the HMI application heartbeat.",
        networkBoundary,
        "If Fault 161 is active too, start with the COM232 module/network state. If 161 is clear, keep the diagnosis on HMI runtime/data exchange, A204/W231 network path, and Level 1 connectivity before replacing COM232."
      ),
      161: circuit(
        "machine-specific-local-enbt-gsv-bound",
        "exact-labeler-plc-k407039-module-match",
        ["GSV(MODULE,HMI_Communications,FaultCode,EthernetModuleSlot1FaultData)", "EthernetModuleSlot1FaultData", "Faults_LB1[10].1"],
        [{ device: "COM232", description: "1756-ENBT/A HMI_Communications module, local chassis Slot 1", area: "=.0501 +SK", cable: ".0501-W231", terminals: "Slot 1; IP 10.99.219.31" }],
        [{ pdfPage: 63, sheet: "63/277", section: "COM232 HMI_Communications — local chassis Slot 1" }, { pdfPage: 44, sheet: "44/277", section: "Level 1 network and W231 path" }],
        "Fault 161 is produced directly from the Logix MODULE FaultCode GSV for HMI_Communications. Any non-zero EthernetModuleSlot1FaultData drives the alarm and requests the normal reset path. This is a module-status fault, not merely a missing PanelView/HMI heartbeat.",
        networkBoundary,
        "Use the ENBT/module diagnostic code and LEDs as the primary evidence. Fault 160 is the separate HMI heartbeat path."
      ),
      162: circuit(
        "machine-specific-local-enbt-gsv-bound",
        "exact-labeler-plc-k407039-module-match",
        ["GSV(MODULE,Interlocks_Labeler85_1,FaultCode,EthernetModuleSlot2FaultData)", "EthernetModuleSlot2FaultData", "Faults_LB1[10].2"],
        [{ device: "COM242", description: "1756-ENBT/A Interlocks_Labeler85_1 module, local chassis Slot 2 / Level 2", area: "=.0501 +SK", cable: ".0501-W241", terminals: "Slot 2; IP 10.99.218.31" }],
        [{ pdfPage: 48, sheet: "48/277", section: "Level 2 Interlock network — COM242 / W241" }, { pdfPage: 64, sheet: "64/277", section: "Interlocks_Labeler85_1 COM242, 1756-ENBT, IP 10.99.218.31" }],
        "Fault 162 is the direct module FaultCode GSV for the local Slot 2 Interlocks_Labeler85_1 ENBT. Keep it separate from Fault 224, which is an aggregate I/O-network communication summary using this module's FaultCode together with the Level 3 I/O module state.",
        networkBoundary,
        "If Fault 224 accompanies 162, Fault 162 is the more specific module diagnostic and should be investigated first."
      ),
      164: circuit(
        "machine-specific-local-enbt-gsv-bound",
        "exact-labeler-plc-k407039-module-match",
        ["GSV(MODULE,Ethernet_IO,FaultCode,EthernetModuleSlot4FaultData)", "EthernetModuleSlot4FaultData", "Faults_LB1[10].4"],
        [{ device: "COM261", description: "1756-ENBT/A Ethernet_IO module, local chassis Slot 4 / Level 3", area: "=.0501 +SK", cable: ".0501-W261", terminals: "Slot 4; IP 10.99.216.233" }],
        [{ pdfPage: 49, sheet: "49/277", section: "Level 3 I/O network overview — COM261 / W261" }, { pdfPage: 65, sheet: "65/277", section: "COM261 to remote rack COM262" }],
        "Fault 164 is the direct MODULE FaultCode GSV for the local Slot 4 Ethernet_IO ENBT. The remote-rack Node 1 fault (193) is intentionally suppressed by the PLC while Fault 164 is active, preventing the same upstream Level 3 loss from being reported as a separate remote-module root cause.",
        networkBoundary,
        "Treat 164 as upstream of the Level 3 remote rack when it is active. Do not start at remote output modules until the local Slot 4 ENBT is healthy."
      ),
      193: circuit(
        "machine-specific-remote-enbt-gsv-with-upstream-mask-bound",
        "exact-labeler-plc-k407039-module-match",
        ["GSV(MODULE,CP85LB1_Node1,FaultCode,EthernetModuleNode1FaultData)", "XIO(Faults_LB1[10].4)", "EthernetModuleNode1FaultData", "Faults_LB1[12].1"],
        [{ device: "COM262 / CP85LB1_Node1", description: "1756-ENBT/A Level 3 remote-rack communication module", area: "=.0501 expansion rack", cable: ".0501-W262", terminals: "Remote rack Slot 0; IP 10.99.216.234; upstream COM261 IP 10.99.216.233" }],
        [{ pdfPage: 49, sheet: "49/277", section: "Level 3 I/O COM261 ↔ COM262 overview" }, { pdfPage: 65, sheet: "65/277", section: "Expansion rack CP85LB1_Node1 COM262 / W262" }],
        "Fault 193 is the remote-rack Node 1 MODULE FaultCode. The rung includes XIO(Faults_LB1[10].4), so the PLC only reports 193 while the local Slot 4 Ethernet_IO fault 164 is not active. A 193 alarm therefore points more specifically toward COM262, W262, remote-rack power/backplane, or the remote module itself than toward the already-diagnosed local COM261 module.",
        networkBoundary,
        "If multiple remote-rack output faults occur together, check 193 and the remote-rack communication/power state before treating several output modules as simultaneous independent failures."
      ),
      224: circuit(
        "machine-specific-io-network-summary-bound",
        "exact-labeler-plc-summary-with-module-bindings",
        ["Interlock_Faultcode", "Ethernet_IO_Faultcode", "E2001_MS101_MainDriveOverload", "Faults_LB1[14].0"],
        [
          { device: "COM242", description: "Level 2 Interlocks ENBT contributing Interlock_Faultcode", area: "=.0501 +SK", cable: ".0501-W241", terminals: "Local Slot 2 / 10.99.218.31" },
          { device: "COM261", description: "Level 3 Ethernet_IO ENBT contributing Ethernet_IO_Faultcode", area: "=.0501 +SK", cable: ".0501-W261", terminals: "Local Slot 4 / 10.99.216.233" },
          { device: "MS101 permissive", description: "Main-drive overload/permissive is also present in the Fault 224 producer rung", area: "=.2001", cable: "main-drive feedback", terminals: "E2001_MS101_MainDriveOverload" }
        ],
        [{ pdfPage: 43, sheet: "43/277", section: "TopModul Ethernet network overview" }, { pdfPage: 64, sheet: "64/277", section: "COM242 Level 2" }, { pdfPage: 65, sheet: "65/277", section: "COM261 Level 3 / remote rack" }],
        "Fault 224 is an I/O Communication Fault summary, not a single network card. IO_Monitoring reads the Interlocks_Labeler85_1 and Ethernet_IO MODULE FaultCodes and uses those states in the Fault 224 producer, with the main-drive overload/permissive also present in the rung. When Fault 162 or 164 is active, use that more specific MODULE GSV alarm as the first diagnostic evidence rather than replacing hardware from the 224 summary alone.",
        networkBoundary,
        "ServoForge preserves the actual rung inputs rather than simplifying 224 into a generic 'Ethernet down' message."
      ),
      230: circuit(
        "machine-specific-level3-switch-fault-input-bound",
        "exact-labeler-plc-k407039-device-input-match",
        ["E0501_AIC282_FaultSwitchLevel3", "I0007.13", "Faults_LB1[14].6", "Control.EnableMachineOn", "Control.EnableMachineJog"],
        [{ device: "AIC282", description: "Cisco Ethernet Level 3 switch", area: "=.0501 +SK", cable: ".0501-W261 / .0501-W262 and Level 3 station/network links", terminals: "Switch fault output to PLC input I0007.13" }],
        [{ pdfPage: 49, sheet: "49/277", section: "AIC282 Level 3 switch with COM261/COM262" }, { pdfPage: 67, sheet: "67/277", section: "AIC282 24 V supply/network ports and fault input I0007.13" }],
        "Fault 230 is a direct field-input alarm from the Level 3 Cisco switch: E0501_AIC282_FaultSwitchLevel3 aliases I0007.13. When active, the PLC also removes Machine On and Jog enables. Diagnose AIC282 power/fault indication and the Level 3 network before chasing downstream station or remote-rack symptoms.",
        networkBoundary,
        "A switch fault can create many secondary communication symptoms. Use the AIC282 fault input and switch status as upstream evidence; do not reset downstream nodes repeatedly while the switch fault remains active."
      )
    });

    const OUTPUT_MODULES = Object.freeze({
      241: { slot: 1, device: "I/O081", reset: "MSG_FuseResetOutputModule1" },
      242: { slot: 2, device: "I/O082", reset: "MSG_FuseResetOutputModule2" },
      243: { slot: 3, device: "I/O101", reset: "MSG_FuseResetOutputModule3" },
      244: { slot: 4, device: "I/O102", reset: "MSG_FuseResetOutputModule4" },
      245: { slot: 5, device: "I/O121", reset: "MSG_FuseResetOutputModule5" },
      246: { slot: 6, device: "I/O122", reset: "MSG_FuseResetOutputModule6" }
    });

    function outputTrace(number) {
      const cfg = OUTPUT_MODULES[number];
      if (!cfg) return null;
      return circuit(
        "machine-specific-remote-output-module-fault-and-reset-bound",
        "exact-labeler-plc-k407039-module-match",
        [`CP85LB1_Node1:${cfg.slot}:I.Fault`, `Faults_LB1[15].${number - 240}`, cfg.reset, "ControlOut.ResetGeneral"],
        [{ device: `${cfg.device} / 1756-OB16E`, description: `Remote-rack digital output module CP85LB1_Node1 Slot ${cfg.slot}`, area: "=.0501 expansion rack", cable: "module-specific field outputs", terminals: `PLC module CP85LB1_Node1Slot${cfg.slot}; I.Fault monitored; reset message ${cfg.reset}` }],
        [{ pdfPage: 54, sheet: "54/277", section: `Expansion-rack overview — Slot ${cfg.slot} ${cfg.device}, 1756-OB16E` }, { pdfPage: 65, sheet: "65/277", section: "CP85LB1_Node1 remote-rack Ethernet path through COM262" }],
        `Fault ${number} is produced when CP85LB1_Node1 Slot ${cfg.slot} reports a non-zero I.Fault value. The installed module is a 1756-OB16E (${cfg.device}). The same rung removes Machine On/Jog and permits the normal ${cfg.reset} reset message only when Reset General is requested. Although the HMI calls this 'Electronic Fuse Tripped', the producer checks the module-level I.Fault word; use the module/channel diagnostics to identify the actual affected output before assuming a specific fuse/channel.`,
        fuseBoundary,
        "If several Faults 241-246 appear together, check Fault 193/164 and remote-rack power/communication first. One isolated slot fault should stay on that module and its downstream protected load."
      );
    }

    const EVIDENCE = Object.freeze({
      160: evidence("DataToAndFromHMI_Jumps / Monitoring", "watchdog-heartbeat", "primary", "Primary HMI data-exchange candidate", ["Buffered_Data_From_HMI[3].1", "E0901_Watchdog.I_ToggleBit", "E0901_Watchdog.O_Error"], "The visualization toggle bit is supervised by the Monitoring routine; watchdog error drives Fault 160."),
      161: evidence("IO_Monitoring", "module-faultcode-gsv", "primary", "Primary module diagnostic", ["HMI_Communications", "EthernetModuleSlot1FaultData"], "A non-zero MODULE FaultCode from local Slot 1 drives Fault 161."),
      162: evidence("IO_Monitoring", "module-faultcode-gsv", "primary", "Primary module diagnostic", ["Interlocks_Labeler85_1", "EthernetModuleSlot2FaultData"], "A non-zero MODULE FaultCode from local Slot 2 drives Fault 162."),
      164: evidence("IO_Monitoring", "module-faultcode-gsv", "primary", "Primary upstream Level 3 module diagnostic", ["Ethernet_IO", "EthernetModuleSlot4FaultData"], "A non-zero MODULE FaultCode from local Slot 4 drives Fault 164 and masks the downstream Node 1 module alarm."),
      193: evidence("IO_Monitoring", "remote-module-faultcode-gsv", "primary", "Primary remote-rack module diagnostic", ["CP85LB1_Node1", "EthernetModuleNode1FaultData", "XIO(Faults_LB1[10].4)"], "The remote Node 1 module FaultCode drives 193 only while local Slot 4 Fault 164 is clear."),
      224: evidence("IO_Monitoring", "io-network-summary", "secondary", "Summary/downstream communication alarm", ["Interlock_Faultcode", "Ethernet_IO_Faultcode", "E2001_MS101_MainDriveOverload"], "Fault 224 summarizes I/O-network module fault states; the specific Slot 2/Slot 4 MODULE alarms are stronger first evidence."),
      230: evidence("IO_Monitoring", "direct-field-input", "primary", "Primary Level 3 switch candidate", ["E0501_AIC282_FaultSwitchLevel3", "I0007.13"], "The AIC282 switch fault input directly drives Fault 230 and removes machine/jog enable.")
    });

    function isLabelerEntry(entry) {
      return Boolean(entry?.plcFault) && entry.diagnosticScope !== "Station";
    }

    function enrich(entry) {
      if (!isLabelerEntry(entry)) return entry;
      const number = Number(entry.number);
      const trace = TRACES[number] || outputTrace(number);
      const rung = EVIDENCE[number] || (OUTPUT_MODULES[number] ? evidence("OutputModuleFusing", "remote-output-module-fault-word", "primary", "Primary output-module diagnostic", [`CP85LB1_Node1:${OUTPUT_MODULES[number].slot}:I.Fault`, OUTPUT_MODULES[number].reset], `Remote output Slot ${OUTPUT_MODULES[number].slot} non-zero I.Fault drives Fault ${number}; the reset message is separate from diagnosis.`) : null);
      if (!trace && !rung) return entry;
      return Object.freeze({
        ...entry,
        ...(trace ? { circuitTrace: trace } : {}),
        ...(rung ? { labelerRungEvidence: rung } : {})
      });
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
        circuitTrace: entry.circuitTrace || original.circuitTrace || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      for (const number of [160, 161, 162, 164, 193, 224, 230, 241, 242, 243, 244, 245, 246]) {
        const entry = getTopModulFault(number);
        if (!entry?.circuitTrace) errors.push(`Labeler communication Fault ${number} lost circuit evidence.`);
        if (!entry?.labelerRungEvidence) errors.push(`Labeler communication Fault ${number} lost producer evidence.`);
        if (entry?.circuitTrace?.source?.drawing !== "K407039-001") errors.push(`Labeler communication Fault ${number} lost K407039 authority.`);
      }
      if (!getTopModulFault(160)?.labelerRungEvidence?.producerSignals?.includes("E0901_Watchdog.O_Error")) errors.push("Fault 160 lost HMI watchdog evidence.");
      if (!getTopModulFault(161)?.circuitTrace?.deviceRows?.some((row) => row.device === "COM232")) errors.push("Fault 161 lost COM232 evidence.");
      if (!getTopModulFault(162)?.circuitTrace?.deviceRows?.some((row) => row.device === "COM242")) errors.push("Fault 162 lost COM242 evidence.");
      if (!getTopModulFault(164)?.circuitTrace?.deviceRows?.some((row) => row.device === "COM261")) errors.push("Fault 164 lost COM261 evidence.");
      if (!getTopModulFault(193)?.labelerRungEvidence?.producerSignals?.includes("XIO(Faults_LB1[10].4)")) errors.push("Fault 193 lost upstream Slot 4 mask evidence.");
      if (getTopModulFault(224)?.labelerRungEvidence?.rootLikelihood !== "secondary") errors.push("Fault 224 must remain a communication summary.");
      if (!getTopModulFault(230)?.circuitTrace?.plcSignals?.includes("I0007.13")) errors.push("Fault 230 lost AIC282 input evidence.");
      for (const number of [241, 242, 243, 244, 245, 246]) {
        const cfg = OUTPUT_MODULES[number];
        const trace = getTopModulFault(number)?.circuitTrace;
        if (!trace?.deviceRows?.some((row) => row.device.includes(cfg.device) && row.device.includes("1756-OB16E"))) errors.push(`Fault ${number} lost ${cfg.device}/1756-OB16E evidence.`);
        if (!trace?.plcSignals?.includes(cfg.reset)) errors.push(`Fault ${number} lost output-module reset-message provenance.`);
      }
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+labeler-communication-circuit-v1`,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      topModulLabelerCommunicationFaults: Object.freeze([160, 161, 162, 164, 193, 224, 230, 241, 242, 243, 244, 245, 246]),
      validate
    });
  };
});
