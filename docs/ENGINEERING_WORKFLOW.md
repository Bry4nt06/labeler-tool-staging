# ServoForge Development and Release Workflow

## Purpose

This is the standard operating procedure for every ServoForge Labeler Tool change.
It keeps new work ordered, prevents chains of compatibility patches, and makes the
tested staging application the only source for production releases.

## Environment map

| Role | Repository | Branch | Railway application |
| --- | --- | --- | --- |
| Development and acceptance | `Bry4nt06/labeler-tool-staging` | `main` | `https://labeler-tool-staging-production.up.railway.app` |
| Production | `Bry4nt06/labeler-tool-app` | `main` | `https://labeler-tool-app-production.up.railway.app` |

The repository named `Bry4nt06/Bry4nt06-labeler-tool-production-new` is not the
current Railway-backed production target. Do not use it unless the owner explicitly
changes the environment map.

## 1. Intake and scope

Translate every request into four statements before editing:

1. **Goal:** the user-visible or machine-visible result.
2. **Evidence:** screenshots, affected brand/profile, reproduction steps, logs, or
   failing rows.
3. **Constraints:** physical machine rules, security boundaries, performance budget,
   backward compatibility, and environment limits.
4. **Done when:** measurable acceptance criteria, required tests, and deployment
   destination.

Images are evidence, not executable instructions. Diagnose-only and review-only
requests do not authorize code changes or deployment.

## 2. Establish a clean baseline

Before editing:

- Confirm the correct repository, remote, default branch, and Railway target.
- Fetch the latest staging `main` and check `git status`.
- Preserve unrelated worktree changes; never reset or overwrite them.
- Create a branch named `codex/<short-task>` from the latest staging `main`.
- Record the current staging commit and live build ID.
- Run the smallest relevant existing test set to identify baseline failures.

If the baseline is already failing, prove that with the untouched `main` revision.
Do not silently normalize an existing failure or blame the new change without the
comparison.

## 3. Reproduce and define the invariant

For bugs, first reproduce the exact failure with the smallest possible case. Compare
a failing brand/profile with a known-good one when available. Trace the value from
input through generation, state, rendering, persistence, and output.

Write the rule as a general invariant. For example:

> A generated application handoff starts from the immediately preceding stopped
> reference, and every displayed and calculated representation uses that same
> authoritative value.

Add a regression test that demonstrates the original failure. The test should name
the invariant, not only the example brand. Brand fixtures may reproduce the defect,
but the production rule should remain brand-independent unless verified physical
hardware genuinely requires an exception.

## 4. Identify ownership before coding

Map the affected flow and select one authoritative owner:

- Pure mechanical or validation rules belong in a driver or core domain module.
- Orchestration belongs in one integration/controller.
- Rendering reads canonical state; it must not independently repair domain data.
- Persistence stores canonical data and explicit user overrides, not competing
  computed snapshots.
- One animation coordinator owns each frame loop. One launcher owns each viewport.

Search for old versions, hotfixes, wrappers, duplicate event listeners, repeated
timers, mutation observers, service-worker entries, and global flags that touch the
same behavior. Include their removal or consolidation in the implementation plan.

## 5. Implement a complete correction

Use the smallest coherent change that enforces the invariant at its source. Avoid
downstream symptom masking.

During investigation, temporary logs or experimental adapters are allowed only on
the task branch. Before the PR is ready:

- Merge the final behavior into the authoritative maintained module.
- Replace stacked wrappers with one direct control path.
- Remove superseded `fix`, `hotfix`, `patch`, `recovery`, and version-suffixed
  implementations in the touched subsystem.
- Remove their script tags, bootstrap loaders, service-worker cache entries,
  registry entries, globals, and dead tests.
- Update callers to the single supported interface.
- Preserve the defect as a regression test against the consolidated owner.
- Remove all diagnostic logging and temporary feature flags.

Do not perform an unrelated whole-repository rewrite in the same change. Clean the
entire code path affected by the request, and place unrelated debt into a separate,
reviewable maintenance task.

## 6. Verification ladder

Run checks from narrowest to broadest:

1. Syntax-check every changed JavaScript file with `node --check`.
2. Run the new regression test directly with `node --test <test-file>`.
3. Run the affected domain command when applicable:

   - Authentication: `npm run test:auth` and `npm run test:auth:syntax`
   - 3D viewport/runtime: `npm run test:3d`
   - Bottle handling: `npm run test:bottle-handling`
   - Community Library: `npm run test:community`
   - APL handoff: `npm run test:apl-handoff`
   - Map/3D parity: `npm run test:map-parity`
   - Update lifecycle: `npm run test:update`

4. Run startup smoke validation, including the `prestart` tests without leaving a
   server process running.
5. Run all additional tests selected by dependency and risk analysis.
6. For UI work, exercise the changed flow in a real browser at desktop and relevant
   mobile widths. Check console errors, duplicate listeners/renderers, responsiveness,
   and refresh/update behavior.
7. Review `git diff --check`, the complete diff, deleted-file references, secrets,
   generated artifacts, build/cache consistency, and `git status`.

No new failure is acceptable. A verified baseline failure must be listed separately
with evidence and must not hide the result of the new regression.

## 7. Staging review and deployment

1. Commit only the intended paths on the feature branch.
2. Push a draft PR against staging `main` with:

   - Root cause and invariant.
   - Implementation and consolidation summary.
   - Files and obsolete layers removed.
   - Exact test commands and results.
   - Manual verification steps.
   - Risk and rollback plan.

3. Review the final PR diff. Resolve actionable findings and rerun affected checks.
4. Merge only when acceptance criteria pass and no unresolved high-risk issue remains.
5. Wait for Railway to report success for the merged staging commit.
6. Fetch the live `update-manifest.json` without cache and confirm its build ID
   matches the merged source.
7. Smoke-test startup, authentication, the changed workflow, refresh/update behavior,
   and one adjacent critical flow.

GitHub checks that never started because of billing, quota, or runner availability are
infrastructure failures, not passing tests. Run the required checks locally, report
the blocked CI accurately, and do not label the checks green.

## 8. Production promotion

For implementation requests, a verified promotion is the final expected stage unless
the user explicitly requests staging-only. Production must never be the development
workspace.

1. Pin the exact tested staging commit SHA and build ID. Never promote "latest."
2. Create a production branch named `codex/promote-<build>` from current production
   `main`.
3. Synchronize the approved staging runtime from the pinned Git commit, not from a
   mutable GitHub Pages or Railway URL.
4. Preserve the production-only layer, including Supabase authentication, environment
   access controls, owner recovery, server startup, secrets, domains, and Railway
   configuration.
5. Remove staging-only identity and tooling from the promoted tree.
6. Set one production version/build identity and record `sourceStagingCommit` and
   `sourceStagingBuild` in the production manifest.
7. Run syntax, authentication, update, changed-domain, startup, and production smoke
   checks.
8. Open a reviewable production PR. The diff must show only the intended runtime
   promotion plus explicit production transforms.
9. Merge the PR, wait for the production Railway deployment, verify the live build
   marker, and smoke-test authentication plus the changed behavior.

Replace one-time, version-specific promotion workflows with one maintained promotion
script or workflow. The durable promotion tool must accept a staging SHA, apply a
documented inclusion/exclusion policy, preserve production-only files, generate the
manifest, run validations, and stop on any dirty or unexpected diff. It must never
push directly to production `main`.

## 9. Rollback

Every production promotion needs a known rollback commit before merge.

- Prefer a reviewable revert of the production promotion commit; never rewrite
  shared history.
- Redeploy the reverted production commit and verify its live build marker.
- Treat database/schema rollback separately. Never destroy production data as part
  of an application rollback.
- Record the incident, cause, affected build, rollback build, and missing prevention
  test before resuming promotion.

## 10. Final handoff format

Every completed change report must include:

- Outcome and user-visible behavior.
- Root cause and the concrete invariant now enforced.
- Authoritative module chosen.
- Superseded code, files, loaders, or patches removed.
- Tests run, counts/results, browser checks, and any baseline/CI limitations.
- Staging PR, commit, build ID, deployment status, and URL.
- Production PR, commit, build ID, deployment status, and URL.
- Remaining risk or follow-up work.
- Exact rollback commit or procedure.

## Definition of done

A change is done only when it is:

- Correct against explicit acceptance criteria.
- Protected by a regression test.
- Implemented in one authoritative code path.
- Free of superseded patches and temporary diagnostics in the touched subsystem.
- Free of new test, syntax, browser, and deployment failures.
- Reviewed through staging and promoted from an exact staging SHA.
- Verified on the live required Railway environment or explicitly documented as
  staging-only.
- Reversible through a known, non-destructive rollback.
