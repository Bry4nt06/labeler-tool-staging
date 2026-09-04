"use strict";

(function installTopModulMachineStartIsolation(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulMachineStartIsolationExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.searchEntries || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Labeler diagnostic layers are required before machine-start isolation.");
    }

    const SOURCE = base.getTopModulCircuitSource("topmodul-k407039");
    if (!SOURCE) throw new Error("K407039 TopModul circuit source is required.");

    const PLC_SOURCE = Object.freeze({
      id: "topmodul-k407039-lb1-machine-start-l5k",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1",
      evidenceClass: "readable-labeler-plc-export",
      sourceDiscipline: "Machine-start permissives and the active unnamed Faults_LB1[43].11 producer are taken from the supplied readable LB1 L5K. Read-only observation points are separated from physical circuit evidence."
    });

    const OBSERVE = "Use normal HMI/PLC diagnostics only. Do not force Machine On, controller-enable, contactor, sensor, safety, or interlock bits to make the machine run.";
    const LOTO = "Stop the machine and follow site lockout/tagout and stored-energy procedures before hands-on work on sensors, contactors, drives, wiring, conveyors, infeed equipment, or guarded mechanical components.";
    const ELECTRICAL = "Energized electrical measurements are for qualified personnel under the site's approved electrical safe-work procedure.";
    const safety = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);
    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));

    const process = (status, confidence, routine, producerSignals, calculationSteps, hardwareRows, drawingLocations, summary, scopeNote) => Object.freeze({
      status,
      confidence,
      routine,
      producerSignals: Object.freeze(producerSignals),
      calculationSteps: freezeRows(calculationSteps),
      hardwareRows: freezeRows(hardwareRows),
      drawingLocations: freezeRows(drawingLocations),
      source: PLC_SOURCE,
      hardwareSource: hardwareRows.length ? SOURCE : null,
      summary,
      safetyBoundary: safety.join(" "),
      scopeNote
    });

    const circuit = (status, confidence, plcSignals, deviceRows, drawingLocations, summary, scopeNote) => Object.freeze({
      sourceId: SOURCE.id,
      source: SOURCE,
      status,
      confidence,
      plcSignals: Object.freeze(plcSignals),
      deviceRows: freezeRows(deviceRows),
      drawingLocations: freezeRows(drawingLocations),
      summary,
      safetyBoundary: safety.join(" "),
      scopeNote
    });

    const evidence = (routine, logicType, rootLikelihood, roleLabel, producerSignals, logicSummary, firstFaultRank = 12) => Object.freeze({
      routine,
      logicType,
      rootLikelihood,
      roleLabel,
      producerSignals: Object.freeze(producerSignals),
      logicSummary,
      evidenceStatus: "rung-condition-bound",
      firstFaultRank
    });

    const FAULT_699 = Object.freeze({
      id: "topmodul-plc-internal-fault-699",
      code: "699",
      number: 699,
      category: "TopModul PLC / Container flow / internal supervision",
      aliases: Object.freeze([
        "fault 699",
        "internal fault 699",
        "container present watchdog",
        "container present eye test",
        "containers missing",
        "PE171 container present",
        "BTL_PRES_EYE_TEST",
        "Faults_LB1[43].11"
      ]),
      contextHints: Object.freeze(["topmodul", "top modul", "k407039", "co85", "lb1", "container present", "infeed"]),
      title: "Internal active Fault 699 — container-present watchdog (no HMI comment)",
      summary: "Faults_LB1[43].11 is an active, self-holding LB1 fault bit that removes Machine On, but the supplied alarm-comment table gives it no operator-facing name. Its producer is a container-present/bottle-tracking watchdog around PE171 after the container stop has been open long enough and the main-drive output-frequency value is above the configured raw threshold.",
      probableCauses: Object.freeze([
        "PE171 remains continuously blocked or continuously clear for the 1500 ms supervision window after the container-stop-open counter is complete, while the tracked bottle positions are empty.",
        "The physical PE171 state and the bottle-tracking state disagree under the exact infeed conditions that enable this watchdog.",
        "An upstream infeed/container-stop/tracking condition created the watchdog prerequisites; Fault 699 is not proof that PE171 itself has failed."
      ]),
      checks: Object.freeze([
        "Preserve alarm chronology first. Because this bit has no supplied HMI comment, use PLC diagnostics only if site access and permissions allow it.",
        "Observe E1701_PE171_ContainerPresent / Local:7:I.Data.2 and compare it with actual container presence at PE171 without reaching into the guarded machine.",
        "Observe CONT_STP_OPEN_CTR.DN. Its configured PRE is 22 clock counts; do not reinterpret that count as seconds or machine revolutions without additional source evidence.",
        "Observe Container_Present_PE_Blocked.DN and Container_Present_PE_Clear.DN. Both timers have 1500 ms PRE values and represent opposite stuck-state observations.",
        "Confirm Bottle_Tracking[0].0 through .5 are all false when CONTAINERS_MISSING becomes true.",
        "Confirm INFEED_CONDITIONS_MET and VSD85LB1_Node3:I.OutputFreq > 5000. The value 5000 is retained as the raw PLC threshold because this export does not prove a field Hz/RPM scaling for that comparison.",
        "If Fault 699 is already latched, confirm the normal General Reset input E0901_PB201_Reset / I0010.0 only after the actual infeed condition is safe and corrected."
      ]),
      actions: Object.freeze([
        "Correct the proven PE171 target/alignment, container-flow, container-stop, or bottle-tracking condition rather than forcing the fault bit or Machine On enable.",
        "After correction, use the normal reset/start sequence and verify PE171 changes plausibly with containers and Fault 699 does not relatch."
      ]),
      safety,
      sourceRefs: Object.freeze([
        Object.freeze({ sourceId: "topmodul-k407039-lb1-l5k", locator: "ShiftRegister — Faults_LB1[43].11 active producer; no COMMENT[43].11 operator text" }),
        Object.freeze({ sourceId: "topmodul-k407039-electrical", locator: "K407039 page 118/277 — PE171 Container Present Infeed -> I0007.02" })
      ]),
      diagnosticScope: "Labeler",
      canonicalFaultId: "topmodul-plc-internal-fault-699",
      plcFault: Object.freeze({
        scope: "labeler",
        station: null,
        family: "Container flow / internal supervision",
        array: 43,
        index: 43,
        bit: 11,
        address: "Faults_LB1[43].11",
        traceStatus: "active-unnamed-fault-bit-producer-bound"
      })
    });

    const NO_START = Object.freeze({
      id: "topmodul-main-machine-start-chain",
      code: "NO-START",
      category: "TopModul / Main machine start isolation",
      aliases: Object.freeze([
        "machine won't start",
        "machine wont start",
        "machine will not start",
        "no start",
        "main drive won't start",
        "main drive wont start",
        "machine on won't latch",
        "machine on wont latch",
        "start button does nothing",
        "labeler won't run",
        "labeler wont run"
      ]),
      contextHints: Object.freeze(["topmodul", "top modul", "k407039", "co85", "lb1", "no start", "main drive"]),
      title: "TopModul main machine will not start",
      summary: "Use the supplied LB1 StartStop chain as a read-only isolation route: first determine whether Machine On latches, then whether controller/main-drive enable appears, then whether the main contactor is permitted. If active alarms exist, use their exact producer paths instead of treating this symptom route as a root cause.",
      probableCauses: Object.freeze([
        "A Main Drive On prerequisite is missing: ZeroSpeed, either machine-start request, both machine-stop permissives, Run mode, ControlOut.EnableMachineOn, or the modulation timer condition.",
        "StartStop.MachineOn is true but ControlOut.InhibitControllerEnable or the controller-enable delay prevents E2001_AFD101_MainDriveEnable.",
        "Main-drive enable exists but the contactor rung is blocked by E-stop release, contactor monitoring, or electric-brake zero-speed supervision.",
        "Another verified machine or station fault has removed Control.EnableMachineOn before the StartStop routine consumes the ControlOut snapshot."
      ]),
      checks: Object.freeze([
        "If the HMI has exact alarms, capture/paste the alarm stack first. Use the earliest alarm plus ServoForge's PLC-evidence ranking before this symptom route.",
        "During a normal Start request, observe StartStop.MachineOn. If it does not latch, inspect StartStop.ZeroSpeed, E2001_PB122_MachineStop, E0902_PB202_MachineStop, E0901_SS501_OperatingMode, ControlOut.EnableMachineOn, and Mod_Timer.DN.",
        "Remember the control snapshot: the Initial routine CPS-copies Control into ControlOut, then re-establishes baseline Control flags for the following fault logic. A fault that unlatches Control.EnableMachineOn can therefore appear in ControlOut according to the program scan/snapshot sequence; do not force either structure to test a theory.",
        "If StartStop.MachineOn is true, observe E2001_AFD101_MainDriveEnable. If it stays false, inspect ControlOut.InhibitControllerEnable and DelayControllerEnable rather than jumping to the contactor.",
        "If E2001_AFD101_MainDriveEnable is true, observe E2001_C102_MainDriveContactor. If it stays false, inspect E1101.M_EStopRelease, E2001.M_ContactorMonitor, and E2001_M_ElectrBrakeFaultZeroSpeed using their existing exact diagnostics.",
        "If C102 is commanded and the drive still does not produce motion, open the exact Main Drive Fault 480 / drive diagnostics. Do not change start logic to compensate for a drive fault."
      ]),
      actions: Object.freeze([
        "Restore the first missing verified prerequisite in the StartStop chain, then use the normal guarded start sequence.",
        "When an exact fault is present, correct that source-backed fault path; do not bypass it by forcing Machine On, controller enable, or the main contactor."
      ]),
      safety,
      sourceRefs: Object.freeze([
        Object.freeze({ sourceId: "topmodul-k407039-lb1-l5k", locator: "Initial + StartStop routines — Control/ControlOut snapshot, Main Drive On, controller enable, zero-speed and C102 contactor logic" })
      ])
    });

    const FAULT_699_PROCESS = process(
      "active-unnamed-container-present-watchdog-bound",
      "exact-labeler-plc-producer-and-exact-pe171-hardware",
      "ShiftRegister",
      [
        "BTL_PRES_EYE_TEST = 1",
        "E1701_PE171_ContainerPresent = Local:7:I.Data.2",
        "CONT_STP_OPEN_CTR.PRE = 22",
        "Container_Present_PE_Blocked.PRE = 1500",
        "Container_Present_PE_Clear.PRE = 1500",
        "CONTAINERS_MISSING = (Blocked.DN OR Clear.DN) AND Bottle_Tracking[0].0-.5 all false",
        "INFEED_CONDITIONS_MET = !Faults_LB1[42].1 AND !Consumed_FullBottle85_B.Interlock_Data_Bit[12] AND Produced_Labeler85_1.Interlock_Data_Bit[11] AND !Produced_Labeler85_1.Interlock_Data_Bit[14]",
        "GRT(VSD85LB1_Node3:I.OutputFreq,5000)",
        "OTE(Faults_LB1[43].11)",
        "OTL(E0901_PL201_Reset)",
        "OTU(Control.EnableMachineOn)",
        "E0901_PB201_Reset = I0010.0"
      ],
      [
        { label: "Container-stop qualification", value: "E4001_SOL101_ContainerStopValve with the clock pulse increments CONT_STP_OPEN_CTR until PRE 22; container stop closed or Machine On disabled resets that counter." },
        { label: "PE171 stuck-state supervision", value: "After CONT_STP_OPEN_CTR.DN, PE171 continuously blocked runs Container_Present_PE_Blocked; continuously clear runs Container_Present_PE_Clear. Each PRE is 1500 ms." },
        { label: "Tracking disagreement", value: "Either PE timer done plus Bottle_Tracking[0].0 through .5 all false sets CONTAINERS_MISSING." },
        { label: "Fault qualification", value: "The watchdog also requires BTL_PRES_EYE_TEST, INFEED_CONDITIONS_MET, raw main-drive output-frequency value > 5000, and CONT_STP_OPEN_CTR.DN." },
        { label: "Latch / stop response", value: "Faults_LB1[43].11 self-holds until the General Reset input is active, lights the reset request, removes Control.EnableMachineOn, and increments TEST_FOR_CONTAINER_EYE." },
        { label: "Source boundary", value: "Consumed_FullBottle85_B.Interlock_Data_Bit[12] is an external Full Bottle PLC condition. Its exact upstream meaning is not assigned from the Labeler export alone." }
      ],
      [{ device: "PE171", description: "Container Present Infeed photoeye", area: "=EMB1.1701 +MK", cable: ".1701-W171", terminals: "TB50/TB57 -> I0007.02 / Local:7:I.Data.2" }],
      [{ pdfPage: 118, sheet: "118/277", section: "PE171 Container Present Infeed input" }],
      "Fault 699 is a real active PLC inhibit despite lacking an operator-facing alarm comment in the supplied export. It detects a sustained PE171 state that disagrees with empty bottle-tracking positions under qualified infeed/main-drive conditions, then unlatches Machine On enable.",
      "This is an internal active diagnostic position, not a newly invented HMI alarm name. Keep the raw >5000 comparison unscaled unless another source proves the engineering-unit conversion."
    );

    const FAULT_699_CIRCUIT = circuit(
      "machine-specific-pe171-container-present-input-bound",
      "exact-k407039-device-and-plc-alias",
      ["E1701_PE171_ContainerPresent = Local:7:I.Data.2", "K407039 I0007.02"],
      [{ device: "PE171", description: "Container Present Infeed photoeye used by the Fault 699 watchdog", area: "=EMB1.1701 +MK", cable: ".1701-W171", terminals: "TB50/TB57 -> I0007.02" }],
      [{ pdfPage: 118, sheet: "118/277", section: "PE171 Container Present Infeed" }],
      "K407039 page 118 binds PE171 to I0007.02, matching the readable L5K alias Local:7:I.Data.2. The circuit trace proves the sensor/input route; it does not by itself prove whether the fault is caused by the sensor, container flow, or bottle-tracking state.",
      "Diagnose PE171 under normal observation first. Stop/LOTO before alignment, mounting, cabling, or hands-on sensor work."
    );

    const NO_START_PROCESS = process(
      "main-machine-start-permissive-chain-bound",
      "exact-labeler-plc-state-chain",
      "Initial -> StartStop",
      [
        "CPS(Control,ControlOut,1)",
        "OTL(Control.EnableMachineOn) OTL(Control.EnableMachineJog) OTU(Control.InhibitControllerEnable)",
        "[Machine Start request AND StartStop.ZeroSpeed OR StartStop.MachineOn] AND both Stop PB permissives AND Run mode AND ControlOut.EnableMachineOn AND !Mod_Timer.DN -> StartStop.MachineOn",
        "[StartStop.MachineOn OR StartStop.MachineJog] AND !ControlOut.InhibitControllerEnable -> DelayControllerEnable -> E2001_AFD101_MainDriveEnable",
        "LES(SpeedDetect.O_ActVal_10,10) -> DelayZeroSpeed -> StartStop.ZeroSpeed",
        "[E2001_AFD101_MainDriveEnable OR contactor hold] AND E1101.M_EStopRelease AND !E2001.M_ContactorMonitor AND !E2001_M_ElectrBrakeFaultZeroSpeed -> E2001_C102_MainDriveContactor"
      ],
      [
        { label: "Stage 1", value: "Does StartStop.MachineOn latch during the normal Start request? If not, stay at the direct start permissives." },
        { label: "Stage 2", value: "If MachineOn is true, does E2001_AFD101_MainDriveEnable turn on after DelayControllerEnable? If not, inspect controller-enable inhibition." },
        { label: "Stage 3", value: "If main-drive enable is true, does E2001_C102_MainDriveContactor command on? If not, inspect the verified safety/contactor/electric-brake conditions." },
        { label: "Stage 4", value: "If C102 is commanded but there is no motion, transition to the exact main-drive/drive fault diagnostics rather than altering StartStop logic." }
      ],
      [],
      [],
      "The no-start method follows the actual LB1 StartStop chain in order. It is deliberately a shared symptom route and does not create duplicate procedures for every fault capable of removing Machine On enable.",
      "Use the alarm-stack analyzer whenever exact alarms are available. The StartStop method is for isolating which stage failed when the HMI does not provide a useful direct fault."
    );

    const FAULT_699_EVIDENCE = evidence(
      "ShiftRegister",
      "active-container-present-watchdog",
      "primary",
      "Direct PLC producer / internal unnamed inhibit",
      FAULT_699_PROCESS.producerSignals,
      FAULT_699_PROCESS.summary,
      12
    );

    const entries = Object.freeze([...base.entries, Object.freeze({ ...FAULT_699, processTrace: FAULT_699_PROCESS, circuitTrace: FAULT_699_CIRCUIT, labelerRungEvidence: FAULT_699_EVIDENCE }), Object.freeze({ ...NO_START, processTrace: NO_START_PROCESS })]);
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));

    const MACHINE_START_FLOW = Object.freeze({
      id: "topmodul-machine-start",
      title: "TopModul machine will not start",
      category: "TopModul / Main machine",
      description: "Follow the exact LB1 StartStop chain when the machine will not start and no direct alarm already explains the inhibit.",
      contextHints: Object.freeze(["topmodul", "top modul", "k407039", "co85", "lb1"]),
      start: "start-alarm",
      nodes: Object.freeze({
        "start-alarm": Object.freeze({
          question: "Do you have one or more exact HMI/PLC alarm numbers from this no-start event?",
          help: "Exact alarms are stronger evidence than a generic no-start symptom. Preserve their observed order.",
          choices: Object.freeze([
            Object.freeze({ label: "Yes — search/paste the alarms first", action: "search", hint: "Use the fault search / alarm-stack analyzer before the symptom chain." }),
            Object.freeze({ label: "No useful direct alarm", next: "start-machine-on", hint: "Continue with read-only StartStop observations." })
          ])
        }),
        "start-machine-on": Object.freeze({
          question: "During a normal Start request, does StartStop.MachineOn latch?",
          help: "Do not force the bit. Observe the normal sequence only.",
          choices: Object.freeze([
            Object.freeze({ label: "No — MachineOn does not latch", result: "topmodul-main-machine-start-chain", hint: "Stay at ZeroSpeed, Stop PB, Run-mode, MachineOn-enable and modulation permissives." }),
            Object.freeze({ label: "Yes — MachineOn latches", next: "start-drive-enable" })
          ])
        }),
        "start-drive-enable": Object.freeze({
          question: "With MachineOn true, does E2001_AFD101_MainDriveEnable turn on?",
          help: "This separates direct start permissives from controller-enable inhibition.",
          choices: Object.freeze([
            Object.freeze({ label: "No — main-drive enable stays off", result: "topmodul-main-machine-start-chain", hint: "Check ControlOut.InhibitControllerEnable and DelayControllerEnable." }),
            Object.freeze({ label: "Yes — main-drive enable turns on", next: "start-contactor" })
          ])
        }),
        "start-contactor": Object.freeze({
          question: "With main-drive enable true, does E2001_C102_MainDriveContactor command on?",
          help: "The contactor rung still requires safety release and no contactor/electric-brake zero-speed inhibit.",
          choices: Object.freeze([
            Object.freeze({ label: "No — C102 does not command on", result: "topmodul-main-machine-start-chain", hint: "Check E-stop release, contactor monitor and electric-brake zero-speed supervision." }),
            Object.freeze({ label: "Yes — C102 commands on but machine still does not move", result: "topmodul-main-machine-start-chain", hint: "Move to Main Drive Fault 480 / drive diagnostics; do not change start logic." })
          ])
        })
      })
    });

    const flows = Object.freeze([...base.flows, MACHINE_START_FLOW]);

    function getEntry(id) {
      return entryById.get(String(id || "")) || base.getEntry(id);
    }

    function getTopModulFault(value) {
      const raw = String(value ?? "").trim();
      if (raw.toUpperCase() === "NO-START" || raw === NO_START.id) return entryById.get(NO_START.id);
      if (/^0*699$/.test(raw)) return entryById.get(FAULT_699.id);
      return base.getTopModulFault(value);
    }

    function localSearchScore(entry, query, context = {}) {
      const q = base.normalize(query);
      if (!q) return 0;
      const compact = q.replaceAll(" ", "");
      const code = base.normalize(entry.code).replaceAll(" ", "");
      let score = compact === code ? 420 : 0;
      if (entry.number === 699 && /^0*699$/.test(compact)) score += 500;
      const text = base.normalize([entry.code, entry.title, entry.summary, ...(entry.aliases || []), ...(entry.checks || [])].join(" "));
      if (text.includes(q)) score += 100;
      for (const term of q.split(" ").filter((item) => item.length > 1)) if (text.includes(term)) score += 7;
      const ctx = base.normalize([context.machineType, context.mapName].filter(Boolean).join(" "));
      if (ctx.includes("topmodul") || ctx.includes("top modul")) score += 18;
      return score;
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const localEntries = [entryById.get(FAULT_699.id), entryById.get(NO_START.id)]
        .map((entry) => ({ ...entry, searchScore: localSearchScore(entry, query, context) }))
        .filter((entry) => entry.searchScore > 0);
      const combined = [...localEntries, ...base.searchEntries(query, context, requested + 12)];
      const seen = new Set();
      return combined
        .sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0) || String(a.title).localeCompare(String(b.title)))
        .filter((entry) => { if (!entry || seen.has(entry.id)) return false; seen.add(entry.id); return true; })
        .slice(0, requested);
    }

    function getFlow(id) {
      return String(id || "") === MACHINE_START_FLOW.id ? MACHINE_START_FLOW : base.getFlow(id);
    }

    function recommendFlows(context = {}) {
      const ranked = base.recommendFlows ? base.recommendFlows(context) : base.flows.map((flow) => ({ ...flow, contextScore: 0 }));
      const ctx = base.normalize([context.machineType, context.mapName].filter(Boolean).join(" "));
      const score = ctx.includes("topmodul") || ctx.includes("top modul") ? 10 : 0;
      const rows = [...ranked, { ...MACHINE_START_FLOW, contextScore: score }];
      return rows.sort((a, b) => Number(b.contextScore || 0) - Number(a.contextScore || 0));
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
      const requested = Math.max(1, Number(limit) || 10);
      if (Number(entry?.number) !== 699) return base.getTopModulFaultRelations?.(value, requested) || [];
      const rows = [];
      const push = (number, relationScore, relationReason, causalRole = "sibling-diagnostic", causalRoleLabel = "Related evidence") => {
        const related = getTopModulFault(number);
        if (related) rows.push(Object.freeze({ ...related, relationScore, relationReason, causalRole, causalRoleLabel }));
      };
      push(683, 135, "Infeed Gap is related container-flow evidence; it does not produce internal Fault 699.");
      push(679, 110, "Container-stop/speed supervision is related operating context; its producer is separate from Fault 699.");
      push(673, 90, "Fault 673 is an explicit watchdog enable prerequisite through XIO(Faults_LB1[42].1); co-occurrence does not prove causality.", "state-prerequisite", "Enable-state context");
      return rows.slice(0, requested);
    }

    function getTopModulFirstFaultCandidates(value, limit = 8) {
      const entry = typeof value === "object" && value ? value : getTopModulFault(value);
      if (Number(entry?.number) === 699) return [];
      return base.getTopModulFirstFaultCandidates?.(value, limit) || [];
    }

    function getTopModulFaultDrillDown(value, limit = 10) {
      const entry = typeof value === "object" && value ? value : getTopModulFault(value);
      if (Number(entry?.number) !== 699) return base.getTopModulFaultDrillDown?.(value, limit) || null;
      return Object.freeze({
        entry,
        station: null,
        family: entry.plcFault.family,
        traceStatus: entry.plcFault.traceStatus,
        related: getTopModulFaultRelations(entry, limit),
        firstFaultCandidates: Object.freeze([]),
        processTrace: entry.processTrace,
        circuitTrace: entry.circuitTrace,
        sourceGap: null,
        prompt: "Fault 699 is an active unnamed container-present watchdog. Compare PE171, the 22-count container-stop qualification, the two 1500 ms stuck-state timers, bottle-tracking bits and the exact infeed conditions before replacing the sensor or changing tracking logic."
      });
    }

    function validateOwnFlow(errors) {
      const ids = new Set(entries.map((entry) => entry.id));
      if (!MACHINE_START_FLOW.nodes[MACHINE_START_FLOW.start]) errors.push("v352 machine-start flow lost its start node.");
      for (const [nodeId, node] of Object.entries(MACHINE_START_FLOW.nodes)) {
        if (!node.question || !Array.isArray(node.choices) || !node.choices.length) errors.push(`v352 flow node ${nodeId} is incomplete.`);
        for (const choice of node.choices || []) {
          if (choice.next && !MACHINE_START_FLOW.nodes[choice.next]) errors.push(`v352 flow node ${nodeId} points to missing node ${choice.next}.`);
          if (choice.result && !ids.has(choice.result)) errors.push(`v352 flow node ${nodeId} points to missing result ${choice.result}.`);
        }
      }
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      validateOwnFlow(errors);
      if (base.getTopModulFault(699)) errors.push("v352 internal Fault 699 collides with an earlier catalog entry.");
      const f699 = getTopModulFault(699);
      if (!f699 || f699.plcFault?.address !== "Faults_LB1[43].11") errors.push("v352 lost internal Fault 699 PLC binding.");
      if (!f699?.processTrace?.producerSignals?.includes("OTU(Control.EnableMachineOn)")) errors.push("Fault 699 lost Machine On inhibit evidence.");
      if (!f699?.processTrace?.producerSignals?.includes("CONT_STP_OPEN_CTR.PRE = 22")) errors.push("Fault 699 lost 22-count container-stop qualification.");
      if (!f699?.processTrace?.producerSignals?.includes("Container_Present_PE_Blocked.PRE = 1500") || !f699?.processTrace?.producerSignals?.includes("Container_Present_PE_Clear.PRE = 1500")) errors.push("Fault 699 lost 1500 ms PE171 supervision evidence.");
      if (!f699?.processTrace?.producerSignals?.includes("GRT(VSD85LB1_Node3:I.OutputFreq,5000)")) errors.push("Fault 699 lost raw main-drive frequency threshold evidence.");
      if (!f699?.circuitTrace?.drawingLocations?.some((row) => Number(row.pdfPage) === 118)) errors.push("Fault 699 lost K407039 page 118 PE171 evidence.");
      if (!f699?.circuitTrace?.plcSignals?.includes("E1701_PE171_ContainerPresent = Local:7:I.Data.2")) errors.push("Fault 699 lost PE171 Local:7:I.Data.2 alias.");
      if (f699?.labelerRungEvidence?.rootLikelihood !== "primary") errors.push("Fault 699 must remain a direct PLC producer for alarm-stack ranking.");
      if (Number(base.topModulNamedFaultCount || 0) !== Number(base.topModulNamedFaultCount || 0)) errors.push("Invalid named-fault baseline.");
      if (Number(base.topModulNamedFaultCount || 0) !== 515) errors.push(`v352 expected the post-v345 operator-named count 515, found ${base.topModulNamedFaultCount}.`);
      if (Number(base.topModulNamedFaultCount || 0) !== Number(base.topModulNamedFaultCount || 0)) errors.push("Named fault count changed unexpectedly.");
      if (searchEntries("machine won't start", { machineType: "TopModul" }, 4)[0]?.id !== NO_START.id) errors.push("No-start symptom search does not resolve the shared machine-start method first.");
      if (!recommendFlows({ machineType: "TopModul" }).some((flow) => flow.id === MACHINE_START_FLOW.id)) errors.push("TopModul machine-start guided flow is not recommended in TopModul context.");
      if (base.searchEntries("00067", { machineType: "TopModul" }, 3)[0]?.id !== "topmodul-00067-labeler-encoder-feedback") errors.push("v352 disturbed field-observed HMI 00067 search authority.");
      if (base.getTopModulFault(67)?.title !== "Labeling Station Change Mode Active") errors.push("v352 disturbed base Labeler Fault 067 identity.");
      if (base.getTopModulFault(670)?.plcFault?.address !== "Faults_LB1[41].14") errors.push("v352 disturbed main Labeler Fault 670 identity.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+machine-start-isolation-v1`,
      entries,
      flows,
      getEntry,
      getTopModulFault,
      searchEntries,
      getFlow,
      recommendFlows,
      getTopModulProcessTrace,
      getTopModulCircuitTrace,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      topModulNamedFaultCount: base.topModulNamedFaultCount,
      topModulActiveUnnamedAlarmPositions: Object.freeze([699]),
      topModulMachineStartFlowId: MACHINE_START_FLOW.id,
      validate
    });
  };
});
