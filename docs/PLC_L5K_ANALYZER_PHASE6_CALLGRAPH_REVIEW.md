# PLC Analyzer Phase 6 — Call-Graph Review

Status: **implementation / staging validation**
Branch: `feature/plc-callgraph-discrepancies-v6`
Baseline: PLC Analyzer Compare v5.2 on staging `main` (`27097006b02cb67463c969deb20c0dee87bdb0fe`)
Production: **out of scope**

## Goal

Use the v5 source dependency model to identify source-review conditions that are difficult to see from individual rungs alone:

- PROGRAM MAIN points to a routine not present in the supplied export
- a JSR target is not present in the same parsed program
- the source-visible JSR graph contains a call cycle
- routines are not source-reachable from the identified PROGRAM MAIN routine
- fault-writer routines are outside the source-visible MAIN → JSR graph
- an AOI invocation's source-visible instance tag is declared with a different data type than the AOI definition

These are **review cues**, not automatic machine-defect conclusions.

## Evidence boundaries

Phase 6 uses only relationships visible in the supplied L5K:

- `PROGRAM ... MAIN := ...`
- parsed `ROUTINE` declarations
- source-visible `JSR(...)` calls
- v5 fault-writer locations
- source-visible AOI definitions, invocations, and tag declarations

The analyzer does not claim that a routine reported as unreachable is dead code. Other execution/invocation mechanisms can exist outside the current model, including unsupported language/task mechanisms, protected logic, export subsets, or revision-specific structures.

## Finding classes

### PROGRAM MAIN target absent

Evidence class: **source-proven**
Review level: **review**

The supplied export declares a MAIN routine name but no matching parsed routine exists in the same program. Report project/export completeness and intended revision as verification steps; do not diagnose the live controller from this alone.

### JSR target absent

Evidence class: **source-proven**
Review level: **review**

A source-visible JSR names a routine that is not present in the same parsed program.

### JSR call cycle

Evidence class: **static-inference**
Review level: **review**

The source-visible call graph contains a cycle. This does not prove executing recursion because calls may be conditional/guarded and the current analyzer does not execute ladder logic.

### Routine not MAIN-reachable

Evidence class: **static-inference**
Review level: **info**

Grouped by program to avoid flooding the review queue. This is an architecture/revision cue, not a defect finding.

### Fault writer not MAIN-reachable

Evidence class: **static-inference**
Review level: **review**

This receives a stronger review level because the routine writes a fault-like target, but the result still does not prove dead fault logic.

### AOI instance type mismatch

Evidence class: **source-proven**
Review level: **review**

Only emitted when all three pieces are source-visible: AOI definition, invocation, and instance-tag declaration. It still requires revision/export verification before being called a controller configuration defect.

## UI

Phase 6 appends its findings to the existing **Discrepancies** tab so the source-evidence review workflow remains unified. Existing v1 findings—multiple writers, missing OTU, Logic_0/Logic_1, timer presets, scan counters, GSV downstream use, aliases—remain intact.

The page banner advances to:

`PLC ANALYZER v6 — CALL-GRAPH REVIEW`

## Regression requirements

1. valid MAIN → JSR graph does not create false MAIN/JSR/cycle/fault-reachability findings
2. missing MAIN target is detected
3. missing JSR target is detected
4. JSR cycles are detected without claiming runtime recursion
5. ordinary unreachable routines are informational and grouped
6. fault writers outside the visible MAIN graph are elevated to review
7. AOI type mismatch requires visible declaration evidence
8. legacy RSLogix v15 `N:` compatibility remains intact
9. v5 dependency model remains intact
10. local/read-only source boundaries remain intact

## Deferred

- full task scheduling semantics
- event task / periodic task reachability model
- SFC/FBD/ST execution and call semantics
- indirect runtime routine resolution
- protected AOI source analysis
- online controller validation
- automatic repair or code modification
