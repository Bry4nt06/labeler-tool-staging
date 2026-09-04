# Proposed app-shaped RPC / Danfoss records

These objects are implementation-ready research drafts. They intentionally match the app's diagnostic vocabulary but are not JavaScript runtime code.

## 1. Touchscreen code 600

```js
{
  id: "servo-terminal-code-600",
  code: "600 — NO PC COMMUNICATION",
  category: "Servo / Bottle Plate",
  aliases: [
    "code 600",
    "600 no pc comm",
    "no pc communication",
    "power pc communication",
    "rpc master communication",
    "terminal communication"
  ],
  contextHints: ["rpc", "dts", "danfoss", "servo bottle plate", "power pc", "master"],
  title: "Touchscreen code 600 — no communication with Power PC",
  summary: "The touchscreen has not established communication with the Danfoss Power PC/master. Separate master readiness, physical Ethernet link, startup delay, and approved machine network configuration before moving into servomotor troubleshooting.",
  probableCauses: [
    "Power PC/master is not powered, ready, or completing startup",
    "Ethernet link is absent because of a switch, cable, connector, or power issue",
    "The documented connection-establishment period has not elapsed",
    "CompactFlash or other machine network configuration does not match the approved baseline",
    "A master or communication component has failed despite a valid physical link"
  ],
  checks: [
    "Capture when code 600 first appears and whether it follows a restart, service action, or card change.",
    "Confirm the Power PC/master has power and reaches its normal ready state.",
    "Observe the green communication/link indication at the control-cabinet switch.",
    "Allow the source-documented connection period of up to two minutes before declaring a fault.",
    "If link is present, compare the CompactFlash/network configuration with the approved machine baseline; do not guess or copy values from another machine.",
    "If link is absent, isolate energy before inspecting or reseating Ethernet hardware."
  ],
  actions: [
    "Correct only the proven power, physical-link, or approved-configuration cause.",
    "Perform the normal controlled restart after the cause is corrected.",
    "Verify code 600 clears and RPC diagnostics become reachable.",
    "If master readiness, link, delay, and configuration are all correct, escalate with boot-state and link evidence."
  ],
  safety: [
    "Cabinet observation only while energized; follow site electrical boundaries.",
    "Use lockout/tagout before touching cabinet communication wiring or components.",
    "Only authorized personnel may inspect or change machine network configuration."
  ],
  sourceRefs: [
    { source: "Labeler Danfoss servo bottle plate system.doc", locator: "Checking the System for Proper Operation / commissioning procedure" }
  ]
}
```

## 2. RPC servomotor replacement support guide

```js
{
  id: "rpc-servomotor-replacement-guide",
  code: "RPC SERVOMOTOR REPLACEMENT",
  category: "Servo / Bottle Plate",
  aliases: [
    "change rpc motor",
    "replace bottle plate servo",
    "dts5 servo replacement",
    "address new servomotor",
    "assign servo id"
  ],
  contextHints: ["rpc", "dts5", "servomotor", "bottle plate", "replacement", "commissioning"],
  title: "RPC servomotor replacement and return-to-service checks",
  summary: "Qualified-maintenance guide for replacing an RPC bottle-plate servomotor, preserving the required discharge wait, using the correct connector tool, and completing motor addressing before functional verification.",
  probableCauses: [
    "A failed motor has been confirmed by the existing fault-isolation records",
    "Replacement is being attempted without the approved tools or current procedure",
    "The new motor is installed but not addressed to its station",
    "Firmware or bottle-plate setup does not match the machine baseline after replacement",
    "A seal, spacer, cable, or mounting detail was not restored correctly"
  ],
  checks: [
    "Confirm replacement is justified by a proven single-motor failure; do not replace a motor for a shared power or communication fault.",
    "Confirm the current approved procedure, correct replacement part, seal variant, tools, and consumables are available.",
    "Record the affected station and pre-work fault evidence.",
    "After installation, select the correct servomotor and complete the approved ID-assignment process.",
    "Confirm required firmware and bottle-plate setup against the machine baseline.",
    "Run controlled verification and confirm normal motor state without lag, feedback, enumeration, or configuration faults."
  ],
  actions: [
    "Jog the table to an approved maintenance position before shutdown.",
    "Isolate the machine and wait at least ten minutes before disconnecting motor cables, as required by the source procedure.",
    "Use the specified hook wrench on the motor connectors; do not use pipe wrenches or similar tools.",
    "Follow the current approved mechanical procedure for plate locks, bottle plate, spacer/seal variant, diagonal fastener removal, flange preparation, reassembly, and cable reconnection.",
    "Address the new motor, update firmware only if required and authorized, and zero the bottle plate only when the product/setup requires it.",
    "Complete guarded functional checks and document the replacement and final station state."
  ],
  safety: [
    "Qualified maintenance personnel only.",
    "Apply lockout/tagout and verify the required discharge interval before cable removal.",
    "Secure the motor during removal; the training source identifies an approximate mass of 2 kg.",
    "Do not use this summary as a substitute for current torque, chemical, seal, lifting, or return-to-service instructions."
  ],
  sourceRefs: [
    { source: "0001_RPC-DTS5_622_2011_EN_ppt.pdf", locator: "pp. 21–30; supporting context pp. 32, 37–38" }
  ]
}
```

## 3. RPC power and monitoring diagnostics

```js
{
  id: "rpc-power-monitoring-diagnostics",
  code: "RPC POWER / MONITORING",
  category: "Servo / Bottle Plate",
  aliases: [
    "300v power supply diagnostics",
    "rpc ac dc diagnostics",
    "rpc monitoring board",
    "monitoring board fuse status",
    "servo power supply screen"
  ],
  contextHints: ["rpc", "dts5", "300 v", "ac dc converter", "monitoring board", "servo power"],
  title: "RPC 300 V power-supply and monitoring-board diagnostics",
  summary: "Use the RPC diagnostic screens to distinguish converter-level faults, individual monitored line/fuse faults, CAN communication loss, and downstream single-drive faults before disturbing hardware.",
  probableCauses: [
    "AC/DC converter input, internal, temperature, controller, or output fault",
    "Converter has not received or accepted the CAN enable command",
    "A monitored line/circuit breaker or downstream branch is open or overloaded",
    "Monitoring-board CAN communication or board status is abnormal",
    "The shared 300 V supply is healthy and the fault is downstream at one drive, cable, or motor"
  ],
  checks: [
    "Scope the event: all motors, a consecutive group, one monitored line, or one station.",
    "On the 300 V power-supply screen, record CAN status, input/internal/output voltage, current, temperatures, warning bits, fault bits, output-status signals, control-terminal states, and CAN-enable state.",
    "On the monitoring-board screen, capture the detailed error message, main breaker, each line/circuit-breaker status and current, communications status, voltage indication, discharge-resistor state, temperature, and humidity.",
    "Compare the screen evidence with the existing servo-power, enable, power-loss, feedback, enumeration, and IO-box records.",
    "If the shared supply and relevant monitored line are healthy, continue with the existing single-station diagnostic path rather than replacing common hardware."
  ],
  actions: [
    "Correct only the proven upstream supply, converter, monitored branch, CAN-enable, or downstream station cause.",
    "Preserve screen captures and the first fault message before reset.",
    "After correction, use the normal controlled reset/start sequence and verify healthy shared and station status.",
    "Escalate abnormal converter warning/fault bits or board indicators with the recorded values and affected scope."
  ],
  safety: [
    "Use diagnostic screens and external observations before opening equipment.",
    "The RPC system includes hazardous DC voltage that may remain after shutdown; apply lockout/tagout and the approved discharge/verification procedure before hardware work.",
    "Electrical measurements and fuse/branch work are for qualified personnel using approved test methods."
  ],
  sourceRefs: [
    { source: "0001_RPC-DTS5_622_2011_EN_ppt.pdf", locator: "pp. 12–14 and 33–34" },
    { source: "Labeler Danfoss servo bottle plate system.doc", locator: "commissioning procedure / missing-motor scope checks" }
  ]
}
```

