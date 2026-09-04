# Master handoff — Track A RPC / Danfoss gaps

## Status

Research package prepared from the exact v356 baseline. This branch contains documentation only and is ready for the master implementation chat to review. No app scripts, HTML, source registration, search index, renderer, state, tests, deployment, or production files were changed.

## Branch contract

- Branch: `codex/v356-rpc-danfoss-gaps`
- Baseline: `dc08d4a49b5e0e9650e040e0b1930cbbf9a16435`
- Proposed new records: 3
- Existing records to reuse/link: 17
- Production authorization: none

## Prepared material

1. `SOURCE_INVENTORY.md` — sources, locators, and evidence limits.
2. `EXISTING_CONTENT_AUDIT.md` — duplicate check and confirmed gaps.
3. `RPC_DANFOSS_RECORDS.md` — three app-shaped record drafts.
4. `RELATIONSHIPS.md` — explicit links to current v356 records and minimal flow routing.
5. `SME_REVIEW_QUEUE.md` — blockers and validation questions.

## Recommended master implementation order

1. Resolve blocker-level SME questions, especially machine generation, two-minute delay, network-change authority, replacement variants, and approved mechanical values.
2. Re-audit the master integration branch for records added since v356.
3. Select one authoritative runtime owner for the three records; do not create duplicate catalogs or render/search/state paths.
4. Translate the reviewed drafts into the app's exact record schema and source-reference format.
5. Add aliases and context hints to existing search coverage without replacing current diagnostic codes.
6. Add the three small routing decisions to the existing servo/bottle-plate flow only if the current flow structure supports them cleanly.
7. Register sources only when missing; reuse the existing Danfoss source identity where already present.
8. Run the repository's documented validation and prestart checks before opening a PR.

## Acceptance checks for implementation

- Search finds code 600 from `600`, `no PC comm`, `Power PC`, and `master communication`.
- Code 600 guidance separates Ethernet/master readiness from CAN-IO and individual servomotor faults.
- Power diagnostics expose the evidence available on both the 300 V supply and monitoring-board screens without prescribing unverified electrical values.
- Replacement guidance prominently includes isolation, the ten-minute wait, correct connector tool, motor-ID assignment, and post-work verification.
- Existing servo faults and the base servo flow remain intact; there is no duplicate runtime owner.
- Machine-specific addresses, IPs, firmware, torque, and chemical specifications are not invented or generalized.
- All safety language remains visible in the rendered app on mobile and desktop.

## Suggested validation queries

- `600`
- `no PC communication`
- `Power PC not ready`
- `RPC monitoring board`
- `300V power supply`
- `status of every fuse`
- `replace bottle plate motor`
- `address new servomotor`
- `assign servo ID`

## Explicit exclusions

- No merge to the v356 branch.
- No deployment or production update.
- No changes to `diagnostic-library.js`, `index.html`, renderer, search, state, service worker, or extension registration.
- No field-use approval for the proposed mechanical procedure until the SME queue is resolved.

