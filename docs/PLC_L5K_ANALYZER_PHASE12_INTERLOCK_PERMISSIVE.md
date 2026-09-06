# PLC Analyzer v12 — Interlock / Permissive Path Analysis

## Purpose

Add a static source view for the troubleshooting question:

> Why can this output or action not happen according to the supplied L5K?

v12 inventories same-rung contacts and comparisons that appear before supported output/action instructions and makes those conditions searchable and traceable.

It is deliberately not a live blocker detector or Boolean ladder simulator.

## Supported action writers

v12 currently models:

- `OTE`
- `OTL`
- supported motion actions already recognized by ServoForge (`MSO`, `MSF`, `MAH`, `MAR`, `MAM`, `MAS`, `MAJ`, `MAG`, `MAPC`, `MCD`, `MCS`)

## Source-visible gate evidence

Before each supported action on a rung, v12 records:

- `XIC` — shown as `true-required` source contact evidence;
- `XIO` — shown as `false-required` source contact evidence;
- `EQU`, `NEQ`, `LES`, `LEQ`, `GRT`, `GEQ`, `LIM` — shown as comparison-required source evidence.

The terminology describes instruction semantics only. It does not mean the contact/comparison is currently true or false.

## Important branch limitation

v12 is not a complete neutral-text Boolean solver.

A gate appearing before an action in source text is preserved as same-rung evidence, but the analyzer does not claim that every listed condition is necessarily in one serial path through all `BST/NXB/BND` branch structures.

Therefore v12 never says:

- “this tag is currently blocking the output”;
- “all these permissives must be true at runtime”;
- “this output should be energized now.”

## Intermediate producer evidence

When a gate symbol has a source-visible writer in the v5 dependency graph, v12 attaches those write relations to the gate as producer evidence.

This supports a static chain such as:

`MotorRun OTE <- XIC(LineReady) <- source-visible writer(s) of LineReady`

without claiming any current tag value.

## Self-hold / seal-in candidates

If an `OTE`/`OTL` action rung includes a preceding `XIC` of the same target, v12 labels it a **self-hold / seal-in candidate**.

This is static inference only because branch position and runtime truth are not proven.

## Multiple permissive paths

If one target has multiple source-visible action writers with different gate signatures, v12 creates a review finding.

Multiple paths can be intentional. The finding is intended to help an SME inspect mode-specific, manual/auto, startup, bypass/inhibit, or alternate sequencing logic without labeling it a defect.

## Trace integration

`traceTarget(project, target)` adds `interlockContexts` containing:

- action instruction;
- program / routine / rung;
- XIC/XIO/comparison gates;
- source-visible producer relations for gate symbols;
- task scheduling / task-root reachability context;
- self-hold candidate state;
- raw rung source.

It also sets:

- `permissiveStateProven: false`
- `booleanBranchSemanticsProven: false`

## Search integration

Searching an output/action target or a gate symbol can return its v12 permissive-path rung directly.

## Safety / evidence boundary

v12 does not prove:

- current contact values;
- current permissive/interlock state;
- branch selection;
- scan order;
- live task execution;
- physical guard/safety-device condition;
- wiring state;
- output module state;
- motion state;
- that an action should be forced or bypassed.

Normal machine diagnostics only. Never use this layer to justify forcing/bypassing interlocks or safety logic.

## Regression scope

v12 tests cover:

1. XIC/XIO/comparison gate extraction;
2. static self-hold candidate detection;
3. multiple-writer/different-gate review findings;
4. intermediate producer relation attachment;
5. trace boundary flags;
6. legacy RSLogix v15 neutral-`N:` support;
7. local/read-only page and worker integration;
8. preservation of all v1-v11 analyzer regressions.
