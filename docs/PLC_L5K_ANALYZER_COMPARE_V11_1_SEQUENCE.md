# PLC Analyzer Compare v11.1 — Sequence Topology Diff

## Purpose

Compare the static sequence topology extracted by PLC Analyzer v11 between two L5K exports.

The baseline file is intended to be a known-good/reference project and the current file is the revision being reviewed. v11.1 reports source-visible sequence differences; it does not simulate either PLC.

## Source model

v11 identifies sequence variables only when ladder source contains:

- an exact numeric `EQU` gate for a symbol; and
- a numeric `MOV`, `CLR`, or constant `CPT` assignment to the same scoped symbol on that rung.

A v11 transition therefore represents source evidence of the form:

`EQU(Step,20) ... MOV(30,Step)`

as the static edge:

`Step 20 -> 30`

This is intentionally narrower than trying to infer every possible state machine from arbitrary ladder logic.

## v11.1 differences

The comparison layer reports:

- sequence variable/topology added or removed;
- numeric state set changed;
- transition edge added or removed;
- retained transition whose source context changed;
- guard/contact/comparison changes on a retained edge;
- timer `.DN` gate changes on a retained edge;
- numeric timer PRE evidence changes associated with a transition;
- assignment-instruction changes;
- task schedule / task-root reachability context changes;
- source-rung/location changes.

## Timer boundary

A timer PRE shown beside a transition is source evidence only.

v11.1 must never treat a changed PRE as a recommended replacement value. The Compare UI explicitly labels changed timer-gate context for review.

## Reachability boundary

`taskRootReachable` means only that the supplied export contains a source-visible TASK -> PROGRAM MAIN -> JSR route to the transition rung.

It does not prove:

- that the task is currently executing;
- that the task is uninhibited;
- controller mode;
- branch selection;
- current state;
- scan order;
- live timer completion;
- physical I/O state.

## Classification

Sequence differences use `static-inference` because v11 itself is a constrained static interpretation of source-visible numeric state logic.

A new branch or removed edge is a review cue, not automatically a defect.

## Compare category

UI category:

`sequences`

Kinds include:

- `sequence-variable`
- `state-set`
- `transition`
- `transition-context`
- `timer-gated-transition`

## Local-only invariant

The implementation remains browser-local and read-only:

- no PLC connection;
- no upload endpoint;
- no `fetch` / XHR from the compare engine;
- no force/write/reset behavior;
- no localStorage/IndexedDB storage of project source.

## Regression expectations

v11.1 tests cover:

1. identical exports produce zero sequence differences;
2. state/edge changes are identified;
3. branch additions remain review cues, not defect claims;
4. timer `.DN`/PRE context changes are identified without recommending values;
5. task-root reachability changes are retained as source context only;
6. the existing category filter can isolate `sequences`;
7. page/worker load order keeps v11 analysis before v11.1 compare;
8. all prior v1-v11 analyzer regressions remain green.
