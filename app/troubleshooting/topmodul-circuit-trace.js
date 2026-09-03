"use strict";

(function installTopModulCircuitTrace(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulCircuitTraceExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getStationFaultTemplate || !base?.getTopModulFaultDrillDown) {
      throw new Error("TopModul PLC causality layers are required before circuit tracing.");
    }

    const SOURCES = Object.freeze({
      topmodulK407039: Object.freeze({
        id: "topmodul-k407039",
        file: "407-039 Electrical Schematic.pdf",
        drawing: "K407039-001",
        machineModel: "Topmodul/Labeller",
        revision: "09",
        drawingDate: "2007-03-06",
        evidenceClass: "machine-specific-topmodul-schematic",
        sourceDiscipline: "Supplied TopModul/Labeller drawing K407039-001. Device, I/O and circuit claims are only promoted where the drawing and readable CO85_LB1_Labeler_1online.L5K agree."
      }),
      aplCartK605163: Object.freeze({
        id: "apl-cart-k605163",
        file: "605-163 Electrical Schematic.pdf",
        drawing: "K605163-001",
        machineModel: "APL Cart",
        revision: "10",
        drawingDate: "2004-06-28 to 2004-09-03",
        evidenceClass: "machine-specific-apl-cart-schematic",
        sourceDiscipline: "Supplied APL Cart drawing K605163-001. Shared Station methods use it where the Cart 1 L5K device tags and drawing designations agree; station-specific installed revisions still require field verification."
      }),
      legacyAplCartK605576: Object.freeze({
        id: "apl-cart-k605576",
        file: "605576 (APL) Schematic.pdf",
        drawing: "K605576-001",
        machineModel: "APL Cart",
        revision: "06",
        drawingDate: "2005-07-21",
        evidenceClass: "legacy-apl-cart-cross-check",
        sourceDiscipline: "Earlier archived APL Cart drawing retained only as a cross-check. K605163-001 is the preferred supplied station hardware authority for this TopModul set."
      }),
      autocolK747993: Object.freeze({
        id: "autocol-k747993",
        file: "747-993 Electrical Schematic.pdf",
        drawing: "K747993-001",
        machineModel: "Autocol",
        revision: "05",
        drawingDate: "2013-02-20",
        evidenceClass: "corroborative-autocol-schematic",
        sourceDiscipline: "Autocol reference retained only for architecture comparison; it is never used as the TopModul circuit authority when K407039-001 provides the exact circuit."
      })
    });

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const circuit = (sourceId, status, confidence, plcSignals, deviceRows, drawingLocations, summary, safetyBoundary, scopeNote) => Object.freeze({
      sourceId,
      status,
      confidence,
      plcSignals: Object.freeze(plcSignals),
      deviceRows: freezeRows(deviceRows),
      drawingLocations: freezeRows(drawingLocations),
      summary,
      safetyBoundary,
      scopeNote
    });

    const STATION = Object.freeze({
      3: circuit(
        "apl-cart-k605163",
        "machine-specific-device-circuit-bound",
        "high-plc-drawing-match",
        ["E2001_LS143_SafetySwitch", "I0005.08"],
        [{ device: "LS143", description: "Safety switch at pinch roller", area: "+ETS", cable: "2001-W143", terminals: "TB52 safety-switch circuit; PLC alias I0005.08" }],
        [{ pdfPage: 47, sheet: "55/72", section: "Servodrive / safety switch LS143" }],
        "Cart 1 PLC aliases E2001_LS143_SafetySwitch to I0005.08. Supplied K605163-001 shows LS143 on cable 2001-W143 in the APL Cart servodrive/safety circuit.",
        "Do not bypass or jumper LS143. Inspect actuator alignment, device condition, connectors and wiring only under approved machine safety/LOTO procedures.",
        "One shared Station method is used for Stations 1-6; the active station instance supplies the Labeler-side fault address."
      ),
      4: circuit(
        "apl-cart-k605163",
        "machine-specific-device-circuit-bound-secondary",
        "high-plc-drawing-match",
        ["E2001_LS143_SafetySwitch", "Faults[0].3", "ControlOut.ResetGeneral"],
        [{ device: "LS143", description: "Safety switch at pinch roller", area: "+ETS", cable: "2001-W143", terminals: "TB52 safety-switch circuit; PLC alias I0005.08" }],
        [{ pdfPage: 47, sheet: "55/72", section: "Servodrive / safety switch LS143" }],
        "Door Closed - Press Reset is a reset/secondary state built on the same LS143 safety circuit. Confirm the physical safety-switch state before treating reset as a separate hardware problem.",
        "Never reset around an unresolved guard/safety condition or defeat the switch.",
        "Shared Station circuit; exact station number changes the Labeler-side fault destination, not the local cart method."
      ),
      9: circuit(
        "apl-cart-k605163",
        "machine-specific-device-circuit-bound",
        "high-plc-drawing-match",
        ["E5701_MTR611_FeedUnitReady", "I0005.07", "E5701_MTR611_FeedUnitRelease", "O0007.09"],
        [{ device: "MTR611", description: "Feed-unit motor/drive interface", area: "+AB", cable: "5701-W611", terminals: "Ready feedback I0005.07; release O0007.09; C101/TB52/I/O interface shown on drawing" }],
        [{ pdfPage: 53, sheet: "61/72", section: "Feed unit motor/drive interface" }],
        "The Cart 1 PLC and K605163-001 both identify MTR611 as the feed-unit drive. The drawing routes 5701-W611 through the cart control/I/O interface and the PLC aliases the ready feedback to I0005.07.",
        "Prevent unexpected motion before touching feed-unit drive or motor wiring. Energized measurements are for qualified electrical personnel under approved procedures.",
        "Device/cable identity is machine-set evidence; drive parameters remain a separate diagnostic layer."
      ),
      10: circuit(
        "apl-cart-k605163",
        "machine-specific-device-circuit-bound",
        "high-plc-drawing-match",
        ["E5701_MTR601_RewindUnitReady", "I0005.06", "E5701_MTR601_RewindUnitRelease", "O0007.03"],
        [{ device: "MTR601", description: "Rewind-unit motor/drive interface", area: "+AU", cable: "5701-W601", terminals: "Ready feedback I0005.06; release O0007.03; C101/TB52/I/O interface shown on drawing" }],
        [{ pdfPage: 52, sheet: "60/72", section: "Rewind unit motor/drive interface" }],
        "The Cart 1 PLC and K605163-001 both identify MTR601 as the rewind-unit drive. Cable 5701-W601 carries the drive interface and the PLC ready feedback is I0005.06.",
        "Prevent unexpected rewind motion and isolate stored/mechanical energy before servicing this circuit.",
        "Shared Station hardware method; active station number remains an instance parameter."
      ),
      20: circuit(
        "apl-cart-k605163",
        "machine-specific-device-circuit-bound",
        "high-plc-drawing-match",
        ["E1501_P133_CarriageFront", "I0005.27"],
        [{ device: "P133", description: "Carriage at the front", area: "+AC", cable: "1501-W133", terminals: "TB52 to I/O031; PLC alias I0005.27" }],
        [{ pdfPage: 46, sheet: "54/72", section: "Carriage at the front P133" }],
        "Cart 1 PLC aliases the carriage-front signal to I0005.27 and K605163-001 shows P133 on cable 1501-W133 to the cart I/O/terminal circuit.",
        "Keep hands clear of the carriage and isolate motion before mechanical alignment or wiring work.",
        "Exact supplied APL Cart drawing for the shared Station method."
      ),
      23: circuit(
        "apl-cart-k605163",
        "machine-specific-device-circuit-bound",
        "high-plc-drawing-match",
        ["E5701_PE641_TearVerification", "I0005.03"],
        [{ device: "PE641", description: "Label applicator tear verification", area: "+ETS", cable: "5701-W641", terminals: "TB52 to I/O031; PLC alias I0005.03" }],
        [{ pdfPage: 56, sheet: "64/72", section: "Tear verification PE641" }],
        "The PLC tear-verification input is I0005.03 and K605163-001 identifies the physical sensor as PE641 on cable 5701-W641.",
        "Use normal sensor diagnostics and safe access; do not defeat the sensor to keep production running.",
        "Exact device and cable identity in the supplied APL Cart drawing."
      ),
      25: circuit(
        "apl-cart-k605163",
        "machine-specific-multi-sensor-circuit-bound",
        "high-plc-drawing-match-with-selector-name-exception",
        ["E5701_PE631_SensorEndOfReel", "I0005.17", "E5701_PE632_SensorEndOfReel_abs", "I0005.11", "E5701_SS631_SelSwitchEndOfReel", "I0005.16"],
        [
          { device: "PE631", description: "End-of-reel monitoring sensor 1", area: "+AB", cable: "5701-W631", terminals: "PLC alias I0005.17; TB52 circuit on K605163 sheet 63" },
          { device: "PE632", description: "Absolute/end-of-reel monitoring sensor 2", area: "+AB", cable: "5701-W632", terminals: "PLC alias I0005.11; TB52 circuit on K605163 sheet 63" },
          { device: "SS633 (drawing) / SS631 (PLC tag)", description: "End-of-reel selector switch", area: "+AB", cable: "5701-W633", terminals: "PLC selector alias I0005.16; drawing designation differs" }
        ],
        [{ pdfPage: 55, sheet: "63/72", section: "End-of-reel monitoring PE631 / PE632 / selector" }],
        "Fault 025 is produced from the end-of-reel detection logic using PE631/PE632, the selector state and configured absolute-end-of-reel mode. K605163-001 shows the two sensors and selector circuit on one sheet, so ServoForge can route the technician to the actual hardware instead of treating 'no labels' as a generic supply fault.",
        "Observe sensor state and web/reel condition from a safe position. Isolate motion before sensor alignment, selector wiring checks or work inside guarded areas.",
        "Important source exception: the Cart 1 PLC tag calls the selector SS631 while K605163-001 labels the selector SS633. ServoForge preserves that mismatch rather than silently asserting they are the same designation."
      ),
      26: circuit(
        "apl-cart-k605163",
        "machine-specific-multi-sensor-circuit-bound",
        "high-plc-drawing-match",
        ["E5701_PE621_FeedUnitFront", "I0005.28", "E5701_PE622_FeedUnitRear", "I0005.29"],
        [
          { device: "PE621", description: "Feed unit at the front", area: "+AB", cable: "5701-W621", terminals: "TB52 8/2; PLC alias I0005.28" },
          { device: "PE622", description: "Feed unit rear", area: "+AB", cable: "5701-W622", terminals: "TB52 9/2; PLC alias I0005.29" }
        ],
        [{ pdfPage: 54, sheet: "62/72", section: "Buffer control unit PE621 / PE622" }],
        "The loop-buffer fault is supervised from PE621 and PE622 in Cart 1 logic. K605163-001 shows those exact front/rear feed-unit sensors and their TB52/I/O routes.",
        "Observe sensor state from a safe position; isolate motion before alignment, cleaning inside guarded areas or wiring work.",
        "Exact shared Station hardware method from the supplied APL Cart drawing."
      ),
      27: circuit(
        "apl-cart-k605163",
        "machine-specific-multi-sensor-circuit-bound",
        "high-plc-drawing-match",
        ["E5701_PE621_FeedUnitFront", "I0005.28", "E5701_PE622_FeedUnitRear", "I0005.29"],
        [
          { device: "PE621", description: "Feed unit at the front", area: "+AB", cable: "5701-W621", terminals: "TB52 8/2; PLC alias I0005.28" },
          { device: "PE622", description: "Feed unit rear", area: "+AB", cable: "5701-W622", terminals: "TB52 9/2; PLC alias I0005.29" }
        ],
        [{ pdfPage: 54, sheet: "62/72", section: "Buffer control unit PE621 / PE622" }],
        "Invalid Sensor Status LB Feed Unit is the PLC plausibility check on the same PE621/PE622 hardware pair. The exact cart drawing gives the physical front/rear circuit.",
        "Do not force or simulate input states as a troubleshooting shortcut. Verify target, alignment, contamination and wiring safely.",
        "Exact shared Station hardware method from K605163-001."
      ),
      60: circuit(
        "apl-cart-k605163",
        "machine-specific-device-circuit-bound",
        "high-plc-drawing-match",
        ["E5701_PE603_DiameterRewindUnit", "I0005.18"],
        [{ device: "PE603", description: "Diameter rewind unit", area: "+AU", cable: "5701-W603", terminals: "TB52 to I/O; PLC alias I0005.18" }],
        [{ pdfPage: 52, sheet: "60/72", section: "Rewind diameter sensor PE603" }],
        "The PLC rewind-full supervision uses E5701_PE603_DiameterRewindUnit at I0005.18. K605163-001 identifies PE603 and cable 5701-W603 in the rewind-unit circuit.",
        "Stop and isolate rewind motion before sensor adjustment or wiring work.",
        "Exact device identity in the supplied APL Cart drawing."
      )
    });

    const encoderCircuit = (faultNumber, role) => circuit(
      "topmodul-k407039",
      "machine-specific-plc-io-circuit-bound",
      "exact-topmodul-plc-and-drawing-match",
      ["E1701_ENC101_FineClockPulse", "Local:7:I.Data.0", "I0007.00", "E1701_ENC101_ClockPulse", "I0007.01"],
      [
        { device: "ENC101", description: "Main machine encoder", area: "+MK", cable: ".1701-W091", terminals: "ENC101 ↔ CVTR101; encoder supply/signal conductors shown on K407039 sheet 114" },
        { device: "CVTR101", description: "Encoder signal splitter / converter", area: "+SK", cable: ".1701-W091 / .1701-W271", terminals: "FT → I/O031 I0007.00 (Local:7:I.Data.0); GT → I/O031 I0007.01" }
      ],
      [{ pdfPage: 114, sheet: "114/277", section: "ENC101 encoder and CVTR101 signal splitter" }, { pdfPage: 126, sheet: "126/277", section: "CVTR101 fine-clock/clock pulse to I/O031" }],
      `Fault ${faultNumber} ${role} uses the same physical main-encoder feedback chain. The readable Labeler PLC aliases E1701_ENC101_FineClockPulse directly to Local:7:I.Data.0, and K407039-001 routes CVTR101 FT to I/O031 I0007.00. This is now an exact TopModul PLC-to-I/O-to-device trace, not an Autocol analogy.`,
      "This encoder path participates in machine motion/safety monitoring. Do not bypass the monitor or jumper feedback. Qualified electrical diagnostics and approved safe-work/LOTO procedures apply.",
      "K407039-001 is the supplied TopModul/Labeller drawing paired with the K407-039 Labeler PLC export. The Autocol drawing remains a separate historical cross-check only."
    );

    const LABELER = Object.freeze({
      482: circuit(
        "topmodul-k407039",
        "machine-specific-plc-io-circuit-bound",
        "exact-topmodul-plc-and-drawing-match",
        ["E2001_C102_MainDriveContactor", "O0103.00", "E2001_C101_MainDriveContactorFB", "I0009.26", "E2001_C102_MainDriveContactorDelayFB", "I0009.27"],
        [
          { device: "C102", description: "Main drive contactor command / monitored contact", area: "+SK", cable: "control-cabinet wiring", terminals: "PLC output O0103.00; auxiliary/delay feedback I0009.27" },
          { device: "C101", description: "Main drive contactor feedback", area: "+SK", cable: "control-cabinet wiring", terminals: "PLC input I0009.26" },
          { device: "AFD101 / MTR101", description: "Main drive and motor power path", area: "+SK / +ET", cable: "main-drive power/control", terminals: "Power and contactor arrangement shown on K407039 sheets 127 and 130" }
        ],
        [{ pdfPage: 127, sheet: "127/277", section: "Main drive contactor feedback C101/C102 and AFD101" }, { pdfPage: 130, sheet: "130/277", section: "Main drive contactor/control outputs" }],
        "Fault 482 monitors commanded main-drive contactor state against physical feedback. The PLC aliases C102 command to O0103.00, C101 feedback to I0009.26 and C102 delayed feedback to I0009.27; K407039-001 shows those contactor/drive circuits.",
        "Main-drive contactor circuits may contain hazardous voltage and stored energy. De-energize/LOTO for hands-on work; energized measurements are for qualified electrical personnel only.",
        "Exact Labeler PLC and TopModul drawing evidence. Do not infer a failed contactor until command, feedback and upstream drive/safety state are compared."
      ),
      490: circuit(
        "topmodul-k407039",
        "machine-specific-plc-io-circuit-bound",
        "exact-topmodul-plc-and-drawing-match",
        ["E2001_C102_MainDriveContactor", "O0103.00", "E2001_C101_MainDriveContactorFB", "I0009.26", "E2001_C102_MainDriveContactorDelayFB", "I0009.27", "ElectrBrake.O_HWTimerFault"],
        [
          { device: "C102", description: "Main drive contactor / delay-feedback circuit", area: "+SK", cable: "control-cabinet wiring", terminals: "Command O0103.00; delayed feedback I0009.27" },
          { device: "C101", description: "Main drive contactor feedback", area: "+SK", cable: "control-cabinet wiring", terminals: "Feedback I0009.26" }
        ],
        [{ pdfPage: 127, sheet: "127/277", section: "C101/C102 feedback and main-drive circuit" }, { pdfPage: 130, sheet: "130/277", section: "C101/C102 control outputs" }],
        "Fault 490 is the electric-brake hardware-timer supervision fault. Its PLC producer compares C102 command, C101 feedback and C102 delayed feedback; K407039-001 provides the matching contactor I/O circuit.",
        "Do not bypass time-relay/contactor feedback or safety monitoring. Use approved LOTO and qualified electrical diagnostics.",
        "This trace identifies the supervised hardware path; it does not declare which contact/relay is failed without live state evidence."
      ),
      640: circuit(
        "topmodul-k407039",
        "machine-specific-plc-io-circuit-bound",
        "exact-topmodul-plc-and-drawing-match",
        ["E1501_PS101_MachineAirPressure", "I0010.18", "PressMonitor_01.O_Fault"],
        [{ device: "PS101", description: "Machine compressed-air pressure monitoring switch", area: "+ET", cable: ".1501-W101", terminals: "PS101 → PLC input I0010.18; TB53/TB52 circuit shown on drawing" }],
        [{ pdfPage: 111, sheet: "111/277", section: "Compressed-air pressure monitoring PS101" }],
        "Fault 640 is generated from the machine-air pressure monitor. The PLC alias E1501_PS101_MachineAirPressure is I0010.18 and K407039-001 shows PS101 on .1501-W101 in the compressed-air monitoring circuit.",
        "Depressurize and follow stored-energy procedures before disturbing pneumatic hardware. Electrical checks at the input circuit require normal qualified-work practices.",
        "Exact TopModul device and PLC input binding. Verify actual air pressure and switch state before replacing electrical components."
      ),
      669: encoderCircuit(669, "Machine Stop Monitoring"),
      670: encoderCircuit(670, "Fine Clock Pulse Monitoring")
    });

    function sourceFor(id) {
      return Object.values(SOURCES).find((source) => source.id === id) || null;
    }

    function traceForEntry(entry) {
      if (!entry?.plcFault) return null;
      if (entry.diagnosticScope === "Station") return STATION[Number(entry.stationTemplateOffset)] || null;
      return LABELER[Number(entry.number)] || null;
    }

    function enrich(entry) {
      if (!entry?.plcFault) return entry;
      const trace = traceForEntry(entry);
      if (!trace) return entry;
      return Object.freeze({ ...entry, circuitTrace: Object.freeze({ ...trace, source: sourceFor(trace.sourceId) }) });
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
      return entry?.circuitTrace || null;
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
        circuitTrace: entry.circuitTrace || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      for (const offset of [3, 4, 9, 10, 20, 23, 25, 26, 27, 60]) {
        const entry = getStationFaultTemplate(offset);
        if (!entry?.circuitTrace) errors.push(`Station offset ${offset} lost its circuit trace.`);
        if (entry?.circuitTrace?.source?.drawing !== "K605163-001") errors.push(`Station offset ${offset} lost K605163 source provenance.`);
      }
      for (const number of [482, 490, 640, 669, 670]) {
        const trace = getTopModulFault(number)?.circuitTrace;
        if (!trace) errors.push(`TopModul Labeler fault ${number} lost its exact circuit trace.`);
        if (trace?.source?.drawing !== "K407039-001") errors.push(`TopModul Labeler fault ${number} lost K407039 source provenance.`);
      }
      const fine = getTopModulFault(670)?.circuitTrace;
      if (fine?.status !== "machine-specific-plc-io-circuit-bound") errors.push("Fault 670 must be promoted to exact TopModul PLC/I/O circuit evidence.");
      if (!fine?.plcSignals?.includes("Local:7:I.Data.0")) errors.push("Fault 670 lost Local:7:I.Data.0 fine-clock input binding.");
      if (!fine?.deviceRows?.some((row) => row.device === "CVTR101" && /I0007\.00/.test(row.terminals))) errors.push("Fault 670 lost CVTR101 FT to I0007.00 mapping.");
      const endReel = getStationFaultTemplate(25)?.circuitTrace;
      if (!endReel?.deviceRows?.some((row) => row.device === "PE631")) errors.push("End-of-reel trace lost PE631.");
      if (!endReel?.deviceRows?.some((row) => row.device === "PE632")) errors.push("End-of-reel trace lost PE632.");
      if (!/SS633.*SS631|SS631.*SS633/.test(endReel?.scopeNote || "")) errors.push("End-of-reel trace lost the PLC/drawing selector designation exception.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+topmodul-circuit-trace-v2`,
      getEntry,
      getTopModulFault,
      getStationFaultTemplate,
      getStationFaultVariant,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      getTopModulCircuitSource: sourceFor,
      topModulCircuitSources: SOURCES,
      validate
    });
  };
});
