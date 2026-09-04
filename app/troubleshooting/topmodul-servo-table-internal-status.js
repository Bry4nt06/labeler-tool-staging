"use strict";

(function installTopModulServoTableInternalStatus(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulServoTableInternalStatusExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.searchEntries || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Labeler diagnostic layers are required before Servo Bottle Table internal-status tracing.");
    }

    const drawingSource = base.getTopModulCircuitSource("topmodul-k407039");
    if (!drawingSource) throw new Error("K407039 TopModul circuit source is required.");

    const plcSource = Object.freeze({
      id: "topmodul-k407039-lb1-servo-table-internal-status-l5k",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1",
      evidenceClass: "readable-labeler-plc-export",
      sourceDiscipline: "Internal positions 720-723 are taken from the supplied readable LB1 DataToStation/DataFromStation logic. Because the alarm-comment table does not name these positions, ServoForge describes the verified PLC condition rather than inventing operator-facing alarm text."
    });

    const OBSERVE = "Use normal HMI/PLC diagnostics only. Do not force Servo Bottle Table status, reset, power, ready, operating, safety, or machine-enable bits to test these conditions.";
    const LOTO = "Stop the machine and follow site lockout/tagout and stored-energy procedures before hands-on work on the Servo Bottle Table, interface wiring, connectors, drives, or guarded equipment.";
    const ELECTRICAL = "Energized electrical measurements are for qualified personnel under the site's approved electrical safe-work procedure.";
    const safety = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);
    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));

    function processTrace(status, confidence, producerSignals, calculationSteps, summary, scopeNote) {
      return Object.freeze({
        status,
        confidence,
        routine: "DataFromStation -> DataToStation",
        producerSignals: Object.freeze(producerSignals),
        calculationSteps: freezeRows(calculationSteps),
        hardwareRows: Object.freeze([]),
        drawingLocations: Object.freeze([]),
        source: plcSource,
        hardwareSource: null,
        summary,
        safetyBoundary: safety.join(" "),
        scopeNote
      });
    }

    function circuitTrace(status, confidence, plcSignals, deviceRows, summary, scopeNote) {
      return Object.freeze({
        sourceId: drawingSource.id,
        source: drawingSource,
        status,
        confidence,
        plcSignals: Object.freeze(plcSignals),
        deviceRows: freezeRows(deviceRows),
        drawingLocations: Object.freeze([{ pdfPage: 142, sheet: "142/277", section: "Servo Container Table status interface to Labeler inputs I0011.00-.07" }]),
        summary,
        safetyBoundary: safety.join(" "),
        scopeNote
      });
    }

    function evidence(logicType, rootLikelihood, roleLabel, trace, firstFaultRank, evidenceStatus = "rung-condition-bound") {
      return Object.freeze({
        routine: trace.routine,
        logicType,
        rootLikelihood,
        roleLabel,
        producerSignals: trace.producerSignals,
        logicSummary: trace.summary,
        evidenceStatus,
        firstFaultRank
      });
    }

    const sharedInterfaceSignals = Object.freeze([
      "E2301_IO0102_O1_EncoderSimulationOff = I0011.0",
      "E2301_IO0102_O2_NoFault = I0011.1",
      "E2301_IO0102_O3_NoWarning = I0011.2",
      "E2301_IO0102_O4_SystemOnline = I0011.3",
      "E2301_IO0102_O5_ServoReady = I0011.4",
      "E2301_IO0102_O6_ServoOperating = I0011.5",
      "E2301_IO0102_O7_ServoPowerEnable = I0011.6"
    ]);

    const interfaceCircuit = Object.freeze({
      720: circuitTrace(
        "servo-table-interface-bound-but-fault-output-disabled",
        "exact-k407039-input-and-disabled-plc-output",
        ["E2301_IO0102_O6_ServoOperating = I0011.5", "DataExchangeStation.OutServoOperating = XIC(E2301_IO0102_O6_ServoOperating)"],
        [{ device: "Servo Container Table O.6", description: "Servodrive in operation status", area: "=EMB1.2301 +SK", cable: "interface conductor 2301.22.61", terminals: "I/O061 I0011.05" }],
        "K407039 page 142 binds the Servo Container Table 'servodrive in operation' status to I0011.05. The dormant Fault 720 rung references the corresponding DataExchangeStation.OutServoOperating state, but AFI prevents the fault output from energizing in this revision.",
        "This hardware route documents the status input used by the disabled logic only; it does not promote Fault 720 to an active machine fault."
      ),
      721: circuitTrace(
        "servo-table-simulation-power-semantic-conflict-bound",
        "exact-k407039-input-with-plc-udt-semantic-conflict",
        ["E2301_IO0102_O1_EncoderSimulationOff = I0011.0", "DataExchangeStation.OutServoPowerOnline = XIO(E2301_IO0102_O1_EncoderSimulationOff)"],
        [{ device: "Servo Container Table O.1", description: "Drawing label: sensor simulation; L5K tag: Encoder Simulation Off", area: "=EMB1.2301 +SK", cable: "interface conductor 2301.22.11", terminals: "I/O061 I0011.00" }],
        "K407039 page 142 labels I0011.00 as 'sensor simulation', while the L5K alias calls the same input 'Encoder Simulation Off'. DataExchangeStation then inverts that input and stores it in a UDT member named OutServoPowerOnline. ServoForge retains all three source semantics instead of renaming the condition as a power failure.",
        "Do not infer a Servo Bottle Table power-terminal failure from Fault 721 alone. First compare the raw I0011.00 state, the intended simulation mode, and the Servo Table's own diagnostics."
      ),
      722: circuitTrace(
        "servo-table-system-online-input-bound",
        "exact-k407039-device-and-plc-alias",
        ["E2301_IO0102_O4_SystemOnline = I0011.3", "DataExchangeStation.OutSystemOnline = XIC(E2301_IO0102_O4_SystemOnline)"],
        [{ device: "Servo Container Table O.4", description: "System Online status", area: "=EMB1.2301 +SK", cable: "interface conductor 2301.22.41", terminals: "I/O061 I0011.03" }],
        "K407039 page 142 and the L5K agree that I0011.03 is the Servo Container Table System Online input. Internal Fault 722 is asserted when the DataExchangeStation copy of this input is false.",
        "This proves the Labeler-side interface condition. It does not identify the internal Servo Bottle Table reason that System Online is absent."
      ),
      723: circuitTrace(
        "servo-table-servo-ready-input-bound",
        "exact-k407039-device-and-plc-alias",
        ["E2301_IO0102_O5_ServoReady = I0011.4", "DataExchangeStation.OutServoReady = XIC(E2301_IO0102_O5_ServoReady)", "E0901_SS501_OperatingMode gates the direct fault condition"],
        [{ device: "Servo Container Table O.5", description: "Servodrive Ready status", area: "=EMB1.2301 +SK", cable: "interface conductor 2301.22.51", terminals: "I/O061 I0011.04" }],
        "K407039 page 142 and the L5K agree that I0011.04 is Servo Ready. Internal Fault 723 requires that status to be false while the PLC operating-mode bit E0901_SS501_OperatingMode is true.",
        "The PLC tag/rung semantics identify E0901_SS501_OperatingMode true as Run, but v344 preserves a contradictory drawing polarity annotation for SS501. The executable PLC condition remains authoritative for this software revision."
      )
    });

    const trace720 = processTrace(
      "disabled-internal-watchdog-path-afi",
      "exact-plc-producer-disabled-by-afi",
      [
        "EQU(WatchdogErrorMessage,10)",
        "XIO(DataExchangeStation.OutServoOperating)",
        "XIC(Faults_LB1[45].0) XIO(ControlOut.ResetGeneral) [self-hold branch]",
        "XIC(E2001_MS101_MainDriveOverload)",
        "AFI()",
        "OTE(Faults_LB1[45].0)"
      ],
      [
        { label: "Intended direct condition", value: "WatchdogErrorMessage equals 10 while DataExchangeStation.OutServoOperating is false." },
        { label: "Additional permissive", value: "E2001_MS101_MainDriveOverload must be true." },
        { label: "Disabled output", value: "AFI() is immediately upstream of OTE(Faults_LB1[45].0), so the rung cannot energize Fault 720 in the supplied LB1 revision." },
        { label: "Source interpretation", value: "If a live machine presents an active 720, verify software/project revision and online logic first; do not borrow the dormant intended condition as a proven cause." }
      ],
      "Faults_LB1[45].0 has producer logic, but AFI disables the only output path in the supplied revision. ServoForge retains the dormant watchdog condition for engineering provenance while classifying 720 as disabled, not active.",
      "No operator-facing COMMENT name exists for position 720. The title is an internal diagnostic description only."
    );

    const trace721 = processTrace(
      "active-unnamed-dataexchange-status-with-semantic-conflict",
      "exact-plc-producer-with-source-naming-conflict",
      [
        "E2301_IO0102_O1_EncoderSimulationOff = I0011.0",
        "XIO(E2301_IO0102_O1_EncoderSimulationOff) OTE(DataExchangeStation.OutServoPowerOnline)",
        "XIC(DataExchangeStation.OutServoPowerOnline) OTE(Faults_LB1[45].1)",
        "XIC(Faults_LB1[45].1) XIC(DataExchangeStation.StationControlOutReset) [self-hold]",
        "XIO(ControlOut.ResetGeneral) OTE(DataExchangeStation.StationControlOutReset)",
        "Data_To_HMI_Labeler85_1[1009].7 = DataExchangeStation.OutServoPowerOnline"
      ],
      [
        { label: "Raw input", value: "I0011.00 is L5K E2301_IO0102_O1_EncoderSimulationOff; K407039 page 142 labels the interface signal 'sensor simulation'." },
        { label: "DataExchange mapping", value: "The PLC inverts that input with XIO and writes the result to a UDT member named OutServoPowerOnline, whose UDT description says servo power is on at the connecting terminal." },
        { label: "Fault producer", value: "Fault 721 is directly true when DataExchangeStation.OutServoPowerOnline is true. Therefore the executable condition is I0011.00 false, despite the UDT power-oriented member name." },
        { label: "Self-hold / reset", value: "The hold branch uses StationControlOutReset, and that tag is true while ControlOut.ResetGeneral is false. A normal General Reset can release the hold only after the direct condition is no longer true." },
        { label: "Diagnostic rule", value: "Treat the raw input/polarity as authoritative. Do not replace servo power hardware solely because the intermediate UDT member is named OutServoPowerOnline." }
      ],
      "Internal Fault 721 is an active unnamed DataExchange status, but its source semantics conflict: the raw interface is Encoder Simulation Off / sensor simulation, the mapping is inverted, and the destination member is named OutServoPowerOnline. ServoForge therefore diagnoses the exact boolean path without inventing a 'servo power' alarm name.",
      "No operator-facing COMMENT name exists for position 721. The raw I0011.00 state and the Servo Table's own simulation/power diagnostics must resolve the semantic conflict."
    );

    const trace722 = processTrace(
      "active-unnamed-system-online-missing-status",
      "exact-plc-producer-and-exact-interface-input",
      [
        "E2301_IO0102_O4_SystemOnline = I0011.3",
        "XIC(E2301_IO0102_O4_SystemOnline) OTE(DataExchangeStation.OutSystemOnline)",
        "XIO(DataExchangeStation.OutSystemOnline) OTE(Faults_LB1[45].2)",
        "XIC(Faults_LB1[45].2) XIC(DataExchangeStation.StationControlOutReset) [self-hold]",
        "XIO(ControlOut.ResetGeneral) OTE(DataExchangeStation.StationControlOutReset)"
      ],
      [
        { label: "Raw status", value: "Servo Container Table System Online is I0011.03." },
        { label: "DataExchange copy", value: "XIC(I0011.03) drives DataExchangeStation.OutSystemOnline without inversion." },
        { label: "Fault producer", value: "XIO(DataExchangeStation.OutSystemOnline) directly drives Faults_LB1[45].2. The fault condition is therefore System Online absent." },
        { label: "Self-hold / reset", value: "Once active, the hold branch persists while ControlOut.ResetGeneral is false. Normal General Reset can release it after System Online has returned." },
        { label: "Scope", value: "The Labeler proves only that the external System Online interface is absent. Internal Servo Table controller/drive/network root cause remains outside this single status bit." }
      ],
      "Internal Fault 722 is an active unnamed System Online missing state for the Servo Container Table interface. The raw Labeler input and K407039 circuit are exact; the external reason System Online is absent must come from the Servo Table/RPC diagnostics.",
      "No operator-facing COMMENT name exists for position 722; this descriptive title is derived from the verified producer and interface signal."
    );

    const trace723 = processTrace(
      "active-unnamed-servo-ready-missing-run-mode-status",
      "exact-plc-producer-and-exact-interface-input",
      [
        "E2301_IO0102_O5_ServoReady = I0011.4",
        "XIC(E2301_IO0102_O5_ServoReady) OTE(DataExchangeStation.OutServoReady)",
        "XIO(DataExchangeStation.OutServoReady) XIC(E0901_SS501_OperatingMode) OTE(Faults_LB1[45].3)",
        "XIC(Faults_LB1[45].3) XIC(DataExchangeStation.StationControlOutReset) [self-hold]",
        "XIO(ControlOut.ResetGeneral) OTE(DataExchangeStation.StationControlOutReset)"
      ],
      [
        { label: "Raw status", value: "Servo Container Table Servo Ready is I0011.04." },
        { label: "DataExchange copy", value: "XIC(I0011.04) drives DataExchangeStation.OutServoReady without inversion." },
        { label: "Operating-mode gate", value: "The direct fault condition requires E0901_SS501_OperatingMode true. The L5K identifies High/true as Run; v344 retains the conflicting SS501 drawing annotation separately." },
        { label: "Fault producer", value: "Servo Ready false while the operating-mode bit is true directly drives Faults_LB1[45].3." },
        { label: "Self-hold / reset", value: "The hold branch persists while ControlOut.ResetGeneral is false. Normal General Reset can release it after the direct Ready/operating-mode condition is gone." },
        { label: "Scope", value: "Use the Servo Table/RPC fault family to determine why Servo Ready is absent before replacing Labeler-side interface hardware." }
      ],
      "Internal Fault 723 is an active unnamed Servo Ready missing condition gated by the Labeler's operating-mode bit. The interface state is exact; the external Servo Table reason for not being ready must be diagnosed from its own servo/RPC evidence.",
      "No operator-facing COMMENT name exists for position 723. The descriptive title preserves the verified condition and the existing v344 operating-mode source conflict."
    );

    const definitions = Object.freeze({
      720: Object.freeze({
        number: 720,
        title: "Internal Fault 720 — disabled DataExchange watchdog path (AFI, no HMI comment)",
        family: "Servo Bottle Table / internal DataExchange watchdog",
        trace: trace720,
        circuit: interfaceCircuit[720],
        rootLikelihood: "disabled",
        roleLabel: "Disabled internal output",
        firstFaultRank: 100,
        sourceGap: Object.freeze({ status: "internal-output-disabled-by-afi", reason: "Faults_LB1[45].0 has an intended watchdog condition, but AFI() is in series immediately before the OTE. The only supplied producer therefore cannot energize this fault bit in this LB1 revision." })
      }),
      721: Object.freeze({
        number: 721,
        title: "Internal active Fault 721 — DataExchange power/simulation status conflict (no HMI comment)",
        family: "Servo Bottle Table / internal DataExchange status",
        trace: trace721,
        circuit: interfaceCircuit[721],
        rootLikelihood: "primary",
        roleLabel: "Direct PLC producer / semantic conflict",
        firstFaultRank: 16
      }),
      722: Object.freeze({
        number: 722,
        title: "Internal active Fault 722 — Servo Table System Online missing (no HMI comment)",
        family: "Servo Bottle Table / internal DataExchange status",
        trace: trace722,
        circuit: interfaceCircuit[722],
        rootLikelihood: "primary",
        roleLabel: "Direct PLC producer / System Online",
        firstFaultRank: 12
      }),
      723: Object.freeze({
        number: 723,
        title: "Internal active Fault 723 — Servo Table Servo Ready missing in Run-state logic (no HMI comment)",
        family: "Servo Bottle Table / internal DataExchange status",
        trace: trace723,
        circuit: interfaceCircuit[723],
        rootLikelihood: "primary",
        roleLabel: "Direct PLC producer / Servo Ready",
        firstFaultRank: 12
      })
    });

    function checksFor(number) {
      if (number === 720) return [
        "Do not troubleshoot 720 as an active fault in this supplied revision; its only OTE is blocked by AFI().",
        "If a live controller shows Faults_LB1[45].0 true, verify the online project/revision and forces/status before applying this offline source model.",
        "The dormant logic references WatchdogErrorMessage 10, Servo Operating and the main-drive overload permissive; those are provenance only, not an active repair route here."
      ];
      if (number === 721) return [
        "Observe raw I0011.00 / E2301_IO0102_O1_EncoderSimulationOff first and compare it with the intended Servo Table simulation state.",
        "Observe DataExchangeStation.OutServoPowerOnline and confirm that it follows the inverse of I0011.00 in this software revision.",
        "Do not infer a power-terminal failure solely from the UDT member name OutServoPowerOnline; the drawing and raw tag identify simulation semantics.",
        "Use the Servo Bottle Table/RPC diagnostics to resolve whether the external table is intentionally in simulation or has another status/configuration issue."
      ];
      if (number === 722) return [
        "Observe I0011.03 / E2301_IO0102_O4_SystemOnline and DataExchangeStation.OutSystemOnline; both should agree without inversion.",
        "If I0011.03 is false, use the Servo Bottle Table/RPC diagnostics to determine why the external system is not online before tracing Labeler wiring.",
        "If the external system reports Online but I0011.03 remains false, then trace the page-142 interface/wiring under the approved safe-work procedure.",
        "After System Online is restored, use only the normal General Reset sequence; do not force the fault bit or status."
      ];
      return [
        "Observe I0011.04 / E2301_IO0102_O5_ServoReady and DataExchangeStation.OutServoReady; both should agree without inversion.",
        "Confirm the actual PLC operating-mode bit E0901_SS501_OperatingMode. The direct 723 condition exists only while that bit is true.",
        "Use the Servo Bottle Table/RPC diagnostics to find the specific reason Servo Ready is absent before tracing Labeler-side interface hardware.",
        "After Servo Ready and the normal operating state are restored, use only the normal General Reset sequence; do not force the fault bit or Ready status."
      ];
    }

    function probableCausesFor(number) {
      if (number === 720) return ["No active machine cause is assigned because AFI disables the output in this revision."];
      if (number === 721) return [
        "The raw Encoder Simulation Off / sensor-simulation input is false, which the DataExchange logic inverts into OutServoPowerOnline and directly uses to assert 721.",
        "The intermediate UDT name may be stale or repurposed; source naming conflict is more likely than a proven power fault from this bit alone."
      ];
      if (number === 722) return [
        "The Servo Container Table System Online input I0011.03 is absent.",
        "The external Servo Table controller/interface is not online, or the Labeler-side page-142 signal path is not receiving the online state."
      ];
      return [
        "The Servo Container Table Servo Ready input I0011.04 is absent while the Labeler operating-mode bit is true.",
        "A specific external Servo Table/RPC power, drive, communication, encoder, configuration or readiness condition may be preventing Ready; use the more specific external diagnostics to identify which one."
      ];
    }

    function makeEntry(definition) {
      const number = definition.number;
      const code = String(number);
      return Object.freeze({
        id: `topmodul-plc-internal-fault-${number}`,
        code,
        number,
        category: `TopModul PLC / ${definition.family}`,
        aliases: Object.freeze([`fault ${number}`, `internal fault ${number}`, `Faults_LB1[45].${number - 720}`, "servo bottle table internal status", "DataExchangeStation", ...(number === 721 ? ["Encoder Simulation Off", "OutServoPowerOnline", "sensor simulation"] : []), ...(number === 722 ? ["System Online", "OutSystemOnline"] : []), ...(number === 723 ? ["Servo Ready", "OutServoReady"] : []), ...(number === 720 ? ["OutServoOperating", "WatchdogErrorMessage 10", "AFI"] : [])]),
        contextHints: Object.freeze(["topmodul", "top modul", "k407039", "co85", "lb1", "servo bottle table", "container table"]),
        title: definition.title,
        summary: definition.trace.summary,
        probableCauses: Object.freeze(probableCausesFor(number)),
        checks: Object.freeze(checksFor(number)),
        actions: Object.freeze(number === 720 ? ["Do not promote or bypass the disabled path. If live behavior differs, reconcile the online controller revision with this supplied L5K before troubleshooting hardware."] : ["Correct the proven external Servo Table/status or Labeler interface condition, then use the normal reset/recovery sequence and verify the internal status does not recur."]),
        safety,
        sourceRefs: Object.freeze([
          Object.freeze({ sourceId: "topmodul-k407039-lb1-l5k", locator: `DataToStation/DataFromStation — Faults_LB1[45].${number - 720} internal position ${number}; no operator COMMENT text` }),
          Object.freeze({ sourceId: "topmodul-k407039-electrical", locator: "K407039 page 142/277 — Servo Container Table status interface I0011.00-.07" })
        ]),
        diagnosticScope: "Labeler",
        canonicalFaultId: `topmodul-plc-internal-fault-${number}`,
        plcFault: Object.freeze({ scope: "labeler", station: null, family: definition.family, array: 45, index: 45, bit: number - 720, address: `Faults_LB1[45].${number - 720}`, traceStatus: definition.rootLikelihood === "disabled" ? "internal-output-disabled-by-afi" : "active-unnamed-fault-bit-producer-bound" }),
        processTrace: definition.trace,
        circuitTrace: definition.circuit,
        labelerRungEvidence: evidence(definition.rootLikelihood === "disabled" ? "afi-disabled-internal-output" : "direct-dataexchange-status", definition.rootLikelihood, definition.roleLabel, definition.trace, definition.firstFaultRank, definition.rootLikelihood === "disabled" ? "afi-disabled-rung-output" : "rung-condition-bound"),
        ...(definition.sourceGap ? { sourceGap: definition.sourceGap } : {})
      });
    }

    const internalEntries = Object.freeze(Object.values(definitions).map(makeEntry));
    const byNumber = new Map(internalEntries.map((entry) => [entry.number, entry]));
    const byId = new Map(internalEntries.map((entry) => [entry.id, entry]));
    const entries = Object.freeze([...base.entries, ...internalEntries]);

    function getEntry(id) {
      return byId.get(String(id || "")) || base.getEntry(id);
    }

    function getTopModulFault(value) {
      const raw = String(value ?? "").trim();
      if (/^0*72[0-3]$/.test(raw)) return byNumber.get(Number(raw));
      return base.getTopModulFault(value);
    }

    function localSearchScore(entry, query, context = {}) {
      const q = base.normalize(query);
      if (!q) return 0;
      const compact = q.replaceAll(" ", "");
      let score = /^0*72[0-3]$/.test(compact) && Number(compact) === entry.number ? 500 : 0;
      if (compact === base.normalize(entry.code).replaceAll(" ", "")) score += 420;
      const text = base.normalize([entry.code, entry.title, entry.summary, ...(entry.aliases || []), ...(entry.checks || [])].join(" "));
      if (text.includes(q)) score += 100;
      for (const term of q.split(" ").filter((item) => item.length > 1)) if (text.includes(term)) score += 7;
      const ctx = base.normalize([context.machineType, context.mapName].filter(Boolean).join(" "));
      if (ctx.includes("topmodul") || ctx.includes("top modul")) score += 18;
      return score;
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const local = internalEntries.map((entry) => ({ ...entry, searchScore: localSearchScore(entry, query, context) })).filter((entry) => entry.searchScore > 0);
      const combined = [...local, ...base.searchEntries(query, context, requested + 12)];
      const seen = new Set();
      return combined.sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0) || String(a.title).localeCompare(String(b.title)))
        .filter((entry) => { if (!entry || seen.has(entry.id)) return false; seen.add(entry.id); return true; })
        .slice(0, requested);
    }

    function searchTopModulFaults(query, limit = 20) {
      const requested = Math.max(1, Number(limit) || 20);
      const local = internalEntries.map((entry) => ({ ...entry, searchScore: localSearchScore(entry, query, { machineType: "TopModul" }) })).filter((entry) => entry.searchScore > 0);
      const existing = base.searchTopModulFaults ? base.searchTopModulFaults(query, requested + 8) : [];
      const seen = new Set();
      return [...local, ...existing].sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0) || Number(a.number || 0) - Number(b.number || 0))
        .filter((entry) => { if (!entry || seen.has(entry.id)) return false; seen.add(entry.id); return true; })
        .slice(0, requested);
    }

    function getTopModulProcessTrace(value) {
      const entry = typeof value === "object" && value ? value : getTopModulFault(value) || getEntry(value);
      return entry?.processTrace || base.getTopModulProcessTrace?.(value) || null;
    }

    function getTopModulCircuitTrace(value) {
      const entry = typeof value === "object" && value ? value : getTopModulFault(value) || getEntry(value);
      return entry?.circuitTrace || base.getTopModulCircuitTrace?.(value) || null;
    }

    function getTopModulFaultRelations(value, limit = 10) {
      const entry = typeof value === "object" && value ? value : getTopModulFault(value);
      if (!entry || !byNumber.has(Number(entry.number))) return base.getTopModulFaultRelations?.(value, limit) || [];
      const requested = Math.max(1, Number(limit) || 10);
      const rows = [];
      const add = (number, reason, score = 100) => {
        const related = getTopModulFault(number);
        if (related) rows.push(Object.freeze({ ...related, relationScore: score, relationReason: reason, causalRole: "shared-interface", causalRoleLabel: "Same DataExchange interface" }));
      };
      if (entry.number === 720) add(661, "Fault 661 uses the same ErrorWatchdog message 10 family with a different malfunction condition; 720 itself is AFI-disabled and does not cause 661.", 90);
      else {
        for (const number of [721, 722, 723]) if (number !== entry.number) add(number, "Same Servo Container Table DataExchange interface and reset-hold pattern; no causal direction is asserted.", 80);
      }
      return rows.slice(0, requested);
    }

    function getTopModulFirstFaultCandidates(value, limit = 8) {
      const entry = typeof value === "object" && value ? value : getTopModulFault(value);
      if (entry && byNumber.has(Number(entry.number))) return [];
      return base.getTopModulFirstFaultCandidates?.(value, limit) || [];
    }

    function getTopModulFaultDrillDown(value, limit = 10) {
      const entry = typeof value === "object" && value ? value : getTopModulFault(value);
      if (!entry || !byNumber.has(Number(entry.number))) return base.getTopModulFaultDrillDown?.(value, limit) || null;
      return Object.freeze({
        entry,
        station: null,
        family: entry.plcFault.family,
        traceStatus: entry.plcFault.traceStatus,
        related: getTopModulFaultRelations(entry, limit),
        firstFaultCandidates: Object.freeze([]),
        processTrace: entry.processTrace,
        circuitTrace: entry.circuitTrace,
        sourceGap: entry.sourceGap || null,
        prompt: entry.number === 720
          ? "Position 720 is disabled by AFI in this revision. Reconcile online software if a live controller behaves differently before troubleshooting the dormant condition."
          : "These positions are active internal DataExchange statuses without operator-facing COMMENT names. Use the raw I0011 status, exact boolean producer and Servo Bottle Table/RPC diagnostics before replacing hardware."
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      if (Number(base.topModulNamedFaultCount || 0) !== 515) errors.push(`v354 expected 515 operator-named faults before adding unnamed positions, found ${base.topModulNamedFaultCount}.`);
      for (const number of [720, 721, 722, 723]) if (base.getTopModulFault(number)) errors.push(`v354 internal position ${number} collides with an earlier catalog entry.`);
      const f720 = getTopModulFault(720);
      if (f720?.labelerRungEvidence?.rootLikelihood !== "disabled" || !f720?.sourceGap) errors.push("Fault 720 must remain AFI-disabled with explicit source-gap metadata.");
      if (!f720?.processTrace?.producerSignals?.includes("AFI()")) errors.push("Fault 720 lost AFI evidence.");
      const f721 = getTopModulFault(721);
      if (!f721?.processTrace?.producerSignals?.includes("XIO(E2301_IO0102_O1_EncoderSimulationOff) OTE(DataExchangeStation.OutServoPowerOnline)")) errors.push("Fault 721 lost inverted Encoder Simulation Off mapping.");
      if (!/semantic conflict/i.test(f721?.processTrace?.status || "")) errors.push("Fault 721 must preserve its source semantic conflict.");
      const f722 = getTopModulFault(722);
      if (!f722?.processTrace?.producerSignals?.includes("XIO(DataExchangeStation.OutSystemOnline) OTE(Faults_LB1[45].2)")) errors.push("Fault 722 lost System Online missing producer.");
      const f723 = getTopModulFault(723);
      if (!f723?.processTrace?.producerSignals?.includes("XIO(DataExchangeStation.OutServoReady) XIC(E0901_SS501_OperatingMode) OTE(Faults_LB1[45].3)")) errors.push("Fault 723 lost Servo Ready / operating-mode producer.");
      for (const number of [720, 721, 722, 723]) {
        const entry = getTopModulFault(number);
        if (!entry?.circuitTrace?.drawingLocations?.some((row) => Number(row.pdfPage) === 142)) errors.push(`Internal position ${number} lost K407039 page 142 evidence.`);
        if (!/no HMI comment/i.test(entry?.title || "")) errors.push(`Internal position ${number} must remain visibly unnamed at HMI-comment level.`);
      }
      if (getTopModulFault(722)?.circuitTrace?.deviceRows?.[0]?.terminals !== "I/O061 I0011.03") errors.push("Fault 722 lost exact I0011.03 System Online input.");
      if (getTopModulFault(723)?.circuitTrace?.deviceRows?.[0]?.terminals !== "I/O061 I0011.04") errors.push("Fault 723 lost exact I0011.04 Servo Ready input.");
      if (base.topModulActiveUnnamedAlarmPositions && !base.topModulActiveUnnamedAlarmPositions.includes(699)) errors.push("v354 lost earlier active unnamed Fault 699 metadata.");
      if (base.getTopModulFault(699)?.plcFault?.address !== "Faults_LB1[43].11") errors.push("v354 disturbed internal Fault 699 authority.");
      return { ok: errors.length === 0, errors };
    }

    const activeUnnamed = Object.freeze([...new Set([...(base.topModulActiveUnnamedAlarmPositions || []), 721, 722, 723])].sort((a, b) => a - b));
    const disabledUnnamed = Object.freeze([...new Set([...(base.topModulDisabledUnnamedAlarmPositions || []), 720])].sort((a, b) => a - b));

    return Object.freeze({
      ...base,
      version: `${base.version}+servo-table-internal-status-v1`,
      entries,
      getEntry,
      getTopModulFault,
      searchEntries,
      searchTopModulFaults,
      getTopModulProcessTrace,
      getTopModulCircuitTrace,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      topModulNamedFaultCount: base.topModulNamedFaultCount,
      topModulActiveUnnamedAlarmPositions: activeUnnamed,
      topModulDisabledUnnamedAlarmPositions: disabledUnnamed,
      topModulServoTableInternalStatusPositions: Object.freeze([720, 721, 722, 723]),
      topModulServoTableInterfaceSignals: sharedInterfaceSignals,
      validate
    });
  };
});
