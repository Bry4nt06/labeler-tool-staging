"use strict";

(function installTopModulMainDriveIsolation(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulMainDriveIsolationExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getTopModulCircuitTrace || !base?.evaluateTopModulEncoderIsolation) {
      throw new Error("TopModul Labeler cause/circuit and encoder-isolation layers are required before main-drive isolation.");
    }

    const SUPPORTED = Object.freeze([480, 482, 490, 669, 670]);
    const SOURCE = Object.freeze({
      id: "topmodul-k407039-lb1-main-drive-isolation",
      file: "CO85_LB1_Labeler_1online.L5K",
      controller: "CO85_LB1_Labeler_1",
      evidenceClass: "readable-labeler-plc-export",
      sourceDiscipline: "Main-drive, contactor, electric-brake, standstill and fine-pulse logic is taken from the supplied readable LB1 L5K. Existing K407039 circuit traces remain the hardware authority; this layer adds read-only isolation logic and does not redefine PLC thresholds as field acceptance specifications."
    });

    const OBSERVE = "Use normal HMI/PLC/drive diagnostics only. Do not force drive, contactor, zero-speed, encoder, safety, or fault bits and do not defeat monitoring logic.";
    const LOTO = "Prevent unexpected machine motion and follow site LOTO/stored-energy requirements before hands-on drive, motor, contactor, encoder, wiring, or cabinet work.";
    const ELECTRICAL = "Energized electrical/signal measurements are for qualified personnel under the site's approved electrical safe-work procedure.";
    const SAFETY = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const watch = (tag, role, relationship, interpretation, caution = "") => Object.freeze({ tag, role, relationship, interpretation, caution });
    const step = (order, label, detail) => Object.freeze({ order, label, detail });

    const COMMON_WATCH = Object.freeze([
      watch(
        "StartStop.ZeroSpeed",
        "Start/stop zero-speed state",
        "Produced after LES(SpeedDetect.O_ActVal_10,10) and the StartStop.DelayZeroSpeed timer; it then starts StartStop.EnableMainDriveOFF.",
        "Use this as the StartStop state that controls the main-drive-off sequence. It is not the same tag as ElectrBrake.ZeroSpeed.",
        "The PLC comparison value 10 is an internal software decision threshold in this revision, not a ServoForge field acceptance specification."
      ),
      watch(
        "ElectrBrake.ZeroSpeed",
        "Electric-brake standstill state",
        "Used by the electric-brake safety supervision and separately monitored by ZeroSpeedOnDel / ZeroSpeedCon.",
        "Use this state when diagnosing Faults 669/670. Keep it separate from StartStop.ZeroSpeed unless the live PLC trace proves both are behaving together."
      ),
      watch(
        "E1701_ENC101_FineClockPulse",
        "Main-machine fine-clock input",
        "Alias Local:7:I.Data.0; documented as Fine Clock Pulse (10 Per Pitch). It feeds the ElectricBrake pulse counter and fine-pulse monitoring.",
        "Use it only for the base Labeler main-machine encoder/fine-clock path. Do not borrow the Cart 1756-M02AE/CN131 feedback path."
      )
    ]);

    const PLANS = Object.freeze({
      480: Object.freeze({
        number: 480,
        title: "Main Drive Fault",
        family: "PF700 / Node3 drive status",
        producer: "[!DriveConETH_01.O_MotOK OR !DriveConETH_01.O_NoFault] AND E2001_MS101_MainDriveOverload",
        watchPoints: freezeRows([
          watch("E2001_AFD101_MainDriveEnable", "Main-drive enable", "Feeds DriveConETH_01.I_DriveEnable.", "Confirms whether the Labeler is requesting drive enable."),
          watch("VSD85LB1_Node3:I.DriveStatus", "PF700 Node3 status", "Feeds DriveConETH_01.I_Stat.", "Read PF700/Node3 diagnostics before replacing drive hardware."),
          watch("VSD85LB1_Node3:I.OutputFreq", "PF700 output frequency", "Feeds DriveConETH_01.I_Freq.", "Provides read-only drive output evidence; do not infer mechanical speed solely from this value."),
          watch("DriveConETH_01.O_MotOK", "Drive motor OK", "One direct Fault 480 producer condition.", "If false while MS101 permissive is made, it supports the direct drive-controller path."),
          watch("DriveConETH_01.O_NoFault", "Drive no-fault state", "One direct Fault 480 producer condition.", "If false while MS101 permissive is made, it supports the direct drive-controller path."),
          watch("E2001_MS101_MainDriveOverload", "MS101 overload/permissive", "Alias I0009.25 and a required true gate in the Fault 480 producer rung.", "An open permissive is separate overload evidence; Fault 486 is the multi-source overload summary.")
        ]),
        steps: freezeRows([
          step(1, "Check MS101 permissive", "Fault 480's direct producer requires E2001_MS101_MainDriveOverload to be true. If that permissive is open, diagnose the overload/protection condition separately rather than calling the open overload the direct 480 producer."),
          step(2, "Read PF700 / Node3", "With MS101 permissive made, use O_MotOK, O_NoFault, Node3 DriveStatus and the drive's own diagnostic code as primary evidence."),
          step(3, "Keep contactor supervision separate", "Fault 482 is the timed C101/C102 command-feedback monitor; it can coexist with 480 but is not the same producer."),
          step(4, "Repair only the proven branch", "Use the existing K407039 PF700/MS101/MTR101 circuit trace after PLC/drive evidence narrows the fault.")
        ])
      }),
      482: Object.freeze({
        number: 482,
        title: "Main Drive Contactor Fault",
        family: "C101/C102 timed contactor-state mismatch",
        producer: "E2001.M_ContactorMonitor after E2001.T_ContactorMonitor = 5000 ms; Fault 482 HMI output additionally requires !E2001_M_ElectrBrakeFaultTimeRelay",
        watchPoints: freezeRows([
          watch("E2001_C102_MainDriveContactor", "C102 contactor command bit", "Alias O0103.0; one side of all three ContactorMonitor mismatch states.", "Compare raw bit state with C101 feedback and sequence state; do not assume intuitive feedback polarity."),
          watch("E2001_C101_MainDriveContactorFB", "C101 contactor feedback bit", "Alias I0009.26; one side of all three ContactorMonitor mismatch states.", "Use the raw PLC state and source comments because the feedback logic is not safely reduced to a generic normally-open/normally-closed assumption."),
          watch("E2001_AFD101_MainDriveEnable", "Controller/drive enable", "Used by the third ContactorMonitor mismatch branch.", "When enable is released, the monitor verifies the contactor feedback transitions through the expected sequence."),
          watch("StartStop.EnableMainDriveOFF.DN", "Main-drive-off delay done", "Qualifies the third contactor mismatch branch after zero-speed/off sequencing.", "Do not bypass the off-delay to clear the fault."),
          watch("E2001.T_ContactorMonitor.DN", "Contactor mismatch timer done", "E2001.T_ContactorMonitor preset is 5000 ms.", "The mismatch must persist through the configured monitor timer before the monitor latch is set."),
          watch("E2001_M_ElectrBrakeFaultTimeRelay", "Electric-brake time-relay fault latch", "Fault 482 HMI output is gated through XIO(E2001_M_ElectrBrakeFaultTimeRelay).", "If this latch is active, Fault 490/time-relay supervision can suppress the 482 HMI output even though the contactor-monitor state is real.")
        ]),
        steps: freezeRows([
          step(1, "Preserve raw command/feedback states", "The PLC source documents three invalid combinations. Diagnose those exact combinations rather than converting C101 feedback to an assumed physical polarity."),
          step(2, "Allow the 5000 ms monitor", "E2001.T_ContactorMonitor supervises a persistent mismatch for five seconds before latching M_ContactorMonitor."),
          step(3, "Check Fault 490 precedence", "The Fault 482 HMI OTE is inhibited while E2001_M_ElectrBrakeFaultTimeRelay is active. If Fault 490 is present, diagnose the hardware-delay feedback path first."),
          step(4, "Use K407039 after logic isolation", "Only after the mismatched command/feedback state is identified should the physical C101/C102 contactor and wiring circuit become the primary path.")
        ])
      }),
      490: Object.freeze({
        number: 490,
        title: "Safety Circuit Fault Main Drive Time Relay",
        family: "ElectricBrake hardware-delay feedback supervision",
        producer: "ElectrBrake.O_HWTimerFault -> E2001_M_ElectrBrakeFaultTimeRelay -> Fault 490",
        watchPoints: freezeRows([
          watch("E2001_C102_MainDriveContactor", "Main-contactor state", "Feeds ElectrBrake.I_MainContactor.", "Compare with the hardware-delay feedback through the expected start/stop sequence."),
          watch("E2001_C102_MainDriveContactorDelayFB", "Hardware-delay feedback", "Alias I0009.27 and feeds ElectrBrake.I_FeedbackTimer.", "A persistent disagreement with the expected contactor sequence is the relevant evidence."),
          watch("ElectrBrake.HWTimerCon.DN", "Hardware-timer monitor done", "HWTimerCon.PRE = 1000 ms.", "A mismatch persisting through the 1-second monitor produces O_HWTimerFault."),
          watch("ElectrBrake.HWTimerOffDel.DN", "Hardware-timer off-delay state", "HWTimerOffDel.PRE = 4000 ms in the caller.", "Retain the four-second off-delay as sequence evidence; do not shorten it as a troubleshooting shortcut."),
          watch("ElectrBrake.O_HWTimerFault", "Direct electric-brake producer", "Latched into E2001_M_ElectrBrakeFaultTimeRelay and then Fault 490.", "This is stronger source evidence than the generic alarm wording alone.")
        ]),
        steps: freezeRows([
          step(1, "Compare contactor vs delay feedback", "Use C102 command/state and C102 MainDriveContactorDelayFB through the actual start/stop sequence."),
          step(2, "Respect 1 s / 4 s supervision", "The source uses a 1000 ms hardware feedback monitor and a 4000 ms off-delay. These are PLC sequence values, not parameters to change to make the fault disappear."),
          step(3, "Understand Fault 482 interaction", "An active time-relay fault latch suppresses the Fault 482 HMI output. Fault 490 can therefore be the stronger visible clue when both contactor and delay-feedback supervision are involved."),
          step(4, "Trace hardware only after state mismatch is proven", "Use the exact K407039 contactor/time-relay feedback circuit under the approved safe-work boundary.")
        ])
      }),
      669: Object.freeze({
        number: 669,
        title: "Safety Circuit Fault Machine Stop Monitoring",
        family: "ElectricBrake standstill / zero-speed supervision",
        producer: "ElectrBrake.O_ZeroSpeedFault -> E2001_M_ElectrBrakeFaultZeroSpeed -> Fault 669",
        watchPoints: freezeRows([
          ...COMMON_WATCH,
          watch("ElectrBrake.ZeroSpeedOnDel.DN", "Standstill on-delay done", "The zero-speed monitor is qualified after ZeroSpeedOnDel.", "Use the actual sequence state; do not force it."),
          watch("ElectrBrake.ZeroSpeedCon.DN", "Standstill monitor timer done", "ZeroSpeedCon.PRE = 2000 ms.", "When the zero-speed condition is still not achieved after this monitor, O_ZeroSpeedFault is produced."),
          watch("ElectrBrake.O_ZeroSpeedFault", "Direct Fault 669 producer", "Latched into E2001_M_ElectrBrakeFaultZeroSpeed.", "This is a standstill-monitor disagreement, not simply a statement that the machine is not moving.")
        ]),
        steps: freezeRows([
          step(1, "Keep the two zero-speed states separate", "StartStop.ZeroSpeed controls the main-drive-off sequence; ElectrBrake.ZeroSpeed belongs to the independent electric-brake safety supervision."),
          step(2, "Use the 2000 ms standstill monitor", "ZeroSpeedOnDel.DN together with missing ElectrBrake.ZeroSpeed starts ZeroSpeedCon; its 2000 ms completion produces O_ZeroSpeedFault."),
          step(3, "Use fine-clock evidence as measurement input", "The ElectricBrake routine derives speed/standstill evidence from the main-machine fine-clock pulse path. Do not borrow the Cart BaseMachineEncoderAxis feedback route."),
          step(4, "Review 480/482/490 chronology", "If drive or contactor faults occurred first, resolve those sequence failures before changing encoder or zero-speed settings.")
        ])
      }),
      670: Object.freeze({
        number: 670,
        title: "Safety Circuit Fault Fine Clock Pulse Monitoring",
        family: "ElectricBrake main-machine fine-pulse supervision",
        producer: "ElectrBrake.O_FinePulseFault -> E2001_M_ElectrBrakeFaultEncoder -> modulation-gated Fault 670",
        watchPoints: freezeRows([
          ...COMMON_WATCH,
          watch("E2001_AFD101_MainDriveEnable", "Main-drive enable", "Feeds ElectrBrake.I_DriveEnable and is required by the fine-pulse fault branch.", "If drive enable is not active, the live fine-pulse producer condition is not currently satisfied; preserve alarm chronology/latch state before replacing hardware."),
          watch("ElectrBrake.FinePulseCon.DN", "Fine-pulse monitor done", "FinePulseCon.PRE = 3000 ms.", "Drive enable + ElectrBrake.ZeroSpeed + enabled pulse monitoring must persist through three seconds before O_FinePulseFault is produced."),
          watch("ElectrBrake.O_FinePulseFault", "Direct internal fine-pulse producer", "Latched into E2001_M_ElectrBrakeFaultEncoder.", "Use this internal state to separate the producer from the final HMI output gate."),
          watch("Labeler_Modulation_Timer_1.DN", "Fault 670 modulation suppressor", "Fault 670 final output uses XIO(Labeler_Modulation_Timer_1.DN).", "The internal encoder/fine-pulse latch can exist while the final HMI bit is suppressed by modulation logic."),
          watch("Labeler_Modulation_Timer_Delay.DN", "Fault 670 modulation enable", "Fault 670 final output also requires XIC(Labeler_Modulation_Timer_Delay.DN).", "Treat this as HMI-output gating, not a second encoder hardware fault.")
        ]),
        steps: freezeRows([
          step(1, "Confirm drive-enable / standstill context", "The fine-pulse monitor is active when main-drive enable is true while ElectrBrake.ZeroSpeed remains true and pulse monitoring is enabled."),
          step(2, "Observe ENC101 fine-clock pulses", "If physical/main-drive motion is present but E1701_ENC101_FineClockPulse is stopped/frozen, use the existing K407039 ENC101/CVTR101 input circuit."),
          step(3, "Use the 3000 ms monitor", "FinePulseCon must complete its 3000 ms supervision before O_FinePulseFault is produced. Do not shorten the timer to suppress the fault."),
          step(4, "Separate internal latch from HMI gating", "Fault 670's final HMI output is modulation-gated. An internal E2001_M_ElectrBrakeFaultEncoder latch and the displayed Fault 670 are related but not identical states."),
          step(5, "Never borrow the Cart encoder circuit", "Fault 670 uses K407039 ENC101/fine-clock hardware, not K605163 BaseMachineEncoderAxis / 1756-M02AE / CN131.")
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
        electricBrakeZeroSpeed: String(observation.electricBrakeZeroSpeed || "unknown"),
        fineClock: String(observation.fineClock || "unknown"),
        modulationGate: String(observation.modulationGate || "unknown")
      });
    }

    const outcome = (code, severity, title, summary, next, related = []) => Object.freeze({ code, severity, title, summary, next, related: Object.freeze(related) });

    function evaluate480(o) {
      if (o.overloadPermissive === "open") return outcome(
        "main-drive-overload-separate",
        "hold",
        "MS101 permissive is open — separate overload evidence first",
        "The live Fault 480 producer requires E2001_MS101_MainDriveOverload to be made. An open MS101 permissive is therefore not the direct 480 gate; preserve Fault 480 chronology, but diagnose the overload/protection condition and Fault 486 context separately.",
        "Identify the actual overload/protection producer and protected load before resetting. If MS101 becomes healthy and PF700 still reports MotOK/NoFault false, return to Fault 480.",
        [486]
      );
      if (o.overloadPermissive === "made" && o.driveHealthy === "no") return outcome(
        "pf700-node3-direct",
        "direct",
        "MS101 is made and PF700/Node3 is not healthy",
        "This matches the direct Fault 480 producer family: the overload permissive is present while DriveConETH_01 reports motor-not-OK or fault/not-ready.",
        "Read PF700/Node3 DriveStatus, O_MotOK, O_NoFault and the drive's own diagnostic code before opening the motor/drive circuit.",
        [482, 486]
      );
      if (o.overloadPermissive === "made" && o.driveHealthy === "yes") return outcome(
        "drive-status-disagreement",
        "observe",
        "Current PF700 status does not reproduce the Fault 480 producer",
        "With MS101 permissive made and DriveConETH_01 currently healthy, the present state does not satisfy the direct Fault 480 rung. Preserve alarm history and check whether the drive recovered, the fault is historical/latched elsewhere, or another main-drive supervision fault occurred first.",
        "Compare the time-ordered 480/482/490/669 stack and current drive diagnostic history; do not replace PF700 solely from the alarm text.",
        [482, 490, 669]
      );
      return outcome("confirm-pf700-state", "observe", "Confirm MS101 and PF700 state", "Fault 480 becomes precise when the MS101 permissive and DriveConETH_01 O_MotOK/O_NoFault states are known together.", "Observe those read-only states and the PF700 diagnostic code without forcing the drive.", [486]);
    }

    function contactorMismatch(o) {
      if (o.contactorCommand === "0" && o.contactorFeedback === "0") return "state-1";
      if (o.contactorCommand === "1" && o.contactorFeedback === "1") return "state-2";
      if (o.driveEnable === "0" && o.contactorFeedback === "0" && o.mainDriveOffDone === "yes") return "state-3";
      return "";
    }

    function evaluate482(o) {
      if (o.timeRelayFault === "active") return outcome(
        "time-relay-precedence",
        "direct",
        "Fault 490/time-relay supervision takes precedence in the visible alarm path",
        "Fault 482's HMI output is explicitly inhibited while E2001_M_ElectrBrakeFaultTimeRelay is active. The contactor-monitor state can still be real, but the time-relay/hardware-delay feedback path is the stronger visible branch.",
        "Open Fault 490 and compare C102 main-contactor state with C102 MainDriveContactorDelayFB through the 1 s / 4 s hardware-delay sequence.",
        [490]
      );
      const mismatch = contactorMismatch(o);
      if (mismatch) {
        const sourceText = mismatch === "state-1"
          ? "Raw PLC state C102 command=0 and C101 feedback=0 matches the first source-documented invalid contactor-monitor combination."
          : mismatch === "state-2"
            ? "Raw PLC state C102 command=1 and C101 feedback=1 matches the second source-documented invalid contactor-monitor combination."
            : "Drive enable=0, C101 feedback=0 and StartStop.EnableMainDriveOFF.DN=true matches the third source-documented invalid release-sequence combination.";
        return outcome(
          `contactor-${mismatch}`,
          "direct",
          "A source-documented C101/C102 mismatch is present",
          `${sourceText} The condition must persist through E2001.T_ContactorMonitor (5000 ms) before M_ContactorMonitor is latched.`,
          "Verify the raw command/feedback bits through the actual sequence. If the mismatch persists for five seconds, use the K407039 contactor/feedback circuit under the approved safe-work boundary.",
          [490]
        );
      }
      return outcome(
        "confirm-contactor-raw-bits",
        "observe",
        "Confirm raw C101/C102 sequence states",
        "Fault 482 uses three specific raw PLC command/feedback combinations plus a five-second timer. The feedback polarity should not be guessed from the tag name alone.",
        "Record C102 command, C101 feedback, drive enable, EnableMainDriveOFF.DN and the time-relay fault latch at the same point in the start/stop sequence.",
        [490]
      );
    }

    function evaluate490(o) {
      if (o.timeRelayFault === "active" && o.delayFeedbackAgreement === "mismatch") return outcome(
        "hardware-delay-feedback-direct",
        "direct",
        "Electric-brake hardware-delay feedback mismatch is active",
        "This matches Fault 490's direct producer family: ElectrBrake.O_HWTimerFault is created by persistent main-contactor / hardware-delay feedback disagreement and latched into E2001_M_ElectrBrakeFaultTimeRelay.",
        "Confirm C102 contactor state and C102 MainDriveContactorDelayFB through the source 1000 ms monitor and 4000 ms off-delay before tracing the physical delay-feedback circuit.",
        [482]
      );
      if (o.delayFeedbackAgreement === "mismatch") return outcome(
        "hardware-delay-feedback-monitor",
        "observe",
        "Hardware-delay feedback disagrees with the expected sequence",
        "The mismatch is the correct diagnostic branch, but Fault 490 requires the ElectricBrake hardware timer supervision to mature before O_HWTimerFault is asserted.",
        "Observe HWTimerCon.DN / O_HWTimerFault and retain the 1000 ms monitor plus 4000 ms off-delay as source sequence values.",
        [482]
      );
      if (o.delayFeedbackAgreement === "agree" && o.timeRelayFault === "active") return outcome(
        "time-relay-state-disagreement",
        "observe",
        "Current feedback appears recovered while the time-relay fault latch is active",
        "Do not replace the time relay/contactor solely from the current healthy-looking state. Preserve chronology and determine whether the mismatch occurred during the preceding start/stop transition.",
        "Review O_HWTimerFault and C102 delay-feedback history around the event, then reset only after the actual sequence is healthy.",
        [482]
      );
      return outcome("confirm-hardware-delay-feedback", "observe", "Confirm hardware-delay feedback sequence", "Fault 490 is precise once the C102 main-contactor state and C102 MainDriveContactorDelayFB relationship is observed through the start/stop sequence.", "Observe the read-only states and O_HWTimerFault; do not bypass or shorten the timer path.", [482]);
    }

    function evaluate669(o) {
      if (o.zeroSpeedOnDelayDone === "yes" && o.electricBrakeZeroSpeed === "no") return outcome(
        "standstill-monitor-direct",
        "direct",
        "ElectricBrake standstill was not reached after its on-delay",
        "This is the Fault 669 branch: ZeroSpeedOnDel is done, ElectrBrake.ZeroSpeed is still false, and the 2000 ms ZeroSpeedCon monitor can produce O_ZeroSpeedFault.",
        "Review the main-drive/contactors and fine-clock-derived speed evidence that prevented standstill. If 480/482/490 occurred first, diagnose that earlier sequence failure before changing zero-speed logic.",
        [480, 482, 490]
      );
      if (o.electricBrakeZeroSpeed === "yes") return outcome(
        "standstill-currently-achieved",
        "observe",
        "ElectricBrake.ZeroSpeed is currently achieved",
        "The current state no longer reproduces the direct 669 condition. Preserve the event chronology and compare the preceding drive/contactors/fine-clock behavior during the stop transition.",
        "Review 480/482/490 and the 2-second ZeroSpeedCon event timing before changing any thresholds.",
        [480, 482, 490]
      );
      return outcome("confirm-electric-brake-standstill", "observe", "Confirm the ElectricBrake standstill sequence", "Fault 669 is a timed standstill-monitor disagreement, not merely 'machine stopped' or 'machine moving'.", "Observe ZeroSpeedOnDel.DN, ElectrBrake.ZeroSpeed, ZeroSpeedCon.DN and O_ZeroSpeedFault through the stop sequence.", [480, 482, 490]);
    }

    function evaluate670(o) {
      if (o.driveEnable === "0") return outcome(
        "fine-pulse-drive-enable-not-active",
        "observe",
        "Main-drive enable is not currently active",
        "The ElectricBrake fine-pulse producer requires I_DriveEnable=true. The current state therefore does not reproduce the live producer condition; preserve the internal latch/HMI chronology before replacing ENC101 hardware.",
        "Review E2001_M_ElectrBrakeFaultEncoder, O_FinePulseFault and the preceding drive/zero-speed sequence.",
        [480, 482, 669]
      );
      if (o.driveEnable === "1" && o.electricBrakeZeroSpeed === "yes" && o.fineClock === "stopped") return outcome(
        "main-fine-clock-direct",
        "direct",
        "Drive enable is active, standstill state remains true, and fine-clock pulses are stopped",
        "This matches the direct Fault 670 supervision context. If the condition persists for FinePulseCon's 3000 ms preset, O_FinePulseFault is produced and latched into E2001_M_ElectrBrakeFaultEncoder.",
        "Use the existing K407039 ENC101/CVTR101 fine-clock circuit; do not borrow the Cart 1756-M02AE/CN131 feedback route.",
        [669]
      );
      if (o.fineClock === "changing") return outcome(
        "fine-clock-changing-supervision",
        "observe",
        "Fine-clock pulses are changing",
        "Changing E1701_ENC101_FineClockPulse evidence weakens a simple open/frozen encoder-path explanation. Re-check ElectricBrake.ZeroSpeed, drive-enable state, the 3000 ms supervision timing and the modulation-gated HMI output before replacing ENC101.",
        "Compare O_FinePulseFault, E2001_M_ElectrBrakeFaultEncoder and modulation timer states with the event chronology.",
        [669, 480, 482]
      );
      if (o.modulationGate === "suppressed") return outcome(
        "fault670-hmi-suppressed",
        "observe",
        "Fault 670 HMI output is in its modulation suppression state",
        "The internal E2001_M_ElectrBrakeFaultEncoder latch and the final Fault 670 OTE are not identical states. Modulation timers can suppress the displayed bit while the internal fine-pulse fault remains latched.",
        "Use the internal O_FinePulseFault / encoder latch as producer evidence and treat the modulation timers only as HMI-output gating.",
        [669]
      );
      return outcome("confirm-fine-pulse-context", "observe", "Confirm drive-enable, standstill and fine-clock together", "Fault 670 requires a specific ElectricBrake context and a 3000 ms timer. Isolating those read-only states prevents unnecessary encoder replacement.", "Observe E2001_AFD101_MainDriveEnable, ElectrBrake.ZeroSpeed, E1701_ENC101_FineClockPulse, FinePulseCon.DN and the modulation gate.", [669]);
    }

    const EVALUATORS = Object.freeze({ 480: evaluate480, 482: evaluate482, 490: evaluate490, 669: evaluate669, 670: evaluate670 });

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
        id: "topmodul-no-motion-main-drive-handoff",
        title: "No-motion handoff — main Labeler",
        guidance: "If Station encoder feedback fault is present but actual encoder motion is absent, do not open the Cart AQB circuit first. Check the active alarm history for these source-backed main-drive/standstill branches and open only the fault that is actually present or supported by live diagnostics.",
        candidates: Object.freeze([480, 482, 490, 669].map((number) => {
          const entry = base.getTopModulFault(number);
          return Object.freeze({ number, code: entry?.code || String(number), title: entry?.title || PLANS[number].title, reason: number === 480 ? "PF700/Node3 drive status" : number === 482 ? "C101/C102 contactor mismatch" : number === 490 ? "hardware-delay/time-relay feedback" : "standstill/zero-speed supervision" });
        })),
        excluded: Object.freeze([{ number: 670, reason: "Fine-clock Fault 670 is a separate main-encoder supervision path and should not be assumed to cause no motion merely because an encoder alarm is present." }]),
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

      const f480 = getTopModulMainDriveIsolationPlan(480);
      if (!/O_MotOK/.test(f480?.producer || "") || !/MS101/.test(f480?.producer || "")) errors.push("v351 lost Fault 480 drive-status + MS101 producer logic.");
      const overload = evaluateTopModulMainDriveIsolation(480, { overloadPermissive: "open" });
      if (overload?.code !== "main-drive-overload-separate") errors.push("v351 must separate open MS101 overload evidence from the live Fault 480 producer.");

      const f482 = getTopModulMainDriveIsolationPlan(482);
      if (!/5000/.test(f482?.watchPoints?.find((row) => row.tag === "E2001.T_ContactorMonitor.DN")?.relationship || "")) errors.push("v351 lost Fault 482 5000 ms contactor monitor.");
      const c1 = evaluateTopModulMainDriveIsolation(482, { contactorCommand: "0", contactorFeedback: "0", timeRelayFault: "clear" });
      if (c1?.code !== "contactor-state-1") errors.push("v351 lost first source-documented contactor mismatch state.");
      const suppress = evaluateTopModulMainDriveIsolation(482, { timeRelayFault: "active" });
      if (suppress?.code !== "time-relay-precedence" || !suppress.related.includes(490)) errors.push("v351 must preserve Fault 490 suppression/precedence over Fault 482 HMI output.");

      const f490 = getTopModulMainDriveIsolationPlan(490);
      if (!f490?.watchPoints?.some((row) => row.tag === "ElectrBrake.HWTimerCon.DN" && /1000/.test(row.relationship))) errors.push("v351 lost 1000 ms Fault 490 hardware timer monitor.");
      if (!f490?.watchPoints?.some((row) => row.tag === "ElectrBrake.HWTimerOffDel.DN" && /4000/.test(row.relationship))) errors.push("v351 lost 4000 ms hardware timer off-delay evidence.");

      const f669 = getTopModulMainDriveIsolationPlan(669);
      if (!/O_ZeroSpeedFault/.test(f669?.producer || "")) errors.push("v351 lost Fault 669 O_ZeroSpeedFault producer.");
      if (!f669?.watchPoints?.some((row) => row.tag === "ElectrBrake.ZeroSpeedCon.DN" && /2000/.test(row.relationship))) errors.push("v351 lost Fault 669 2000 ms standstill monitor.");
      if (!f669?.watchPoints?.some((row) => row.tag === "StartStop.ZeroSpeed" && /internal software decision threshold/i.test(row.caution))) errors.push("v351 must mark SpeedDetect < 10 as an internal PLC threshold, not a field acceptance spec.");

      const f670 = getTopModulMainDriveIsolationPlan(670);
      if (!/O_FinePulseFault/.test(f670?.producer || "") || !/modulation-gated/.test(f670?.producer || "")) errors.push("v351 lost Fault 670 internal producer vs HMI-gating distinction.");
      if (!f670?.watchPoints?.some((row) => row.tag === "ElectrBrake.FinePulseCon.DN" && /3000/.test(row.relationship))) errors.push("v351 lost Fault 670 3000 ms fine-pulse monitor.");
      if (!f670?.watchPoints?.some((row) => row.tag === "Labeler_Modulation_Timer_1.DN")) errors.push("v351 lost Fault 670 modulation suppression evidence.");

      const handoff = evaluateTopModulEncoderIsolation("00067", { motion: "no" });
      if (!handoff?.handoff?.candidates?.some((row) => row.number === 480) || handoff.handoff.candidates.some((row) => row.number === 670)) errors.push("v351 no-motion handoff must surface main-drive/standstill branches without promoting Fault 670 as a no-motion cause.");
      if (base.getTopModulEncoderVerification?.(670) !== null) errors.push("v351 must preserve v350 separation of base Fault 670 from the Cart encoder verification matrix.");

      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+main-drive-isolation-v1`,
      getTopModulMainDriveIsolationPlan,
      evaluateTopModulMainDriveIsolation,
      getTopModulNoMotionHandoff,
      evaluateTopModulEncoderIsolation,
      topModulMainDriveIsolationFaults: SUPPORTED,
      validate
    });
  };
});
