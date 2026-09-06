# Track B — Existing Content Audit

## v356 schema and conventions

Native record fields in `diagnostic-library.js` are:

`id`, `code`, optional `number`, `category`, `aliases`, optional `contextHints`, `title`, `summary`, `probableCauses`, `checks`, `actions`, `safety`, and `sourceRefs`.

Conventions observed:

- IDs are lowercase kebab-case and describe the fault or diagnostic subject.
- `code` is the concise display/search label, usually uppercase.
- Categories are user-facing strings; existing orientation categories include `Bottle Orientation`, `Autocol / Orientation`, `Electrical / Communication`, and `Encoder / Timing`.
- Checks are evidence-gathering steps. Actions are corrections or controlled follow-on work.
- Safety references use the shared `safety.observe`, `safety.loto`, `safety.electrical`, and `safety.servo` strings.
- `sourceRefs` use a registered `sourceId` and a precise page/section locator.
- Existing ordering groups primary servo records first, then related diagnostic domains and guided flows. Track B should be inserted beside the existing orientation records, not appended into unrelated servo-fault ordering.

## Representative existing entry

`orientation-inaccurate` is the closest style reference. It separates optics, bottle slip, centering, RPC synchronization, motor assignment, and COM-device offset; uses concise action language; applies shared safety gates; and cites DARTplus, orientation hardware, and embossed-bottle sources.

## Duplicate and overlap matrix

| Proposed record | Exact duplicate? | Existing overlap | Required boundary |
|---|---:|---|---|
| `orientation-high-speed-wrong-plate` | No | `orientation-inaccurate`, `autocol-orientation-baseline`, `orientation-sync-after-encoder` | Cover the distinct symptom where low-speed behavior is acceptable but the result reaches the wrong plate as speed rises. Link to sync and motor-assignment records; do not repeat their full procedures. |
| `orientation-trigger-geometry-baseline` | No | `orientation-inaccurate`, `autocol-orientation-baseline` | Cover the two documented geometry inputs—distance between rotary plates and table diameter—and result timing evidence. Do not replace optical-distance, slip, centering, or sync guidance. |
| `orientation-camera-cpu-replacement` | No | `orientation-image-sequence`, `orientation-trigger-can` | Cover the post-replacement DRP network identity update only. Route cable, framegrabber, trigger/CAN, and 24 V faults to existing entries. |
| `dart-embossed-bottle-commissioning` | No | `orientation-inaccurate`, `autocol-orientation-baseline` | Provide a qualified setup/commissioning guide. It is not an operator reset and must not turn legacy example settings into universal values. |

## Existing records to preserve and link

- `autocol-orientation-baseline`
- `orientation-inaccurate`
- `orientation-image-sequence`
- `orientation-trigger-can`
- `orientation-sync-after-encoder`
- `servo-system-baseline`

## Existing flow impact

- `autocol-orientation-flow` currently routes shift-after-encoder, variable orientation, image-sequence, and trigger/CAN symptoms.
- `bottle-orientation-flow` already covers broad bottle-orientation routing.
- Master implementation may add links/results for the four new entries, but this track does not modify either flow.

## Audit result

The four proposed records fill real v356 gaps. Their narrow scope and related-entry routing prevent duplication of existing mechanics, optics, synchronization, image-sequence, and CAN diagnostics.
