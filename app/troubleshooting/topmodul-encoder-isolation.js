"use strict";

(function installTopModulEncoderIsolation(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulEncoderIsolationExtension() {
  return function extendLibrary(base) {
    if (!base?.getStationFaultTemplate || !base?.getStationFaultVariant || !base?.getTopModulFault || !base?.searchEntries) {
      throw new Error("TopModul Station encoder/source bridge layers are required before encoder isolation.");
    }

    const FIELD_IDS = new Set([
      "topmodul-00067-labeler-encoder-feedback",
      "topmodul-00067-no-feedback-while-moving",
      "topmodul-00067-intermittent-feedback",
      "topmodul-00067-secondary-no-motion"
    ]);
    const ENCODER_OFFSETS = Object.freeze([64, 65, 66, 67, 68, 69]);
    const SUBTYPES = Object.freeze({
      64: Object.freeze({ key: "module", label: "Module Fault", producer: "BaseMachineEncoderAxis.ModuleFault", priority: "module-status-first" }),
      65: Object.freeze({ key: "hardware", label: "Module Hardware Fault", producer: "BaseMachineEncoderAxis.ModuleHardwareFault", priority: "module-hardware-first" }),
      66: Object.freeze({ key: "sync", label: "Module Sync Fault", producer: "BaseMachineEncoderAxis.ModuleSyncFault", priority: "module-synchronization-first" }),
      67: Object.freeze({ key: "feedback", label: "Feedback Fault", producer: "BaseMachineEncoderAxis.FeedbackFault", priority: "feedback-path-after-motion-confirmed" }),
      68: Object.freeze({ key: "noise", label: "Feedback Noise Fault", producer: "BaseMachineEncoderAxis.FeedbackNoiseFault", priority: "signal-integrity-first" }),
      69: Object.freeze({ key: "timer", label: "Timer Event Fault", producer: "BaseMachineEncoderAxis.TimerEventFault", priority: "module-event-timing-first" })
    });
    const MAIN_670_SOURCE = Object.freeze({
      sourceId: "CO85_LB1_Labeler_1online.L5K",
      sourceType: "PLC export",
      faultNumber: 670,
      faultAddress: "Faults_LB1[41].14",
      rawFineClockInput: "E1701_ENC101_FineClockPulse / Local:7:I.Data.0",
      fineClockDescription: "Encoder Fine Clock Pulse (10 Per Pitch)",
      counter: "ElectrBrake.Counter.ACC",
      sampleWindow: "ElectrBrake.Timer.ACC >= 1000 ms",
      speedCalculation: "ElectrBrake.SpeedActVal = ElectrBrake.Counter.ACC * 360 * 1000 / ElectrBrake.Timer.ACC",
      zeroSpeed: "ElectrBrake.SpeedActVal <= 0 -> ElectrBrake.ZeroSpeed",
      driveEnable: "E2001_AFD101_MainDriveEnable -> ElectrBrake.I_DriveEnable",
      monitoringDisable: "Logic_0 -> ElectrBrake.I_DisableClockPulseMonitoring (Logic_0 = 0 in supplied export)",
      supervision: "I_DriveEnable AND ZeroSpeed AND NOT I_DisableClockPulseMonitoring -> FinePulseCon 3000 ms -> O_FinePulseFault",
      latch: "ElectrBrake.O_FinePulseFault -> OTL E2001_M_ElectrBrakeFaultEncoder",
      faultOutput: "E2001_M_ElectrBrakeFaultEncoder AND NOT Labeler_Modulation_Timer_1.DN AND Labeler_Modulation_Timer_Delay.DN -> Faults_LB1[41].14",
      reset: "E1101_PB201_ResetSafetyCircuitFault -> OTU E2001_M_ElectrBrakeFaultEncoder",
      sourceRefs: Object.freeze([
        "L5K 3752: E1701_ENC101_FineClockPulse = Local:7:I.Data.0",
        "L5K 4874-4875: Logic_0 = 0",
        "L5K 27479: FinePulseCon.PRE = 3000 ms",
        "L5K 27486-27493: >=1000 ms speed sample and ZeroSpeed derivation",
        "L5K 27499: DriveEnable + ZeroSpeed + monitoring-enable fine-pulse supervision",
        "L5K 27579: encoder fault latch/reset and Faults_LB1[41].14 output gating",
        "L5K 28073-28076: fine-clock hardware input increments ElectrBrake.Counter",
        "L5K 4362: Fault 670 = Safety Circuit Fault Fine Clock Pulse Monitoring"
      ])
    });
    const MAIN_670_LIVE_CHECKS = Object.freeze([
      Object.freeze({ order: 1, signal: "E2001_AFD101_MainDriveEnable / ElectrBrake.I_DriveEnable", purpose: "Confirm the supervision is legitimately enabled by main-drive state." }),
      Object.freeze({ order: 2, signal: "E1701_ENC101_FineClockPulse", purpose: "Observe the raw Local:7:I.Data.0 fine-clock hardware input." }),
      Object.freeze({ order: 3, signal: "ElectrBrake.Counter.ACC", purpose: "Confirm raw fine-clock transitions are reaching the speed-detection counter." }),
      Object.freeze({ order: 4, signal: "ElectrBrake.SpeedActVal / ElectrBrake.ZeroSpeed", purpose: "Confirm the >=1000 ms sample produces the expected motion/zero-speed state." }),
      Object.freeze({ order: 5, signal: "ElectrBrake.FinePulseCon.ACC / .DN", purpose: "See whether the 3000 ms fine-pulse timer is accumulating while motion should be present." }),
      Object.freeze({ order: 6, signal: "ElectrBrake.O_FinePulseFault / E2001_M_ElectrBrakeFaultEncoder", purpose: "Separate supervision output from the memorized encoder-fault latch." }),
      Object.freeze({ order: 7, signal: "Faults_LB1[41].14", purpose: "Confirm the final Fault 670 HMI bit after Labeler modulation gating." })
    ]);

    const OBSERVE = "Use normal HMI/PLC/motion-axis diagnostics only. Do not force motion-axis status, encoder inputs, station fault bits, or Cart-to-Labeler transport words.";
    const LOTO = "Prevent unexpected Station/servo motion and follow site LOTO/stored-energy requirements before hands-on encoder, CN131/W131, module, connector, or cabinet work.";
    const ELECTRICAL = "Energized electrical/signal measurements are for qualified personnel under the site's approved electrical safe-work procedure.";

    function stationCoordinates(number) {
      const n = Number(number);
      if (!Number.isInteger(n) || n < 1024 || n >= 1504) return null;
      const station = Math.floor((n - 1024) / 80) + 1;
      const offset = (n - 1024) % 80;
      if (station < 1 || station > 6 || !ENCODER_OFFSETS.includes(offset)) return null;
      return { station, offset };
    }

    function resolveEntry(value) {
      if (value && typeof value === "object" && value.id) return value;
      const raw = String(value ?? "").trim();
      if (raw === "00067") {
        return base.searchEntries("00067", { machineType: "TopModul" }, 5)
          .find((entry) => entry?.id === "topmodul-00067-labeler-encoder-feedback") || null;
      }
      if (/^\d+$/.test(raw)) return base.getTopModulFault(Number(raw));
      return base.getEntry?.(raw) || base.searchEntries(raw, { machineType: "TopModul" }, 3)[0] || null;
    }

    function siblingRows(station) {
      if (!station) {
        return ENCODER_OFFSETS.map((offset) => Object.freeze({ offset, localCode: String(offset).padStart(3, "0"), number: null, title: SUBTYPES[offset].label }));
      }
      return ENCODER_OFFSETS.map((offset) => {
        const variant = base.getStationFaultVariant(offset, station);
        return Object.freeze({ offset, localCode: String(offset).padStart(3, "0"), number: Number(variant?.number), title: variant?.title || SUBTYPES[offset].label, address: variant?.plcFault?.address || "" });
      });
    }

    function evaluateStationFeedback(observation = {}) {
      const motion = String(observation.motion || "unknown");
      const feedback = String(observation.feedback || "unknown");
      if (motion === "no") return Object.freeze({
        code: "resolve-no-motion-first",
        severity: "hold",
        title: "Actual encoder motion is not present",
        summary: "Do not condemn the AQB feedback path yet. Resolve the upstream no-motion / inhibit / drive condition first, then reproduce 00067 only if motion is expected and feedback supervision still faults.",
        next: "Review alarm chronology and the first drive, readiness, safety, or station fault that removed motion."
      });
      if (motion !== "yes") return Object.freeze({
        code: "confirm-motion",
        severity: "observe",
        title: "Confirm actual motion first",
        summary: "The feedback fault becomes much more diagnostic once actual Station/base-machine encoder motion is known. Determine whether the encoder source should physically be moving before opening the feedback circuit.",
        next: "Observe commanded/actual machine state and motion-axis diagnostics without forcing outputs."
      });
      if (feedback === "frozen" || feedback === "absent") return Object.freeze({
        code: "direct-aqb-feedback-path",
        severity: "direct",
        title: "Motion is present but AQB feedback is absent/frozen",
        summary: "This supports the direct Station encoder feedback route: EEP_APL_Slot11:Ch0 / 1756-M02AE Channel 0 -> CN131 / 2001-W131 -> high-resolution CHA/CHB/CHZ source.",
        next: "Confirm the exact FeedbackFault status, then isolate connector/cable/encoder-source/module evidence under the approved safe-work boundary."
      });
      if (feedback === "intermittent" || feedback === "noisy") return Object.freeze({
        code: "feedback-signal-integrity",
        severity: "direct",
        title: "Feedback is intermittent/noisy",
        summary: "Prioritize the sibling Feedback Noise fault and signal-integrity evidence before replacing the encoder or module. CN131/W131 connection, shield/termination, intermittent source, and module channel evidence are higher-value than parameter changes.",
        next: "Check whether the station's offset-068 Feedback Noise alarm occurred before or with the Feedback Fault."
      });
      if (feedback === "changing") return Object.freeze({
        code: "status-vs-feedback-disagreement",
        severity: "observe",
        title: "AQB feedback is changing while FeedbackFault is active",
        summary: "Do not jump to encoder replacement. Compare Module, Hardware, Sync, Noise, and Timer Event siblings plus the exact axis status/chronology; an intermittent or module-level condition can preserve FeedbackFault while counts appear to move.",
        next: "Use the six-fault Station encoder family and alarm stack to find the first specific producer."
      });
      return Object.freeze({
        code: "confirm-feedback",
        severity: "observe",
        title: "Now confirm AQB feedback behavior",
        summary: "With actual motion confirmed, observe whether BaseMachineEncoderAxis feedback is changing, frozen/absent, or intermittent/noisy. That observation determines whether to stay in module status or move into the physical AQB path.",
        next: "Use normal axis diagnostics; do not force the feedback state."
      });
    }

    function evaluateMainFineClock(observation = {}) {
      const motion = String(observation.motion || "unknown");
      const fineClock = String(observation.fineClock || "unknown");
      if (motion === "no") return Object.freeze({
        code: "main-no-motion-first",
        severity: "hold",
        title: "Main machine is not moving",
        summary: "Fault 670 monitors fine-clock behavior in a machine-state context. Resolve the no-motion / main-drive / machine-stop condition before treating missing pulses as a primary encoder fault.",
        next: "Review Faults 480, 482 and 669 plus E2001_AFD101_MainDriveEnable before opening ENC101 hardware."
      });
      if (motion !== "yes") return Object.freeze({
        code: "main-confirm-motion",
        severity: "observe",
        title: "Confirm main-machine motion",
        summary: "First establish whether motion is actually occurring when the fine-clock supervision faults.",
        next: "Observe E2001_AFD101_MainDriveEnable, ElectrBrake.SpeedActVal / ZeroSpeed, and the raw fine-clock input without forcing logic."
      });
      if (fineClock === "absent" || fineClock === "frozen") return Object.freeze({
        code: "main-fine-clock-path",
        severity: "direct",
        title: "Motion is present but fine-clock pulses are absent",
        summary: "The supplied Labeler PLC export binds Fault 670 to E1701_ENC101_FineClockPulse at Local:7:I.Data.0. That hardware input increments ElectrBrake.Counter; if the raw input is frozen during verified motion, stay on the K407039 main-machine encoder/fine-clock path.",
        next: "Observe E1701_ENC101_FineClockPulse and ElectrBrake.Counter.ACC together. If both are frozen during verified motion, use the Fault 670 circuit trace to isolate ENC101 / converter / input evidence under the approved safe-work boundary."
      });
      if (fineClock === "changing") return Object.freeze({
        code: "main-supervision-timing",
        severity: "observe",
        title: "Fine-clock pulses are changing",
        summary: "Do not replace the encoder solely from Fault 670. The PLC derives ElectrBrake.SpeedActVal from the fine-clock counter after a >=1000 ms sample, sets ZeroSpeed at <=0, then requires DriveEnable + ZeroSpeed + monitoring enabled for 3000 ms before O_FinePulseFault is asserted.",
        next: "Trace ElectrBrake.Counter.ACC -> SpeedActVal -> ZeroSpeed -> FinePulseCon.ACC/.DN -> O_FinePulseFault -> E2001_M_ElectrBrakeFaultEncoder. This separates a real pulse-loss condition from derived-state or supervision timing."
      });
      return Object.freeze({
        code: "main-confirm-fine-clock",
        severity: "observe",
        title: "Confirm fine-clock pulse behavior",
        summary: "With motion present, determine whether E1701_ENC101_FineClockPulse is changing or absent/frozen before entering the physical encoder path.",
        next: "Observe the verified Local:7:I.Data.0 fine-clock input and ElectrBrake.Counter.ACC in normal diagnostics."
      });
    }

    function stationPlan(entry, station, offset, fieldObserved) {
      const subtype = SUBTYPES[offset];
      const template = base.getStationFaultTemplate(offset);
      const siblings = siblingRows(station);
      const feedbackCircuit = base.getStationFaultTemplate(67)?.circuitTrace || null;
      const steps = [
        Object.freeze({ order: 1, label: "Confirm scope", detail: fieldObserved ? "This is Cart/Station-local HMI 00067. It is not base Labeler PLC Fault 067 or Fault 670." : `This is Station ${station} local encoder offset ${String(offset).padStart(3, "0")} transported to global Fault ${entry.number}.` }),
        Object.freeze({ order: 2, label: "Read the exact axis subtype", detail: `${subtype.producer} is the producer for this Station encoder subtype. Review sibling Module/Hardware/Sync/Feedback/Noise/Timer faults in observed order.` }),
        Object.freeze({ order: 3, label: "Do not open the cable route too early", detail: offset === 67 ? "For Feedback Fault, establish actual motion and AQB feedback behavior first." : `For ${subtype.label}, diagnose the module/status meaning first; the shared CN131/W131 path is physical evidence only when the subtype supports a signal-path cause.` }),
        Object.freeze({ order: 4, label: "Physical feedback route when justified", detail: "EEP_APL_Slot11:Ch0 / 1756-M02AE Channel 0 -> CN131 / 2001-W131 -> CHA/CHB/CHZ high-resolution feedback, K605163 pages 33 and 50." }),
        Object.freeze({ order: 5, label: "Keep parallel encoder systems separate", detail: "Station local Fault 030 is OPTO131 clock monitoring. Base Labeler Fault 670 is main-machine fine-clock monitoring. Neither is the direct producer of Station local Fault 067." })
      ];
      return Object.freeze({
        id: fieldObserved ? "topmodul-encoder-isolation-live-00067" : `topmodul-encoder-isolation-${entry.number}`,
        scope: "Station / Cart encoder",
        station: station || null,
        localOffset: offset,
        subtype,
        producer: subtype.producer,
        entry,
        siblings: Object.freeze(siblings),
        steps: Object.freeze(steps),
        circuitTrace: template?.circuitTrace || feedbackCircuit,
        safety: Object.freeze([OBSERVE, LOTO, ELECTRICAL]),
        evaluate: offset === 67 ? evaluateStationFeedback : (observation = {}) => Object.freeze({
          code: subtype.priority,
          severity: "direct",
          title: `${subtype.label}: diagnose the exact module status first`,
          summary: `The direct producer is ${subtype.producer}. Use the status subtype and alarm chronology before moving into the shared AQB hardware path.`,
          next: "Open sibling encoder faults only as supporting evidence; do not collapse all six status bits into one encoder-replacement route.",
          observation: Object.freeze({ ...observation })
        })
      });
    }

    function mainPlan(entry) {
      return Object.freeze({
        id: "topmodul-encoder-isolation-main-670",
        scope: "Main Labeler encoder / fine clock",
        station: null,
        localOffset: null,
        subtype: Object.freeze({ key: "fine-clock", label: "Fine Clock Pulse Monitoring", producer: "ElectrBrake.O_FinePulseFault -> E2001_M_ElectrBrakeFaultEncoder" }),
        producer: "ElectrBrake.O_FinePulseFault -> E2001_M_ElectrBrakeFaultEncoder -> Faults_LB1[41].14 / Fault 670",
        entry,
        siblings: Object.freeze([480, 482, 669].map((number) => {
          const candidate = base.getTopModulFault(number);
          return Object.freeze({ number, title: candidate?.title || `Fault ${number}`, address: candidate?.plcFault?.address || "" });
        })),
        steps: Object.freeze([
          Object.freeze({ order: 1, label: "Confirm scope", detail: "Fault 670 belongs to the base Labeler main-machine fine-clock supervision. It is not Station/Cart HMI 00067." }),
          Object.freeze({ order: 2, label: "Confirm drive/motion state", detail: "The supplied PLC maps E2001_AFD101_MainDriveEnable into ElectrBrake.I_DriveEnable. If actual machine motion is absent, resolve the main-drive / zero-speed / machine-stop state first." }),
          Object.freeze({ order: 3, label: "Observe the raw fine-clock hardware input", detail: "CO85_LB1_Labeler_1online.L5K maps E1701_ENC101_FineClockPulse to Local:7:I.Data.0 and identifies it as the fine clock (10 per pitch). The same input increments ElectrBrake.Counter." }),
          Object.freeze({ order: 4, label: "Verify the derived speed state", detail: "After ElectrBrake.Timer.ACC reaches at least 1000 ms, the PLC calculates SpeedActVal = Counter.ACC * 360 * 1000 / Timer.ACC, clears the sample, and sets ElectrBrake.ZeroSpeed when SpeedActVal <= 0." }),
          Object.freeze({ order: 5, label: "Follow the 3000 ms supervision predicate", detail: "ElectrBrake.I_DriveEnable + ElectrBrake.ZeroSpeed + monitoring enabled starts FinePulseCon. Its preset is 3000 ms; done state produces ElectrBrake.O_FinePulseFault." }),
          Object.freeze({ order: 6, label: "Confirm the memorized 670 latch", detail: "ElectrBrake.O_FinePulseFault latches E2001_M_ElectrBrakeFaultEncoder. With the Labeler modulation gating satisfied, that bit drives Faults_LB1[41].14 (Fault 670). The safety-circuit reset push-button unlatches the memorized encoder fault." }),
          Object.freeze({ order: 7, label: "Open the physical encoder route only when supported", detail: "If verified machine motion exists but E1701_ENC101_FineClockPulse and ElectrBrake.Counter.ACC are frozen, use the K407039 Fault 670 circuit trace. Do not borrow the K605163 1756-M02AE/CN131 Station path." })
        ]),
        sourceEvidence: MAIN_670_SOURCE,
        liveChecks: MAIN_670_LIVE_CHECKS,
        circuitTrace: entry?.circuitTrace || base.getTopModulCircuitTrace?.(670) || null,
        safety: Object.freeze([OBSERVE, LOTO, ELECTRICAL]),
        evaluate: evaluateMainFineClock
      });
    }

    function getTopModulEncoderIsolationPlan(value) {
      const entry = resolveEntry(value);
      if (!entry) return null;
      if (FIELD_IDS.has(entry.id)) return stationPlan(entry, null, 67, true);
      const stationInfo = stationCoordinates(entry.number);
      if (stationInfo) return stationPlan(entry, stationInfo.station, stationInfo.offset, false);
      if (Number(entry.number) === 670) return mainPlan(entry);
      return null;
    }

    function evaluateTopModulEncoderIsolation(value, observation = {}) {
      const plan = getTopModulEncoderIsolationPlan(value);
      return plan ? plan.evaluate(observation) : null;
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const field = getTopModulEncoderIsolationPlan("00067");
      if (field?.producer !== "BaseMachineEncoderAxis.FeedbackFault") errors.push("encoder isolation lost source-proven 00067 FeedbackFault producer.");
      if (field?.scope !== "Station / Cart encoder") errors.push("encoder isolation lost 00067 Station/Cart scope.");
      const station1 = getTopModulEncoderIsolationPlan(1091);
      if (station1?.station !== 1 || station1?.localOffset !== 67) errors.push("encoder isolation lost Station 1 global 1091 -> local 067 mapping.");
      if (!station1?.siblings?.some((row) => row.number === 1088) || !station1?.siblings?.some((row) => row.number === 1093)) errors.push("encoder isolation lost Station 1 encoder sibling family.");
      const frozen = evaluateTopModulEncoderIsolation(1091, { motion: "yes", feedback: "frozen" });
      if (frozen?.code !== "direct-aqb-feedback-path") errors.push("encoder isolation must route motion-present/frozen-feedback to AQB feedback path.");
      const noMotion = evaluateTopModulEncoderIsolation("00067", { motion: "no" });
      if (noMotion?.code !== "resolve-no-motion-first") errors.push("encoder isolation must hold encoder replacement when actual motion is absent.");
      const noise = evaluateTopModulEncoderIsolation(1091, { motion: "yes", feedback: "intermittent" });
      if (noise?.code !== "feedback-signal-integrity") errors.push("encoder isolation must route intermittent feedback toward signal integrity/noise evidence.");
      const f670 = getTopModulEncoderIsolationPlan(670);
      if (f670?.scope !== "Main Labeler encoder / fine clock") errors.push("encoder isolation lost main Labeler Fault 670 scope.");
      const f670CircuitText = JSON.stringify({ source: f670?.circuitTrace?.source?.id || f670?.circuitTrace?.sourceId || "", devices: f670?.circuitTrace?.deviceRows || [] });
      if (/1756-M02AE|CN131/i.test(f670CircuitText)) errors.push("encoder isolation must not attach Station encoder hardware evidence to Fault 670.");
      if (f670?.sourceEvidence?.sourceId !== "CO85_LB1_Labeler_1online.L5K") errors.push("Fault 670 lost the supplied Labeler PLC source authority.");
      if (f670?.sourceEvidence?.faultAddress !== "Faults_LB1[41].14") errors.push("Fault 670 lost its exact PLC fault bit.");
      if (!f670?.liveChecks?.some((row) => /E1701_ENC101_FineClockPulse/.test(row.signal))) errors.push("Fault 670 lost raw fine-clock live observation checkpoint.");
      if (!f670?.liveChecks?.some((row) => /SpeedActVal.*ZeroSpeed/.test(row.signal))) errors.push("Fault 670 lost derived speed/zero-speed checkpoint.");
      if (getTopModulEncoderIsolationPlan(67)) errors.push("Base Labeler PLC Fault 067 Change Mode must not receive the Station encoder isolation workflow.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+encoder-isolation-v2`,
      getTopModulEncoderIsolationPlan,
      evaluateTopModulEncoderIsolation,
      topModulEncoderIsolationOffsets: ENCODER_OFFSETS,
      topModulMain670Source: MAIN_670_SOURCE,
      validate
    });
  };
});
