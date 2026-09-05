# PLC L5K Analyzer Phase 9 — MSG / MESSAGE Topology

## Scope

Phase 9 extends the browser-local, read-only L5K analyzer with explicit Rockwell `MSG` instruction and `MESSAGE` control-tag topology.

The analyzer separates three source-visible layers:

1. `MESSAGE` tag configuration
2. `MSG(MessageControl)` instruction call site
3. source-visible task / PROGRAM MAIN / JSR reachability

None of these layers proves that the instruction executes or that a message transaction succeeds.

## MESSAGE tag source evidence

The L5K import/export format stores message configuration in the `MESSAGE` tag statement. Phase 9 preserves source-visible attributes including:

- `MessageType`
- `RemoteElement`
- `RequestedLength`
- `ConnectedFlag`
- `ConnectionPath`
- `CommTypeCode`
- `ServiceCode`
- `ObjectType`
- `TargetObject`
- `AttributeNumber`
- `Channel`
- `SourceLink`
- `DestinationLink`
- `DestinationNode`
- `Rack`
- `Group`
- `Slot`
- `LocalIndex`
- `RemoteIndex`
- `LocalElement`
- `DestinationTag`
- `CacheConnections`
- `LargePacketUsage`

Attributes not present in the supplied export are left unresolved. They are not synthesized from generic Rockwell defaults.

## Direction classification

When `MessageType` is source-visible:

- a message type containing `Read` is classified as a static inbound-read configuration
- a message type containing `Write` is classified as a static outbound-write configuration
- `CIP Generic` remains a CIP Generic service configuration
- `Module Reconfigure` remains a module-service configuration
- absent or `Unconfigured` message type remains unresolved/unconfigured

Direction classification is source interpretation only. It does not prove a transaction occurred.

## MSG call sites

Phase 9 indexes source-visible `MSG(MessageControl)` calls in parsed ladder rungs and records:

- message control tag
- program
- routine
- rung
- source line
- resolved MESSAGE configuration scope
- message type
- source-visible connection path
- local / remote element evidence
- module names that literally appear in the path
- task scheduling context
- task-root reachability

Program-scoped MESSAGE tags are resolved before same-name controller-scoped tags when the call occurs in that program.

## Trace enrichment

If a static dependency trace includes a MESSAGE control tag or member such as `.ER` or `.DN`, Phase 9 attaches the MESSAGE configuration and its source-visible MSG call sites.

The trace explicitly records that current `EN`, `DN`, `ER`, execution, route health, completion, and payload freshness are not proven by an offline L5K export.

## Review findings

Phase 9 can produce source-review records for:

- every MESSAGE configuration and MSG call as informational source evidence
- MSG call whose MESSAGE control tag cannot be resolved in the supplied export
- MESSAGE tag with absent/unconfigured `MessageType`
- read/write MESSAGE configuration where both local and remote element evidence is not present

These records are not live communication-fault diagnoses. Dynamic message configuration and commissioning states remain possible and require controller/revision verification.

## Safety / interpretation boundary

A configured MESSAGE tag or MSG instruction does not prove:

- rung execution
- peer availability
- route health
- packet delivery
- message completion
- error-free status
- current `EN`, `DN`, or `ER` state
- payload freshness
- that source-visible message values should be changed

## Compatibility

Phase 9 preserves:

- v1 base L5K source extraction
- v4 legacy neutral-`N:` ladder support
- v5 UDT/AOI/JSR dependency analysis
- v6 call-graph review
- v7 task scheduling topology
- v8 produced/consumed communication topology
- browser-local/read-only handling

Visible staging release label:

`PLC ANALYZER v9 — MSG MESSAGE TOPOLOGY`

Production remains untouched until explicitly promoted.
