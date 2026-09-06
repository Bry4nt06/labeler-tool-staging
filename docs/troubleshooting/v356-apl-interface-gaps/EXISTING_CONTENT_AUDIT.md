# Existing-content audit

Audited against v356 `app/troubleshooting/diagnostic-library.js` and `app/troubleshooting/apl-cart-foundation.js`.

## Content already present

| Existing item | Coverage | Decision |
|---|---|---|
| `apl-main-contactor` | Harting seating, servo guard switch, docking/guard safety, rewind/table servo, binding, wiring, HMI review, and reset-after-cause guidance. | Do not create another generic main-contactor record. |
| `apl-aggregate-connection` | Harting connection, docking/safety state, servo-drive cover switch, and rewind/table connection. | Retain as the primary fault route; enrich or cross-link it during master implementation. |
| `apl-rewind-servo-binding` | Mechanical binding route. | No Track C change. |
| `apl-main-contactor-flow` | Existing guided diagnostic flow. | Do not duplicate with a second changeover flow. |
| `apl-schematic-605576` and `apl-contactor-figure-1` … `-5` | Registered source objects. | Reuse existing source IDs. Do not introduce duplicate sources. |

## Gap to fill

The current library lacks a concise, reusable reference explaining what the aggregate interface sections do, why the correct engineered unused-connector cover matters, how the guard switch has separate control and monitoring roles, and what evidence to capture before routing into the existing fault records.

Proposed addition: one support/reference record, `apl-aggregate-interface-reference`. It should link back to `apl-aggregate-connection` and `apl-main-contactor`; it should not present itself as a new fault family.

## Source-catalog correction needed

The v356 topic labels for figures 2–5 do not consistently match the scanned pages:

| Source ID | Actual scanned subject |
|---|---|
| `apl-contactor-figure-2` | Servo-drive guard safety-switch contact roles |
| `apl-contactor-figure-3` | HMI aggregate functions / bottle-stop and changeover state |
| `apl-contactor-figure-4` | Engineered covers for unused aggregate connectors |
| `apl-contactor-figure-5` | Harting functional sections A–F |

The master implementation should correct descriptions/topics only after checking whether search aliases or analytics depend on the old labels. Preserve source IDs and file paths.

