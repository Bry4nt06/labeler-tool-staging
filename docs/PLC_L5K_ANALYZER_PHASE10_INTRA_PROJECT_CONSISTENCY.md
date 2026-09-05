# PLC Analyzer Phase 10 — Intra-Project Consistency Review

## Purpose

Phase 10 adds a bounded static review layer for discrepancies that can exist **inside one L5K export**.

Earlier analyzer phases can already:

- inventory timers, counters, faults, I/O, modules and axes;
- trace source dependencies;
- build task/program/routine topology;
- inspect produced/consumed tags and MSG/MESSAGE configuration;
- compare two separate L5K exports.

Phase 10 addresses a different question:

> Do source-visible peer program scopes contain different timer, counter or numeric decision evidence that deserves SME review?

## Peer-family rule

A Phase 10 peer family is intentionally conservative.

The analyzer only compares instances when all of the following are source-visible:

1. the tag is declared in a **program scope**;
2. the same tag/member expression appears in at least two distinct program scopes;
3. the relevant timer/counter/comparison instruction is present in parsed source.

Controller-scoped shared tags are excluded from peer-outlier classification because multiple programs may intentionally reference the same shared object.

The fact that two program-scoped tags have the same name does **not** prove that they perform the same machine function. Peer grouping is therefore classified as `static-inference`, not as a verified defect.

## Native timer review

The analyzer collects source-visible:

- `TON`
- `TOF`
- `RTO`
- numeric inline PRE arguments
- numeric `MOV(..., Timer.PRE)` assignments when the declaration is source-visible

Review findings can be generated when source-proven program-scoped peers differ in:

- timer instruction family; or
- numeric PRE evidence.

A majority value may be reported when three or more peers provide source evidence and at least two agree. A majority is **not** treated as the correct value.

## Native counter review

The analyzer collects:

- `CTU`
- `CTD`
- numeric inline PRE arguments
- numeric `MOV(..., Counter.PRE)` assignments when the declaration identifies a `COUNTER`

Differences are review cues only. No replacement preset is generated.

## Numeric decision threshold review

Phase 10 inventories numeric comparison signatures for:

- `EQU`
- `NEQ`
- `LES`
- `LEQ`
- `GRT`
- `GEQ`
- `LIM`

A threshold family is only compared when the compared symbol resolves to a source-proven program-scoped declaration in multiple programs.

Examples of source signatures include:

- `LES: symbol-left:20`
- `GRT: symbol-left:29000`
- `LIM:10:40`

The analyzer compares source signatures; it does not assign engineering units or determine whether a threshold is correct for the machine.

## PLC-cycle / pseudo-timer protection

When a compared symbol is also source-visible in a self-increment pattern such as:

`ADD(CycleCount,1,CycleCount)`

Phase 10 preserves an explicit warning:

- the value may represent PLC cycles/scans;
- numeric thresholds must not be converted to milliseconds without runtime scan-time evidence.

This maintains the same evidence discipline used by the Troubleshooting Library.

## Findings

Phase 10 findings use:

- `sourceRule: plc-intra-project-consistency-v10`
- `classification: static-inference`
- `severity: review`

Typical finding IDs:

- `v10:timer-instruction-peer:<tag>`
- `v10:timer-preset-peer:<tag>`
- `v10:counter-instruction-peer:<tag>`
- `v10:counter-preset-peer:<tag>`
- `v10:threshold-peer:<tag>`

Each finding carries source evidence for each peer program, including declaration line, instruction evidence, PRE/threshold evidence and self-increment evidence where applicable.

## Source boundary

Phase 10 does **not** prove:

- that same-name program tags serve identical functions;
- that a majority value is correct;
- that a different value is defective;
- live PLC state;
- task execution or scan duration;
- engineering units for arbitrary numeric thresholds;
- physical wiring/device condition;
- that a field setting should be changed.

Timer presets, counter presets and numeric thresholds remain source evidence only and are not adjustment recommendations.

## Architecture

Phase 10 is implemented as a wrapper on top of the deployed v9 analyzer:

`l5k-analyzer-message-v9.js`

→ `l5k-analyzer-consistency-v10.js`

The v1–v9 parser layers are not rewritten.

The normal browser worker loads v10 after v9, so the same analysis path is used in worker and no-worker fallback modes.

## Production boundary

This phase applies only to the staging ServoForge repository until explicitly promoted. It remains browser-local and read-only and does not connect to, write to, force, reset or modify a PLC.
