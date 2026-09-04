# ServoForge Troubleshooting — Remaining Import Work After v356

## Verified baseline

- Repository: `Bry4nt06/labeler-tool-staging`
- Baseline commit: `dc08d4a49b5e0e9650e040e0b1930cbbf9a16435`
- Baseline commit title: `Troubleshooting v356: prevent startup freeze on large saved workspaces`
- Existing v356 branch: `codex/troubleshooting-startup-responsiveness-v356`
- Research handoff branch: `codex/v356-remaining-import-research`
- Staging is the source of truth. Production is not part of this work.

## Important correction after repository audit

Do not re-import the entire `lbl backup.zip` archive. v356 already contains the archive index and most high-value troubleshooting content.

The base library at `app/troubleshooting/diagnostic-library.js` already defines:

- 36 archived sources
- 27 base diagnostic entries
- 7 base guided flows
- Source, entry, flow, search, context-ranking, and validation APIs

Later source-backed extensions add extensive TopModul circuit, PLC, fault-stack, encoder, main-drive, machine-start, servo-table, and APL Cart logic. Any new work must extend the authoritative library without duplicating existing records or creating a second troubleshooting owner.

## Exact v356 data format

### Source

```js
{
  id: "stable-source-id",
  title: "Display title",
  file: "Exact archive filename",
  kind: SOURCE_KIND.OEM_TRAINING,
  status: "indexed",
  topics: ["search", "terms"],
  notes: "Optional evidence limitation or scope note"
}
```

Existing source kinds: `OEM_TRAINING`, `PROCEDURE`, `SCHEMATIC`, `CONTROL_PROJECT`, `FIELD_REFERENCE`, `LINK`, and `TEMPORARY`.

### Diagnostic entry

```js
{
  id: "stable-entry-id",
  code: "EXACT DISPLAYED CODE OR SYMPTOM LABEL",
  number: 1, // optional
  category: "Existing category",
  aliases: ["search aliases"],
  contextHints: ["optional machine/context terms"],
  title: "Operator-facing title",
  summary: "Short source-disciplined explanation",
  probableCauses: ["Cause"],
  checks: ["Ordered evidence-gathering check"],
  actions: ["Action after the cause is proven"],
  safety: [safety.observe, safety.loto, safety.electrical, safety.servo],
  sourceRefs: [
    { sourceId: "existing-source-id", locator: "Exact section/page/fault locator" }
  ]
}
```

### Guided flow

```js
{
  id: "stable-flow-id",
  title: "Card title",
  category: "Existing category",
  description: "What the path isolates",
  contextHints: ["optional hints"],
  start: "first-node-id",
  nodes: Object.freeze({
    "first-node-id": {
      question: "Observable question?",
      choices: [
        { label: "Observed condition", next: "another-node" },
        { label: "Known result", result: "existing-entry-id", hint: "Optional hint" }
      ]
    }
  })
}
```

Choices may use `next`, `result`, or the existing `action: "search"` behavior. Every `next` and `result` must resolve during `validate()`.

Specialized modules append frozen `sources`, `entries`, and `flows`, then preserve or override `getEntry`, `getFlow`, `getSource`, `searchEntries`, `searchSources`, `recommendFlows`, and `validate`. Do not create a parallel global library, renderer, search loop, or competing state field.

## Content already present in v356 — do not duplicate

### Danfoss/RPC servo system

The base library already includes all named field faults from `SERVOPOWER_TIMEOUT` through `IOBOXCOMM`, including encoder, ID/enumeration, configuration, firmware, power, CAN, single-drive, group-drive, and all-drive isolation. It also includes a Servo-system baseline.

### Bottle orientation

Already present:

- Inaccurate/inconsistent orientation
- Bottle/plate slipping, centering, dirty optics, and the 80 mm camera reference
- Container not stopped before labeling
- Wrong RPC motor assignment/COM-device relationship
- Faulty image sequence and framegrabber readiness
- Trigger-device wiring, CAN/address, Ready LED, and Fault LED paths
- RPC/table-cam synchronization after encoder work
- Autocol orientation baseline and guided flow

### APL and TopModul

Already present:

- APL main-contactor workflow
- Harting, docking, guard, servo-connection, rewind-binding, and safety-reset routing
- LB1 APL Cart 1 readable L5K fault coverage for `00005` through `00019`
- TopModul machine-start, main-drive, electrical protection, communications, encoder, alarm-stack, process, station, servo-table, and circuit-trace extensions through v355
- Main-drive contactor, motor-starter overload, Ethernet/I/O communication, Cisco/Level-3, and related circuit evidence in specialized TopModul modules

### B&R and schematics

Already present:

- B&R Automation Studio diagnostic overview
- Logger, Watch/I/O Monitor, Trace, Profiler, and Debugger selection guidance
- Krones schematic navigation
- 605576 and 747-993 source references

## Remaining import candidates

These are the genuine remaining candidates found after comparing the archive with v356. Each still requires duplicate review, exact source extraction, and SME review.

### Priority 1 — distinct missing diagnostic records

#### 1. Danfoss terminal code 600 / no PC communication

- Proposed ID: `servo-terminal-code-600`
- Proposed code: `600 — NO PC COMMUNICATION`
- Category: `Servo / Bottle Plate`
- Source: `Labeler Danfoss servo bottle plate system.doc`
- Locator: `Checking the System for Proper Operation / Commissioning Procedure`
- Cover Power PC/master readiness, physical Ethernet link indication, the documented connection delay, and machine-specific CompactFlash/master network configuration. Do not publish internal IP values as universal settings.

#### 2. Orientation correct at low speed but sent to the wrong plate at high speed

- Proposed ID: `orientation-high-speed-wrong-plate`
- Proposed code: `ORIENTATION RESULT — WRONG PLATE AT SPEED`
- Category: `Bottle Orientation`
- Source: `11-EN-000-965.pdf`, page 52, section 18.2
- Separate speed-dependent plate assignment from ordinary optical offset. Preserve the OEM COM-device/framegrabber revision conditions as machine-specific evidence, not a universal update instruction.

#### 3. Orientation parameter baseline: rotary-plate distance and table diameter

- Proposed ID: `orientation-trigger-geometry-baseline`
- Category: `Bottle Orientation`
- Source: `11-EN-000-965.pdf`, page 52, section 18.2
- Verify rotary-plate distance in DART triggering and table diameter in RPC machine parameters only after slip, optics, synchronization, and motor assignment checks.

#### 4. Orientation failure after camera CPU replacement

- Proposed ID: `orientation-camera-cpu-replacement`
- Category: `Bottle Orientation`
- Source: `0004_Hardware_Ausrichtung_EN[1]_ppt.pdf`, page 20
- Check whether the replacement camera CPU MAC address was updated in DRP settings. Keep this conditional on CPU replacement and do not include invented addresses.

### Priority 2 — support procedures, not fault codes

#### 5. RPC servomotor replacement and return-to-service guide

- Proposed support ID: `rpc-servomotor-replacement-guide`
- Source: `0001_RPC-DTS5_622_2011_EN_ppt.pdf`, pages 21–29 and diagnostics pages 30–38
- Preserve main-switch isolation, the ten-minute stored-energy wait, mechanical replacement, reconnection, ID assignment, firmware consistency, and functional verification. Gate the procedure for qualified maintenance under LOTO.

#### 6. RPC AC/DC converter and monitoring-board diagnostic guide

- Proposed support ID: `rpc-power-monitoring-diagnostics`
- Source: `0001_RPC-DTS5_622_2011_EN_ppt.pdf`, hardware pages 12–14 and diagnostic screens pages 33–34
- Use the existing diagnostic screens to separate converter, fuse/status, monitoring-board, and servo-line evidence. Extract exact visible labels before writing detailed steps; do not invent LED meanings or fuse assignments.

#### 7. New embossed-bottle commissioning guide

- Proposed support ID: `dart-embossed-bottle-commissioning`
- Sources: `0003_GOP_Ausrichtung_Embossing_v5.1_EN[1].pdf` and `11-EN-000-965.pdf`
- Treat as setup/commissioning, not a fault. Cover type creation, similar-source selection, bottle/camera positioning, characteristic selection, calibration, RPC transfer verification, and backup. Keep recipe values machine/type-specific.

#### 8. APL aggregate connector and safety-interface reference

- Proposed support ID: `apl-aggregate-connector-reference`
- Sources: `APL Main Contactor Faults/20090610014742309_0002.pdf` through `_0005.pdf`
- Explain the functional grouping of aggregate Harting interfaces and why unused connectors need the proper cover/jumper arrangement. Distinguish safety contacts, signal directions, and aggregate power. Do not publish pin-level instructions or safety-bypass/jumper instructions without the exact drawing revision.

### Priority 3 — deepen existing broad references only if needed

#### 9. Advanced B&R diagnostic guides

Current v356 has one broad `automation-studio-diagnostics` entry. Optional guides could cover Logger evidence capture, Watch/archive, Trace, NcDiagnose/NcWatch/NcTrace, network-command/DPR trace, Profiler, and PVI Transfer. Force, NcTest motion, debugger changes, task stopping/deletion, downloads, and controller modifications must not be routine operator steps.

## Blocked source work

### Remaining Studio 5000 projects

v355 has a readable source-backed import for `CO85_LB1_APLCart_1.L5K`. The archive contains 13 `.ACD` projects without equivalent readable exports:

- LB1 APL Cart 2–6: 5
- LB2 APL Cart 1–6: 6
- LB1 Labeler 1: 1
- LB2 Labeler 2: 1

Export each from the correct Studio 5000/RSLogix environment as `.L5K`, `.L5X`, or a searchable report. Preserve project/controller identity, software revision, filename, export date, line/cart scope, alarm messages, producer rungs, interlocks, timers, raw I/O aliases, and HMI mappings. Do not assume LB1 Cart 1 logic is identical elsewhere and do not create entries from binary filenames alone.

### APL schematic 605576

The 71-page schematic is a visual reference. Targeted tracing is still needed for exact main-contactor, guard/servo-cover, docking, Harting, rewind/table-servo, and aggregate-power chains. Do not mass-convert the drawing.

### Electrical schematic 747-993

v356 already uses this extensively through TopModul circuit extensions. Any additional work must begin with a gap audit. Do not create a second wholesale schematic import.

## Recommended work split

- Chat A — Code 600, servomotor replacement, and RPC power/monitoring diagnostics.
- Chat B — high-speed wrong-plate assignment, geometry baseline, camera CPU replacement, and embossed-bottle commissioning.
- Chat C — APL connector/safety-interface reference and targeted 605576 tracing, with duplicate audit against existing APL entries and `apl-cart-foundation.js`.
- Chat D — inventory/export instructions for the 13 remaining `.ACD` files; no fault logic until readable exports exist.
- Chat E — optional advanced B&R guides only after proving they add value beyond the existing broad entry.

## Copy-ready prompt for another chat

```text
Work as a parallel research/preparation chat for the ServoForge Troubleshooting app.

Repository and baseline:
- Repository: Bry4nt06/labeler-tool-staging
- Branch from exact v356 commit dc08d4a49b5e0e9650e040e0b1930cbbf9a16435.
- Create a codex/<short-task> branch from that exact SHA.
- Staging is the source of truth. Do not touch production.
- Do not merge or deploy. Leave the result ready for the master implementation chat.

First inspect:
- AGENTS.md
- docs/ENGINEERING_WORKFLOW.md
- app/troubleshooting/diagnostic-library.js
- app/troubleshooting/index.html
- Any existing specialized extension related to your assigned content
- docs/troubleshooting/v356-remaining-import-handoff.md

Assigned track:
[PASTE ONE CHAT ASSIGNMENT FROM THE HANDOFF HERE]

Rules:
1. Audit v356 for duplicates before drafting. The main Servo/RPC faults, general orientation paths, APL contactor workflow, B&R overview, schematic navigation, TopModul circuits, and LB1 APL Cart 1 faults 00005-00019 are already present.
2. Use the exact v356 Source, Diagnostic Entry, and Guided Flow formats from diagnostic-library.js.
3. Preserve exact displayed codes, source filenames, and page/section locators.
4. Keep probable causes, checks, actions, safety, and sourceRefs distinct.
5. Do not invent settings, IP addresses, connector pins, part numbers, PLC producers, or generic logic from a machine-specific source.
6. Gate LOTO, stored energy, energized electrical work, servo motion, controller changes, and safety-interface work appropriately.
7. Do not create a second library, renderer, search function, state owner, or duplicate entry.
8. Prepare research and app-shaped records only. Do not wire them into index.html or change the live app.

Return:
- Existing-content duplicate audit
- Exact source inventory and locators
- Proposed source/entry/flow objects in v356 format
- Relationship links to existing entry IDs
- SME review questions
- Safety review
- Validation plan
- Complete list of files created or changed
- Master-chat handoff summary
```

## Master implementation acceptance checklist

- Re-audit proposed IDs against base and specialized modules.
- Add content to one authoritative owner and preserve `Object.freeze` conventions.
- Add source references only when file and locator are verified.
- Add or update validation and search/flow tests.
- Run `node --check`, focused troubleshooting tests, full library validation, and startup/prestart tests.
- Test search by exact code, alias, symptom, category, and ServoForge context.
- Test every flow choice for valid `next`/`result` targets.
- Test desktop and mobile UI.
- Merge to staging only after master review and user acceptance. Production remains untouched until staging is tested and confirmed.
