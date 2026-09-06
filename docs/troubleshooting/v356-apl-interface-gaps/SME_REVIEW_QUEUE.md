# SME review queue

## Required before implementation

1. Controls/electrical SME: confirm the guard switch's separate contactor-control and PLC-monitoring descriptions apply to every APL variant represented by the app.
2. Safety SME: approve wording that distinguishes HMI aggregate-power selection from lockout/tagout and verified isolation.
3. Machine owner: confirm which engineered connector-cover assemblies apply by station, aggregate option, and machine revision.
4. Drawing owner: confirm the controlled 605576 revision and the exact internal sheets corresponding to PDF pages 58–65.
5. Product/content owner: approve `support/reference` presentation and links to `apl-aggregate-connection` and `apl-main-contactor`.

## Source-maintenance review

6. Confirm corrected subjects/topics for `apl-contactor-figure-2` through `apl-contactor-figure-5` without changing IDs or file paths.
7. Check whether source topic strings are used by search, analytics, or tests before editing them.

## Explicitly out of scope

- Publishing connector pin maps or internal jumper arrangements.
- Advising fabrication or substitution of connector covers.
- Defining a universal reset or aggregate-changeover procedure.
- Claiming the 605576 drawing applies without serial/configuration/revision confirmation.

