"use strict";

(function installTopModulStationPowerCircuit(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationPowerCircuitExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getStationFaultTemplate || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul exact circuit tracing is required before Station power tracing.");
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

    const STATION_POWER = Object.freeze({
      5: circuit(
        "machine-specific-command-feedback-circuit-bound",
        "exact-cart-plc-and-drawing-match-with-alias-name-exception",
        ["E2001_C101_ServoPowerSupply", "O0007.11", "E2001_CB101_ServoPowerSupply", "I0005.22", "TON_MonitorMainContactor"],
        [
          { device: "C101", description: "Servodrive mains contactor", area: "+KA", cable: "2001 control circuit", terminals: "Coil A1/A2 commanded by O0007.11; auxiliary contact 61-62 returns to I0005.22" },
          { device: "LS143 / CR204 / AFD101", description: "Series safety/enable path ahead of C101 coil", area: "+ETS / +KA", cable: "2001-W143 and control wiring", terminals: "O0007.11 -> TB52 -> LS143 -> CR204 13-14 / AFD101 enable -> C101 coil" }
        ],
        [{ pdfPage: 47, sheet: "55/72", section: "Servodrive mains contactor command and check-back" }],
        "Cart Fault 005 is a 1500 ms command/feedback disagreement around the servodrive mains contactor. The PLC commands C101 with O0007.11 and monitors I0005.22. K605163-001 shows I0005.22 coming from C101 auxiliary contact 61-62. The PLC alias calls that feedback E2001_CB101_ServoPowerSupply even though the drawing identifies the monitored device as C101; ServoForge preserves that naming difference. If C101 does not energize, follow the command/series-permissive side. If C101 energizes but I0005.22 does not follow, focus on the auxiliary contact, wiring and input channel.",
        "Do not jumper LS143, C101 feedback or any safety/enable device. Prevent unexpected servo motion and use qualified electrical personnel for energized measurements.",
        "Shared Station method. The station number only changes which Labeler fault block receives local Cart Fault 005."
      ),
      6: circuit(
        "machine-specific-protection-monitor-circuit-bound",
        "exact-cart-plc-and-drawing-match-with-device-role-exception",
        ["E2001_CB104_FuseServo", "I0005.20", "Faults[0].6"],
        [
          { device: "CB104", description: "6 A servodrive control-section protection", area: "+KA", cable: "2001 control circuit", terminals: "Supplies AFD101 CTRL1 on K605163 sheet 55" },
          { device: "CR104", description: "Servodrive overcurrent/protection status contact", area: "+KA", cable: "2001 control circuit", terminals: "Contact 3-4 -> I/O031 I0005.20" }
        ],
        [{ pdfPage: 47, sheet: "55/72", section: "Servodrive control supply and I0005.20 protection status" }],
        "Cart Fault 006 is directly produced when PLC input I0005.20 is not healthy. The PLC alias names that signal E2001_CB104_FuseServo. K605163-001 shows CB104 as the 6 A servodrive control-section protective device, while I0005.20 itself is fed through CR104 contact 3-4 and labeled servodrive overcurrent. ServoForge therefore routes the check through the complete CB104/CR104 protection path instead of assuming the breaker handle alone proves the input state.",
        "Do not defeat the protection contact or substitute a jumper. De-energize before continuity/wiring work; energized checks require qualified electrical personnel.",
        "PLC and drawing agree on I0005.20, but the PLC alias and drawing split the protection function between CB104 and CR104. Both designations are retained."
      ),
      7: circuit(
        "machine-specific-series-breaker-monitor-bound",
        "exact-cart-plc-and-drawing-match",
        ["E0301_CB202_FuseFeedRewindUnit", "I0005.21", "Faults[0].7"],
        [
          { device: "CB211", description: "Feed-unit control-voltage breaker", area: "+KA", cable: "0301 control voltage", terminals: "Auxiliary contact 11-14 in series monitoring chain" },
          { device: "CB202", description: "Rewind/feed control-voltage breaker", area: "+KA", cable: "0301 control voltage", terminals: "Auxiliary contact 11-14 in series with CB211 -> I/O031 I0005.21" }
        ],
        [{ pdfPage: 26, sheet: "21/72", section: "24 VDC feed/rewind control voltage monitoring" }],
        "Cart Fault 007 is directly produced from I0005.21. Although the PLC tag is named E0301_CB202_FuseFeedRewindUnit, K605163-001 shows the healthy feedback path to I0005.21 passing through CB211 and CB202 auxiliary contacts in series. An open/tripped condition at either breaker can remove the PLC signal, so the troubleshooting method checks both before moving downstream.",
        "Isolate the feed/rewind electrical section before breaker or wiring work. Do not bridge either monitored breaker contact.",
        "This is a useful drawing-level expansion beyond the PLC alias: one PLC signal represents a two-breaker series chain."
      ),
      9: circuit(
        "machine-specific-drive-ready-revision-aware-bound",
        "exact-cart-plc-and-drawing-match-with-io-transition",
        ["E5701_MTR611_FeedUnitReady", "I0005.07", "I0005.25", "E5701_MTR611_FeedUnitRelease", "O0007.09", "tonFaultFeedUnit"],
        [
          { device: "MTR611", description: "Feed-unit motor/drive interface", area: "+AB", cable: "5701-W611", terminals: "Drawing malfunction/status -> I/O031 I0005.07; release command O0007.09; C101 83-84 in ready/control feed" },
          { device: "I0005.25", description: "PLC compatibility input for feed-unit ready", area: "Cart PLC", cable: "Installed-revision dependent", terminals: "Current L5K accepts I0005.07 OR I0005.25 into E5701_MTR611_FeedUnitReady" }
        ],
        [{ pdfPage: 53, sheet: "61/72", section: "Feed unit MTR611 ready/release/malfunction interface" }],
        "Cart Fault 009 is latched after the feed-unit ready condition remains false through its timer. The current Cart 1 L5K contains an installation-transition rung that accepts either I0005.07 or I0005.25 as E5701_MTR611_FeedUnitReady; its own comment says the final alias was intended to be I0005.07. K605163-001 shows the MTR611 malfunction/status conductor on I0005.07. ServoForge therefore treats I0005.07 as the drawing-backed channel and I0005.25 as a PLC-supported compatibility channel that must be confirmed against the installed cart revision.",
        "Prevent unexpected feed-unit motion before touching MTR611 or its wiring. Do not force either input to clear the fault.",
        "This shared method intentionally handles legacy/current I/O assignment variation without creating separate Station 1-6 procedures."
      ),
      10: circuit(
        "machine-specific-drive-ready-revision-aware-bound",
        "exact-cart-plc-and-drawing-match-with-io-transition",
        ["E5701_MTR601_RewindUnitReady", "I0005.06", "I0005.24", "E5701_MTR601_RewindUnitRelease", "O0007.03", "tonFaultRewindUnit"],
        [
          { device: "MTR601", description: "Rewind-unit motor/drive interface", area: "+AU", cable: "5701-W601", terminals: "Drawing malfunction/status -> I/O031 I0005.06; release command O0007.03; C101 73-74 in ready/control feed" },
          { device: "I0005.24", description: "PLC compatibility input for rewind-unit ready", area: "Cart PLC", cable: "Installed-revision dependent", terminals: "Current L5K accepts I0005.06 OR I0005.24 into E5701_MTR601_RewindUnitReady" }
        ],
        [{ pdfPage: 52, sheet: "60/72", section: "Rewind unit MTR601 ready/release/malfunction interface" }],
        "Cart Fault 010 is latched after the rewind-unit ready condition remains false through its timer. The current Cart 1 L5K accepts either I0005.06 or I0005.24 as E5701_MTR601_RewindUnitReady and comments that the final alias was intended to move to I0005.06. K605163-001 shows the MTR601 malfunction/status conductor on I0005.06. ServoForge keeps I0005.24 as a revision-aware compatibility path rather than presenting both inputs as equivalent installed wiring.",
        "Stop and isolate rewind motion and stored mechanical energy before servicing MTR601 or its wiring. Do not force the ready input.",
        "Shared Station method with revision-aware I/O; station instance remains a parameter, not a duplicated procedure."
      )
    });

    function traceForEntry(entry) {
      if (!entry?.plcFault || entry.diagnosticScope !== "Station") return null;
      return STATION_POWER[Number(entry.stationTemplateOffset)] || null;
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
      for (const offset of [5, 6, 7, 9, 10]) {
        const trace = getStationFaultTemplate(offset)?.circuitTrace;
        if (!trace) errors.push(`Station power offset ${offset} lost its circuit trace.`);
        if (trace?.source?.drawing !== "K605163-001") errors.push(`Station power offset ${offset} lost K605163 source provenance.`);
      }
      const mainContactor = getStationFaultTemplate(5)?.circuitTrace;
      if (!mainContactor?.deviceRows?.some((row) => row.device === "C101")) errors.push("Fault 005 lost C101 command/feedback evidence.");
      if (!mainContactor?.plcSignals?.includes("I0005.22")) errors.push("Fault 005 lost I0005.22 feedback binding.");
      const servoProtection = getStationFaultTemplate(6)?.circuitTrace;
      if (!servoProtection?.deviceRows?.some((row) => row.device === "CB104")) errors.push("Fault 006 lost CB104 evidence.");
      if (!servoProtection?.deviceRows?.some((row) => row.device === "CR104")) errors.push("Fault 006 lost CR104 status evidence.");
      const feedRewind = getStationFaultTemplate(7)?.circuitTrace;
      if (!feedRewind?.deviceRows?.some((row) => row.device === "CB211")) errors.push("Fault 007 lost CB211 series evidence.");
      if (!feedRewind?.deviceRows?.some((row) => row.device === "CB202")) errors.push("Fault 007 lost CB202 series evidence.");
      if (!getStationFaultTemplate(9)?.circuitTrace?.plcSignals?.includes("I0005.25")) errors.push("Fault 009 lost compatibility input I0005.25.");
      if (!getStationFaultTemplate(10)?.circuitTrace?.plcSignals?.includes("I0005.24")) errors.push("Fault 010 lost compatibility input I0005.24.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+station-power-circuit-v1`,
      getEntry,
      getTopModulFault,
      getStationFaultTemplate,
      getStationFaultVariant,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      topModulStationPowerCircuitOffsets: Object.freeze([5, 6, 7, 9, 10]),
      validate
    });
  };
});
