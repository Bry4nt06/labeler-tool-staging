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
      aplCartK605576: Object.freeze({
        id: "apl-cart-k605576",
        file: "605576 (APL) Schematic.pdf",
        drawing: "K605576-001",
        machineModel: "APL Cart",
        revision: "06",
        drawingDate: "2005-07-21",
        evidenceClass: "archived-apl-cart-schematic",
        sourceDiscipline: "Device/cable designations are verified in the archived APL Cart drawing. This does not prove that every installed cart uses the same drawing revision."
      }),
      autocolK747993: Object.freeze({
        id: "autocol-k747993",
        file: "747-993 Electrical Schematic.pdf",
        drawing: "K747993-001",
        machineModel: "Autocol",
        revision: "05",
        drawingDate: "2013-02-20",
        evidenceClass: "corroborative-autocol-schematic",
        sourceDiscipline: "This drawing is Autocol, not TopModul. It may corroborate Krones encoder/fine-clock hardware architecture but must never be presented as a TopModul-specific circuit page."
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
        "apl-cart-k605576",
        "archived-device-cable-bound",
        "high-archive-match",
        ["E2001_LS143_SafetySwitch"],
        [{ device: "LS143", description: "Safety switch pinch roller", area: "+ETS", cable: "2001-W143", terminals: "TB52 8/1, 1/2, 1/1, 7.A+/2" }],
        [{ pdfPage: 68, sheet: "68/71", section: "Cable assignment list" }, { pdfPage: 64, sheet: "64/71", section: "Terminal strip +KA" }],
        "The PLC safety-switch tag and archived APL device designation match LS143. The cable list identifies 2001-W143 from +KA/TB52 to +ETS/LS143; the terminal plan independently shows LS143 on the same terminal strip.",
        "Do not bypass or jumper LS143. Inspect the device, actuator alignment, connector condition, and wiring only under the approved machine safety/LOTO procedure.",
        "The HMI text says Guard Door Open; the archived drawing describes LS143 as a safety switch at the pinch roller. ServoForge keeps both labels instead of silently renaming the device."
      ),
      4: circuit(
        "apl-cart-k605576",
        "archived-device-cable-bound-secondary",
        "high-archive-match",
        ["E2001_LS143_SafetySwitch", "Faults[0].3", "ControlOut.ResetGeneral"],
        [{ device: "LS143", description: "Safety switch pinch roller", area: "+ETS", cable: "2001-W143", terminals: "TB52 8/1, 1/2, 1/1, 7.A+/2" }],
        [{ pdfPage: 68, sheet: "68/71", section: "Cable assignment list" }, { pdfPage: 64, sheet: "64/71", section: "Terminal strip +KA" }],
        "Door Closed - Press Reset is a secondary/reset state built on the same LS143 safety circuit. Confirm the LS143 condition is healthy before treating the reset message as a separate hardware fault.",
        "Never defeat the safety switch or reset around an unresolved guard/safety condition.",
        "Archived APL Cart hardware evidence; current installed revision still requires field verification."
      ),
      9: circuit(
        "apl-cart-k605576",
        "archived-device-cable-bound",
        "high-archive-match",
        ["E5701_MTR611_FeedUnitReady"],
        [{ device: "MTR611", description: "Feed-unit motor/drive interface", area: "+AB", cable: "5701-W611", terminals: "C101 84; TB52 5.C-/2, 6/1, 6/2, 19/1, 19/2; I/O041 12; I/O051 18/22; I/O031 08" }],
        [{ pdfPage: 68, sheet: "68/71", section: "Cable assignment list - input board" }, { pdfPage: 65, sheet: "65/71", section: "Terminal strip +KA" }],
        "The PLC FeedUnitReady signal names MTR611 and the archived APL cable assignment routes 5701-W611 to MTR611 with its input-board, I/O, terminal and C101 connections.",
        "Prevent unexpected motion before touching the feed-unit drive or motor wiring. Qualified electrical work only for energized diagnostics.",
        "This verifies the archived device/cable identity, not the exact present-day drive model or parameter set."
      ),
      10: circuit(
        "apl-cart-k605576",
        "archived-device-cable-bound",
        "high-archive-match",
        ["E5701_MTR601_RewindUnitReady"],
        [{ device: "MTR601", description: "Rewind-unit motor/drive interface", area: "+AU", cable: "5701-W601", terminals: "C101 74; TB52 1.B-/1, 1/2, 2/1, 17/1, 17/2; I/O041 04; I/O051 17/21; I/O031 07" }],
        [{ pdfPage: 68, sheet: "68/71", section: "Cable assignment list - input board" }, { pdfPage: 65, sheet: "65/71", section: "Terminal strip +KA" }],
        "The PLC RewindUnitReady signal names MTR601 and the archived APL cable assignment routes 5701-W601 to MTR601 with its input-board, I/O, terminal and C101 connections.",
        "Prevent unexpected rewind motion and isolate stored/mechanical energy before servicing the motor/drive circuit.",
        "Archived device/cable match; installed drive revision remains a field check."
      ),
      20: circuit(
        "apl-cart-k605576",
        "archived-device-cable-bound",
        "high-archive-match",
        ["E1501_P133_CarriageFront"],
        [{ device: "P133", description: "Carriage at the front", area: "+AC", cable: "1501-W133", terminals: "TB52 2/1, 1.A+/1, 1.A-/2, 2/2" }],
        [{ pdfPage: 67, sheet: "67/71", section: "Cable assignment list" }],
        "The PLC carriage-front signal maps directly to archived device P133. Cable 1501-W133 is explicitly described as carriage at the front and runs from +KA/TB52 to +AC/P133.",
        "Keep hands clear of the carriage and isolate motion before mechanical adjustment or wiring work.",
        "Device code and function match the archived APL Cart drawing."
      ),
      23: circuit(
        "apl-cart-k605576",
        "archived-device-cable-bound",
        "high-archive-match",
        ["E5701_PE641_TearVerification"],
        [{ device: "PE641", description: "Label applicator tear verification", area: "+ETS", cable: "5701-W641", terminals: "TB52 15/1, 14.A+/1, 14.A-/1, 22/1" }],
        [{ pdfPage: 69, sheet: "69/71", section: "Cable assignment list" }, { pdfPage: 65, sheet: "65/71", section: "Terminal strip +KA" }],
        "The PLC tear-verification input and archived APL photoeye designation match PE641. Cable 5701-W641 is explicitly labeled label applicator tear verification.",
        "Use normal sensor diagnostics and safe access; do not defeat the sensor to keep the machine running.",
        "Archived APL Cart device/cable match."
      ),
      26: circuit(
        "apl-cart-k605576",
        "archived-device-cable-bound",
        "high-archive-match",
        ["E5701_PE621_FeedUnitFront", "E5701_PE622_FeedUnitRear"],
        [
          { device: "PE621", description: "Feed unit at the front", area: "+AB", cable: "5701-W621", terminals: "TB52 8/2, 7.A+/1, 7.A-/1, 20/1" },
          { device: "PE622", description: "Feed unit rear", area: "+AB", cable: "5701-W622", terminals: "TB52 9/2, 8.A+/1, 9.A-/1, 20/2" }
        ],
        [{ pdfPage: 68, sheet: "68/71", section: "Cable assignment list" }, { pdfPage: 65, sheet: "65/71", section: "Terminal strip +KA" }],
        "The loop-buffer fault is supervised from PE621 and PE622 in PLC logic. The archived APL cable list independently identifies those exact devices as the front and rear feed-unit sensors and gives their TB52 routes.",
        "Observe sensor state from a safe position; isolate motion before alignment, cleaning inside guarded areas, or wiring work.",
        "High-confidence archived hardware match because both PLC tag designations and drawing device numbers agree."
      ),
      27: circuit(
        "apl-cart-k605576",
        "archived-device-cable-bound",
        "high-archive-match",
        ["E5701_PE621_FeedUnitFront", "E5701_PE622_FeedUnitRear"],
        [
          { device: "PE621", description: "Feed unit at the front", area: "+AB", cable: "5701-W621", terminals: "TB52 8/2, 7.A+/1, 7.A-/1, 20/1" },
          { device: "PE622", description: "Feed unit rear", area: "+AB", cable: "5701-W622", terminals: "TB52 9/2, 8.A+/1, 9.A-/1, 20/2" }
        ],
        [{ pdfPage: 68, sheet: "68/71", section: "Cable assignment list" }, { pdfPage: 65, sheet: "65/71", section: "Terminal strip +KA" }],
        "Invalid Sensor Status LB Feed Unit is the PLC plausibility check on the same PE621/PE622 pair. The electrical archive gives the physical front/rear sensor and terminal routes for both devices.",
        "Do not simulate or force sensor states as a troubleshooting shortcut. Verify actual target, alignment, contamination and wiring safely.",
        "High-confidence archived device/cable match."
      ),
      60: circuit(
        "apl-cart-k605576",
        "archived-device-cable-bound",
        "high-archive-match",
        ["E5701_PE603_DiameterRewindUnit"],
        [{ device: "PE603", description: "Diameter rewind unit", area: "+AU", cable: "5701-W603", terminals: "TB52 5/1, 4.A+/2, 4.A-/1, 18/2" }],
        [{ pdfPage: 68, sheet: "68/71", section: "Cable assignment list" }, { pdfPage: 65, sheet: "65/71", section: "Terminal strip +KA" }],
        "The PLC rewind-full supervision uses E5701_PE603_DiameterRewindUnit. The archived APL cable list identifies PE603 as the rewind-unit diameter sensor and gives cable 5701-W603/TB52 routing.",
        "Stop and isolate rewind motion before sensor adjustment or wiring work.",
        "Archived APL Cart device/cable match."
      )
    });

    const LABELER = Object.freeze({
      670: circuit(
        "autocol-k747993",
        "corroborative-only",
        "architecture-reference-only",
        ["E1701_ENC101_FineClockPulse"],
        [{ device: "ENC101 / CVTR101", description: "Encoder and converter fine-clock path in Autocol reference", area: "=ETB4.1701", cable: ".1701-W101", terminals: "ENC101 ↔ CVTR101; CVTR101 FT/GT ↔ I/O031" }],
        [{ pdfPage: 128, sheet: "128/551", section: "Encoder wiring" }, { pdfPage: 135, sheet: "135/551", section: "Fine clock pulse" }, { pdfPage: 497, sheet: "497/551", section: "Cable assignment list" }],
        "The Autocol electrical reference shows ENC101 connected to CVTR101 by .1701-W101 and routes CVTR101 fine-clock/clock outputs to I/O. This supports the general Krones hardware architecture behind fine-clock monitoring, but it is not the TopModul drawing for Fault 670.",
        "Treat the encoder circuit as safety-related motion feedback. Do not bypass monitoring; use qualified electrical diagnostics and approved safe-work procedures.",
        "Corroborative only. An exact TopModul Labeler electrical drawing has not been supplied in the troubleshooting archive or located in the configured Drive/File Library, so ServoForge must not claim an exact terminal/page for the installed TopModul."
      )
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
      for (const offset of [3, 4, 9, 10, 20, 23, 26, 27, 60]) {
        const entry = getStationFaultTemplate(offset);
        if (!entry?.circuitTrace) errors.push(`Station offset ${offset} lost its circuit trace.`);
        if (entry?.circuitTrace?.source?.drawing !== "K605576-001") errors.push(`Station offset ${offset} lost K605576 source provenance.`);
      }
      const fine = getTopModulFault(670)?.circuitTrace;
      if (!fine || fine.status !== "corroborative-only") errors.push("Fault 670 must remain corroborative-only until an exact TopModul Labeler drawing is supplied.");
      if (fine?.source?.machineModel !== "Autocol") errors.push("Fault 670 corroborative reference must retain its Autocol source identity.");
      if (!getStationFaultTemplate(26)?.circuitTrace?.deviceRows?.some((row) => row.device === "PE621")) errors.push("Feed-unit circuit trace lost PE621.");
      if (!getStationFaultTemplate(26)?.circuitTrace?.deviceRows?.some((row) => row.device === "PE622")) errors.push("Feed-unit circuit trace lost PE622.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+topmodul-circuit-trace-v1`,
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
