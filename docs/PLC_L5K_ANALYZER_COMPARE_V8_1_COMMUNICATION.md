# PLC L5K Analyzer Compare v8.1 — Communication Topology

## Scope

v8.1 extends the two-file Compare tool with produced/consumed communication-tag differences.

Both L5K files remain browser-local and read-only. The comparison reports source/configuration differences only.

## Compared communication evidence

Consumed tags can be compared for changes to:

- `Producer`
- `RemoteTag`
- `RemoteFile`
- `RPI`
- data type
- source-visible connection-status/timing attributes
- producer-module resolution against source-visible `MODULE` declarations

Produced tags can be compared for changes to:

- `ProduceCount`
- `MinimumRPI`
- `MaximumRPI`
- `DefaultRPI`
- data type
- source-visible mapping, unicast, event-trigger, and connection-status attributes

v8.1 also reports communication-tag additions/removals and produced ↔ consumed role changes.

## Comparison boundary

A communication difference does not prove:

- peer availability
- packet delivery
- connection health
- current connection status
- actual consumer count
- current runtime execution
- that an RPI/timeout value is wrong
- that a source change is defective

Numeric communication values are retained as source evidence only and are not adjustment recommendations.

## Compatibility

v8.1 preserves all earlier Compare layers:

- v2 source/configuration comparison
- v5.2 MAIN/JSR/UDT/AOI dependency comparison
- v7.1 TASK/program schedule comparison

Visible staging release label:

`PLC ANALYZER COMPARE v8.1 — COMMUNICATION DIFF`

Production remains untouched until explicitly promoted.
