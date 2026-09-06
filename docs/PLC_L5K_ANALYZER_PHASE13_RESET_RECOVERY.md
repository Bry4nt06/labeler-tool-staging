# PLC Analyzer v13 — Reset / Recovery Topology

## Purpose

Phase 13 adds static source analysis for reset, unlatch, and recovery relationships already present in the supplied L5K export.

The analyzer does **not** execute, recommend, add, or modify reset logic.

## Source-proven instruction scope

v13 uses the existing parser's recognized Rockwell instructions:

- `OTU(target)` — unlatch path evidence
- `RES(target)` — reset-structure path evidence
- `OTL(target)` — latch writer used to build latch-to-unlatch relationships

No other instruction is silently treated as a reset.

For each OTU/RES call, v13 preserves:

- target
- program
- routine
- rung
- source line
- exact rung source
- source-visible preceding `XIC` / `XIO` conditions
- source-visible preceding `EQU` / `NEQ` / `LES` / `LEQ` / `GRT` / `GEQ` / `LIM` comparisons
- task scheduling / task-root reachability context when available

## Latch-to-unlatch relationships

For exact matching targets, v13 groups:

`OTL(target) -> OTU(target)`

The relationship proves only that both source call sites exist in the supplied export.

It does not prove:

- the latch is currently set
- the unlatch rung executes
- reset prerequisites are currently true
- the originating fault/interlock cause has cleared
- the machine is safe to restart
- the reset is appropriate for the current machine state

## RES classification

A `RES(target)` path is classified against source-visible native instructions already parsed in the project:

- timer — target appears in TON/TOF/RTO evidence
- counter — target appears in CTU/CTD evidence
- timer-counter — both are visible
- unresolved-res-target — current parser does not resolve the target as a native timer/counter

An unresolved RES target is not automatically an error. Rockwell control structures and incomplete/protected/exported scope can require additional review.

## Review findings

v13 may add conservative review cues for:

- source-visible OTL target with no located OTU path
- source-visible OTU target with no located OTL writer
- RES target not resolved as a native timer/counter by the current parser

These are static inference/review cues, not machine defects.

## Search and dependency trace

Search can return `recovery-path` records by:

- target
- OTU/RES instruction
- reset gate symbol
- routine/program
- source text

`traceTarget()` adds reset/recovery contexts for matching targets while retaining explicit `resetStateProven: false` and `resetSafetyProven: false` boundaries.

## Safety boundary

A reset can remove a software latch without removing the physical cause that produced it.

v13 therefore never interprets an OTU or RES path as evidence that a machine should be reset or restarted.

Never use offline analysis to:

- force a reset condition
- bypass a machine or safety interlock
- clear a fault without correcting its cause
- infer that stored/mechanical/electrical energy is safe
- infer that an axis, drive, module, or field device is healthy

Use approved machine procedures, LOTO/stored-energy controls where required, and qualified energized electrical practices where applicable.

## Local-only invariant

The file remains parsed locally in the browser. v13 does not connect to a PLC, write to a controller, upload the project, or persist the L5K source.
