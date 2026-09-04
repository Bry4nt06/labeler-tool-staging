"use strict";

(function installTopModulStationCommunicationCircuit(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationCommunicationCircuitExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getStationFaultTemplate || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Station circuit layers are required before communication tracing.");
    }

    const SOURCE = base.getTopModulCircuitSource("apl-cart-k605163");
    if (!SOURCE) throw new Error("K605163 APL Cart circuit source is required.");

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

    const ETHERNET_SLOT_1 = Object.freeze({
      device: "COM231 / 1756-ENBT/A Slot 1",
      description: "Cart Ethernet Level 1 communication module",
      area: "+KA",
      cable: ".0501-W231",
      terminals: "COM231 RJ45 / CN231 -> CN131 A1-A4; Belden 1752A UTP"
    });
    const ETHERNET_SLOT_2 = Object.freeze({
      device: "COM271 / 1756-ENBT/A Slot 2",
      description: "Cart Ethernet Level 3 / base-machine communication module",
      area: "+KA",
      cable: ".0501-W271",
      terminals: "COM271 RJ45 / CN271 -> CN131 B1-B4; Belden 1752A UTP"
    });
    const ETHERNET_SLOT_4 = Object.freeze({
      device: "COM291 / 1756-ENBT/A Slot 4",
      description: "PanelView Ethernet communication module",
      area: "+KA",
      cable: ".0501-W291",
      terminals: "COM291 RJ45 / CN291 -> MMI102 CN101; Belden 1588A"
    });
    const PANELVIEW = Object.freeze({
      device: "MMI102 / PanelView",
      description: "Cart touchscreen node under Ethernet_IO_2",
      area: "+BP",
      cable: ".0501-W291",
      terminals: "PV_LB_Node0 configured at 10.107.204.192; parent ENBT configured at 10.107.204.191"
    });
    const OUTPUT_MODULE = Object.freeze({
      device: "I/O041 / 1756-OB16E Slot 7",
      description: "16-point electronically fused digital output module",
      area: "+KA",
      cable: "O0007.00-O0007.15 field-output branches",
      terminals: "Node0Slot7; module reports Local:7:I.FuseBlown bitmask"
    });
    const MOTION_MODULE = Object.freeze({
      device: "COM081 / 1756-M08SE Slot 12",
      description: "SERCOS motion interface for MainDriveAxis",
      area: "+KA",
      cable: "W111 / W112 fiber",
      terminals: "COM081 Tx/Rx <-> AFD101; MainDriveAxis SERCOS Node 1"
    });
    const ENCODER_MODULE = Object.freeze({
      device: "I/O071 / 1756-M02AE Slot 11 Ch0",
      description: "Base-machine feedback-only AQB encoder axis module",
      area: "+KA",
      cable: ".2001-W131",
      terminals: "BaseMachineEncoderAxis -> EEP_APL_Slot11:Ch0"
    });

    const COMM = Object.freeze({
      11: circuit(
        "machine-specific-module-gsv-and-cable-bound",
        "exact-cart-plc-k605163-module-match",
        [
          "GSV(MODULE,HMI_Communications,FaultCode,EthernetModuleSlot1FaultData)",
          "HMI_Communications",
          "EthernetModuleSlot1FaultData",
          "Faults[0].11"
        ],
        [ETHERNET_SLOT_1],
        [
          { pdfPage: 29, sheet: "05/72", section: "PLC rack structure - 1756-ENBT Slot 1 / COM231" },
          { pdfPage: 36, sheet: "23/72", section: "COM231 Ethernet Level 1 wiring" },
          { pdfPage: 57, sheet: "03/72", section: "W231 to base-machine CN131 A1-A4" }
        ],
        "Cart Fault 011 is a local module-health alarm. The PLC performs a MODULE GSV on tag HMI_Communications and sets Faults[0].11 when EthernetModuleSlot1FaultData is non-zero. K605163 identifies the physical Slot 1 module as COM231, a 1756-ENBT Level 1 interface on cable .0501-W231. The PLC tag name HMI_Communications is retained as a naming exception because the drawing calls this module Ethernet Level 1, not the PanelView interface.",
        "Ethernet troubleshooting should begin with module status/LEDs, connector seating and network-path integrity under normal safe-access rules. Do not reset, readdress or replace a communication module solely to clear an alarm without preserving the machine network configuration.",
        "Shared Station method. Fault 011 means the Slot 1 ENBT module itself reports a non-zero fault code; it is not the same condition as loss of base-machine cyclic communication in Fault 014."
      ),
      12: circuit(
        "machine-specific-module-gsv-and-cable-bound",
        "exact-cart-plc-k605163-module-match",
        [
          "GSV(MODULE,Ethernet_IO_1,FaultCode,EthernetModuleSlot2FaultData)",
          "Ethernet_IO_1",
          "EthernetModuleSlot2FaultData",
          "Faults[0].12"
        ],
        [ETHERNET_SLOT_2],
        [
          { pdfPage: 29, sheet: "05/72", section: "PLC rack structure - 1756-ENBT Slot 2 / COM271" },
          { pdfPage: 37, sheet: "24/72", section: "COM271 Ethernet Level 3 wiring" },
          { pdfPage: 58, sheet: "04/72", section: "W271 to base-machine CN131 B1-B4" }
        ],
        "Cart Fault 012 is the hardware/module-health alarm for Ethernet_IO_1. A non-zero GSV FaultCode from the 1756-ENBT in Slot 2 sets Faults[0].12. K605163 maps that module to COM271 and .0501-W271, the Level 3 connection toward the base machine.",
        "Treat this as a controller/network-module condition first. Verify module state and physical Ethernet path before changing IP configuration. Network configuration changes should be made only by personnel who can restore the validated machine addressing.",
        "Fault 012 and Fault 014 share the COM271/W271 physical path but have different producers: 012 is a local ENBT module fault; 014 is loss of the application-level base-machine connection/state."
      ),
      13: circuit(
        "machine-specific-module-gsv-and-panelview-path-bound",
        "exact-cart-plc-k605163-module-match",
        [
          "GSV(MODULE,Ethernet_IO_2,FaultCode,EthernetModuleSlot4FaultData)",
          "Ethernet_IO_2",
          "EthernetModuleSlot4FaultData",
          "PV_LB_Node0",
          "Faults[0].13"
        ],
        [ETHERNET_SLOT_4, PANELVIEW],
        [
          { pdfPage: 29, sheet: "05/72", section: "PLC rack structure - 1756-ENBT Slot 4 / COM291" },
          { pdfPage: 38, sheet: "29/72", section: "COM291 PanelView Ethernet wiring to MMI102" }
        ],
        "Cart Fault 013 is the Slot 4 ENBT module-health alarm. The L5K identifies Ethernet_IO_2 as a 1756-ENBT/A in Slot 4 at 10.107.204.191 with child PanelView node PV_LB_Node0 at 10.107.204.192. K605163 maps the hardware to COM291 and cable .0501-W291 to MMI102. This is the HMI network path, not the Level 3 base-machine path used by Fault 014.",
        "Do not change PanelView or ENBT addressing as a first response. Preserve known-good IP configuration and verify module/link state, cable and connector condition first.",
        "Shared Station method; the supplied Cart 1 revision provides exact module and PanelView-node addressing for this instance, while another validated cart revision could use different addresses."
      ),
      14: circuit(
        "machine-specific-application-communication-state-and-physical-path-bound",
        "exact-cart-plc-k605163-communication-match",
        [
          "ETH_Com.ReadyForETHConnect_L3",
          "ETH_Com.DataReceivedBaseMachine",
          "SM_Communication",
          "MSG_ReadCyclic",
          "MSG_WriteCyclic",
          "Ethernet_IO_1",
          "10.99.216.233",
          "Faults[0].14"
        ],
        [ETHERNET_SLOT_2, Object.freeze({
          device: "Configured base-machine controller path",
          description: "CIP data-table read/write target used by the Cart communication state machine",
          area: "Base machine",
          cable: ".0501-W271 through CN131",
          terminals: "MSG path Ethernet_IO_1, port 2, 10.99.216.233, backplane port 1, slot 0"
        })],
        [
          { pdfPage: 37, sheet: "24/72", section: "COM271 Level 3 Ethernet module" },
          { pdfPage: 58, sheet: "04/72", section: "W271 Level 3 physical connection to base machine" }
        ],
        "Cart Fault 014 is not a GSV hardware fault. It latches when ETH_Com.ReadyForETHConnect_L3 is lost and the communication state machine cannot maintain the base-machine connection. The same routine cycles MSG_ReadCyclic and MSG_WriteCyclic through Ethernet_IO_1 to the configured remote controller path 10.99.216.233. Therefore a healthy Slot 2 ENBT can coexist with Fault 014 if the remote controller, path, addressing or cyclic-message exchange is unavailable.",
        "Do not bypass this fault by forcing ReadyForETHConnect_L3 or cyclic-message status bits. Verify physical link first, then module health, validated addressing, remote-controller availability and message error/status information.",
        "Use Fault 012 to distinguish a local COM271/ENBT hardware fault from Fault 014 application-level loss of base-machine communication."
      ),
      15: circuit(
        "machine-specific-electronic-fuse-diagnostic-bound",
        "exact-cart-plc-k605163-output-module-match",
        [
          "Local:7:I.FuseBlown",
          "FuseResetMsg",
          "MSG_FuseResetOutputModule",
          "EEP_APL_Slot7",
          "1756-OB16E",
          "Faults[0].15"
        ],
        [OUTPUT_MODULE],
        [
          { pdfPage: 29, sheet: "05/72", section: "PLC rack structure - 1756-OB16E Slot 7 / I/O041" },
          { pdfPage: 31, sheet: "04/72", section: "I/O041 output channel assignment O0007.00-O0007.15" }
        ],
        "Cart Fault 015 is driven by the 1756-OB16E module's Local:7:I.FuseBlown diagnostic mask, not by one external circuit breaker. The PLC copies that mask into FuseResetMsg and issues MSG_FuseResetOutputModule only on a general reset. K605163 identifies I/O041 as the Slot 7 1756-OB16E and lists the field function on each O0007.00-O0007.15 channel. ServoForge keeps the module fuse mask separate from the downstream field circuit so the affected output branch can be isolated before blaming the module.",
        "Remove the cause of an output overcurrent/short before resetting an electronic fuse. Do not repeatedly reset a tripping channel. De-energize and apply the approved LOTO procedure before resistance/continuity checks; energized electrical measurements require qualified personnel.",
        "The current library does not infer the exact failed channel from the integer mask until the Rockwell module bit semantics are separately validated. It does preserve the raw FuseBlown value as the diagnostic starting point."
      ),
      16: circuit(
        "machine-specific-motion-group-state-bound",
        "exact-cart-plc-motion-configuration-match",
        [
          "MotionGroup.GroupSynced",
          "PowerOnReset",
          "BaseMachineEncoderAxis",
          "EEP_APL_Slot11:Ch0",
          "MainDriveAxis",
          "EEP_APL_Slot12",
          "Faults[1].0"
        ],
        [ENCODER_MODULE, MOTION_MODULE],
        [
          { pdfPage: 29, sheet: "05/72", section: "PLC rack structure - Slot 11 motion encoder module and Slot 12 SERCOS interface" },
          { pdfPage: 34, sheet: "08/72", section: "COM081 SERCOS interface to AFD101" }
        ],
        "Cart Fault 016 is a group-level motion state: after PowerOnReset, the PLC sets Faults[1].0 whenever MotionGroup.GroupSynced is false. Both BaseMachineEncoderAxis (Slot 11 Channel 0) and MainDriveAxis (Slot 12 SERCOS) belong to MotionGroup in this L5K. The fault therefore does not prove that either device is bad. Use the direct encoder-module faults 064-069 and servo/module faults 042-054 as higher-specificity evidence before replacing group hardware.",
        "Do not force GroupSynced or axis status bits. Prevent unexpected servo motion before hardware checks. Use controller motion diagnostics and direct module/axis fault status to determine which member is preventing synchronization.",
        "This is deliberately classified as a motion-group state rather than a single-component failure."
      )
    });

    function traceForEntry(entry) {
      if (!entry?.plcFault || entry.diagnosticScope !== "Station") return null;
      return COMM[Number(entry.stationTemplateOffset)] || null;
    }

    function enrich(entry) {
      if (!entry?.plcFault) return entry;
      const trace = traceForEntry(entry);
      return trace ? Object.freeze({ ...entry, circuitTrace: trace }) : entry;
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const getStationFaultTemplate = (offset) => enrich(base.getStationFaultTemplate(offset));
    const getStationFaultVariant = (offset, station) => enrich(base.getStationFaultVariant(offset, station));
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
      for (const offset of [11, 12, 13, 14, 15, 16]) {
        const trace = getStationFaultTemplate(offset)?.circuitTrace;
        if (!trace) errors.push(`Station communication offset ${offset} lost its circuit trace.`);
        if (trace?.source?.drawing !== "K605163-001") errors.push(`Station communication offset ${offset} lost K605163 provenance.`);
      }
      if (!getStationFaultTemplate(11)?.circuitTrace?.deviceRows?.some((row) => /COM231/.test(row.device))) errors.push("Fault 011 lost COM231 evidence.");
      if (!getStationFaultTemplate(12)?.circuitTrace?.deviceRows?.some((row) => /COM271/.test(row.device))) errors.push("Fault 012 lost COM271 evidence.");
      if (!getStationFaultTemplate(13)?.circuitTrace?.deviceRows?.some((row) => /COM291/.test(row.device))) errors.push("Fault 013 lost COM291 evidence.");
      if (!getStationFaultTemplate(14)?.circuitTrace?.plcSignals?.includes("ETH_Com.ReadyForETHConnect_L3")) errors.push("Fault 014 lost Level 3 connection-state evidence.");
      if (!getStationFaultTemplate(15)?.circuitTrace?.plcSignals?.includes("Local:7:I.FuseBlown")) errors.push("Fault 015 lost OB16E FuseBlown evidence.");
      if (!getStationFaultTemplate(16)?.circuitTrace?.plcSignals?.includes("MotionGroup.GroupSynced")) errors.push("Fault 016 lost MotionGroup GroupSynced evidence.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+station-communication-circuit-v1`,
      getEntry,
      getTopModulFault,
      getStationFaultTemplate,
      getStationFaultVariant,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      topModulStationCommunicationCircuitOffsets: Object.freeze([11, 12, 13, 14, 15, 16]),
      validate
    });
  };
});
