"use strict";

(function installTopModulLive00067SourceBridge(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLive00067SourceBridgeExtension() {
  return function extendLibrary(base) {
    if (!base?.getEntry || !base?.getStationFaultTemplate || !base?.getStationFaultVariant || !base?.getStationControllerTrace) {
      throw new Error("TopModul Station transport and encoder circuit layers are required before bridging live HMI 00067.");
    }

    const FIELD_ID = "topmodul-00067-labeler-encoder-feedback";
    const FIELD_VARIANT_IDS = new Set([
      FIELD_ID,
      "topmodul-00067-no-feedback-while-moving",
      "topmodul-00067-intermittent-feedback",
      "topmodul-00067-secondary-no-motion"
    ]);
    const CART_SOURCE_ID = "topmodul-co85-lb1-aplcart1-l5k";
    const FIELD_SOURCE_ID = "field-topmodul-00067-20260903";
    const LOCAL_OFFSET = 67;
    const LOCAL_ADDRESS = "Faults[4].3";
    const PRODUCER = "BaseMachineEncoderAxis.FeedbackFault";
    const HMI_MESSAGE = "00067 LABELER ENCODER FEEDBACK FAULT";
    const OBSERVE = "Use normal HMI/PLC/motion-axis diagnostics only. Do not force BaseMachineEncoderAxis status, Station fault bits, or Cart-to-Labeler transport data.";
    const LOTO = "Prevent unexpected Station/servo motion and follow site lockout/tagout and stored-energy procedures before hands-on encoder, CN131, W131, connector, module, or cabinet work.";
    const ELECTRICAL = "Energized electrical or signal measurements are for qualified personnel under the site's approved electrical safe-work procedure.";

    const stationTemplate = base.getStationFaultTemplate(LOCAL_OFFSET);
    if (!stationTemplate?.stationControllerTrace || !stationTemplate?.circuitTrace) {
      throw new Error("Station local Fault 067 must have both transport and K605163 encoder circuit authority before live 00067 can be source-bridged.");
    }

    const stationMap = Object.freeze(Array.from({ length: 6 }, (_, index) => {
      const station = index + 1;
      const variant = base.getStationFaultVariant(LOCAL_OFFSET, station);
      return Object.freeze({
        station,
        globalNumber: Number(variant?.number),
        globalCode: variant?.code || String(1024 + index * 80 + LOCAL_OFFSET),
        globalAddress: variant?.plcFault?.address || `Faults_LB1[${68 + index * 5}].3`,
        entryId: variant?.id || `topmodul-plc-fault-${1024 + index * 80 + LOCAL_OFFSET}`,
        title: variant?.title || `Labeling Station ${station} / Labeler Encoder / Feedback Fault`,
        labelerCopy: base.getStationControllerTrace(LOCAL_OFFSET, station)?.labelerCopy || `CPS(DataFromLS[${station}].Par1[40],Faults_LB1[${64 + index * 5}],5)`
      });
    }));

    const localFault = Object.freeze({
      status: "source-proven-station-local-hmi-fault",
      localNumber: LOCAL_OFFSET,
      localCode: "00067",
      localAddress: LOCAL_ADDRESS,
      producer: PRODUCER,
      hmiMessage: HMI_MESSAGE,
      controller: "CO85_LB1_APLCart_1",
      cartTransport: "COP(Faults[0],TempFaults[0],5) → MOV(TempFaults[4],DataFromLS.Par1[42])",
      stationTransportWord: "DataFromLS.Par1[42]",
      globalByStation: stationMap,
      sourceDiscipline: "The local HMI number and message, Cart producer, Cart transport, and Labeler station destinations are source-proven. Base Labeler PLC Fault 067 remains a different alarm: Labeling Station Change Mode Active."
    });

    const processTrace = Object.freeze({
      status: "station-local-hmi-producer-and-cart-to-labeler-transport-bound",
      confidence: "exact-cart-plc-producer-exact-hmi-text-exact-labeler-cps-transport",
      routine: "Cart FaultLogic / Faults → Fault_Jumps → Labeler LabelingStation_Jumps",
      producerSignals: Object.freeze([
        `${PRODUCER} → ${LOCAL_ADDRESS}`,
        "OTU(Control.EnableMachineJog)",
        "OTU(Control.EnableMachineOn)",
        "COP(Faults[0],TempFaults[0],5)",
        "MOV(TempFaults[4],DataFromLS.Par1[42])",
        ...stationMap.map((row) => `${row.labelerCopy} → local bit 4.3 lands at ${row.globalAddress} / global Fault ${row.globalNumber}`)
      ]),
      calculationSteps: Object.freeze([
        Object.freeze({ label: "Local HMI identity", value: `The readable Cart 1 L5K contains the exact operator-facing string '${HMI_MESSAGE}' and COMMENT[4].3 identifies local Fault 067 as Labeler encoder feedback fault.` }),
        Object.freeze({ label: "Direct producer", value: `${PRODUCER} directly drives ${LOCAL_ADDRESS}. This is the source-proven producer of the local PanelView 00067 alarm.` }),
        Object.freeze({ label: "Cart fault transport", value: "The Cart copies Faults[0..4] to TempFaults and moves TempFaults[4] into DataFromLS.Par1[42], preserving local bit 4.3 for the Labeler." }),
        Object.freeze({ label: "Labeler receive", value: "The base Labeler uses one five-word CPS fault block per Station. Local offset 067 therefore maps to 1091 / 1171 / 1251 / 1331 / 1411 / 1491 for Stations 1-6." }),
        Object.freeze({ label: "Numbering boundary", value: "Base-machine PLC Fault 067 is Labeling Station Change Mode Active. It is not the same alarm as the Cart-local HMI 00067." }),
        Object.freeze({ label: "Encoder-family boundary", value: "Cart local Fault 030 is the OPTO131 clock-monitor fault. Local Fault 067 is the 1756-M02AE AQB axis FeedbackFault status. Do not substitute Fault 670 main-machine fine-clock monitoring or ENC101 for this producer." })
      ]),
      hardwareRows: stationTemplate.circuitTrace.deviceRows,
      drawingLocations: stationTemplate.circuitTrace.drawingLocations,
      source: base.getSource?.(CART_SOURCE_ID) || null,
      hardwareSource: stationTemplate.circuitTrace.source || null,
      summary: "PanelView 00067 is now source-proven as the Station/Cart-local Labeler Encoder Feedback Fault. BaseMachineEncoderAxis.FeedbackFault drives Cart Faults[4].3; that bit is transported to the base Labeler station fault block, where it becomes global 1091, 1171, 1251, 1331, 1411, or 1491 according to station position.",
      safetyBoundary: `${OBSERVE} ${LOTO} ${ELECTRICAL}`,
      scopeNote: "Use one shared Station encoder-feedback method for all six Station positions. Station number changes only the Labeler-side destination alarm/address, not the Cart-local Fault 067 diagnostic method."
    });

    function addSourceRef(refs, sourceId, locator) {
      const next = [...(refs || [])];
      if (!next.some((ref) => ref.sourceId === sourceId && ref.locator === locator)) next.unshift(Object.freeze({ sourceId, locator }));
      return Object.freeze(next);
    }

    function bridgeEntry(entry) {
      if (!entry || !FIELD_VARIANT_IDS.has(entry.id)) return entry;
      let sourceRefs = addSourceRef(entry.sourceRefs, CART_SOURCE_ID, `${LOCAL_ADDRESS} — ${PRODUCER}; HMI text '${HMI_MESSAGE}'; transported through DataFromLS.Par1[42]`);
      sourceRefs = addSourceRef(sourceRefs, "topmodul-k605163-apl-electrical", "K605163-001 — Slot 11 1756-M02AE AQB feedback path via CN131 / 2001-W131; exact pages 33 and 50");
      const isPrimary = entry.id === FIELD_ID;
      const exactChecks = Object.freeze([
        "Identify which Station/Cart position is affected. The local HMI code stays 00067 on the Cart, while the corresponding base-Labeler history code is 1091/1171/1251/1331/1411/1491 for Stations 1-6.",
        "In normal motion-axis diagnostics, verify BaseMachineEncoderAxis.FeedbackFault and the BaseMachineEncoderAxis feedback state. Do not force axis status bits or transport words.",
        "Use the existing shared Station encoder-feedback route: EEP_APL_Slot11:Ch0 / 1756-M02AE AQB feedback, CN131 and 2001-W131. Distinguish direct FeedbackFault from FeedbackNoiseFault, ModuleFault, ModuleHardwareFault, ModuleSyncFault, and TimerEventFault before replacing hardware.",
        "If actual Station/base-machine encoder motion is expected but AQB feedback is absent, isolate the CN131/W131/module feedback path under the approved safe-work procedure.",
        "If no motion is expected because an upstream machine/drive condition stopped the system, retain that chronology; however, the producer of HMI 00067 itself is now exactly known as BaseMachineEncoderAxis.FeedbackFault.",
        "Do not redirect HMI 00067 to base-machine PLC Fault 067 Change Mode, Fault 670 fine-clock monitoring, ENC101, or OPTO131 unless separate evidence independently points to those systems."
      ]);
      return Object.freeze({
        ...entry,
        category: "TopModul / Station / Labeler Encoder",
        summary: isPrimary
          ? "Source-proven TopModul Station-local fault 00067. The Cart HMI message is generated from BaseMachineEncoderAxis.FeedbackFault at Faults[4].3. The same local bit is transferred into the base Labeler station fault block, becoming global Fault 1091/1171/1251/1331/1411/1491 according to Station 1-6. Base Labeler PLC Fault 067 remains the separate Labeling Station Change Mode Active alarm."
          : `${entry.summary} Source bridge: this symptom branch belongs to the same proven Cart-local 00067 producer, ${PRODUCER} → ${LOCAL_ADDRESS}, with the exact 1756-M02AE/CN131/W131 AQB feedback route.`,
        probableCauses: isPrimary ? Object.freeze([
          "The 1756-M02AE BaseMachineEncoderAxis has asserted FeedbackFault for its AQB feedback channel.",
          "High-resolution AQB A/B/Z feedback through CN131 / 2001-W131 is absent, invalid, or not reaching EEP_APL_Slot11:Ch0 as expected.",
          "Encoder/signal-converter source, connector, cable, shield/termination, or Slot 11 Channel 0 feedback hardware may be involved after the status subtype is confirmed.",
          "A broader Station/controller/module condition can coexist, so review preceding Module/Sync/Noise/Timer or machine-motion faults before replacing the encoder or module."
        ]) : entry.probableCauses,
        checks: isPrimary ? exactChecks : Object.freeze([...(entry.checks || []), ...exactChecks.slice(0, 3)]),
        actions: isPrimary ? Object.freeze([
          "Repair only the localized AQB feedback, connector/cable, encoder source, or module condition supported by diagnostics and circuit checks, then verify the FeedbackFault remains clear through normal guarded operation.",
          "If another Station encoder subtype occurred first, resolve that specific producer before treating 00067 as an isolated encoder replacement decision.",
          "Do not bypass encoder supervision, alter station transport bits, or substitute base-machine Fault 067/670 logic to clear this alarm."
        ]) : entry.actions,
        safety: Object.freeze([OBSERVE, LOTO, ELECTRICAL]),
        sourceRefs,
        stationLocalFault: localFault,
        stationControllerTrace: base.getStationControllerTrace(LOCAL_OFFSET),
        processTrace,
        circuitTrace: stationTemplate.circuitTrace,
        sourceVerificationStatus: "field-observation-now-bridged-to-readable-cart-plc-and-exact-station-circuit"
      });
    }

    const entries = Object.freeze((base.entries || []).map(bridgeEntry));
    const sources = Object.freeze((base.sources || []).map((source) => {
      if (source.id !== FIELD_SOURCE_ID) return source;
      return Object.freeze({
        ...source,
        notes: "Allen-Bradley PanelView 550 displayed '00067 LABELER ENCODER FEEDBACK FAULT'. The field image remains an observation source. v347 separately proves the mapping with the readable Cart 1 L5K: COMMENT[4].3 / Faults[4].3, direct producer BaseMachineEncoderAxis.FeedbackFault, and Cart-to-Labeler transport into the station-specific global alarm block."
      });
    }));

    function getEntry(id) {
      return bridgeEntry(base.getEntry(id));
    }

    function getSource(id) {
      if (id === FIELD_SOURCE_ID) return sources.find((source) => source.id === id) || null;
      return base.getSource?.(id) || sources.find((source) => source.id === id) || null;
    }

    function searchEntries(query, context = {}, limit = 8) {
      return base.searchEntries(query, context, limit).map(bridgeEntry);
    }

    function getLive00067StationVariant(station) {
      const n = Number(station);
      if (!Number.isInteger(n) || n < 1 || n > 6) return null;
      return base.getStationFaultVariant(LOCAL_OFFSET, n);
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const field = searchEntries("00067", { machineType: "TopModul" }, 3)[0];
      if (field?.id !== FIELD_ID) errors.push("Exact HMI 00067 no longer resolves to the field entry first.");
      if (field?.stationLocalFault?.producer !== PRODUCER) errors.push("HMI 00067 lost BaseMachineEncoderAxis.FeedbackFault producer binding.");
      if (field?.stationLocalFault?.localAddress !== LOCAL_ADDRESS) errors.push("HMI 00067 lost Cart Faults[4].3 binding.");
      if (field?.plcFault !== undefined) errors.push("HMI 00067 must not be reinterpreted as base Labeler PLC Fault 067.");
      const expected = [1091, 1171, 1251, 1331, 1411, 1491];
      stationMap.forEach((row, index) => {
        if (row.globalNumber !== expected[index]) errors.push(`HMI 00067 Station ${index + 1} lost global fault ${expected[index]} mapping.`);
        const variant = getLive00067StationVariant(index + 1);
        if (variant?.number !== expected[index] || variant?.plcFault?.address !== row.globalAddress) errors.push(`HMI 00067 Station ${index + 1} transport destination is inconsistent with shared Station variant.`);
      });
      if (!field?.circuitTrace?.deviceRows?.some((row) => /1756-M02AE/.test(row.device))) errors.push("HMI 00067 lost 1756-M02AE AQB circuit evidence.");
      if (!field?.circuitTrace?.deviceRows?.some((row) => /CN131/.test(row.device) && /W131/.test(row.device + row.cable))) errors.push("HMI 00067 lost CN131/W131 circuit evidence.");
      if (!field?.circuitTrace?.drawingLocations?.some((row) => Number(row.pdfPage) === 33) || !field?.circuitTrace?.drawingLocations?.some((row) => Number(row.pdfPage) === 50)) errors.push("HMI 00067 lost K605163 pages 33/50 authority.");
      if (base.getTopModulFault(67)?.title !== "Labeling Station Change Mode Active") errors.push("Base Labeler PLC Fault 067 separation was lost.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+live-00067-source-bridge-v1`,
      entries,
      sources,
      getEntry,
      getSource,
      searchEntries,
      getLive00067StationVariant,
      topModulLive00067LocalFault: localFault,
      validate
    });
  };
});
