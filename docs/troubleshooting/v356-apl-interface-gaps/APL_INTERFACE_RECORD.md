# Proposed troubleshooting-library record

This is an implementation-ready content specification. The master branch should adapt its shape to the current authoritative record schema and renderer.

## Identity

- ID: `apl-aggregate-interface-reference`
- Code/title: `APL AGGREGATE INTERFACE REFERENCE`
- Category: `APL / Aggregate`
- Record type: support/reference
- Suggested aliases: `Harting sections`, `APL interface`, `aggregate plug`, `aggregate connector cover`, `unused aggregate connector`, `servo drive guard switch`

## Summary

The APL aggregate interface separates reciprocal emergency-stop and guard-door contacts, digital signals in both directions, a spare section, and three-phase aggregate power. The servo-drive guard safety switch has distinct contactor-control and PLC-monitoring roles. When an aggregate is absent, the correct engineered and keyed connector-cover assembly is part of the intended machine configuration. Use this reference to capture interface evidence, then route the fault to the existing aggregate-connection or main-contactor diagnostic.

## Probable causes

- Correct connector or engineered cover is missing, mismatched to the station/revision, not fully seated, or not latched.
- Connector, cover, pins, insert, or seal is contaminated, bent, damaged, or loose.
- Aggregate guard or servo-drive guard switch is not physically made.
- PLC monitoring and the contactor-control path do not agree with the expected safe state.
- Approved aggregate-power-removal/changeover state was not completed or verified.
- Machine wiring or safety-circuit revision differs from the drawing being referenced.

## Checks

1. Capture the first HMI message and machine state before resets. Record the affected station and whether an aggregate is docked or intentionally absent.
2. Confirm the approved stopped/changeover condition and bottle disposition. An HMI selection or contactor state is not electrical isolation; apply the site procedure for lockout/tagout and absence-of-voltage verification before connector or electrical work.
3. Under the approved safe state, verify the exact OEM/keyed connector or cover required for that station and machine revision. Check that it is fully seated and latched and that there is no visible damage or contamination.
4. Inspect physical actuation of the aggregate/servo-drive guard switch. Use the approved schematic to distinguish the main-contactor control contact from the PLC-monitoring contact; do not infer one path is healthy because the other changes state.
5. Use the exact 605576 sheet set and revision for the machine to trace the applicable functional section. Do not carry terminal or signal assumptions between machines.
6. Route the finding to `apl-aggregate-connection` for connection/docking/cover issues or `apl-main-contactor` for a contactor-chain symptom.

## Corrective actions

- Correct only a proven seating, cover, connector, or guard-actuation issue using approved parts and site procedures.
- Replace damaged connector/cover/guard components through the approved maintenance process.
- After every aggregate connector or engineered cover is present and secured, perform the approved changeover and reset sequence.
- Escalate to a qualified controls/electrical technician when monitoring and control paths disagree or when the applicable drawing revision cannot be verified.
- Never fabricate a cover, bridge a safety contact, install an unapproved jumper, or bypass an emergency-stop/guard circuit.

## Safety tags

- `safety.observe`
- `safety.loto`
- `safety.electrical`
- `safety.servo`

## Source references

| Source ID | Locator / use |
|---|---|
| `apl-contactor-figure-2` | Printed page 38: functional split between the servo-drive main-power-contactor contact and PLC-monitoring contact. |
| `apl-contactor-figure-3` | Printed page 54: HMI aggregate-functions and changeover context. Do not interpret the HMI state as LOTO. |
| `apl-contactor-figure-4` | Printed page 33: correct engineered connector covers for stations without a docked aggregate. No pin/jumper detail should be surfaced. |
| `apl-contactor-figure-5` | Printed page 31: interface functions A–F. |
| `apl-schematic-605576` | PDF pages 18–19 and 58–65: control/power-panel and `+KA`/9706 supporting context; exact sheet/revision verification required. |

