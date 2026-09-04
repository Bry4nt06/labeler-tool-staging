"use strict";

(function installTopModulStationServoCircuit(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationServoCircuitExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getStationFaultTemplate || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Station circuit layers are required before servo-axis tracing.");
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

    const COMMON = Object.freeze({
      drive: Object.freeze({ device: "AFD101 / MainDriveAxis", description: "Kinetix 6000 station servo drive, PLC SERCOS node 1", area: "+KA", cable: "SERCOS W111/W112", terminals: "PLC module EEP_APL_Slot12 1756-M08SE -> MainDriveAxis 2094-BC02-M02, Node 1" }),
      motor: Object.freeze({ device: "MTR101", description: "1.7 kW station labeling servo motor", area: "+AC", cable: "2001-W101", terminals: "AFD101 U/V/W -> MTR101 U/V/W; PE/shield shown on K605163 machine-drive sheet" }),
      feedback: Object.freeze({ device: "MTR101 motor feedback", description: "Servo motor feedback / commutation cable", area: "+AC", cable: "2001-W121", terminals: "CN121 conductors 1,2,3,4,5,10,7,11,9,15,14,6,13,8,12 -> AFD101 feedback connector" }),
      power: Object.freeze({ device: "F101 / F102 / F103", description: "Three 30 A station servo power fuses", area: "+KA", cable: "2001 main-drive power", terminals: "L1/L2/L3 -> F101/F102/F103 -> C101 -> AFD101 L1/L2/L3" }),
      control: Object.freeze({ device: "CB104", description: "6 A servo control-section supply protection", area: "+KA", cable: "2001 control supply", terminals: "CB104 -> AFD101 CTRL1" }),
      sercos: Object.freeze({ device: "COM081 / 1756-M08SE", description: "SERCOS interface module, Node0Slot12", area: "+KA", cable: "W111 / W112 fiber", terminals: "COM081 Rx/Tx <-> AFD101 TX/RX; MainDriveAxis Node 1" })
    });

    const locations = Object.freeze({
      drivePower: Object.freeze([{ pdfPage: 46, sheet: "10/72", section: "AFD101 power, C101, F101-F103, CB104 and MTR101" }]),
      sercos: Object.freeze([{ pdfPage: 47, sheet: "11/72", section: "AFD101 SERCOS interface via W111/W112" }]),
      feedback: Object.freeze([{ pdfPage: 48, sheet: "12/72", section: "MTR101 motor-feedback cable W121 to AFD101" }])
    });

    const SPEC = Object.freeze({
      32: ["MainDriveAxis.CommutationFault", "commutation / motor-feedback alignment", [COMMON.drive, COMMON.feedback, COMMON.motor], [...locations.feedback, ...locations.drivePower]],
      33: ["MainDriveAxis.DriveControlVoltageFault", "drive control-voltage loss", [COMMON.control, COMMON.drive], locations.drivePower],
      34: ["MainDriveAxis.DriveCoolingFault", "drive cooling condition", [COMMON.drive], locations.drivePower],
      35: ["MainDriveAxis.DriveHardFault", "drive hard fault", [COMMON.drive], locations.drivePower],
      36: ["MainDriveAxis.DriveOvercurrentFault", "drive overcurrent", [COMMON.drive, COMMON.motor, COMMON.power], locations.drivePower],
      37: ["MainDriveAxis.DriveOvertempFault", "drive overtemperature", [COMMON.drive], locations.drivePower],
      38: ["MainDriveAxis.DriveOvervoltageFault", "DC-bus / drive overvoltage", [COMMON.drive, COMMON.power], locations.drivePower],
      39: ["MainDriveAxis.DriveUndervoltageFault", "DC-bus / drive undervoltage", [COMMON.drive, COMMON.power], locations.drivePower],
      41: ["MainDriveAxis.GroundShortFault", "motor/output ground-short detection", [COMMON.drive, COMMON.motor, COMMON.power], locations.drivePower],
      42: ["MainDriveAxis.ModuleFault", "SERCOS drive/module general fault", [COMMON.drive, COMMON.sercos], [...locations.sercos, ...locations.drivePower]],
      43: ["MainDriveAxis.ModuleHardwareFault", "SERCOS drive/module hardware fault", [COMMON.drive, COMMON.sercos], [...locations.sercos, ...locations.drivePower]],
      44: ["MainDriveAxis.ModuleSyncFault", "SERCOS synchronization fault", [COMMON.drive, COMMON.sercos], locations.sercos],
      45: ["MainDriveAxis.MotFeedbackFault", "motor-feedback loss", [COMMON.feedback, COMMON.drive, COMMON.motor], locations.feedback],
      46: ["MainDriveAxis.MotFeedbackNoiseFault", "motor-feedback signal noise", [COMMON.feedback, COMMON.drive, COMMON.motor], locations.feedback],
      47: ["MainDriveAxis.OverloadFault", "drive/motor overload", [COMMON.drive, COMMON.motor], [...locations.drivePower, ...locations.feedback]],
      48: ["MainDriveAxis.MotorOvertempFault", "motor overtemperature", [COMMON.motor, COMMON.feedback, COMMON.drive], locations.feedback],
      50: ["MainDriveAxis.OverSpeedFault", "servo overspeed", [COMMON.drive, COMMON.motor, COMMON.feedback], [...locations.drivePower, ...locations.feedback]],
      51: ["MainDriveAxis.PositionErrorFault", "servo position-error / following-error", [COMMON.drive, COMMON.motor, COMMON.feedback], [...locations.drivePower, ...locations.feedback]],
      52: ["MainDriveAxis.PowerPhaseLossFault", "servo power-phase loss", [COMMON.power, COMMON.drive], locations.drivePower],
      53: ["MainDriveAxis.SERCOSRingFault", "SERCOS ring/fiber fault", [COMMON.sercos, COMMON.drive], locations.sercos],
      54: ["MainDriveAxis.TimerEventFault", "motion-module timer/event fault", [COMMON.sercos, COMMON.drive], locations.sercos]
    });

    const STATION_SERVO = Object.freeze(Object.fromEntries(Object.entries(SPEC).map(([offset, spec]) => {
      const [producer, role, devices, drawingLocations] = spec;
      const number = Number(offset);
      const trace = circuit(
        "machine-specific-direct-servo-status-and-hardware-bound",
        "exact-cart-plc-k605163-servo-match",
        [producer, "MainDriveAxis", "EEP_APL_Slot12", "1756-M08SE", "2094-BC02-M02"],
        devices,
        drawingLocations,
        `Cart Fault ${String(number).padStart(3, "0")} is driven directly by ${producer}; it is therefore treated as a ${role} condition, not as a generic "servo fault." The Cart 1 L5K binds MainDriveAxis to Kinetix 6000 drive 2094-BC02-M02 at SERCOS Node 1 through 1756-M08SE Slot 12. K605163-001 supplies the corresponding AFD101 drive, MTR101 motor, W121 motor-feedback, W111/W112 SERCOS, and F101-F103/CB104 power-control circuits. ServoForge presents only the hardware paths relevant to this status role.`,
        "Prevent unexpected servo motion and isolate electrical/mechanical energy before connector, motor, drive or power-circuit work. Do not clear these faults by forcing axis status bits. Energized measurements require qualified electrical personnel and approved procedures.",
        "One Station servo method is shared across Stations 1-6. Fault 040 and Fault 049 are intentionally excluded because this supplied Cart revision drives those alarm bits from Logic_0 rather than an active hardware producer."
      );
      return [number, trace];
    })));

    function traceForEntry(entry) {
      if (!entry?.plcFault || entry.diagnosticScope !== "Station") return null;
      return STATION_SERVO[Number(entry.stationTemplateOffset)] || null;
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
      const active = Object.keys(STATION_SERVO).map(Number);
      for (const offset of active) {
        const trace = getStationFaultTemplate(offset)?.circuitTrace;
        if (!trace) errors.push(`Station servo offset ${offset} lost its circuit trace.`);
        if (trace?.source?.drawing !== "K605163-001") errors.push(`Station servo offset ${offset} lost K605163 provenance.`);
      }
      if (!getStationFaultTemplate(45)?.circuitTrace?.deviceRows?.some((row) => row.cable === "2001-W121")) errors.push("Fault 045 lost W121 motor-feedback evidence.");
      if (!getStationFaultTemplate(53)?.circuitTrace?.deviceRows?.some((row) => /COM081/.test(row.device))) errors.push("Fault 053 lost COM081 SERCOS evidence.");
      if (!getStationFaultTemplate(52)?.circuitTrace?.deviceRows?.some((row) => /F101/.test(row.device))) errors.push("Fault 052 lost three-phase fuse evidence.");
      if (getStationFaultTemplate(40)?.circuitTrace?.status === "machine-specific-direct-servo-status-and-hardware-bound") errors.push("Fault 040 must remain inactive in this revision.");
      if (getStationFaultTemplate(49)?.circuitTrace?.status === "machine-specific-direct-servo-status-and-hardware-bound") errors.push("Fault 049 must remain inactive in this revision.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+station-servo-circuit-v1`,
      getEntry,
      getTopModulFault,
      getStationFaultTemplate,
      getStationFaultVariant,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      topModulStationServoCircuitOffsets: Object.freeze(Object.keys(STATION_SERVO).map(Number)),
      validate
    });
  };
});
