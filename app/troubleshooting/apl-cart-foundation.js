"use strict";

(function installAplCartFoundation(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplCartFoundationExtension() {
  return function extendLibrary(base) {
    if (!base?.searchEntries || !base?.getEntry || !base?.getSource || !base?.validate || !base?.normalize) {
      throw new Error("ServoForge troubleshooting library is required before APL Cart foundation tracing.");
    }

    const SOURCE = Object.freeze({
      id: "lb1-aplcart-readable-l5k-v355",
      title: "CO85 LB1 APL Cart 1 Readable PLC Export",
      file: "CO85_LB1_APLCart_1.L5K",
      kind: base.SOURCE_KIND?.CONTROL_PROJECT || "PLC/control project",
      status: "indexed-readable-export",
      controller: "CO85_LB1_APLCart_1_V35",
      exportVersion: "RSLogix 5000 v15.02",
      evidenceClass: "readable-apl-cart-plc-export",
      topics: Object.freeze(["APL", "Cart", "LB1", "PLC", "main contactor", "power", "feed", "rewind", "Ethernet", "communication", "motion group", "synchronization"]),
      notes: "Primary executable authority for APL Cart 1 faults 005-019 in this release. Equivalent behavior on other carts is not assumed unless their controller source is verified."
    });

    const OBSERVE = "Use normal HMI/PLC/drive diagnostics only. Do not force Cart power, ready, communication, motion-group, reset, safety, or fault bits.";
    const LOTO = "Stop the machine and follow site lockout/tagout and stored-energy requirements before hands-on work on Cart contactors, breakers, drives, connectors, wiring, or guarded equipment.";
    const ELECTRICAL = "Energized electrical measurements are for qualified personnel under the site's approved electrical safe-work procedure.";
    const SAFETY = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);
    const SUPPORTED = Object.freeze([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const watch = (tag, role, relationship, interpretation, caution = "") => Object.freeze({ tag, role, relationship, interpretation, caution });
    const step = (order, label, detail) => Object.freeze({ order, label, detail });
    const choice = (value, label) => Object.freeze({ value, label });
    const observe = (key, prompt, choices) => Object.freeze({ key, prompt, choices: Object.freeze(choices) });
    const result = (code, severity, title, summary, next = "") => Object.freeze({ code, severity, title, summary, next });

    const TITLES = Object.freeze({
      5: "Main Contactor Faulted",
      6: "Servo Control Voltage CB Tripped",
      7: "Feed / Rewind Unit CB Tripped",
      8: "Carriage Not Pulled Back",
      9: "Feed Unit Motor Fault",
      10: "Rewind Unit Motor Fault",
      11: "Ethernet Module Slot 1 (Level 1) Faulted",
      12: "Ethernet Module Slot 2 (Level 3) Faulted",
      13: "Ethernet Module Slot 4 (Level 3 HMI) Fault",
      14: "Base Machine Communication Fault",
      15: "Digital Output Module Electronic Fuse Tripped",
      16: "Motion Group Not Synchronized",
      17: "Servo Axis Feedback On Fault",
      18: "Synchronization Distance < 0",
      19: "Invalid Label Length / Change Parameters"
    });

    function code(number) { return String(number).padStart(5, "0"); }
    function makeEntry(number, summary, aliases = []) {
      return Object.freeze({
        id: `apl-cart-${code(number)}`,
        code: code(number),
        number,
        category: "APL Cart / Foundation",
        aliases: Object.freeze([`fault ${number}`, `apl cart ${number}`, TITLES[number], ...aliases]),
        title: TITLES[number],
        summary,
        probableCauses: Object.freeze(["Use the source-backed producer and live observation chain below before replacing hardware."]),
        checks: Object.freeze(["Preserve the raw PLC states and alarm chronology before reset.", "Use only the exact source-bound signals shown in the APL Cart isolation panel."]),
        actions: Object.freeze(["Correct the verified producer condition, then reset only after the underlying state is healthy."]),
        safety: SAFETY,
        sourceRefs: Object.freeze([{ sourceId: SOURCE.id, locator: `CO85_LB1_APLCart_1.L5K — Fault ${code(number)} source chain` }]),
        contextHints: Object.freeze(["apl", "cart", "labeling station"])
      });
    }

    const ENTRIES = Object.freeze([
      makeEntry(5, "The supplied APL Cart PLC monitors the raw servo-power command and mains-contactor input through a 1500 ms timer. The source polarity is preserved rather than renamed as a generic command/feedback mismatch.", ["main contactor", "contactor"]),
      makeEntry(6, "Fault 00006 is directly driven when the servo logic-supply breaker input E2001_CB104_FuseServo is false.", ["servo fuse", "control voltage"]),
      makeEntry(7, "Fault 00007 is directly driven when the feed/rewind unit breaker input E0301_CB202_FuseFeedRewindUnit is false.", ["feed rewind breaker", "feed rewind fuse"]),
      makeEntry(8, "The readable source contains the Fault 00008 alarm text, but no executable reference to Faults[0].8 was found in this PLC export. ServoForge therefore keeps it catalog-visible without inventing a producer.", ["carriage", "pulled back"]),
      makeEntry(9, "Fault 00009 is latched after the feed-unit ready state is false while the source's mains-contactor input condition is also false for the 1000 ms feed fault timer.", ["feed motor", "feed ready"]),
      makeEntry(10, "Fault 00010 is latched after the rewind-unit ready state is false while the source's mains-contactor input condition is also false for the 1000 ms rewind fault timer.", ["rewind motor", "rewind ready"]),
      makeEntry(11, "Fault 00011 reads the Slot 1 HMI_Communications module FaultCode with a GSV; a non-zero code is the direct source condition.", ["slot 1", "level 1 ethernet"]),
      makeEntry(12, "Fault 00012 reads the Slot 2 Ethernet_IO_1 module FaultCode with a GSV; a non-zero code is the direct source condition.", ["slot 2", "level 3 ethernet"]),
      makeEntry(13, "Fault 00013 reads the Slot 4 Ethernet_IO_2 module FaultCode with a GSV; a non-zero code is the direct source condition.", ["slot 4", "hmi ethernet"]),
      makeEntry(14, "Fault 00014 is a latched Level-3/base-machine communications condition driven by ReadyForETHConnect_L3 loss and the source's HMI communication-screen states.", ["base machine communication", "ethernet connect"]),
      makeEntry(15, "Fault 00015 is directly driven when Local:7:I.FuseBlown is non-zero on the 1756-OB16E output module in local Slot 7.", ["fuse blown", "output module"]),
      makeEntry(16, "Fault 00016 is directly driven when MotionGroup.GroupSynced is false after PowerOnReset.", ["group synced", "motion group"]),
      makeEntry(17, "Fault 00017 latches when the main-drive MSO instruction reports ER while EN and ReadyForFeedbackON are simultaneously true.", ["feedback on", "mso error"]),
      makeEntry(18, "Fault 00018 is directly driven when the calculated LabelingData.Sync_Distance is below zero.", ["sync distance", "synchron distance"]),
      makeEntry(19, "Fault 00019 is directly driven when the calculated LabelingData.OverallMovementPercent is greater than the source threshold of 125.", ["label length", "movement percent", "change parameters"])
    ]);

    const PLANS = Object.freeze({
      5: Object.freeze({
        family: "Servo-power main contactor supervision",
        status: "exact-plc-producer",
        producer: "[(E2001_C101_ServoPowerSupply=1 AND E2001_CB101_ServoPowerSupply=1) OR (both=0)] -> TON_MonitorMainContactor 1500 ms -> Faults[0].5",
        sourceRefs: Object.freeze(["L5K 1660-1663: C101 command O0007.11 and CB101 input I0005.22 aliases", "L5K 17095: TON_MonitorMainContactor preset 1500 ms", "L5K 17140-17144: Fault 00005 producer rung"]),
        watchPoints: freezeRows([
          watch("E2001_C101_ServoPowerSupply / O0007.11", "Servo-power command", "One side of the source timer condition.", "Record the raw command state."),
          watch("E2001_CB101_ServoPowerSupply / I0005.22", "Mains-contactor input", "The other side of the source timer condition.", "Compare the raw input with the command through the actual sequence.", "Do not infer normally-open/normally-closed polarity from the tag name alone."),
          watch("TON_MonitorMainContactor.ACC / .DN", "Main-contactor monitor", "Preset is 1500 ms.", "The source timer runs when the two raw bits are in the same Boolean state."),
          watch("Faults[0].5", "Fault output", "Timer done, or the existing fault self-hold while ResetGeneral is false, drives the output.", "Reset only after the underlying raw state is understood.")
        ]),
        steps: freezeRows([
          step(1, "Capture both raw states", "Record O0007.11 and I0005.22 at the same instant."),
          step(2, "Observe the 1500 ms timer", "Do not rename the source condition as a conventional mismatch; the supplied rung times the equal-state combinations."),
          step(3, "Trace hardware only after PLC isolation", "Use the Cart contactor/field-reference circuit only after the source state is proven.")
        ]),
        observations: Object.freeze([
          observe("command", "E2001_C101_ServoPowerSupply", [choice("1", "1 / true"), choice("0", "0 / false"), choice("unknown", "Not verified")]),
          observe("feedback", "E2001_CB101_ServoPowerSupply", [choice("1", "1 / true"), choice("0", "0 / false"), choice("unknown", "Not verified")]),
          observe("timerDone", "TON_MonitorMainContactor.DN", [choice("yes", "Done"), choice("no", "Not done"), choice("unknown", "Not verified")])
        ])
      }),
      6: Object.freeze({ family: "Servo logic-supply protection", status: "exact-plc-producer", producer: "XIO(E2001_CB104_FuseServo / I0005.20) -> Faults[0].6", sourceRefs: Object.freeze(["L5K 1664-1665: E2001_CB104_FuseServo = I0005.20", "L5K 17146-17148: Fault 00006 direct rung"]), watchPoints: freezeRows([watch("E2001_CB104_FuseServo / I0005.20", "Servo logic-supply breaker input", "False directly asserts Fault 00006.", "Check the raw input before replacing servo hardware.")]), steps: freezeRows([step(1, "Read I0005.20", "A false state is the direct PLC producer."), step(2, "Separate power protection from servo-internal faults", "Do not jump to the 032-054 servo fault family until the control-voltage protection path is healthy.")]), observations: Object.freeze([observe("protectiveInput", "E2001_CB104_FuseServo", [choice("1", "1 / healthy"), choice("0", "0 / false"), choice("unknown", "Not verified")])]) }),
      7: Object.freeze({ family: "Feed/rewind unit protection", status: "exact-plc-producer", producer: "XIO(E0301_CB202_FuseFeedRewindUnit / I0005.21) -> Faults[0].7", sourceRefs: Object.freeze(["L5K 1652-1653: E0301_CB202_FuseFeedRewindUnit = I0005.21", "L5K 17149-17154: Fault 00007 direct rung"]), watchPoints: freezeRows([watch("E0301_CB202_FuseFeedRewindUnit / I0005.21", "Feed/rewind breaker input", "False directly asserts Fault 00007.", "Resolve this common protection input before treating 009/010 as independent motor failures.")]), steps: freezeRows([step(1, "Read I0005.21", "A false state is the direct producer."), step(2, "Review 009/010 chronology", "If 00007 occurred first, restore the shared feed/rewind protection path before replacing an individual unit.")]), observations: Object.freeze([observe("protectiveInput", "E0301_CB202_FuseFeedRewindUnit", [choice("1", "1 / healthy"), choice("0", "0 / false"), choice("unknown", "Not verified")])]) }),
      8: Object.freeze({ family: "Carriage position alarm text", status: "catalog-only-no-producer", producer: "No executable reference to Faults[0].8 found in the supplied readable export.", sourceRefs: Object.freeze(["L5K Fault array comment: Fault 008 = Carriage not pulled back", "L5K HMI text: 00008 CARRIAGE NOT PULLED BACK", "L5K 1658-1659: E1501_P133_CarriageFront = I0005.27 (related carriage signal, not proven Fault 008 producer)"]), watchPoints: freezeRows([watch("E1501_P133_CarriageFront / I0005.27", "Related carriage-front input", "The source defines this carriage-position signal elsewhere.", "Use it only as related carriage-position evidence while the actual Fault 00008 producer remains unresolved.", "It is not bound to Faults[0].8 in the readable export; do not present it as the proven producer.")]), steps: freezeRows([step(1, "Preserve the alarm text", "The alarm exists in the source catalog."), step(2, "Do not invent a rung", "Verify the live project/revision or another station source if Fault 00008 is active on a machine.")]), observations: Object.freeze([]) }),
      9: Object.freeze({ family: "Feed-unit ready supervision", status: "exact-plc-producer-with-installation-alias-note", producer: "XIO(E5701_MTR611_FeedUnitReady) AND XIO(E2001_CB101_ServoPowerSupply) -> tonFaultFeedUnit 1000 ms -> OTL Faults[0].9", sourceRefs: Object.freeze(["L5K 17093: tonFaultFeedUnit preset 1000 ms", "L5K 17156-17158: Fault 00009 producer", "L5K 17782-17783: installation-phase compatibility rung creates FeedUnitReady from I0005.7 OR I0005.25"]), watchPoints: freezeRows([watch("E5701_MTR611_FeedUnitReady", "Feed-unit logical ready", "False is one required timer condition.", "This export synthesizes the bit through an installation-phase rung."), watch("I0005.7 / I0005.25", "Raw feed-ready inputs", "Either true drives E5701_MTR611_FeedUnitReady in the supplied installation compatibility rung.", "Compare both raw inputs with the logical Ready bit in this exact controller revision.", "The source comment says the temporary rung should be deleted at shipping and the alias changed; verify the live installation/revision."), watch("E2001_CB101_ServoPowerSupply / I0005.22", "Mains-contactor input", "The source timer requires this raw input false as well.", "Preserve raw polarity."), watch("tonFaultFeedUnit.ACC / .DN", "Feed fault timer", "Preset 1000 ms; DN latches Fault 00009.", "Reset does not substitute for restoring Ready.")]), steps: freezeRows([step(1, "Check the logical ready bit", "Confirm whether FeedUnitReady is actually false."), step(2, "Check the raw compatibility inputs", "Because this source is installation-phase logic, compare I0005.7 and I0005.25 before opening the drive."), step(3, "Observe the 1000 ms timer", "Only the source combination that matures the timer directly latches 00009.")]), observations: Object.freeze([observe("ready", "E5701_MTR611_FeedUnitReady", [choice("1", "Ready / 1"), choice("0", "Not ready / 0"), choice("unknown", "Not verified")]), observe("contactorInput", "E2001_CB101_ServoPowerSupply", [choice("1", "1"), choice("0", "0"), choice("unknown", "Not verified")]), observe("timerDone", "tonFaultFeedUnit.DN", [choice("yes", "Done"), choice("no", "Not done"), choice("unknown", "Not verified")])]) }),
      10: Object.freeze({ family: "Rewind-unit ready supervision", status: "exact-plc-producer-with-installation-alias-note", producer: "XIO(E5701_MTR601_RewindUnitReady) AND XIO(E2001_CB101_ServoPowerSupply) -> tonFaultRewindUnit 1000 ms -> OTL Faults[0].10", sourceRefs: Object.freeze(["L5K 17094: tonFaultRewindUnit preset 1000 ms", "L5K 17160-17162: Fault 00010 producer", "L5K 17780-17781: installation-phase compatibility rung creates RewindUnitReady from I0005.6 OR I0005.24"]), watchPoints: freezeRows([watch("E5701_MTR601_RewindUnitReady", "Rewind-unit logical ready", "False is one required timer condition.", "This export synthesizes the bit through an installation-phase rung."), watch("I0005.6 / I0005.24", "Raw rewind-ready inputs", "Either true drives E5701_MTR601_RewindUnitReady in the supplied installation compatibility rung.", "Compare both raw inputs with the logical Ready bit in this exact controller revision.", "The source comment says the temporary rung should be deleted at shipping and the alias changed; verify the live installation/revision."), watch("E2001_CB101_ServoPowerSupply / I0005.22", "Mains-contactor input", "The source timer requires this raw input false as well.", "Preserve raw polarity."), watch("tonFaultRewindUnit.ACC / .DN", "Rewind fault timer", "Preset 1000 ms; DN latches Fault 00010.", "Reset does not substitute for restoring Ready.")]), steps: freezeRows([step(1, "Check the logical ready bit", "Confirm whether RewindUnitReady is actually false."), step(2, "Check the raw compatibility inputs", "Compare I0005.6 and I0005.24 before opening the drive."), step(3, "Observe the 1000 ms timer", "Only the source combination that matures the timer directly latches 00010.")]), observations: Object.freeze([observe("ready", "E5701_MTR601_RewindUnitReady", [choice("1", "Ready / 1"), choice("0", "Not ready / 0"), choice("unknown", "Not verified")]), observe("contactorInput", "E2001_CB101_ServoPowerSupply", [choice("1", "1"), choice("0", "0"), choice("unknown", "Not verified")]), observe("timerDone", "tonFaultRewindUnit.DN", [choice("yes", "Done"), choice("no", "Not done"), choice("unknown", "Not verified")])]) }),
      11: Object.freeze({ family: "Local Ethernet module health", status: "exact-gsv-module-faultcode", producer: "GSV(MODULE,HMI_Communications,FaultCode,EthernetModuleSlot1FaultData); NEQ(...,0) -> Faults[0].11", sourceRefs: Object.freeze(["L5K 583-596: HMI_Communications = 1756-ENBT/A, local Slot 1", "L5K 17164-17168: Fault 00011 GSV producer"]), watchPoints: freezeRows([watch("EthernetModuleSlot1FaultData", "Slot 1 module FaultCode", "Non-zero is the direct current producer.", "Read the actual module fault code instead of replacing network hardware from alarm text alone."), watch("Pulse_DataEthernetReceived", "Ethernet data pulse", "Participates in the fault self-hold branch.", "Use chronology if the module fault code has already recovered.")]), steps: freezeRows([step(1, "Read the GSV destination", "Capture EthernetModuleSlot1FaultData."), step(2, "Open Slot 1 diagnostics", "HMI_Communications is a 1756-ENBT/A in local Slot 1 in this source.")]), observations: Object.freeze([observe("moduleFault", "EthernetModuleSlot1FaultData", [choice("nonzero", "Non-zero"), choice("zero", "0"), choice("unknown", "Not verified")])]) }),
      12: Object.freeze({ family: "Local Ethernet module health", status: "exact-gsv-module-faultcode", producer: "GSV(MODULE,Ethernet_IO_1,FaultCode,EthernetModuleSlot2FaultData); NEQ(...,0) -> Faults[0].12", sourceRefs: Object.freeze(["L5K 598-611: Ethernet_IO_1 = 1756-ENBT/A, local Slot 2", "L5K 17170-17174: Fault 00012 GSV producer"]), watchPoints: freezeRows([watch("EthernetModuleSlot2FaultData", "Slot 2 module FaultCode", "Non-zero is the direct current producer.", "Capture the code before reset/power-cycle."), watch("Ethernet_IO_1", "Local Slot 2 module", "Catalog 1756-ENBT/A in the supplied source.", "Do not confuse this chassis module with a downstream device connection.")]), steps: freezeRows([step(1, "Read the GSV destination", "Capture EthernetModuleSlot2FaultData."), step(2, "Open Slot 2 diagnostics", "Use the module's own status before checking downstream nodes.")]), observations: Object.freeze([observe("moduleFault", "EthernetModuleSlot2FaultData", [choice("nonzero", "Non-zero"), choice("zero", "0"), choice("unknown", "Not verified")])]) }),
      13: Object.freeze({ family: "Local Ethernet module health", status: "exact-gsv-module-faultcode", producer: "GSV(MODULE,Ethernet_IO_2,FaultCode,EthernetModuleSlot4FaultData); NEQ(...,0) -> Faults[0].13", sourceRefs: Object.freeze(["L5K 613-627: Ethernet_IO_2 = 1756-ENBT/A, local Slot 4; NodeAddress 10.107.204.191", "L5K 17176-17180: Fault 00013 GSV producer"]), watchPoints: freezeRows([watch("EthernetModuleSlot4FaultData", "Slot 4 module FaultCode", "Non-zero is the direct current producer.", "Capture the code before reset/power-cycle."), watch("Ethernet_IO_2", "Local Slot 4 module", "Catalog 1756-ENBT/A; source NodeAddress 10.107.204.191.", "Treat the address as source configuration for this controller revision, not a universal Cart address.")]), steps: freezeRows([step(1, "Read the GSV destination", "Capture EthernetModuleSlot4FaultData."), step(2, "Open Slot 4 diagnostics", "Use the local module state before assuming an HMI endpoint failure.")]), observations: Object.freeze([observe("moduleFault", "EthernetModuleSlot4FaultData", [choice("nonzero", "Non-zero"), choice("zero", "0"), choice("unknown", "Not verified")])]) }),
      14: Object.freeze({ family: "Level-3/base-machine communication state", status: "exact-latched-plc-producer", producer: "Loss edge of ETH_Com.ReadyForETHConnect_L3 OR Data_From_PV.Data[2] = 100/101 -> OTL Faults[0].14", sourceRefs: Object.freeze(["L5K 17080-17091: Level-3 communication one-shots/data pulse state", "L5K 17182-17184: Fault 00014 latch/reset logic"]), watchPoints: freezeRows([watch("ETH_Com.ReadyForETHConnect_L3", "Level-3 Ethernet readiness", "A transition to not-ready through ONS_NoEthernetConnectL3 latches the fault.", "Preserve the transition chronology; a recovered current state can hide the initiating event."), watch("Data_From_PV.Data[2]", "PanelView/HMI communication screen/state", "Values 100 or 101 are explicit latch branches in the source rung.", "Do not reinterpret these numeric states without the matching HMI project."), watch("PV_General.PWLevelActual / ControlOut.ResetGeneral", "Reset qualification", "Participates in the unlatch branches.", "Do not force reset or password-level values.")]), steps: freezeRows([step(1, "Check Level-3 readiness", "Determine whether ReadyForETHConnect_L3 dropped before the alarm."), step(2, "Record Data_From_PV.Data[2]", "100/101 are source latch states."), step(3, "Use chronology", "A current ready state does not disprove an earlier communication loss because the fault is latched.")]), observations: Object.freeze([observe("readyL3", "ETH_Com.ReadyForETHConnect_L3", [choice("1", "Ready / 1"), choice("0", "Not ready / 0"), choice("unknown", "Not verified")]), observe("pvState", "Data_From_PV.Data[2]", [choice("100or101", "100 or 101"), choice("other", "Other value"), choice("unknown", "Not verified")])]) }),
      15: Object.freeze({ family: "1756-OB16E electronic fuse diagnostics", status: "exact-module-fuse-producer", producer: "NEQ(Local:7:I.FuseBlown,0) -> Faults[0].15; reset captures FuseBlown and issues MSG_FuseResetOutputModule", sourceRefs: Object.freeze(["L5K 725-741: EEP_APL_Slot7 = 1756-OB16E, local Slot 7", "L5K 17186-17190: FuseBlown producer and reset-message path"]), watchPoints: freezeRows([watch("Local:7:I.FuseBlown", "Slot 7 electronic fuse bitmap/value", "Any non-zero value directly asserts Fault 00015.", "Record the non-zero value before reset so the affected output channel can be isolated."), watch("FuseResetMsg / MSG_FuseResetOutputModule", "Source reset diagnostic path", "On ResetGeneral, the PLC copies FuseBlown to FuseResetMsg and sends the module reset message.", "Do not repeatedly reset an unresolved short/overload condition.")]), steps: freezeRows([step(1, "Capture FuseBlown", "Record the non-zero value/channel evidence before reset."), step(2, "Trace the affected output", "Use the slot/channel wiring only after the module identifies the fuse condition."), step(3, "Reset after correction", "The source has a defined module fuse-reset message; do not use it to mask an active electrical fault.")]), observations: Object.freeze([observe("fuseBlown", "Local:7:I.FuseBlown", [choice("nonzero", "Non-zero"), choice("zero", "0"), choice("unknown", "Not verified")])]) }),
      16: Object.freeze({ family: "Motion group synchronization", status: "exact-plc-producer", producer: "XIO(MotionGroup.GroupSynced) AND XIC(PowerOnReset) -> Faults[1].0", sourceRefs: Object.freeze(["L5K 13934-13938: MotionGroup configuration", "L5K 17192-17196: Fault 00016 direct producer"]), watchPoints: freezeRows([watch("MotionGroup.GroupSynced", "Controller motion-group synchronization", "False after PowerOnReset directly asserts Fault 00016.", "Diagnose the motion group and member axes before changing motion parameters."), watch("PowerOnReset", "Power-on qualification", "Required true gate for the source fault rung.", "A startup transient before qualification is not the same source condition.")]), steps: freezeRows([step(1, "Read GroupSynced", "Confirm the group state after PowerOnReset."), step(2, "Review member-axis faults", "Use the first axis/module fault in chronology rather than treating GroupSynced as the root cause automatically.")]), observations: Object.freeze([observe("groupSynced", "MotionGroup.GroupSynced", [choice("1", "Synced / 1"), choice("0", "Not synced / 0"), choice("unknown", "Not verified")]), observe("powerOnReset", "PowerOnReset", [choice("1", "Qualified / 1"), choice("0", "0"), choice("unknown", "Not verified")])]) }),
      17: Object.freeze({ family: "Main-drive feedback-on command execution", status: "exact-latched-motion-instruction-producer", producer: "MainDrive.MTags.MSO[0].ER AND .EN AND MainDrive.SData.Status.ReadyForFeedbackON -> OTL Faults[1].1", sourceRefs: Object.freeze(["L5K 14584: ReadyForFeedbackON qualification", "L5K 17198-17202: Fault 00017 latch/reset producer"]), watchPoints: freezeRows([watch("MainDrive.MTags.MSO[0].ER", "MSO instruction error", "Must be true in the direct latch condition.", "Preserve the MSO error evidence before reset."), watch("MainDrive.MTags.MSO[0].EN", "MSO instruction enabled", "Must be true with ER.", "Confirms the feedback-on command was active."), watch("MainDrive.SData.Status.ReadyForFeedbackON", "Feedback-on readiness", "Must also be true for the source latch.", "If false, diagnose the upstream readiness path instead of calling it direct Fault 00017 producer.")]), steps: freezeRows([step(1, "Capture MSO ER/EN", "Read both instruction status bits at the event."), step(2, "Confirm ReadyForFeedbackON", "The source requires readiness true simultaneously."), step(3, "Use the motion instruction error detail", "Do not replace the drive solely from the HMI alarm text.")]), observations: Object.freeze([observe("msoError", "MainDrive.MTags.MSO[0].ER", [choice("1", "ER = 1"), choice("0", "ER = 0"), choice("unknown", "Not verified")]), observe("msoEnable", "MainDrive.MTags.MSO[0].EN", [choice("1", "EN = 1"), choice("0", "EN = 0"), choice("unknown", "Not verified")]), observe("readyFeedback", "ReadyForFeedbackON", [choice("1", "Ready / 1"), choice("0", "Not ready / 0"), choice("unknown", "Not verified")])]) }),
      18: Object.freeze({ family: "Calculated synchronization-distance validity", status: "exact-calculated-producer", producer: "LES(LabelingData.Sync_Distance,0) -> Faults[1].2", sourceRefs: Object.freeze(["L5K 17204-17208: Fault 00018 direct comparison", "L5K 17686: ACC_Time, ACC_Distance and Sync_Distance calculation"]), watchPoints: freezeRows([watch("LabelingData.Sync_Distance", "Calculated synchronization distance", "A value below zero directly asserts Fault 00018.", "The zero threshold is executable PLC logic, not an adjustment recommendation."), watch("LabelingData.LabelLength", "Label length input", "Sync_Distance = LabelLength - ACC_Distance - ACC_Distance.", "Verify the actual recipe/source value before changing it."), watch("LabelingData.ACC_Time / ACC_Distance", "Acceleration calculation", "ACC_Time = SyncVelocity / MaxAcceleration; ACC_Distance = SyncVelocity * ACC_Time / 2.", "Use the formula chain to find which upstream value made Sync_Distance negative.")]), steps: freezeRows([step(1, "Confirm Sync_Distance", "Negative is the direct source condition."), step(2, "Work upstream through the calculation", "Compare LabelLength, SyncVelocity, MaxAcceleration, ACC_Time and ACC_Distance."), step(3, "Do not tune to clear the alarm", "Correct the invalid machine/recipe condition rather than changing a threshold.")]), observations: Object.freeze([observe("syncDistance", "LabelingData.Sync_Distance", [choice("negative", "< 0"), choice("nonnegative", ">= 0"), choice("unknown", "Not verified")])]) }),
      19: Object.freeze({ family: "Calculated movement-time validity", status: "exact-calculated-producer", producer: "GRT(LabelingData.OverallMovementPercent,125) -> Faults[1].3", sourceRefs: Object.freeze(["L5K 17210-17214: Fault 00019 direct comparison", "L5K 17688: Sync_Time, Move_Time, TimeOneCycle and OverallMovementPercent calculation"]), watchPoints: freezeRows([watch("LabelingData.OverallMovementPercent", "Calculated movement percentage", "A value greater than 125 directly asserts Fault 00019.", "Trace the upstream movement-time calculation before changing any recipe or motion parameter.", "125 is an internal PLC decision threshold in this revision, not a field acceptance target to change."), watch("LabelingData.Move_Time", "Calculated movement time", "Move_Time = ACC_Time + ACC_Time + Sync_Time.", "Trace the calculation rather than editing the fault threshold."), watch("LabelingData.TimeOneCycle", "Available cycle time", "TimeOneCycle = 1 / (MaxSpeed / 3600); OverallMovementPercent = 100 * Move_Time / TimeOneCycle.", "Verify machine-speed/recipe inputs used by the calculation.")]), steps: freezeRows([step(1, "Confirm OverallMovementPercent", ">125 is the direct source condition."), step(2, "Trace timing inputs", "Review Move_Time, TimeOneCycle, ACC_Time, Sync_Time and MaxSpeed."), step(3, "Keep the 125 threshold read-only", "Treat it as source evidence, not a troubleshooting parameter to adjust.")]), observations: Object.freeze([observe("movementPercent", "LabelingData.OverallMovementPercent", [choice("over125", "> 125"), choice("atOrBelow125", "<= 125"), choice("unknown", "Not verified")])]) })
    });

    function numberFrom(value) {
      if (typeof value === "object" && value) return Number(value.number ?? String(value.code || "").replace(/^0+/, ""));
      const text = String(value ?? "").trim();
      return /^0*\d+$/.test(text) ? Number(text) : NaN;
    }

    function getAplCartFoundationPlan(value) {
      const number = numberFrom(value);
      const plan = PLANS[number];
      const entry = ENTRIES.find((row) => row.number === number);
      if (!plan || !entry) return null;
      return Object.freeze({ id: `apl-cart-foundation-${code(number)}`, number, code: code(number), title: TITLES[number], scope: "LB1 APL Cart 1 / station controller", entry, source: SOURCE, safety: SAFETY, ...plan });
    }

    function normalizeObservation(observation = {}) {
      return Object.fromEntries(Object.entries(observation).map(([key, value]) => [key, String(value ?? "unknown")]));
    }

    function evaluateAplCartFoundation(value, observation = {}) {
      const plan = getAplCartFoundationPlan(value);
      if (!plan) return null;
      const o = normalizeObservation(observation);
      switch (plan.number) {
        case 5: {
          if (["0", "1"].includes(o.command) && ["0", "1"].includes(o.feedback)) {
            if (o.command === o.feedback && o.timerDone === "yes") return result("main-contactor-source-condition", "direct", "The source timer condition has matured", "The two raw contactor bits are in the same Boolean state and TON_MonitorMainContactor.DN is done. This matches the supplied Fault 00005 producer.", "Preserve the raw states and trace the Cart contactor circuit; do not reinterpret polarity from the tag names alone.");
            if (o.command === o.feedback) return result("main-contactor-timing", "observe", "The source timer condition is present", "The raw bits are in the same Boolean state, which enables the 1500 ms monitor in the supplied rung.", "Observe TON_MonitorMainContactor.ACC/.DN before opening hardware.");
            return result("main-contactor-condition-not-current", "observe", "The direct timer condition is not currently present", "The supplied rung times the equal-state combinations; the two raw bits currently differ.", "Use alarm chronology to determine whether the source condition existed before recovery.");
          }
          return result("main-contactor-observe", "observe", "Capture both raw contactor states", "Fault 00005 is source-precise only when O0007.11, I0005.22 and the 1500 ms timer are observed together.");
        }
        case 6:
        case 7: {
          if (o.protectiveInput === "0") return result("protection-input-direct", "direct", "Protection input is false", `This directly matches Fault ${plan.code}'s XIO producer.`, "Resolve the protection/power path before downstream drive diagnosis.");
          if (o.protectiveInput === "1") return result("protection-input-recovered", "observe", "Protection input is currently healthy", "The current raw input does not reproduce the direct source condition.", "Preserve chronology and check whether it recovered after the event.");
          return result("protection-input-observe", "observe", "Read the protection input", "The direct source condition is a single raw PLC input.");
        }
        case 8:
          return result("catalog-only-no-producer", "hold", "Alarm text is source-backed but the producer is not", "The readable export contains Fault 00008 text but no executable Faults[0].8 reference. ServoForge will not invent a rung.", "If this alarm is live, capture the online controller revision and the actual active logic before assigning a cause.");
        case 9:
        case 10: {
          if (o.ready === "0" && o.contactorInput === "0" && o.timerDone === "yes") return result("unit-ready-timer-direct", "direct", "Ready supervision timer has matured", `The source conditions for Fault ${plan.code} are present and its 1000 ms timer is done.`, "Compare the logical Ready bit with the raw installation-phase compatibility inputs before opening the unit drive.");
          if (o.ready === "0" && o.contactorInput === "0") return result("unit-ready-timing", "observe", "The source timer conditions are present", "The source will time this state for 1000 ms before latching the fault.", "Observe the timer and underlying raw Ready inputs.");
          return result("unit-ready-not-current", "observe", "The direct timer condition is not fully present", "Current observations do not reproduce both XIO conditions together.", "Use event chronology and verify the source's installation-phase Ready-bit mapping.");
        }
        case 11:
        case 12:
        case 13: {
          if (o.moduleFault === "nonzero") return result("ethernet-module-faultcode-direct", "direct", "Module FaultCode is non-zero", `This is the direct GSV producer for Fault ${plan.code}.`, "Record the numeric FaultCode and open that local module's diagnostics before checking downstream devices.");
          if (o.moduleFault === "zero") return result("ethernet-module-faultcode-clear", "observe", "Module FaultCode is currently zero", "The current state does not reproduce the direct GSV producer.", "Use alarm/module history to determine whether the local module recovered.");
          return result("ethernet-module-observe", "observe", "Read the local module FaultCode", "The GSV destination is the highest-value first checkpoint.");
        }
        case 14: {
          if (o.readyL3 === "0" || o.pvState === "100or101") return result("base-machine-comms-direct", "direct", "A source latch branch is present", "Level-3 readiness is absent or the HMI state is 100/101, matching a Fault 00014 latch branch.", "Preserve chronology and isolate whether the initiating event was Ethernet readiness loss or the HMI communication state.");
          if (o.readyL3 === "1" && o.pvState === "other") return result("base-machine-comms-currently-clear", "observe", "Current communication state looks recovered", "Because 00014 is latched, a healthy current state does not rule out an earlier loss edge.", "Review alarm chronology and communication transitions around the event.");
          return result("base-machine-comms-observe", "observe", "Capture Level-3 readiness and HMI state", "Both are explicit source inputs to the latch/reset logic.");
        }
        case 15: {
          if (o.fuseBlown === "nonzero") return result("output-fuse-direct", "direct", "Slot 7 FuseBlown is non-zero", "This directly asserts Fault 00015 on the source 1756-OB16E module.", "Record the FuseBlown value before reset and isolate the affected output/channel wiring.");
          if (o.fuseBlown === "zero") return result("output-fuse-clear", "observe", "FuseBlown is currently zero", "The current module state does not reproduce the direct producer.", "Use saved/alarm evidence if the fuse state cleared after reset.");
          return result("output-fuse-observe", "observe", "Read Local:7:I.FuseBlown", "The module exposes the direct source condition.");
        }
        case 16: {
          if (o.groupSynced === "0" && o.powerOnReset === "1") return result("motion-group-direct", "direct", "Motion group is not synchronized after power-on qualification", "This exactly matches Fault 00016's source rung.", "Review the first member-axis/module fault that prevented GroupSynced.");
          if (o.groupSynced === "1") return result("motion-group-currently-synced", "observe", "Motion group is currently synchronized", "The direct source condition is not currently present.", "Use chronology if the group recovered after the event.");
          return result("motion-group-observe", "observe", "Read GroupSynced after PowerOnReset", "Both source states are required to classify the fault precisely.");
        }
        case 17: {
          if (o.msoError === "1" && o.msoEnable === "1" && o.readyFeedback === "1") return result("mso-feedback-on-direct", "direct", "MSO feedback-on error condition is present", "ER, EN and ReadyForFeedbackON are all true, matching the source latch for Fault 00017.", "Capture the motion-instruction error detail before reset and trace the upstream feedback-on sequence.");
          return result("mso-feedback-on-observe", "observe", "Capture MSO ER/EN and readiness together", "All three source conditions must be true simultaneously for the direct latch.");
        }
        case 18: {
          if (o.syncDistance === "negative") return result("sync-distance-direct", "direct", "Calculated Sync_Distance is negative", "This directly asserts Fault 00018.", "Trace LabelLength, SyncVelocity, MaxAcceleration, ACC_Time and ACC_Distance upstream; do not change the zero threshold.");
          if (o.syncDistance === "nonnegative") return result("sync-distance-currently-valid", "observe", "Sync_Distance is currently non-negative", "The direct source comparison is not currently true.", "Use the recipe/calculation state from the fault event if available.");
          return result("sync-distance-observe", "observe", "Read LabelingData.Sync_Distance", "The direct fault is a calculated-value comparison.");
        }
        case 19: {
          if (o.movementPercent === "over125") return result("movement-percent-direct", "direct", "OverallMovementPercent is above 125", "This directly asserts Fault 00019 in the supplied revision.", "Trace Move_Time and TimeOneCycle inputs; keep the 125 source threshold read-only.");
          if (o.movementPercent === "atOrBelow125") return result("movement-percent-currently-valid", "observe", "OverallMovementPercent is currently at or below 125", "The direct source comparison is not currently true.", "Use the calculated values from the event if the alarm recovered.");
          return result("movement-percent-observe", "observe", "Read LabelingData.OverallMovementPercent", "The direct fault is a calculated-value comparison.");
        }
        default: return null;
      }
    }

    function aplScore(entry, query, context = {}) {
      const q = base.normalize(query);
      if (!q) return 0;
      const compact = q.replaceAll(" ", "");
      const codeCompact = base.normalize(entry.code).replaceAll(" ", "");
      let score = compact === codeCompact ? 1000 : 0;
      const text = base.normalize([entry.code, entry.title, entry.summary, ...(entry.aliases || [])].join(" "));
      if (base.normalize(entry.title).includes(q)) score += 80;
      for (const term of q.split(" ").filter((term) => term.length > 1)) if (text.includes(term)) score += 8;
      if (base.normalize(context.applicationMode) === "apl") score += 20;
      return score;
    }

    const baseSearchEntries = base.searchEntries.bind(base);
    function searchEntries(query, context = {}, limit = 8) {
      const apl = ENTRIES.map((entry) => ({ ...entry, searchScore: aplScore(entry, query, context) })).filter((entry) => entry.searchScore > 0);
      const existing = baseSearchEntries(query, context, Math.max(8, limit));
      const merged = [...apl, ...existing].sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0) || a.title.localeCompare(b.title));
      const seen = new Set();
      return merged.filter((entry) => !seen.has(entry.id) && seen.add(entry.id)).slice(0, Math.max(1, Number(limit) || 8));
    }

    const baseSearchSources = base.searchSources.bind(base);
    function searchSources(query, limit = 20) {
      const q = base.normalize(query);
      const sourceText = base.normalize([SOURCE.title, SOURCE.file, SOURCE.kind, ...(SOURCE.topics || [])].join(" "));
      const include = !q || q.split(" ").filter(Boolean).some((term) => sourceText.includes(term));
      const existing = baseSearchSources(query, Math.max(20, limit));
      const merged = include ? [SOURCE, ...existing] : existing;
      const seen = new Set();
      return merged.filter((source) => !seen.has(source.id) && seen.add(source.id)).slice(0, Math.max(1, Number(limit) || 20));
    }

    function getEntry(id) { return ENTRIES.find((entry) => entry.id === id) || base.getEntry(id); }
    function getSource(id) { return id === SOURCE.id ? SOURCE : base.getSource(id); }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      if (SUPPORTED.length !== 15 || SUPPORTED[0] !== 5 || SUPPORTED.at(-1) !== 19) errors.push("v355 APL Cart foundation range changed unexpectedly.");
      if (getAplCartFoundationPlan(8)?.status !== "catalog-only-no-producer") errors.push("Fault 00008 must remain catalog-only until an executable producer is verified.");
      if (!/1500/.test(getAplCartFoundationPlan(5)?.producer || "")) errors.push("Fault 00005 lost the 1500 ms source monitor.");
      if (!getAplCartFoundationPlan(9)?.watchPoints.some((row) => /I0005\.7 \/ I0005\.25/.test(row.tag))) errors.push("Fault 00009 lost installation-phase raw Ready inputs.");
      if (!getAplCartFoundationPlan(10)?.watchPoints.some((row) => /I0005\.6 \/ I0005\.24/.test(row.tag))) errors.push("Fault 00010 lost installation-phase raw Ready inputs.");
      if (!/Slot 1/.test(getAplCartFoundationPlan(11)?.sourceRefs.join(" ") || "") || !/Slot 2/.test(getAplCartFoundationPlan(12)?.sourceRefs.join(" ") || "") || !/Slot 4/.test(getAplCartFoundationPlan(13)?.sourceRefs.join(" ") || "")) errors.push("Ethernet slot source mapping changed unexpectedly.");
      if (!/FuseBlown/.test(getAplCartFoundationPlan(15)?.producer || "")) errors.push("Fault 00015 lost Slot 7 FuseBlown producer.");
      if (!/GroupSynced/.test(getAplCartFoundationPlan(16)?.producer || "")) errors.push("Fault 00016 lost MotionGroup.GroupSynced producer.");
      if (!/MSO\[0\]\.ER/.test(getAplCartFoundationPlan(17)?.producer || "")) errors.push("Fault 00017 lost MSO error producer.");
      if (!/Sync_Distance,0/.test(getAplCartFoundationPlan(18)?.producer || "")) errors.push("Fault 00018 lost negative synchronization-distance comparison.");
      if (!/125/.test(getAplCartFoundationPlan(19)?.producer || "")) errors.push("Fault 00019 lost the source 125 movement threshold.");
      if (evaluateAplCartFoundation(5, { command: "1", feedback: "1", timerDone: "yes" })?.code !== "main-contactor-source-condition") errors.push("Fault 00005 evaluator lost direct source state.");
      if (evaluateAplCartFoundation(15, { fuseBlown: "nonzero" })?.code !== "output-fuse-direct") errors.push("Fault 00015 evaluator lost direct source state.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+apl-cart-foundation-v355`,
      sources: Object.freeze([SOURCE, ...(base.sources || [])]),
      entries: Object.freeze([...ENTRIES, ...(base.entries || [])]),
      getEntry,
      getSource,
      searchEntries,
      searchSources,
      getAplCartFoundationPlan,
      evaluateAplCartFoundation,
      aplCartFoundationFaults: SUPPORTED,
      aplCartFoundationSource: SOURCE,
      validate
    });
  };
});
