# PLC L5K Analyzer Phase 7 — Task / Program Scheduling Topology

## Scope

Phase 7 extends the offline L5K analyzer from the v6 `PROGRAM MAIN → JSR` graph to a task-aware source topology:

`TASK → scheduled PROGRAM → PROGRAM MAIN → JSR routine path`

The purpose is to distinguish three materially different source states:

1. a program is defined and source-visible under a parsed task;
2. a program is defined but is not listed under a parsed task;
3. a task lists a program that is not present in the supplied export.

This reduces false interpretation of routine reachability without turning static source structure into a runtime claim.

## Source model

Rockwell L5K task syntax declares a `TASK` block and lists scheduled program names inside the block in declared order. Phase 7 records:

- task name;
- source line range;
- task attributes present in the export, including `Type`, `Priority`, `Rate`, `Watchdog`, `InhibitTask`, and `Class` when present;
- each scheduled program name;
- each program's declared position inside the task;
- the program's source-visible `MAIN` routine when available;
- routine reachability through v5/v6 JSR relationships.

Task attributes are preserved as export evidence only. A stored `InhibitTask := No`, `Rate`, `Priority`, or `Watchdog` value does not prove the current live controller state, scan timing, event occurrence, or machine condition.

## New parser layer

File:

`app/plc-analyzer/l5k-analyzer-task-schedule-v7.js`

The layer wraps v6 rather than replacing the earlier parser. The load chain remains:

1. v1 core parsing;
2. v4/v4.1 legacy neutral-`N:` compatibility;
3. v5 UDT/AOI/JSR dependency graph;
4. v6 call-graph discrepancy review;
5. v7 task schedule topology.

The main analyzer worker loads v7 last so the returned project contains all earlier evidence plus `project.dependencies.taskScheduling`.

## Project output

`project.dependencies.taskScheduling` contains:

- `version: "v7"`;
- `evidenceClass: "static-task-scheduling"`;
- `tasks`;
- `scheduledPrograms`;
- `executionRoots`;
- `taskRootReachableRoutines`;
- v7 findings and statistics;
- an explicit static-analysis boundary.

`executionRoots` identify the parsed task, scheduled program, declared schedule position, program `MAIN`, and whether that MAIN routine exists in the supplied export.

`taskRootReachableRoutines` contains only routines reached from programs actually listed under parsed task blocks. This is intentionally narrower than v6's all-program `MAIN → JSR` graph.

## Review rules

Phase 7 appends review findings to the existing **Discrepancies** surface.

### Scheduled program missing from export

If a `TASK` block lists a program name but no matching `PROGRAM` definition is recognized, v7 reports a source-proven review discrepancy.

This can indicate an incomplete export, revision mismatch, or parser limitation; it is not presented as proof of a live controller defect.

### Program listed under multiple tasks

If the same program is listed under more than one parsed task, v7 reports a source-proven review item. Rockwell's task component rules define a program as scheduled under one task.

The analyzer does not recommend modifying task assignments automatically.

### Duplicate program entry within one task

If the same program appears more than once in one parsed task block, v7 reports the exact source duplication for review.

### Defined program not listed under a parsed task

A defined program that is not listed under any parsed task is an informational static-review cue only. An unscheduled program can be intentional, and a partial export can omit task declarations.

### Scheduled program without an identified MAIN routine

If task scheduling is source-visible but the analyzer cannot identify the program's `MAIN`, v7 explicitly separates the two facts:

- task scheduling is proven by the supplied export;
- the routine entry path remains unresolved.

### Fault writers in unscheduled programs

If a fault-like writer is located in a program that is not listed under any parsed task, v7 raises a review cue. It explicitly states that this does not prove dead logic.

### Fault writers not reachable from task roots

For a program that is scheduled, v7 checks the narrower `TASK → PROGRAM MAIN → JSR` graph. Fault writers outside that graph are review items only; unsupported language calls, unresolved MAIN declarations, conditional structure, or export gaps can still explain them.

## Dependency trace enrichment

`traceTarget()` now adds `taskContexts` for writer programs. Each context includes:

- source-visible task schedule entries;
- the program MAIN routine;
- writer routines;
- whether each writer routine is reachable from a parsed task root.

The trace retains `runtimeStateProven: false` and adds `taskScheduleStateProven: false`.

## UI behavior

The staging banner is:

`STAGING / TEST BUILD — PLC ANALYZER v7 — TASK SCHEDULE TOPOLOGY — NOT PRODUCTION`

The existing Discrepancies tab renders v7 findings without creating a second competing review surface.

The browser remains local/read-only. The analyzer does not upload L5K content, connect to a PLC, write tags, force logic, reset faults, edit task configuration, or recommend task timing changes.

## Validation

Dedicated regression:

`tests/plc-l5k-analyzer-task-schedule-v7.test.js`

Coverage includes:

- TASK attribute parsing;
- declared program schedule order;
- task-root routine reachability;
- unscheduled program classification;
- unscheduled fault-writer review;
- trace task context;
- missing scheduled program detection;
- multiple-task program detection;
- scheduled program with unresolved MAIN;
- legacy v15 neutral-`N:` compatibility;
- local/read-only page and worker boundaries.

## Deferred work

Phase 7 does not yet add task schedule differences to the two-file Compare page. A logical follow-up is a v7.1 comparison layer for:

- task added/removed;
- task attribute changes;
- program schedule order changes;
- program moved between tasks;
- scheduled/unscheduled transitions.

Those changes should remain source/configuration differences, not automatic defect diagnoses.
