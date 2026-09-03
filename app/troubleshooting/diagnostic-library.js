"use strict";

(function installServoForgeTroubleshootingLibrary(root, factory) {
  const library = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = library;
  if (root) root.ServoForgeTroubleshootingLibrary = library;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTroubleshootingLibrary() {
  const SOURCE_KIND = Object.freeze({
    OEM_TRAINING: "OEM training",
    PROCEDURE: "Procedure",
    SCHEMATIC: "Electrical schematic",
    CONTROL_PROJECT: "PLC/control project",
    FIELD_REFERENCE: "Field reference",
    LINK: "External document shortcut",
    TEMPORARY: "Temporary Office file"
  });

  const sources = Object.freeze([
    { id: "rpc-dts5-2011", title: "Krones Rotary Plate Control (DTS-5)", file: "0001_RPC-DTS5_622_2011_EN_ppt.pdf", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["RPC", "DTS5", "servo motors", "CAN", "AC/DC converter", "diagnostics", "encoder"], notes: "Krones Academy training covering RPC hardware, CAN layout, servo replacement, RPC diagnostics and parameters." },
    { id: "gop-embossing-orientation", title: "Orientator – Commissioning of a New Bottle with Embossing", file: "0003_GOP_Ausrichtung_Embossing_v5.1_EN[1].pdf", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["orientation", "DART", "embossing", "camera", "new bottle", "commissioning"] },
    { id: "orientation-hardware-rpc", title: "Krones DRP Camera Orientation for Labellers with RPC (DTS5)", file: "0004_Hardware_Ausrichtung_EN[1]_ppt.pdf", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["orientation", "DRP", "camera", "trigger device", "CAN", "24V", "DTS5"] },
    { id: "dartplus-11-en-000-965", title: "KRONES DARTplus Container Orientation System", file: "11-EN-000-965.pdf", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["DARTplus", "orientation", "RPC synchronization", "camera", "trigger", "CAN", "troubleshooting"] },
    { id: "apl-schematic-605576", title: "APL Schematic 605576", file: "605576 (APL) Schematic.pdf", kind: SOURCE_KIND.SCHEMATIC, status: "visual-reference", topics: ["APL", "electrical", "schematic"] },
    { id: "electrical-schematic-747-993", title: "Electrical Schematic 747-993", file: "747-993 Electrical Schematic.pdf", kind: SOURCE_KIND.SCHEMATIC, status: "indexed", topics: ["electrical", "schematic", "wiring", "devices"] },
    { id: "apl-contactor-figure-1", title: "APL Main Contactor Reference Figure 1", file: "APL Main Contactor Faults/20090610014742309_0001.pdf", kind: SOURCE_KIND.FIELD_REFERENCE, status: "visual-reference", topics: ["APL", "main contactor", "Harting", "aggregate"] },
    { id: "apl-contactor-figure-2", title: "APL Main Contactor Reference Figure 2", file: "APL Main Contactor Faults/20090610014742309_0002.pdf", kind: SOURCE_KIND.FIELD_REFERENCE, status: "visual-reference", topics: ["APL", "main contactor", "Harting", "aggregate"] },
    { id: "apl-contactor-figure-3", title: "APL Main Contactor Reference Figure 3", file: "APL Main Contactor Faults/20090610014742309_0003.pdf", kind: SOURCE_KIND.FIELD_REFERENCE, status: "visual-reference", topics: ["APL", "main contactor", "guard switch", "safety"] },
    { id: "apl-contactor-figure-4", title: "APL Main Contactor Reference Figure 4", file: "APL Main Contactor Faults/20090610014742309_0004.pdf", kind: SOURCE_KIND.FIELD_REFERENCE, status: "visual-reference", topics: ["APL", "main contactor", "HMI", "station"] },
    { id: "apl-contactor-figure-5", title: "APL Main Contactor Reference Figure 5", file: "APL Main Contactor Faults/20090610014742309_0005.pdf", kind: SOURCE_KIND.FIELD_REFERENCE, status: "visual-reference", topics: ["APL", "main contactor", "aggregate"] },
    { id: "apl-main-contactor-remedy", title: "How to Remedy APL Main Contactor Faults", file: "APL Main Contactor Faults/How to Remedy APL Main Contactor Faults.doc", kind: SOURCE_KIND.PROCEDURE, status: "indexed", topics: ["APL", "main contactor", "Harting", "guard switch", "docking sensor", "rewind", "safety circuit"] },
    { id: "apl-main-contactor-office-lock", title: "Temporary Office Lock File – APL Main Contactor Procedure", file: "APL Main Contactor Faults/~$w to Remedy APL Main Contactor Faults.doc", kind: SOURCE_KIND.TEMPORARY, status: "metadata-only", topics: ["temporary", "Office"] },
    { id: "kinetix-6000-shortcut", title: "Allen-Bradley Kinetix 6000 Multi-Axis Servo Drive Manual Shortcut", file: "Allen Bradley Kinetix 6000 Multi-Axis Servo Drive Manual.pdf.lnk", kind: SOURCE_KIND.LINK, status: "link-only", topics: ["Allen-Bradley", "Kinetix 6000", "servo drive"] },
    { id: "lb1-aplcart-1", title: "CO85 LB1 APL Cart 1 Control Project", file: "CO85_LB1_APLCart_1.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB1", "APL", "cart 1", "PLC", "control logic"] },
    { id: "lb1-aplcart-2", title: "CO85 LB1 APL Cart 2 Control Project", file: "CO85_LB1_APLCart_2.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB1", "APL", "cart 2", "PLC", "control logic"] },
    { id: "lb1-aplcart-3", title: "CO85 LB1 APL Cart 3 Control Project", file: "CO85_LB1_APLCart_3.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB1", "APL", "cart 3", "PLC", "control logic"] },
    { id: "lb1-aplcart-4", title: "CO85 LB1 APL Cart 4 Control Project", file: "CO85_LB1_APLCart_4.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB1", "APL", "cart 4", "PLC", "control logic"] },
    { id: "lb1-aplcart-5", title: "CO85 LB1 APL Cart 5 Control Project", file: "CO85_LB1_APLCart_5.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB1", "APL", "cart 5", "PLC", "control logic"] },
    { id: "lb1-aplcart-6", title: "CO85 LB1 APL Cart 6 Control Project", file: "CO85_LB1_APLCart_6.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB1", "APL", "cart 6", "PLC", "control logic"] },
    { id: "lb1-labeler", title: "CO85 LB1 Labeler Control Project", file: "CO85_LB1_Labeler_1.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB1", "labeler", "PLC", "control logic"] },
    { id: "lb2-aplcart-1", title: "CO85 LB2 APL Cart 1 Control Project", file: "CO85_LB2_APLCart_1.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB2", "APL", "cart 1", "PLC", "control logic"] },
    { id: "lb2-aplcart-2", title: "CO85 LB2 APL Cart 2 Control Project", file: "CO85_LB2_APLCart_2.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB2", "APL", "cart 2", "PLC", "control logic"] },
    { id: "lb2-aplcart-3", title: "CO85 LB2 APL Cart 3 Control Project", file: "CO85_LB2_APLCart_3.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB2", "APL", "cart 3", "PLC", "control logic"] },
    { id: "lb2-aplcart-4", title: "CO85 LB2 APL Cart 4 Control Project", file: "CO85_LB2_APLCart_4.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB2", "APL", "cart 4", "PLC", "control logic"] },
    { id: "lb2-aplcart-5", title: "CO85 LB2 APL Cart 5 Control Project", file: "CO85_LB2_APLCart_5.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB2", "APL", "cart 5", "PLC", "control logic"] },
    { id: "lb2-aplcart-6", title: "CO85 LB2 APL Cart 6 Control Project", file: "CO85_LB2_APLCart_6.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB2", "APL", "cart 6", "PLC", "control logic"] },
    { id: "lb2-labeler", title: "CO85 LB2 Labeler Control Project", file: "CO85_LB2_Labeler_2.ACD", kind: SOURCE_KIND.CONTROL_PROJECT, status: "binary-reference", topics: ["LB2", "labeler", "PLC", "control logic"] },
    { id: "krones-schematic-tutorial-r3", title: "Krones Schematic Tutorial R3", file: "Krones Schematic Tutorial R3.pdf", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["schematics", "electrical", "drawing navigation", "symbols"] },
    { id: "danfoss-servo-fault-messages", title: "Danfoss Servo Bottle Table Fault Messages", file: "Labeler Danfoss Servo  How to Trouble servo bottle table fault messages.doc", kind: SOURCE_KIND.PROCEDURE, status: "indexed", topics: ["Danfoss", "servo", "bottle table", "fault messages", "CAN", "encoder"] },
    { id: "danfoss-servo-bottle-plate-system", title: "Danfoss Servo Bottle Plate System", file: "Labeler Danfoss servo bottle plate system.doc", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["Danfoss", "servo", "bottle plate", "Power PC", "Y Box", "SSI encoder", "CAN-IO", "diagnostics"] },
    { id: "schematic-tutorial-r3", title: "Schematic Tutorial R3", file: "Schematic Tutorial R3.pdf", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["schematics", "electrical", "drawing navigation", "symbols"] },
    { id: "tm210-automation-studio-basics", title: "Automation Studio – The Basics (TM210)", file: "TM210TRE.25-ENG.pdf", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["B&R", "Automation Studio", "projects", "variables", "programming"] },
    { id: "tm211-online-communication", title: "Automation Studio Online Communication (TM211)", file: "TM211TRE.25-ENG.pdf", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["B&R", "Automation Studio", "online connection", "routing", "remote maintenance"] },
    { id: "tm213-runtime", title: "Automation Runtime (TM213)", file: "TM213TRE.25-ENG.pdf", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["B&R", "Automation Runtime", "boot", "tasks", "I/O", "operating states"] },
    { id: "tm223-diagnostics", title: "Automation Studio Diagnostics (TM223)", file: "TM223TRE.25-ENG.pdf", kind: SOURCE_KIND.OEM_TRAINING, status: "indexed", topics: ["B&R", "Automation Studio", "diagnostics", "logger", "watch", "trace", "debugger", "profiler"] }
  ]);

  const safety = Object.freeze({
    observe: "Observation and HMI/software checks only. Do not defeat guards or safety devices.",
    loto: "Stop the machine and follow site lockout/tagout and stored-energy procedures before opening guards, reseating power/servo connections, or working inside electrical enclosures.",
    electrical: "Voltage measurements and energized electrical diagnostics must be performed only by personnel qualified under the site's electrical safe-work program and the applicable OEM procedure.",
    servo: "Prevent servo motion before programming, replacement, cabling, or mechanical inspection. Verify the machine cannot rotate or re-enable unexpectedly."
  });

  const entries = Object.freeze([
    {
      id: "servo-power-timeout", code: "SERVOPOWER_TIMEOUT", number: 1, category: "Servo / Bottle Plate", aliases: ["servo power timeout", "servo power", "200s"],
      title: "ServoPower signal did not arrive", summary: "The RPC/YMaster waited more than 200 seconds for ServoPower at the CAN-IO box.",
      probableCauses: ["PLC did not enable the DC/DC converter", "ServoPower signal is not reaching the CAN-IO box", "DC/DC converter control path is not enabled"],
      checks: ["Check the ServoPower signal in the PLC/HMI diagnostics.", "Check the DC/DC converter control input.", "Check the ServoPower bit at the CAN-IO box before moving into component-level work."],
      actions: ["Restore the missing enable/control condition before resetting the servo system.", "If the control signal is present but drive voltage is not, continue with qualified electrical troubleshooting of the converter/power path."],
      safety: [safety.observe, safety.electrical],
      sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #1 – SERVOPOWER_TIMEOUT" }, { sourceId: "danfoss-servo-bottle-plate-system", locator: "Hardware / CAN-IO / DC-DC converter overview" }]
    },
    {
      id: "servo-enable-timeout", code: "SERVOENABLE_TIMEOUT", number: 2, category: "Servo / Bottle Plate", aliases: ["servo enable timeout", "servo enable"],
      title: "ServoEnable signal did not arrive", summary: "The RPC/YMaster waited more than 10 seconds for the ServoEnable input at the CAN-IO box, so the servos were not enabled to turn or hold.",
      probableCauses: ["ServoEnable condition is not present at the CAN-IO box", "Upstream machine/safety condition is withholding servo enable"],
      checks: ["Check the ServoEnable bit at the CAN-IO box.", "Review active machine/safety conditions that can prevent enable."],
      actions: ["Correct the missing enable condition; do not bypass the safety chain to force ServoEnable."], safety: [safety.observe],
      sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #2 – SERVOENABLE_TIMEOUT" }]
    },
    {
      id: "servo-power-loss", code: "SERVOPOWERLOSS", number: 3, category: "Servo / Bottle Plate", aliases: ["servo power loss", "power removed", "servo drops out"],
      title: "ServoPower was removed during operation", summary: "The master detected ServoPower dropping after the servo system had already been running.", probableCauses: ["Servo power path opened", "DC/DC converter or supply dropped", "Safety/control condition removed ServoPower"], checks: ["Determine whether ServoPower dropped for the complete servo system or only a branch.", "Review DC/DC converter/drive diagnostics and the control condition that supplies ServoPower."], actions: ["Correct the cause of the power removal before repeated resets."], safety: [safety.observe, safety.electrical], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #3 – SERVOPOWERLOSS" }]
    },
    {
      id: "servo-feedback", code: "SERVOFEEDBACK", number: 4, category: "Servo / Bottle Plate", aliases: ["servo feedback", "servo not answering", "sync response", "drive missing", "multiple drives missing"],
      title: "One or more servo drives do not answer synchronization", summary: "The master is not receiving expected drive responses. The fault can be local to one drive or common to a power/CAN group.",
      probableCauses: ["Drive power missing or fuse open", "Disconnected or loose servo/CAN connection", "DC/DC supply fault", "Y-box fuse or common-line issue", "Internal drive fault"],
      checks: ["Identify whether one drive, one group, or all drives are missing.", "Compare the missing drive/group with a known-good RPC diagnostic view.", "Check common DC/DC power and Y-box fuse paths before replacing multiple drives.", "Under the approved electrical procedure, inspect the affected line/plugs and drive power."],
      actions: ["Restore the common power/communication path when several drives share the failure.", "If one drive remains absent after power/cabling checks, isolate that drive per the OEM replacement procedure."], safety: [safety.observe, safety.loto, safety.electrical, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #4 – SERVOFEEDBACK" }, { sourceId: "danfoss-servo-bottle-plate-system", locator: "Servo System Diagnostics / Y-box / drive power" }, { sourceId: "rpc-dts5-2011", locator: "RPC diagnostics and servo cabling" }]
    },
    {
      id: "servo-malfunction", code: "SERVOMALFUNCTION", number: 5, category: "Servo / Bottle Plate", aliases: ["servo malfunction", "drive error", "drive fault"],
      title: "Servo drive is reporting an error state", summary: "The drive is communicating but reports a malfunction. The field reference notes low voltage as one possible cause and directs the technician to read the drive error.", probableCauses: ["Drive error state", "Low supply voltage", "Persistent internal drive fault"], checks: ["Read the individual drive error in RPC/drive diagnostics.", "Check whether the error clears with the normal approved reset/restart sequence.", "If voltage-related, investigate the supply rather than replacing the drive first."], actions: ["Follow the specific drive error path.", "Replace a drive only after the persistent drive fault is isolated and replacement is authorized."], safety: [safety.observe, safety.electrical, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #5 – SERVOMALFUNCTION" }]
    },
    {
      id: "servo-transition", code: "SERVOTRANSITION", number: 6, category: "Servo / Bottle Plate", aliases: ["servo transition", "CANopen transition"], title: "Drive could not complete the requested CANopen transition", summary: "The drive did not move to the expected CANopen state during initialization/operation.", probableCauses: ["Internal drive fault", "Drive firmware problem"], checks: ["Confirm the affected drive and compare its status/firmware with known-good drives."], actions: ["Follow the OEM firmware/replacement path when the transition failure persists."], safety: [safety.observe, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #6 – SERVOTRANSITION" }]
    },
    {
      id: "servo-status", code: "SERVOSTATUS", number: 7, category: "Servo / Bottle Plate", aliases: ["servo status", "wrong CANopen state"], title: "Drive is in the wrong CANopen state", summary: "The RPC detected a drive in an unexpected CANopen state.", probableCauses: ["Drive firmware issue", "Internal drive problem"], checks: ["Identify the drive/state in RPC diagnostics.", "Compare firmware/status against a known-good drive."], actions: ["Use the approved firmware or drive replacement procedure if the wrong state persists."], safety: [safety.observe, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #7 – SERVOSTATUS" }]
    },
    {
      id: "servo-count", code: "SERVOCOUNT", number: 8, category: "Servo / Bottle Plate", aliases: ["servo count", "servo enumeration", "number of servos", "drive count mismatch", "ID duplicate", "ID 127"],
      title: "Configured and detected servo counts do not match", summary: "The RPC sees a different number of drives than configured. Duplicate/out-of-range IDs and interrupted power/CAN lines are documented causes.",
      probableCauses: ["Duplicate servo ID", "Servo ID outside the valid distribution", "Replacement drive still at default ID 127", "Power/cable interruption hides one or more drives", "CAN/ID distribution incomplete"],
      checks: ["Compare configured count with detected drives in RPC diagnostics.", "Identify the first missing or duplicate ID instead of renumbering blindly.", "Check power/CAN continuity around the first missing drive/group.", "Confirm replacement drives have been through the documented ID-distribution procedure."],
      actions: ["Correct the missing communication/power path or execute the documented ID distribution when numbering is the cause."], safety: [safety.observe, safety.loto, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #8 – SERVOCOUNT" }, { sourceId: "rpc-dts5-2011", locator: "Servo replacement / ID distribution / RPC diagnostics" }]
    },
    {
      id: "servo-reset", code: "SERVORESET", number: 9, category: "Servo / Bottle Plate", aliases: ["servo reset", "CAN reset failed"], title: "Drive reset over CAN failed", summary: "The master could not reset the drive over CAN.", probableCauses: ["CAN/cable problem", "Drive firmware problem", "Drive did not restart correctly"], checks: ["Check the affected drive's CAN/cable path.", "Compare firmware/status to a known-good drive."], actions: ["Use the documented drive power-cycle/reset procedure after cable checks; follow firmware/replacement procedure if persistent."], safety: [safety.loto, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #9 – SERVORESET" }]
    },
    {
      id: "servo-enumeration", code: "SERVOENUMERATION", number: 10, category: "Servo / Bottle Plate", aliases: ["servo enumeration", "numbering wrong", "id distribution", "drive id 127"], title: "Servo numbering is not valid", summary: "The documented case is an incomplete ID distribution or a replacement drive remaining at ID 127.", probableCauses: ["ID distribution was not executed", "Replacement drive is still ID 127", "Servo numbering is invalid"], checks: ["Review the detected IDs in RPC diagnostics.", "Check whether a replacement drive is still at default ID 127."], actions: ["Execute the documented ID distribution procedure under the servo motion/replacement controls."], safety: [safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #10 – SERVOENUMERATION" }, { sourceId: "rpc-dts5-2011", locator: "Servo replacement / ID distribution" }]
    },
    {
      id: "servo-mode-switch", code: "SERVOMODESWITCH", number: 11, category: "Servo / Bottle Plate", aliases: ["servo mode switch", "curve mode", "speed mode", "inertia mode"], title: "Drive cannot enter the requested motion mode", summary: "The drive did not switch into Curve, Speed or Inertia mode as requested.", probableCauses: ["Firmware issue", "Internal drive fault"], checks: ["Identify the affected drive and requested mode.", "Compare its firmware with the other drives."], actions: ["Use approved firmware/replacement path if persistent."], safety: [safety.observe, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #11 – SERVOMODESWITCH" }]
    },
    {
      id: "servo-version", code: "SERVOVERSION", number: 12, category: "Servo / Bottle Plate", aliases: ["servo version", "mixed firmware", "firmware mismatch"], title: "Servo drives do not share the required firmware version", summary: "A mixed servo firmware population is detected.", probableCauses: ["Replacement drive has a different firmware version", "Drives were programmed inconsistently"], checks: ["Compare firmware versions across all detected drives."], actions: ["Program the drives to the machine-required common firmware version using the approved procedure."], safety: [safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #12 – SERVOVERSION" }, { sourceId: "rpc-dts5-2011", locator: "Servo diagnostics / firmware" }]
    },
    {
      id: "servo-config", code: "SERVOCONFIG", number: 13, category: "Servo / Bottle Plate", aliases: ["servo config", "configuration inadequate", "config cannot adapt"], title: "Drive configuration could not be applied", summary: "The RPC could not adapt the expected configuration to the drive.", probableCauses: ["Firmware/configuration incompatibility", "Internal drive fault"], checks: ["Compare the drive firmware/configuration with a known-good drive."], actions: ["Use the approved firmware/replacement path when configuration remains incompatible."], safety: [safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #13 – SERVOCONFIG" }]
    },
    {
      id: "encoder-continuity", code: "ENCODERCONTINUITY", number: 14, category: "Encoder / Timing", aliases: ["encoder continuity", "encoder skipped", "missed counts", "timing jumps", "orientation jumps"], title: "Encoder values are discontinuous", summary: "The master detected skipped/missed encoder values rather than a smooth count sequence.", probableCauses: ["Encoder mechanical/electrical issue", "Loose encoder connection", "Timing/reference problem", "Encoder beginning to fail"], checks: ["Observe whether the discontinuity repeats at the same physical position.", "Inspect encoder mechanics/coupling and electrical connection under the appropriate safety state.", "Compare encoder/timing behavior with RPC synchronization and table-cam data when orientation is also affected."], actions: ["Correct the mechanical/electrical cause; replace the encoder only if the discontinuity persists after connection/mechanical checks."], safety: [safety.observe, safety.loto, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #14 – ENCODERCONTINUITY" }, { sourceId: "rpc-dts5-2011", locator: "SSI encoder / synchronization" }]
    },
    {
      id: "encoder-direction", code: "ENCODERDIRECTION", number: 15, category: "Encoder / Timing", aliases: ["encoder direction", "encoder counts backwards", "descending encoder"], title: "Encoder count direction does not match machine direction", summary: "The encoder values descend when the control expects the opposite direction.", probableCauses: ["Running direction/reference mismatch", "Encoder setup changed during service"], checks: ["Confirm actual machine direction versus the displayed encoder count direction.", "Review whether encoder or direction configuration was changed during service."], actions: ["Correct the machine/encoder running-direction configuration according to the OEM setup procedure."], safety: [safety.observe, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #15 – ENCODERDIRECTION" }]
    },
    {
      id: "io-box-communication", code: "IOBOXCOMM", number: 16, category: "Electrical / Communication", aliases: ["io box comm", "CAN IO", "CAN5", "red CAN LED", "IO box communication"], title: "CAN-IO communication on CAN5 is missing", summary: "The RPC cannot communicate correctly with the CAN-IO box.", probableCauses: ["CAN5 wiring/connection problem", "CAN-IO initialization problem", "CAN-IO hardware fault"], checks: ["Check CAN-IO status LEDs; the source notes a red CAN LED as communication evidence.", "Check CAN5 wiring/connectors and CAN-IO power under the approved procedure.", "Confirm the box is initialized/configured for the machine."], actions: ["Restore the CAN5/power/init path before replacing the CAN-IO box."], safety: [safety.observe, safety.loto, safety.electrical], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #16 – IOBOXCOMM" }, { sourceId: "danfoss-servo-bottle-plate-system", locator: "CAN-IO hardware overview" }]
    },
    {
      id: "apl-main-contactor", code: "APL MAIN CONTACTOR", category: "APL / Aggregate", aliases: ["main contactor fault", "aggregate contactor", "contactor", "apl contactor", "station stopped"],
      title: "APL main contactor fault", summary: "Treat the contactor message as a system condition first: connector, guard/docking safety, servo cables, rewind binding, drive connections and other active faults can prevent the contactor from staying in.",
      probableCauses: ["Aggregate Harting connector not seated", "Servo-drive cover guard switch not seated", "Docking/guard/safety switch condition", "Loose rewind/table servo motor connection", "Rewind motor binding", "Loose/pinched main drive wiring", "Another active condition is withholding the contactor"],
      checks: ["Review the HMI for any other active conditions before touching hardware.", "Confirm labeling station state matches the documented recovery sequence.", "Under LOTO, reseat/check the aggregate Harting and documented servo/guard connections.", "Inspect the rewind for binding and the rewind/table servo motor cable connections.", "Inspect main drive terminals/ports for loose or pinched wiring under the approved electrical procedure.", "Use the normal safety-circuit reset/restart sequence only after the underlying condition is corrected."],
      actions: ["Correct the specific connection/mechanical/safety cause found.", "Use the documented station-off / safety reset / power-cycle recovery sequence; do not bypass the safety circuit."], safety: [safety.observe, safety.loto, safety.electrical],
      sourceRefs: [{ sourceId: "apl-main-contactor-remedy", locator: "Main Contactor Faults – remedy checklist" }, { sourceId: "apl-contactor-figure-1", locator: "Reference figure" }, { sourceId: "apl-contactor-figure-2", locator: "Reference figure" }, { sourceId: "apl-contactor-figure-3", locator: "Reference figure" }, { sourceId: "apl-contactor-figure-4", locator: "Reference figure" }, { sourceId: "apl-schematic-605576", locator: "APL electrical reference" }]
    },
    {
      id: "orientation-inaccurate", code: "ORIENTATION INACCURATE", category: "Bottle Orientation", aliases: ["bottle orientation", "false orientation", "orientation off", "label alignment", "orientation inconsistent", "embossing"],
      title: "Bottle orientation is inaccurate or inconsistent", summary: "DARTplus/RPC guidance separates optics and bottle slip from synchronization, motor assignment and camera-trigger timing.",
      probableCauses: ["Camera/characteristic distance is not at the documented target", "Bottle is still rotating before first labeling", "Container slips on the bottle plate", "Centering is not stable", "Dirty optics", "RPC synchronization/table cam shifted", "Wrong RPC camera motor assignment or COM-device offset"],
      checks: ["Check the characteristic-to-protective-panel/camera target distance; the training uses 80 mm.", "Confirm the container is at standstill before the first labeling operation.", "Mark bottle/plate to prove or rule out slip.", "Check centering and clean optics.", "After encoder replacement, compare RPC synchronization/table cam to the previous value; the source directs full resynchronization when deviation is greater than 0.1°.", "Verify the motor number in RPC Diagnostics/Camera matches the bottle inspected after the camera and check the COM-device offset/trigger relationship."],
      actions: ["Fix mechanical/optical causes before compensating with offsets.", "If encoder work preceded the issue and synchronization moved, complete the documented synchronization procedure before fine orientation adjustment."], safety: [safety.observe, safety.servo], sourceRefs: [{ sourceId: "dartplus-11-en-000-965", locator: "18.2 Inaccurate container orientation, p. 51; 18.3 Basic orientation troubleshooting, p. 52" }, { sourceId: "orientation-hardware-rpc", locator: "Camera focus target 80 mm, p. 8" }, { sourceId: "gop-embossing-orientation", locator: "Bottle/embossing commissioning reference" }]
    },
    {
      id: "orientation-image-sequence", code: "FAULTY IMAGE SEQUENCE", category: "Bottle Orientation", aliases: ["faulty image sequence", "camera sequence", "framegrabber", "trigger device", "orientation camera fault"],
      title: "Faulty image sequence in the container orientation system", summary: "The DARTplus troubleshooting path checks camera cables, framegrabber readiness, trigger-device wiring, terminal-board wiring, connectors/pins, and trigger-device software.",
      probableCauses: ["Camera cable connection", "Framegrabber not ready", "Trigger-device wiring fault", "Terminal-board wiring fault", "Damaged framegrabber connector/pins", "Trigger device software/configuration problem"],
      checks: ["Confirm camera cables are correctly connected.", "Check framegrabber LED1 is green/ready.", "Check trigger-device and terminal-board wiring.", "Inspect framegrabber connectors/pins.", "On the hardware training, a flashing Ready LED indicates data transfer failure such as CAN/address problems; a red Fault LED indicates trigger-device fault."],
      actions: ["Correct the physical/wiring/CAN/address issue before recipe changes.", "Verify the trigger-device software/configuration against the machine standard after hardware checks."], safety: [safety.loto, safety.electrical],
      sourceRefs: [{ sourceId: "dartplus-11-en-000-965", locator: "18.3.1 Faulty image sequence, p. 55" }, { sourceId: "orientation-hardware-rpc", locator: "Trigger device status LEDs, p. 22" }]
    },
    {
      id: "orientation-trigger-can", code: "TRIGGER/CAN", category: "Electrical / Communication", aliases: ["trigger device CAN", "ready flashing", "fault LED red", "camera CAN", "incorrect address"],
      title: "Orientation trigger-device communication fault", summary: "The orientation hardware training identifies CAN/address failure when the Ready LED flashes and trigger-device hardware failure when the Fault LED is red.",
      probableCauses: ["CAN bus fault", "Incorrect trigger-device CAN address", "Trigger device hardware fault", "Missing 24 VDC"],
      checks: ["Check trigger-device Ready/Data/Fault LEDs.", "Verify the configured CAN address against the machine standard.", "Verify the CAN connection and 24 VDC supply under the approved electrical procedure."], actions: ["Correct CAN/address/power before replacing the trigger device.", "If the Fault LED remains red with correct power/CAN/address, follow the replacement procedure."], safety: [safety.observe, safety.electrical], sourceRefs: [{ sourceId: "orientation-hardware-rpc", locator: "Trigger device status LEDs and address, pp. 21–22" }]
    },
    {
      id: "automation-studio-diagnostics", code: "B&R DIAGNOSTICS", category: "Controls / PLC", aliases: ["automation studio", "logger", "watch", "trace", "debugger", "B&R diagnostics", "PLC diagnostics"],
      title: "B&R Automation Studio diagnostic path", summary: "Use the least-invasive diagnostic tool that answers the question: target status/logger first, then watch/I-O monitor, trace, profiler or debugger as needed.",
      probableCauses: ["Control-state or I/O condition not visible from the HMI", "Intermittent sequence/timing problem", "Runtime/communication issue"],
      checks: ["Confirm the online connection and target state.", "Review Logger before forcing or changing anything.", "Use Watch/I-O Monitor for current values and signal state.", "Use Trace for intermittent timing behavior; use Profiler/Debugger only when the investigation requires code-level analysis."],
      actions: ["Capture evidence first, then make one controlled change at a time under the site controls process."], safety: ["Software diagnostics can alter machine behavior when Force/Debugger features are used. Treat forcing and online edits as controlled maintenance actions."], sourceRefs: [{ sourceId: "tm223-diagnostics", locator: "Diagnostics overview; Logger; Force; Watch; Trace; Profiler; Debugger" }, { sourceId: "tm211-online-communication", locator: "Online connection and routing" }, { sourceId: "tm213-runtime", locator: "Operating states and I/O management" }]
    },
    {
      id: "schematic-navigation", code: "SCHEMATIC PATH", category: "Electrical / Communication", aliases: ["schematic", "wiring diagram", "electrical drawing", "wire number", "device reference"],
      title: "Trace an electrical fault through the schematic", summary: "Use the Krones schematic references to follow the actual signal/device path instead of replacing components by symptom alone.",
      probableCauses: ["Missing supply or return", "Open/loose connection", "Interlock/safety contact not made", "Device output not reaching the PLC/drive", "Wrong device or page being traced"],
      checks: ["Identify the exact station/device tag from the HMI or cabinet.", "Locate the device in the schematic and trace supply, switching element, terminal, and destination in order.", "Correlate drawing references with actual wire/terminal labels before measuring."],
      actions: ["Use the machine-specific 605576 APL or 747-993 electrical schematic when it matches the equipment; do not assume a generic drawing matches the installed revision."], safety: [safety.electrical], sourceRefs: [{ sourceId: "krones-schematic-tutorial-r3", locator: "Schematic navigation training" }, { sourceId: "schematic-tutorial-r3", locator: "Schematic navigation training" }, { sourceId: "electrical-schematic-747-993", locator: "Machine electrical reference" }, { sourceId: "apl-schematic-605576", locator: "APL electrical reference" }]
    },
    {
      id: "servo-system-baseline", code: "SERVO SYSTEM BASELINE", category: "Servo / Bottle Plate", aliases: ["servo system", "bottle plate system", "Danfoss power pc", "Y box", "SSI encoder", "CAN IO box", "commissioning"],
      title: "Establish the bottle-plate servo system baseline", summary: "The system reference breaks the bottle-table servo chain into the Power PC/master, Y-box, SSI encoder, servomotors, CAN-IO box, terminal, Ethernet and DC/DC power path.",
      probableCauses: ["Power/supply issue", "CAN communication issue", "Encoder/reference issue", "One drive/motor issue", "Master/terminal communication issue", "Configuration/firmware mismatch"],
      checks: ["Classify the problem first: one motor, one CAN line, all motors, encoder/timing, or master/terminal.", "Use RPC diagnostics to compare the affected device against known-good devices.", "Check common power/communication paths before replacing an individual motor when multiple devices fail together."], actions: ["Branch into the exact SERVO* / ENCODER* diagnostic when a message is available."], safety: [safety.observe, safety.electrical, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-bottle-plate-system", locator: "Hardware and software overview; Servo System Diagnostics" }, { sourceId: "rpc-dts5-2011", locator: "Hardware and RPC diagnostics" }]
    },
    {
      id: "autocol-orientation-baseline", code: "AUTOCOL ORIENTATION", category: "Autocol / Orientation", aliases: ["autocol", "autocol orientation", "aggregate orientation", "agg orientation", "agg3 orientation", "camera orientation", "bottle orientation at aggregate"],
      contextHints: ["autocol", "orientation", "camera", "aggregate", "rpc", "dart"],
      title: "Autocol orientation system baseline", summary: "For Autocol orientation complaints, first separate bottle/plate mechanics from camera image acquisition, trigger/CAN communication, and RPC/table-cam synchronization before changing offsets.",
      probableCauses: ["Bottle or plate slips before/during camera inspection", "Camera characteristic distance/focus or optics are incorrect", "Trigger-device/CAN communication is not stable", "RPC synchronization/table-cam reference changed", "RPC camera motor assignment does not match the inspected bottle"],
      checks: ["Verify the bottle is stable on the plate and reaches the first labeling point without slipping.", "Verify the camera characteristic is at the documented 80 mm target distance and clean the optics.", "Check camera/framegrabber/trigger readiness before changing recipe offsets.", "If encoder or timing work preceded the fault, compare RPC synchronization/table-cam against the prior value.", "In RPC Diagnostics/Camera, confirm the motor assignment corresponds to the bottle being inspected after the camera."],
      actions: ["Branch to ORIENTATION SYNC if the issue started after encoder/table-cam work.", "Branch to FAULTY IMAGE SEQUENCE or TRIGGER/CAN when camera/trigger evidence is abnormal.", "Only adjust orientation recipe/offset values after mechanical, optical, trigger and synchronization evidence is known-good."],
      safety: [safety.observe, safety.servo],
      sourceRefs: [{ sourceId: "dartplus-11-en-000-965", locator: "Troubleshooting basic/inaccurate orientation, pp. 51–52" }, { sourceId: "orientation-hardware-rpc", locator: "Camera focus and trigger device, pp. 8, 21–22" }, { sourceId: "rpc-dts5-2011", locator: "RPC diagnostics / encoder / servo reference" }]
    },
    {
      id: "orientation-sync-after-encoder", code: "ORIENTATION SYNC", category: "Encoder / Timing", aliases: ["orientation sync", "rpc sync", "table cam", "encoder replacement orientation", "orientation shifted after encoder", "sync deviation", "0.1 degree"],
      contextHints: ["autocol", "orientation", "encoder", "rpc", "table cam"],
      title: "Orientation shifted after encoder or table-cam work", summary: "DARTplus troubleshooting directs the technician to compare RPC synchronization/table-cam against the prior value after encoder replacement; a deviation greater than 0.1° requires complete resynchronization.",
      probableCauses: ["RPC synchronization/table-cam value changed during encoder work", "Encoder reference is not synchronized to the prior machine datum", "Camera motor assignment/COM-device offset is wrong after the timing change"],
      checks: ["Compare the current RPC synchronization/table-cam value with the value recorded before encoder work.", "If the deviation is greater than 0.1°, stop offset tuning and perform the documented full synchronization procedure.", "After synchronization, verify the motor number in RPC Diagnostics/Camera matches the bottle inspected after the camera.", "Confirm the COM-device offset/trigger relationship against the machine standard before fine orientation adjustment."],
      actions: ["Restore synchronization first; use recipe/brand offset only for the remaining process correction after the machine timing datum is correct."],
      safety: [safety.observe, safety.servo],
      sourceRefs: [{ sourceId: "dartplus-11-en-000-965", locator: "Basic orientation troubleshooting, p. 52" }, { sourceId: "rpc-dts5-2011", locator: "SSI encoder / RPC synchronization diagnostics" }]
    },
    {
      id: "apl-aggregate-connection", code: "APL AGGREGATE CONNECTION", category: "APL / Aggregate", aliases: ["aggregate connection", "harting", "aggregate harting", "docking sensor", "aggregate disconnected", "station connection"],
      contextHints: ["apl", "aggregate", "cart", "harting", "docking"],
      title: "APL aggregate connection / docking path", summary: "An APL station fault can originate in the aggregate Harting connection, docking/safety sensing, servo-drive cover switch, or table/rewind servo connections before the main contactor itself is suspect.",
      probableCauses: ["Aggregate Harting connector not fully seated", "Docking or guard/safety switch not made", "Servo-drive cover guard switch not seated", "Rewind/table servo connection loose", "Related active condition is preventing station enable"],
      checks: ["Review the HMI for the first active aggregate, drive, docking, guard or safety condition.", "Under LOTO, inspect/reseat the aggregate Harting and documented servo/guard connections.", "Verify docking and safety devices are correctly made; do not bypass them.", "If the connection path is correct, trace the station enable/contactor path using the APL schematic."],
      actions: ["Correct the identified connection or safety condition before resetting the station.", "Escalate to the schematic path when all documented connections are verified and the condition persists."],
      safety: [safety.observe, safety.loto, safety.electrical],
      sourceRefs: [{ sourceId: "apl-main-contactor-remedy", locator: "Main Contactor Faults – Harting, guard, docking and servo connection checks" }, { sourceId: "apl-schematic-605576", locator: "APL electrical reference" }]
    },
    {
      id: "apl-rewind-servo-binding", code: "APL REWIND / SERVO", category: "APL / Aggregate", aliases: ["rewind", "rewind binding", "rewind motor", "rewind servo", "rewind main contactor", "table servo cable"],
      contextHints: ["apl", "aggregate", "rewind", "servo"],
      title: "APL rewind or table-servo condition behind a contactor fault", summary: "The APL field procedure notes that a rewind motor/binding condition or rewind/table servo connection can present as a main contactor fault even when a separate rewind fault is not displayed.",
      probableCauses: ["Rewind mechanism is binding", "Rewind motor/servo connection is loose", "Table servo motor cable/connection is loose", "Main contactor is being inhibited by the downstream drive condition"],
      checks: ["Check whether the rewind is mechanically free under the approved stopped/LOTO condition.", "Under LOTO, inspect the rewind and table servo motor connections identified by the field procedure.", "Review the drive diagnostics for a related servo condition even if the HMI only shows main contactor fault."],
      actions: ["Correct the rewind/mechanical or servo-connection cause before treating the contactor as the failed component."],
      safety: [safety.loto, safety.servo, safety.electrical],
      sourceRefs: [{ sourceId: "apl-main-contactor-remedy", locator: "Main Contactor Faults – rewind/table servo checks" }, { sourceId: "apl-contactor-figure-5", locator: "Reference figure" }]
    }
  ]);

  const flows = Object.freeze([
    {
      id: "servo-bottle-plate", title: "Servo / bottle plate", category: "Servo / Bottle Plate", description: "Narrow a bottle-table servo problem by exact message, scope, power and communication.", start: "servo-start",
      nodes: Object.freeze({
        "servo-start": { question: "Do you have an exact RPC servo or encoder fault message?", choices: [{ label: "Yes — search the message", action: "search", hint: "Enter SERVOCOUNT, SERVOFEEDBACK, ENCODERCONTINUITY, etc." }, { label: "No — guide me by symptom", next: "servo-scope" }] },
        "servo-scope": { question: "How broad is the failure?", choices: [{ label: "One bottle plate / one drive", next: "servo-one" }, { label: "Several drives on one line/group", next: "servo-group" }, { label: "Most/all bottle plates", next: "servo-all" }, { label: "Encoder / table timing", result: "encoder-continuity" }] },
        "servo-one": { question: "Does the affected drive still appear in RPC diagnostics?", choices: [{ label: "No / drive missing", result: "servo-feedback" }, { label: "Yes, but in fault", result: "servo-malfunction" }, { label: "Yes, but wrong ID / numbering", result: "servo-count" }] },
        "servo-group": { question: "Do the missing drives share the same CAN/power line?", choices: [{ label: "Yes or likely", result: "servo-feedback" }, { label: "No / IDs look wrong", result: "servo-count" }] },
        "servo-all": { question: "Is ServoPower present at the CAN-IO / PLC diagnostics?", choices: [{ label: "No", result: "servo-power-timeout" }, { label: "Yes, but drives are missing", result: "servo-feedback" }, { label: "ServoEnable is missing", result: "servo-enable-timeout" }] }
      })
    },
    {
      id: "apl-main-contactor-flow", title: "APL main contactor", category: "APL / Aggregate", description: "Start with other conditions and safety/connection evidence before replacing parts.", start: "contactor-start",
      nodes: Object.freeze({
        "contactor-start": { question: "Is there another active drive, guard, docking, safety, or aggregate condition on the HMI?", choices: [{ label: "Yes", next: "contactor-other" }, { label: "No / nothing obvious", next: "contactor-connection" }] },
        "contactor-other": { question: "Does the other condition identify a specific drive or safety device?", choices: [{ label: "Rewind / table-servo condition", result: "apl-rewind-servo-binding" }, { label: "Guard / docking / aggregate connection", result: "apl-aggregate-connection" }, { label: "Main contactor only", result: "apl-main-contactor" }, { label: "I need the electrical path", result: "schematic-navigation" }] },
        "contactor-connection": { question: "Has the aggregate Harting / guard-switch / servo-connection path been inspected under LOTO?", choices: [{ label: "No", result: "apl-aggregate-connection" }, { label: "Yes, all connections verified", next: "contactor-persistent" }] },
        "contactor-persistent": { question: "Is the rewind binding or does the fault follow a rewind-related problem?", choices: [{ label: "Yes / possible", result: "apl-rewind-servo-binding" }, { label: "No", result: "schematic-navigation" }] }
      })
    },
    {
      id: "bottle-orientation-flow", title: "Bottle orientation", category: "Bottle Orientation", description: "Separate mechanical/optical inconsistency from camera/trigger/CAN faults.", start: "orientation-start",
      nodes: Object.freeze({
        "orientation-start": { question: "What best matches the orientation problem?", choices: [{ label: "Autocol / aggregate orientation — guide me", result: "autocol-orientation-baseline" }, { label: "Bottle is oriented, but position is inconsistent/off", result: "orientation-inaccurate" }, { label: "Camera/image sequence fault", result: "orientation-image-sequence" }, { label: "Trigger device Ready/Fault LED problem", result: "orientation-trigger-can" }, { label: "Problem started after encoder/table-cam work", next: "orientation-sync" }] },
        "orientation-sync": { question: "Has RPC synchronization/table cam been checked against the previous value?", choices: [{ label: "No / not compared yet", result: "orientation-sync-after-encoder" }, { label: "Yes, and deviation is > 0.1°", result: "orientation-sync-after-encoder" }, { label: "Yes, deviation is <= 0.1°", next: "orientation-motor" }] },
        "orientation-motor": { question: "Does the motor number in RPC Diagnostics match the bottle being inspected after the camera?", choices: [{ label: "No / unsure", result: "orientation-inaccurate" }, { label: "Yes", result: "orientation-image-sequence" }] }
      })
    },
    {
      id: "autocol-orientation-flow", title: "Autocol / orientation", category: "Autocol / Orientation", description: "Route Autocol orientation symptoms through mechanics, camera/trigger evidence and RPC synchronization before offset tuning.", contextHints: ["autocol", "orientation", "aggregate", "camera", "rpc"], start: "autocol-start",
      nodes: Object.freeze({
        "autocol-start": { question: "What changed or what do you see at the orientation aggregate?", choices: [{ label: "Orientation is consistently shifted after encoder/timing work", result: "orientation-sync-after-encoder" }, { label: "Orientation varies bottle-to-bottle", result: "orientation-inaccurate" }, { label: "Camera / image sequence fault", result: "orientation-image-sequence" }, { label: "Trigger Ready flashes / Fault LED is red", result: "orientation-trigger-can" }, { label: "I need a full Autocol orientation baseline", result: "autocol-orientation-baseline" }] }
      })
    },
    {
      id: "encoder-timing-flow", title: "Encoder / timing", category: "Encoder / Timing", description: "Differentiate continuity, direction, synchronization and orientation timing symptoms.", start: "encoder-start",
      nodes: Object.freeze({
        "encoder-start": { question: "Which symptom is closest?", choices: [{ label: "Skipped / discontinuous encoder values", result: "encoder-continuity" }, { label: "Encoder values count the wrong direction", result: "encoder-direction" }, { label: "Bottle orientation shifted after encoder replacement", result: "orientation-sync-after-encoder" }, { label: "Autocol orientation / RPC timing question", result: "autocol-orientation-baseline" }, { label: "I only know the machine timing is wrong", result: "schematic-navigation" }] }
      })
    },
    {
      id: "electrical-controls-flow", title: "Electrical / controls", category: "Electrical / Communication", description: "Move from signal evidence to the correct schematic or controls diagnostic tool.", start: "electrical-start",
      nodes: Object.freeze({
        "electrical-start": { question: "Where is the first evidence of the failure?", choices: [{ label: "CAN / device communication", result: "io-box-communication" }, { label: "Orientation trigger / camera CAN", result: "orientation-trigger-can" }, { label: "PLC value / sequence / intermittent signal", result: "automation-studio-diagnostics" }, { label: "No signal path identified yet", result: "schematic-navigation" }] }
      })
    },
    {
      id: "controls-diagnostics-flow", title: "B&R diagnostics", category: "Controls / PLC", description: "Choose the least-invasive Automation Studio diagnostic method.", start: "controls-start",
      nodes: Object.freeze({
        "controls-start": { question: "What do you need to prove?", choices: [{ label: "What fault/event happened first", result: "automation-studio-diagnostics" }, { label: "Whether an I/O or variable is currently true/false", result: "automation-studio-diagnostics" }, { label: "An intermittent timing/sequence problem", result: "automation-studio-diagnostics" }, { label: "I need to trace the physical circuit too", result: "schematic-navigation" }] }
      })
    }
  ]);

  function normalize(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function entrySearchText(entry) {
    return normalize([
      entry.code,
      entry.title,
      entry.summary,
      entry.category,
      ...(entry.aliases || []),
      ...(entry.probableCauses || []),
      ...(entry.checks || [])
    ].join(" "));
  }

  function contextSearchText(context = {}) {
    return normalize([context.site, context.zone, context.mapName, context.machineType, context.applicationMode, context.brand, context.bottle].filter(Boolean).join(" "));
  }

  function isExplicitForEntry(entry, normalizedQuery) {
    if (!normalizedQuery) return false;
    const compactQuery = normalizedQuery.replaceAll(" ", "");
    const compactCode = normalize(entry.code).replaceAll(" ", "");
    if (compactQuery && compactQuery === compactCode) return true;
    if (normalize(entry.title).includes(normalizedQuery)) return true;
    return (entry.aliases || []).some((alias) => normalize(alias).includes(normalizedQuery) || normalizedQuery.includes(normalize(alias)));
  }

  function scoreEntry(entry, query, context = {}) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return 0;
    const compactQuery = normalizedQuery.replaceAll(" ", "");
    const code = normalize(entry.code);
    const compactCode = code.replaceAll(" ", "");
    const text = entrySearchText(entry);
    const explicit = isExplicitForEntry(entry, normalizedQuery);
    let score = 0;
    if (compactQuery === compactCode) score += 100;
    if (code.includes(normalizedQuery)) score += 45;
    if (normalize(entry.title).includes(normalizedQuery)) score += 30;
    for (const term of normalizedQuery.split(" ").filter((term) => term.length > 1)) {
      if (text.includes(term)) score += 4;
    }

    const application = normalize(context.applicationMode);
    const contextText = contextSearchText(context);
    const entryHints = (entry.contextHints || []).map(normalize).filter(Boolean);
    for (const hint of entryHints) if (contextText.includes(hint)) score += 6;

    const isApl = /APL/.test(entry.category);
    const isOrientation = /Orientation/.test(entry.category);
    if (application === "apl" && isApl) score += 10;
    if (application === "cold glue" && isApl && !explicit) score -= 12;
    if (contextText.includes("autocol") && (isOrientation || entryHints.includes("autocol"))) score += 12;
    if (contextText.includes("orientation") && isOrientation) score += 6;
    return score;
  }

  function scoreFlow(flow, context = {}) {
    const contextText = contextSearchText(context);
    const application = normalize(context.applicationMode);
    let score = 0;
    const hints = (flow.contextHints || []).map(normalize).filter(Boolean);
    for (const hint of hints) if (contextText.includes(hint)) score += 8;
    if (application === "apl" && /APL/.test(flow.category)) score += 12;
    if (application === "cold glue" && /APL/.test(flow.category)) score -= 8;
    if (contextText.includes("autocol") && /Orientation/.test(flow.category)) score += 14;
    if (contextText.includes("orientation") && /Orientation/.test(flow.category)) score += 8;
    return score;
  }

  function recommendFlows(context = {}) {
    return flows
      .map((flow, index) => ({ flow, index, contextScore: scoreFlow(flow, context) }))
      .sort((a, b) => b.contextScore - a.contextScore || a.index - b.index)
      .map((item) => ({ ...item.flow, contextScore: item.contextScore }));
  }

  function searchEntries(query, context = {}, limit = 8) {
    return entries
      .map((entry) => ({ entry, score: scoreEntry(entry, query, context) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
      .slice(0, Math.max(1, Number(limit) || 8))
      .map((item) => ({ ...item.entry, searchScore: item.score }));
  }

  function searchSources(query, limit = 20) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return sources.slice(0, limit);
    return sources
      .map((source) => {
        const text = normalize([source.title, source.file, source.kind, ...(source.topics || [])].join(" "));
        let score = 0;
        for (const term of normalizedQuery.split(" ").filter(Boolean)) if (text.includes(term)) score += 1;
        if (normalize(source.title).includes(normalizedQuery)) score += 4;
        return { source, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.source.title.localeCompare(b.source.title))
      .slice(0, Math.max(1, Number(limit) || 20))
      .map((item) => item.source);
  }

  function getEntry(id) { return entries.find((entry) => entry.id === id) || null; }
  function getFlow(id) { return flows.find((flow) => flow.id === id) || null; }
  function getSource(id) { return sources.find((source) => source.id === id) || null; }

  function validate() {
    const errors = [];
    const sourceIds = new Set();
    sources.forEach((source) => {
      if (!source.id || sourceIds.has(source.id)) errors.push(`Duplicate or missing source id: ${source.id}`);
      sourceIds.add(source.id);
      if (!source.file) errors.push(`Source ${source.id} has no file name.`);
    });
    const entryIds = new Set();
    entries.forEach((entry) => {
      if (!entry.id || entryIds.has(entry.id)) errors.push(`Duplicate or missing entry id: ${entry.id}`);
      entryIds.add(entry.id);
      if (!entry.title || !entry.summary) errors.push(`Entry ${entry.id} is incomplete.`);
      if (!Array.isArray(entry.safety) || !entry.safety.length) errors.push(`Entry ${entry.id} has no safety guidance.`);
      (entry.sourceRefs || []).forEach((ref) => {
        if (!sourceIds.has(ref.sourceId)) errors.push(`Entry ${entry.id} references unknown source ${ref.sourceId}.`);
      });
    });
    const flowIds = new Set();
    flows.forEach((flow) => {
      if (!flow.id || flowIds.has(flow.id)) errors.push(`Duplicate or missing flow id: ${flow.id}`);
      flowIds.add(flow.id);
      const nodes = flow.nodes || {};
      if (!nodes[flow.start]) errors.push(`Flow ${flow.id} has missing start node ${flow.start}.`);
      Object.entries(nodes).forEach(([nodeId, node]) => {
        if (!node.question || !Array.isArray(node.choices) || !node.choices.length) errors.push(`Flow ${flow.id}/${nodeId} is incomplete.`);
        node.choices?.forEach((choice) => {
          if (choice.next && !nodes[choice.next]) errors.push(`Flow ${flow.id}/${nodeId} points to missing node ${choice.next}.`);
          if (choice.result && !entryIds.has(choice.result)) errors.push(`Flow ${flow.id}/${nodeId} points to missing result ${choice.result}.`);
        });
      });
    });
    return { ok: errors.length === 0, errors };
  }

  return Object.freeze({
    version: "troubleshooting-library-v2",
    SOURCE_KIND,
    sources,
    entries,
    flows,
    normalize,
    getEntry,
    getFlow,
    getSource,
    searchEntries,
    searchSources,
    recommendFlows,
    validate
  });
});