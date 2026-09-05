# PLC Analyzer Phase 11 — Static Sequence / State-Machine Topology

## Purpose

Phase 11 addresses the original ServoForge PLC Analyzer question: **how does the exported logic say this sequence is supposed to progress?**

It adds a conservative static state/step graph on top of the proven v10 analyzer. It does not execute or simulate the PLC.

## Evidence model

v11 identifies a candidate sequence variable only when the supplied ladder source contains both:

1. an exact numeric `EQU` gate against a scoped symbol, and
2. a numeric assignment to that same scoped symbol using `MOV`, `CLR`, or a constant `CPT`.

An exact transition edge is created only when the exact `EQU` gate and numeric assignment occur on the **same source-visible ladder rung**.

Example source:

```text
EQU(Step,10)XIC(StartRequest)MOV(20,Step)
```

v11 may represent this as:

```text
Step: 10 -> 20
Guard evidence: XIC(StartRequest)
Program/Routine/Rung: source location
```

This is static source evidence. It does not prove that state 10 is currently active, that the rung executes, or that the transition will occur at runtime.

## Timer-gated transitions

When a transition rung contains a source-visible `XIC(<timer>.DN)` or `XIO(<timer>.DN)`, v11 attaches that `.DN` gate to the transition.

If the existing timer inventory has numeric PRE evidence for the timer, that evidence is attached for review. PRE values are not recommendations.

A `.DN` reference does not prove that the timer is currently done.

## Scoped identity

State symbols preserve the same scope discipline used by the dependency and consistency analyzers:

- program-scoped declaration: program-specific sequence identity
- controller-scoped declaration: shared controller sequence identity
- unresolved declaration: retained as unresolved source evidence

A structured member such as `Machine.State` keeps the full member path while declaration scope is resolved from the root tag.

## Numeric literals

v11 recognizes decimal numeric state values and common Rockwell radix forms such as:

- `16#0A`
- `2#1010`
- `8#12`
- `10#10`

The canonical state value is used for graph matching while the original source literal is preserved in evidence.

## Review findings

v11 can produce the following review records:

### Sequence topology identified

Informational summary containing:

- scoped state variable
- source-visible numeric states
- exact transition edges
- source locations
- timer `.DN` gates
- unanchored assignments

### Multiple source-visible targets from one state

If one source state has more than one exact numeric transition target, v11 raises a review cue and preserves the rung guards for SME review.

Branching can be intentional. This is not automatically a discrepancy.

### Assigned state with no exact source-visible gate

If a numeric state is assigned but no exact numeric `EQU` gate for that value is found, v11 records an informational review item.

Possible explanations include:

- terminal state
- reset state
- another language
- protected logic
- HMI/external write
- incomplete export

The analyzer does not call the state dead or invalid.

### Gated state with no source-visible numeric assignment

If a state is tested but no numeric `MOV`/`CLR`/constant `CPT` assignment to that state is found, v11 records an informational review item.

Possible explanations include startup initialization, HMI/external writes, other languages, protected logic, or export scope.

### Unanchored assignments

A numeric assignment occurring without an exact same-symbol `EQU` on the same rung is retained as evidence but v11 does **not** invent a source state. These often represent initialization/reset or alternate paths.

## What v11 deliberately does not infer

v11 does not claim:

- current PLC state
- actual scan/execution order
- that a task is currently running
- which branch is selected
- that a timer is currently done
- transition timing
- scan duration
- input/output condition
- device health
- protected or missing logic behavior
- Structured Text or SFC transition behavior not parsed by the ladder layer
- dynamic state targets calculated through non-constant math
- that every state write is visible in the supplied export

## Search behavior

Sequence transitions are added to the existing analyzer search index as openable rung evidence.

Searching a symbol such as `Step` can return records such as:

```text
Step: state 10 -> 20
Step: state 20 -> 30
```

Opening the result shows the original rung source.

## Compatibility

v11 wraps `l5k-analyzer-consistency-v10.js` and preserves all earlier layers:

- v4/v4.1 legacy neutral-`N:` support
- v5 dependency graph
- v6 call-graph review
- v7 task scheduling
- v8 produced/consumed topology
- v9 MSG/MESSAGE topology
- v10 intra-project peer consistency

Legacy RSLogix 5000 v15.02 exports remain supported.

## Safety boundary

Phase 11 is local/read-only static analysis. ServoForge does not connect to, write to, force, reset, or modify a PLC.

State values, timer values, thresholds, sequence edges, and source-review findings require machine-specific/runtime verification before any field change.
