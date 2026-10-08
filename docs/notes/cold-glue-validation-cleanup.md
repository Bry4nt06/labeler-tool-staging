# Cold Glue validation and terminal cleanup

Staging build: `cold-glue-validation-cleanup-v357-20261007`.
Baseline/rollback: `1cc7e6923e960cdeca30bcd827465ee87c13af45`.

The profile generator's working motion remains unchanged. Validation now measures
commanded rotation within upstream contact windows and explicitly owned downstream
finishing brushes. Only deferred final-phase debt can receive finishing credit.
Noncontact, wrong-direction, overspeed, and post-gripper motion cannot pay that debt.
The mechanical Cold Glue driver owns this calculation; motion validation replaces
upstream capacity messages only where that complete calculation is available.
Full-wrap overlap/seam rules and No Reverse Across Label conflicts remain intact.

Cold Glue centerline validation samples the existing simulation curve at each
physical application gripper. It excludes post-application brush-entry references
and checks the fixed Neck/Body 0° and Back 180° pickup datums. Autocol framing removes
only a trailing zero-travel correction, preserving the achieved Rest and terminal
plate angle. Existing speed thresholds are unchanged.

Validation: all 19 Cold Glue/adjacent tests, two profile-boundary/readiness tests,
and 261 startup checks passed. Syntax and whitespace checks passed. The unchanged
`label-centerline-policy.test.js` fails on baseline because it asserts a retired
bootstrap build ID, before reaching its behavioral assertions.

Acceptance on the operator's map: regenerate the same brand in No Reverse Across
Label mode; confirm the Body reaches 90° at its brush entry and holds through the
channel, inspect the upstream/downstream coverage breakdown, confirm redundant
terminal CMD 7 removal, and retain any real incomplete-coverage or speed fault.
Coverage reports describe commanded contact against saved brush geometry, not a
physical machine commissioning approval. Production promotion is outside this
staging-only update.
