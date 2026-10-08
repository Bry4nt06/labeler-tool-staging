# Cold Glue main-map animation work

Staging acceptance build: `cold-glue-frame-performance-v359-20261008`.
Baseline and rollback target: `8e9fa13` (v358). Staging-only pending user test.

The gripper-sequence integration watched every child-list change in Map Builder,
then assigned badge text unconditionally. Assigning text creates another
child-list change, even when the value is identical. That scheduled another
animation-frame decoration, continuously, for Cold Glue maps.

The existing Cold Glue parameter editor now owns all builder parameter markup,
including gripper-order badges and brush-entry angle controls. It uses its existing
signature to render changed data once, and its observer only responds to replacement
builder rows/editors. The separate sequence decorator, observer, pending-frame flag,
style installation and input/change listeners were removed. The sequence module
continues to own normalization and motion generation, exposed to the editor through
one API. No generator math or frame clock changed.

The animation clock requests visible-only orientation updates. A hidden Program
tab or collapsed Bottle Orientation panel does no live SVG/coverage rebuild work;
explicit panel refreshes still work normally.

Three regression cases fail against untouched v358: self-scheduling decoration,
observer ownership, and hidden-panel frame work. Four regression cases pass here,
including exactly one generation/persistence transaction for a brush-entry edit.
Focused domain/update/UI suites pass (36 tests), the complete Cold Glue CI command
passes (25 tests), and startup passes (261 tests). Syntax/diff checks pass.
Two additional legacy suites (orientation mount recovery and progressive label
fill) fail identically on untouched v358 due to stale source/build expectations.
Their existing tests were not changed. The orientation-panel source contract was
updated to require visible-only refreshes, backed by the behavioral regression.

Browser interaction is sign-in blocked in the available browser. Deployment
verification uses the live manifest and downloaded runtime smoke tests. The user
must confirm smoothness on the affected map/device; no FPS claim is made.

Rollback by reverting the staging PR merge to v358; do not rewrite shared history.
