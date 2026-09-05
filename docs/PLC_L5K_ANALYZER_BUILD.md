# ServoForge PLC / L5K Analyzer — Build Plan

Status: **active feature branch build**
Branch: `feature/plc-l5k-analyzer-v1`
Baseline: staging `main` at Troubleshooting v363 (`5ba786444d85c0d36f7f4f1dce8f15d222526353`)
Production: **out of scope**

## Goal

Add a read-only PLC analysis tool to ServoForge that accepts an Allen-Bradley / Rockwell `.L5K` text export in the browser, builds a static model of the controller project, and helps technicians/SMEs answer:

- What logic produces this fault/output?
- What timers/counters participate in the decision?
- Is a numeric value a native timer preset, a counter/scan count, or just an internal threshold?
- Which tags, I/O aliases, modules, axes, routines, and rungs are involved?
- Are there suspicious inconsistencies or source gaps in the exported project?
- Which findings can be linked to the ServoForge Troubleshooting Library?

The analyzer is a **static source analyzer**, not a PLC emulator and not an online PLC programming tool.

## Safety and source boundaries

1. `.L5K` analysis is read-only.
2. No write-back, download-to-controller, online edits, forcing, bypassing, or reset commands.
3. All file parsing is local in the browser for v1. The uploaded export is not sent to a server.
4. A source value is not automatically a field recommendation. Timer presets, thresholds, addresses, node values, firmware, and machine-specific parameters are presented as evidence from the supplied export.
5. Findings use evidence labels:
   - **Source-proven** — directly visible in the export.
   - **Static inference** — derived from source relationships but not a runtime observation.
   - **Configuration difference** — valid project differences that are not automatically faults.
   - **Runtime verification required** — cannot be proven from an offline export.
   - **Unresolved** — the expected relationship was not found.
6. Do not call a configuration difference a defect without additional evidence.

## V1 user flow

1. Open **Troubleshooting → PLC Analyzer**.
2. Drag/drop or browse for one `.L5K` file.
3. File is read locally with `FileReader`.
4. Parser inventories the project.
5. Analyzer builds findings and dependency records.
6. User can search fault address, tag, timer, counter, module, axis, routine, or rung text.
7. Selecting a record shows its source evidence and logic chain.

## V1 page layout

### Header

- ServoForge / PLC Analyzer
- Labeler Tool
- Troubleshooting
- PLC Analyzer (active)
- Local-only/read-only indicator

### File drop

- Drag/drop `.L5K`
- Browse button
- File name and size
- `Analyze PLC Project`
- `Clear`

### Project overview

- Controller
- Export version (when found)
- Programs
- Routines
- Rungs
- Tags
- Modules
- Axes / motion references
- Native timers
- Native counters
- Fault/output writers
- Findings

### Tabs

Initial v1:

- **Overview**
- **Faults / Outputs**
- **Timers & Counters**
- **I/O & Modules**
- **Motion**
- **Discrepancies**
- **Raw Search**

Future:

- Compare
- Troubleshooting Imports

## V1 parser model

The parser should return a serializable object containing:

```text
project
  controller
  exportVersion
  programs[]
  routines[]
  rungs[]
  tags[]
  modules[]
  axes[]
  timers[]
  counters[]
  ioReferences[]
  faultWriters[]
  resetWriters[]
  moduleStatusReads[]
  findings[]
```

Each source-derived item should retain:

- source line number when practical
- program/routine/rung context
- raw source excerpt
- normalized tag/address

## Parsing scope

### Controller/project metadata

Recognize common L5K constructs such as:

- `CONTROLLER`
- `PROGRAM`
- `ROUTINE`
- `RUNG`
- `MODULE`
- tag declarations

The parser must tolerate formatting differences between RSLogix/Studio 5000 generations. V1 uses tolerant lexical/regex parsing rather than pretending to implement the complete Rockwell grammar.

### Ladder instructions

Detect at minimum:

- `XIC`
- `XIO`
- `OTE`
- `OTL`
- `OTU`
- `TON`
- `TOF`
- `RTO`
- `RES`
- `CTU`
- `CTD`
- `MOV`
- `COP`
- `CPS`
- `GSV`
- `SSV`
- `EQU`
- `NEQ`
- `LES`
- `LEQ`
- `GRT`
- `GEQ`
- `ADD`
- `SUB`
- `MUL`
- `DIV`
- `CPT`

Unknown instructions remain visible in raw rung text.

## Fault/output writer analysis

Identify write instructions to likely fault/output addresses, including:

- `Faults[...]`
- `Faults_LB1[...]`
- names containing `Fault`, `Alarm`, `Trip`, or `Malfunction`

For each target capture:

- producer instruction (`OTE` / `OTL`)
- reset/unlatch (`OTU` / `RES` where relevant)
- routine/rung
- upstream symbols referenced on the same rung
- raw rung text
- number of independent writers

## Timer/counter analysis

### Native timers

Recognize `TON`, `TOF`, and `RTO` instances and report:

- timer tag
- routine/rung uses
- `.PRE`, `.ACC`, `.DN`, `.TT`, `.EN` references
- constant preset evidence when source proves it
- assignments to `.PRE`

Do **not** convert a preset into engineering time if the controller time base is not known from the applicable platform/source.

### Native counters

Recognize `CTU` / `CTD` and report:

- counter tag
- preset/accumulator references
- reset path
- producer rungs

### Scan-counter / pseudo-timer candidates

Flag integer tags that are incremented/decremented each PLC execution and then compared to a numeric threshold, especially names containing `Time`, `Timer`, `Delay`, `Count`, or `Timeout`.

Label these as:

**Potential PLC-cycle counter — do not interpret as milliseconds without scan-time/runtime evidence.**

## I/O and module analysis

Extract:

- `Local:<slot>:I...`
- `Local:<slot>:O...`
- remote module-style I/O references
- alias relationships when visible
- `GSV(MODULE,...)` status/fault reads
- module declarations and slot/parent/address information when textually available

Do not infer electrical pin/wire mappings from an L5K alone.

## Motion analysis

Identify:

- axis-tag references
- common motion/status members such as `FeedbackFault`, `ModuleFault`, `ModuleHardwareFault`, `ModuleSyncFault`, `CommutationFault`, `Drive*Fault`, `Motor*Fault`, `OverSpeedFault`, `PositionErrorFault`, `PowerPhaseLossFault`, `SERCOSRingFault`, `TimerEventFault`
- motion instructions where textually detectable (`MSO`, `MSF`, `MAH`, `MAR`, etc.)

Report exact member names from the export. Do not translate a status member into a failed physical component unless another source proves that route.

## V1 discrepancy rules

### High confidence / source-proven

- Same fault/output has multiple independent `OTE`/`OTL` writers.
- `OTL` target has no located `OTU` reset path.
- Timer/counter instruction exists but no located reset where one is normally source-visible; report as review item, not defect.
- Fault/output position is driven directly by a constant/disabled logic tag such as `Logic_0` / `Logic_1`.
- GSV module fault destination is never referenced elsewhere.
- Alias target is referenced but alias declaration cannot be resolved.

### Static inference / review

- similarly named timer instances use different source-proven presets
- repeated station/routine patterns have different thresholds
- numeric scan-counter candidate is presented near timer-like logic
- one station has a different I/O reference from peer stations
- fault-like target has writer but no reset/unlatch found

### Runtime verification required

- actual input state/polarity
- actual controller scan time
- intermittent wiring/feedback condition
- drive/device health
- actual timer accumulator behavior
- online module state

## Search behavior

Search should accept:

- exact address: `Faults[1].13`
- exact tag: `WebBreakTime`
- timer: `TON_SensorVerification`
- I/O: `Local:5:I.Data.9`
- motion member: `BaseMachineEncoderAxis.FeedbackFault`
- free text: `encoder feedback`

Exact tag/address matches rank above fuzzy/context matches.

## V1 report detail

For a selected fault/output:

1. **Target**
2. **Writer type**
3. **Program / routine / rung**
4. **Source logic**
5. **Referenced symbols**
6. **Related timers/counters**
7. **Reset/unlatch paths**
8. **I/O / module references**
9. **Motion status references**
10. **Findings / cautions**

## Privacy / file handling

V1 must state clearly:

> This L5K is parsed locally in your browser. ServoForge does not upload the file for analysis.

No file contents are written to `localStorage` or IndexedDB by default. Only optional user-approved analysis summaries may be persisted in a later phase.

## Performance requirements

- Parsing should not permanently block the Troubleshooting page.
- The analyzer is a separate page so a very large L5K cannot freeze the core troubleshooting startup path.
- V1 should support files at least in the tens-of-megabytes range.
- If parsing becomes expensive, move analysis to a Web Worker before expanding feature scope.
- Render tables incrementally or cap initial visible rows for large projects.

## Testing requirements

Add deterministic Node tests for the parser/analyzer using synthetic L5K fixtures covering:

- controller/program/routine/rung inventory
- `OTE` producer
- `OTL` + `OTU` reset pair
- missing `OTU`
- `TON` preset/reference extraction
- `CTU`/`RES`
- pseudo-timer scan-counter detection
- `GSV(MODULE...)`
- I/O aliases/references
- `Logic_0` inactive fault position
- multiple writers
- exact search precedence
- parser remains read-only and has no browser storage/network dependency

## Phase plan

### Phase 1 — Local static analyzer

Build now:

- page shell
- local drop/browse
- parser/core model
- project inventory
- fault/output writers
- timers/counters
- I/O/module/motion extraction
- discrepancy rules
- search/drill-down
- tests

### Phase 2 — Two-file comparison

- known-good vs problem/current revision
- timer/preset differences
- I/O alias differences
- module/slot differences
- axis/status differences
- routines/rungs added/removed/changed
- station-pattern differences
- classify as configuration difference vs likely discrepancy

### Phase 3 — Troubleshooting Library import assistant

- compare parsed faults against existing ServoForge records
- list source-proven faults with no troubleshooting entry
- generate **draft** candidate records only
- include source locator, producer, routine/rung, timers/counters, reset path, related I/O, confidence
- require SME review before library publication

### Phase 4 — Broader Rockwell support

- `.L5X` XML parser
- AOI definition/call tracing
- UDT member relationship expansion
- richer motion instruction analysis
- optional worker-based large-project analysis

## Definition of done for v1

V1 is ready for staging review when:

1. `.L5K` drag/drop works entirely in the browser.
2. Controller/routine/rung/tag/module inventory is shown.
3. Fault writers and reset paths are searchable.
4. Native timers and counters are distinguished from scan-count/pseudo-timer candidates.
5. I/O, module GSV, and motion references are indexed.
6. Discrepancy findings are evidence-classified and do not overclaim runtime faults.
7. Exact tag/address search wins over fuzzy results.
8. No L5K content is uploaded or persisted automatically.
9. Automated tests cover the core parser/analyzer.
10. Troubleshooting startup architecture remains unchanged; analyzer runs on its own page.
