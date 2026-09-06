# Master handoff — Track C: APL aggregate interface

## Branch

- Repository: `Bry4nt06/labeler-tool-staging`
- Branch: `codex/v356-apl-interface-gaps`
- Baseline: v356 commit `dc08d4a49b5e0e9650e040e0b1930cbbf9a16435`
- Change type: research documentation only

## Recommended implementation

1. Read all six files in this folder.
2. Add one support/reference record from `APL_INTERFACE_RECORD.md`: `apl-aggregate-interface-reference`.
3. Use the existing authoritative diagnostic library, renderer, search index, and state conventions; do not add a parallel registry or rendering path.
4. Cross-link the new reference to the existing `apl-aggregate-connection` and `apl-main-contactor` records.
5. Reuse existing source IDs. Correct the figure 2–5 catalog topics only after checking search/analytics/test dependencies.
6. Keep pin mappings, jumper arrangements, bypass instructions, and cover-fabrication details out of operator-facing content.
7. Obtain the reviews listed in `SME_REVIEW_QUEUE.md` before treating the record as approved.
8. Run the repository's normal validation, search, renderer, and source-reference tests.

## Acceptance criteria

- Exactly one new record ID: `apl-aggregate-interface-reference`.
- No duplicate APL main-contactor, aggregate-connection, or guided-flow record.
- Every source reference resolves to an existing source object.
- Operator-facing content clearly states that HMI/contactor state is not verified electrical isolation.
- No pin-level mapping, jumper prescription, safety bypass, or fabricated-cover instruction is exposed.
- The correct engineered/keyed cover requirement and separate guard control/monitoring roles are searchable.
- The record routes users into the existing fault records for diagnosis.
- No application or production deployment occurs from this research branch.

## Copy-ready instruction for the master chat

> Pull branch `codex/v356-apl-interface-gaps` from `Bry4nt06/labeler-tool-staging` and read `docs/troubleshooting/v356-apl-interface-gaps/MASTER_HANDOFF.md`. Implement the single proposed support/reference record through the existing v356 troubleshooting-library architecture. Reuse the registered APL source IDs, preserve the documented safety boundaries, avoid duplicate fault/flow records, run the normal validations, and do not deploy to production.

