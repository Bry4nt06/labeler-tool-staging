# Track B — Relationships

## Routing matrix

| Observed condition | Primary record | Route/link |
|---|---|---|
| Orientation varies bottle-to-bottle at any speed | `orientation-inaccurate` | Preserve existing mechanics, slip, centering, optics, sync, and motor-assignment path. |
| Orientation shifts after encoder/table-cam work | `orientation-sync-after-encoder` | Preserve existing synchronization path. |
| Image acquisition or sequence fault | `orientation-image-sequence` | Preserve camera cable, framegrabber, wiring, connector, and trigger-software path. |
| Trigger Ready/Fault LEDs, CAN address, or 24 V evidence | `orientation-trigger-can` | Preserve existing communication/electrical path. |
| Correct at low speed; result goes to wrong plate at higher speed | `orientation-high-speed-wrong-plate` | New narrow result-timing/assignment path. |
| Geometry or recipe baseline is suspect | `orientation-trigger-geometry-baseline` | New machine-baseline comparison path. |
| Fault begins after camera CPU replacement | `orientation-camera-cpu-replacement` | New network-identity restore path, then link to existing image/CAN records if identity is correct. |
| A new embossed bottle/type is being commissioned | `dart-embossed-bottle-commissioning` | New qualified commissioning guide, not an operator reset. |

## Proposed guided-flow links

For master implementation consideration only:

- In `autocol-orientation-flow`, add a branch for “Correct at low speed but wrong plate at higher speed” → `orientation-high-speed-wrong-plate`.
- Add “Problem began after camera CPU replacement” → `orientation-camera-cpu-replacement`.
- Add “Commission a new embossed bottle/type” → `dart-embossed-bottle-commissioning`, visibly marked qualified commissioning.
- Let `orientation-high-speed-wrong-plate` link to `orientation-trigger-geometry-baseline` when geometry does not match the machine baseline.

## Non-duplication rule

The new records must not restate the complete mechanics/optics, sync, image-sequence, or trigger/CAN procedures. Cross-links are the intended relationship.
