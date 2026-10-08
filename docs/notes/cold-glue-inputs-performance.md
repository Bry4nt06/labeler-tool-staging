# Cold Glue build inputs and animation

Staging-only acceptance build: `cold-glue-inputs-performance-v358-20261008`.

The Brush Exit Motion selector now lives under Cold Glue Program Parameters in
Build Inputs. The canonical value remains `machineSettings.coldGlueBrushExitMotion`
on the active map; regeneration and persistence use the existing workspace action
controller. Map Builder no longer binds or renders this control, and map/runtime
synchronization preserves the saved setting.

The simulation engine derives segments once within each synchronous dashboard
animation frame. The cache is discarded even when a render throws, and speed-limit
changes invalidate the frame entry. No persistent program cache or new loop exists.
The map animation renderer updates bottle/pocket/gripper transforms directly across
ordinary command transitions; structural changes, active move overlays and fault
programs retain the existing scene redraw behavior. Servo motion is unchanged.

Verification: all three new regressions fail against staging main and pass on this
branch; focused Cold Glue/map/build/wrap/update suites pass (30 tests); startup passes (261).
The existing Cold Glue CI workflow runs the new regression suite and watches its
animation modules.
Broad 3D suite: 73 pass / 15 fail, identical to untouched staging main. Three extra
presentation/controller source-contract tests also fail identically on main.
No existing tests were weakened. Browser localhost access is blocked in the
available cloud browser; live UI verification follows staging deployment.

Rollback: revert the staging PR merge to its baseline `1e26129` through a reviewable
revert. Production promotion is deferred until the user's staging acceptance.
