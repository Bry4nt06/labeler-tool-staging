# SME review queue

The following items must be resolved before technician-facing implementation:

| Priority | Question | Why it matters |
|---|---|---|
| Blocker | Which installed machine generations show touchscreen code 600 exactly, and is the displayed wording still “no PC communication”? | Prevents assigning the code to unsupported DTS/RPC versions. |
| Blocker | Is the source's “up to two minutes” connection period still valid for the deployed Power PC and current startup sequence? | Determines whether the app gives a safe wait/check or delays a genuine failure response. |
| Blocker | Who is authorized to inspect or change CompactFlash/network configuration, and where is the approved machine baseline stored? | Avoids unsafe or unauthorized network changes. |
| Blocker | Is the 2011 servomotor replacement sequence approved for current motors, especially spacer and seal variants? | The training source explicitly notes hardware variation. |
| Blocker | What current document supplies approved torque, grease, thread-sealant, connector, and return-to-service requirements? | Those values must not be inferred from training slides. |
| High | Do the deployed machines expose the same `300V power supply unit` and `Monitoring board` diagnostic screens shown on RPC slides 33–34? | Confirms labels, navigation, and available evidence. |
| High | What is the approved motor-ID assignment procedure and permission level after replacement? | Prevents addressing the wrong station or incomplete commissioning. |
| High | When is firmware update required, and what source controls the version? | Avoids unnecessary or incompatible updates. |
| High | For which products is `Zero the plate` required after replacement? | The source limits this function to shaped-bottle use. |
| Medium | Are node address `0x78` and CAN bitrate `500 kbit/s` fixed for every target installation, or only the source machine family? | These remain evidence-only until confirmed. |
| Medium | Which current schematic maps monitoring-board lines 1–6 to motor groups and field connectors? | Enables precise scope routing without guessing branch ownership. |
| Medium | What evidence package should trigger escalation: screenshots, first fault, voltages, line status, boot state, and station list? | Standardizes useful handoff to controls/electrical support. |

