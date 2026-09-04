"use strict";

(function installTopModulCartReadinessIsolation(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulCartReadinessIsolationExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getStationFaultVariant || !base?.searchEntries || !base?.getFlow) {
      throw new Error("TopModul station diagnostic layers are required before APL Cart readiness isolation.");
    }

    const SOURCE = Object.freeze({
      id: "topmodul-lb1-apl-cart-readiness-v355",
      file: "CO85_LB1_APLCart_1.L5K",
      controller: "CO85_LB1_APLCart_1",
      evidenceClass: "readable-apl-cart-plc-export",
      sourceDiscipline: "The readiness chain is taken from the supplied readable APL Cart L5K. It connects existing source-backed fault families to the shared StartStop / servo-enable sequence without redefining those faults or inferring undocumented electrical polarity from tag names."
    });

    const OBSERVE = "Use normal HMI/PLC/axis diagnostics only. Do not force Control/ControlOut, StartStop, contactor, safety, servo-enable, feedback, ready, or fault bits to make the APL Cart run.";
    const LOTO = "Follow site lockout/tagout and stored-energy requirements before hands-on work on the cart, contactor, servo drive, wiring, carriage, label web, or guarded mechanical components.";
    const ELECTRICAL = "Energized electrical or signal measurements are for qualified personnel under the site's approved electrical safe-work procedure.";
    const SAFETY = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);
    const CART_SOURCE_STATION = 1;
    const STATION_BASE = 1024;
    const stationFaultNumber = (localFault) => STATION_BASE + Number(localFault);
    const stationFaultNumbers = (localFaults = []) => localFaults.map(stationFaultNumber);
    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const stage = (order, name, signal, sourceLogic, meaning, localHandoff = []) => Object.freeze({ order, name, signal, sourceLogic, meaning, handoff: Object.freeze(stationFaultNumbers(localHandoff)) });
    const outcome = (code, severity, title, summary, next, localRelated = []) => Object.freeze({ code, severity, title, summary, next, related: Object.freeze(stationFaultNumbers(localRelated)) });

    const UPSTREAM_ENABLE_LOCAL_FAULTS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    const UPSTREAM_ENABLE_FAULTS = Object.freeze(stationFaultNumbers(UPSTREAM_ENABLE_LOCAL_FAULTS));

    const STAGES = freezeRows([
      stage(1, "Cart enable snapshot", "Control.EnableMachineOn / Control.EnableMachineJog -> CPS(Control,ControlOut,1)", "Initial: CPS(Control,ControlOut,1), then baseline Control.EnableMachineOn and Control.EnableMachineJog are latched. Source-backed cart faults can unlatch the Control bits before the next usable ControlOut snapshot.", "If ControlOut.EnableMachineOn/Jog is absent, stay upstream and identify the active cart fault/inhibit instead of troubleshooting the servo axis first.", UPSTREAM_ENABLE_LOCAL_FAULTS),
      stage(2, "Power and feedback request", "StartStop.PowerAndFeedbackOn", "([ControlOut.EnableMachineOn OR EnableMachineJog] OR the documented zero-speed shutdown branch) AND MaxTimeEStopFeedback.DN AND XIO(E2001_LS143_SafetySwitch) AND E1101_CR204_EStopDelayed -> PowerAndFeedbackOn.", "This is the first shared StartStop gate for servo power/feedback. Preserve the raw PLC polarity of the safety and E-stop signals.", [1, 3, 4, 6]),
      stage(3, "Main contactor command", "E2001_C101_ServoPowerSupply", "PowerAndFeedbackOn drives TOF(StartStop.DelayMainContactorOff); DelayMainContactorOff.PRE=400 ms and .DN drives E2001_C101_ServoPowerSupply.", "A missing C101 command with PowerAndFeedbackOn present keeps the diagnosis in the 400 ms contactor-off-delay sequence.", [5]),
      stage(4, "Contactor raw-state supervision", "E2001_C101_ServoPowerSupply / E2001_CB101_ServoPowerSupply / TON_MonitorMainContactor", "Cart-local Fault 005 monitors equal raw C101 command/feedback states: both true OR both false, for TON_MonitorMainContactor.PRE=1500 ms.", "Do not convert the tag names into assumed NO/NC polarity. The executable source says healthy raw states are not equal during the monitored condition. The exact Station 1 global instance is Fault 1029.", [5]),
      stage(5, "Release servo feedback", "StartStop.ReleaseFeedbackOn", "PowerAndFeedbackOn AND XIO(E2001_CB101_ServoPowerSupply) -> ReleaseFeedbackOn.", "The raw C101 feedback bit must be false for this release path in the supplied revision. Treat that as source logic, not a field polarity recommendation.", [5]),
      stage(6, "Axis ready for feedback", "MainDrive.SData.Status.ReadyForFeedbackON", "ReleaseFeedbackOn AND MotionGroup.GroupSynced AND !MainDrive.SData.Status.Faulted AND !MainDriveAxis.ShutdownStatus AND MainDriveAxis.EnableInputStatus AND !MainDrive.Std.SM1.0 AND !MainDrive.SData.Cmd.RequestChgDirection -> ReadyForFeedbackON.", "This separates a contactor/power path from a motion-group/axis-state inhibit before an MSO is attempted.", [16, 17]),
      stage(7, "Feedback command and MSO", "MainDrive.SData.Cmd.FeedbackON / MainDrive.MTags.MSO[0]", "ReadyForFeedbackON runs MainDrive.Std.Timer[0] (PRE 750 ms); .DN latches FeedbackON. With no General Reset, FeedbackON and a healthy state machine issue MSO(MainDriveAxis,...).", "If ReadyForFeedbackON is true but feedback never turns on, stay in the 750 ms command/MSO path and use Cart-local Fault 017 / Station 1 Fault 1041 if its exact producer is present.", [17]),
      stage(8, "Feedback actually on", "MainDrive.SData.Status.Feedback_Is_ON", "MainDriveAxis.DriveEnableStatus runs MainDrive.Std.Timer[9] (PRE 20 ms); .DN -> Feedback_Is_ON.", "Feedback_Is_ON is required before Home/Single Cycle/Automatic commands are issued.", [17]),
      stage(9, "Station automatic state", "StartStop.StationAutoOn", "DataToLS.Par1[0].0 station-on pulse or the manual station-on pulse can latch StationAutoOn when StationDeactive is false; several shutdown/off conditions can unlatch it, including ControlOut.EnableMachineOn false.", "A cart can have servo feedback available but still not be in StationAutoOn. Diagnose this state separately from an encoder or drive fault.", []),
      stage(10, "Ready signal to base machine", "DataFromLS.Par1[0].0", "The supplied rung combines StationAutoOn, Axis_Is_Homed or RunWithoutLabels, end-of-reel parameter logic, plus a separate raw XIO(E1501_P133_CarriageFront) branch.", "Preserve the exact grouping and raw input polarity. The tag name alone is not enough to reinterpret the carriage-front branch.", [20]),
      stage(11, "Hardware no-fault / ready-to-label output", "E9706_OPTO233_NoFault", "Effective source path requires ControlOut.EnableMachineOn, StationDeactive false, and the end-of-reel conditional. A second carriage-related branch is gated by Logic_0, which is unlatched in Initial in the supplied project.", "Use this as the final Labeler-to-base-machine hardware readiness output; do not use it as proof that every internal subsystem is healthy.", [])
    ]);

    const PLAN = Object.freeze({
      id: "topmodul-apl-cart-readiness-v355",
      title: "APL Cart will not become ready / will not start",
      scope: "TopModul APL Cart 1 / shared readiness and servo-enable chain",
      source: SOURCE,
      sourceStation: CART_SOURCE_STATION,
      stages: STAGES,
      upstreamEnableFaults: UPSTREAM_ENABLE_FAULTS,
      sourceRefs: Object.freeze([
        "L5K 18167-18169: CPS(Control,ControlOut,1) and baseline Control enable flags",
        "L5K 17554: DelayMainContactorOff.PRE=400 ms; MaxTimeEStopFeedback.PRE=2500 ms; DelayZeroSpeed.PRE=500 ms",
        "L5K 17569-17574: PowerAndFeedbackOn -> C101 contactor -> ReleaseFeedbackOn",
        "L5K 17144: Cart-local Fault 005 (Station 1 global Fault 1029) equal raw C101 command/feedback states -> 1500 ms monitor",
        "L5K 14584: ReadyForFeedbackON exact motion/axis permissives",
        "L5K 14589 + 18200: ReadyForFeedbackON -> 750 ms FeedbackON command; off timer 10 ms",
        "L5K 14694: FeedbackON -> MSO(MainDriveAxis)",
        "L5K 14578 + 18200: DriveEnableStatus -> 20 ms -> Feedback_Is_ON",
        "L5K 17558: StationAutoOn latch/unlatch sequence",
        "L5K 15273: DataFromLS.Par1[0].0 station-ready output",
        "L5K 15289 + 18137: E9706_OPTO233_NoFault path and Logic_0 disabled alternate branch"
      ]),
      safety: SAFETY
    });

    function normalizeObservation(observation = {}) {
      const value = (name) => String(observation[name] ?? "unknown").toLowerCase();
      return Object.freeze({
        enableMachineOn: value("enableMachineOn"),
        enableMachineJog: value("enableMachineJog"),
        powerAndFeedbackOn: value("powerAndFeedbackOn"),
        contactorCommand: value("contactorCommand"),
        contactorFeedback: value("contactorFeedback"),
        releaseFeedbackOn: value("releaseFeedbackOn"),
        groupSynced: value("groupSynced"),
        axisFaulted: value("axisFaulted"),
        shutdownStatus: value("shutdownStatus"),
        enableInputStatus: value("enableInputStatus"),
        readyForFeedbackOn: value("readyForFeedbackOn"),
        feedbackCommand: value("feedbackCommand"),
        feedbackIsOn: value("feedbackIsOn"),
        stationAutoOn: value("stationAutoOn"),
        baseReady: value("baseReady"),
        noFaultOutput: value("noFaultOutput")
      });
    }

    function evaluateTopModulCartReadiness(observation = {}) {
      const o = normalizeObservation(observation);
      if (o.enableMachineOn === "no" && o.enableMachineJog === "no") return outcome(
        "cart-enable-inhibited", "direct", "Cart enable is already removed upstream",
        "ControlOut.EnableMachineOn and EnableMachineJog are absent before the shared StartStop/servo path. Multiple source-backed Cart faults explicitly unlatch the underlying Control enables.",
        "Use the exact active Station 1 alarm stack and diagnose the earliest source-backed cart fault before opening the contactor, servo or encoder path.", UPSTREAM_ENABLE_LOCAL_FAULTS
      );
      if (o.powerAndFeedbackOn === "no" && (o.enableMachineOn === "yes" || o.enableMachineJog === "yes")) return outcome(
        "power-feedback-permissive-blocked", "direct", "Enable exists but PowerAndFeedbackOn is blocked",
        "The fault is now inside the shared StartStop power/feedback permissives: E-stop delay/release, safety-switch raw state, or the documented shutdown branch.",
        "Observe StartStop.MaxTimeEStopFeedback.DN, E2001_LS143_SafetySwitch and E1101_CR204_EStopDelayed using their raw source polarity; do not bypass them.", [1, 3, 4, 6]
      );
      if (["0", "1"].includes(o.contactorCommand) && o.contactorCommand === o.contactorFeedback) return outcome(
        "contactor-raw-state-mismatch", "direct", "Raw C101 command and feedback match — Cart-local Fault 005 monitor condition",
        "The supplied Cart-local Fault 005 rung treats both-true or both-false C101 command/feedback as an invalid state and supervises it for 1500 ms. Its exact Station 1 global instance is Fault 1029.",
        "Open Station 1 Fault 1029 and trace the exact contactor/feedback circuit only after confirming the raw states persist through the monitor window.", [5]
      );
      if (o.powerAndFeedbackOn === "yes" && o.releaseFeedbackOn === "no") return outcome(
        "feedback-release-blocked", "direct", "PowerAndFeedbackOn is true but servo feedback release is blocked",
        "ReleaseFeedbackOn requires XIO(E2001_CB101_ServoPowerSupply). In this revision the raw contactor-feedback bit must be false at this stage.",
        "Compare C101 command, raw C101 feedback, DelayMainContactorOff.DN and Station 1 Fault 1029 chronology without inferring physical contact polarity from the tag names.", [5]
      );
      if (o.releaseFeedbackOn === "yes" && o.readyForFeedbackOn === "no") return outcome(
        "axis-ready-permissive-blocked", "direct", "Contactor/feedback release is available but the axis is not ReadyForFeedbackON",
        "The remaining exact gates are MotionGroup.GroupSynced, no MainDrive fault, no ShutdownStatus, EnableInputStatus true, state-machine bit SM1.0 false, and no direction-change request.",
        "Observe those six conditions together. Cart-local Fault 016 / Station 1 Fault 1040 covers GroupSynced loss; Cart-local Fault 017 / Station 1 Fault 1041 is the MSO feedback-on fault once ReadyForFeedbackON exists.", [16, 17]
      );
      if (o.readyForFeedbackOn === "yes" && o.feedbackCommand === "no") return outcome(
        "feedback-command-delay", "observe", "Axis is ready; verify the 750 ms feedback-on command delay",
        "ReadyForFeedbackON must remain true through MainDrive.Std.Timer[0].PRE=750 ms before MainDrive.SData.Cmd.FeedbackON latches.",
        "Observe Timer[0].ACC/.DN and the ReadyForFeedbackON state. The 750 ms value is source sequence evidence, not a parameter recommendation.", [17]
      );
      if (o.feedbackCommand === "yes" && o.feedbackIsOn === "no") return outcome(
        "mso-feedback-not-on", "direct", "Feedback command exists but axis feedback is not on",
        "The source issues MSO when FeedbackON is true and the state machine is healthy. Feedback_Is_ON is then derived from DriveEnableStatus after a 20 ms timer.",
        "Check the MSO status/error and Station 1 Fault 1041 producer before replacing the encoder or changing start logic.", [17]
      );
      if (o.feedbackIsOn === "yes" && o.stationAutoOn === "no") return outcome(
        "station-auto-not-latched", "direct", "Servo feedback is on but StationAutoOn is not latched",
        "The cart has passed the power/axis feedback path. The remaining issue is station automatic-state selection or one of the documented StationAutoOn unlatch conditions.",
        "Observe DataToLS.Par1[0].0, StationDeactive, the manual station-on pulse and ControlOut.EnableMachineOn through the normal sequence.", []
      );
      if (o.stationAutoOn === "yes" && o.baseReady === "no") return outcome(
        "base-ready-output-blocked", "direct", "StationAutoOn is true but the base-machine ready bit is not present",
        "DataFromLS.Par1[0].0 still depends on homed/RunWithoutLabels and end-of-reel logic, plus the separate raw carriage-front branch in the supplied rung.",
        "Observe the exact DataFromLS ready rung as written; preserve raw E1501_P133_CarriageFront polarity and use Cart-local Fault 020 / Station 1 Fault 1044 only when its own producer is active.", [20]
      );
      if (o.baseReady === "yes" && o.noFaultOutput === "no") return outcome(
        "hardware-ready-output-blocked", "direct", "PLC ready bit exists but hardware NoFault / ready-to-label output is absent",
        "E9706_OPTO233_NoFault has its own output path using ControlOut.EnableMachineOn, StationDeactive and end-of-reel conditions. Its disabled Logic_0 alternate branch should not be treated as active logic in this project revision.",
        "Observe the output rung and physical output path under the approved safe-work boundary; do not force E9706_OPTO233_NoFault.", []
      );
      return outcome(
        "continue-cart-readiness-observation", "observe", "Continue through the Cart readiness chain in order",
        "No single supplied observation yet isolates the first missing stage. The fastest route is to record each stage from ControlOut enable through PowerAndFeedbackOn, C101, ReadyForFeedbackON, Feedback_Is_ON, StationAutoOn and the base-machine ready outputs.",
        "Start at the first false stage and use its source-backed Station 1 handoff rather than skipping downstream to servo/encoder replacement.", []
      );
    }

    const ENTRY = Object.freeze({
      id: "topmodul-apl-cart-readiness",
      code: "APL-READY",
      category: "TopModul / APL Cart readiness",
      aliases: Object.freeze(["apl cart not ready", "apl cart won't start", "apl cart wont start", "station not ready", "label station not ready", "aggregate not ready", "cart not starting", "servo feedback won't enable", "feedback wont enable", "station auto won't come on", "station auto wont come on", "no fault ready to label", "E9706_OPTO233_NoFault", "DataFromLS.Par1[0].0"]),
      contextHints: Object.freeze(["topmodul", "top modul", "apl", "cart", "station", "lb1"]),
      title: "APL Cart will not become ready / will not start",
      summary: "Follow the supplied APL Cart 1 PLC sequence from the Control/ControlOut enable snapshot through PowerAndFeedbackOn, C101 contactor supervision, axis feedback enable, StationAutoOn and the ready outputs. Cart-local faults are handed to their exact Station 1 global instances instead of main Labeler faults with the same numeric code.",
      probableCauses: Object.freeze([
        "An earlier source-backed cart fault has removed Control.EnableMachineOn / EnableMachineJog before the shared StartStop sequence.",
        "PowerAndFeedbackOn is blocked by E-stop/safety raw states or the power/feedback shutdown sequence.",
        "C101 command/feedback raw states are in the Cart-local Fault 005 monitored combination, or ReleaseFeedbackOn is not made.",
        "MotionGroup/axis permissives prevent ReadyForFeedbackON or the MSO/DriveEnableStatus sequence does not establish Feedback_Is_ON.",
        "Servo feedback is healthy but StationAutoOn or the final DataFromLS / E9706 ready outputs are withheld by their own state logic."
      ]),
      checks: Object.freeze(STAGES.map((row) => `${row.order}. ${row.name}: ${row.signal} — ${row.meaning}`)),
      actions: Object.freeze([
        "Identify the first false stage and correct that source-backed condition; do not troubleshoot downstream stages until the upstream prerequisite is healthy.",
        "If an exact numbered station alarm is present, use that Station instance's existing drill-down and alarm chronology as stronger evidence than this generic readiness symptom route."
      ]),
      safety: SAFETY,
      sourceRefs: Object.freeze([{ sourceId: "lb1-aplcart-1", locator: "Readable export CO85_LB1_APLCart_1.L5K — Cart 1 Initial, StartStop, ServoMainDrive, FaultDetection and DataToLS routines" }]),
      processTrace: Object.freeze({
        status: "cross-routine-apl-cart-readiness-chain-bound",
        confidence: "exact-readable-cart-plc-chain",
        routine: "Initial -> FaultDetection -> StartStop -> ServoMainDrive -> DataToLS",
        producerSignals: Object.freeze(STAGES.map((row) => row.signal)),
        calculationSteps: STAGES,
        hardwareRows: Object.freeze([]),
        drawingLocations: Object.freeze([]),
        source: SOURCE,
        hardwareSource: null,
        summary: "Cross-routine APL Cart 1 readiness chain from enable snapshot to base-machine readiness output.",
        safetyBoundary: SAFETY.join(" "),
        scopeNote: "This is a source-backed symptom route, not a new PLC fault number or invented HMI alarm. Cart-local numbered faults map to Station 1 global instances in the shared Labeler alarm space; main Labeler faults with the same short numbers are a separate scope."
      })
    });

    const FLOW = Object.freeze({
      id: "topmodul-apl-cart-readiness",
      title: "APL Cart will not become ready",
      category: "TopModul / APL Cart",
      description: "Trace the shared Cart enable, contactor, servo-feedback, StationAutoOn and ready-output sequence in order.",
      contextHints: Object.freeze(["topmodul", "top modul", "apl", "cart", "station"]),
      start: "cart-alarm",
      nodes: Object.freeze({
        "cart-alarm": Object.freeze({ question: "Do you have an exact Cart/station alarm from the event?", help: "Exact alarm chronology outranks a generic not-ready symptom.", choices: Object.freeze([
          Object.freeze({ label: "Yes — use the exact fault first", action: "search", hint: "Search the Station/global fault number or use the alarm-stack analyzer." }),
          Object.freeze({ label: "No useful direct alarm", next: "cart-enable" })
        ]) }),
        "cart-enable": Object.freeze({ question: "Are ControlOut.EnableMachineOn or ControlOut.EnableMachineJog present?", help: "Observe only; do not force the Control or ControlOut structures.", choices: Object.freeze([
          Object.freeze({ label: "No — both are absent", result: ENTRY.id, hint: "Stay upstream: identify the Cart-local fault/inhibit that removed the enable, then open its Station 1 global instance." }),
          Object.freeze({ label: "Yes — an enable is present", next: "cart-power-feedback" })
        ]) }),
        "cart-power-feedback": Object.freeze({ question: "Does StartStop.PowerAndFeedbackOn turn on?", help: "This is the shared E-stop/safety/power-feedback gate.", choices: Object.freeze([
          Object.freeze({ label: "No", result: ENTRY.id, hint: "Check the exact PowerAndFeedbackOn raw permissives." }),
          Object.freeze({ label: "Yes", next: "cart-release-feedback" })
        ]) }),
        "cart-release-feedback": Object.freeze({ question: "Does StartStop.ReleaseFeedbackOn turn on?", help: "This separates the C101 contactor/raw feedback sequence from the motion-axis readiness conditions.", choices: Object.freeze([
          Object.freeze({ label: "No", result: ENTRY.id, hint: "Compare C101 command/feedback and Cart-local Fault 005 / Station 1 Fault 1029 timing." }),
          Object.freeze({ label: "Yes", next: "cart-ready-feedback" })
        ]) }),
        "cart-ready-feedback": Object.freeze({ question: "Does MainDrive.SData.Status.ReadyForFeedbackON turn on?", help: "Group sync, axis faults, shutdown state and enable input are checked here.", choices: Object.freeze([
          Object.freeze({ label: "No", result: ENTRY.id, hint: "Stay with the exact motion/axis permissives; do not jump to encoder replacement." }),
          Object.freeze({ label: "Yes", next: "cart-feedback-on" })
        ]) }),
        "cart-feedback-on": Object.freeze({ question: "Does MainDrive.SData.Status.Feedback_Is_ON become true?", help: "ReadyForFeedbackON must pass the 750 ms command delay, MSO, then DriveEnableStatus/20 ms feedback state.", choices: Object.freeze([
          Object.freeze({ label: "No", result: ENTRY.id, hint: "Use Cart-local Fault 017 / Station 1 Fault 1041 handoff." }),
          Object.freeze({ label: "Yes", next: "cart-station-auto" })
        ]) }),
        "cart-station-auto": Object.freeze({ question: "Does StartStop.StationAutoOn latch?", help: "The power/servo path is healthy if you reached this point.", choices: Object.freeze([
          Object.freeze({ label: "No", result: ENTRY.id, hint: "Check station-on request, StationDeactive and StationAutoOn unlatch conditions." }),
          Object.freeze({ label: "Yes", next: "cart-base-ready" })
        ]) }),
        "cart-base-ready": Object.freeze({ question: "Is DataFromLS.Par1[0].0 present to the base machine?", help: "This is the software station-ready output; preserve the raw carriage input polarity in the source rung.", choices: Object.freeze([
          Object.freeze({ label: "No", result: ENTRY.id, hint: "Check homed/RunWithoutLabels, end-of-reel condition and the exact raw carriage branch." }),
          Object.freeze({ label: "Yes — software ready is present", result: ENTRY.id, hint: "If the machine still treats the station as not ready, compare E9706_OPTO233_NoFault and the base-machine interface." })
        ]) })
      })
    });

    const entries = Object.freeze([...base.entries, ENTRY]);
    const flows = Object.freeze([...base.flows, FLOW]);

    function getEntry(id) {
      return String(id || "") === ENTRY.id ? ENTRY : base.getEntry(id);
    }

    function getFlow(id) {
      return String(id || "") === FLOW.id ? FLOW : base.getFlow(id);
    }

    function localSearchScore(query, context = {}) {
      const q = base.normalize(query);
      if (!q) return 0;
      const text = base.normalize([ENTRY.code, ENTRY.title, ENTRY.summary, ...ENTRY.aliases, ...ENTRY.checks].join(" "));
      let score = text.includes(q) ? 120 : 0;
      for (const term of q.split(" ").filter((item) => item.length > 1)) if (text.includes(term)) score += 8;
      const ctx = base.normalize([context.machineType, context.applicationMode, context.mapName].filter(Boolean).join(" "));
      if (ctx.includes("topmodul") || ctx.includes("top modul")) score += 15;
      if (ctx.includes("apl")) score += 15;
      return score;
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const localScore = localSearchScore(query, context);
      const local = localScore > 0 ? [{ ...ENTRY, searchScore: localScore }] : [];
      const combined = [...local, ...base.searchEntries(query, context, requested + 8)];
      const seen = new Set();
      return combined.sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0))
        .filter((entry) => { if (!entry || seen.has(entry.id)) return false; seen.add(entry.id); return true; })
        .slice(0, requested);
    }

    function recommendFlows(context = {}) {
      const existing = base.recommendFlows ? base.recommendFlows(context) : base.flows;
      const ctx = base.normalize([context.machineType, context.applicationMode, context.mapName].filter(Boolean).join(" "));
      const boost = (ctx.includes("topmodul") || ctx.includes("top modul")) && ctx.includes("apl") ? 40 : 0;
      const local = { ...FLOW, contextScore: boost };
      const seen = new Set();
      return [local, ...existing].filter((flow) => { if (!flow || seen.has(flow.id)) return false; seen.add(flow.id); return true; })
        .sort((a, b) => Number(b.contextScore || 0) - Number(a.contextScore || 0));
    }

    function getTopModulCartReadinessPlan() {
      return PLAN;
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      if (base.getEntry(ENTRY.id)) errors.push("v355 APL Cart readiness entry collides with an earlier entry.");
      if (base.getFlow(FLOW.id)) errors.push("v355 APL Cart readiness flow collides with an earlier flow.");
      if (!STAGES.some((row) => row.signal === "StartStop.PowerAndFeedbackOn" && /MaxTimeEStopFeedback/.test(row.sourceLogic))) errors.push("v355 lost PowerAndFeedbackOn source gates.");
      if (!STAGES.some((row) => row.signal === "E2001_C101_ServoPowerSupply" && /400 ms/.test(row.sourceLogic))) errors.push("v355 lost 400 ms C101 delay evidence.");
      if (!STAGES.some((row) => /TON_MonitorMainContactor/.test(row.signal) && /1500 ms/.test(row.sourceLogic))) errors.push("v355 lost Cart-local Fault 005 1500 ms raw-state monitor.");
      if (!STAGES.some((row) => row.signal === "MainDrive.SData.Status.ReadyForFeedbackON" && /MotionGroup.GroupSynced/.test(row.sourceLogic) && /EnableInputStatus/.test(row.sourceLogic))) errors.push("v355 lost axis ReadyForFeedbackON permissives.");
      if (!STAGES.some((row) => /FeedbackON/.test(row.signal) && /750 ms/.test(row.sourceLogic))) errors.push("v355 lost 750 ms feedback command delay.");
      if (!STAGES.some((row) => row.signal === "MainDrive.SData.Status.Feedback_Is_ON" && /20 ms/.test(row.sourceLogic))) errors.push("v355 lost 20 ms DriveEnableStatus feedback confirmation.");
      if (!STAGES.some((row) => row.signal === "DataFromLS.Par1[0].0" && /XIO\(E1501_P133_CarriageFront\)/.test(row.sourceLogic))) errors.push("v355 lost raw carriage branch in station-ready output.");
      if (!STAGES.some((row) => row.signal === "E9706_OPTO233_NoFault" && /Logic_0/.test(row.sourceLogic))) errors.push("v355 lost disabled alternate branch evidence for hardware ready output.");

      const cart005 = base.getStationFaultVariant(5, CART_SOURCE_STATION);
      const cart016 = base.getStationFaultVariant(16, CART_SOURCE_STATION);
      const cart017 = base.getStationFaultVariant(17, CART_SOURCE_STATION);
      const cart020 = base.getStationFaultVariant(20, CART_SOURCE_STATION);
      if (cart005?.number !== 1029 || cart005?.stationTemplateOffset !== 5 || !/Main Contactor fault$/i.test(cart005?.title || "")) errors.push("v355 must bind Cart-local Fault 005 to Station 1 global Fault 1029.");
      if (cart016?.number !== 1040 || cart016?.stationTemplateOffset !== 16 || !/Motion group not synchronized$/i.test(cart016?.title || "")) errors.push("v355 must bind Cart-local Fault 016 to Station 1 global Fault 1040.");
      if (cart017?.number !== 1041 || cart017?.stationTemplateOffset !== 17 || !/Feedback on fault main drive$/i.test(cart017?.title || "")) errors.push("v355 must bind Cart-local Fault 017 to Station 1 global Fault 1041.");
      if (cart020?.number !== 1044 || cart020?.stationTemplateOffset !== 20 || !/Carriage not in front position/i.test(cart020?.title || "")) errors.push("v355 must bind Cart-local Fault 020 to Station 1 global Fault 1044.");
      if (base.getTopModulFault(5)?.title === cart005?.title) errors.push("v355 must not collapse main Labeler Fault 005 into Cart-local Fault 005.");
      if (JSON.stringify(evaluateTopModulCartReadiness({ contactorCommand: "1", contactorFeedback: "1" }).related) !== JSON.stringify([1029])) errors.push("v355 contactor handoff must target Station 1 Fault 1029, not main Labeler Fault 005.");
      if (evaluateTopModulCartReadiness({ enableMachineOn: "no", enableMachineJog: "no" }).code !== "cart-enable-inhibited") errors.push("v355 upstream enable evaluation is not deterministic.");
      if (evaluateTopModulCartReadiness({ contactorCommand: "1", contactorFeedback: "1" }).code !== "contactor-raw-state-mismatch") errors.push("v355 contactor raw-state evaluation is not deterministic.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+cart-readiness-v355`,
      entries,
      flows,
      getEntry,
      getFlow,
      searchEntries,
      recommendFlows,
      getTopModulCartReadinessPlan,
      evaluateTopModulCartReadiness,
      topModulCartReadinessSource: SOURCE,
      topModulCartReadinessStation: CART_SOURCE_STATION,
      validate
    });
  };
});
