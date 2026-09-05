# PLC L5K Analyzer Phase 8 — Produced / Consumed Communication Topology

## Scope

Phase 8 extends the browser-local, read-only L5K analyzer with source-visible produced/consumed tag topology.

The analyzer preserves communication configuration as export evidence. It does not connect to a PLC, test EtherNet/IP traffic, prove that a peer is online, prove packet delivery, prove current connection status, or establish actual consumer count.

## Source-visible attributes

Produced-tag evidence may include:

- `ProduceCount`
- `MinimumRPI`
- `MaximumRPI`
- `DefaultRPI`

Consumed-tag evidence may include:

- `Producer`
- `RemoteTag`
- `RemoteFile`
- `RPI`
- `IncludeConnectionStatus`
- `TimeoutMultiplier`
- other source-visible timing/network-delay attributes when present in the export

Values are retained as source evidence only. The analyzer does not recommend replacement RPI, timeout, or connection values.

## Topology model

Phase 8 builds two static source views:

- inbound: local consumed tag -> declared producer -> declared remote tag/file
- outbound: local produced tag -> declared production attributes

When a consumed tag's `Producer` name matches a source-visible `MODULE` declaration, the analyzer records that module relationship. Failure to resolve a producer name to a module is only a source-review cue; it is not proof of a network fault or missing physical device.

## Trace enrichment

Dependency traces can carry communication context for produced or consumed tags encountered in a static source path. Trace output explicitly records that runtime communication state is not proven.

## Review findings

Phase 8 can report source-review items for conditions such as:

- consumed mappings with incomplete required source attributes
- producer names not resolved against source-visible module declarations
- mixed produced and consumed attribute families on the same tag
- source-visible produced RPI range inconsistencies
- default RPI outside source-visible produced minimum/maximum bounds

These are configuration/source review findings, not machine-fault diagnoses.

## Compatibility

Phase 8 preserves:

- v1 core L5K extraction
- v4 legacy neutral-`N:` ladder compatibility
- v5 dependency/UDT/AOI tracing
- v6 MAIN/JSR discrepancy review
- v7 TASK -> PROGRAM MAIN -> JSR topology
- browser-local/read-only file handling

## Release boundary

Visible staging release label:

`PLC ANALYZER v8 — PRODUCED / CONSUMED TOPOLOGY`

Production remains untouched until explicitly promoted.
