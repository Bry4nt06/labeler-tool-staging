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
        next: "Review Faults 480, 482 and 669 plus main-drive state before opening ENC101 hardware."
      });
      if (motion !== "yes") return Object.freeze({
        code: "main-confirm-motion",
        severity: "observe",
        title: "Confirm main-machine motion",
        summary: "First establish whether motion is actually occurring when the fine-clock supervision faults.",
        next: "Observe main-drive/zero-speed state and fine-clock diagnostics without forcing logic."
      });
      if (fineClock === "absent" || fineClock === "frozen") return Object.freeze({
        code: "main-fine-clock-path",
        severity: "direct",
        title: "Motion is present but fine-clock pulses are absent",
        summary: "This supports the K407039 main-machine encoder/fine-clock path for Fault 670. It is a different circuit and producer from Station HMI 00067 / BaseMachineEncoderAxis.FeedbackFault.",
        next: "Use the existing Fault 670 circuit trace and qualified diagnostics to isolate ENC101/pulse/input evidence."
      });
      if (fineClock === "changing") return Object.freeze({
        code: "main-supervision-timing",
        severity: "observe",
        title: "Fine-clock pulses are changing",
        summary: "Do not replace the encoder solely from Fault 670. Re-check the ElectricBrake/zero-speed monitoring state, 3000 ms supervision timing, and preceding main-drive/machine-stop faults.",
        next: "Use Fault 670 process evidence and chronology around 480/482/669."
      });
      return Object.freeze({
        code: "main-confirm-fine-clock",
        severity: "observe",
        title: "Confirm fine-clock pulse behavior",
        summary: "With motion present, determine whether the fine-clock signal is changing or absent/frozen before entering the physical encoder path.",
        next: "Observe the verified fine-clock input in normal diagnostics."
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
        producer: "ElectrBrake.O_FinePulseFault -> E2001_M_ElectrBrakeFaultEncoder -> Fault 670",
        entry,
        siblings: Object.freeze([480, 482, 669].map((number) => {
          const candidate = base.getTopModulFault(number);
          return Object.freeze({ number, title: candidate?.title || `Fault ${number}`, address: candidate?.plcFault?.address || "" });
        })),
        steps: Object.freeze([
          Object.freeze({ order: 1, label: "Confirm scope", detail: "Fault 670 belongs to the base Labeler main-machine fine-clock supervision. It is not Station/Cart HMI 00067." }),
          Object.freeze({ order: 2, label: "Confirm main-machine motion", detail: "If the machine is not moving, resolve the main-drive / zero-speed / machine-stop state first." }),
          Object.freeze({ order: 3, label: "Observe fine-clock pulses", detail: "With actual motion present, determine whether the verified fine-clock input is changing or absent/frozen." }),
          Object.freeze({ order: 4, label: "Use supervision timing", detail: "The ElectricBrake fine-pulse supervision uses a 3000 ms timer. Changing pulses with Fault 670 active points back toward machine-state/timing evidence rather than automatic encoder replacement." }),
          Object.freeze({ order: 5, label: "Physical main-encoder route only when supported", detail: "Use the K407039 Fault 670 circuit trace. Do not borrow the K605163 1756-M02AE/CN131 Station path." })
        ]),
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
      if (field?.producer !== "BaseMachineEncoderAxis.FeedbackFault") errors.push("v348 lost source-proven 00067 FeedbackFault producer.");
      if (field?.scope !== "Station / Cart encoder") errors.push("v348 lost 00067 Station/Cart scope.");
      const station1 = getTopModulEncoderIsolationPlan(1091);
      if (station1?.station !== 1 || station1?.localOffset !== 67) errors.push("v348 lost Station 1 global 1091 -> local 067 mapping.");
      if (!station1?.siblings?.some((row) => row.number === 1088) || !station1?.siblings?.some((row) => row.number === 1093)) errors.push("v348 lost Station 1 encoder sibling family.");
      const frozen = evaluateTopModulEncoderIsolation(1091, { motion: "yes", feedback: "frozen" });
      if (frozen?.code !== "direct-aqb-feedback-path") errors.push("v348 must route motion-present/frozen-feedback to AQB feedback path.");
      const noMotion = evaluateTopModulEncoderIsolation("00067", { motion: "no" });
      if (noMotion?.code !== "resolve-no-motion-first") errors.push("v348 must hold encoder replacement when actual motion is absent.");
      const noise = evaluateTopModulEncoderIsolation(1091, { motion: "yes", feedback: "intermittent" });
      if (noise?.code !== "feedback-signal-integrity") errors.push("v348 must route intermittent feedback toward signal integrity/noise evidence.");
      const f670 = getTopModulEncoderIsolationPlan(670);
      if (f670?.scope !== "Main Labeler encoder / fine clock") errors.push("v348 lost main Labeler Fault 670 scope.");
      if (/1756-M02AE|CN131/i.test(String(f670?.steps?.map((row) => row.detail).join(" ")))) errors.push("v348 must not borrow Station encoder hardware into Fault 670.");
      if (getTopModulEncoderIsolationPlan(67)) errors.push("Base Labeler PLC Fault 067 Change Mode must not receive the Station encoder isolation workflow.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+encoder-isolation-v1`,
      getTopModulEncoderIsolationPlan,
      evaluateTopModulEncoderIsolation,
      topModulEncoderIsolationOffsets: ENCODER_OFFSETS,
      validate
    });
  };
});
