"use strict";

(function installTopModulLabelerDriveUtilitiesCircuit(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLabelerDriveUtilitiesCircuitExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Labeler circuit layers are required before drive/utilities tracing.");
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

    const electricalBoundary = "Prevent unexpected machine motion and follow site LOTO/stored-energy requirements before hands-on drive, motor, disconnect, contactor or wiring work. Energized electrical measurements are for qualified personnel using the approved electrical safe-work procedure.";

    const TRACES = Object.freeze({
      480: circuit(
        "machine-specific-main-drive-controller-and-hardware-bound",
        "exact-labeler-plc-k407039-drive-match",
        [
          "E2001_AFD101_MainDriveEnable",
          "DriveConETH_01.I_DriveEnable",
          "VSD85LB1_Node3:I.DriveStatus",
          "VSD85LB1_Node3:I.OutputFreq",
          "DriveConETH_01.O_MotOK",
          "DriveConETH_01.O_NoFault",
          "E2001_MS101_MainDriveOverload",
          "I0009.25",
          "Faults_LB1[30].0"
        ],
        [
          { device: "AFD101 / PF700 Main Drive", description: "Main-machine variable-frequency drive controlled through DriveConETH_01 / VSD85LB1 Node3", area: "+SK =EMB1.2001", cable: "Level 3 Ethernet / COM112; motor power .2001-W103", terminals: "Drive status/frequency from Node3; output U/V/W through C101 to MTR101" },
          { device: "MS101", description: "10-16 A main-drive motor safety/overload device", area: "+SK =EMB1.2001", cable: "main-drive power and feedback circuit", terminals: "Overload/permissive feedback E2001_MS101_MainDriveOverload = I0009.25" },
          { device: "MTR101", description: "5 HP three-phase main-machine motor", area: "+ET =EMB1.2001", cable: ".2001-W101 / drive output circuit", terminals: "AFD101/C101 U-V-W -> MTR101" },
          { device: "COM112 / VSD85LB1 Node3", description: "PF700 Level 3 Ethernet connection", area: "+SK =EMB1.2001", cable: ".2001-W111", terminals: "AFD101 RJ45 communication path; drawing identifies Node3" }
        ],
        [
          { pdfPage: 127, sheet: "127/277", section: "Main drive MS101, AFD101, C101 and MTR101 power/feedback circuit" },
          { pdfPage: 128, sheet: "128/277", section: "AFD101 operating inputs and COM112 / VSD85LB1 Node3 Level 3 interface" },
          { pdfPage: 43, sheet: "43/277", section: "Level 3 network overview identifies PF700 Main Drive" }
        ],
        "Fault 480 is produced from the PF700 main-drive controller state, not directly from the overload input alone. SpeedControl_Jumps feeds DriveConETH_01 from VSD85LB1 Node3; if O_MotOK or O_NoFault drops while the MS101 overload permissive remains made, Faults_LB1[30].0 is asserted and machine enable is removed. K407039 identifies AFD101 as the main drive, MS101 as its motor safety device, MTR101 as the 5 HP motor, and COM112/Node3 as the Level 3 drive interface. If Fault 486 is also active, determine whether MS101 actually opened before treating 480 as a drive-controller fault.",
        electricalBoundary,
        "This path separates drive-controller status from the common Motor Starter Overload summary. Read the drive/Node3 diagnostic state before replacing the VFD, motor or overload device."
      ),

      486: circuit(
        "machine-specific-multi-source-overload-summary-bound",
        "exact-labeler-plc-summary-with-partial-drawing-bindings",
        [
          "Faults_LB1[30].6",
          "E2001_MS101_MainDriveOverload",
          "E4101_MS101_ConveyorOverload",
          "E2101_MS101_HeightAdjOverload",
          "E8601_MS101_InfeedBlowoffOverload",
          "E0101_MS152_OverloadPowerSupply",
          "Laser_01.O_Overload",
          "ServoTable_01.O_Overload",
          "Aggregat_01.O_Overload ... Aggregat_06.O_Overload"
        ],
        [
          { device: "MS101 / main drive", description: "Main-drive overload/permissive source", area: "+SK =EMB1.2001", cable: "main-drive circuit", terminals: "E2001_MS101_MainDriveOverload = I0009.25" },
          { device: "MS101 / discharge conveyor", description: "Discharge-conveyor overload source", area: "+SK =EMB1.4101", cable: "discharge-conveyor circuit", terminals: "E4101_MS101_ConveyorOverload = I0009.29" },
          { device: "Additional overload producers", description: "Height adjustment, infeed blowoff, power-supply overload, Laser coder overload, Servo Bottle Table overload, and Station 1-6 aggregate overload outputs can all latch the same Fault 486 bit", area: "multiple Labeler subsystems", cable: "subsystem-specific", terminals: "Use accompanying fault/state to identify the actual producer before circuit tracing" }
        ],
        [
          { pdfPage: 127, sheet: "127/277", section: "Main-drive MS101 overload/permissive circuit" },
          { pdfPage: 169, sheet: "169/277", section: "Discharge-conveyor MS101 overload circuit" }
        ],
        "Fault 486 is a shared Motor Starter Overload summary, not a unique physical device. The readable Labeler PLC contains multiple independent producers that latch Faults_LB1[30].6, including all six aggregate overload outputs, discharge conveyor, height adjustment, infeed blowoff, Laser coder, Servo Bottle Table, power supply, and the main-drive MS101 input. ServoForge therefore does not route Fault 486 directly to one MS101. Start with the accompanying subsystem fault, the active overload input, or the event that occurred first; then follow that subsystem's verified circuit.",
        electricalBoundary,
        "Do not repeatedly reset a tripped overload. Determine which producer latched Fault 486 and inspect the protected load/circuit for the cause before reset."
      ),

      500: circuit(
        "machine-specific-discharge-drive-controller-and-hardware-bound",
        "exact-labeler-plc-k407039-drive-match",
        [
          "Conveyor.DriveEnable",
          "DriveConETH_02.I_DriveEnable",
          "VSD85LB1_Node4:I.DriveStatus",
          "VSD85LB1_Node4:I.OutputFreq",
          "DriveConETH_02.O_MotOK",
          "DriveConETH_02.O_NoFault",
          "E4101_MS101_ConveyorOverload",
          "I0009.29",
          "Faults_LB1[31].4"
        ],
        [
          { device: "AFD101 / PF70 Discharge Conveyor", description: "Discharge-conveyor variable-frequency drive controlled through DriveConETH_02 / VSD85LB1 Node4", area: "+SK =EMB1.4101", cable: "Level 3 Ethernet / COM112; motor power .4101-W103", terminals: "Drive status/frequency from Node4; output U/V/W through C101 to MTR101" },
          { device: "MS101", description: "6-10 A discharge-conveyor motor safety/overload device", area: "+SK =EMB1.4101", cable: "discharge-conveyor power circuit", terminals: "E4101_MS101_ConveyorOverload = I0009.29" },
          { device: "MTR101", description: "3 HP three-phase discharge-conveyor motor", area: "+TBB =EMB1.4101", cable: ".4101-W101 / drive output circuit", terminals: "AFD101/C101 U-V-W -> MTR101" },
          { device: "COM112 / VSD85LB1 Node4", description: "PF70 Level 3 Ethernet connection", area: "+SK =EMB1.4101", cable: ".4101-W111", terminals: "AFD101 RJ45 communication path; drawing identifies Node4" }
        ],
        [
          { pdfPage: 169, sheet: "169/277", section: "Discharge conveyor MS101, AFD101, C101 and MTR101 power/overload circuit" },
          { pdfPage: 170, sheet: "170/277", section: "Discharge-conveyor control and drive interface" },
          { pdfPage: 171, sheet: "171/277", section: "AFD101 Level 3 connection / VSD85LB1 Node4" },
          { pdfPage: 43, sheet: "43/277", section: "Level 3 network overview identifies PF70 Discharge Conveyor" }
        ],
        "Fault 500 is the discharge-conveyor drive-controller fault. The PLC feeds DriveConETH_02 from VSD85LB1 Node4 and asserts Faults_LB1[31].4 when O_MotOK or O_NoFault is false. The separate E4101_MS101_ConveyorOverload input is passed into the drive-control block, so an overload can contribute but Fault 500 is not itself the generic overload alarm. K407039 binds the path to AFD101/PF70, MS101, C101, MTR101 and the Node4 Level 3 interface.",
        electricalBoundary,
        "If Fault 486 accompanies Fault 500, inspect the E4101_MS101 overload state first. If the overload is healthy, use the PF70/Node4 drive diagnostic and network state as the stronger evidence."
      )
    });

    const SOURCE_GAPS = Object.freeze({
      641: "Fault 641 Low Air Pressure Infeed Worm is named in the Labeler alarm table, but the readable LB1 L5K contains no producer for Faults_LB1[40].1. The existing Fault 640 general-air path is verified to PS101/I0010.18; ServoForge does not reuse that circuit for Fault 641 without a producer."
    });

    function isLabelerEntry(entry) {
      return Boolean(entry?.plcFault) && entry.diagnosticScope !== "Station";
    }

    function traceForEntry(entry) {
      if (!isLabelerEntry(entry)) return null;
      return TRACES[Number(entry.number)] || null;
    }

    function sourceGapForEntry(entry) {
      if (!isLabelerEntry(entry)) return null;
      const reason = SOURCE_GAPS[Number(entry.number)];
      return reason ? Object.freeze({ status: "catalog-only-no-producer-in-supplied-lb1", reason }) : null;
    }

    function enrich(entry) {
      if (!entry?.plcFault) return entry;
      const trace = traceForEntry(entry);
      const sourceGap = sourceGapForEntry(entry);
      if (trace || sourceGap) {
        return Object.freeze({
          ...entry,
          ...(trace ? { circuitTrace: trace } : {}),
          ...(sourceGap ? { sourceGap } : {})
        });
      }
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

      const f480 = getTopModulFault(480)?.circuitTrace;
      if (!f480?.plcSignals?.includes("VSD85LB1_Node3:I.DriveStatus")) errors.push("Fault 480 lost Node3 drive-status evidence.");
      if (!f480?.deviceRows?.some((row) => /PF700/.test(row.device))) errors.push("Fault 480 lost PF700 main-drive evidence.");
      if (!f480?.deviceRows?.some((row) => row.device === "MS101" && /I0009\.25/.test(row.terminals))) errors.push("Fault 480 lost MS101/I0009.25 evidence.");

      const f486 = getTopModulFault(486)?.circuitTrace;
      if (!f486?.plcSignals?.includes("Aggregat_01.O_Overload ... Aggregat_06.O_Overload")) errors.push("Fault 486 lost shared Station overload evidence.");
      if (!/shared Motor Starter Overload summary/i.test(f486?.summary || "")) errors.push("Fault 486 must remain a multi-source summary.");

      const f500 = getTopModulFault(500)?.circuitTrace;
      if (!f500?.plcSignals?.includes("VSD85LB1_Node4:I.DriveStatus")) errors.push("Fault 500 lost Node4 drive-status evidence.");
      if (!f500?.deviceRows?.some((row) => /PF70 Discharge Conveyor/.test(row.device))) errors.push("Fault 500 lost PF70 discharge-drive evidence.");
      if (!f500?.deviceRows?.some((row) => /MTR101/.test(row.device) && /3 HP/.test(row.description))) errors.push("Fault 500 lost 3 HP MTR101 evidence.");

      if (!getTopModulFault(640)?.circuitTrace?.plcSignals?.includes("E1501_PS101_MachineAirPressure")) errors.push("Existing Fault 640 PS101 circuit evidence was lost.");
      const f641 = getTopModulFault(641);
      if (!f641?.sourceGap || f641?.circuitTrace) errors.push("Fault 641 must remain catalog-only with no invented PS101 circuit trace.");
      if (!getTopModulFault(482)?.circuitTrace || !getTopModulFault(490)?.circuitTrace) errors.push("Existing main-drive contactor/safety traces were lost.");

      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+labeler-drive-utilities-circuit-v1`,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      topModulLabelerDriveUtilityFaults: Object.freeze(Object.keys(TRACES).map(Number)),
      validate
    });
  };
});
