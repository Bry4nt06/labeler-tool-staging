"use strict";

(function installTopModulStationCauseModel(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationCauseModelExtension() {
  return function extendLibrary(base) {
    if (!base?.getStationControllerTrace || !base?.getStationFaultTemplate || !base?.getTopModulFaultRelations) {
      throw new Error("TopModul station-controller trace and fault drill-down are required before rung causality.");
    }

    const PRIMARY = "primary";
    const SUPERVISION = "supervision";
    const SECONDARY = "secondary";
    const DISABLED = "disabled";
    const CATALOG_ONLY = "catalog-only";
    const ev = (routine, logicType, rootLikelihood, producerSignals, logicSummary, evidenceStatus = "rung-condition-bound") => Object.freeze({ routine, logicType, rootLikelihood, producerSignals: Object.freeze(producerSignals), logicSummary, evidenceStatus });

    const explicitEvidence = Object.freeze({
      1: ev("Faults", "direct-live", PRIMARY, ["E1101_CR202_EStop", "E1101_CR204_EStopDelayed", "PowerOnReset"], "Either station E-stop relay path not made after power-on reset drives the local E-stop fault."),
      2: ev("BasicRoutine", "latched-controller-status", PRIMARY, ["LEDStatus", "Pulse_DataEthernetReceived", "PowerOnReset"], "LEDStatus not equal to 3 latches the controller I/O failure; reset/data-received logic clears it."),
      3: ev("Faults", "direct-live", PRIMARY, ["E2001_LS143_SafetySwitch", "PowerOnReset"], "The guard-door-open bit follows the station safety-switch state after power-on reset."),
      4: ev("Faults", "reset-state-derived", SECONDARY, ["E2001_LS143_SafetySwitch", "Faults[0].3", "ControlOut.ResetGeneral"], "This is a reset-required companion state to the guard-door fault; investigate the guard/safety-switch condition first."),
      5: ev("Faults", "timed-state-mismatch", PRIMARY, ["E2001_C101_ServoPowerSupply", "E2001_CB101_ServoPowerSupply", "TON_MonitorMainContactor"], "A 1500 ms monitor compares servo-power-supply contactor and breaker state; timer done or a retained uncleared state drives the main-contactor alarm."),
      6: ev("Faults", "direct-live", PRIMARY, ["E2001_CB104_FuseServo"], "The servo control-voltage breaker alarm is the inverted state of E2001_CB104_FuseServo."),
      7: ev("Faults", "direct-live", PRIMARY, ["E0301_CB202_FuseFeedRewindUnit"], "The feed/rewind breaker alarm is the inverted state of E0301_CB202_FuseFeedRewindUnit."),
      9: ev("Faults", "timed-latched", PRIMARY, ["E5701_MTR611_FeedUnitReady", "E2001_CB101_ServoPowerSupply", "tonFaultFeedUnit.DN"], "Feed-unit-not-ready logic runs a timer and latches the fault when tonFaultFeedUnit is done; general reset clears it."),
      10: ev("Faults", "timed-latched", PRIMARY, ["E5701_MTR601_RewindUnitReady", "E2001_CB101_ServoPowerSupply", "tonFaultRewindUnit.DN"], "Rewind-unit-not-ready logic runs a timer and latches the fault when tonFaultRewindUnit is done; general reset clears it."),
      11: ev("Faults", "module-status", PRIMARY, ["GSV HMI_Communications.FaultCode", "EthernetModuleSlot1FaultData"], "The HMI communications module GSV FaultCode is checked; a nonzero module fault code or retained communication state drives the alarm."),
      12: ev("Faults", "module-status", PRIMARY, ["GSV Ethernet_IO_1.FaultCode", "EthernetModuleSlot2FaultData"], "Ethernet I/O module 1 FaultCode is read with GSV; nonzero fault status drives the alarm."),
      13: ev("Faults", "module-status", PRIMARY, ["GSV Ethernet_IO_2.FaultCode", "EthernetModuleSlot4FaultData"], "Ethernet I/O module 2 FaultCode is read with GSV; nonzero fault status drives the alarm."),
      14: ev("Faults", "communication-latched", PRIMARY, ["ETH_Com.ReadyForETHConnect_L3", "Data_From_PV.Data[2]", "ONS_NoEthernetConnectL3"], "Loss of the Level-3 Ethernet-ready state is latched under the defined PanelView screen conditions; normal communication/reset logic clears it."),
      15: ev("Faults", "direct-live", PRIMARY, ["Local:7:I.FuseBlown"], "Any nonzero Local:7:I.FuseBlown value drives the digital-output-fuse alarm."),
      16: ev("Faults", "derived-motion-state", SECONDARY, ["MotionGroup.GroupSynced", "PowerOnReset"], "The alarm is live when the station motion group is not synchronized after power-on reset. Check axis/encoder faults that occurred first."),
      17: ev("Faults", "latched-axis-command-supervision", SUPERVISION, ["MainDrive.MTags.MSO[0].ER", "MainDrive.MTags.MSO[0].EN", "MainDrive.SData.Status.ReadyForFeedbackON"], "An MSO error while the command is enabled and the axis is ready for feedback-on latches this fault."),
      18: ev("Faults", "direct-parameter-state", PRIMARY, ["LabelingData.Sync_Distance"], "LabelingData.Sync_Distance less than zero directly drives the synchronization-distance alarm."),
      19: ev("Faults", "direct-parameter-state", PRIMARY, ["LabelingData.OverallMovementPercent"], "OverallMovementPercent greater than 125 directly drives the invalid-label-length/parameter alarm."),
      20: ev("Faults", "latched-position-state", SUPERVISION, ["E1501_P133_CarriageFront", "StoreCarriageNotFront", "PV_General.RunWithoutLabels"], "A stored carriage-not-front condition combined with the front-position input produces the reset-required carriage-position alarm."),
      21: ev("AxisMainDrive", "latched-reference-sequence", PRIMARY, ["MainDrive.MTags.MAH[*].ER", "MainDrive.MTags.MAH[*].DN", "RefRunForwardRequest", "MainDrive.Std.SM1.*"], "Multiple reference/homing state-machine failure branches latch Faults[1].5. This is a real producing routine, not only a reset bit."),
      22: ev("AxisMainDrive_LabelLength", "latched-measurement-supervision", PRIMARY, ["MeasureError", "CountLabelLengthBad", "ParLS_Actual.Par1[22]", "StartStop.WarnLabLengthForceAutochg"], "Repeated label-length measurement errors or the force-auto-change condition latch Faults[1].6 after configured count thresholds."),
      23: ev("Faults", "timed-latched", PRIMARY, ["E5701_PE641_TearVerification", "TON_TearVerification.DN", "PV_General.RunWithoutLabels"], "The tear-verification input staying in the fault state through TON_TearVerification latches the web-break-sensor fault."),
      25: ev("Faults", "counter-latched", PRIMARY, ["InputDetectEndOfReel1", "InputDetectEndOfReel2", "LabelingData.CtuEndOfReel1", "LabelingData.CtuEndOfReel2", "ParLS_Actual.Par1[20..21]"], "Configured end-of-reel counters latch the no-label/end-of-reel fault when either detector reaches its threshold while labels are enabled."),
      26: ev("FeedUnit", "counter-latched-sensor-supervision", PRIMARY, ["E5701_PE621_FeedUnitFront", "E5701_PE622_FeedUnitRear", "CountFrontFree", "CountRearCovered", "MainDrive.Std.SM1.*"], "Feed-unit sensor-state counters latch the loop-buffer/feed-unit fault when rear-covered count exceeds 20 or front-free count exceeds 4 during the defined motion states."),
      27: ev("FeedUnit", "timed-latched-sensor-plausibility", PRIMARY, ["E5701_PE621_FeedUnitFront", "E5701_PE622_FeedUnitRear", "TON_SensorVerification.DN"], "The front/rear feed sensors in the defined contradictory state long enough for TON_SensorVerification to finish latch the invalid-sensor-status fault."),
      28: ev("RewindUnitSpeedCalc", "latched-motion-supervision", PRIMARY, ["Rewinder.enable", "Rewinder.dx", "Rewinder.yi", "RewinderTimeout", "FixedArm.DN"], "Rewinder motion/fixed-arm supervision contains two branches that latch the web-jam fault when expected rewind movement is not achieved."),
      29: ev("RewindUnitSpeedCalc", "timed-latched-motion-supervision", PRIMARY, ["Rewinder.enable", "ComputedRewindUnitActualValue", "WebBreakTime"], "With the rewinder enabled, ComputedRewindUnitActualValue above 29000 for WebBreakTime greater than 1000 latches the web-break-after-head fault when labels are active."),
      30: ev("BaseMachine_Encoder", "latched-encoder-supervision", PRIMARY, ["BaseMachineEncoder.SData.Status.Axis_Is_Homed", "FaultEncoderMonitoring", "DelayFaultEncoderMon.DN", "E2001_OPTO131_ClockPulse", "LabelingData.MasterActualPositionUsed"], "The station encoder fault is produced by master-encoder registration-difference monitoring and by clock-pulse state occurring in prohibited master-position windows."),
      60: ev("RewindUnit", "timed-latched", SUPERVISION, ["ParLS_Actual.Par1[30]", "E5701_PE603_DiameterRewindUnit", "DiameterSensorTimer.DN"], "When rewind-full monitoring is enabled, the rewind diameter sensor remaining active until DiameterSensorTimer is done latches the rewind-full alarm.")
    });

    const catalogOnlyOffsets = new Set([8, 24, 31, 74]);
    const disabledOffsets = new Set([40, 49]);

    function directTriggerEvidence(offset, trace) {
      if (!trace?.directTriggerTag) return null;
      return ev(trace.stationControllerRoutine || "Faults", "direct-controller-status", PRIMARY, [trace.directTriggerTag], `${trace.directTriggerTag} directly drives ${trace.localFaultAddress} in the readable Cart 1 program.`, "direct-trigger-bound");
    }

    function rungEvidenceFor(offset, station = null) {
      const n = Number(offset);
      if (!Number.isInteger(n)) return null;
      if (catalogOnlyOffsets.has(n)) return ev("Not located in Cart 1 L5K", "catalog-only", CATALOG_ONLY, [], "This alarm position exists in the Labeler alarm table but the corresponding local Faults bit is not referenced anywhere in the readable Cart 1 L5K. Do not infer a producer until another cart/revision is verified.", "alarm-table-only");
      if (disabledOffsets.has(n)) {
        const address = `Faults[${Math.floor(n / 16)}].${n % 16}`;
        return ev("Faults", "disabled-placeholder", DISABLED, ["Logic_0"], `${address} is driven by Logic_0 in Cart 1, so this alarm is an inactive placeholder in this revision.`, "disabled-in-cart1");
      }
      return explicitEvidence[n] || directTriggerEvidence(n, base.getStationControllerTrace(n, station)) || null;
    }

    const rank = (e) => !e ? 80 : e.rootLikelihood === PRIMARY ? (e.logicType.includes("direct") ? 10 : 15) : e.rootLikelihood === SUPERVISION ? 30 : e.rootLikelihood === SECONDARY ? 55 : e.rootLikelihood === DISABLED ? 95 : 100;
    const role = (r) => r === PRIMARY ? "Primary/root-cause candidate" : r === SUPERVISION ? "Supervision/derived fault" : r === SECONDARY ? "Secondary/state fault" : r === DISABLED ? "Inactive placeholder in Cart 1" : r === CATALOG_ONLY ? "Catalog-only in Cart 1" : "Unclassified";

    function enrich(entry) {
      if (!entry || entry.diagnosticScope !== "Station") return entry;
      const offset = Number(entry.stationTemplateOffset);
      if (!Number.isInteger(offset)) return entry;
      const evidence = rungEvidenceFor(offset, Number(entry.plcFault?.station || 0) || null);
      if (!evidence) return entry;
      return Object.freeze({ ...entry, stationRungEvidence: Object.freeze({ ...evidence, firstFaultRank: rank(evidence), roleLabel: role(evidence.rootLikelihood) }) });
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getStationFaultTemplate = (offset) => enrich(base.getStationFaultTemplate(offset));
    const getStationFaultVariant = (offset, station) => enrich(base.getStationFaultVariant(offset, station));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);

    function isStationSummary(entry) {
      const n = Number(entry?.number), family = String(entry?.plcFault?.family || "");
      return (n >= 642 && n <= 668) || family === "Labeling station / readiness" || family === "Synchronization / motion group";
    }

    function relationCausality(source, candidate) {
      const e = candidate.stationRungEvidence;
      if (isStationSummary(candidate)) return { role: "downstream-summary", boost: -45, label: "Summary/downstream alarm" };
      if (e?.rootLikelihood === PRIMARY) return { role: "upstream-primary", boost: 70, label: "Primary candidate" };
      if (e?.rootLikelihood === SUPERVISION) return { role: "upstream-supervision", boost: 35, label: "Supervision candidate" };
      if (e?.rootLikelihood === SECONDARY) return { role: "secondary-state", boost: -10, label: "Secondary state" };
      if ([DISABLED, CATALOG_ONLY].includes(e?.rootLikelihood)) return { role: "low-confidence", boost: -70, label: "Do not lead with this" };
      if (source?.plcFault?.family === candidate?.plcFault?.family) return { role: "sibling-evidence", boost: 8, label: "Sibling evidence" };
      return { role: "related", boost: 0, label: "Related fault" };
    }

    function annotate(source, candidate) {
      const item = enrich(candidate), c = relationCausality(source, item);
      return Object.freeze({ ...item, causalRole: c.role, causalRoleLabel: c.label, firstFaultScore: Number(candidate.relationScore || 0) + c.boost - Number(item.stationRungEvidence?.firstFaultRank || 0) / 10 });
    }

    function resolve(value) { return typeof value === "object" ? enrich(value) : getTopModulFault(value) || getEntry(value); }

    function getTopModulFaultRelations(value, limit = 10) {
      const source = resolve(value);
      return base.getTopModulFaultRelations(value, Math.max(24, Number(limit) * 4 || 24)).map((x) => annotate(source, x)).sort((a, b) => b.firstFaultScore - a.firstFaultScore || b.relationScore - a.relationScore || Number(a.number) - Number(b.number)).slice(0, Math.max(1, Number(limit) || 10));
    }

    function getTopModulFirstFaultCandidates(value, limit = 8) {
      const source = resolve(value);
      if (!source?.plcFault) return [];
      return base.getTopModulFaultRelations(value, 36).map((x) => annotate(source, x)).filter((x) => !["downstream-summary", "low-confidence"].includes(x.causalRole)).sort((a, b) => b.firstFaultScore - a.firstFaultScore || b.relationScore - a.relationScore || Number(a.number) - Number(b.number)).slice(0, Math.max(1, Number(limit) || 8));
    }

    function getTopModulFaultDrillDown(value, limit = 10) {
      const original = base.getTopModulFaultDrillDown(value, Math.max(24, Number(limit) * 3 || 24));
      if (!original) return null;
      const entry = enrich(original.entry);
      return Object.freeze({ ...original, entry, related: getTopModulFaultRelations(entry, limit), firstFaultCandidates: getTopModulFirstFaultCandidates(entry, Math.min(6, Math.max(3, Number(limit) || 6))), prompt: `${original.prompt} ${isStationSummary(entry) ? "Start with the highest-ranked primary station-controller conditions before supervision or summary alarms." : "Ranking now prefers PLC-proven live/latched producer conditions over downstream summary states."}` });
    }

    function validate() {
      const current = base.validate(), errors = [...(current.errors || [])];
      let located = 0, active = 0, catalogOnly = 0, disabled = 0;
      for (let offset = 0; offset < 80; offset += 1) {
        if (!base.getStationFaultTemplate(offset)) continue;
        const e = rungEvidenceFor(offset);
        if (!e) errors.push(`Station template ${offset} has no rung-causality classification.`);
        else if (e.rootLikelihood === CATALOG_ONLY) catalogOnly += 1;
        else { located += 1; if (e.rootLikelihood === DISABLED) disabled += 1; else active += 1; }
      }
      if (located !== 58) errors.push(`Expected 58 station alarm positions located in Cart 1 logic, found ${located}.`);
      if (active !== 56) errors.push(`Expected 56 active station producer/supervision positions, found ${active}.`);
      if (catalogOnly !== 4) errors.push(`Expected 4 station alarm positions catalog-only in Cart 1, found ${catalogOnly}.`);
      if (disabled !== 2) errors.push(`Expected 2 Logic_0 disabled placeholders, found ${disabled}.`);
      if (getStationFaultTemplate(67)?.stationRungEvidence?.producerSignals?.[0] !== "BaseMachineEncoderAxis.FeedbackFault") errors.push("Station local Fault 067 lost its direct encoder feedback producer binding.");
      if (getStationFaultTemplate(26)?.stationRungEvidence?.routine !== "FeedUnit") errors.push("Station local Fault 026 is not bound to FeedUnit supervision.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({ ...base, version: `${base.version}+topmodul-station-rung-causality-v1`, getEntry, getStationFaultTemplate, getStationFaultVariant, getTopModulFault, searchEntries, getTopModulFaultRelations, getTopModulFaultDrillDown, getTopModulFirstFaultCandidates, getStationRungEvidence: rungEvidenceFor, topModulStationRungLocatedCount: 58, topModulStationActiveCauseCount: 56, topModulStationCatalogOnlyCount: 4, topModulStationDisabledPlaceholderCount: 2, validate });
  };
});
