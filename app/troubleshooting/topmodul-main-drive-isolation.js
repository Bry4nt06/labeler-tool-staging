"use strict";

(function installTopModulMainDriveIsolation(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulMainDriveIsolationExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulCircuitTrace || !base?.evaluateTopModulEncoderIsolation || !base?.getTopModulEncoderIsolationPlan) {
      throw new Error("TopModul Labeler circuit and v351 encoder-isolation layers are required before main-drive isolation.");
    }

    const SUPPORTED = Object.freeze([480, 482, 490, 669]);
    const SOURCE = Object.freeze({
      id: "topmodul-lb1-main-drive-isolation-v352",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1",
      evidenceClass: "readable-labeler-plc-export",
      sourceDiscipline: "Main-drive, contactor, electric-brake hardware-delay, and standstill logic is taken from the supplied readable LB1 L5K. Existing K407039 circuit traces remain the hardware authority. Fault 670 is intentionally excluded here and remains owned by the v351 main-Labeler fine-clock workflow."
    });

    const OBSERVE = "Use normal HMI/PLC/drive diagnostics only. Do not force drive, contactor, zero-speed, encoder, safety, or fault bits and do not defeat monitoring logic.";
    const LOTO = "Prevent unexpected machine motion and follow site LOTO/stored-energy requirements before hands-on drive, motor, contactor, encoder, wiring, or cabinet work.";
    const ELECTRICAL = "Energized electrical/signal measurements are for qualified personnel under the site's approved electrical safe-work procedure.";
    const SAFETY = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const watch = (tag, role, relationship, interpretation, caution = "") => Object.freeze({ tag, role, relationship, interpretation, caution });
    const step = (order, label, detail) => Object.freeze({ order, label, detail });
    const outcome = (code, severity, title, summary, next, related = []) => Object.freeze({ code, severity, title, summary, next, related: Object.freeze(related) });

    const PLANS = Object.freeze({
      480: Object.freeze({
        number: 480,
        title: "Main Drive Fault",
        family: "PF700 / Node3 drive status",
        producer: "[!DriveConETH_01.O_MotOK OR !DriveConETH_01.O_NoFault] AND E2001_MS101_MainDriveOverload -> Faults_LB1[30].0",
        sourceRefs: Object.freeze([
          "L5K 4295: Fault 480 = Main Drive Fault",
          "L5K 3788: E2001_MS101_MainDriveOverload = I0009.25",
          "L5K 26863: Node3 DriveStatus/OutputFreq feed DriveConETH_01; O_MotOK/O_NoFault plus MS101 drive Faults_LB1[30].0"
        ]),
        watchPoints: freezeRows([
          watch("E2001_AFD101_MainDriveEnable", "Main-drive enable", "Feeds DriveConETH_01.I_DriveEnable.", "Confirms whether the Labeler is requesting main-drive enable."),
          watch("VSD85LB1_Node3:I.DriveStatus", "PF700 Node3 status", "Feeds DriveConETH_01.I_Stat.", "Read PF700/Node3 diagnostics before replacing drive hardware."),
          watch("VSD85LB1_Node3:I.OutputFreq", "PF700 output frequency", "Feeds DriveConETH_01.I_Freq.", "Use as read-only drive output evidence; do not infer mechanical speed solely from this value."),
          watch("DriveConETH_01.O_MotOK", "Drive motor OK", "One direct Fault 480 producer condition.", "False while MS101 permissive is made supports the direct drive-controller path."),
          watch("DriveConETH_01.O_NoFault", "Drive no-fault state", "One direct Fault 480 producer condition.", "False while MS101 permissive is made supports the direct drive-controller path."),
          watch("E2001_MS101_MainDriveOverload", "MS101 overload/permissive input", "Alias I0009.25 and a required true gate in the Fault 480 producer rung.", "If this input is open, diagnose the overload/protection path separately instead of treating it as the direct 480 producer.")
        ]),
        steps: freezeRows([
          step(1, "Check MS101 permissive", "Fault 480's direct producer requires E2001_MS101_MainDriveOverload to be made. An open input is separate overload/protection evidence."),
          step(2, "Read PF700 / Node3", "With MS101 made, use O_MotOK, O_NoFault, Node3 DriveStatus and the drive's own diagnostic code as primary evidence."),
          step(3, "Keep contactor supervision separate", "Fault 482 is the timed C101/C102 command-feedback monitor. It can coexist with 480 but is not the same producer."),
          step(4, "Open hardware only after logic isolation", "Use the existing K407039 PF700/MS101/MTR101 circuit trace after PLC/drive evidence narrows the fault.")
        ])
      }),
      482: Object.freeze({
        number: 482,
        title: "Main Drive Contactor Fault",
        family: "C101/C102 timed contactor-state mismatch",
        producer: "Three raw C102/C101FB mismatch states -> E2001.T_ContactorMonitor 5000 ms -> E2001.M_ContactorMonitor -> Faults_LB1[30].2 when time-relay fault latch is clear",
        sourceRefs: Object.freeze([
          "L5K 3775: E2001.T_ContactorMonitor preset = 5000 ms",
          "L5K 3780-3784: C101 feedback I0009.26; C102 command O0103.0; C102 delay feedback I0009.27",
          "L5K 20339-20345: three mismatch states, timer latch/reset, and Faults_LB1[30].2 gated by !E2001_M_ElectrBrakeFaultTimeRelay",
          "L5K 4296: Fault 482 = Main Drive Contactor Fault"
        ]),
        watchPoints: freezeRows([
          watch("E2001_C102_MainDriveContactor", "C102 contactor command bit", "Alias O0103.0 and one side of all three source-documented mismatch states.", "Compare the raw bit with C101 feedback; do not infer feedback polarity from the names alone."),
          watch("E2001_C101_MainDriveContactorFB", "C101 contactor feedback bit", "Alias I0009.26 and one side of all three mismatch states.", "Use the raw PLC state through the actual sequence."),
          watch("E2001_AFD101_MainDriveEnable", "Controller/drive enable", "Used by the third contactor-monitor mismatch branch.", "When enable is released, the monitor verifies the expected contactor feedback transition."),
          watch("StartStop.EnableMainDriveOFF.DN", "Main-drive-off delay done", "Qualifies the third mismatch branch after zero-speed/off sequencing.", "Do not bypass the off-delay to clear the fault."),
          watch("E2001.T_ContactorMonitor.ACC / .DN", "Contactor mismatch timer", "Preset = 5000 ms in the supplied tag instance.", "The invalid raw state must persist through the five-second timer before the monitor latch is set."),
          watch("E2001_M_ElectrBrakeFaultTimeRelay", "Electric-brake time-relay fault latch", "Fault 482 HMI output uses XIO(E2001_M_ElectrBrakeFaultTimeRelay).", "An active Fault 490/time-relay latch can suppress visible Fault 482 even while the contactor-monitor state exists.")
        ]),
        steps: freezeRows([
          step(1, "Preserve raw command/feedback states", "The PLC defines three exact invalid combinations. Diagnose those states instead of converting the feedback into an assumed normally-open/normally-closed interpretation."),
          step(2, "Allow the 5000 ms monitor", "E2001.T_ContactorMonitor must mature before E2001.M_ContactorMonitor is latched."),
          step(3, "Check Fault 490 precedence", "Fault 482's HMI output is inhibited while E2001_M_ElectrBrakeFaultTimeRelay is active. If 490 is present, its hardware-delay feedback path is the stronger visible branch."),
          step(4, "Use K407039 after state isolation", "Only after the mismatched command/feedback state is identified should the physical C101/C102 contactor and wiring circuit become primary.")
        ])
      }),
      490: Object.freeze({
        number: 490,
        title: "Safety Circuit Fault Main Drive Time Relay",
        family: "ElectricBrake hardware-delay feedback supervision",
        producer: "ElectrBrake.O_HWTimerFault -> E2001_M_ElectrBrakeFaultTimeRelay -> Faults_LB1[30].10",
        sourceRefs: Object.freeze([
          "L5K 4299: Fault 490 = Safety Circuit Fault Main Drive Time Relay",
          "L5K 27479: ElectrBrake.HWTimerCon.PRE = 1000 ms",
          "L5K 27501-27505: HWTimerOffDel and hardware-delay feedback mismatch produce O_HWTimerFault",
          "L5K 27579: HWTimerOffDel.PRE = 4000 ms; O_HWTimerFault latches E2001_M_ElectrBrakeFaultTimeRelay and drives Faults_LB1[30].10"
        ]),
        watchPoints: freezeRows([
          watch("E2001_C102_MainDriveContactor", "Main-contactor state", "Feeds ElectrBrake.I_MainContactor.", "Compare it with hardware-delay feedback through the real start/stop sequence."),
          watch("E2001_C102_MainDriveContactorDelayFB", "Hardware-delay feedback", "Alias I0009.27; feeds ElectrBrake.I_FeedbackTimer.", "Persistent disagreement with the expected delayed contactor state is the relevant evidence."),
          watch("ElectrBrake.HWTimerCon.ACC / .DN", "Hardware-timer mismatch monitor", "HWTimerCon.PRE = 1000 ms.", "A mismatch persisting through one second produces O_HWTimerFault."),
          watch("ElectrBrake.HWTimerOffDel.ACC / .DN", "Hardware-timer off-delay", "HWTimerOffDel.PRE = 4000 ms in the caller.", "Keep this as source sequence evidence; do not shorten it as a troubleshooting shortcut."),
          watch("ElectrBrake.O_HWTimerFault", "Direct Fault 490 producer", "Latched into E2001_M_ElectrBrakeFaultTimeRelay.", "This internal producer is stronger evidence than alarm wording alone.")
        ]),
        steps: freezeRows([
          step(1, "Compare contactor vs delayed feedback", "Observe C102 main-contactor state and C102 MainDriveContactorDelayFB through the actual transition."),
          step(2, "Respect 1 s / 4 s supervision", "The supplied source uses a 1000 ms mismatch monitor and a 4000 ms off-delay. They are source sequence values, not parameters to change to hide the fault."),
          step(3, "Understand Fault 482 interaction", "An active time-relay fault latch suppresses Fault 482's HMI output, so Fault 490 may be the stronger visible clue when both branches disagree."),
          step(4, "Trace hardware after mismatch is proven", "Use the exact K407039 contactor/time-relay feedback circuit under the approved safe-work boundary.")
        ])
      }),
      669: Object.freeze({
        number: 669,
        title: "Safety Circuit Fault Machine Stop Monitoring",
        family: "ElectricBrake standstill / zero-speed supervision",
        producer: "ZeroSpeedOnDel.DN AND !ElectrBrake.ZeroSpeed -> ZeroSpeedCon 2000 ms -> ElectrBrake.O_ZeroSpeedFault -> E2001_M_ElectrBrakeFaultZeroSpeed -> Faults_LB1[41].13",
        sourceRefs: Object.freeze([
          "L5K 4361: Fault 669 = Safety Circuit Fault Machine Stop Monitoring",
          "L5K 27479: ElectrBrake.ZeroSpeedCon.PRE = 2000 ms",
          "L5K 27486-27493: fine-clock sample derives ElectrBrake.SpeedActVal and ElectrBrake.ZeroSpeed",
          "L5K 27495-27497: ZeroSpeedOnDel then ZeroSpeedCon produce O_ZeroSpeedFault",
          "L5K 27579: ZeroSpeedOnDel.PRE = 2000 ms; O_ZeroSpeedFault latches E2001_M_ElectrBrakeFaultZeroSpeed and drives Faults_LB1[41].13",
          "L5K 27561-27563: StartStop.ZeroSpeed is a separate StartStop state derived from SpeedDetect.O_ActVal_10 < 10"
        ]),
        watchPoints: freezeRows([
          watch("StartStop.ZeroSpeed", "Start/stop zero-speed state", "Produced after LES(SpeedDetect.O_ActVal_10,10) and StartStop.DelayZeroSpeed; then starts StartStop.EnableMainDriveOFF.", "Use this for the main-drive-off sequence. It is not the same tag as ElectrBrake.ZeroSpeed.", "The PLC comparison value 10 is an internal software decision threshold in this revision, not a ServoForge field acceptance specification."),
          watch("ElectrBrake.SpeedActVal / ElectrBrake.ZeroSpeed", "Electric-brake speed / standstill state", "Fine-clock counter sampling derives SpeedActVal; SpeedActVal <= 0 sets ElectrBrake.ZeroSpeed.", "Use this independent standstill state for Fault 669 supervision."),
          watch("ElectrBrake.ZeroSpeedOnDel.ACC / .DN", "Standstill on-delay", "ZeroSpeedOnDel.PRE = 2000 ms in the caller.", "The standstill fault path is qualified only after this delay."),
          watch("ElectrBrake.ZeroSpeedCon.ACC / .DN", "Standstill mismatch monitor", "ZeroSpeedCon.PRE = 2000 ms.", "If ElectrBrake.ZeroSpeed remains false after qualification, this monitor can produce O_ZeroSpeedFault."),
          watch("ElectrBrake.O_ZeroSpeedFault", "Direct Fault 669 producer", "Latched into E2001_M_ElectrBrakeFaultZeroSpeed.", "This is a timed standstill disagreement, not simply a statement that the machine is stopped.")
        ]),
        steps: freezeRows([
          step(1, "Keep both zero-speed states separate", "StartStop.ZeroSpeed controls main-drive-off sequencing; ElectrBrake.ZeroSpeed belongs to independent electric-brake safety supervision."),
          step(2, "Trace the standstill timers", "Observe ZeroSpeedOnDel then the 2000 ms ZeroSpeedCon branch before opening hardware."),
          step(3, "Use fine-clock-derived speed as evidence", "ElectrBrake.ZeroSpeed is derived from the main-machine fine-clock calculation. If that measurement path is suspect, open Fault 670's separate v351 workflow rather than borrowing the Cart encoder path."),
          step(4, "Review earlier main-drive faults", "If 480, 482, or 490 occurred first, diagnose that earlier sequence failure before changing zero-speed logic.")
        ])
      })
    });

    function normalizeObservation(observation = {}) {
      return Object.freeze({
        overloadPermissive: String(observation.overloadPermissive || "unknown"),
        driveHealthy: String(observation.driveHealthy || "unknown"),
        contactorCommand: String(observation.contactorCommand || "unknown"),
        contactorFeedback: String(observation.contactorFeedback || "unknown"),
        driveEnable: String(observation.driveEnable || "unknown"),
        mainDriveOffDone: String(observation.mainDriveOffDone || "unknown"),
        timeRelayFault: String(observation.timeRelayFault || "unknown"),
        delayFeedbackAgreement: String(observation.delayFeedbackAgreement || "unknown"),
        zeroSpeedOnDelayDone: String(observation.zeroSpeedOnDelayDone || "unknown"),
        electricBrakeZeroSpeed: String(observation.electricBrakeZeroSpeed || "unknown")
      });
    }

    function evaluate480(o) {
      if (o.overloadPermissive === "open") return outcome(
        "main-drive-overload-separate", "hold", "MS101 permissive is open — separate overload evidence first",
        "The live Fault 480 producer requires E2001_MS101_MainDriveOverload to be made. An open MS101 input is therefore separate overload/protection evidence rather than the direct 480 gate.",
        "Identify the actual overload/protection producer before resetting. If MS101 becomes healthy and PF700 still reports MotOK/NoFault false, return to Fault 480.", [486]
      );
      if (o.overloadPermissive === "made" && o.driveHealthy === "no") return outcome(
        "pf700-node3-direct", "direct", "MS101 is made and PF700/Node3 is not healthy",
        "This matches the direct Fault 480 producer family: the overload/permissive input is made while DriveConETH_01 reports motor-not-OK or no-fault false.",
        "Read PF700/Node3 DriveStatus, O_MotOK, O_NoFault and the drive's own diagnostic code before opening the motor/drive circuit.", [482, 486]
      );
      if (o.overloadPermissive === "made" && o.driveHealthy === "yes") return outcome(
        "drive-status-disagreement", "observe", "Current PF700 status does not reproduce Fault 480",
        "With MS101 made and DriveConETH_01 currently healthy, the present state does not satisfy the direct Fault 480 rung. Preserve alarm history and determine whether the drive recovered or another main-drive supervision fault occurred first.",
        "Compare the time-ordered 480/482/490/669 stack and current PF700 diagnostic history before replacing hardware.", [482, 490, 669]
      );
      return outcome("confirm-pf700-state", "observe", "Confirm MS101 and PF700 state", "Fault 480 becomes precise when the MS101 input and DriveConETH_01 O_MotOK/O_NoFault states are known together.", "Observe those read-only states and the PF700 diagnostic code without forcing the drive.", [486]);
    }

    function contactorMismatch(o) {
      if (o.contactorCommand === "0" && o.contactorFeedback === "0") return "state-1";
      if (o.contactorCommand === "1" && o.contactorFeedback === "1") return "state-2";
      if (o.driveEnable === "0" && o.contactorFeedback === "0" && o.mainDriveOffDone === "yes") return "state-3";
      return "";
    }

    function evaluate482(o) {
      if (o.timeRelayFault === "active") return outcome(
        "time-relay-precedence", "direct", "Fault 490/time-relay supervision takes precedence in the visible alarm path",
        "Fault 482's HMI output is explicitly inhibited while E2001_M_ElectrBrakeFaultTimeRelay is active. The contactor-monitor state can still exist, but the hardware-delay feedback branch is the stronger visible clue.",
        "Open Fault 490 and compare C102 main-contactor state with C102 MainDriveContactorDelayFB through the 1 s / 4 s sequence.", [490]
      );
      const mismatch = contactorMismatch(o);
      if (mismatch) {
        const sourceText = mismatch === "state-1"
          ? "C102 command=0 and C101 feedback=0 matches source mismatch state 1."
          : mismatch === "state-2"
            ? "C102 command=1 and C101 feedback=1 matches source mismatch state 2."
            : "Drive enable=0, C101 feedback=0 and EnableMainDriveOFF.DN=true matches source mismatch state 3.";
        return outcome(
          `contactor-${mismatch}`, "direct", "A source-documented C101/C102 mismatch is present",
          `${sourceText} It must persist through E2001.T_ContactorMonitor's 5000 ms preset before M_ContactorMonitor is latched.`,
          "Verify the raw bits through the actual sequence. If the mismatch persists for five seconds, use the K407039 contactor/feedback circuit under the approved safe-work boundary.", [490]
        );
      }
      return outcome("confirm-contactor-raw-bits", "observe", "Confirm raw C101/C102 sequence states", "Fault 482 uses three specific raw command/feedback combinations plus a five-second timer; feedback polarity should not be guessed from the tag name.", "Record C102 command, C101 feedback, drive enable, EnableMainDriveOFF.DN and the time-relay latch at the same point in the sequence.", [490]);
    }

    function evaluate490(o) {
      if (o.timeRelayFault === "active" && o.delayFeedbackAgreement === "mismatch") return outcome(
        "hardware-delay-feedback-direct", "direct", "Electric-brake hardware-delay feedback mismatch is active",
        "This matches Fault 490's direct producer family: persistent main-contactor / delayed-feedback disagreement produces ElectrBrake.O_HWTimerFault and latches E2001_M_ElectrBrakeFaultTimeRelay.",
        "Confirm C102 state and C102 MainDriveContactorDelayFB through the source 1000 ms monitor and 4000 ms off-delay before tracing hardware.", [482]
      );
      if (o.delayFeedbackAgreement === "mismatch") return outcome(
        "hardware-delay-feedback-monitor", "observe", "Hardware-delay feedback disagrees with the expected sequence",
        "The mismatch is the correct branch, but Fault 490 requires the ElectricBrake 1000 ms hardware timer supervision to mature before O_HWTimerFault is asserted.",
        "Observe HWTimerCon.ACC/.DN and O_HWTimerFault while preserving the 4000 ms off-delay sequence.", [482]
      );
      if (o.delayFeedbackAgreement === "agree" && o.timeRelayFault === "active") return outcome(
        "time-relay-state-disagreement", "observe", "Current feedback appears recovered while the time-relay latch is active",
        "Do not replace hardware solely from the current healthy-looking state. Preserve chronology and determine whether disagreement occurred during the preceding transition.",
        "Review O_HWTimerFault and C102 delay-feedback history around the event, then reset only after the actual sequence is healthy.", [482]
      );
      return outcome("confirm-hardware-delay-feedback", "observe", "Confirm hardware-delay feedback sequence", "Fault 490 becomes precise once C102 main-contactor and delayed-feedback behavior is observed through the start/stop transition.", "Observe the read-only states and O_HWTimerFault; do not bypass or shorten the timer path.", [482]);
    }

    function evaluate669(o) {
      if (o.zeroSpeedOnDelayDone === "yes" && o.electricBrakeZeroSpeed === "no") return outcome(
        "standstill-monitor-direct", "direct", "ElectricBrake standstill was not reached after its on-delay",
        "This is the Fault 669 branch: ZeroSpeedOnDel is done, ElectrBrake.ZeroSpeed remains false, and the 2000 ms ZeroSpeedCon monitor can produce O_ZeroSpeedFault.",
        "Review the main-drive/contactors and fine-clock-derived speed evidence that prevented standstill. If 480/482/490 occurred first, diagnose that earlier sequence failure first.", [480, 482, 490]
      );
      if (o.electricBrakeZeroSpeed === "yes") return outcome(
        "standstill-currently-achieved", "observe", "ElectrBrake.ZeroSpeed is currently achieved",
        "The current state no longer reproduces the direct 669 condition. Preserve event chronology and compare preceding drive, contactor, and fine-clock behavior during the stop transition.",
        "Review 480/482/490 and the ZeroSpeedOnDel/ZeroSpeedCon event timing before changing any thresholds.", [480, 482, 490]
      );
      return outcome("confirm-electric-brake-standstill", "observe", "Confirm the ElectricBrake standstill sequence", "Fault 669 is a timed standstill-monitor disagreement, not merely 'machine stopped' or 'machine moving'.", "Observe ZeroSpeedOnDel.DN, ElectrBrake.ZeroSpeed, ZeroSpeedCon.ACC/.DN and O_ZeroSpeedFault through the stop sequence.", [480, 482, 490]);
    }

    const EVALUATORS = Object.freeze({ 480: evaluate480, 482: evaluate482, 490: evaluate490, 669: evaluate669 });

    function getTopModulMainDriveIsolationPlan(value) {
      const number = typeof value === "object" && value ? Number(value.number) : Number(String(value ?? "").trim());
      if (!SUPPORTED.includes(number)) return null;
      const entry = typeof value === "object" && value?.plcFault ? value : base.getTopModulFault(number);
      const plan = PLANS[number];
      if (!entry || !plan) return null;
      return Object.freeze({
        id: `topmodul-main-drive-isolation-${number}`,
        scope: "Main Labeler / main-drive safety sequence",
        entry,
        number,
        title: plan.title,
        family: plan.family,
        producer: plan.producer,
        watchPoints: plan.watchPoints,
        steps: plan.steps,
        sourceRefs: plan.sourceRefs,
        circuitTrace: base.getTopModulCircuitTrace(number) || entry.circuitTrace || null,
        source: SOURCE,
        safety: SAFETY,
        evaluate: EVALUATORS[number]
      });
    }

    function evaluateTopModulMainDriveIsolation(value, observation = {}) {
      const plan = getTopModulMainDriveIsolationPlan(value);
      return plan ? plan.evaluate(normalizeObservation(observation)) : null;
    }

    function getTopModulNoMotionHandoff() {
      return Object.freeze({
        id: "topmodul-no-motion-main-drive-handoff-v352",
        title: "No-motion handoff — main Labeler",
        guidance: "If a Station encoder feedback fault is present but actual encoder motion is absent, do not open the Cart AQB circuit first. Check the active alarm history for these source-backed main-drive/standstill branches and open only the fault actually present or supported by live diagnostics.",
        candidates: Object.freeze(SUPPORTED.map((number) => {
          const entry = base.getTopModulFault(number);
          const reason = number === 480 ? "PF700/Node3 drive status" : number === 482 ? "C101/C102 contactor mismatch" : number === 490 ? "hardware-delay/time-relay feedback" : "standstill/zero-speed supervision";
          return Object.freeze({ number, code: entry?.code || String(number), title: entry?.title || PLANS[number].title, reason });
        })),
        excluded: Object.freeze([{ number: 670, reason: "Fault 670 remains the separate v351 main-machine fine-clock workflow and is not promoted as a no-motion cause merely because an encoder alarm is present." }]),
        safety: SAFETY
      });
    }

    const evaluateEncoder = base.evaluateTopModulEncoderIsolation.bind(base);
    function evaluateTopModulEncoderIsolation(value, observation = {}) {
      const result = evaluateEncoder(value, observation);
      if (!result || result.code !== "resolve-no-motion-first") return result;
      return Object.freeze({ ...result, handoff: getTopModulNoMotionHandoff() });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];

      if (JSON.stringify(SUPPORTED) !== JSON.stringify([480, 482, 490, 669])) errors.push("v352 main-drive isolation scope changed unexpectedly.");
      if (getTopModulMainDriveIsolationPlan(670) !== null) errors.push("v352 must leave Fault 670 exclusively under the v351 main-Labeler fine-clock workflow.");
      if (base.getTopModulEncoderIsolationPlan(670)?.sourceEvidence?.faultAddress !== "Faults_LB1[41].14") errors.push("v352 lost v351 Fault 670 source authority.");

      const f480 = getTopModulMainDriveIsolationPlan(480);
      if (!/O_MotOK/.test(f480?.producer || "") || !/Faults_LB1\[30\]\.0/.test(f480?.producer || "")) errors.push("v352 lost Fault 480 direct producer/address.");
      if (evaluateTopModulMainDriveIsolation(480, { overloadPermissive: "open" })?.code !== "main-drive-overload-separate") errors.push("v352 must separate open MS101 evidence from live Fault 480 producer logic.");

      const f482 = getTopModulMainDriveIsolationPlan(482);
      if (!f482?.watchPoints?.some((row) => /T_ContactorMonitor/.test(row.tag) && /5000/.test(row.relationship))) errors.push("v352 lost Fault 482 5000 ms monitor.");
      if (evaluateTopModulMainDriveIsolation(482, { contactorCommand: "0", contactorFeedback: "0", timeRelayFault: "clear" })?.code !== "contactor-state-1") errors.push("v352 lost source contactor mismatch state 1.");
      const precedence = evaluateTopModulMainDriveIsolation(482, { timeRelayFault: "active" });
      if (precedence?.code !== "time-relay-precedence" || !precedence.related.includes(490)) errors.push("v352 lost Fault 490 precedence over visible 482 output.");

      const f490 = getTopModulMainDriveIsolationPlan(490);
      if (!f490?.watchPoints?.some((row) => /HWTimerCon/.test(row.tag) && /1000/.test(row.relationship))) errors.push("v352 lost Fault 490 1000 ms mismatch monitor.");
      if (!f490?.watchPoints?.some((row) => /HWTimerOffDel/.test(row.tag) && /4000/.test(row.relationship))) errors.push("v352 lost Fault 490 4000 ms off-delay evidence.");

      const f669 = getTopModulMainDriveIsolationPlan(669);
      if (!/O_ZeroSpeedFault/.test(f669?.producer || "") || !/Faults_LB1\[41\]\.13/.test(f669?.producer || "")) errors.push("v352 lost Fault 669 producer/address.");
      if (!f669?.watchPoints?.some((row) => /ZeroSpeedCon/.test(row.tag) && /2000/.test(row.relationship))) errors.push("v352 lost Fault 669 2000 ms monitor.");
      if (!f669?.watchPoints?.some((row) => row.tag === "StartStop.ZeroSpeed" && /internal software decision threshold/i.test(row.caution))) errors.push("v352 must keep SpeedDetect < 10 labeled as an internal PLC threshold.");

      const handoff = evaluateTopModulEncoderIsolation("00067", { motion: "no" });
      if (!handoff?.handoff?.candidates?.some((row) => row.number === 480) || handoff.handoff.candidates.some((row) => row.number === 670)) errors.push("v352 no-motion handoff must expose main-drive branches without promoting Fault 670.");

      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+main-drive-isolation-v352`,
      getTopModulMainDriveIsolationPlan,
      evaluateTopModulMainDriveIsolation,
      getTopModulNoMotionHandoff,
      evaluateTopModulEncoderIsolation,
      topModulMainDriveIsolationFaults: SUPPORTED,
      topModulMainDriveIsolationSource: SOURCE,
      validate
    });
  };
});
