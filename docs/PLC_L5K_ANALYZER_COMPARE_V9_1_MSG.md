# ServoForge PLC Analyzer — Compare v9.1 MSG / MESSAGE Diff

## Purpose

Compare source-visible Rockwell `MESSAGE` tag configuration and `MSG(...)` invocation evidence between two L5K exports.

This layer extends Compare v8.1. It does not replace or reinterpret the existing rung, dependency, task-schedule, or produced/consumed comparisons.

## Source model

v9.1 compares two distinct evidence classes:

1. `MESSAGE` tag configuration
2. `MSG` instruction call sites

The analyzer preserves source-visible configuration such as:

- `MessageType`
- `ConnectionPath`
- `LocalElement`
- `RemoteElement`
- `RequestedLength`
- `DestinationTag`
- `ConnectedFlag`
- `CommTypeCode`
- `ServiceCode`
- `ObjectType`
- `TargetObject`
- `AttributeNumber`
- legacy route fields such as channel/link/node/rack/group/slot/index values
- cache / large-packet configuration
- source-visible path-to-module name matches

For each source-visible `MSG` call site, v9.1 also compares:

- MESSAGE control tag
- whether configuration resolved in the supplied export
- resolved message type and direction
- connection path
- local/remote/destination elements
- source-visible task-root reachability context

## Difference categories

v9.1 adds the Compare category:

`messages`

with two detail kinds:

- `message-config`
- `msg-call-site`

Configuration additions/removals are reported separately from changes to an existing same-name MESSAGE tag.

MSG call sites are keyed by Program / Routine / rung. A change to the MESSAGE control tag at the same source site is therefore shown as a changed call site rather than being hidden inside a generic rung diff.

## Safety / interpretation boundary

All v9.1 results are offline source/configuration evidence.

They do **not** prove:

- that the MSG rung executes
- peer availability
- route health
- packet delivery
- message completion
- current `.EN`, `.DN`, or `.ER` state
- payload freshness
- controller runtime state
- that a path, requested length, service code, object, or attribute value should be changed
- that a detected difference is defective

The tool remains read-only and browser-local. It does not connect to or write to a PLC.

## Regression requirements

The v9.1 regression suite proves:

- identical L5Ks produce zero MSG/MESSAGE differences
- path/local/remote/requested-length changes are detected
- CIP Generic service/object changes are detected
- MESSAGE tag additions/removals are detected
- a changed MSG control tag at the same call site is detected
- task-root reachability context changes are carried into call-site comparison
- the `messages` category works with the existing Compare filter API
- v9 parser and v9.1 compare scripts load locally in both normal and worker execution paths
- no network/storage write APIs are introduced by the comparison engine
