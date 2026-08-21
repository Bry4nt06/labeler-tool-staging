# ServoForge Engineering Instructions

These instructions apply to every change in this repository. Read
`docs/ENGINEERING_WORKFLOW.md` before modifying application or deployment code.

## Repository roles

- `Bry4nt06/labeler-tool-staging` is the development source of truth.
- Staging `main` deploys to `https://labeler-tool-staging-production.up.railway.app`.
- `Bry4nt06/labeler-tool-app` is the production repository and deploys to
  `https://labeler-tool-app-production.up.railway.app`.
- Do not treat `Bry4nt06/Bry4nt06-labeler-tool-production-new` or
  `Bry4nt06/labeler-tool-app-KsgX` as a release target unless the owner explicitly
  changes this policy.
- Never develop directly in the production repository. Production receives an
  exact, verified staging commit through a reviewable promotion PR.

## Required workflow

1. Start from an up-to-date staging `main` and a clean worktree. Preserve unrelated
   user changes. Create a `codex/<short-task>` branch for all writes.
2. Reproduce the problem and state the behavioral invariant before implementing a
   bug fix. Add or update a regression test that fails for the original defect.
3. Trace the full data/control path and identify the existing authoritative owner.
   Do not add a second owner, parallel renderer, duplicate event loop, or competing
   state field.
4. Implement the smallest complete correction in the authoritative module. Make
   rules data-driven and brand-independent unless the physical machine requirement
   is genuinely brand-specific and documented.
5. Consolidate the touched subsystem before calling the work complete. Fold any
   superseded fix, hotfix, recovery wrapper, compatibility shim, duplicated
   listener, or versioned patch into one maintained implementation; then remove its
   file, loader reference, service-worker entry, global marker, and obsolete tests.
   Temporary diagnostics must not ship.
6. Run syntax checks, the focused regression, the affected domain suite, startup
   and update tests, and any broader tests selected by the change risk. A change may
   introduce zero new failures. Compare suspicious failures with staging `main` and
   report any verified baseline failure explicitly.
7. Review `git diff`, `git diff --check`, and `git status`. Commit only intended
   paths. Push a draft PR to staging, review it, and merge only when its checks and
   acceptance criteria pass.
8. Verify the staging Railway deployment by commit status, HTTP response, live
   `update-manifest.json` build ID, and a smoke test of the changed behavior.
9. For an implementation request, production promotion is the final step unless the
   user says staging-only. Promote the exact verified staging SHA to a production
   feature branch, preserve production-only authentication/server configuration,
   remove staging-only identity, update production release metadata, run production
   checks, merge a reviewable PR, and verify Railway. Never copy from a mutable URL
   or use an unreviewed direct push.
10. Finish with the root cause, invariant, consolidated/deleted code, tests and
    results, staging and production commit/build IDs, deployment links, remaining
    risks, and rollback commit.

## Non-negotiable code-health rules

- One behavior has one authoritative implementation and one documented data source.
- Do not solve a general invariant with a brand-name conditional.
- Do not create `*-fix`, `*-hotfix`, `*-recovery`, `*-patch`, or another versioned
  integration as the final architecture. Such code is temporary within the branch
  and must be consolidated before merge.
- Do not leave stale files merely because they are no longer loaded. Delete them
  after proving they have no remaining consumers.
- Do not combine unrelated cleanup with a functional change. Consolidate the code
  path touched by the request; schedule wider cleanup separately.
- Do not weaken, delete, or rewrite a valid test just to make a change pass.
- Do not claim deployment success until the live build marker and critical flow have
  been verified.
- Do not expose secrets, copy production data into tests, or replace production-only
  authentication/environment files during promotion.

## Completion standard

Work is complete only when behavior is correct, regression-protected, consolidated,
reviewed, deployed through the required environments, smoke-tested, and reversible.
Diagnosis-only or review-only requests stop before mutation or deployment unless the
user explicitly expands their scope.
