"use strict";

(function installAplCartCoreStatus(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplCartCoreStatusExtension() {
  return function extendLibrary(base) {
    if (!base?.getEntry || !base?.getSource || !base?.getStationFaultTemplate || !base?.searchEntries || !base?.normalize || !base?.validate || !Array.isArray(base.entries) || !base?.getAplCartFoundationPlan) {
      throw new Error("APL Cart foundation and shared Station tracing are required before v364 core-status tracing.");
    }

    const SOURCE = base.getSource("lb1-aplcart-readable-l5k-v355") || base.getSource("topmodul-co85-lb1-aplcart1-l5k");
    if (!SOURCE) throw new Error("Readable LB1 APL Cart 1 PLC source is unavailable.");

    const SUPPORTED = Object.freeze([1, 2, 3, 4, 20, 31]);
    const code = (number) => String(number).padStart(5, "0");
    const localAddress = (number) => `Faults[${Math.floor(number / 16)}].${number % 16}`;
    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const choice = (value, label) => Object.freeze({ value, label });
    const observe = (key, prompt, choices) => Object.freeze({ key, prompt, choices: Object.freeze(choices) });
    const result = (resultCode, severity, title, summary, next = "") => Object.freeze({ code: resultCode, severity, title, summary, next });

    const OBSERVE = "Use normal HMI/PLC diagnostics only. Do not force Cart safety, controller, carriage, reset, fault, or synchronization bits.";
    const LOTO = "Follow site lockout/tagout and stored-energy requirements before hands-on work on safety relays, guard/pinch-roller hardware, carriage components, connectors, wiring, or PLC chassis hardware.";
    const ELECTRICAL = "Energized electrical or safety-circuit measurements are for qualified personnel under the site's approved electrical safe-work procedure.";
    const SAFETY = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);

    const TITLES = Object.freeze({
      1: "E-Stop From Main Machine",
      2: "Controller I/O Failure",
      3: "Guard Door Open",
      4: "Door Closed - Press Reset",
      20: "Press Reset If Carriage Is In Front Position",
      31: "Synchronization Lost During Run"
    });

    function templateFor(number) {
      return base.getStationFaultTemplate(Number(number));
    }

    function sourceGapFor(number) {
      return templateFor(number)?.sourceGap || base.getStationSourceGap?.(number) || null;
    }

    const SOURCE_STATE = Object.freeze({
      1: Object.freeze({
        family: "Incoming main-machine E-stop feedback",
        status: "exact-plc-producer-reuses-shared-safety-circuit",
        producer: "[XIO(E1101_CR202_EStop / I0005.04) OR XIO(E1101_CR204_EStopDelayed / I0005.05)] AND XIC(PowerOnReset) -> OTE(Faults[0].1)",
        sourceRefs: Object.freeze(["Cart 1 L5K 17120-17124: dual E-stop feedback producer", "K605163 shared Station Fault 001 circuit: CR202 / CR204, page 42"]),
        watchPoints: freezeRows([
          { tag: "E1101_CR202_EStop / I0005.04", role: "Direct main-machine E-stop feedback", relationship: "Either missing feedback branch can assert 00001 after PowerOnReset.", interpretation: "Compare the raw PLC state with the actual upstream safety state; do not infer the failed device from the alarm alone.", caution: "Never jumper, force, or bypass this safety input." },
          { tag: "E1101_CR204_EStopDelayed / I0005.05", role: "Delayed main-machine E-stop feedback", relationship: "The second parallel branch independently participates in the same Cart-local alarm.", interpretation: "Preserve which of the two feedbacks is absent before opening hardware paths.", caution: "CR204 also participates in Station power/feedback permissive logic." },
          { tag: "PowerOnReset / Faults[0].1", role: "Fault qualification", relationship: "The safety-feedback alarm is qualified after power-on reset and removes Cart Jog/Machine On enables.", interpretation: "Use normal safety recovery only after the actual safety condition is healthy." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Identify the missing feedback", detail: "Read I0005.04 and I0005.05 in normal diagnostics before reset." },
          { order: 2, label: "Keep upstream safety separate from Cart hardware", detail: "A missing Cart feedback can originate upstream in the main-machine safety chain, at CR202/CR204, or in the interface wiring; 00001 does not distinguish those by itself." },
          { order: 3, label: "Use the existing shared Station circuit", detail: "If the raw feedback disagrees with the verified physical safety state, follow the already-verified K605163 CR202/CR204 circuit under the approved safety procedure." }
        ]),
        observations: Object.freeze([
          observe("cr202", "E1101_CR202_EStop / I0005.04", [choice("1", "1 / feedback present"), choice("0", "0 / feedback absent"), choice("unknown", "Not verified")]),
          observe("cr204", "E1101_CR204_EStopDelayed / I0005.05", [choice("1", "1 / feedback present"), choice("0", "0 / feedback absent"), choice("unknown", "Not verified")])
        ])
      }),
      2: Object.freeze({
        family: "Controller / chassis LED-status supervision",
        status: "exact-plc-producer-with-undecoded-led-value",
        producer: "BasicRoutine: GSV(MODULE, ?, LedStatus, LEDStatus); NEQ(LEDStatus,3) -> OTL(Faults[0].2)",
        sourceRefs: Object.freeze(["Cart 1 L5K 18150-18155: GSV LedStatus and NEQ(LEDStatus,3) latch", "Cart 1 L5K 17126-17130: reset/inhibit handling for Faults[0].2", "K605163 shared Station Fault 002 circuit: CPU202 1756-L61 / Cart chassis page 29"]),
        watchPoints: freezeRows([
          { tag: "LEDStatus", role: "Controller/module LED-status value", relationship: "The readable source latches 00002 when LEDStatus != 3.", interpretation: "Capture the numeric value and more-specific module faults before replacing hardware.", caution: "The export does not decode what numeric value 3 means and exports the GSV instance as '?'; ServoForge does not invent that definition." },
          { tag: "Faults[0].2", role: "Latched general controller I/O alarm", relationship: "ResetGeneral, loss of PowerOnReset, or the first Ethernet-data pulse can unlatch the stored fault in the Faults routine.", interpretation: "A more-specific ENBT, output-fuse, SERCOS or axis/module fault is stronger child evidence when present." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Capture LEDStatus", detail: "Record the actual value before clearing the latch." },
          { order: 2, label: "Look for specific child/module alarms", detail: "Use Slot 1/2/4 Ethernet, output-fuse, motion-module and servo diagnostics to narrow a general controller/chassis condition." },
          { order: 3, label: "Do not decode value 3 by assumption", detail: "Use Rockwell/controller diagnostics appropriate to the installed revision; the supplied L5K does not define the numeric LED-status enumeration." }
        ]),
        observations: Object.freeze([observe("led", "LEDStatus compared with 3", [choice("3", "Exactly 3"), choice("other", "Any value other than 3"), choice("unknown", "Not verified")])])
      }),
      3: Object.freeze({
        family: "LS143 guard / pinch-roller safety state",
        status: "exact-plc-producer-reuses-shared-ls143-circuit",
        producer: "XIC(E2001_LS143_SafetySwitch / I0005.08) AND XIC(PowerOnReset) -> OTE(Faults[0].3)",
        sourceRefs: Object.freeze(["Cart 1 L5K 17132-17138: LS143 Fault 003/004 state rung", "K605163 shared Station Fault 003 circuit: LS143 / 2001-W143, page 47"]),
        watchPoints: freezeRows([
          { tag: "E2001_LS143_SafetySwitch / I0005.08", role: "LS143 raw safety-switch input", relationship: "The supplied executable rung drives 00003 with XIC(LS143) after PowerOnReset.", interpretation: "Use the raw bit exactly as the source presents it; do not infer physical open/closed electrical polarity from the alarm title alone.", caution: "Never bypass or jumper LS143." },
          { tag: "Faults[0].3", role: "Primary LS143 safety-state alarm", relationship: "00003 and 00004 share one state/recovery rung and both remove Cart Jog/Machine On enables.", interpretation: "Treat 00004 as the recovery/reset state of the same LS143 path, not a second switch." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Read LS143 raw state", detail: "Capture I0005.08 and the physical guard/pinch-roller safety condition without forcing the input." },
          { order: 2, label: "Separate 00003 from 00004", detail: "00003 is the direct source state; 00004 is a latched follow-on/recovery condition from the same LS143 circuit." },
          { order: 3, label: "Use the shared K605163 circuit only if needed", detail: "If the physical condition and raw input disagree, follow LS143 / 2001-W143 under the approved LOTO/safety procedure." }
        ]),
        observations: Object.freeze([observe("ls143", "E2001_LS143_SafetySwitch / I0005.08", [choice("1", "1 / XIC true"), choice("0", "0 / XIC false"), choice("unknown", "Not verified")])])
      }),
      4: Object.freeze({
        family: "LS143 closed/recovery reset state",
        status: "exact-plc-secondary-reset-state-reuses-shared-ls143-circuit",
        producer: "[XIO(E2001_LS143_SafetySwitch) AND XIC(Faults[0].3)] OR [XIC(Faults[0].4) AND XIO(ControlOut.ResetGeneral)] -> OTE(Faults[0].4)",
        sourceRefs: Object.freeze(["Cart 1 L5K 17132-17138: Fault 004 recovery/self-hold logic", "K605163 shared Station Fault 004 circuit: same LS143 / 2001-W143, page 47"]),
        watchPoints: freezeRows([
          { tag: "Faults[0].3 + E2001_LS143_SafetySwitch", role: "Transition into reset-required state", relationship: "00004 is first created when the LS143 raw state changes to the XIO condition while 00003 is still true.", interpretation: "This is a state transition from the same safety circuit, not evidence of a second failed device." },
          { tag: "ControlOut.ResetGeneral / Faults[0].4", role: "Reset-required self-hold", relationship: "00004 then self-holds while ResetGeneral is false.", interpretation: "Use the normal reset only after the guard/safety condition is verified healthy.", caution: "Never reset around an unresolved safety condition." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Check the preceding 00003 state", detail: "00004 is downstream of the LS143/00003 sequence; the earlier safety state is the stronger first-fault evidence." },
          { order: 2, label: "Verify the physical safe condition", detail: "Confirm the guard/pinch-roller safety condition and LS143 raw input agree." },
          { order: 3, label: "Reset normally only when safe", detail: "If the source state is healthy, use the approved ResetGeneral sequence; do not bypass LS143 to clear 00004." }
        ]),
        observations: Object.freeze([
          observe("fault3", "Was Cart-local 00003 active first?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")]),
          observe("ls143", "E2001_LS143_SafetySwitch / I0005.08", [choice("1", "1 / XIC true"), choice("0", "0 / XIC false"), choice("unknown", "Not verified")])
        ])
      }),
      20: Object.freeze({
        family: "Carriage-front recovery / reset supervision",
        status: "exact-plc-state-latch-reuses-shared-p133-circuit",
        producer: "XIO(P133/I0005.27) AND XIO(RunWithoutLabels) AND XIO(RunWithoutContPres) -> OTL(StoreCarriageNotFront); then XIC(StoreCarriageNotFront) AND XIC(P133) -> OTE(Faults[1].4)",
        sourceRefs: Object.freeze(["Cart 1 L5K 17216-17220: carriage-not-front storage and Fault 020 producer", "K605163 shared Station Fault 020 circuit: P133 / 1501-W133, page 46"]),
        watchPoints: freezeRows([
          { tag: "E1501_P133_CarriageFront / I0005.27", role: "Carriage-front sensor", relationship: "A false P133 state in normal label/container-presence operation latches StoreCarriageNotFront; when P133 later becomes true, 00020 is displayed.", interpretation: "00020 is a recovery/reset prompt after the carriage has been away from front, not proof that P133 is currently failed." },
          { tag: "StoreCarriageNotFront", role: "Stored carriage-away state", relationship: "The latch removes EnableMachineOn until the reset sequence clears it.", interpretation: "Preserve the transition history before reset." },
          { tag: "PV_General.RunWithoutLabels / RunWithoutContPres", role: "Mode gates", relationship: "Either run-without mode suppresses the initial StoreCarriageNotFront latch.", interpretation: "Verify the current approved operating mode; do not change modes as a troubleshooting shortcut." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Confirm P133 transition", detail: "Determine whether I0005.27 was false and has now returned true." },
          { order: 2, label: "Check the stored state", detail: "If StoreCarriageNotFront is set, 00020 is the expected reset-required state after return to front." },
          { order: 3, label: "Trace hardware only on disagreement", detail: "If physical carriage position and P133 disagree, use the existing K605163 P133 / 1501-W133 circuit under LOTO." }
        ]),
        observations: Object.freeze([
          observe("p133", "E1501_P133_CarriageFront / I0005.27", [choice("1", "1 / front signal present"), choice("0", "0 / front signal absent"), choice("unknown", "Not verified")]),
          observe("stored", "StoreCarriageNotFront", [choice("1", "Latched"), choice("0", "Clear"), choice("unknown", "Not verified")])
        ])
      }),
      31: Object.freeze({
        family: "Synchronization-lost alarm-table position",
        status: "catalog-only-no-executable-producer",
        producer: "No executable reference to Faults[1].15 was found in the supplied readable Cart 1 L5K.",
        sourceRefs: Object.freeze(["Cart 1 Fault array comment: Fault 031 Synchronisation lost while running", "Cart 1 HMI text: 00031 SYNCHRONIZATION LOST DURING RUN", "Station foundation audit: Faults[1].15 has no executable producer reference"]),
        watchPoints: freezeRows([
          { tag: "Faults[1].15", role: "Catalog-assigned local position", relationship: "The alarm text exists, but no writer/producer is present in the supplied readable Cart 1 export.", interpretation: "If 00031 occurs live, capture the exact controller/project revision and surrounding motion/synchronization alarms before assigning a cause.", caution: "Do not borrow Fault 00016, base Labeler 642-647, or another synchronization producer merely because the wording is similar." },
          { tag: "DataFromLS.Par1[0].3", role: "Separate Labeler-facing synchronization-health bit", relationship: "Earlier source review shows the supplied Cart 1 program drives this outgoing bit with Logic_1.", interpretation: "That transport fact does not prove a producer for local 00031 and does not make 00031 equivalent to base-Labeler Not Synchronized summaries." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Preserve the exact five-digit code", detail: "00031 is a Cart-local HMI alarm-table identity." },
          { order: 2, label: "Keep the producer gap visible", detail: "No executable writer for Faults[1].15 is present in the supplied Cart 1 export." },
          { order: 3, label: "Require matching-revision evidence", detail: "Before publishing a synchronization route, obtain the live matching project or another verified source that actually writes this bit." }
        ]),
        observations: Object.freeze([])
      })
    });

    function makeEntry(number) {
      const state = SOURCE_STATE[number];
      const gap = number === 31 ? sourceGapFor(number) : null;
      const template = templateFor(number);
      const summary = number === 31
        ? `Cart-local ${code(number)} is present in the supplied alarm table as ${TITLES[number]}, but no executable producer for ${localAddress(number)} was found. ServoForge keeps the five-digit identity searchable and explicitly unpromoted instead of borrowing a similarly named synchronization fault.`
        : `Cart-local ${code(number)} is ${TITLES[number]}. ${state.producer} is the source-backed Cart 1 logic. The hardware route is reused from the existing shared Station/K605163 authority rather than duplicated per Cart position.`;
      return Object.freeze({
        id: `apl-cart-${code(number)}`,
        code: code(number),
        number,
        category: number <= 4 ? "APL Cart / Safety & Controller" : number === 20 ? "APL Cart / Carriage" : "APL Cart / Source Gap",
        aliases: Object.freeze([`fault ${number}`, `apl cart ${number}`, `cart local ${String(number).padStart(3, "0")}`, TITLES[number], localAddress(number)]),
        contextHints: Object.freeze(["apl", "cart", "labeling station", state.family]),
        title: TITLES[number],
        summary,
        probableCauses: number === 31
          ? Object.freeze(["The supplied Cart 1 source does not identify an executable producer for this alarm position; do not infer one from similar synchronization wording."])
          : Object.freeze(["Use the exact source-backed state below and the already-verified shared Station circuit before replacing hardware."]),
        checks: number === 31
          ? Object.freeze(["Capture the live project revision, alarm chronology and exact 00031 state if observed.", "Do not equate local 00031 with Cart 00016 or base Labeler synchronization summaries without source proof."])
          : Object.freeze(["Capture the raw producer state before reset.", "Follow the shared K605163 hardware path only when PLC state and physical condition disagree."]),
        actions: number === 31
          ? Object.freeze(["Obtain a matching readable controller revision before assigning a producer or hardware route."])
          : Object.freeze(["Correct only the source-proven safety/controller/carriage condition, then verify normal guarded operation using the approved reset/recovery sequence."]),
        safety: SAFETY,
        sourceRefs: Object.freeze([{ sourceId: SOURCE.id, locator: state.sourceRefs[0] }]),
        circuitTrace: number === 31 ? null : (template?.circuitTrace || null),
        sourceGap: gap || undefined
      });
    }

    const LOCAL_ENTRIES = Object.freeze(SUPPORTED.map(makeEntry));
    const LOCAL_BY_ID = new Map(LOCAL_ENTRIES.map((entry) => [entry.id, entry]));
    const LOCAL_BY_NUMBER = new Map(LOCAL_ENTRIES.map((entry) => [entry.number, entry]));
    const entries = Object.freeze([...base.entries, ...LOCAL_ENTRIES]);

    function resolveNumber(value) {
      if (typeof value === "object" && value) {
        const number = Number(value.number);
        if (SUPPORTED.includes(number) && String(value.code || "") === code(number)) return number;
      }
      if (Number.isInteger(value) && SUPPORTED.includes(Number(value))) return Number(value);
      const text = String(value || "").trim();
      const idMatch = /^apl-cart-(0000[1-4]|00020|00031)$/i.exec(text);
      if (idMatch) return Number(idMatch[1]);
      const exact = /^(0000[1-4]|00020|00031)$/.exec(text);
      if (exact) return Number(exact[1]);
      const embedded = /\b(0000[1-4]|00020|00031)\b/.exec(text);
      return embedded ? Number(embedded[1]) : null;
    }

    function getAplCartCorePlan(value) {
      const number = resolveNumber(value);
      if (number == null) return null;
      const state = SOURCE_STATE[number];
      const entry = LOCAL_BY_NUMBER.get(number);
      const template = templateFor(number);
      return Object.freeze({
        id: entry.id,
        number,
        code: code(number),
        title: TITLES[number],
        scope: "LB1 APL Cart 1 / Cart-local HMI fault",
        family: state.family,
        status: state.status,
        producer: state.producer,
        localAddress: localAddress(number),
        source: SOURCE,
        sourceRefs: state.sourceRefs,
        sharedStationTemplateId: template?.id || `topmodul-station-template-${number}`,
        circuitTrace: number === 31 ? null : (template?.circuitTrace || null),
        sourceGap: number === 31 ? sourceGapFor(31) : null,
        watchPoints: state.watchPoints,
        steps: state.steps,
        observations: state.observations,
        safety: SAFETY
      });
    }

    function evaluateAplCartCore(value, observation = {}) {
      const plan = getAplCartCorePlan(value);
      if (!plan) return null;
      if (plan.number === 31) return result("source-gap", "hold", "Producer unresolved in supplied Cart 1 source", "00031 is a real Cart-local alarm-table identity, but no executable writer for Faults[1].15 is present in this source revision.", "Capture a live matching project/revision before assigning a synchronization cause.");
      if (plan.number === 1) {
        const a = String(observation.cr202 || "unknown");
        const b = String(observation.cr204 || "unknown");
        if (a === "0" || b === "0") return result("feedback-missing", "direct", "Incoming E-stop feedback is missing", `${a === "0" ? "CR202/I0005.04" : "CR204/I0005.05"} is in the exact XIO producer state for 00001.`, "Keep the safety chain intact and localize the upstream relay/interface condition under the approved safety procedure.");
        if (a === "1" && b === "1") return result("feedback-present", "hold", "Both Cart E-stop feedback inputs are present now", "The exact producer inputs are currently healthy; use alarm history and upstream safety chronology rather than forcing a recurrence.");
      }
      if (plan.number === 2) {
        const led = String(observation.led || "unknown");
        if (led === "other") return result("led-not-3", "direct", "LEDStatus matches the source fault condition", "The Cart source latches 00002 when LEDStatus is not equal to 3.", "Read more-specific controller/module diagnostics before hardware replacement.");
        if (led === "3") return result("led-3", "hold", "LEDStatus is 3 now", "The current value does not meet the source latch condition; the alarm may be historical or already cleared.");
      }
      if (plan.number === 3) {
        if (String(observation.ls143 || "unknown") === "1") return result("ls143-xic", "direct", "LS143 raw state matches the 00003 producer", "I0005.08 is true, satisfying the source XIC branch after PowerOnReset.", "Verify the actual safety condition; do not infer physical switch polarity from the alarm text alone.");
      }
      if (plan.number === 4) {
        if (String(observation.fault3 || "unknown") === "yes" && String(observation.ls143 || "unknown") === "0") return result("reset-state", "direct", "00004 recovery/reset transition is supported", "The source creates 00004 when 00003 was active and LS143 reaches the XIO state, then holds it until normal reset.", "Verify the physical safe condition before ResetGeneral.");
      }
      if (plan.number === 20) {
        const p133 = String(observation.p133 || "unknown");
        const stored = String(observation.stored || "unknown");
        if (p133 === "1" && stored === "1") return result("carriage-returned", "direct", "Carriage returned to front after a stored away condition", "P133 is true while StoreCarriageNotFront is latched, which is the exact 00020 producer state.", "If physical position agrees, use the normal reset/recovery sequence; trace P133 only if the raw state disagrees with the carriage.");
        if (p133 === "0" && stored === "1") return result("carriage-away", "hold", "Carriage-away state is stored but 00020 return-to-front condition is not yet met", "The source keeps Machine On inhibited while the carriage-away latch remains set.");
      }
      return result("capture", "observe", "Capture the exact source state", `Read the v364 watch points for ${plan.code} before choosing a hardware path.`, "Preserve alarm chronology and the affected Station/Cart identity.");
    }

    function getAplCartFoundationPlan(value) {
      return getAplCartCorePlan(value) || base.getAplCartFoundationPlan(value);
    }

    function evaluateAplCartFoundation(value, observation = {}) {
      return getAplCartCorePlan(value) ? evaluateAplCartCore(value, observation) : base.evaluateAplCartFoundation?.(value, observation) || null;
    }

    function getEntry(id) {
      return LOCAL_BY_ID.get(String(id || "")) || base.getEntry(id);
    }

    function entryText(entry) {
      return base.normalize([entry.code, entry.title, entry.summary, entry.category, ...(entry.aliases || [])].join(" "));
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const normalized = base.normalize(query);
      const exactText = String(query || "").trim();
      const localMatches = LOCAL_ENTRIES.map((entry) => {
        const text = entryText(entry);
        let searchScore = 0;
        if (entry.code === exactText || entry.id === exactText) searchScore += 340;
        if (normalized && text.includes(normalized)) searchScore += 60;
        for (const term of normalized.split(" ").filter((term) => term.length > 1)) if (text.includes(term)) searchScore += 8;
        return { ...entry, searchScore };
      }).filter((entry) => entry.searchScore > 0);
      const combined = [...localMatches, ...base.searchEntries(query, context, requested + LOCAL_ENTRIES.length)];
      const seen = new Set();
      return combined.sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0)).filter((entry) => {
        if (!entry?.id || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      }).slice(0, requested);
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      for (const number of SUPPORTED) {
        const entry = getEntry(`apl-cart-${code(number)}`);
        const plan = getAplCartCorePlan(number);
        if (!entry || !plan) errors.push(`APL Cart core Fault ${code(number)} is missing.`);
      }
      const f1 = getAplCartCorePlan(1);
      if (!/CR202/.test(f1?.producer || "") || !/CR204/.test(f1?.producer || "")) errors.push("00001 lost dual E-stop feedback producer evidence.");
      if (!f1?.circuitTrace?.deviceRows?.some((row) => row.device === "CR202") || !f1?.circuitTrace?.deviceRows?.some((row) => row.device === "CR204")) errors.push("00001 lost shared CR202/CR204 circuit authority.");
      const f2 = getAplCartCorePlan(2);
      if (!/NEQ\(LEDStatus,3\)/.test(f2?.producer || "")) errors.push("00002 lost LEDStatus != 3 producer evidence.");
      const f3 = getAplCartCorePlan(3);
      const f4 = getAplCartCorePlan(4);
      if (!/LS143/.test(f3?.producer || "") || !f3?.circuitTrace?.deviceRows?.some((row) => row.device === "LS143")) errors.push("00003 lost LS143 producer/circuit evidence.");
      if (!/Faults\[0\]\.3/.test(f4?.producer || "") || !/ResetGeneral/.test(f4?.producer || "")) errors.push("00004 lost LS143 recovery/reset logic.");
      const f20 = getAplCartCorePlan(20);
      if (!/P133/.test(f20?.producer || "") || !/StoreCarriageNotFront/.test(f20?.producer || "")) errors.push("00020 lost P133/store-state producer evidence.");
      if (!f20?.circuitTrace?.deviceRows?.some((row) => row.device === "P133")) errors.push("00020 lost shared P133 circuit authority.");
      const f31 = getAplCartCorePlan(31);
      if (f31?.status !== "catalog-only-no-executable-producer" || f31?.circuitTrace) errors.push("00031 must remain source-gap only without an invented producer/circuit.");
      if (!f31?.sourceGap) errors.push("00031 lost shared Station source-gap metadata.");
      if (!base.getAplCartFoundationPlan(5) || !getAplCartFoundationPlan(5)) errors.push("v364 must preserve v355 foundation plans.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+apl-cart-core-v364`,
      entries,
      getEntry,
      searchEntries,
      aplCartCoreFaults: SUPPORTED,
      getAplCartCorePlan,
      evaluateAplCartCore,
      getAplCartFoundationPlan,
      evaluateAplCartFoundation,
      validate
    });
  };
});
