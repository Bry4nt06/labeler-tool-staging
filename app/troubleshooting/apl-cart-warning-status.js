"use strict";

(function installAplCartWarningStatus(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplCartWarningStatusExtension() {
  return function extendLibrary(base) {
    if (!base?.getEntry || !base?.getSource || !base?.searchEntries || !base?.normalize || !base?.validate || !base?.getAplCartFoundationPlan || !Array.isArray(base.entries)) {
      throw new Error("APL Cart fault coverage is required before v365 warning tracing.");
    }

    const SOURCE = base.getSource("lb1-aplcart-readable-l5k-v355") || base.getSource("topmodul-co85-lb1-aplcart1-l5k");
    if (!SOURCE) throw new Error("Readable LB1 APL Cart 1 PLC source is unavailable.");

    const NAMED = Object.freeze([1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17]);
    const ACTIVE = Object.freeze([1, 3, 4, 5, 6, 8, 10, 12, 13, 15]);
    const SOURCE_GAPS = Object.freeze([2, 11, 14, 16, 17]);
    const pad = (number) => String(number).padStart(4, "0");
    const warningCode = (number) => `W ${pad(number)}`;
    const warningAddress = (number) => `Warnings[${Math.floor(number / 16)}].${number % 16}`;
    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const observe = (key, prompt, choices) => Object.freeze({ key, prompt, choices: Object.freeze(choices.map(([value, label]) => Object.freeze({ value, label }))) });
    const genericObservation = Object.freeze([observe("producerState", "Does the exact source condition currently evaluate true?", [["true", "Yes / true"], ["false", "No / false"], ["unknown", "Not verified"]])]);

    const OBSERVE = "Use normal HMI/PLC diagnostics only. Cart warnings are diagnostic state evidence; do not force warning, fault, mode, communication, sensor, or motion bits.";
    const LOTO = "Follow site lockout/tagout and stored-energy requirements before hands-on work on sensors, carriage hardware, cooling/air-conditioning equipment, label-web components, connectors, wiring, or motion hardware.";
    const ELECTRICAL = "Energized electrical, controller, or signal measurements are for qualified personnel under the site's approved electrical safe-work procedure.";
    const SAFETY = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);

    const DATA = Object.freeze({
      1: Object.freeze({
        title: "SERVO NOT HOMED",
        family: "Main-drive homing state",
        status: "exact-warning-producer",
        producer: "XIO(MainDrive.SData.Status.Axis_Is_Homed) XIO(PV_General.RunWithoutLabels) -> OTE(Warnings[0].1)",
        sourceRefs: Object.freeze(["Cart 1 L5K Warnings routine: MainDrive Axis_Is_Homed + RunWithoutLabels -> W 0001"]),
        watchPoints: freezeRows([
          { tag: "MainDrive.SData.Status.Axis_Is_Homed", role: "Station main-drive homing state", relationship: "W 0001 is true when the main drive is not homed and RunWithoutLabels is not active.", interpretation: "Treat this first as a motion/reference state, not as proof of failed servo hardware." },
          { tag: "PV_General.RunWithoutLabels", role: "Mode inhibit", relationship: "Run-without-labels suppresses this warning in the supplied source.", interpretation: "Do not change the mode merely to suppress the warning." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Confirm homing state", detail: "Read MainDrive.SData.Status.Axis_Is_Homed before replacing drive or feedback hardware." },
          { order: 2, label: "Use specific faults first", detail: "If a reference, servo, encoder, SERCOS, or motion fault is present, that specific fault is stronger evidence than W 0001." }
        ])
      }),
      2: Object.freeze({
        title: "SERVO NOT SYNCHRON",
        family: "Synchronization warning placeholder",
        status: "warning-output-disabled-by-logic0",
        producer: "XIC(Logic_0) -> OTE(Warnings[0].2)",
        sourceRefs: Object.freeze(["Cart 1 L5K Warnings routine: W 0002 producer is gated by Logic_0"]),
        sourceGap: "The named W 0002 HMI warning exists, but its only producer is XIC(Logic_0). It cannot become true in this supplied revision through that rung; use specific synchronization faults/status instead.",
        watchPoints: freezeRows([{ tag: "Warnings[0].2", role: "Disabled warning position", relationship: "Only source-visible producer is Logic_0-gated.", interpretation: "Do not borrow Fault 00016, 00031, or Labeler 642-647 merely because the wording is similar." }]),
        steps: freezeRows([{ order: 1, label: "Keep the source gap visible", detail: "If W 0002 is observed live, capture the exact Cart/controller revision before assigning a producer." }])
      }),
      3: Object.freeze({
        title: "MASTER ENCODER NOT HOMED",
        family: "Base-machine encoder homing state",
        status: "exact-warning-producer",
        producer: "[XIC(MainDrive.SData.Status.Axis_Is_Homed) OR XIC(PV_General.RunWithoutLabels)] XIO(BaseMachineEncoder.SData.Status.Axis_Is_Homed) -> OTE(Warnings[0].3)",
        sourceRefs: Object.freeze(["Cart 1 L5K Warnings routine: BaseMachineEncoder Axis_Is_Homed -> W 0003"]),
        watchPoints: freezeRows([
          { tag: "BaseMachineEncoder.SData.Status.Axis_Is_Homed", role: "Cart base-machine encoder homing state", relationship: "W 0003 requires this state false after the main-drive/mode gate is satisfied.", interpretation: "This is separate from Cart 00030 OPTO131 clock monitoring, Cart 00067 AQB FeedbackFault, and main Labeler Fault 670 fine-clock monitoring." },
          { tag: "MainDrive.SData.Status.Axis_Is_Homed", role: "Qualification gate", relationship: "Normal operation qualifies the master-encoder warning after the Station main drive is homed.", interpretation: "Preserve which homing state was missing first." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Separate the two homing states", detail: "Confirm MainDrive and BaseMachineEncoder Axis_Is_Homed independently." },
          { order: 2, label: "Do not collapse encoder paths", detail: "Use the existing Cart encoder/reference diagnostics only if a specific encoder/reference fault accompanies the warning." }
        ])
      }),
      4: Object.freeze({
        title: "AUTO MODE DISABLED BY OPERATOR",
        family: "Operator mode state",
        status: "exact-warning-producer",
        producer: "XIC(StartStop.StationDeactive) -> OTE(Warnings[0].4)",
        sourceRefs: Object.freeze(["Cart 1 L5K Warnings routine: StationDeactive -> W 0004"]),
        watchPoints: freezeRows([{ tag: "StartStop.StationDeactive", role: "Station deactivated state", relationship: "The warning follows this operator/application state directly.", interpretation: "W 0004 is not a hardware failure." }]),
        steps: freezeRows([{ order: 1, label: "Confirm intentional station state", detail: "Verify whether the Cart/Station was deliberately deactivated before troubleshooting hardware." }])
      }),
      5: Object.freeze({
        title: "LOW LABELS",
        family: "Label supply / end-of-reel prewarning",
        status: "exact-warning-producer-and-base-machine-handoff",
        producer: "[(XIO(InputDetectEndOfReel1) AND XIC(E5701_SS631_SelSwitchEndOfReel)) OR (XIO(InputDetectEndOfReel2) AND XIO(E5701_SS631_SelSwitchEndOfReel))] XIO(Faults[1].9) -> OTE(Warnings[0].5)",
        sourceRefs: Object.freeze(["Cart 1 L5K Warnings routine: selected end-of-reel detector -> W 0005", "Cart 1 L5K Data exchange: Warnings[0].5 OR Fault 025 OR autochange states -> DataFromLS.Par1[0].1"]),
        watchPoints: freezeRows([
          { tag: "InputDetectEndOfReel1 / InputDetectEndOfReel2", role: "Selected end-of-reel detector state", relationship: "SS631 selects which detector branch can create the low-label warning.", interpretation: "Inspect the selected reel/sensor path, not both indiscriminately." },
          { tag: "E5701_SS631_SelSwitchEndOfReel", role: "End-of-reel detector selector", relationship: "True selects detector 1; false selects detector 2 in the exact warning rung.", interpretation: "Preserve the source polarity rather than inferring reel identity from HMI wording." },
          { tag: "Faults[1].9 / Cart-local 00025", role: "No Labels / End Of Reel fault", relationship: "W 0005 is suppressed once local Fault 00025 is active.", interpretation: "W 0005 is therefore useful pre-fault evidence when it occurs first." },
          { tag: "DataFromLS.Par1[0].1", role: "Label-supply handoff to base machine", relationship: "The base-machine label-supply summary can be set by W 0005, Fault 00025, forced autochange, or label-length autochange state.", interpretation: "Do not equate the Labeler magazine-empty summary to one sensor." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Identify the selected reel detector", detail: "Read SS631 and only the selected InputDetectEndOfReel branch." },
          { order: 2, label: "Check whether 00025 followed", detail: "If No Labels / End Of Reel occurred after W 0005, use the existing Fault 00025 PE631/PE632 route as the stronger escalated fault evidence." },
          { order: 3, label: "Preserve warning chronology", detail: "W 0005 can explain a later base-Labeler label-supply summary without being a separate base-machine sensor failure." }
        ])
      }),
      6: Object.freeze({
        title: "FAULT AIR CONDITIONING",
        family: "Cart cooling / air-conditioning state",
        status: "exact-warning-producer",
        producer: "XIC(E0201_AC171_CoolingUnitFault) -> OTE(Warnings[0].6)",
        sourceRefs: Object.freeze(["Cart 1 L5K Warnings routine: AC171 cooling-unit fault state -> W 0006"]),
        watchPoints: freezeRows([{ tag: "E0201_AC171_CoolingUnitFault", role: "Cooling-unit fault input/state", relationship: "This state directly produces W 0006.", interpretation: "Use AC171/unit diagnostics before assigning a Cart servo or general machine-air fault." }]),
        steps: freezeRows([{ order: 1, label: "Confirm AC171 state", detail: "Read the cooling-unit fault state and any unit-local diagnostics before tracing Cart hardware." }])
      }),
      8: Object.freeze({
        title: "CARRIAGE NOT IN FRONT POSITION",
        family: "Carriage position warning",
        status: "exact-warning-producer",
        producer: "XIO(E1501_P133_CarriageFront) -> OTE(Warnings[0].8)",
        sourceRefs: Object.freeze(["Cart 1 L5K Warnings routine: P133 carriage-front input -> W 0008", "K605163 shared Station P133 carriage-front circuit"]),
        watchPoints: freezeRows([{ tag: "E1501_P133_CarriageFront / I0005.27", role: "Carriage-front sensor", relationship: "W 0008 is true whenever the source sees P133 false.", interpretation: "This current-state warning is distinct from Fault 00020, which is a stored return-to-front/reset condition." }]),
        steps: freezeRows([
          { order: 1, label: "Compare P133 with actual position", detail: "If the carriage is physically not front, correct the operating/mechanical condition first." },
          { order: 2, label: "Use Fault 00020 only when appropriate", detail: "00020 appears after a stored carriage-away condition when P133 returns true; it is not the same state as W 0008." }
        ])
      }),
      10: Object.freeze({
        title: "TEST MODE ON, SENSORS SIMULATED",
        family: "Test / run-with mode state",
        status: "exact-warning-producer",
        producer: "[XIC(PV_General.RunWithoutLabels) OR XIC(PV_General.RunWithoutContPres)] -> OTE(Warnings[0].10)",
        sourceRefs: Object.freeze(["Cart 1 L5K Warnings routine: RunWithoutLabels / RunWithoutContPres -> W 0010"]),
        watchPoints: freezeRows([
          { tag: "PV_General.RunWithoutLabels", role: "Run-without-labels mode", relationship: "Either this mode or RunWithoutContPres creates W 0010.", interpretation: "The warning indicates intentional simulation/test behavior, not failed sensors." },
          { tag: "PV_General.RunWithoutContPres", role: "Run-without-container-presence mode", relationship: "Either mode is sufficient for the warning.", interpretation: "Do not use test mode as a troubleshooting bypass for a production fault." }
        ]),
        steps: freezeRows([{ order: 1, label: "Verify approved mode", detail: "Confirm whether test/run-without operation is intentionally enabled before interpreting sensor behavior." }])
      }),
      11: Object.freeze({
        title: "GLUE HEATER OVERCURRENT",
        family: "Legacy/unimplemented warning identity",
        status: "named-warning-no-producer-in-supplied-cart1",
        producer: "No executable Warnings[0].11 writer was located in the supplied readable Cart 1 L5K.",
        sourceRefs: Object.freeze(["Cart 1 warning comment and PanelView text: W 0011 GLUE HEATER OVERCURRENT"]),
        sourceGap: "W 0011 is operator-facing text in the supplied project, but the readable Cart 1 source contains no Warnings[0].11 producer. Do not borrow a heater-current circuit from another Cart/application revision.",
        watchPoints: freezeRows([{ tag: "Warnings[0].11", role: "Named warning position", relationship: "No executable writer was located in this source revision.", interpretation: "A live occurrence requires the matching controller/application source before assigning hardware." }]),
        steps: freezeRows([{ order: 1, label: "Verify the live application/revision", detail: "Capture the exact Cart/controller project if W 0011 appears before publishing a heater route." }])
      }),
      12: Object.freeze({
        title: "WARNING LABEL LENGTH MEASUREMENT",
        family: "Label-length measurement pre-fault",
        status: "exact-latched-warning-with-fault-escalation",
        producer: "PulseCheckAndCalcPrintMark + MeasureError -> ADD(CountLabelLengthBad,1) + OTL(Warnings[0].12); GEQ(CountLabelLengthBad,ParLS_Actual.Par1[22]) -> OTL(Faults[1].6); 10 good measurements -> OTU(Warnings[0].12)",
        sourceRefs: Object.freeze(["Cart 1 label-length calculation: bad/good measurement counters, W 0012 latch, Fault 00022 escalation"]),
        watchPoints: freezeRows([
          { tag: "MeasureError", role: "Current label-length measurement result", relationship: "A measured error increments CountLabelLengthBad and latches W 0012.", interpretation: "Determine why measurement is bad before changing any recipe threshold." },
          { tag: "CountLabelLengthBad", role: "Consecutive bad-measurement count", relationship: "The source compares this count with ParLS_Actual.Par1[22] to escalate to Fault 00022.", interpretation: "The count is chronology/evidence; it is not a value to force or reset for troubleshooting." },
          { tag: "CountLabelLengthGood", role: "Recovery count", relationship: "Ten good measurements automatically unlatch W 0012.", interpretation: "This recovery sequence distinguishes a transient warning from an escalated measurement fault." },
          { tag: "ParLS_Actual.Par1[22]", role: "Source-configured fault escalation count", relationship: "When the bad count reaches this recipe/source value, local Fault 00022 is latched.", interpretation: "Treat the value as machine-specific source evidence, not a recommended adjustment." },
          { tag: "ParLS_Actual.Par1[19]", role: "Autochange warning threshold", relationship: "A separate bad-count comparison can request label-length autochange behavior.", interpretation: "Do not conflate autochange escalation with Fault 00022." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Preserve the warning before escalation", detail: "Capture MeasureError and CountLabelLengthBad while W 0012 is active." },
          { order: 2, label: "If 00022 follows, use its exact route", detail: "Fault 00022 is the stronger escalated label-length measurement fault; W 0012 provides the pre-fault history." },
          { order: 3, label: "Do not tune from the warning alone", detail: "Par1[22] and Par1[19] are source/recipe evidence only and are not adjustment recommendations." }
        ])
      }),
      13: Object.freeze({
        title: "SHUTDOWN ACTIVE",
        family: "Shutdown operating state",
        status: "exact-warning-producer",
        producer: "XIC(StartStop.ShutdownActive) -> OTE(Warnings[0].13)",
        sourceRefs: Object.freeze(["Cart 1 L5K Warnings routine: ShutdownActive -> W 0013"]),
        watchPoints: freezeRows([{ tag: "StartStop.ShutdownActive", role: "Station shutdown state", relationship: "The warning follows this state directly.", interpretation: "W 0013 is a state indicator; look for the initiating fault/state that occurred first." }]),
        steps: freezeRows([{ order: 1, label: "Treat as downstream state evidence", detail: "Use alarm chronology to find the condition that initiated shutdown rather than troubleshooting W 0013 as failed hardware." }])
      }),
      14: Object.freeze({
        title: "PLC-WATCHDOG TIMER HIGH",
        family: "Watchdog warning source gap",
        status: "named-warning-no-starting-producer-afi-disabled",
        producer: "Warnings routine contains XIC(Warnings[0].14) -> OTE(Warnings[0].14); BasicRoutine contains XIC(MinorFault.6) AFI() -> OTE(Warnings[0].14)",
        sourceRefs: Object.freeze(["Cart 1 Warnings routine: self-referential W 0014 rung", "Cart 1 BasicRoutine: MinorFault.6 watchdog path blocked by AFI"]),
        sourceGap: "The supplied source has no executable external condition that can originate W 0014 true: the MinorFault.6 producer is AFI-blocked and the remaining rung only references Warnings[0].14 itself. ServoForge does not present MinorFault.6 as an active watchdog-warning producer in this revision.",
        watchPoints: freezeRows([{ tag: "Warnings[0].14 / MinorFault.6", role: "Watchdog warning path", relationship: "The source-visible MinorFault.6 path is blocked by AFI; the warning routine is self-referential.", interpretation: "If W 0014 is observed live, verify a matching project/revision before diagnosing PLC watchdog behavior." }]),
        steps: freezeRows([{ order: 1, label: "Do not infer watchdog state from the text", detail: "Capture the matching live project and processor diagnostics; this export does not prove an active W 0014 producer." }])
      }),
      15: Object.freeze({
        title: "NO ETHERNET CONNECT. BASE MACHINE",
        family: "Level-3 base-machine communication state",
        status: "exact-warning-producer-and-fault-companion",
        producer: "XIO(ETH_Com.ReadyForETHConnect_L3) -> OTE(Warnings[0].15)",
        sourceRefs: Object.freeze(["Cart 1 L5K Warnings routine: !ReadyForETHConnect_L3 -> W 0015", "Cart 1 Faults routine: !ReadyForETHConnect_L3 edge/latch path -> local Fault 00014"]),
        watchPoints: freezeRows([
          { tag: "ETH_Com.ReadyForETHConnect_L3", role: "Current Level-3 base-machine communication readiness", relationship: "False directly produces W 0015.", interpretation: "This is current-state communication evidence; use the existing Cart Level-3 communication diagnostics before hardware replacement." },
          { tag: "Faults[0].14 / Cart-local 00014", role: "Latched base-machine communication fault", relationship: "The same loss-of-ready condition can latch local Fault 00014 through its separate fault logic.", interpretation: "W 0015 and 00014 are related representations of the communication loss; chronology still matters." }
        ]),
        steps: freezeRows([
          { order: 1, label: "Read Level-3 ready state", detail: "Confirm ETH_Com.ReadyForETHConnect_L3 before touching network hardware." },
          { order: 2, label: "Check whether Fault 00014 is also present", detail: "Use the existing Cart base-machine communication route for the latched fault and preserve which indication occurred first." }
        ])
      }),
      16: Object.freeze({
        title: "MINOR SYNCHRONOUS ERROR",
        family: "Legacy/unimplemented synchronization warning",
        status: "named-warning-no-producer-in-supplied-cart1",
        producer: "No executable Warnings[1].0 writer was located in the supplied readable Cart 1 L5K.",
        sourceRefs: Object.freeze(["Cart 1 warning comment and PanelView text: W 0016 MINOR SYNCHRONOUS ERROR"]),
        sourceGap: "W 0016 is named in the HMI/warning table, but Warnings[1].0 has no executable producer in this Cart 1 export. Do not borrow a synchronization condition from Fault 00016, 00031, or another revision.",
        watchPoints: freezeRows([{ tag: "Warnings[1].0", role: "Named warning position", relationship: "No executable writer was located.", interpretation: "Live occurrence requires matching revision/source evidence." }]),
        steps: freezeRows([{ order: 1, label: "Keep synchronization namespaces separate", detail: "Do not substitute Motion Group Fault 00016 or unresolved Fault 00031 for W 0016 without source proof." }])
      }),
      17: Object.freeze({
        title: "HEIGTH ADJUSTMENT MOTOR WARNING",
        family: "Legacy/unimplemented height-adjustment warning",
        status: "named-warning-no-producer-in-supplied-cart1",
        producer: "No executable Warnings[1].1 writer was located in the supplied readable Cart 1 L5K.",
        sourceRefs: Object.freeze(["Cart 1 warning comment and PanelView text: W 0017 HEIGTH ADJUSTMENT MOTOR WARNING"]),
        sourceGap: "W 0017 is named in the HMI/warning table, but Warnings[1].1 has no executable producer in the supplied Cart 1 source. The HMI spelling 'HEIGTH' is preserved; ServoForge does not invent a motor/CB input from the wording.",
        watchPoints: freezeRows([{ tag: "Warnings[1].1", role: "Named warning position", relationship: "No executable writer was located.", interpretation: "Do not borrow Cart Fault 00074 or another height-adjustment circuit solely from similar wording." }]),
        steps: freezeRows([{ order: 1, label: "Verify live source before hardware routing", detail: "A live W 0017 requires the matching controller revision before assigning a height-adjustment motor or breaker cause." }])
      })
    });

    function isGap(number) {
      return SOURCE_GAPS.includes(Number(number));
    }

    function makeEntry(number) {
      const data = DATA[number];
      const code = warningCode(number);
      const gap = isGap(number) ? Object.freeze({ status: data.status, reason: data.sourceGap }) : undefined;
      const stateType = [4, 10, 13].includes(number) ? "operating state" : number === 5 || number === 12 ? "pre-fault warning" : "warning";
      return Object.freeze({
        id: `apl-cart-warning-${pad(number)}`,
        code,
        warningNumber: number,
        diagnosticScope: "Station",
        category: `APL Cart / Warning / ${data.family}`,
        aliases: Object.freeze([`W${pad(number)}`, `warning ${String(number).padStart(3, "0")}`, data.title, number === 17 ? "HEIGHT ADJUSTMENT MOTOR WARNING" : ""].filter(Boolean)),
        contextHints: Object.freeze(["apl", "cart", "labeling station", "warning", data.family]),
        title: data.title,
        summary: isGap(number)
          ? `${code} is a named Cart-local operator warning, but this supplied Cart 1 revision does not prove an active executable producer. ${data.sourceGap}`
          : `${code} is a Cart-local ${stateType}. Its source-backed producer is: ${data.producer}. Warning evidence is kept separate from numbered faults; use a specific fault that follows as stronger escalated evidence when applicable.`,
        probableCauses: isGap(number)
          ? Object.freeze(["The HMI warning identity exists, but the supplied readable source does not establish an active producer for this revision."])
          : Object.freeze([`The PLC state represented by ${data.producer} is currently or recently true.`]),
        checks: Object.freeze(data.steps.map((step) => step.detail)),
        actions: isGap(number)
          ? Object.freeze(["Capture the matching live controller/project revision before assigning a hardware or logic cause."])
          : Object.freeze(["Correct only the source-proven underlying state or the more-specific fault that follows it, then verify normal guarded operation. Do not clear or mask the warning by forcing logic."]),
        safety: SAFETY,
        sourceRefs: Object.freeze([{ sourceId: SOURCE.id, locator: data.sourceRefs[0] }]),
        sourceGap: gap,
        aplCartWarning: Object.freeze({ number, address: warningAddress(number), status: data.status, producer: data.producer })
      });
    }

    const WARNING_ENTRIES = Object.freeze(NAMED.map(makeEntry));
    const BY_ID = new Map(WARNING_ENTRIES.map((entry) => [entry.id, entry]));
    const BY_NUMBER = new Map(WARNING_ENTRIES.map((entry) => [entry.warningNumber, entry]));
    const entries = Object.freeze([...base.entries, ...WARNING_ENTRIES]);

    function resolveWarningNumber(value) {
      if (typeof value === "object" && value) {
        const n = Number(value.warningNumber);
        if (NAMED.includes(n)) return n;
        return resolveWarningNumber(value.code || value.id || "");
      }
      const text = String(value || "").trim();
      let match = /^apl-cart-warning-(\d{4})$/i.exec(text);
      if (match && NAMED.includes(Number(match[1]))) return Number(match[1]);
      match = /\bW\s*0*(\d{1,2})\b/i.exec(text);
      if (match && NAMED.includes(Number(match[1]))) return Number(match[1]);
      match = /^warning\s+0*(\d{1,2})$/i.exec(text);
      if (match && NAMED.includes(Number(match[1]))) return Number(match[1]);
      return null;
    }

    function getAplCartWarningPlan(value) {
      const number = resolveWarningNumber(value);
      if (number == null) return null;
      const data = DATA[number];
      const entry = BY_NUMBER.get(number);
      return Object.freeze({
        id: entry.id,
        number: warningCode(number),
        warningNumber: number,
        code: warningCode(number),
        title: data.title,
        scope: "LB1 APL Cart 1 / Cart-local HMI warning",
        family: data.family,
        status: data.status,
        producer: data.producer,
        source: SOURCE,
        sourceRefs: data.sourceRefs,
        watchPoints: data.watchPoints,
        steps: data.steps,
        observations: isGap(number) ? Object.freeze([]) : genericObservation,
        sourceGap: entry.sourceGap || null,
        safety: SAFETY
      });
    }

    function evaluateAplCartWarning(value, observation = {}) {
      const plan = getAplCartWarningPlan(value);
      if (!plan) return null;
      if (plan.sourceGap) return Object.freeze({ code: "source-gap", severity: "hold", title: "Named warning, producer not active/proven in this revision", summary: plan.sourceGap.reason, next: "Verify the matching live Cart project before assigning a cause." });
      const state = String(observation.producerState || "unknown");
      if (state === "true") {
        const next = plan.warningNumber === 5 ? "Check the selected end-of-reel branch and whether Cart Fault 00025 followed."
          : plan.warningNumber === 12 ? "Preserve MeasureError/CountLabelLengthBad; if Fault 00022 followed, use that escalated fault route."
          : plan.warningNumber === 15 ? "Use the existing Cart Level-3/base-machine communication route and check whether Fault 00014 latched."
          : "Preserve chronology and use any more-specific accompanying fault before replacing hardware.";
        return Object.freeze({ code: "warning-state-active", severity: "direct", title: "Source-backed warning condition is active", summary: `${plan.producer} supports ${plan.code}.`, next });
      }
      if (state === "false") return Object.freeze({ code: "warning-state-clear", severity: "hold", title: "Source condition is not active now", summary: `${plan.code} may be historical or the underlying state has recovered.`, next: "Use alarm history and any latched fault that followed rather than forcing a recurrence." });
      return Object.freeze({ code: "capture", severity: "observe", title: "Capture the exact warning producer state", summary: `Read the v365 watch points for ${plan.code} before assigning a hardware cause.`, next: "Preserve warning/fault chronology." });
    }

    function getAplCartFoundationPlan(value) {
      return getAplCartWarningPlan(value) || base.getAplCartFoundationPlan(value);
    }

    function evaluateAplCartFoundation(value, observation = {}) {
      return getAplCartWarningPlan(value) ? evaluateAplCartWarning(value, observation) : base.evaluateAplCartFoundation?.(value, observation) || null;
    }

    function getEntry(id) {
      return BY_ID.get(String(id || "")) || base.getEntry(id);
    }

    function entryText(entry) {
      return base.normalize([entry.code, entry.title, entry.summary, entry.category, ...(entry.aliases || [])].join(" "));
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const normalized = base.normalize(query);
      const exactText = String(query || "").trim().toLowerCase().replace(/\s+/g, " ");
      const local = WARNING_ENTRIES.map((entry) => {
        const text = entryText(entry);
        const exactCode = entry.code.toLowerCase();
        const exactCompact = exactCode.replaceAll(" ", "");
        const queryCompact = exactText.replaceAll(" ", "");
        let searchScore = 0;
        if (exactText === exactCode || queryCompact === exactCompact || exactText === entry.id.toLowerCase()) searchScore += 360;
        if (normalized && text.includes(normalized)) searchScore += 62;
        for (const term of normalized.split(" ").filter((term) => term.length > 1)) if (text.includes(term)) searchScore += 7;
        return { ...entry, searchScore };
      }).filter((entry) => entry.searchScore > 0);
      const combined = [...local, ...base.searchEntries(query, context, requested + WARNING_ENTRIES.length)];
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
      for (const number of NAMED) {
        const entry = getEntry(`apl-cart-warning-${pad(number)}`);
        const plan = getAplCartWarningPlan(warningCode(number));
        if (!entry || !plan) errors.push(`APL Cart warning ${warningCode(number)} is missing.`);
        if (entry?.aplCartWarning?.address !== warningAddress(number)) errors.push(`${warningCode(number)} lost its warning-array address.`);
      }
      for (const number of ACTIVE) if (getAplCartWarningPlan(warningCode(number))?.sourceGap) errors.push(`${warningCode(number)} must remain source-backed active warning evidence.`);
      for (const number of SOURCE_GAPS) if (!getAplCartWarningPlan(warningCode(number))?.sourceGap) errors.push(`${warningCode(number)} must retain its source-gap/disabled status.`);
      if (!/Faults\[1\]\.9/.test(getAplCartWarningPlan("W 0005")?.producer || "")) errors.push("W 0005 lost Fault 00025 pre-fault relationship.");
      if (!/ParLS_Actual\.Par1\[22\]/.test(getAplCartWarningPlan("W 0012")?.producer || "")) errors.push("W 0012 lost Fault 00022 escalation threshold evidence.");
      if (!/ReadyForETHConnect_L3/.test(getAplCartWarningPlan("W 0015")?.producer || "")) errors.push("W 0015 lost Level-3 communication readiness evidence.");
      if (!/AFI/.test(getAplCartWarningPlan("W 0014")?.producer || "")) errors.push("W 0014 lost AFI-disabled watchdog evidence.");
      if (!base.getAplCartFoundationPlan(1) || !getAplCartFoundationPlan("00001")) errors.push("v365 must preserve v364 Cart fault plans.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+apl-cart-warnings-v365`,
      entries,
      getEntry,
      searchEntries,
      aplCartNamedWarnings: NAMED,
      aplCartActiveWarnings: ACTIVE,
      aplCartWarningSourceGaps: SOURCE_GAPS,
      getAplCartWarningPlan,
      evaluateAplCartWarning,
      getAplCartFoundationPlan,
      evaluateAplCartFoundation,
      validate
    });
  };
});