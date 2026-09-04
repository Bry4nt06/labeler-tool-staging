"use strict";

(function installTopModulLabelerInspectionCoderTrace(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLabelerInspectionCoderTraceExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Labeler diagnostic layers are required before inspection/coder tracing.");
    }

    const SOURCE = base.getTopModulCircuitSource("topmodul-k407039");
    if (!SOURCE) throw new Error("K407039 TopModul circuit source is required.");

    const PLC_SOURCE = Object.freeze({
      id: "topmodul-k407039-lb1-inspection-coder-l5k",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1",
      evidenceClass: "readable-labeler-plc-export",
      sourceDiscipline: "Inspection and laser-coder producer logic is taken from the supplied readable LB1 L5K. K407039 device/page bindings are promoted only where the supplied drawing names the same I/O path."
    });

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
    const process = (status, confidence, routine, producerSignals, calculationSteps, hardwareRows, drawingLocations, summary, safetyBoundary, scopeNote) => Object.freeze({
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
      safetyBoundary,
      scopeNote
    });
    const evidence = (routine, logicType, rootLikelihood, roleLabel, producerSignals, logicSummary, firstFaultRank = 20) => Object.freeze({
      routine,
      logicType,
      rootLikelihood,
      roleLabel,
      producerSignals: Object.freeze(producerSignals),
      logicSummary,
      evidenceStatus: "rung-condition-bound",
      firstFaultRank
    });

    const inspectionBoundary = "Do not bypass inspection, reject, coder-ready, air, E-stop or guarding interlocks. Stop and isolate the relevant equipment before hands-on sensor, connector, pneumatic or wiring work. Energized electrical diagnostics are for qualified personnel under the approved electrical safe-work procedure.";

    const HEUFT_CIRCUIT = circuit(
      "machine-specific-heuft-inspection-interface-bound",
      "exact-labeler-plc-k407039-interface-match",
      [
        "E9712_HeuftReady = I0011.18",
        "E9712_HeuftLabelFault = I0011.19",
        "E9712_HeuftSonicFault = I0011.20",
        "E9712_HeuftRejectFault = I0011.21",
        "E9712_HeuftAirPressureFault = I0011.22"
      ],
      [
        { device: "A999 / Heuft label inspection unit", description: "External inspection/reject interface to the TopModul Labeler", area: "=EMB1.9712", cable: ".9712-W159", terminals: "CN151/CN152/CN153/CN154 signal interface" },
        { device: "Heuft Ready", description: "Inspection-ready signal", area: "=EMB1.9712", cable: ".9712-W159", terminals: "I0011.18" },
        { device: "Heuft stop Label", description: "200 ms sequential-label fault pulse", area: "=EMB1.9712", cable: ".9712-W159", terminals: "I0011.19" },
        { device: "Heuft stop Sonic", description: "200 ms sequential-sonic fault pulse", area: "=EMB1.9712", cable: ".9712-W159", terminals: "I0011.20" }
      ],
      [{ pdfPage: 193, sheet: "193/277", section: "Label inspection / Heuft A999 signal transmission via W159 and CN151-CN154" }],
      "K407039 page 193 binds the Heuft/A999 interface to I0011.18-.22. ServoForge keeps ready, label, sonic, reject and air-pressure states separate because the Inspection routine latches them into different diagnostic outputs.",
      inspectionBoundary,
      "This is the Labeler-side Heuft interface. Internal Heuft device logic beyond these exchanged signals is outside the supplied Labeler PLC."
    );

    const LASER_READY_CIRCUIT = circuit(
      "machine-specific-laser-coder-ready-interface-bound",
      "exact-labeler-plc-k407039-interface-match",
      [
        "E5101_A999_02_LaserCoderReady = I0011.11",
        "E5101_A999_04_LaserEStopMessage = I0011.12",
        "E5101_A999_20_LaserCoderHead1OK = I0011.13",
        "E5101_A999_24_LaserCoderHead2OK = I0011.14"
      ],
      [
        { device: "A999 / Laser coder interface", description: "Laser coder ready and status interface", area: "=EMB1.5101", cable: "laser coder interface wiring", terminals: "Ready -> I0011.11; E-stop message -> I0011.12; Head A/B OK -> I0011.13/.14" }
      ],
      [{ pdfPage: 174, sheet: "174/277", section: "Laser coder ready, E-stop message and head-status inputs" }],
      "K407039 page 174 binds the laser coder A999 ready/status interface to the Labeler PLC. Fault 672 is driven by the ready state, not by the two head-OK inputs alone.",
      inspectionBoundary,
      "Use the coder's own diagnostics to determine why Ready is absent before replacing Labeler-side interface hardware."
    );

    const LASER_AIR_CIRCUIT = circuit(
      "machine-specific-laser-air-input-family-bound",
      "mixed-exact-drawing-and-plc-only-apl-pressure-path",
      [
        "E5101_PS131_LaserCoderAirPressure = I0011.9",
        "E5101_PS132_LaserCoderAirFlow1 = I0011.10",
        "E5101_PS133_LaserCoderAirFlow2 = I0011.15",
        "E5101_PS134_LaserCoderAirPressure2 = I0011.17",
        "APL_Labeling selects PS134/PS133; non-APL selects PS131/PS132"
      ],
      [
        { device: "PS131", description: "Laser coder compressed-air pressure input used in non-APL selection", area: "=EMB1.5101", cable: ".5101-W131", terminals: "I0011.09 — exact K407039 drawing match" },
        { device: "PS132", description: "Laser coder / labeling-station air-flow input used in non-APL selection", area: "=EMB1.5101", cable: ".5101-W132", terminals: "I0011.10 — exact K407039 drawing match" },
        { device: "PS133", description: "Laser coder / container-table flow input used in APL selection", area: "=EMB1.5101", cable: ".5101-W133", terminals: "I0011.15 — exact K407039 drawing match" },
        { device: "PS134", description: "Second laser-coder air-pressure input selected by APL_Labeling in the PLC", area: "=EMB1.5101", cable: "not verified in supplied K407039 drawing", terminals: "I0011.17 — PLC alias verified; drawing route not located" }
      ],
      [{ pdfPage: 175, sheet: "175/277", section: "PS131 I0011.09, PS132 I0011.10 and PS133 I0011.15 laser air circuits" }],
      "The LB1 PLC selects different laser-air inputs by application mode: non-APL uses PS131 pressure and PS132 flow; APL uses PS134 pressure and PS133 flow. PS131/132/133 are present on K407039 page 175. PS134 is verified as the I0011.17 PLC alias but was not located in the supplied drawing, so ServoForge marks that route PLC-only rather than inventing a terminal/cable.",
      inspectionBoundary,
      "Confirm whether APL_Labeling is active before interpreting which pressure/flow input is authoritative."
    );

    const PROCESS = Object.freeze({
      672: process(
        "laser-coder-ready-latch-bound",
        "exact-labeler-plc-producer",
        "LaserCoder / Machine_Jumps",
        ["E5101_A999_02_LaserCoderReady = I0011.11", "Laser_01.I_Ready", "Laser_01.O_NotReady", "Faults_LB1[42].0"],
        [
          { label: "Ready input", value: "A999 laser-coder Ready is I0011.11." },
          { label: "Latch behavior", value: "When I_Ready is false, LaserCoder latches O_NotReady unless the fault override is active; reset clears it after Ready returns." },
          { label: "HMI output", value: "Laser_01.O_NotReady drives Fault 672." }
        ],
        [{ device: "A999 / Laser coder Ready", description: "External coder-ready interface", area: "=EMB1.5101", cable: "laser interface", terminals: "I0011.11" }],
        [{ pdfPage: 174, sheet: "174/277", section: "Laser coder Ready input" }],
        "Fault 672 is the laser-coder Not Ready condition. The Labeler PLC latches loss of A999 Ready/I0011.11 into Laser_01.O_NotReady; use the coder's own diagnostics and the ready interface to determine why the coder is not ready.",
        inspectionBoundary,
        "Fault 672 is a readiness state. Fault 687 is a more specific laser-air pressure condition and should be treated as stronger first-fault evidence when both occur."
      ),
      673: process(
        "heuft-sequential-label-pulse-latch-bound",
        "exact-labeler-plc-producer",
        "Inspection / Machine_Jumps",
        ["E9712_HeuftLabelFault = I0011.19", "Inspection_01.I_SequLabelFault", "Inspection_01.O_LabelFault", "Faults_LB1[42].1"],
        [
          { label: "External signal", value: "Heuft 'stop Label' is a 200 ms fault pulse on I0011.19." },
          { label: "PLC behavior", value: "Inspection latches I_SequLabelFault into O_LabelFault until reset unless override is active." },
          { label: "HMI output", value: "O_LabelFault drives Fault 673." }
        ],
        [{ device: "A999 / Heuft stop Label", description: "Sequential label fault pulse from inspection unit", area: "=EMB1.9712", cable: ".9712-W159", terminals: "I0011.19" }],
        [{ pdfPage: 193, sheet: "193/277", section: "Heuft stop Label input" }],
        "Fault 673 is the latched sequential-label fault received from the Heuft inspection unit. The Labeler PLC preserves the short 200 ms external pulse as O_LabelFault; the actual label-inspection reason must be read from the Heuft/inspection system rather than inferred from the Labeler input alone.",
        inspectionBoundary,
        "This is distinct from Fault 674 Not Ready and Fault 691 Sequential Sonic even though all three share the same Heuft interface."
      ),
      674: process(
        "heuft-not-ready-latch-bound",
        "exact-labeler-plc-producer",
        "Inspection / Machine_Jumps",
        ["E9712_HeuftReady = I0011.18", "Inspection_01.I_InspectionReady", "Inspection_01.O_NotReady", "Faults_LB1[42].2"],
        [
          { label: "Ready polarity", value: "I0011.18 is documented 1 = Ready / 0 = Faulted." },
          { label: "PLC behavior", value: "Inspection latches Not Ready while I_InspectionReady is false until normal reset/recovery." },
          { label: "HMI output", value: "O_NotReady drives Fault 674." }
        ],
        [{ device: "A999 / Heuft Ready", description: "Inspection-system Ready state", area: "=EMB1.9712", cable: ".9712-W159", terminals: "I0011.18" }],
        [{ pdfPage: 193, sheet: "193/277", section: "Heuft inspection Ready input" }],
        "Fault 674 means the Heuft inspection system is not reporting Ready. It is a system-readiness state, not proof of a label or sonic defect. Check specific Heuft/inspection faults and its own diagnostics before troubleshooting the Labeler I/O path.",
        inspectionBoundary,
        "If 673, 691, 695 or another specific inspection fault preceded 674, use that specific fault as the stronger root-cause evidence."
      ),
      687: process(
        "laser-air-pressure-delay-and-latch-bound",
        "exact-labeler-plc-producer-with-mode-selected-input",
        "LaserCoder / Machine_Jumps",
        [
          "Laser_01.DelayAirPressureFault.PRE = 2000",
          "non-APL: E5101_PS131_LaserCoderAirPressure = I0011.9",
          "APL: E5101_PS134_LaserCoderAirPressure2 = I0011.17",
          "Laser_01.I_AirPressure",
          "Laser_01.O_AirPressureFault",
          "Faults_LB1[42].15"
        ],
        [
          { label: "Mode selection", value: "When APL_Labeling is false the PLC uses PS131/I0011.9; when APL_Labeling is true it uses PS134/I0011.17." },
          { label: "Supervision", value: "Loss of selected air-pressure input while the laser is Ready starts DelayAirPressureFault with PRE 2000 ms." },
          { label: "Latch", value: "After the delay, O_AirPressureFault latches until normal reset/recovery." },
          { label: "HMI output", value: "O_AirPressureFault drives Fault 687." }
        ],
        [
          { device: "PS131", description: "Non-APL laser air-pressure switch", area: "=EMB1.5101", cable: ".5101-W131", terminals: "I0011.09" },
          { device: "PS134", description: "APL-selected laser air-pressure input", area: "=EMB1.5101", cable: "drawing route not located", terminals: "I0011.17 — PLC alias verified" }
        ],
        [{ pdfPage: 175, sheet: "175/277", section: "PS131 exact laser compressed-air input; PS134 not located in supplied drawing" }],
        "Fault 687 is the active laser-coder air-pressure alarm. It is mode-dependent: non-APL uses PS131/I0011.9, while APL uses PS134/I0011.17. The PLC waits about 2 seconds after loss of the selected pressure input while the coder is Ready before latching the fault.",
        inspectionBoundary,
        "Do not assume PS131 is authoritative on an APL setup. ServoForge identifies PS134 as PLC-verified but drawing-unverified in the supplied K407039 package."
      ),
      688: process(
        "laser-air-flow-internal-detector-bound-hmi-output-disabled",
        "exact-internal-detector-plus-impossible-hmi-rung",
        "LaserCoder / Machine_Jumps",
        [
          "Laser_01.DelayAirFlowFault.PRE = 2000",
          "non-APL: E5101_PS132_LaserCoderAirFlow1 = I0011.10",
          "APL: E5101_PS133_LaserCoderAirFlow2 = I0011.15",
          "Laser_01.O_AirFlowFault",
          "XIC(Laser_01.O_AirFlowFault) XIO(Laser_01.O_AirFlowFault) OTE(Faults_LB1[43].0)"
        ],
        [
          { label: "Mode selection", value: "Non-APL uses PS132/I0011.10; APL uses PS133/I0011.15." },
          { label: "Internal supervision", value: "Loss of selected flow while coder Ready starts a 2000 ms delay and can latch Laser_01.O_AirFlowFault." },
          { label: "HMI fault rung", value: "The only Fault 688 producer tests O_AirFlowFault both true and false in series (XIC + XIO), so Faults_LB1[43].0 cannot energize in this supplied revision." }
        ],
        [
          { device: "PS132", description: "Non-APL laser/labeling-station air-flow input", area: "=EMB1.5101", cable: ".5101-W132", terminals: "I0011.10" },
          { device: "PS133", description: "APL container-table air-flow input", area: "=EMB1.5101", cable: ".5101-W133", terminals: "I0011.15" }
        ],
        [{ pdfPage: 175, sheet: "175/277", section: "PS132 and PS133 laser air-flow inputs" }],
        "The laser-coder air-flow detector itself is real and mode-dependent, but the HMI Fault 688 output rung is self-contradictory in this LB1 revision. ServoForge exposes the internal detector for engineering evidence while marking Fault 688 unpromoted as an operator alarm path.",
        inspectionBoundary,
        "Do not modify or force the contradictory rung in production to make the alarm appear. Treat this as revision-specific source evidence that should be corrected only through the normal controls change process."
      ),
      691: process(
        "heuft-sequential-sonic-pulse-latch-bound",
        "exact-labeler-plc-producer",
        "Inspection / Machine_Jumps",
        ["E9712_HeuftSonicFault = I0011.20", "Inspection_01.I_SequSonicFault", "Inspection_01.O_SonicFault", "Faults_LB1[43].3"],
        [
          { label: "External signal", value: "Heuft 'stop Sonic' is a 200 ms fault pulse on I0011.20." },
          { label: "PLC behavior", value: "Inspection latches I_SequSonicFault into O_SonicFault until reset unless override is active." },
          { label: "HMI output", value: "O_SonicFault drives Fault 691." }
        ],
        [{ device: "A999 / Heuft stop Sonic", description: "Sequential sonic fault pulse from inspection unit", area: "=EMB1.9712", cable: ".9712-W159", terminals: "I0011.20" }],
        [{ pdfPage: 193, sheet: "193/277", section: "Heuft stop Sonic input" }],
        "Fault 691 is the latched sequential-sonic fault received from the Heuft inspection unit. The Labeler preserves the short external pulse; use the Heuft/inspection diagnostics to determine the actual sonic rejection cause.",
        inspectionBoundary,
        "This is a sibling of Fault 673, not the same inspection condition."
      )
    });

    const SOURCE_GAPS = Object.freeze({
      671: Object.freeze({
        status: "named-alarm-no-producer-in-supplied-lb1",
        reason: "Fault 671 'Malfunction Front Label Dating' is named in the alarm table, but Faults_LB1[41].15 has no producer occurrence anywhere in the supplied readable LB1 L5K. ServoForge does not borrow the Laser Coder or Heuft paths for this alarm."
      }),
      688: Object.freeze({
        status: "hmi-output-rung-self-contradictory-in-supplied-lb1",
        reason: "The internal Laser_01 air-flow detector is implemented, but the only Fault 688 output rung is `XIC(Laser_01.O_AirFlowFault) XIO(Laser_01.O_AirFlowFault) OTE(Faults_LB1[43].0)`. Because the same bit cannot be true and false simultaneously, this HMI fault bit cannot energize in the supplied LB1 revision."
      })
    });

    const EVIDENCE = Object.freeze({
      672: evidence("LaserCoder / Machine_Jumps", "ready-state-latch", "secondary", "Coder readiness state", PROCESS[672].producerSignals, PROCESS[672].summary, 40),
      673: evidence("Inspection / Machine_Jumps", "external-fault-pulse-latch", "primary", "Specific inspection-label fault", PROCESS[673].producerSignals, PROCESS[673].summary, 10),
      674: evidence("Inspection / Machine_Jumps", "external-ready-state-latch", "secondary", "Inspection readiness state", PROCESS[674].producerSignals, PROCESS[674].summary, 45),
      687: evidence("LaserCoder / Machine_Jumps", "timed-air-pressure-latch", "primary", "Specific coder-air fault", PROCESS[687].producerSignals, PROCESS[687].summary, 10),
      688: evidence("LaserCoder / Machine_Jumps", "internal-air-flow-detector-with-disabled-output", "disabled", "Internal detector; HMI output disabled by logic", PROCESS[688].producerSignals, PROCESS[688].summary, 100),
      691: evidence("Inspection / Machine_Jumps", "external-fault-pulse-latch", "primary", "Specific inspection-sonic fault", PROCESS[691].producerSignals, PROCESS[691].summary, 10)
    });

    function isLabelerEntry(entry) {
      return Boolean(entry?.plcFault) && entry.diagnosticScope !== "Station";
    }

    function enrich(entry) {
      if (!isLabelerEntry(entry)) return entry;
      const n = Number(entry.number);
      if (n === 671) return Object.freeze({ ...entry, sourceGap: SOURCE_GAPS[671] });
      if (!PROCESS[n]) return entry;
      let trace = null;
      if ([673, 674, 691].includes(n)) trace = HEUFT_CIRCUIT;
      if (n === 672) trace = LASER_READY_CIRCUIT;
      if ([687, 688].includes(n)) trace = LASER_AIR_CIRCUIT;
      return Object.freeze({
        ...entry,
        processTrace: PROCESS[n],
        ...(trace ? { circuitTrace: trace } : {}),
        labelerRungEvidence: EVIDENCE[n],
        ...(SOURCE_GAPS[n] ? { sourceGap: SOURCE_GAPS[n] } : {})
      });
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);

    function dedupe(entries, limit) {
      const out = [];
      const seen = new Set();
      for (const entry of entries) {
        if (!entry?.id || seen.has(entry.id)) continue;
        seen.add(entry.id);
        out.push(entry);
        if (out.length >= limit) break;
      }
      return out;
    }

    function siblingRelations(source) {
      const n = Number(source?.number);
      const rows = [];
      const push = (number, score, reason, causalRole = "sibling-diagnostic", causalRoleLabel = "Same subsystem") => {
        const entry = getTopModulFault(number);
        if (entry) rows.push({ ...entry, relationScore: score, relationReason: reason, causalRole, causalRoleLabel });
      };
      if ([673, 674, 691].includes(n)) {
        for (const other of [673, 674, 691, 695]) if (other !== n) push(other, 125, "Same Heuft/A999 inspection interface; use the specific condition that occurred first");
      }
      if (n === 674) {
        push(673, 170, "Specific sequential-label fault can explain a later inspection Not Ready state", "upstream-prerequisite", "Check first");
        push(691, 170, "Specific sequential-sonic fault can explain a later inspection Not Ready state", "upstream-prerequisite", "Check first");
        push(695, 165, "Specific reject fault can explain a later inspection Not Ready state", "upstream-prerequisite", "Check first");
      }
      if (n === 672) push(687, 175, "Specific laser air-pressure fault can explain a later Laser Coder Not Ready state", "upstream-prerequisite", "Check first");
      if (n === 687) push(672, 90, "Laser Coder Not Ready is a related downstream readiness state", "downstream-summary", "Related readiness");
      return rows;
    }

    function getTopModulFaultRelations(value, limit = 10) {
      const source = typeof value === "object" && value ? enrich(value) : getTopModulFault(value);
      const raw = base.getTopModulFaultRelations(value, Math.max(24, Number(limit) || 10)).map(enrich);
      return dedupe([...siblingRelations(source), ...raw], Math.max(1, Number(limit) || 10));
    }

    function getTopModulFirstFaultCandidates(value, limit = 8) {
      const source = typeof value === "object" && value ? enrich(value) : getTopModulFault(value);
      const explicit = [];
      if (Number(source?.number) === 672) explicit.push(getTopModulFault(687));
      if (Number(source?.number) === 674) explicit.push(getTopModulFault(673), getTopModulFault(691), getTopModulFault(695));
      const raw = base.getTopModulFirstFaultCandidates(value, Math.max(16, Number(limit) || 8)).map(enrich)
        .filter((entry) => Number(entry.number) !== 688 && Number(entry.number) !== 696);
      return dedupe([...explicit.filter(Boolean), ...raw], Math.max(1, Number(limit) || 8));
    }

    function getTopModulCircuitTrace(value) {
      const entry = typeof value === "object" && value ? enrich(value) : getTopModulFault(value) || getEntry(value);
      return entry?.circuitTrace || base.getTopModulCircuitTrace?.(value) || null;
    }

    function getTopModulProcessTrace(value) {
      const entry = typeof value === "object" && value ? enrich(value) : getTopModulFault(value) || getEntry(value);
      return entry?.processTrace || base.getTopModulProcessTrace?.(value) || null;
    }

    function getTopModulFaultDrillDown(value, limit = 10) {
      const original = base.getTopModulFaultDrillDown(value, limit);
      if (!original) return null;
      const entry = enrich(original.entry);
      return Object.freeze({
        ...original,
        entry,
        related: getTopModulFaultRelations(entry, limit),
        firstFaultCandidates: getTopModulFirstFaultCandidates(entry, Math.min(8, Math.max(4, Number(limit) || 8))),
        circuitTrace: entry.circuitTrace || original.circuitTrace || null,
        processTrace: entry.processTrace || original.processTrace || null,
        sourceGap: entry.sourceGap || original.sourceGap || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const f671 = getTopModulFault(671);
      if (!f671?.sourceGap || f671.processTrace || f671.circuitTrace) errors.push("Fault 671 must remain named but unpromoted in the supplied LB1 revision.");
      const f672 = getTopModulFault(672);
      if (!f672?.processTrace?.producerSignals?.includes("E5101_A999_02_LaserCoderReady = I0011.11")) errors.push("Fault 672 lost laser Ready/I0011.11 evidence.");
      if (!f672?.circuitTrace?.drawingLocations?.some((row) => Number(row.pdfPage) === 174)) errors.push("Fault 672 lost K407039 page 174 evidence.");
      const f673 = getTopModulFault(673);
      if (!f673?.processTrace?.producerSignals?.includes("E9712_HeuftLabelFault = I0011.19")) errors.push("Fault 673 lost Heuft label/I0011.19 evidence.");
      const f674 = getTopModulFault(674);
      if (!f674?.processTrace?.producerSignals?.includes("E9712_HeuftReady = I0011.18")) errors.push("Fault 674 lost Heuft Ready/I0011.18 evidence.");
      const f687 = getTopModulFault(687);
      if (!f687?.processTrace?.producerSignals?.includes("Laser_01.DelayAirPressureFault.PRE = 2000")) errors.push("Fault 687 lost 2-second pressure supervision.");
      if (!f687?.processTrace?.producerSignals?.some((signal) => signal.includes("PS134") && signal.includes("I0011.17"))) errors.push("Fault 687 lost APL PS134/I0011.17 selection evidence.");
      const f688 = getTopModulFault(688);
      if (!f688?.sourceGap || f688?.labelerRungEvidence?.rootLikelihood !== "disabled") errors.push("Fault 688 must retain the contradictory HMI-output source gap.");
      if (!f688?.processTrace?.producerSignals?.some((signal) => signal.includes("XIC(Laser_01.O_AirFlowFault) XIO"))) errors.push("Fault 688 lost the self-contradictory HMI rung evidence.");
      const f691 = getTopModulFault(691);
      if (!f691?.processTrace?.producerSignals?.includes("E9712_HeuftSonicFault = I0011.20")) errors.push("Fault 691 lost Heuft sonic/I0011.20 evidence.");
      if (getTopModulFault(696)?.labelerRungEvidence?.rootLikelihood !== "disabled" && !getTopModulFault(696)?.sourceGap) errors.push("Existing disabled/source-gap status for Fault 696 was lost.");
      if (getTopModulFirstFaultCandidates(672, 4)?.[0]?.number !== 687) errors.push("Fault 672 should prioritize specific laser air-pressure Fault 687 when present.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+labeler-inspection-coder-v1`,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulCircuitTrace,
      getTopModulProcessTrace,
      topModulLabelerInspectionCoderFaults: Object.freeze([672, 673, 674, 687, 688, 691]),
      topModulLabelerInspectionCoderSourceGaps: Object.freeze([671, 688]),
      validate
    });
  };
});
