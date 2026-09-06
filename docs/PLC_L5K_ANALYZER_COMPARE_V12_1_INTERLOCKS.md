# PLC Analyzer Compare v12.1 — Interlock / Permissive Path Differences

## Purpose

Compare the v12 static interlock/permissive topology between two L5K exports without treating an offline source difference as a confirmed machine fault.

v12.1 is layered on top of the existing Compare stack. It does not replace rung, fault, timer, task, communications, MSG/MESSAGE, peer-consistency, or sequence comparisons.

## Source model

The comparison uses `project.dependencies.interlockTopology.actionPaths` produced by `l5k-analyzer-interlocks-v12.js`.

A v12 action path is source-visible same-rung evidence for a supported action such as:

- `OTE`
- `OTL`
- supported motion actions including `MSO`, `MSF`, `MAH`, `MAR`, `MAM`, `MAS`, `MAJ`, `MAG`, `MAPC`, `MCD`, and `MCS`

The path preserves preceding supported gate evidence:

- `XIC`
- `XIO`
- `EQU`
- `NEQ`
- `LES`
- `LEQ`
- `GRT`
- `GEQ`
- `LIM`

## Differences reported

For each source-visible action target, v12.1 can report:

- target path added or removed
- XIC/XIO polarity changes
- contact-symbol changes
- comparison instruction/operand changes
- numeric comparison-threshold changes as source evidence
- writer/action or routine changes
- additional/removed alternate source-visible paths
- self-hold/seal-in candidate evidence changes
- task-root reachability context changes

The comparison intentionally ignores source line number and raw rung text when deciding whether the interlock topology itself changed. Ordinary rung/source comparison already covers textual changes. This reduces false interlock differences caused only by comments or source-line movement.

## Safety and evidence boundary

v12.1 is **not a Boolean ladder solver**.

It does not prove:

- parallel branch semantics
- that every displayed gate is series-required
- current XIC/XIO truth state
- current permissive/interlock state
- physical switch/interlock condition
- action execution
- task execution
- controller mode
- that either export is correct for the machine

A changed comparison constant, contact sense, or path is source evidence only. The analyzer does not recommend replacement timer, threshold, interlock, or permissive values.

Never use offline source comparison as justification to force or bypass machine or safety interlocks.

## UI

Compare adds an **Interlock / permissive paths** filter and summary count. Difference details show baseline/current normalized path evidence and a dedicated interlock safety boundary.

## Local-only invariant

The v12.1 engine, Compare worker, and UI remain browser-local/read-only. They do not connect to, write to, force, reset, bypass, or modify a PLC or either supplied export.
