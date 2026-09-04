"use strict";

(function installTopModulLabelerRemainingGapsTrace(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLabelerRemainingGapsTraceExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Labeler diagnostic layers are required before remaining-gap tracing.");
    }

    const SOURCE = base.getTopModulCircuitSource("topmodul-k407039");
    if (!SOURCE) throw new Error("K407039 TopModul circuit source is required.");

    const PLC_SOURCE = Object.freeze({
      id: "topmodul-k407039-lb1-remaining-gaps-l5k",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1",
      evidenceClass: "readable-labeler-plc-export",
      sourceDiscipline: "This phase audits alarm-table positions that were previously catalog-only or omitted. A named alarm is promoted only when the supplied LB1 export proves its producer logic."
    });

    const OBSERVE = "Use normal HMI/PLC/coder diagnostics only. Do not force PLC bits, defeat inspection/coder supervision, or bypass machine interlocks.";
    const LOTO = "Follow site lockout/tagout and stored-energy procedures before hands-on work on the Fumex extractor, coder, sensors, wiring, pneumatics, conveyors, or infeed equipment.";
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

    const evidence = (routine, logicType, rootLikelihood, roleLabel, producerSignals, logicSummary, firstFaultRank = 20, evidenceStatus = "rung-condition-bound") => Object.freeze({
      routine,
      logicType,
      rootLikelihood,
      roleLabel,
      producerSignals: Object.freeze(producerSignals),
      logicSummary,
      evidenceStatus,
      firstFaultRank
    });

    function supplementalEntry(number, title, family, description) {
      const code = String(number).padStart(3, "0");
      const address = `Faults_LB1[${Math.floor(number / 16)}].${number % 16}`;
      return Object.freeze({
        id: `topmodul-plc-fault-${number}`,
        code,
        number,
        title,
        category: `TopModul PLC / Labeler / ${family}`,
        aliases: Object.freeze([`fault ${number}`, `fault ${code}`, title, address]),
        contextHints: Object.freeze(["topmodul", "top modul", "k407039", "co85", "lb1", family]),
        summary: description,
        probableCauses: Object.freeze(["Use the verified producer logic below rather than inferring the cause from the alarm wording alone."]),
        checks: Object.freeze(["Record faults and warnings that occurred first, then compare the verified producer inputs/state without forcing logic."]),
        actions: Object.freeze(["Correct the proven upstream condition and verify the alarm does not recur during a normal guarded run."]),
        safety,
        sourceRefs: Object.freeze([
          Object.freeze({ sourceId: "topmodul-k407039-lb1-l5k", locator: `${address} — Fault ${code} — ${title}` }),
          Object.freeze({ sourceId: "topmodul-k407039-electrical", locator: "K407039 exact device/page bindings are listed only where verified below." })
        ]),
        diagnosticScope: "Labeler",
        canonicalFaultId: `topmodul-plc-fault-${number}`,
        plcFault: Object.freeze({ scope: "labeler", station: null, family, array: Math.floor(number / 16), index: Math.floor(number / 16), bit: number % 16, address, traceStatus: "supplemental-alarm-position-source-audited" })
      });
    }

    const supplemental = Object.freeze([
      supplementalEntry(697, "Fault 697 — unassigned alarm position", "Machine / other", "Alarm-table position 697 exists in the supplied LB1 export only as the text 'Fault 697'. No producer occurrence or subsystem description was found; ServoForge retains it only as an explicit unassigned/source-gap position."),
      supplementalEntry(700, "Sequential Label", "Inspection / reject", "Fault 700 was recovered from the supplied LB1 alarm table and active Machine_Jumps logic. It is the raw Heuft sequential-label event latch and discharge-conveyor interlock path, separate from processed inspection Fault 673."),
      supplementalEntry(719, "Coder Hardware or Enchoder Fault", "Coder / marking", "Fault 719 was recovered from the supplied LB1 alarm table and active LaserGoodShot logic. Despite the legacy alarm wording, its actual producer is consecutive missing laser Good Shot confirmation, not a direct encoder-feedback input.")
    ]);
    const supplementalByNumber = new Map(supplemental.map((entry) => [entry.number, entry]));
    const supplementalById = new Map(supplemental.map((entry) => [entry.id, entry]));

    const FUMEX_CIRCUIT = circuit(
      "fumex-interface-bound-but-fault-489-unproduced",
      "exact-k407039-interface-with-no-fault-489-producer",
      ["E5101_A999_FumexRunning = I0011.16", "E5101_A999_FumexOn = O0104.15", "Warnings_LB1[2].0 = Warning 32 Fumex Not Ready"],
      [
        { device: "A999 / Fumex suction device", description: "Fumex extractor/suction-device interface", area: "=EMB1.5101 / =FM61+SS", cable: "Fumex interface", terminals: "Running -> I0011.16; Start -> O0104.15" }
      ],
      [{ pdfPage: 172, sheet: "172/277", section: "Fumex suction device power/start and in-operation signal I0011.16" }],
      "K407039 page 172 verifies the Fumex start/running interface. The LB1 application uses that state for Warning 32 Fumex Not Ready, but no producer for Fault 489 / Faults_LB1[30].9 exists in the supplied PLC export.",
      "Use Warning 32 and the Fumex/local conveyor interface as operational evidence; do not claim that evidence is the producer of Fault 489."
    );

    const HEUFT_LABEL_CIRCUIT = circuit(
      "heuft-sequential-label-interface-bound",
      "exact-labeler-plc-k407039-interface-match",
      ["E9712_HeuftLabelFault = I0011.19", "200 ms pulse if faulted"],
      [
        { device: "A999 / Heuft stop Label", description: "Sequential label fault pulse from inspection unit", area: "=EMB1.9712", cable: ".9712-W159", terminals: "I0011.19" }
      ],
      [{ pdfPage: 193, sheet: "193/277", section: "Heuft stop Label / sequential-label pulse" }],
      "K407039 page 193 binds the Heuft sequential-label pulse to I0011.19. Fault 700 and Fault 673 both originate from this external event but represent different PLC layers.",
      "The Labeler only receives the external Heuft event; the internal inspection reason remains in the Heuft/inspection system."
    );

    const LASER_GOODSHOT_CIRCUIT = circuit(
      "laser-good-shot-head-status-interface-bound",
      "exact-labeler-plc-k407039-interface-plus-forced-encoder-output",
      [
        "E5101_A999_20_LaserCoderHead1OK = I0011.13",
        "E5101_A999_24_LaserCoderHead2OK = I0011.14",
        "E5101_A999_26_EncoderOK = O0104.13",
        "XIC(Logic_1) OTE(E5101_A999_26_EncoderOK)"
      ],
      [
        { device: "A999 / Laser coder Head A OK", description: "Good Shot confirmation input", area: "=EMB1.5101", cable: "laser coder interface", terminals: "I0011.13" },
        { device: "A999 / Laser coder Head B OK", description: "Good Shot confirmation input", area: "=EMB1.5101", cable: "laser coder interface", terminals: "I0011.14" },
        { device: "A999 / encoder OK command", description: "Output to coder; forced true by Logic_1 in supplied LB1 revision", area: "=EMB1.5101", cable: "laser coder interface", terminals: "O0104.13" }
      ],
      [
        { pdfPage: 174, sheet: "174/277", section: "Laser coder Head A/B OK inputs I0011.13/.14" },
        { pdfPage: 176, sheet: "176/277", section: "Laser coder encoder OK output O0104.13" }
      ],
      "Fault 719 should not be routed to the TopModul main encoder merely because the legacy alarm text says 'Enchoder'. Its producer uses missing coder Head A/B Good Shot confirmation. The separate O0104.13 encoder-OK output shown on K407039 page 176 is forced healthy by Logic_1 in this PLC revision.",
      "Coder-internal hardware/encoder diagnostics may still explain missing Good Shot, but the Labeler fault bit itself is not driven by a direct encoder-fault input."
    );

    const PROCESS = Object.freeze({
      700: process(
        "raw-heuft-sequential-label-event-latch-bound",
        "exact-labeler-plc-producer",
        "_Machine_Jumps / Inspection",
        [
          "E9712_HeuftLabelFault = I0011.19",
          "E9712_HeuftLabelFault OR (Faults_LB1[43].12 AND NOT ResetGeneral)",
          "OTE(Inspection_01.I_SequLabelFault)",
          "OTE(Produced_Labeler85_1.Interlock_Data_Bit[38])",
          "OTE(Faults_LB1[43].12)"
        ],
        [
          { label: "External event", value: "Heuft sends a 200 ms Sequential Label pulse on I0011.19." },
          { label: "Raw event latch", value: "Fault 700 self-holds through Faults_LB1[43].12 until ResetGeneral." },
          { label: "Conveyor interlock", value: "The same raw event drives Produced_Labeler85_1.Interlock_Data_Bit[38] to stop discharge conveyors downstream." },
          { label: "Parallel processed fault", value: "The same event feeds Inspection_01.I_SequLabelFault; Inspection_01.O_LabelFault separately drives Fault 673 and is subject to the inspection override." }
        ],
        [{ device: "A999 / Heuft stop Label", description: "Sequential-label event from inspection unit", area: "=EMB1.9712", cable: ".9712-W159", terminals: "I0011.19" }],
        [{ pdfPage: 193, sheet: "193/277", section: "Heuft sequential-label interface" }],
        "Fault 700 is the Labeler's raw sequential-label event latch and discharge-conveyor interlock. Fault 673 is a separate processed Inspection-function fault from the same Heuft event; the two are parallel representations, not proof that one caused the other.",
        "Keep Fault 700 separate from Fault 673 when building event chronology."
      ),
      719: process(
        "laser-good-shot-consecutive-miss-counter-bound",
        "exact-labeler-plc-producer",
        "LaserGoodShot",
        [
          "LaserGoodShot.FaultCounter.PRE = 150",
          "GoodShot_Max_Failures = 154 (counter saturation cap, not DN threshold)",
          "Head1OK I0011.13 OR Head2OK I0011.14 -> LaserGoodShot.GoodShot",
          "APL_Labeling -> ShiftRegFCP = 7; non-APL -> ShiftRegFCP = 10",
          "missing GoodShot at configured bottle/shift-register check -> CTU(LaserGoodShot.FaultCounter)",
          "LaserGoodShot.FaultCounter.DN -> LaserGoodShot.Fault unless laser override Faults_LB1[5].1 is active",
          "LaserGoodShot.Fault -> Faults_LB1[44].15",
          "Faults_LB1[44].15 inhibits Conveyor.DischargeOn"
        ],
        [
          { label: "Good Shot input", value: "Either coder Head A OK (I0011.13) or Head B OK (I0011.14) creates the Good Shot one-shot." },
          { label: "Bottle-position check", value: "The check is aligned to the configured shift-register position and Fine Pulse Counter; APL uses FCP 7 and non-APL uses FCP 10." },
          { label: "Consecutive miss threshold", value: "LaserGoodShot.FaultCounter PRE is 150. The separate GoodShot_Max_Failures value 154 only caps the accumulated count after it exceeds that value." },
          { label: "Machine response", value: "When FaultCounter.DN latches LaserGoodShot.Fault, Fault 719 is generated, Machine On is removed, and discharge conveyors are blocked." },
          { label: "Encoder wording caveat", value: "E5101_A999_26_EncoderOK/O0104.13 is forced on with Logic_1 in this revision; it is not the direct producer of Fault 719." }
        ],
        [
          { device: "A999 / Laser coder Head A OK", description: "Good Shot confirmation", area: "=EMB1.5101", cable: "laser coder interface", terminals: "I0011.13" },
          { device: "A999 / Laser coder Head B OK", description: "Good Shot confirmation", area: "=EMB1.5101", cable: "laser coder interface", terminals: "I0011.14" },
          { device: "A999 / encoder OK output", description: "Legacy encoder-OK command, forced healthy by PLC Logic_1", area: "=EMB1.5101", cable: "laser coder interface", terminals: "O0104.13" }
        ],
        [
          { pdfPage: 174, sheet: "174/277", section: "Head A/B OK inputs" },
          { pdfPage: 176, sheet: "176/277", section: "Encoder OK output" }
        ],
        "Fault 719 is generated by the LaserGoodShot routine after consecutive missing Good Shot confirmations at the expected bottle position. The legacy alarm wording 'Coder Hardware or Enchoder Fault' is broader than the actual producer and must not be treated as a direct TopModul encoder feedback fault.",
        "Start with coder Head A/B Good Shot status, timing/trigger context and coder diagnostics. Do not redirect this alarm to the main-machine encoder circuit without independent evidence."
      )
    });

    const SOURCE_GAPS = Object.freeze({
      489: Object.freeze({
        status: "named-fault-no-producer-related-warning-path-verified",
        reason: "Fault 489 / Faults_LB1[30].9 has no producer occurrence in the supplied LB1 export. The same application does have a real Fumex path: A999 Fumex Running I0011.16 and Full Bottle interlock bit 30 feed Warning 32 Fumex Not Ready. That warning path is operational evidence, not the producer of Fault 489.",
        relatedEvidence: Object.freeze(["E5101_A999_FumexRunning = I0011.16", "Warnings_LB1[2].0 = Warning 32 Fumex Not Ready", "Consumed_FullBottle85_B.Interlock_Data_Bit[30] = Fumex Running"])
      }),
      641: Object.freeze({
        status: "named-fault-no-producer-no-distinct-pressure-input-found",
        reason: "Fault 641 / Faults_LB1[40].1 has no exact producer occurrence in the supplied LB1 export and no distinct infeed-worm pressure-switch alias was found. Do not borrow PS101/I0010.18 from Fault 640. P131/I0010.19 is the infeed-worm clutch-overload sensor used by Fault 684, not an air-pressure switch. The separate InfeedBlowoff circuit has contactor/overload supervision but no pressure input in this PLC revision.",
        relatedEvidence: Object.freeze(["PS101/I0010.18 belongs to Fault 640 general machine air", "P131/I0010.19 belongs to Fault 684 infeed-worm clutch overload", "E8601_MS101_InfeedBlowoffOverload = I0009.30; no infeed-worm pressure input found"])
      }),
      697: Object.freeze({
        status: "unassigned-alarm-position-no-producer",
        reason: "The alarm table contains only the text 'Fault 697' at COMMENT[43].9. Faults_LB1[43].9 has no producer occurrence and no subsystem meaning in the supplied LB1 export, so ServoForge does not invent one."
      })
    });

    function roleFor(entry) {
      const n = Number(entry?.number);
      if (n === 700) return evidence("_Machine_Jumps / Inspection", "raw-external-event-latch", "primary", "Raw Heuft sequential-label event", entry.processTrace?.producerSignals || [], entry.processTrace?.summary || "Raw sequential-label event.", 10);
      if (n === 719) return evidence("LaserGoodShot", "consecutive-missing-good-shot-counter", "primary", "Laser Good Shot supervision", entry.processTrace?.producerSignals || [], entry.processTrace?.summary || "Laser Good Shot supervision.", 12);
      if ([489, 641, 697].includes(n)) return evidence("alarm table source audit", "no-producer-in-supplied-revision", "disabled", "Named/unassigned alarm path not promoted", [], entry.sourceGap?.reason || "No producer found.", 100, "source-gap-no-producer");
      return null;
    }

    function resolveBaseOrSupplemental(value) {
      if (typeof value === "object" && value) return value;
      const key = String(value ?? "").trim();
      if (/^0*\d+$/.test(key)) {
        const n = Number(key);
        if (supplementalByNumber.has(n)) return supplementalByNumber.get(n);
      }
      return base.getTopModulFault(value);
    }

    function enrich(entry) {
      if (!entry?.plcFault || entry.diagnosticScope === "Station") return entry;
      const n = Number(entry.number);
      let details = {};
      if (n === 489) details = { sourceGap: SOURCE_GAPS[489], circuitTrace: FUMEX_CIRCUIT };
      else if (n === 641) details = { sourceGap: SOURCE_GAPS[641] };
      else if (n === 697) details = { sourceGap: SOURCE_GAPS[697] };
      else if (n === 700) details = { processTrace: PROCESS[700], circuitTrace: HEUFT_LABEL_CIRCUIT };
      else if (n === 719) details = { processTrace: PROCESS[719], circuitTrace: LASER_GOODSHOT_CIRCUIT };
      else return entry;
      const candidate = Object.freeze({ ...entry, ...details });
      const rung = roleFor(candidate);
      return Object.freeze({ ...candidate, ...(rung ? { labelerRungEvidence: rung } : {}) });
    }

    const enrichedSupplemental = Object.freeze(supplemental.map(enrich));
    const entries = Object.freeze([...base.entries, ...enrichedSupplemental]);

    function scoreSupplemental(entry, query, context = {}) {
      const q = base.normalize(query);
      if (!q) return 0;
      const compact = q.replaceAll(" ", "");
      const numeric = /^0*\d+$/.test(compact) ? Number(compact) : null;
      let score = numeric === entry.number ? 500 : 0;
      const text = base.normalize([entry.title, entry.category, ...(entry.aliases || [])].join(" "));
      if (text.includes(q)) score += 80;
      for (const term of q.split(" ").filter((item) => item.length > 1)) if (text.includes(term)) score += 8;
      const ctx = base.normalize([context.machineType, context.mapName].filter(Boolean).join(" "));
      if (ctx.includes("topmodul") || ctx.includes("top modul")) score += 18;
      return score;
    }

    function getEntry(id) {
      const supplementalEntryMatch = supplementalById.get(String(id || ""));
      return supplementalEntryMatch ? enrich(supplementalEntryMatch) : enrich(base.getEntry(id));
    }

    function getTopModulFault(value) {
      return enrich(resolveBaseOrSupplemental(value));
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const local = enrichedSupplemental
        .map((entry) => ({ ...entry, searchScore: scoreSupplemental(entry, query, context) }))
        .filter((entry) => entry.searchScore > 0);
      const combined = [...local, ...base.searchEntries(query, context, requested + 12).map(enrich)];
      const seen = new Set();
      return combined
        .sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0) || String(a.title).localeCompare(String(b.title)))
        .filter((entry) => { if (!entry || seen.has(entry.id)) return false; seen.add(entry.id); return true; })
        .slice(0, requested);
    }

    function supplementalRelations(entry) {
      const n = Number(entry?.number);
      const rows = [];
      const push = (number, score, reason, causalRole = "sibling-diagnostic", causalRoleLabel = "Related evidence") => {
        const related = getTopModulFault(number);
        if (related) rows.push({ ...related, relationScore: score, relationReason: reason, causalRole, causalRoleLabel });
      };
      if (n === 700) {
        push(673, 190, "Same Heuft I0011.19 sequential-label event; Fault 700 is raw-event latch while 673 is processed Inspection output", "parallel-evidence", "Same event / parallel PLC layer");
        push(674, 100, "Heuft inspection readiness is related system context");
        push(691, 95, "Same Heuft interface, different sonic event");
      }
      if (n === 673) push(700, 190, "Same Heuft I0011.19 sequential-label event represented by a separate raw-event latch", "parallel-evidence", "Same event / parallel PLC layer");
      if (n === 719) {
        push(672, 120, "Laser Coder Not Ready is related coder-state evidence but does not directly produce the Good Shot counter fault");
        push(687, 105, "Laser air-pressure fault can prevent normal coder operation and should be checked if it occurred first");
        push(81, 90, "Laser fault override suppresses LaserGoodShot.Fault generation while active", "operating-state", "Override state");
      }
      return rows;
    }

    function getTopModulFaultRelations(value, limit = 10) {
      const entry = getTopModulFault(value);
      if (!entry?.plcFault) return [];
      const raw = base.getTopModulFaultRelations?.(entry, Math.max(20, Number(limit) || 10)) || [];
      const combined = [...supplementalRelations(entry), ...raw.map(enrich)];
      const seen = new Set();
      return combined
        .filter((candidate) => candidate && candidate.number !== entry.number)
        .sort((a, b) => Number(b.relationScore || 0) - Number(a.relationScore || 0) || Number(a.number) - Number(b.number))
        .filter((candidate) => { if (seen.has(candidate.number)) return false; seen.add(candidate.number); return true; })
        .slice(0, Math.max(1, Number(limit) || 10));
    }

    function getTopModulFirstFaultCandidates(value, limit = 8) {
      const entry = getTopModulFault(value);
      const n = Number(entry?.number);
      const explicit = [];
      if (n === 719) explicit.push(getTopModulFault(672), getTopModulFault(687));
      const raw = base.getTopModulFirstFaultCandidates?.(entry, Math.max(16, Number(limit) || 8)) || [];
      const seen = new Set();
      return [...explicit.filter(Boolean), ...raw.map(enrich)]
        .filter((candidate) => candidate?.labelerRungEvidence?.rootLikelihood !== "disabled")
        .filter((candidate) => { if (!candidate || candidate.number === n || seen.has(candidate.number)) return false; seen.add(candidate.number); return true; })
        .slice(0, Math.max(1, Number(limit) || 8));
    }

    function getTopModulProcessTrace(value) {
      const entry = getTopModulFault(value) || getEntry(value);
      return entry?.processTrace || base.getTopModulProcessTrace?.(value) || null;
    }

    function getTopModulCircuitTrace(value) {
      const entry = getTopModulFault(value) || getEntry(value);
      return entry?.circuitTrace || base.getTopModulCircuitTrace?.(value) || null;
    }

    function getTopModulFaultDrillDown(value, limit = 10) {
      const entry = getTopModulFault(value);
      if (!entry?.plcFault) return null;
      const original = supplementalByNumber.has(Number(entry.number)) ? null : base.getTopModulFaultDrillDown?.(entry, limit);
      const related = getTopModulFaultRelations(entry, limit);
      const firstFaultCandidates = getTopModulFirstFaultCandidates(entry, Math.min(8, Math.max(4, Number(limit) || 8)));
      return Object.freeze({
        ...(original || {}),
        entry,
        station: null,
        family: entry.plcFault.family,
        traceStatus: entry.plcFault.traceStatus,
        related,
        firstFaultCandidates,
        processTrace: entry.processTrace || original?.processTrace || null,
        circuitTrace: entry.circuitTrace || original?.circuitTrace || null,
        sourceGap: entry.sourceGap || original?.sourceGap || null,
        prompt: Number(entry.number) === 719
          ? "Fault 719 is produced by LaserGoodShot missing-confirmation supervision. Check coder Head A/B Good Shot status, coder readiness/air faults that occurred first, trigger/timing context and coder diagnostics before treating the legacy 'Enchoder' wording as a direct encoder fault."
          : Number(entry.number) === 700
            ? "Fault 700 is the raw Heuft sequential-label event latch. Compare its timestamp with parallel processed Fault 673 and read the Heuft inspection reason; do not treat one PLC representation as proof that it caused the other."
            : `Fault ${entry.code} is source-audited. Use the source-gap evidence rather than inventing an unverified producer.`
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      if (base.getTopModulFault(700) || base.getTopModulFault(719)) errors.push("v345 supplemental alarms collide with an earlier catalog entry.");
      const f489 = getTopModulFault(489);
      if (!f489?.sourceGap || !f489?.circuitTrace?.plcSignals?.includes("E5101_A999_FumexRunning = I0011.16")) errors.push("Fault 489 lost Fumex source-gap/interface evidence.");
      if (f489?.processTrace) errors.push("Fault 489 must not gain an invented producer trace.");
      const f641 = getTopModulFault(641);
      if (!f641?.sourceGap || !/PS101.*Fault 640/i.test(f641.sourceGap.reason) || !/P131.*Fault 684/i.test(f641.sourceGap.reason)) errors.push("Fault 641 must preserve the no-producer/no-borrow pressure evidence.");
      const f697 = getTopModulFault(697);
      if (!f697?.sourceGap || f697?.processTrace) errors.push("Fault 697 must remain an unassigned source-gap alarm position.");
      const f700 = getTopModulFault(700);
      if (!f700?.processTrace?.producerSignals?.includes("OTE(Faults_LB1[43].12)")) errors.push("Fault 700 lost raw sequential-label latch evidence.");
      if (!f700?.circuitTrace?.drawingLocations?.some((row) => Number(row.pdfPage) === 193)) errors.push("Fault 700 lost Heuft page 193 evidence.");
      const f719 = getTopModulFault(719);
      if (!f719?.processTrace?.producerSignals?.includes("LaserGoodShot.FaultCounter.PRE = 150")) errors.push("Fault 719 lost Good Shot counter PRE=150 evidence.");
      if (!f719?.processTrace?.producerSignals?.includes("LaserGoodShot.Fault -> Faults_LB1[44].15")) errors.push("Fault 719 lost exact fault-bit producer evidence.");
      if (!f719?.circuitTrace?.plcSignals?.includes("XIC(Logic_1) OTE(E5101_A999_26_EncoderOK)")) errors.push("Fault 719 lost forced encoder-OK caveat.");
      if (!f719?.circuitTrace?.drawingLocations?.some((row) => Number(row.pdfPage) === 174) || !f719?.circuitTrace?.drawingLocations?.some((row) => Number(row.pdfPage) === 176)) errors.push("Fault 719 lost exact coder pages 174/176.");
      if (!getTopModulFaultRelations(700, 8).some((row) => row.number === 673 && row.causalRole === "parallel-evidence")) errors.push("Fault 700 must relate to Fault 673 as parallel same-event evidence.");
      if (Number(getTopModulFaultDrillDown(719, 8)?.entry?.number) !== 719) errors.push("Fault 719 supplemental drill-down is unavailable.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+labeler-remaining-gaps-v1`,
      entries,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulProcessTrace,
      getTopModulCircuitTrace,
      topModulNamedFaultCount: Number(base.topModulNamedFaultCount || 0) + 2,
      topModulSupplementalNamedFaults: Object.freeze([700, 719]),
      topModulSupplementalAlarmPositions: Object.freeze([697, 700, 719]),
      topModulLabelerRemainingSourceGaps: Object.freeze([489, 641, 697]),
      validate
    });
  };
});
