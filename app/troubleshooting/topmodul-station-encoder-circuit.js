"use strict";

(function installTopModulStationEncoderCircuit(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationEncoderCircuitExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getStationFaultTemplate || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul circuit tracing is required before Station encoder tracing.");
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

    const encoderAxisCircuit = (faultNumber, statusTag, role) => circuit(
      "machine-specific-feedback-module-circuit-bound",
      "exact-cart-plc-axis-and-drawing-match",
      [statusTag, "BaseMachineEncoderAxis", "EEP_APL_Slot11:Ch0", "1756-M02AE", "ServoFeedbackType=AQB"],
      [
        { device: "I/O071 / 1756-M02AE", description: `Slot 11 Channel 0 feedback-only AQB axis - ${role}`, area: "+KA", cable: "2001-W131", terminals: "CN131 C1/C2 -> CHA.0 26/28; C3/C4 -> CHB.0 30/32; C5/C6 -> CHZ.0 34/36; shield C12 -> 24" },
        { device: "CN131 / W131", description: "High-resolution base-machine encoder/signal-converter feed to Station encoder module", area: "+AC to +KA", cable: "2001-W131 Paar-Tronic-CY 6x2x0.5 mm²", terminals: "HT1 +/-, HT2 +/-, clock +/-, shield" }
      ],
      [{ pdfPage: 33, sheet: "07/72", section: "Node0Slot11 analog/encoder module overview" }, { pdfPage: 50, sheet: "13/72", section: "High-resolution encoder A/B/Z and clock monitor wiring" }],
      `Cart Fault ${String(faultNumber).padStart(3, "0")} is produced directly from ${statusTag}. The L5K binds BaseMachineEncoderAxis to EEP_APL_Slot11:Ch0, catalog 1756-M02AE, as a feedback-only AQB axis. K605163-001 shows the matching I/O071 high-resolution CHA/CHB/CHZ wiring from CN131 over 2001-W131. For ${role}, diagnose the module/status meaning first and then the physical feedback path when that role implicates signal integrity. OPTO131/OPTO132 are parallel clock-monitor taps and are not silently treated as the producer of this module-status fault.`,
      "Prevent unexpected station/servo motion before connector or encoder work. Do not force motion-axis status bits or bypass feedback monitoring; energized diagnostics require qualified personnel.",
      "Shared Station encoder hardware method. The active station number changes the Labeler-side alarm instance but not the Cart 1 encoder architecture."
    );

    const STATION_ENCODER = Object.freeze({
      21: circuit(
        "machine-specific-registration-sensor-path-bound",
        "exact-cart-plc-and-drawing-match",
        ["Faults[1].5", "MainDriveAxis.Registration1Position", "MainDrive.MTags.MAR[0]", "MainDrive.MTags.MAR[1]", "MainDrive.MTags.MAH[0]", "MainDrive.MTags.MAH[1]"],
        [
          { device: "P141", description: "Servodrive labels-position/reference sensor", area: "+ETS", cable: "W141 / 2001-W141 circuit", terminals: "Feeds AFD101 registration: REG_COM 15, REG1 14, REG_24V 13" },
          { device: "AFD101", description: "Station label servo drive registration input", area: "+KA", cable: "P141 registration circuit", terminals: "REG_COM / REG1 / REG_24V" }
        ],
        [{ pdfPage: 51, sheet: "14/72", section: "P141 servodrive labels-position registration circuit" }],
        "Cart Fault 021 is latched when the reference/homing move completes or errors without the expected registration edge. The PLC evaluates MainDriveAxis.Registration1Position and MAR/MAH motion status; K605163-001 shows P141 wired directly into the AFD101 REG1 registration input. This makes P141 target/edge, connector/wiring and the drive registration input the physical reference path for this fault rather than the base-machine clock encoder.",
        "Isolate station motion before aligning or servicing P141. Do not simulate the registration signal to complete a reference run.",
        "Fault 024 is not merged into this path: in the supplied Cart 1 revision its named alarm position has no verified producer logic, so ServoForge does not assume it is the same P141 condition."
      ),
      30: circuit(
        "machine-specific-clock-monitor-circuit-bound",
        "exact-cart-plc-and-drawing-match",
        ["Faults[1].14", "E2001_OPTO131_ClockPulse", "Local:5:I.Data.9", "I0005.09", "FaultEncoderMonitoring", "BaseMachineEncoderAxis.ActualPosition"],
        [
          { device: "OPTO131", description: "Machine encoder clock-pulse optocoupler/monitor", area: "+AC", cable: "2001-W131/CN131 monitor branch", terminals: "OPTO131 contact -> I/O031 I0005.09" },
          { device: "CN131 / W131", description: "Common base-machine encoder/signal-converter source", area: "+AC", cable: "2001-W131", terminals: "Clock/high-resolution signal bundle feeding both monitor and AQB paths" }
        ],
        [{ pdfPage: 50, sheet: "13/72", section: "OPTO131 clock pulse and parallel high-resolution encoder wiring" }],
        "Cart Fault 030 is not merely a generic encoder-module alarm. Cart 1 logic can latch it when the OPTO131 clock-pulse state is inconsistent with the calculated master position, or when registration-based master-position monitoring exceeds its permitted correction window. K605163-001 binds OPTO131 to I0005.09. Use this clock-monitor path first for Fault 030; the separate 064-069 family represents direct 1756-M02AE module/feedback status faults.",
        "Treat encoder/clock signals as motion feedback. Do not bypass monitoring or force I0005.09; isolate motion before connector/wiring work.",
        "OPTO132 at I0005.10 is the fine-clock monitor sibling on the same drawing but is not the direct producer signal shown in the Fault 030 rung."
      ),
      64: encoderAxisCircuit(64, "BaseMachineEncoderAxis.ModuleFault", "module/general fault"),
      65: encoderAxisCircuit(65, "BaseMachineEncoderAxis.ModuleHardwareFault", "module hardware fault"),
      66: encoderAxisCircuit(66, "BaseMachineEncoderAxis.ModuleSyncFault", "module synchronization/backplane timing fault"),
      67: encoderAxisCircuit(67, "BaseMachineEncoderAxis.FeedbackFault", "AQB feedback-loss fault"),
      68: encoderAxisCircuit(68, "BaseMachineEncoderAxis.FeedbackNoiseFault", "feedback signal-integrity/noise fault"),
      69: encoderAxisCircuit(69, "BaseMachineEncoderAxis.TimerEventFault", "motion-module timer/event fault")
    });

    function traceForEntry(entry) {
      if (!entry?.plcFault || entry.diagnosticScope !== "Station") return null;
      return STATION_ENCODER[Number(entry.stationTemplateOffset)] || null;
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
      for (const offset of [21, 30, 64, 65, 66, 67, 68, 69]) {
        const trace = getStationFaultTemplate(offset)?.circuitTrace;
        if (!trace) errors.push(`Station encoder offset ${offset} lost its circuit trace.`);
        if (trace?.source?.drawing !== "K605163-001") errors.push(`Station encoder offset ${offset} lost K605163 provenance.`);
      }
      const reference = getStationFaultTemplate(21)?.circuitTrace;
      if (!reference?.deviceRows?.some((row) => row.device === "P141")) errors.push("Fault 021 lost P141 registration evidence.");
      const monitor = getStationFaultTemplate(30)?.circuitTrace;
      if (!monitor?.plcSignals?.includes("I0005.09")) errors.push("Fault 030 lost OPTO131 I0005.09 binding.");
      const feedback = getStationFaultTemplate(67)?.circuitTrace;
      if (!feedback?.deviceRows?.some((row) => row.device.includes("1756-M02AE"))) errors.push("Fault 067 lost 1756-M02AE feedback module evidence.");
      if (!feedback?.deviceRows?.some((row) => row.device.includes("CN131"))) errors.push("Fault 067 lost CN131/W131 high-resolution feedback path.");
      if (getStationFaultTemplate(24)?.circuitTrace?.summary?.includes("P141")) errors.push("Fault 024 must not be silently merged into P141 without producer evidence.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+station-encoder-circuit-v1`,
      getEntry,
      getTopModulFault,
      getStationFaultTemplate,
      getStationFaultVariant,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      topModulStationEncoderCircuitOffsets: Object.freeze([21, 30, 64, 65, 66, 67, 68, 69]),
      validate
    });
  };
});
