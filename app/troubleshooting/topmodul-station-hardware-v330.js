"use strict";

(function installTopModulStationHardwareV330(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationHardwareV330Extension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getStationFaultTemplate || !base?.getTopModulCircuitSource || !base?.getTopModulFaultDrillDown) {
      throw new Error("TopModul exact circuit trace v2 is required before Station hardware v330.");
    }

    const source = base.getTopModulCircuitSource("apl-cart-k605163");
    if (!source) throw new Error("K605163 APL Cart circuit source is required.");

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const circuit = (status, confidence, plcSignals, deviceRows, drawingLocations, summary, safetyBoundary, scopeNote) => Object.freeze({
      sourceId: source.id,
      source,
      status,
      confidence,
      plcSignals: Object.freeze(plcSignals),
      deviceRows: freezeRows(deviceRows),
      drawingLocations: freezeRows(drawingLocations),
      summary,
      safetyBoundary,
      scopeNote
    });

    const STATION_HARDWARE = Object.freeze({
      5: circuit(
        "machine-specific-command-feedback-circuit-bound",
        "exact-cart-plc-and-drawing-match",
        ["E2001_C101_ServoPowerSupply", "O0007.11", "E2001_CB101_ServoPowerSupply", "I0005.22", "TON_MonitorMainContactor", "Faults[0].5"],
        [
          { device: "C101", description: "Servo-drive mains contactor and auxiliary check-back", area: "+KA", cable: "internal cabinet/safety-chain wiring", terminals: "Command O0007.11; auxiliary check-back I0005.22; C101 auxiliary 61-62 shown on drawing" },
          { device: "LS143 / CR204 / AFD101 control chain", description: "Series permissive path between the PLC command and contactor coil", area: "+KA / +ETS", cable: "2001-W143 and internal control wiring", terminals: "Safety/permissive chain shown on K605163 sheet 47" }
        ],
        [{ pdfPage: 47, sheet: "47/72", section: "Servodrive mains contactor C101 command/check-back and safety chain" }],
        "Station Main Contactor Fault is not a generic contactor alarm. Cart 1 logic supervises the C101 command and its check-back for 1500 ms; K605163-001 shows O0007.11 driving the contactor through the station safety/permissive chain and C101 auxiliary feedback returning on I0005.22. Compare command and feedback state before replacing hardware.",
        "The servodrive contactor circuit can contain hazardous voltage and stored servo energy. Do not jumper LS143, CR204, C101 feedback, or any safety/permissive device. Hands-on work requires approved LOTO; energized measurements are for qualified electrical personnel only.",
        "The C101 auxiliary contact is used as a check-back signal, so its electrical sense may be complementary to the command. ServoForge reports the PLC comparison instead of assuming a normally-open feedback convention."
      ),
      6: circuit(
        "machine-specific-discrete-breaker-input-bound",
        "exact-cart-plc-and-drawing-match",
        ["E2001_CB104_FuseServo", "I0005.20", "Faults[0].6"],
        [{ device: "CB104", description: "Servodrive logic/control-voltage circuit breaker", area: "+KA", cable: "internal cabinet wiring", terminals: "CB104 auxiliary/check-back -> I/O031 input I0005.20" }],
        [{ pdfPage: 47, sheet: "47/72", section: "Servodrive CB104 and I0005.20 check-back" }],
        "Fault 006 is direct: Cart 1 executes XIO(E2001_CB104_FuseServo) and asserts Faults[0].6 when I0005.20 is not healthy. K605163-001 shows CB104's monitored contact tied to that PLC input.",
        "De-energize and determine why the breaker opened before resetting or servicing the circuit. Do not defeat the auxiliary/check-back input.",
        "This trace identifies the monitored CB104 circuit; it does not establish the electrical cause of a trip."
      ),
      7: circuit(
        "machine-specific-series-breaker-checkback-bound",
        "exact-cart-plc-and-drawing-match-with-series-monitor",
        ["E0301_CB202_FuseFeedRewindUnit", "I0005.21", "Faults[0].7"],
        [
          { device: "CB202", description: "Feed/rewind control-voltage breaker monitored in the PLC input chain", area: "+KA", cable: "internal cabinet wiring", terminals: "Auxiliary contact is in the series path to I0005.21" },
          { device: "CB211", description: "Companion feed/rewind control-voltage breaker in the same monitored series chain", area: "+KA", cable: "internal cabinet wiring", terminals: "Auxiliary contact is in series with CB202 before I0005.21" }
        ],
        [{ pdfPage: 26, sheet: "26/72", section: "CB211 + CB202 series check-back to I0005.21" }],
        "Fault 007 is driven directly by XIO(E0301_CB202_FuseFeedRewindUnit). The PLC tag names CB202, but K605163-001 shows the health input I0005.21 passing through the auxiliary contacts of CB211 and CB202 in series. Therefore either open/tripped breaker contact can make the single PLC tag appear unhealthy.",
        "Do not repeatedly reset a breaker without identifying the trip cause. Isolate energy before circuit work; energized diagnosis is restricted to qualified electrical personnel.",
        "Important source detail: the PLC tag is singular (`CB202`) while the electrical drawing proves the input supervises two series breaker contacts (`CB211` and `CB202`). ServoForge preserves that broader physical path."
      ),
      28: circuit(
        "machine-specific-analog-dancer-feedback-bound",
        "exact-cart-plc-and-drawing-match",
        ["E5701_P602_RewinderUnitActualValue", "Local:9:I.In[0].Data", "ComputedRewindUnitActualValue", "Rewinder.x", "Rewinder.dx", "Rewinder.enable", "Faults[1].12"],
        [{ device: "P602", description: "Analog rewinder dancer/arm position sensor", area: "+AU", cable: "5701-W602", terminals: "TB52 2.A+/2, 3.A-/1, 3/2, 18/1 -> I/O051 analog input IN-0" }],
        [{ pdfPage: 52, sheet: "52/72", section: "Rewind-unit P602 actual-value input and MTR601" }, { pdfPage: 68, sheet: "68/72", section: "Cable list for 5701-W602 / P602" }],
        "Rewinder Web Jam Fault 028 is produced by the RewindUnit algorithm, not a dedicated 'web jam switch'. P602 supplies the 0-20 mA dancer-arm position through Local:9:I.In[0].Data. The PLC derives Rewinder.x/dx and can latch Faults[1].12 when the arm/control response remains inconsistent across machine pulses or when the arm is judged fixed. Start with the live P602 value and actual dancer motion before replacing the rewind motor.",
        "Prevent unexpected rewind/servo motion before touching the dancer arm, sensor, web path, or wiring. Analog measurements inside the cabinet require qualified electrical practices.",
        "PLC thresholds and pulse counts are revision-specific diagnostic evidence, not recommended adjustment values. Do not alter them merely to suppress the fault."
      ),
      29: circuit(
        "machine-specific-analog-web-break-supervision-bound",
        "exact-cart-plc-and-drawing-match",
        ["E5701_P602_RewinderUnitActualValue", "Local:9:I.In[0].Data", "ComputedRewindUnitActualValue", "Rewinder.enable", "WebBreakTime", "Faults[1].13"],
        [{ device: "P602", description: "Analog rewinder dancer/arm position sensor used for web-break supervision", area: "+AU", cable: "5701-W602", terminals: "TB52 2.A+/2, 3.A-/1, 3/2, 18/1 -> I/O051 analog input IN-0" }],
        [{ pdfPage: 52, sheet: "52/72", section: "Rewind-unit P602 actual-value input" }, { pdfPage: 68, sheet: "68/72", section: "Cable list for 5701-W602 / P602" }],
        "Rewinder Web Break After Head Fault 029 is also inferred from dancer feedback rather than a separate web-break photoeye. In Cart 1 logic, while the rewinder is enabled, ComputedRewindUnitActualValue remaining above the programmed 29000 threshold increments WebBreakTime; after the programmed count exceeds 1000 (with Run Without Labels inactive), Faults[1].13 latches. Verify real web condition, dancer travel, and P602 analog feedback together.",
        "Stop/isolate rewind motion before entering the web path or adjusting P602. Do not change the threshold or timer to mask a mechanical or sensor problem.",
        "The numeric threshold/count are documented PLC-revision behavior only. Field validation should determine whether the web is actually broken, the dancer is pinned, or the analog feedback is inaccurate."
      ),
      30: circuit(
        "machine-specific-encoder-optocoupler-circuit-bound",
        "exact-cart-plc-and-drawing-match",
        ["E2001_OPTO131_ClockPulse", "Local:5:I.Data.9", "E2001_OPTO132_FineClockPulse", "Local:5:I.Data.10", "BaseMachineEncoderAxis.ActualPosition", "Faults[1].14"],
        [
          { device: "CN131", description: "Station machine-encoder connector/harness", area: "+AC", cable: "2001-W131", terminals: "Encoder/high-res clock conductors route from CN131 into the cart cabinet" },
          { device: "OPTO131", description: "Machine encoder clock-pulse optocoupler", area: "+KA", cable: "CN131 internal conductors", terminals: "Output -> I/O031 I0005.09 / Local:5:I.Data.9" },
          { device: "OPTO132", description: "Machine encoder fine-clock optocoupler", area: "+KA", cable: "CN131 internal conductors", terminals: "Output -> I/O031 I0005.10 / Local:5:I.Data.10" }
        ],
        [{ pdfPage: 50, sheet: "50/72", section: "Machine encoder CN131, OPTO131/OPTO132 and I/O031" }, { pdfPage: 68, sheet: "68/72", section: "CN131 encoder conductor/cable assignments" }],
        "Station Fault 030 'Labeler Encoder Fault' supervises the station's derived base-machine encoder position against the physical clock relationship. Cart 1 logic explicitly evaluates E2001_OPTO131_ClockPulse at expected position windows and also monitors registration-derived position difference; K605163-001 maps OPTO131 to I0005.09 and the companion fine-clock OPTO132 to I0005.10. This is the correct shared Station encoder hardware path, separate from the main Labeler ENC101/CVTR101 circuit.",
        "Encoder signals participate in synchronized servo motion. Do not bypass optocouplers, force encoder bits, or defeat synchronization monitoring. Use approved motion-prevention/LOTO procedures for physical work.",
        "OPTO131 is explicitly used by the Fault 030 monitoring rung. OPTO132 is shown because it is the paired fine-clock hardware path, but ServoForge does not claim OPTO132 alone directly sets Fault 030."
      )
    });

    function traceFor(entry) {
      if (!entry?.plcFault || entry.diagnosticScope !== "Station") return null;
      return STATION_HARDWARE[Number(entry.stationTemplateOffset)] || null;
    }

    function enrich(entry) {
      if (!entry) return entry;
      const trace = traceFor(entry);
      if (!trace) return entry;
      return Object.freeze({ ...entry, circuitTrace: trace });
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const getStationFaultTemplate = (offset) => enrich(base.getStationFaultTemplate(offset));
    const getStationFaultVariant = (offset, station) => enrich(base.getStationFaultVariant(offset, station));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);
    const getTopModulFaultRelations = (value, limit = 10) => base.getTopModulFaultRelations(value, limit).map(enrich);
    const getTopModulFirstFaultCandidates = (value, limit = 8) => base.getTopModulFirstFaultCandidates(value, limit).map(enrich);

    function resolve(value) {
      if (typeof value === "object" && value) return enrich(value);
      return getTopModulFault(value) || getEntry(value);
    }

    function getTopModulCircuitTrace(value) {
      const entry = resolve(value);
      return entry?.circuitTrace || base.getTopModulCircuitTrace?.(value) || null;
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
        circuitTrace: entry?.circuitTrace || original.circuitTrace || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      for (const offset of [5, 6, 7, 28, 29, 30]) {
        const entry = getStationFaultTemplate(offset);
        if (!entry?.circuitTrace) errors.push(`Station offset ${offset} lost v330 hardware circuit evidence.`);
        if (entry?.circuitTrace?.source?.drawing !== "K605163-001") errors.push(`Station offset ${offset} lost K605163 source authority.`);
      }
      const mainContactor = getStationFaultTemplate(5)?.circuitTrace;
      if (!mainContactor?.plcSignals?.includes("O0007.11") || !mainContactor?.plcSignals?.includes("I0005.22")) errors.push("Station main contactor trace lost C101 command/check-back I/O.");
      const breakers = getStationFaultTemplate(7)?.circuitTrace;
      if (!breakers?.deviceRows?.some((row) => row.device === "CB211") || !breakers?.deviceRows?.some((row) => row.device === "CB202")) errors.push("Feed/rewind breaker trace lost the CB211/CB202 series path.");
      const jam = getStationFaultTemplate(28)?.circuitTrace;
      if (!jam?.plcSignals?.includes("Local:9:I.In[0].Data") || !jam?.deviceRows?.some((row) => row.device === "P602")) errors.push("Rewinder web-jam trace lost P602 analog feedback.");
      const webBreak = getStationFaultTemplate(29)?.circuitTrace;
      if (!/29000/.test(webBreak?.summary || "") || !/1000/.test(webBreak?.summary || "")) errors.push("Rewinder web-break trace lost its documented supervision thresholds.");
      const encoder = getStationFaultTemplate(30)?.circuitTrace;
      if (!encoder?.plcSignals?.includes("Local:5:I.Data.9") || !encoder?.deviceRows?.some((row) => row.device === "OPTO131")) errors.push("Station encoder trace lost OPTO131 clock-pulse binding.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+topmodul-station-hardware-v330`,
      getEntry,
      getTopModulFault,
      getStationFaultTemplate,
      getStationFaultVariant,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      topModulStationHardwareV330: STATION_HARDWARE,
      validate
    });
  };
});
