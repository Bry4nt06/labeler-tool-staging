# PLC Analyzer Phase 5 — Dependency Trace

Status: **implementation / staging validation**
Branch: `feature/plc-l5k-dependency-graph-v5`
Baseline: PLC Analyzer v4.1 on staging `main` (`c3368f29094602d15c3f60e96e6ae943b1d8e759`)
Production: **out of scope**

## Goal

Extend the read-only L5K analyzer from isolated rung/fault evidence into a source dependency model that can answer:

- Which source symbols feed this fault/output/tag?
- Which intermediate tags are written upstream?
- What UDT/DATATYPE does a structured tag/member belong to?
- Which JSR path calls the routine containing the producer?
- Is a referenced structured tag an AOI instance/member when the export contains an AOI definition?
- Where does the offline source trace stop and require runtime/field verification?

Phase 5 remains **static source analysis**. It does not execute ladder, connect to a PLC, infer live tag values, or authorize a field change.

## Implemented model

`l5k-analyzer-dependencies-v5.js` wraps the v4 legacy-compatible parser and adds:

- `dependencies.dataTypes[]`
- `dependencies.scopedTags[]`
- `dependencies.programMainRoutines[]`
- `dependencies.routineCalls[]`
- `dependencies.aoiDefinitions[]`
- `dependencies.aoiCalls[]`
- `dependencies.writeRelations[]`
- `traceTarget(project, target, options)`

The trace walks exact source relationships backward from a selected target using source-visible writers such as OTE/OTL/MOV/COP/CPS/arithmetic/CPT destinations. Recursion is depth/node limited and cycle-safe.

## UDT / DATATYPE rules

- Parse `DATATYPE ... END_DATATYPE` definitions and member declarations.
- Resolve a structured source symbol such as `SomeTag.Member` to the root tag's declared data type when the declaration is visible.
- Report the source member data type when the member is present in the UDT definition.
- Do not infer physical device meaning from a UDT/member name alone.

## Routine-call rules

- Parse `PROGRAM ... MAIN := <routine>` source evidence.
- Parse source-visible `JSR(...)` calls from analyzed rungs.
- Build caller → callee relationships with program/routine/rung/source-line context.
- Trace producer routines back toward the program MAIN routine when a visible JSR path exists.
- If no caller is located, report the path as unresolved rather than assuming the routine is unreachable.

## AOI rules

- Parse `ADD_ON_INSTRUCTION_DEFINITION` blocks when present.
- Capture source-visible parameter/local-tag declarations.
- Identify rung calls whose instruction name exactly matches a parsed AOI definition.
- Associate the first call argument with the AOI instance tag as source evidence.
- Do not claim AOI runtime execution/state from the offline export.

## Trace evidence classes

A Phase 5 trace is labeled **static-inference** because it composes multiple source-proven relationships. Individual rungs/declarations remain source evidence.

The UI must explicitly state that a trace does **not** prove:

- live tag values
- actual scan/runtime sequence beyond source-visible routine relationships
- physical wiring condition
- device health
- actual module/axis state
- that a source/configuration difference is defective

## Real-source validation target

The archived `CO85_LB1_APLCart_1.L5K` used for the current troubleshooting imports contains, in the inspected revision:

- 35 `DATATYPE` definitions
- 83 `JSR(...)` calls
- 53 routines
- 16 programs
- no `ADD_ON_INSTRUCTION_DEFINITION` blocks

This makes it the primary Phase 5 validation file for UDT and routine-call analysis. AOI behavior is validated with synthetic deterministic fixtures because that archived Cart revision contains no AOI definitions.

The real L5K itself is not committed to the repository by this phase.

## UI

The PLC Analyzer injects a new **Dependencies** tab after a file is selected. The tab provides:

- dependency-index statistics
- exact target input
- quick fault-target selection
- backward source trace
- UDT/member typing
- JSR execution paths
- AOI instance context when present
- source rung drill-down
- UDT inventory
- routine-call inventory

The dependency index is built in a Web Worker. The L5K remains local to the browser.

## Regression requirements

Phase 5 must prove:

1. UDT definitions and members are parsed.
2. controller/program-scoped tags retain type context.
3. program MAIN and JSR calls are indexed.
4. AOI definitions/calls are indexed with exact source names.
5. a fault can be traced through at least one intermediate written tag.
6. UDT member type is retained in the trace.
7. AOI member context is retained when source supports it.
8. call paths reach a source-visible MAIN routine when the JSR chain supports it.
9. recursive/cyclic intermediate logic does not recurse indefinitely.
10. v4 legacy `N:` parsing remains intact.
11. no fetch/upload/storage/write PLC capability is introduced.

## Deferred

Not part of Phase 5:

- full Logix execution/simulation
- online PLC connection
- automatic truth-table solving for arbitrary ladder branches
- SFC/FBD/ST semantic execution
- indirect-address value resolution at runtime
- AOI protected-source decryption
- automatic publication of generated Troubleshooting records
- field parameter recommendations
