"use strict";

(function installTopModulStationFoundationCircuit(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationFoundationCircuitExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getStationFaultTemplate || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Station diagnostic layers are required before foundation tracing.");
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

    const FOUNDATION = Object.freeze({
      1: circuit(
        "machine-specific-safety-feedback-circuit-bound",
        "exact-cart-plc-k605163-safety-match",
        [
          "E1101_CR202_EStop",
          "I0005.04",
          "E1101_CR204_EStopDelayed",
          "I0005.05",
          "PowerOnReset",
          "Faults[0].1"
        ],
        [
          { device: "CR202", description: "Direct E-stop feedback relay from the main machine", area: "+KA", cable: "1101-W151", terminals: "I/O031 I0005.04; relay/contact path shown on K605163 E-stop sheet" },
          { device: "CR204", description: "Delayed E-stop feedback relay from the main machine", area: "+KA", cable: "1101-W151 / safety feedback circuit", terminals: "I/O031 I0005.05; delayed feedback also participates in the Station power/feedback permissive" }
        ],
        [
          { pdfPage: 42, sheet: "18/72", section: "Emergency stop from labeller/main-machine interface - CR202 / CR204" },
          { pdfPage: 64, sheet: "72-series terminal/cross-reference", section: "CR204 safety feedback cross-reference into Station safety circuit" }
        ],
        "Cart Fault 001 is produced when either E1101_CR202_EStop (I0005.04) or E1101_CR204_EStopDelayed (I0005.05) is not present after PowerOnReset. The PLC treats the direct and delayed main-machine E-stop feedback as two distinct conditions and removes Station Jog/On enable when either is missing. K605163 shows CR202/CR204 in the E-stop interface circuit, so ServoForge routes this fault to the incoming safety-feedback chain rather than to unrelated Station servo or label sensors.",
        "This is a safety circuit. Never jumper, bypass, force, or defeat CR202/CR204 or their PLC inputs. Use the approved E-stop/safety verification and LOTO procedure. Energized safety-circuit measurements are for qualified personnel under the site's safe-work rules.",
        "Shared Station method. The fault establishes that a required main-machine safety feedback is absent; it does not by itself identify whether the upstream cause is an operated E-stop, main-machine safety state, relay/contact problem, connector, or wiring fault."
      ),
      2: circuit(
        "controller-led-status-diagnostic-bound",
        "exact-cart-plc-controller-and-rack-match",
        [
          "GSV(MODULE,?,LedStatus,LEDStatus)",
          "LEDStatus",
          "NEQ(LEDStatus,3)",
          "Faults[0].2"
        ],
        [
          { device: "CPU202 / 1756-L61", description: "APL Cart ControlLogix controller in rack Slot 0", area: "+KA", cable: "ControlLogix backplane / chassis", terminals: "K605163 rack Slot 0; L5K ProcessorType 1756-L61" },
          { device: "I/O011 ControlLogix chassis", description: "Cart PLC chassis containing CPU, ENBT, digital I/O, analog and motion modules", area: "+KA", cable: "1756 backplane", terminals: "Slots 0-12 shown on K605163 PLC overview" }
        ],
        [{ pdfPage: 29, sheet: "01/72", section: "PLC overview / rack structure - CPU202 1756-L61 and I/O modules" }],
        "Cart Fault 002 is generated from a MODULE GSV LedStatus read: the Startprogramm logic latches the fault when LEDStatus is not equal to 3. The supplied L5K identifies the controller as a 1756-L61 and K605163 shows CPU202 in Slot 0 of the Cart chassis. ServoForge therefore classifies this as a controller/chassis diagnostic condition, not as one specific field input or output failure. The L5K exports the GSV instance as '?' and does not itself decode the numeric LedStatus value 3, so the library preserves that limitation instead of inventing a Rockwell status definition.",
        "Do not reseat or replace ControlLogix modules with the machine energized unless the approved hardware procedure explicitly permits it. Preserve the controller program, addressing and validated module configuration before hardware replacement. Qualified controls/electrical personnel should use controller/module diagnostics to determine the actual chassis member or controller state.",
        "Fault 002 should be correlated with any more-specific ENBT, output-fuse, motion-module or axis fault already present. A specific child/module alarm is stronger evidence than this general controller I/O failure."
      )
    });

    const SEARCHABLE_GAPS = Object.freeze({
      8: "Named Carriage Not Pulled Back alarm has no Faults[0].8 producer reference in this Cart revision.",
      24: "Named Reference Sensor No Signal alarm has no Faults[1].8 producer reference in this Cart revision.",
      31: "Named Synchronization Lost During Run alarm has no Faults[1].15 producer reference in this Cart revision."
    });

    const ABSENT_SOURCE_POSITIONS = Object.freeze({
      0: "Alarm-table placeholder position is not exposed as a shared Station template and has no producer reference in the supplied Cart 1 L5K.",
      55: "Blank Fault 055 position is not exposed as a shared Station template and has no producer reference.",
      56: "Blank Fault 056 position is not exposed as a shared Station template and has no producer reference.",
      57: "Blank Fault 057 position is not exposed as a shared Station template and has no producer reference.",
      58: "Blank Fault 058 position is not exposed as a shared Station template and has no producer reference.",
      59: "Blank Fault 059 position is not exposed as a shared Station template and has no producer reference.",
      61: "Blank Fault 061 position is not exposed as a shared Station template and has no producer reference.",
      62: "Blank Fault 062 position is not exposed as a shared Station template and has no producer reference.",
      63: "Blank Fault 063 position is not exposed as a shared Station template and has no producer reference."
    });

    const SOURCE_GAPS = Object.freeze({ ...SEARCHABLE_GAPS, ...ABSENT_SOURCE_POSITIONS });

    function gapMetadata(offset) {
      const normalized = Number(offset);
      const reason = SOURCE_GAPS[normalized];
      if (!reason) return null;
      return Object.freeze({
        status: "not-promoted-no-producer",
        reason,
        searchableTemplate: Object.prototype.hasOwnProperty.call(SEARCHABLE_GAPS, normalized)
      });
    }

    function traceForEntry(entry) {
      if (!entry?.plcFault || entry.diagnosticScope !== "Station") return null;
      return FOUNDATION[Number(entry.stationTemplateOffset)] || null;
    }

    function enrich(entry) {
      if (!entry?.plcFault) return entry;
      const offset = Number(entry.stationTemplateOffset);
      const trace = traceForEntry(entry);
      const sourceGap = gapMetadata(offset);
      if (trace) return Object.freeze({ ...entry, circuitTrace: trace, sourceGap });
      if (sourceGap) return Object.freeze({ ...entry, sourceGap });
      return entry;
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

    function getStationSourceGap(offset) {
      return gapMetadata(offset);
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
        sourceGap: entry.sourceGap || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const f1 = getStationFaultTemplate(1)?.circuitTrace;
      if (!f1?.plcSignals?.includes("I0005.04") || !f1?.plcSignals?.includes("I0005.05")) errors.push("Fault 001 lost dual E-stop feedback inputs.");
      if (!f1?.deviceRows?.some((row) => row.device === "CR202") || !f1?.deviceRows?.some((row) => row.device === "CR204")) errors.push("Fault 001 lost CR202/CR204 hardware evidence.");
      const f2 = getStationFaultTemplate(2)?.circuitTrace;
      if (!f2?.plcSignals?.includes("NEQ(LEDStatus,3)")) errors.push("Fault 002 lost LedStatus != 3 producer evidence.");
      if (!f2?.deviceRows?.some((row) => /1756-L61/.test(row.device))) errors.push("Fault 002 lost 1756-L61 controller evidence.");

      for (const offset of Object.keys(SEARCHABLE_GAPS).map(Number)) {
        const entry = getStationFaultTemplate(offset);
        if (!entry?.sourceGap || entry.sourceGap.searchableTemplate !== true) errors.push(`Named Station source-gap offset ${offset} lost its searchable no-producer status.`);
      }
      for (const offset of Object.keys(ABSENT_SOURCE_POSITIONS).map(Number)) {
        const gap = getStationSourceGap(offset);
        if (!gap || gap.searchableTemplate !== false) errors.push(`Absent Station source position ${offset} lost coverage metadata.`);
        if (getStationFaultTemplate(offset) !== null) errors.push(`Absent Station source position ${offset} must not become a searchable Station template.`);
      }

      if (getStationFaultTemplate(8)?.circuitTrace) errors.push("Fault 008 must not gain a circuit trace without a verified producer.");
      if (getStationFaultTemplate(24)?.circuitTrace) errors.push("Fault 024 must not gain a circuit trace without a verified producer.");
      if (getStationFaultTemplate(31)?.processTrace) errors.push("Fault 031 must remain without a promoted process producer.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+station-foundation-circuit-v1`,
      getEntry,
      getTopModulFault,
      getStationFaultTemplate,
      getStationFaultVariant,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      getStationSourceGap,
      topModulStationFoundationCircuitOffsets: Object.freeze([1, 2]),
      topModulStationSearchableGapOffsets: Object.freeze(Object.keys(SEARCHABLE_GAPS).map(Number)),
      topModulStationAbsentSourcePositions: Object.freeze(Object.keys(ABSENT_SOURCE_POSITIONS).map(Number)),
      topModulStationUnpromotedOffsets: Object.freeze(Object.keys(SOURCE_GAPS).map(Number)),
      validate
    });
  };
});
