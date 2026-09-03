"use strict";

(function installTopModulStationControllerTrace(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationControllerTraceExtension() {
  return function extendLibrary(base) {
    if (!base?.getEntry || !base?.getStationFaultTemplate || !base?.getStationFaultVariant) {
      throw new Error("Shared TopModul station scope is required before station-controller tracing.");
    }

    const cartSource = Object.freeze({
      id: "topmodul-co85-lb1-aplcart1-l5k",
      title: "CO85 LB1 APL Cart 1 PLC Export",
      file: "PLC Files/CO85_LB1_APLCart_1.L5K",
      kind: "PLC/control project export",
      status: "indexed",
      topics: ["TopModul", "APL", "station", "cart", "Faults", "DataFromLS", "ControlLogix", "RSLogix 5000"],
      notes: "Readable station-controller L5K. The local station Faults[0..4] array is packed into DataFromLS.Par1[40..42]. The TopModul Labeler PLC copies the same five 16-bit fault words into each station's Faults_LB1 block. Cart 1 is the readable station-controller authority currently available; cross-cart logic equivalence remains a later validation step."
    });

    const directTriggerTags = Object.freeze({
      32: "MainDriveAxis.CommutationFault",
      33: "MainDriveAxis.DriveControlVoltageFault",
      34: "MainDriveAxis.DriveCoolingFault",
      35: "MainDriveAxis.DriveHardFault",
      36: "MainDriveAxis.DriveOvercurrentFault",
      37: "MainDriveAxis.DriveOvertempFault",
      38: "MainDriveAxis.DriveOvervoltageFault",
      39: "MainDriveAxis.DriveUndervoltageFault",
      41: "MainDriveAxis.GroundShortFault",
      42: "MainDriveAxis.ModuleFault",
      43: "MainDriveAxis.ModuleHardwareFault",
      44: "MainDriveAxis.ModuleSyncFault",
      45: "MainDriveAxis.MotFeedbackFault",
      46: "MainDriveAxis.MotFeedbackNoiseFault",
      47: "MainDriveAxis.OverloadFault",
      48: "MainDriveAxis.MotorOvertempFault",
      50: "MainDriveAxis.OverSpeedFault",
      51: "MainDriveAxis.PositionErrorFault",
      52: "MainDriveAxis.PowerPhaseLossFault",
      53: "MainDriveAxis.SERCOSRingFault",
      54: "MainDriveAxis.TimerEventFault",
      64: "BaseMachineEncoderAxis.ModuleFault",
      65: "BaseMachineEncoderAxis.ModuleHardwareFault",
      66: "BaseMachineEncoderAxis.ModuleSyncFault",
      67: "BaseMachineEncoderAxis.FeedbackFault",
      68: "BaseMachineEncoderAxis.FeedbackNoiseFault",
      69: "BaseMachineEncoderAxis.TimerEventFault"
    });

    function localFaultAddress(offset) {
      return `Faults[${Math.floor(offset / 16)}].${offset % 16}`;
    }

    function cartTransportWord(offset) {
      return 40 + Math.floor(offset / 32);
    }

    function mainFaultStartWord(station) {
      return 64 + (Number(station) - 1) * 5;
    }

    function buildTrace(offset, station = null, exactEntry = null) {
      const localWord = Math.floor(offset / 16);
      const localBit = offset % 16;
      const dataWord = cartTransportWord(offset);
      const directTriggerTag = directTriggerTags[offset] || null;
      const packing = offset < 64
        ? "COP(Faults[0],TempFaults[0],5) → COP(TempFaults[0],DataFromLS.Par1[40],2)"
        : "COP(Faults[0],TempFaults[0],5) → MOV(TempFaults[4],DataFromLS.Par1[42])";
      const trace = {
        localFaultNumber: String(offset).padStart(3, "0"),
        localFaultAddress: localFaultAddress(offset),
        localFaultWord: localWord,
        localFaultBit: localBit,
        stationControllerSource: "CO85_LB1_APLCart_1.L5K",
        stationControllerRoutine: directTriggerTag ? "FaultLogic / Faults" : "FaultLogic and subsystem routines",
        directTriggerTag,
        cartPacking: packing,
        cartDataWord: `DataFromLS.Par1[${dataWord}]`,
        labelerReceiveWord: station ? `DataFromLS[${station}].Par1[${dataWord}]` : `DataFromLS[station].Par1[${dataWord}]`,
        labelerCopy: station
          ? `CPS(DataFromLS[${station}].Par1[40],Faults_LB1[${mainFaultStartWord(station)}],5)`
          : "CPS(DataFromLS[station].Par1[40],Faults_LB1[station fault block],5)",
        labelerFaultAddress: exactEntry?.plcFault?.address || null,
        traceStatus: directTriggerTag
          ? "station-local-trigger-and-transport-bound"
          : "station-local-fault-and-transport-bound"
      };
      return Object.freeze(trace);
    }

    function addCartSourceRef(entry, trace) {
      const sourceRefs = [...(entry.sourceRefs || [])];
      const locator = `${trace.localFaultAddress} — local Fault ${trace.localFaultNumber}; packed through ${trace.cartDataWord}${trace.directTriggerTag ? `; direct trigger ${trace.directTriggerTag}` : ""}`;
      if (!sourceRefs.some((ref) => ref.sourceId === cartSource.id && ref.locator === locator)) {
        sourceRefs.unshift({ sourceId: cartSource.id, locator });
      }
      return sourceRefs;
    }

    function enrich(entry) {
      if (!entry || entry.diagnosticScope !== "Station") return entry;
      const offset = Number(entry.stationTemplateOffset);
      if (!Number.isInteger(offset) || offset < 0 || offset > 79) return entry;
      const station = Number(entry.plcFault?.station || 0) || null;
      const trace = buildTrace(offset, station, entry);
      const triggerSentence = trace.directTriggerTag
        ? ` In the readable Cart 1 program, ${trace.directTriggerTag} directly drives ${trace.localFaultAddress}.`
        : ` The readable Cart 1 program binds this station alarm to ${trace.localFaultAddress}; the exact producing rung/condition is not yet marked as a direct one-tag trigger.`;
      return Object.freeze({
        ...entry,
        summary: `${entry.summary}${triggerSentence} The station fault is then transferred through ${trace.cartDataWord} into the Labeler PLC station fault block.`,
        sourceRefs: addCartSourceRef(entry, trace),
        stationControllerTrace: trace
      });
    }

    function getEntry(id) {
      return enrich(base.getEntry(id));
    }

    function getStationFaultTemplate(offset) {
      return enrich(base.getStationFaultTemplate(offset));
    }

    function getStationFaultVariant(offset, station) {
      return enrich(base.getStationFaultVariant(offset, station));
    }

    function getTopModulFault(value) {
      return enrich(base.getTopModulFault(value));
    }

    function searchEntries(query, context = {}, limit = 8) {
      return base.searchEntries(query, context, limit).map(enrich);
    }

    const sources = Object.freeze([...base.sources, cartSource]);

    function getSource(id) {
      return id === cartSource.id ? cartSource : base.getSource(id);
    }

    function validate() {
      const result = base.validate();
      const errors = [...(result.errors || [])];
      for (let offset = 0; offset < 80; offset += 1) {
        const template = base.getStationFaultTemplate(offset);
        if (!template) continue;
        const enriched = getStationFaultTemplate(offset);
        if (!enriched?.stationControllerTrace) errors.push(`Station template ${offset} has no station-controller trace.`);
        if (!enriched?.sourceRefs?.some((ref) => ref.sourceId === cartSource.id)) errors.push(`Station template ${offset} is missing Cart 1 PLC provenance.`);
      }
      const liveEncoder = getStationFaultTemplate(67);
      if (liveEncoder?.stationControllerTrace?.directTriggerTag !== "BaseMachineEncoderAxis.FeedbackFault") {
        errors.push("Station fault 067 is not bound to BaseMachineEncoderAxis.FeedbackFault.");
      }
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+topmodul-station-controller-trace-v1`,
      sources,
      getSource,
      getEntry,
      getStationFaultTemplate,
      getStationFaultVariant,
      getTopModulFault,
      searchEntries,
      getStationControllerTrace(offset, station = null) {
        const exact = station ? base.getStationFaultVariant(offset, station) : null;
        return buildTrace(Number(offset), station, exact);
      },
      topModulStationDirectTriggerCount: Object.keys(directTriggerTags).length,
      validate
    });
  };
});
