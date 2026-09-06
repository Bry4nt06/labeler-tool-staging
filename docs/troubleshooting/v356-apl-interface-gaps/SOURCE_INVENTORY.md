# Track C source inventory — APL aggregate interface

Baseline: v356 commit `dc08d4a49b5e0e9650e040e0b1930cbbf9a16435`

Scope: documentation-only research for the APL aggregate Harting interface, guard-monitoring roles, engineered connector covers, and the applicable 605576 schematic references. This branch does not alter the diagnostic library, application code, or production data.

## Primary scanned training pages

| Existing source ID | File | Verified content | SHA-256 |
|---|---|---|---|
| `apl-contactor-figure-2` | `APL Main Contactor Faults/20090610014742309_0002.pdf` | Printed page 38. The APL aggregate servo-drive guard safety switch provides one contact directly in the servo-drive main-power-contactor path and a second contact for PLC monitoring. | `25dcebaad2243fb4213bc0b3dd180572b4bf7909a0c562551f6f12a42afb6414` |
| `apl-contactor-figure-3` | `APL Main Contactor Faults/20090610014742309_0003.pdf` | Printed page 54. HMI Help & Utilities / Aggregate Functions / Bottle stop describes the aggregate changeover state and aggregate-power-contactor selection. | `18786df6ed4449aecb77e080ab6d2be82fdf47fb4dc5bdaa9e2672ba71a24f94` |
| `apl-contactor-figure-4` | `APL Main Contactor Faults/20090610014742309_0004.pdf` | Printed page 33. Unused aggregate connectors require their correct protective covers; the large-cover assembly represents the absent aggregate to the engineered emergency-stop and guard-door circuits. | `de4875ab8df7b01f54f7c9fbdd0d530bbc47ff9382687fafa3001d703f6b8430` |
| `apl-contactor-figure-5` | `APL Main Contactor Faults/20090610014742309_0005.pdf` | Printed page 31. Harting interface functions A–F: reciprocal emergency-stop/guard contacts, machine-to-aggregate digital signals, aggregate-to-machine digital signals, spare section, and 460 VAC three-phase aggregate power. | `7f1d924d3ba5b28907711b31ea30906201432f5447e1d6556507829efe852fb7` |

## Supporting electrical schematic

| Existing source ID | File | Verified locator | SHA-256 |
|---|---|---|---|
| `apl-schematic-605576` | `605576 (APL) Schematic.pdf` | 71-page drawing set. PDF pages 18–19 provide control/power-panel context; PDF pages 58–65 contain `+KA` / `9706` aggregate-station references and related terminal information. Exact sheet and revision must be verified on the machine before tracing. | `84a201c2231a9ee0b9a78e323df8d1b5f931b933e548530709e8d9e23ffa4096` |

## Import boundaries

- Use the training pages for functional descriptions only.
- Do not publish pin numbers, jumper arrangements, safety-bypass instructions, or fabrication instructions.
- Do not treat an HMI selection or a de-energized contactor as verified electrical isolation.
- Do not generalize the 605576 signal path to another machine or drawing revision.
- Keep all electrical inspection behind approved stop, lockout/tagout, absence-of-voltage verification, and site-qualified personnel requirements.

