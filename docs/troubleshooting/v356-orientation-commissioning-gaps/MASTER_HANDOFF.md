# Track B — Master Implementation Handoff

## Pull reference

- Repository: `Bry4nt06/labeler-tool-staging`
- Branch: `codex/v356-orientation-commissioning-gaps`
- Exact baseline: `dc08d4a49b5e0e9650e040e0b1930cbbf9a16435`
- Handoff directory: `docs/troubleshooting/v356-orientation-commissioning-gaps/`
- Scope of branch: six documentation files only; no shared implementation code, UI, deployment, or production changes.

## Content ready for implementation

1. `orientation-high-speed-wrong-plate`
2. `orientation-trigger-geometry-baseline`
3. `orientation-camera-cpu-replacement`
4. `dart-embossed-bottle-commissioning`

The normalized objects are in `ORIENTATION_RECORDS.md`. Each uses the native v356 fields and is accompanied by explicit symptom, quick-check, verification, escalation, related-entry, tag, safety, and evidence notes.

## Master implementation instructions

1. Start from staging/v356 lineage and inspect the branch diff before copying content.
2. Add the four objects beside the existing orientation records in `app/troubleshooting/diagnostic-library.js`; preserve native safety constants and registered source IDs.
3. Do not copy the supplemental prose as new unsupported schema fields. Map it into the current UI presentation or keep it as implementation notes.
4. Add related-entry navigation using existing app conventions; do not duplicate existing mechanics, optics, sync, image-sequence, or trigger/CAN text.
5. If updating `autocol-orientation-flow`, use the relationships in `RELATIONSHIPS.md` and keep qualified commissioning distinct from operator troubleshooting.
6. Resolve or deliberately defer every applicable item in `SME_REVIEW_QUEUE.md` before publishing numeric limits, screen-specific instructions, software/hardware remedies, or network settings.
7. Test search aliases/context routing for `wrong plate`, `high speed orientation`, `distance between rotary plates`, `table diameter`, `camera CPU`, `MAC`, `learn embossing`, and `new bottle type`.
8. Verify that cabinet work, energized measurements, motion tests, calibration/synchronization, controller changes, and camera CPU replacement remain qualified-personnel procedures.

## Acceptance checklist

- [ ] All four IDs are unique.
- [ ] Existing source IDs resolve.
- [ ] No archived IP/MAC values, part numbers, or machine-specific settings were imported as defaults.
- [ ] Existing orientation records remain the canonical route for slip, optics, sync, image-sequence, and CAN faults.
- [ ] High-speed wrong-plate behavior is testable at controlled and authorized production speeds.
- [ ] Camera CPU replacement requires verified installed identity and a controlled backup/restore path.
- [ ] Embossed-bottle setup is labeled qualified commissioning, not an operator reset.
- [ ] SME queue decisions are documented.

## Boundary reminder

This branch is a content-preparation handoff. It must not be merged as application implementation without master-chat review, schema mapping, SME disposition, and staging validation.
