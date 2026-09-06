# 605576 schematic trace notes

These notes narrow the master implementer's lookup. They are not a substitute for the controlled drawing set or a machine-specific electrical trace.

## Useful locations

| PDF page | Observed content | Intended use |
|---:|---|---|
| 5–6 | Drawing table of contents | Locate controlled section/sheet names. |
| 10 | Location-designation legend, including `+KA` for aggregate/labeling-station terminal-box plug and `+SU` for guards | Decode location prefixes only. |
| 18 | Control-panel construction overview: PLC chassis, safety relays, emergency-stop relays, guarding relays, optocouplers | High-level control architecture. |
| 19 | Power-panel construction overview: control supplies/breakers, Kinetix servo equipment, servo-drive fuses/contactor, transformer/power protection | High-level power architecture. |
| 51 | Servo main-drive schematic | Confirms contactor/transformer/drive context; do not generically import circuit details. |
| 58–62 | `=EAC7.9706 +KA` section, including Ethernet/addressing and aggregate-station status references | Starting point for aggregate-station signal tracing. |
| 65 | `+KA` terminal-strip cross-reference | Revision-specific technician reference only. |
| 71 | Cable-list references including 9706 signals | Revision-specific technician reference only. |

## Claim limits

- The review confirms relevant areas in the drawing set; it does not prove a complete end-to-end safety-chain trace.
- Page numbers above are PDF pages and may not equal the drawing's internal sheet number.
- The master implementation should show the functional explanation and source locator, not terminal assignments.
- A qualified technician must match machine serial/configuration, drawing number, sheet, and revision before electrical diagnosis.

