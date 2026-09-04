"use strict";

(function installAplCartWebHandling(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplCartWebHandlingExtension() {
  return function extendLibrary(base) {
    if (!base?.searchEntries || !base?.getEntry || !base?.getSource || !base?.validate || !base?.normalize || !Array.isArray(base.entries)) {
      throw new Error("ServoForge troubleshooting library is required before APL Cart web-handling tracing.");
    }

    const SOURCE_ID = "lb1-aplcart-readable-l5k-v355";
    const source = base.getSource(SOURCE_ID);
    if (!source) throw new Error("APL Cart readable L5K source is unavailable.");

    const OBSERVE = "Use normal HMI/PLC/axis diagnostics only. Do not force, write, bypass, or reset Cart fault, sensor, counter, timer, motion, or encoder bits to clear a condition.";
    const LOTO = "Stop the machine and follow site lockout/tagout and stored-energy requirements before hands-on work on label web, feed/rewind mechanics, sensors, encoder hardware, guarded equipment, connectors, or wiring.";
    const ELECTRICAL = "Energized electrical or signal measurements are for qualified personnel under the site's approved electrical safe-work procedure and current machine schematic.";
    const SAFETY = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);
    const SUPPORTED = Object.freeze([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const watch = (tag, role, relationship, interpretation, caution = "") => Object.freeze({ tag, role, relationship, interpretation, caution });
    const step = (order, label, detail) => Object.freeze({ order, label, detail });
    const choice = (value, label) => Object.freeze({ value, label });
    const observe = (key, prompt, choices) => Object.freeze({ key, prompt, choices: Object.freeze(choices) });
    const result = (code, severity, title, summary, next = "") => Object.freeze({ code, severity, title, summary, next });

    const TITLES = Object.freeze({
      21: "Missing Signal for Reference Run",
      22: "Label Length Measurement Fault",
      23: "Web Break Sensor Actuated",
      24: "Reference Sensor No Signal",
      25: "No Labels / End of Reel",
      26: "Loop Buffer Fault at Feed Unit",
      27: "Invalid Sensor Status Loop Buffer",
      28: "Rewinder Web Jam",
      29: "Rewinder Web Break After Head",
      30: "Labeler Encoder Fault"
    });

    function code(number) { return String(number).padStart(5, "0"); }
    function makeEntry(number, summary, aliases = []) {
      return Object.freeze({
        id: `apl-cart-${code(number)}`,
        code: code(number),
        number,
        category: "APL Cart / Label Web & Encoder",
        aliases: Object.freeze([`fault ${number}`, `apl cart ${number}`, TITLES[number], ...aliases]),
        title: TITLES[number],
        summary,
        probableCauses: Object.freeze(["Use the source-backed producer/state chain below and preserve alarm chronology before replacing hardware."]),
        checks: Object.freeze(["Capture the raw states, counters/timers, and machine mode shown in the APL Cart isolation panel before reset.", "Treat source constants as PLC sequence evidence, not ServoForge tuning recommendations."]),
        actions: Object.freeze(["Correct only the producer condition supported by the live evidence, then verify the alarm remains clear through normal guarded operation."]),
        safety: SAFETY,
        sourceRefs: Object.freeze([{ sourceId: SOURCE_ID, locator: `CO85_LB1_APLCart_1.L5K — Fault ${code(number)} source chain` }]),
        contextHints: Object.freeze(["apl", "cart", "labeling station", "label web"])
      });
    }

    const ENTRIES = Object.freeze([
      makeEntry(21, "Fault 00021 is latched inside the main-drive reference/homing state machine when required registration/home actions fail or the forward reference-run sequence completes without the expected usable reference signal. It is not represented by one standalone raw sensor bit.", ["reference run", "home failure", "missing reference"]),
      makeEntry(22, "Fault 00022 is latched from repeated label-length measurement errors and from the source's forced-autochange measurement path. The active parameter-set limits remain machine-specific and are shown as tags rather than universal numbers.", ["label length", "measurement error", "measure error"]),
      makeEntry(23, "Fault 00023 is latched when the tear-verification input remains false while labels are enabled long enough for the source's 20 ms TON_TearVerification timer to finish.", ["tear verification", "web break", "PE641"]),
      makeEntry(24, "The supplied readable export contains the exact Fault 00024 alarm text and catalog comment, but no executable reference to Faults[1].8. ServoForge keeps it searchable without inventing a producer.", ["reference sensor", "no signal"]),
      makeEntry(25, "Fault 00025 is latched by the source's configured end-of-reel detection and counter logic. Sensor routing depends on machine direction, selector state, and whether absolute end-of-reel detection is configured.", ["end of reel", "no labels", "reel empty"]),
      makeEntry(26, "Fault 00026 is generated by feed-loop supervision when the front/rear loop-buffer sensor states remain in source-defined abnormal conditions for enough PLC scans while the feed sequence is active.", ["loop buffer", "feed web fault", "feed unit"]),
      makeEntry(27, "Fault 00027 is latched when the front feed sensor is false and the rear feed sensor is true continuously through the source's 100 ms TON_SensorVerification timer.", ["sensor verification", "loop buffer sensors", "feed sensors"]),
      makeEntry(28, "Fault 00028 has two source-backed rewinder-jam producers: the rewinder timeout/two-cycle detection path and the fixed-arm timer path. Diagnose the active branch before disturbing the rewinder mechanics.", ["rewinder jam", "fixed arm", "rewinder timeout"]),
      makeEntry(29, "Fault 00029 is latched when the rewinder is enabled and the computed rewinder feedback remains above the source decision level long enough for WebBreakTime to exceed 1000 PLC cycles, unless Run Without Labels is active.", ["web break after head", "rewinder web break", "WebBreakTime"]),
      makeEntry(30, "Fault 00030 is the APL Cart base-machine encoder monitoring alarm. The source can latch it from a delayed registration-position discrepancy or directly from clock-pulse polarity occurring in the wrong master-position window while the encoder is homed.", ["base machine encoder monitoring", "OPTO131", "encoder fault"])
    ]);

    const PLANS = Object.freeze({
      21: Object.freeze({
        family: "Main-drive reference / homing state machine",
        status: "exact-plc-producer-family",
        producer: "MainDrive reference-run state-machine MAH/MAR error or missing-reference branches -> OTL Faults[1].5",
        sourceRefs: Object.freeze(["L5K 14576: reference-run requests and Faults[1].5 interlock", "L5K 14618 / 14626 / 14672: MAH/MAR reference-run fault branches latch Faults[1].5", "L5K 17222-17226: Fault 021 reset / machine-enable inhibit"]),
        watchPoints: freezeRows([
          watch("RefRunForwardRequest / LabelingData.RefRunDirectionForward", "Reference-run request/direction", "Selects the forward reference-run path in the main-drive state machine.", "Confirm which reference-run direction/path was requested."),
          watch("MainDrive.MTags.MAH[0..2].EN / .PC / .DN / .ER", "Home/reference instructions", "Several MAH completion/error branches can latch Fault 00021.", "Preserve the first MAH error/completion state before reset."),
          watch("MainDrive.MTags.MAR[0..1].PC / MainDriveAxis.Registration1Position", "Registration capture", "The state machine uses registration position capture to decide whether the reference sequence can advance.", "A missing/invalid registration event is stronger evidence than replacing the main drive."),
          watch("Faults[1].5 / MainDrive.SData.Status.Axis_Is_Homed", "Fault / homed state", "Fault 00021 removes the homed state and inhibits machine jog/on.", "Do not force Axis_Is_Homed or the fault bit.")
        ]),
        steps: freezeRows([
          step(1, "Preserve the reference-run state", "Capture requested direction and the active MainDrive.Std.SM1 state before reset."),
          step(2, "Read MAH/MAR instruction status", "Identify the first .ER, missing .PC, or unexpected completion branch that prevented a valid reference."),
          step(3, "Separate sequence from hardware", "Only move to the physical reference-signal path after the state-machine evidence shows the expected registration signal did not arrive.")
        ]),
        observations: Object.freeze([
          observe("instructionError", "Any active MAH reference instruction .ER?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")]),
          observe("registrationCaptured", "Expected MAR/registration position captured?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")])
        ])
      }),
      22: Object.freeze({
        family: "Label-length measurement quality supervision",
        status: "exact-plc-producer",
        producer: "MeasureError -> CountLabelLengthBad -> parameter-set limit / forced-autochange path -> OTL Faults[1].6",
        sourceRefs: Object.freeze(["L5K 14900: MeasureError bad/good counters and ParLS_Actual.Par1[22] fault threshold", "L5K 14901: forced-autochange measurement branch via ParLS_Actual.Par1[19]", "L5K 17228-17232: Fault 022 reset / enable inhibit"]),
        watchPoints: freezeRows([
          watch("MeasureError", "Current label-length measurement result", "True increments CountLabelLengthBad; false clears the bad count and builds good measurements.", "Diagnose why measurement is invalid before changing recipe parameters."),
          watch("CountLabelLengthBad / CountLabelLengthGood", "Consecutive measurement quality", "Repeated bad measurements can reach the active parameter-set limit and latch Fault 00022.", "These are sequence counters, not replacement criteria."),
          watch("ParLS_Actual.Par1[22] / Par1[19]", "Active parameter-set limits", "The PLC compares the bad-count value against these active recipe parameters.", "Do not publish or recommend universal values; verify the current approved recipe."),
          watch("PulseCheckAndCalcPrintMark / Warnings[0].12", "Measurement cycle / warning", "Shows whether the measurement check is being executed and whether bad measurements are accumulating.", "Preserve warning chronology before reset.")
        ]),
        steps: freezeRows([
          step(1, "Confirm MeasureError", "Verify whether the live measurement path is actually reporting an error on each check cycle."),
          step(2, "Compare counters to the active recipe", "Read CountLabelLengthBad and the machine's current Par1[22]/Par1[19] values without changing them."),
          step(3, "Localize the measurement cause", "Use the sensor/print-mark and label-path evidence that caused MeasureError; do not treat the counter threshold itself as the fault cause.")
        ]),
        observations: Object.freeze([
          observe("measureError", "MeasureError", [choice("yes", "Active"), choice("no", "Clear"), choice("unknown", "Not verified")]),
          observe("badCountAtLimit", "CountLabelLengthBad at/above active recipe limit?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")])
        ])
      }),
      23: Object.freeze({
        family: "Tear-verification sensor supervision",
        status: "exact-plc-producer",
        producer: "XIO(E5701_PE641_TearVerification / I0005.3) AND XIO(RunWithoutLabels) -> TON_TearVerification 20 ms -> OTL Faults[1].7",
        sourceRefs: Object.freeze(["L5K 1698: E5701_PE641_TearVerification = I0005.3", "L5K 17096: TON_TearVerification preset 20 ms", "L5K 17234-17238: Fault 00023 producer"]),
        watchPoints: freezeRows([
          watch("E5701_PE641_TearVerification / I0005.3", "Tear-verification input", "False starts the tear-verification timer when labels are enabled.", "Check the raw input and web condition together."),
          watch("PV_General.RunWithoutLabels", "Mode inhibit", "When active, the fault is reset/inhibited.", "Do not use Run Without Labels as a fault-clearing bypass."),
          watch("TON_TearVerification.ACC / .DN", "Tear-verification timer", "Preset is 20 ms in this source revision.", "Source timing is sequence evidence, not a value to change."),
          watch("Faults[1].7", "Fault latch", "Timer done latches Fault 00023 and removes machine jog/on enables.", "Reset only after the sensor/web condition is healthy.")
        ]),
        steps: freezeRows([
          step(1, "Read PE641", "Verify the raw tear-verification input before touching the web path."),
          step(2, "Observe the timer", "If the input stays false, confirm TON_TearVerification reaches done."),
          step(3, "Inspect safely", "If PLC evidence points to a real web/sensor issue, isolate the machine before hands-on web or sensor work.")
        ]),
        observations: Object.freeze([
          observe("sensor", "E5701_PE641_TearVerification", [choice("1", "1 / true"), choice("0", "0 / false"), choice("unknown", "Not verified")]),
          observe("timerDone", "TON_TearVerification.DN", [choice("yes", "Done"), choice("no", "Not done"), choice("unknown", "Not verified")])
        ])
      }),
      24: Object.freeze({
        family: "Reference-sensor alarm catalog entry",
        status: "catalog-only-no-producer",
        producer: "No executable reference to Faults[1].8 found in the supplied readable export.",
        sourceRefs: Object.freeze(["L5K COMMENT[1].8: Fault 024 reference sensor no signal", "L5K HMI text: 00024 REFERENCE SENSOR NO SIGNAL", "No Faults[1].8 executable reference found in the supplied export"]),
        watchPoints: freezeRows([
          watch("Faults[1].8", "Expected fault location", "The alarm catalog assigns Fault 024 to bit 1.8.", "No executable producer is present in this export; do not infer one from a nearby reference-run signal.")
        ]),
        steps: freezeRows([
          step(1, "Preserve the alarm identity", "The HMI text and fault-array comment are source-backed."),
          step(2, "Do not invent the producer", "Use the live controller/revision or another readable station source to locate the actual Faults[1].8 writer before publishing a diagnostic chain.")
        ]),
        observations: Object.freeze([])
      }),
      25: Object.freeze({
        family: "End-of-reel / no-label detection",
        status: "exact-plc-producer-with-configuration-dependent-routing",
        producer: "Configured end-of-reel sensor routing -> InputDetectEndOfReel1/2 -> CtuEndOfReel1/2 active recipe presets -> OTL Faults[1].9 when not RunWithoutLabels",
        sourceRefs: Object.freeze(["L5K 1694/1696/1703: PE631, PE632 absolute sensor, and selector input aliases", "L5K 17240-17270: absolute/non-absolute direction-dependent routing and end-of-reel fault latch", "L5K 17264: non-absolute 2000 ms off-delay used in sensor routing"]),
        watchPoints: freezeRows([
          watch("ParLS_Actual.Par1[27]", "End-of-reel configuration", "Selects absolute vs non-absolute detection logic in this source.", "Treat this as machine/recipe configuration; do not change it to clear a fault."),
          watch("E5701_PE631 / E5701_PE632_abs / E5701_SS631", "Raw reel sensors / selector", "The PLC routes these inputs differently according to main-drive direction and installed detection mode.", "Do not assume one fixed sensor polarity across configurations."),
          watch("InputDetectEndOfReel1 / InputDetectEndOfReel2", "Normalized detection states", "These are the internal states actually counted after direction/configuration routing.", "Use these before condemning a raw sensor."),
          watch("LabelingData.CtuEndOfReel1 / CtuEndOfReel2", "End-of-reel counters", "Counter presets come from ParLS_Actual.Par1[20]/[21].", "Recipe values are machine-specific and not ServoForge universal limits."),
          watch("PV_General.RunWithoutLabels / Faults[1].9", "Mode inhibit / fault latch", "The source latches 00025 only when Run Without Labels is not active.", "Do not use the mode as a bypass for a real label-web fault.")
        ]),
        steps: freezeRows([
          step(1, "Identify installed detection mode", "Read Par1[27], direction, and selector state before interpreting either raw end-of-reel sensor."),
          step(2, "Compare raw to normalized states", "Trace PE631/PE632 into InputDetectEndOfReel1/2."),
          step(3, "Observe counter completion", "Determine which normalized channel is accumulating toward its current recipe preset and why.")
        ]),
        observations: Object.freeze([
          observe("normalizedMissing", "Either normalized InputDetectEndOfReel channel indicating missing reel?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")]),
          observe("counterDone", "Associated end-of-reel counter done?", [choice("yes", "Done"), choice("no", "Not done"), choice("unknown", "Not verified")])
        ])
      }),
      26: Object.freeze({
        family: "Feed loop-buffer web supervision",
        status: "exact-plc-producer",
        producer: "Feed-loop front/rear sensor scan counters during active MainDrive sequence -> CountRearCovered >20 OR CountFrontFree >4 -> OTL Faults[1].10",
        sourceRefs: Object.freeze(["L5K 1690/1692: PE621 front = I0005.28; PE622 rear = I0005.29", "L5K 17448: rear-covered scan counter >20 latches Fault 00026", "L5K 17454: front-free scan counter >4 latches Fault 00026"]),
        watchPoints: freezeRows([
          watch("E5701_PE621_FeedUnitFront / I0005.28", "Front loop-buffer sensor", "False during the monitored sequence increments CountFrontFree.", "Interpret with the actual web position."),
          watch("E5701_PE622_FeedUnitRear / I0005.29", "Rear loop-buffer sensor", "True during the monitored sequence increments CountRearCovered.", "Interpret with the actual web position."),
          watch("CountFrontFree / CountRearCovered", "PLC scan counters", "The source latches 00026 above 4 or 20 scans respectively under the active sequence conditions.", "These are PLC-cycle counts, not milliseconds and not tuning recommendations."),
          watch("MainDrive.Std.SM1.10 / .13 / .31", "Sequence gating", "The counters run only in the source-defined main-drive sequence state with state-change gating.", "If the sequence is not active, do not diagnose the sensors from stale counts."),
          watch("PV_General.RunWithoutLabels", "Mode inhibit", "Counters are only accumulated when Run Without Labels is false.", "Do not use the mode to bypass an active web fault.")
        ]),
        steps: freezeRows([
          step(1, "Capture both loop-buffer sensors", "Read PE621 and PE622 together while the monitored feed sequence is active."),
          step(2, "Observe the scan counters", "Identify whether front-free or rear-covered supervision is the branch reaching the source threshold."),
          step(3, "Inspect the web path safely", "After PLC localization, isolate the machine before correcting web routing, sensor alignment, or feed mechanics.")
        ]),
        observations: Object.freeze([
          observe("front", "PE621 front sensor", [choice("1", "1 / true"), choice("0", "0 / false"), choice("unknown", "Not verified")]),
          observe("rear", "PE622 rear sensor", [choice("1", "1 / true"), choice("0", "0 / false"), choice("unknown", "Not verified")])
        ])
      }),
      27: Object.freeze({
        family: "Feed loop-buffer sensor plausibility",
        status: "exact-plc-producer",
        producer: "XIO(PE621 front) AND XIC(PE622 rear) -> TON_SensorVerification 100 ms -> OTL Faults[1].11",
        sourceRefs: Object.freeze(["L5K 17414: TON_SensorVerification preset 100 ms", "L5K 17452: PE621 false + PE622 true -> timer done -> Fault 00027"]),
        watchPoints: freezeRows([
          watch("E5701_PE621_FeedUnitFront / I0005.28", "Front feed sensor", "False is one half of the invalid sensor combination.", "Read raw input."),
          watch("E5701_PE622_FeedUnitRear / I0005.29", "Rear feed sensor", "True is the other half of the invalid sensor combination.", "Read raw input."),
          watch("TON_SensorVerification.ACC / .DN", "Plausibility timer", "Preset is 100 ms in this source revision.", "Timer value is source evidence, not a value to change."),
          watch("Faults[1].11", "Fault latch", "Timer done latches Fault 00027.", "Resolve the contradictory sensor/web state before reset.")
        ]),
        steps: freezeRows([
          step(1, "Read PE621 and PE622 together", "Confirm whether the exact false/true combination is present."),
          step(2, "Confirm timer completion", "If the combination persists, TON_SensorVerification should reach done."),
          step(3, "Separate web position from sensor failure", "Verify actual web position before replacing either photoeye.")
        ]),
        observations: Object.freeze([
          observe("front", "PE621 front sensor", [choice("1", "1 / true"), choice("0", "0 / false"), choice("unknown", "Not verified")]),
          observe("rear", "PE622 rear sensor", [choice("1", "1 / true"), choice("0", "0 / false"), choice("unknown", "Not verified")]),
          observe("timerDone", "TON_SensorVerification.DN", [choice("yes", "Done"), choice("no", "Not done"), choice("unknown", "Not verified")])
        ])
      }),
      28: Object.freeze({
        family: "Rewinder jam / fixed-arm supervision",
        status: "exact-plc-producer-two-branch",
        producer: "Rewinder timeout/two-cycle detection OR FixedArm.DN -> OTL Faults[1].12",
        sourceRefs: Object.freeze(["L5K 17920: RewinderTimeout described as PLC-cycle count", "L5K 18048/18053: timeout + two-cycle web-jam producer", "L5K 17880 / 18064 / 18070: dynamic FixedArm timer path can latch Fault 00028"]),
        watchPoints: freezeRows([
          watch("Rewinder.enable / Rewinder.dx / Rewinder.yi", "Rewinder control state", "The timeout branch requires the rewinder enabled, dx below -2000, and yi >= 0 during the start-next-cam pulse.", "Source numeric values describe this PLC revision; do not tune them from ServoForge."),
          watch("RewinderTimeout / StorePulseOneCycWithWebJam / StorePulseTwoCycWithWebJam", "Timeout/two-cycle branch", "RewinderTimeout >100 plus the two-cycle storage sequence can latch 00028.", "RewinderTimeout is explicitly a PLC-cycle counter, not milliseconds."),
          watch("FixedArm.ACC / .DN / FixedArmTest", "Fixed-arm branch", "FixedArm.DN independently latches 00028; the preset is selected dynamically by rewinder position.", "Do not change the 500/2000 ms source presets to clear a jam."),
          watch("Faults[1].12", "Fault latch", "Either producer branch can set the same visible alarm.", "Identify which branch occurred first before hands-on work.")
        ]),
        steps: freezeRows([
          step(1, "Determine the producer branch", "Check RewinderTimeout/two-cycle state and FixedArm.DN before reset."),
          step(2, "Capture rewinder position/control evidence", "Record enable, dx, yi, and fixed-arm state so a mechanical jam is not confused with control-state history."),
          step(3, "Isolate before mechanical inspection", "LOTO/stored-energy controls apply before touching web, arm, core, or rewind mechanics.")
        ]),
        observations: Object.freeze([
          observe("timeoutBranch", "Timeout/two-cycle jam branch active?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")]),
          observe("fixedArmDone", "FixedArm.DN active?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")])
        ])
      }),
      29: Object.freeze({
        family: "Rewinder web-break-after-head supervision",
        status: "exact-plc-producer",
        producer: "Rewinder.enable AND ComputedRewindUnitActualValue >29000 -> WebBreakTime PLC-cycle count >1000 AND NOT RunWithoutLabels -> OTL Faults[1].13",
        sourceRefs: Object.freeze(["L5K 17930: WebBreakTime = count PLC cycles with fault condition", "L5K 17997: computed rewinder feedback generation", "L5K 18058: Fault 00029 producer"]),
        watchPoints: freezeRows([
          watch("Rewinder.enable", "Rewinder enabled state", "The web-break counter only builds while the rewinder is enabled.", "Confirm the command state before interpreting feedback."),
          watch("ComputedRewindUnitActualValue", "Computed rewinder feedback", "Values above the source decision level 29000 build WebBreakTime.", "29000 is an internal source decision value, not a field acceptance specification."),
          watch("WebBreakTime", "PLC-cycle counter", "The fault latches after the counter exceeds 1000 PLC cycles.", "This is not a 1000 ms timer; cycle duration depends on task execution."),
          watch("PV_General.RunWithoutLabels / Faults[1].13", "Mode inhibit / fault latch", "Run Without Labels suppresses the final latch.", "Do not use the mode as a bypass for a real web break.")
        ]),
        steps: freezeRows([
          step(1, "Verify rewinder enable", "Confirm the rewinder is supposed to be active."),
          step(2, "Observe computed feedback and cycle count", "Determine whether the high feedback condition is continuously building WebBreakTime."),
          step(3, "Inspect the web/rewinder path safely", "If the source state supports a real web-break condition, isolate before hands-on correction.")
        ]),
        observations: Object.freeze([
          observe("feedbackHigh", "ComputedRewindUnitActualValue above source decision level?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")]),
          observe("cycleCountHigh", "WebBreakTime above 1000 PLC cycles?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")])
        ])
      }),
      30: Object.freeze({
        family: "Cart base-machine encoder monitoring",
        status: "exact-plc-producer-two-branch",
        producer: "Registration-position discrepancy -> FaultEncoderMonitoring -> DelayFaultEncoderMon 50 ms OR OPTO131 clock pulse in wrong master-position window -> OTL Faults[1].14",
        sourceRefs: Object.freeze(["L5K 15008-15010: encoder state reset and BaseMachineEncoder servo-fault status", "L5K 15124: registration discrepancy -> FaultEncoderMonitoring -> 50 ms delay -> Fault 00030", "L5K 15148: OPTO131 clock-pulse/master-position window direct Fault 00030 latch"]),
        watchPoints: freezeRows([
          watch("BaseMachineEncoder.SData.Status.Axis_Is_Homed", "Encoder homed state", "Both monitoring paths are evaluated only after the Cart base-machine encoder is homed.", "Do not force the homed state."),
          watch("LabelingData.MasterEncDifRegPosition / MasterActPosDif / EncStoreMAR_RegPosition", "Registration-position comparison", "Out-of-window registration comparison sets FaultEncoderMonitoring.", "The source window values are internal software logic, not adjustment targets."),
          watch("FaultEncoderMonitoring / DelayFaultEncoderMon.ACC / .DN", "Delayed discrepancy branch", "FaultEncoderMonitoring is delayed 50 ms before latching 00030.", "Do not change the timer to mask an encoder discrepancy."),
          watch("E2001_OPTO131_ClockPulse / LabelingData.MasterActualPositionUsed", "Clock-pulse position branch", "Specific pulse polarity in the wrong master-position windows directly latches 00030.", "This is the Cart OPTO131/base-machine encoder path, not Station 00067 AQB feedback and not main Labeler Fault 670 fine-clock monitoring."),
          watch("BaseMachineEncoder.SData.Status.Faulted", "Axis servo-fault status", "A non-zero BaseMachineEncoderAxis.ServoFault marks the axis faulted and resets the encoder state machine.", "This is related axis evidence; it is separate from the two direct Faults[1].14 producers above.")
        ]),
        steps: freezeRows([
          step(1, "Keep fault namespaces separate", "APL Cart 00030 is not Cart-local 00067 FeedbackFault and not main Labeler 670 Fine Clock Pulse Monitoring."),
          step(2, "Identify the producer branch", "Check whether FaultEncoderMonitoring/delay completed or whether the OPTO131 pulse-position window directly latched the fault."),
          step(3, "Use source-specific hardware tracing", "Only after producer isolation should qualified troubleshooting move into the Cart base-machine encoder/clock-pulse circuit.")
        ]),
        observations: Object.freeze([
          observe("delayedBranch", "FaultEncoderMonitoring / DelayFaultEncoderMon.DN active?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")]),
          observe("clockWindowBranch", "OPTO131 pulse-position window branch observed?", [choice("yes", "Yes"), choice("no", "No"), choice("unknown", "Not verified")])
        ])
      })
    });

    function evaluate(number, observation = {}) {
      const n = Number(number);
      if (!SUPPORTED.includes(n)) return null;
      if (n === 24) return result("source-gap", "hold", "Producer unresolved in this export", "Fault 00024 is catalog/HMI-proven, but this readable PLC export contains no executable writer for Faults[1].8.", "Verify the live controller/revision before publishing a producer chain.");
      if (n === 21) {
        if (observation.instructionError === "yes") return result("reference-instruction-error", "direct", "Reference instruction error is active", "An MAH reference instruction error is direct state-machine evidence for the 00021 branch.", "Capture the exact instruction/index error and its preceding state before reset.");
        if (observation.registrationCaptured === "no") return result("reference-not-captured", "direct", "Expected registration was not captured", "The reference-run sequence lacks the expected registration evidence.", "Trace the reference/registration signal path used by the active direction.");
      }
      if (n === 22 && observation.measureError === "yes" && observation.badCountAtLimit === "yes") return result("measurement-threshold", "direct", "Repeated measurement errors reached the active recipe limit", "The source-backed bad-measurement path is sufficient to latch 00022.", "Localize why MeasureError is active; do not change the limit merely to clear the fault.");
      if (n === 23 && observation.sensor === "0" && observation.timerDone === "yes") return result("tear-sensor-timeout", "direct", "Tear-verification producer is active", "PE641 is false and the 20 ms source timer is done.", "Inspect the web/sensor path under the approved safe-work procedure.");
      if (n === 25 && observation.normalizedMissing === "yes" && observation.counterDone === "yes") return result("end-reel-count", "direct", "End-of-reel counter branch is complete", "A normalized missing-reel state has completed its configured counter path.", "Confirm which raw sensor/configuration routed into that normalized channel.");
      if (n === 26 && (observation.front === "0" || observation.rear === "1")) return result("loop-buffer-state", "observe", "Loop-buffer sensor state can build the web-fault counters", "The observed sensor state matches one of the source counter conditions, but sequence gating and counter values still decide the fault.", "Read CountFrontFree/CountRearCovered and MainDrive sequence state.");
      if (n === 27 && observation.front === "0" && observation.rear === "1" && observation.timerDone === "yes") return result("invalid-sensor-combination", "direct", "Invalid loop-buffer sensor combination is proven", "PE621 is false, PE622 is true, and the 100 ms verification timer is done.", "Verify actual web position, then isolate the sensor/web cause.");
      if (n === 28) {
        if (observation.timeoutBranch === "yes") return result("rewinder-timeout", "direct", "Rewinder timeout/two-cycle branch is active", "The source timeout branch can latch 00028.", "Capture RewinderTimeout, dx, yi, and the pulse-store bits before reset.");
        if (observation.fixedArmDone === "yes") return result("fixed-arm", "direct", "Fixed-arm branch is active", "FixedArm.DN independently latches Fault 00028.", "Isolate the machine before inspecting rewinder arm/core/web mechanics.");
      }
      if (n === 29 && observation.feedbackHigh === "yes" && observation.cycleCountHigh === "yes") return result("web-break-after-head", "direct", "Rewinder web-break producer is active", "Computed rewinder feedback is above the source decision level and WebBreakTime exceeded 1000 PLC cycles.", "Confirm actual web condition and rewinder feedback under the approved procedure.");
      if (n === 30) {
        if (observation.delayedBranch === "yes") return result("encoder-registration", "direct", "Delayed encoder-registration branch is active", "FaultEncoderMonitoring / DelayFaultEncoderMon identifies the registration-position discrepancy path.", "Trace the Cart base-machine encoder registration/position evidence.");
        if (observation.clockWindowBranch === "yes") return result("encoder-clock-window", "direct", "Clock-pulse position branch is active", "OPTO131 pulse state occurred in a source-defined wrong master-position window.", "Trace the Cart OPTO131/base-machine encoder path; do not redirect to 00067 or 670.");
      }
      const values = Object.values(observation);
      if (!values.length || values.every((value) => !value || value === "unknown")) return null;
      return result("incomplete", "hold", "More live evidence is needed", "The observations do not yet prove the direct source producer.", "Complete the remaining watchpoints and preserve chronology before replacing hardware.");
    }

    function getPlan(value) {
      let number = Number(value);
      if (!Number.isInteger(number)) {
        const q = base.normalize(value).replaceAll(" ", "");
        const entry = ENTRIES.find((row) => base.normalize(row.code).replaceAll(" ", "") === q || base.normalize(row.id) === base.normalize(value));
        number = Number(entry?.number);
      }
      if (!SUPPORTED.includes(number)) return null;
      const plan = PLANS[number];
      return Object.freeze({ ...plan, id: `apl-cart-web-${code(number)}`, number, code: code(number), title: TITLES[number], scope: "LB1 APL Cart 1 / CO85_LB1_APLCart_1_V35", source, safety: SAFETY });
    }

    function webScore(entry, query, context = {}) {
      const q = base.normalize(query);
      if (!q) return 0;
      const compact = q.replaceAll(" ", "");
      const codeCompact = base.normalize(entry.code).replaceAll(" ", "");
      const text = base.normalize([entry.code, entry.title, entry.summary, ...(entry.aliases || [])].join(" "));
      let score = compact === codeCompact ? 1000 : 0;
      if (base.normalize(entry.title).includes(q)) score += 80;
      for (const term of q.split(" ").filter((term) => term.length > 1)) if (text.includes(term)) score += 8;
      if (score <= 0) return 0;
      if (base.normalize(context.applicationMode) === "apl") score += 20;
      return score;
    }

    const baseSearchEntries = base.searchEntries.bind(base);
    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const local = ENTRIES.map((entry) => ({ ...entry, searchScore: webScore(entry, query, context) })).filter((entry) => entry.searchScore > 0);
      const existing = baseSearchEntries(query, context, Math.max(count, 8));
      const merged = [...local, ...existing].sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0) || a.title.localeCompare(b.title));
      const seen = new Set();
      return merged.filter((entry) => !seen.has(entry.id) && seen.add(entry.id)).slice(0, count);
    }

    const entries = Object.freeze([...base.entries, ...ENTRIES]);
    const existingSource = base.sources?.find?.((row) => row.id === SOURCE_ID);
    const sources = existingSource && Array.isArray(base.sources)
      ? Object.freeze(base.sources.map((row) => row.id === SOURCE_ID ? Object.freeze({ ...row, topics: Object.freeze([...new Set([...(row.topics || []), "label web", "reference run", "end of reel", "loop buffer", "rewinder", "base machine encoder"])]), notes: "Primary readable executable authority for the imported LB1 APL Cart 1 fault families through Fault 030. Equivalent behavior on other carts is not assumed unless their controller source is verified." }) : row))
      : base.sources;

    function getEntry(id) { return ENTRIES.find((entry) => entry.id === String(id || "")) || base.getEntry(id); }
    function getSource(id) { return id === SOURCE_ID && Array.isArray(sources) ? (sources.find((row) => row.id === id) || source) : base.getSource(id); }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      SUPPORTED.forEach((number) => {
        const entry = getEntry(`apl-cart-${code(number)}`);
        const plan = getPlan(number);
        if (!entry || entry.code !== code(number)) errors.push(`APL Cart web-handling Fault ${code(number)} entry is missing.`);
        if (!plan?.producer || !plan?.status) errors.push(`APL Cart web-handling Fault ${code(number)} plan is incomplete.`);
      });
      if (getPlan(24)?.status !== "catalog-only-no-producer") errors.push("APL Cart Fault 00024 must remain catalog-only until its executable producer is verified.");
      if (!/1000 PLC cycles/i.test(getEntry("apl-cart-00029")?.summary || "")) errors.push("APL Cart Fault 00029 must preserve PLC-cycle wording.");
      if (!/not Station 00067|not.*00067/i.test(getPlan(30)?.watchPoints?.map((row) => row.caution).join(" ") || "")) errors.push("APL Cart Fault 00030 must stay separated from Station 00067.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({ ...base, version: `${base.version}+apl-cart-web-handling-v361`, entries, sources, getEntry, getSource, searchEntries, getAplCartWebHandlingPlan: getPlan, evaluateAplCartWebHandling: evaluate, aplCartWebHandlingFaults: SUPPORTED, validate });
  };
});
