# Servo Simulation brand selection

Simulation used its own recipe mutation followed by `render("all")`, unlike
Build Inputs' authoritative brand transaction. That path persisted before
normalization and did not protect the user's requested recipe from compatibility
work during presentation. Both dropdowns now use
`LabelerBuildInputsController.selectBrand(value, { restoreTab })`.

The invariant is that a valid brand selection updates the matching bottle,
generated program, visible selectors and saved recipe while leaving the
independent simulation draft unchanged and keeping the originating workspace tab.
Invalid choices do nothing; the latest selection owns deferred presentation.
The duplicate Simulation mutation was removed, with no new listener or wrapper.

Regression: `tests/simulation-brand-selection.test.js` reproduces full-render
recipe replacement and delayed compatibility changes. Three cases fail before
the change and all five pass after it. `npm run test:simulation` passes 13 tests.
Adjacent brand, bottle, rendering, navigation, map reset and RPC tests pass 11;
startup passes 261; update passes 3. The old brand contact parameter source test
fails on untouched staging too because it requires the obsolete
`editable-contact-parameters-v65-20260811` marker; it is unchanged.
The existing browser simulator/print CI now selects another brand through the
real dropdown event at 1280px and 390px, checks displayed and persisted context,
and verifies preservation of the complete custom draft.

Release: `simulation-brand-selection-v360-20261008`. Staging acceptance precedes
production promotion. Rollback: reviewably revert this release's merge commit,
returning to staging commit `6cdc70d6b3b543ec2010f25b31480f62bc376ea6` (v359).
