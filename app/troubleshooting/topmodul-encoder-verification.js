"use strict";

(function installTopModulEncoderVerification(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulEncoderVerificationExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulEncoderIsolationPlan || !base?.getStationFaultVariant) {
      throw new Error("TopModul encoder-isolation and shared Station layers are required before encoder verification points.");
    }

    const FIELD_ID = "topmodul-00067-labeler-encoder-feedback";
    const OFFSETS = Object.freeze([64, 65, 66, 67, 68, 69]);
    const STATUS = Object.freeze({
      64: Object.freeze({ label: "Module Fault", tag: "BaseMachineEncoderAxis.ModuleFault", action: "Axis/module status producer" }),
      65: Object.freeze({ label: "Module Hardware Fault", tag: "BaseMachineEncoderAxis.ModuleHardwareFault", action: "Axis/module hardware-status producer" }),
      66: Object.freeze({ label: "Module Sync Fault", tag: "BaseMachineEncoderAxis.ModuleSyncFault", action: "Axis/module synchronization-status producer" }),
      67: Object.freeze({ label: "Feedback Fault", tag: "BaseMachineEncoderAxis.FeedbackFault", action: "FeedbackFaultAction = Shutdown" }),
      68: Object.freeze({ label: "Feedback Noise Fault", tag: "BaseMachineEncoderAxis.FeedbackNoiseFault", action: "FeedbackNoiseFaultAction = Status Only" }),
      69: Object.freeze({ label: "Timer Event Fault", tag: "BaseMachineEncoderAxis.TimerEventFault", action: "Axis/module timer-event status producer" })
    });

    const SOURCE = Object.freeze({
      id: "co85-lb1-apl-cart1-encoder-verification",
      file: "CO85_LB1_APLCart_1.L5K",
      controller: "CO85_LB1_APLCart_1",
      evidenceClass: "readable-cart-plc-export",
      sourceDiscipline: "Read-only runtime tags, axis configuration and their application relationships are taken directly from the supplied Cart 1 L5K. The six-position Labeler transport is shared, but identical internal tag semantics for Carts 2-6 are not claimed without their readable controller exports."
    });

    const OBSERVE = "Observe these tags through normal RSLogix/PLC diagnostics only. Do not force axis status, fault bits, motion commands, encoder inputs, or Cart-to-Labeler transport words.";
    const LOTO = "Prevent unexpected Station/servo motion and follow site LOTO/stored-energy requirements before hands-on work at the encoder source, CN131/W131, 1756-M02AE module, connectors, or cabinet.";
    const ELECTRICAL = "Energized electrical/signal measurements are for qualified personnel under the site's approved electrical safe-work procedure.";

    function stationCoordinates(number) {
      const n = Number(number);
      if (!Number.isInteger(n) || n < 1024 || n >= 1504) return null;
      const station = Math.floor((n - 1024) / 80) + 1;
      const offset = (n - 1024) % 80;
      if (station < 1 || station > 6 || !OFFSETS.includes(offset)) return null;
      return { station, offset };
    }

    function resolve(value) {
      const plan = base.getTopModulEncoderIsolationPlan(value);
      if (!plan || plan.scope !== "Station / Cart encoder") return null;
      const entry = plan.entry;
      const fieldObserved = entry?.id === FIELD_ID || /^topmodul-00067/i.test(String(entry?.id || ""));
      const coordinates = fieldObserved ? { station: plan.station || null, offset: 67 } : stationCoordinates(entry?.number);
      if (!coordinates || !OFFSETS.includes(coordinates.offset)) return null;
      return { plan, entry, fieldObserved, station: coordinates.station || null, offset: coordinates.offset };
    }

    function watchPoint(tag, role, sourceRelationship, interpretation, caution = "") {
      return Object.freeze({ tag, role, sourceRelationship, interpretation, caution });
    }

    const runtimeWatchPoints = Object.freeze([
      watchPoint(
        "BaseMachineEncoderAxis.ActualPosition",
        "Position feedback activity",
        "The Cart PLC subtracts MasterActPosDif from ActualPosition to build LabelingData.MasterActualPositionUsed, then wraps the corrected value through its 0-10000 working range.",
        "During verified physical encoder motion, a changing ActualPosition is strong evidence that the controller is receiving position updates. A frozen value while the source is physically moving supports the feedback-path branch.",
        "Do not infer mechanical accuracy or an expected absolute value from this tag alone; the application applies offsets and wrap logic."
      ),
      watchPoint(
        "BaseMachineEncoderAxis.ActualVelocity",
        "Instantaneous motion evidence",
        "The Cart program uses ActualVelocity in main-drive state logic and in the filtered UsedActualVelocity calculation for encoder-pulse compensation.",
        "Use it as a read-only cross-check that the feedback-only axis sees motion when motion is physically expected.",
        "The PLC contains an LES(...,10) comparison, but v350 does not redefine 10 as a universal field pass/fail threshold because the supplied source does not establish that as a general diagnostic acceptance limit."
      ),
      watchPoint(
        "BaseMachineEncoderAxis.AverageVelocity",
        "Filtered motion evidence / HMI-derived speed source",
        "The PLC multiplies AverageVelocity by 0.006 into LabelingData.BaseMachineVel and copies that value to PanelView Data_To_PV.Data[30]/[31]. Other Cart logic also compares AverageVelocity around 10 for operating-state decisions.",
        "Compare it with ActualVelocity and ActualPosition. Agreement that all three show motion makes a permanently open/frozen feedback path less likely; disagreement is diagnostic evidence worth preserving.",
        "The 0.006 application scale and internal comparisons are source facts, not a recommendation to change scaling or axis parameters."
      ),
      watchPoint(
        "BaseMachineEncoderAxis.ServoFault",
        "Aggregate axis fault code/state",
        "NEQ(BaseMachineEncoderAxis.ServoFault,0) directly sets BaseMachineEncoder.SData.Status.Faulted.",
        "A nonzero ServoFault confirms the axis has an aggregate fault state. Read the six exact encoder status bits separately to identify the operator-facing subtype.",
        "Do not substitute ServoFault for the exact Module/Hardware/Sync/Feedback/Noise/Timer status; v350 does not decode undocumented numeric ServoFault values."
      ),
      watchPoint(
        "BaseMachineEncoder.SData.Status.Faulted",
        "Application aggregate fault state",
        "This application bit follows ServoFault != 0 and participates in the BaseMachineEncoder state/reset logic.",
        "Use it to confirm the Cart application recognizes an axis fault, but retain the direct BaseMachineEncoderAxis status bit as the subtype authority.",
        "An aggregate application state does not prove which physical component failed."
      )
    ]);

    const configuration = Object.freeze({
      module: "EEP_APL_Slot11",
      catalogNumber: "1756-M02AE",
      slot: 11,
      motionChannel: "EEP_APL_Slot11:Ch0",
      axis: "BaseMachineEncoderAxis",
      axisType: "Feedback Only",
      feedbackType: "AQB - A Quadrature B",
      conversionConstant: 2.0,
      positionUnwind: 20000,
      servoPolarityBits: 2,
      feedbackFaultAction: "Shutdown",
      feedbackNoiseFaultAction: "Status Only"
    });

    function statusRows(station) {
      return Object.freeze(OFFSETS.map((offset) => {
        const variant = station ? base.getStationFaultVariant(offset, station) : null;
        return Object.freeze({
          offset,
          localCode: String(offset).padStart(3, "0"),
          globalNumber: variant?.number ? Number(variant.number) : null,
          globalAddress: variant?.plcFault?.address || "",
          label: STATUS[offset].label,
          tag: STATUS[offset].tag,
          axisAction: STATUS[offset].action,
          localFaultBit: `Faults[4].${offset - 64}`,
          applicationResponse: "If this status bit is true, the shared Cart rung sets its local fault bit and unlatches Control.EnableMachineJog and Control.EnableMachineOn."
        });
      }));
    }

    function interpretationRules(offset) {
      return Object.freeze([
        Object.freeze({
          id: "motion-with-frozen-position",
          when: "Physical encoder source is confirmed moving, but ActualPosition/ActualVelocity remain frozen or absent.",
          meaning: "This supports the direct AQB feedback route through EEP_APL_Slot11:Ch0 / 1756-M02AE Channel 0 and CN131 / 2001-W131.",
          next: "Use the existing v348 feedback isolation path and the K605163 circuit only after the safe-work boundary is established."
        }),
        Object.freeze({
          id: "feedback-fault-with-changing-position",
          when: "FeedbackFault is active while ActualPosition and velocity evidence continue to change.",
          meaning: "Do not jump directly to encoder replacement. Preserve the disagreement and inspect ModuleFault, ModuleHardwareFault, ModuleSyncFault, FeedbackNoiseFault and TimerEventFault chronology/status.",
          next: "Use the v346/v349 alarm chronology plus the six status rows below to find the more specific producer that appeared first."
        }),
        Object.freeze({
          id: "noise-with-intermittent-motion-data",
          when: "FeedbackNoiseFault is active and position/velocity updates are intermittent or unstable.",
          meaning: "The observation aligns with signal-integrity evidence rather than a completely absent feedback path.",
          next: "Prioritize CN131/W131 connection, shielding/termination, source stability and module-channel diagnostics; do not change scaling to mask noise."
        }),
        Object.freeze({
          id: "module-status-before-feedback",
          when: "Module, Hardware, Sync or Timer Event status occurs before FeedbackFault.",
          meaning: "The earlier module/status producer remains stronger diagnostic evidence than the downstream-looking feedback symptom.",
          next: "Diagnose the exact earlier status first and use the physical feedback circuit only if the status evidence supports it."
        }),
        Object.freeze({
          id: "noise-action-nuance",
          when: "FeedbackNoiseFault is the active subtype.",
          meaning: "The AXIS_SERVO configuration says FeedbackNoiseFaultAction = Status Only, but the Cart application rung still reacts to that status by removing Machine Jog/On enable.",
          next: "Do not interpret 'Status Only' as 'the application ignores the fault'; distinguish motion-axis fault action from application-level response."
        })
      ]);
    }

    function getTopModulEncoderVerification(value) {
      const resolved = resolve(value);
      if (!resolved) return null;
      const { plan, entry, fieldObserved, station, offset } = resolved;
      const directStatus = statusRows(station).find((row) => row.offset === offset);
      return Object.freeze({
        id: fieldObserved ? "topmodul-encoder-verification-live-00067" : `topmodul-encoder-verification-${entry.number}`,
        scope: "Station / Cart encoder — read-only verification",
        station,
        fieldObserved,
        entry,
        localOffset: offset,
        directStatus,
        statusRows: statusRows(station),
        runtimeWatchPoints,
        configuration,
        circuitTrace: plan.circuitTrace || null,
        interpretationRules: interpretationRules(offset),
        source: SOURCE,
        authority: station && station !== 1
          ? "The global Station destination is exact. Internal BaseMachineEncoderAxis tag semantics are directly verified from the supplied Cart 1 program and used as the shared Station method; exact Carts 2-6 internal projects are not available in the source package."
          : "Cart 1 internal BaseMachineEncoderAxis tag semantics and the shared Station method are directly source-backed by the supplied controller export.",
        safety: Object.freeze([OBSERVE, LOTO, ELECTRICAL]),
        guidance: "Use these points as a read-only verification matrix. They help decide whether the HMI subtype agrees with live axis evidence before connector, cable, encoder-source or module work begins."
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];

      const field = getTopModulEncoderVerification("00067");
      if (field?.station !== null || field?.directStatus?.tag !== "BaseMachineEncoderAxis.FeedbackFault") errors.push("v350 must keep field 00067 Station-unknown and bind FeedbackFault directly.");
      if (!field?.runtimeWatchPoints?.some((row) => row.tag === "BaseMachineEncoderAxis.ActualPosition")) errors.push("v350 lost ActualPosition verification point.");
      if (!field?.runtimeWatchPoints?.some((row) => row.tag === "BaseMachineEncoderAxis.ActualVelocity" && /not redefine 10|does not establish/i.test(row.caution))) errors.push("v350 must retain the ActualVelocity threshold caution.");
      if (!field?.runtimeWatchPoints?.some((row) => row.tag === "BaseMachineEncoderAxis.AverageVelocity" && /0\.006/.test(row.sourceRelationship))) errors.push("v350 lost AverageVelocity 0.006 PanelView derivation evidence.");
      if (!field?.runtimeWatchPoints?.some((row) => row.tag === "BaseMachineEncoderAxis.ServoFault" && /aggregate/i.test(row.role))) errors.push("v350 must keep ServoFault as aggregate evidence, not the subtype authority.");

      const s1 = getTopModulEncoderVerification(1091);
      const s6 = getTopModulEncoderVerification(1491);
      if (s1?.station !== 1 || s1?.directStatus?.globalNumber !== 1091) errors.push("v350 lost Station 1 global Feedback Fault destination.");
      if (s6?.station !== 6 || s6?.directStatus?.globalNumber !== 1491) errors.push("v350 lost shared Station 6 global Feedback Fault destination.");
      if (s1?.configuration?.catalogNumber !== "1756-M02AE" || s1?.configuration?.motionChannel !== "EEP_APL_Slot11:Ch0") errors.push("v350 lost exact Slot 11 feedback-only module/channel configuration.");

      const noise = getTopModulEncoderVerification(1092);
      if (noise?.directStatus?.axisAction !== "FeedbackNoiseFaultAction = Status Only") errors.push("v350 lost Feedback Noise axis-action semantics.");
      if (!/unlatches Control\.EnableMachineJog and Control\.EnableMachineOn/.test(noise?.directStatus?.applicationResponse || "")) errors.push("v350 must preserve the application response to Status Only Feedback Noise.");

      const moduleFault = getTopModulEncoderVerification(1088);
      if (moduleFault?.directStatus?.tag !== "BaseMachineEncoderAxis.ModuleFault") errors.push("v350 lost ModuleFault direct status point.");
      if (getTopModulEncoderVerification(670) !== null) errors.push("v350 Station verification matrix must not absorb base Labeler Fault 670.");
      if (getTopModulEncoderVerification(67) !== null) errors.push("v350 must not reinterpret base Labeler PLC Fault 067 Change Mode as Cart encoder verification.");

      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+encoder-verification-v1`,
      getTopModulEncoderVerification,
      topModulEncoderVerificationOffsets: OFFSETS,
      validate
    });
  };
});
