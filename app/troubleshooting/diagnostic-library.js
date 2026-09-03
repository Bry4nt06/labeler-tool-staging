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
      id: "servo-power-loss", code: "SERVOPOWERLOSS", number: 3, category: "Servo / Bottle Plate", aliases: ["servo power loss", "power removed during operation"],
      title: "Servo power was removed during operation", summary: "ServoPower had been present and was then removed by the PLC during operation.",
      probableCauses: ["PLC removed ServoPower because another machine condition changed", "Power path to drives became unavailable"],
      checks: ["Check current and historical ServoPower state.", "Review drive diagnostic state for the point at which power was lost."],
      actions: ["Resolve the upstream condition that removed power before attempting restart."], safety: [safety.observe, safety.electrical],
      sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #3 – SERVOPOWERLOSS" }]
    },
    {
      id: "servo-feedback", code: "SERVOFEEDBACK", number: 4, category: "Servo / Bottle Plate", aliases: ["servo feedback", "drive missing", "sync message", "no response"],
      title: "One or more drives stopped responding", summary: "A drive did not respond to the periodic synchronization message and is no longer available to the RPC.",
      probableCauses: ["Servo voltage is missing even though ServoPower status remains high", "Blown fuse or failed DC/DC converter path", "Disconnected servo/CAN line", "Loose or incorrectly seated plugs", "Internal drive defect"],
      checks: ["Determine whether one drive, one line, or multiple lines disappeared.", "Verify converter output and drive-side supply using the approved electrical procedure.", "Check Y-box/line fuses and the physical line connection.", "Inspect that servo/CAN plugs are correctly secured."],
      actions: ["Correct the common power/line issue first when multiple drives are affected.", "When one drive remains isolated after power/cabling checks, continue with drive-specific diagnostics."],
      safety: [safety.loto, safety.electrical, safety.servo],
      sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #4 – SERVOFEEDBACK" }, { sourceId: "rpc-dts5-2011", locator: "Hardware CAN structure; RPC diagnostics servomotor / AC-DC power supply" }]
    },
    {
      id: "servo-malfunction", code: "SERVOMALFUNCTION", number: 5, category: "Servo / Bottle Plate", aliases: ["servo malfunction", "drive error state", "low voltage"],
      title: "Drive entered an error state", summary: "One or more drives reported a malfunction; the source procedure calls out low voltage as a possible cause.",
      probableCauses: ["Low drive voltage", "Drive-specific internal fault"],
      checks: ["Read the drive-specific error message before resetting.", "Check whether the fault is isolated to one drive or affects a shared power group."],
      actions: ["After recording the drive error, use the normal machine procedure to remove and restore PowerEnable or restart the drive system.", "If the malfunction immediately returns, escalate to the affected drive and its power/cabling path rather than repeatedly resetting."],
      safety: [safety.observe, safety.electrical], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #5 – SERVOMALFUNCTION" }]
    },
    {
      id: "servo-transition", code: "SERVOTRANSITION", number: 6, category: "Servo / Bottle Plate", aliases: ["servo transition", "CANopen state machine"],
      title: "Drive could not change CANopen state", summary: "A drive did not transition correctly through the CANopen state machine.",
      probableCauses: ["Internal drive malfunction", "Firmware state problem"], checks: ["Identify the affected drive and compare its firmware/state to known-good drives."],
      actions: ["Use the approved firmware/service procedure; replace the drive if the internal malfunction persists."], safety: [safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #6 – SERVOTRANSITION" }, { sourceId: "rpc-dts5-2011", locator: "RPC diagnostics servomotor" }]
    },
    {
      id: "servo-status", code: "SERVOSTATUS", number: 7, category: "Servo / Bottle Plate", aliases: ["servo status", "wrong state", "CANopen state"],
      title: "Drive is in the wrong CANopen state", summary: "A drive changed state but is not in the state expected by the RPC.",
      probableCauses: ["Internal drive malfunction", "Firmware mismatch/state problem"], checks: ["Identify the drive and compare diagnostic state/firmware with the other drives."],
      actions: ["Use the approved firmware/service procedure; replace the drive if the state fault persists."], safety: [safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #7 – SERVOSTATUS" }]
    },
    {
      id: "servo-count", code: "SERVOCOUNT", number: 8, category: "Servo / Bottle Plate", aliases: ["servo count", "drive count", "missing motor", "id 127", "duplicate drive id"],
      title: "Configured and detected drive counts do not match", summary: "One or more drives did not respond, or the detected drive IDs do not match the configured bottle-table population.",
      probableCauses: ["Duplicate drive IDs", "Drive ID outside the expected range", "Replacement drive still at ID 127", "Interrupted servo power/CAN cabling"],
      checks: ["Check the drive IDs shown in the RPC diagnostic window.", "Compare missing IDs with the physical bottle-table motor labels.", "Check common power and CAN cabling before changing IDs."],
      actions: ["Run the approved ID-distribution procedure only after confirming power and communication are stable."], safety: [safety.observe, safety.servo],
      sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #8 – SERVOCOUNT" }, { sourceId: "rpc-dts5-2011", locator: "CAN structure and RPC diagnostics" }]
    },
    {
      id: "servo-reset", code: "SERVORESET", number: 9, category: "Servo / Bottle Plate", aliases: ["servo reset", "reset command", "CAN reset"],
      title: "Drive reset command failed", summary: "An error occurred while the RPC sent the reset command over CAN.",
      probableCauses: ["CAN communication/cabling issue", "Drive firmware issue", "Drive power state did not reset correctly"],
      checks: ["Check the affected CAN line and cable connections.", "Check whether other drives on the same line respond normally."], actions: ["Use the approved drive power-cycle and firmware procedure if communication is intact."], safety: [safety.loto, safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #9 – SERVORESET" }]
    },
    {
      id: "servo-enumeration", code: "SERVOENUMERATION", number: 10, category: "Servo / Bottle Plate", aliases: ["servo enumeration", "wrong numbering", "id 127", "id distribution"],
      title: "Servo numbering is incorrect", summary: "The drive numbering found by the RPC is not correct, commonly because ID distribution was not completed or a replacement drive is still ID 127.",
      probableCauses: ["ID distribution not carried out", "Replacement drive at ID 127"], checks: ["Compare detected drive IDs with bottle-table motor labels."], actions: ["Execute the approved ID-distribution process until the drive IDs match the physical bottle-table labels."], safety: [safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #10 – SERVOENUMERATION" }]
    },
    {
      id: "servo-mode-switch", code: "SERVOMODESWITCH", number: 11, category: "Servo / Bottle Plate", aliases: ["servo mode switch", "curve speed inertia", "work mode"],
      title: "Drive cannot enter the commanded work mode", summary: "A drive cannot switch into its operating mode such as curve, speed, or inertia mode.", probableCauses: ["Internal drive malfunction", "Firmware issue"], checks: ["Identify the drive and compare firmware/diagnostic state with known-good drives."], actions: ["Update firmware through the approved service process or replace the drive if required."], safety: [safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #11 – SERVOMODESWITCH" }]
    },
    {
      id: "servo-version", code: "SERVOVERSION", number: 12, category: "Servo / Bottle Plate", aliases: ["servo version", "firmware version mismatch", "different firmware"],
      title: "Servo firmware versions differ", summary: "One or more drives have a different firmware version from the rest of the bottle-table population.", probableCauses: ["Replacement motor/drive has a different firmware version", "Previous service left mixed firmware"], checks: ["Read and compare firmware versions across all drives; identify the outlier before programming."], actions: ["Program the drives to the approved common firmware version for that machine."], safety: [safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #12 – SERVOVERSION" }, { sourceId: "rpc-dts5-2011", locator: "RPC diagnostics servomotor: firmware should be the same for all motors, p. 32" }]
    },
    {
      id: "servo-config", code: "SERVOCONFIG", number: 13, category: "Servo / Bottle Plate", aliases: ["servo config", "servo configuration"],
      title: "Servo configuration cannot be adapted", summary: "The servo configuration is inadequate or cannot be adapted by the system.", probableCauses: ["Drive/firmware configuration issue", "Internal drive problem"], checks: ["Compare the drive configuration and firmware against a known-good drive/machine standard."], actions: ["Use the approved firmware/configuration procedure; replace the drive if configuration remains invalid."], safety: [safety.servo], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #13 – SERVOCONFIG" }]
    },
    {
      id: "encoder-continuity", code: "ENCODERCONTINUITY", number: 14, category: "Encoder / Timing", aliases: ["encoder continuity", "encoder skipped values", "encoder faulty", "timing"],
      title: "Encoder values are missing or discontinuous", summary: "The encoder left out values or the master did not detect them.", probableCauses: ["Faulty encoder", "Loose mechanical encoder coupling", "Poor electrical connection between encoder and master", "Master timing problem"], checks: ["Inspect the encoder mechanical connection/coupling.", "Inspect the encoder electrical connection and connector condition.", "Compare the fault behavior against a stable machine speed/known-good encoder if available."], actions: ["Correct mechanical/electrical connection defects; replace the encoder when the fault cannot be reset after those checks."], safety: [safety.loto, safety.electrical], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #14 – ENCODERCONTINUITY" }, { sourceId: "rpc-dts5-2011", locator: "SSI encoder / encoder option hardware" }]
    },
    {
      id: "encoder-direction", code: "ENCODERDIRECTION", number: 15, category: "Encoder / Timing", aliases: ["encoder direction", "descending encoder values", "table runs backward", "wrong direction"],
      title: "Encoder direction disagrees with configured machine direction", summary: "The encoder is providing descending values relative to the selected machine direction, or the table is running backward.", probableCauses: ["Configured machine direction is wrong", "Actual table rotation is opposite the configured direction"], checks: ["Verify actual table direction against the selected machine direction in setup mode."], actions: ["Correct the machine running-direction setting rather than masking the encoder signal."], safety: [safety.observe], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #15 – ENCODERDIRECTION" }]
    },
    {
      id: "io-box-communication", code: "IOBOXCOMM", number: 16, category: "Electrical / Communication", aliases: ["io box comm", "CAN IO box", "CAN 5", "CAN LED red"],
      title: "Communication with the CAN-IO box failed", summary: "The RPC has a communication error with the CAN-IO box on CAN 5.", probableCauses: ["CAN 5 wiring break", "CAN-IO box not initialized", "Faulty CAN-IO box"], checks: ["Check the connection between the master PC and CAN-IO box.", "Check the CAN LED on the CAN-IO box; a red CAN LED indicates a communication problem."], actions: ["Repair the CAN connection or set up/replace the CAN-IO box according to the machine procedure."], safety: [safety.observe, safety.loto], sourceRefs: [{ sourceId: "danfoss-servo-fault-messages", locator: "Fault #16 – IOBOXCOMM" }, { sourceId: "danfoss-servo-bottle-plate-system", locator: "CAN-IO-BOX hardware section" }]
    },
    {
      id: "apl-main-contactor", code: "APL MAIN CONTACTOR", category: "APL / Aggregate", aliases: ["main contactor fault", "aggregate contactor", "contactor", "apl contactor", "station stopped"],
      title: "APL aggregate main contactor fault", summary: "Intermittent main-contactor faults can be driven by aggregate connections, guard/safety switches, servo/rewind connections, component binding, or another active machine condition.",
      probableCauses: ["Harting connector not fully seated", "Servo-drive cover guard switch/safety switch not made", "Docking/safety sensor condition", "Loose servo-motor or rewind cable connection", "Rewind motor binding/failure", "Loose/pinched main-drive connection", "Another machine condition preventing the safety/main-contactor chain"],
      checks: ["Record other active HMI/safety conditions before disturbing connections.", "With the machine safely stopped, inspect/reseat the aggregate Harting connection and guard/safety devices referenced by the procedure.", "Inspect rewind and table-servo cable connections and signs of binding.", "Inspect main-drive plugs/terminals for loose or pinched wiring under the approved maintenance procedure."],
      actions: ["Correct the failed connection/safety condition instead of repeatedly resetting.", "Use the station-off / normal machine restart process after the underlying condition is corrected."],
      safety: [safety.loto, safety.electrical, safety.servo],
      sourceRefs: [{ sourceId: "apl-main-contactor-remedy", locator: "Main Contactor Faults – remedy checklist" }, { sourceId: "apl-contactor-figure-1", locator: "Reference figure" }, { sourceId: "apl-contactor-figure-2", locator: "Reference figure" }, { sourceId: "apl-contactor-figure-3", locator: "Reference figure" }, { sourceId: "apl-contactor-figure-4", locator: "Reference figure" }, { sourceId: "apl-schematic-605576", locator: "APL electrical reference" }]
    },
    {
      id: "orientation-inaccurate", code: "ORIENTATION INACCURATE", category: "Bottle Orientation", aliases: ["bottle orientation", "false orientation", "orientation off", "label alignment", "orientation inconsistent", "embossing"],
      title: "Container orientation is inaccurate or inconsistent", summary: "Krones troubleshooting starts with camera distance, standstill timing, label placement consistency, container slip, centering, and optical cleanliness before changing recipe logic.",
      probableCauses: ["Camera/protective-panel distance is not 80 mm to the target characteristic", "Bottle has not reached standstill before the first labeling position", "Container slips on the rotary plate", "Container is not centered consistently in the camera field", "Optics are contaminated", "RPC synchronization/table cam changed after encoder work"],
      checks: ["Verify the 80 mm distance to the actual orientation characteristic.", "Verify plate standstill is achieved before the first labeling position.", "Compare label spacing/position consistency before blaming the orientation camera.", "Mark the bottle and plate to check for slip during a controlled diagnostic run per site procedure.", "Check bottle centering and optical cleanliness.", "If encoder/table-cam work occurred, compare RPC synchronization; the Krones manual calls for re-synchronization when deviation exceeds 0.1°."],
      actions: ["Correct mechanical centering/slip/optics first.", "Only after those checks, correct synchronization, motor assignment, or orientation parameters using the approved setup process."], safety: [safety.observe, safety.loto],
      sourceRefs: [{ sourceId: "dartplus-11-en-000-965", locator: "18.1 Inaccuracies during orientation, p. 51; 18.2 Basic problems, p. 52" }, { sourceId: "orientation-hardware-rpc", locator: "Camera focus/distance, pp. 8–9" }, { sourceId: "gop-embossing-orientation", locator: "Commissioning a new bottle/orientation target" }]
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
        "contactor-other": { question: "Does the other condition identify a specific drive or safety device?", choices: [{ label: "Drive/servo/rewind condition", result: "apl-main-contactor" }, { label: "Guard/docking/safety condition", result: "apl-main-contactor" }, { label: "I need the electrical path", result: "schematic-navigation" }] },
        "contactor-connection": { question: "Has the aggregate Harting / guard-switch / servo-connection path been inspected under LOTO?", choices: [{ label: "No", result: "apl-main-contactor" }, { label: "Yes, all connections verified", next: "contactor-persistent" }] },
        "contactor-persistent": { question: "Is the rewind binding or does the fault follow a rewind-related problem?", choices: [{ label: "Yes / possible", result: "apl-main-contactor" }, { label: "No", result: "schematic-navigation" }] }
      })
    },
    {
      id: "bottle-orientation-flow", title: "Bottle orientation", category: "Bottle Orientation", description: "Separate mechanical/optical inconsistency from camera/trigger/CAN faults.", start: "orientation-start",
      nodes: Object.freeze({
        "orientation-start": { question: "What best matches the orientation problem?", choices: [{ label: "Bottle is oriented, but position is inconsistent/off", result: "orientation-inaccurate" }, { label: "Camera/image sequence fault", result: "orientation-image-sequence" }, { label: "Trigger device Ready/Fault LED problem", result: "orientation-trigger-can" }, { label: "Problem started after encoder/table-cam work", next: "orientation-sync" }] },
        "orientation-sync": { question: "Has RPC synchronization/table cam been checked against the previous value?", choices: [{ label: "No", result: "orientation-inaccurate" }, { label: "Yes, and deviation is > 0.1°", result: "orientation-inaccurate" }, { label: "Yes, deviation is <= 0.1°", next: "orientation-motor" }] },
        "orientation-motor": { question: "Does the motor number in RPC Diagnostics match the bottle being inspected after the camera?", choices: [{ label: "No / unsure", result: "orientation-inaccurate" }, { label: "Yes", result: "orientation-image-sequence" }] }
      })
    },
    {
      id: "encoder-timing-flow", title: "Encoder / timing", category: "Encoder / Timing", description: "Differentiate continuity, direction, synchronization and orientation timing symptoms.", start: "encoder-start",
      nodes: Object.freeze({
        "encoder-start": { question: "Which symptom is closest?", choices: [{ label: "Skipped / discontinuous encoder values", result: "encoder-continuity" }, { label: "Encoder values count the wrong direction", result: "encoder-direction" }, { label: "Bottle orientation shifted after encoder replacement", result: "orientation-inaccurate" }, { label: "I only know the machine timing is wrong", result: "schematic-navigation" }] }
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

  function scoreEntry(entry, query, context = {}) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return 0;
    const compactQuery = normalizedQuery.replaceAll(" ", "");
    const code = normalize(entry.code);
    const compactCode = code.replaceAll(" ", "");
    const text = entrySearchText(entry);
    let score = 0;
    if (compactQuery === compactCode) score += 100;
    if (code.includes(normalizedQuery)) score += 45;
    if (normalize(entry.title).includes(normalizedQuery)) score += 30;
    for (const term of normalizedQuery.split(" ").filter((term) => term.length > 1)) {
      if (text.includes(term)) score += 4;
    }
    const application = normalize(context.applicationMode);
    if (application === "apl" && /APL/.test(entry.category)) score += 4;
    if (application === "cold glue" && /APL/.test(entry.category)) score -= 8;
    return score;
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
    version: "troubleshooting-library-v1",
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
    validate
  });
});
