# PLC Analyzer Compare v10.1 — Consistency-State Differences

## Purpose

v10.1 extends two-file Compare with the v10 intra-project consistency model.

Instead of only reporting raw rung changes, Compare can now answer whether a source-visible program-scoped peer family changed consistency state between the baseline and current export.

Examples:

- uniform timer PRE evidence → divergent timer PRE evidence;
- divergent timer PRE evidence → uniform timer PRE evidence;
- the outlier moved from one program to another;
- peer membership changed;
- counter PRE consistency changed;
- timer/counter instruction-family consistency changed;
- numeric decision-threshold consistency changed.

## Comparison dimensions

The following v10 peer dimensions are compared:

- timer PRE;
- timer instruction family (`TON`, `TOF`, `RTO`);
- counter PRE;
- counter instruction family (`CTU`, `CTD`);
- numeric decision threshold signature (`EQU`, `NEQ`, `LES`, `LEQ`, `GRT`, `GEQ`, `LIM`).

## Consistency states

For a source-visible peer family:

- `uniform` means two or more program-scoped peers expose the same source signature;
- `divergent` means two or more peers expose different source signatures;
- `single-peer` means only one peer remains in the comparison model.

The state is static source evidence only.

## Change classification

v10.1 adds Compare category:

`consistency`

and kinds:

- `timer-preset`
- `timer-instruction`
- `counter-preset`
- `counter-instruction`
- `threshold`

A change can be:

- added peer family;
- removed peer family;
- changed peer state/evidence.

Uniform → divergent is surfaced as a review item.

Divergent → uniform is informational because it does not prove that the resulting common value is correct.

Other changes such as peer membership, per-program signature changes, or an outlier moving between programs remain review evidence.

## Majority / outlier evidence

When the v10 source model exposes a repeated signature among peers, v10.1 carries the majority signature/count into the baseline/current snapshot.

A majority is never interpreted as an approved or correct value.

## PLC-cycle protection

If a threshold family contains source-visible self-increment-by-one evidence such as:

`ADD(CycleCount,1,CycleCount)`

v10.1 carries the explicit boundary that threshold values must not be converted to milliseconds without runtime scan-time evidence.

## Source boundary

Same-name program-scoped tags are inferred peers only. The comparison does not prove:

- that peers serve identical machine functions;
- that uniform values are correct;
- that divergent values are defective;
- that a majority value should replace an outlier;
- engineering units for arbitrary numeric thresholds;
- live runtime state or scan time.

Timer/counter PRE values and numeric thresholds remain source evidence only and are not adjustment recommendations.

## Architecture

Analyzer chain:

`l5k-analyzer-message-v9.js`
→ `l5k-analyzer-consistency-v10.js`

Compare chain:

`l5k-analyzer-compare-message-v9-1.js`
→ `l5k-analyzer-compare-consistency-v10-1.js`

The Compare worker parses both L5K files through the complete v10 analyzer before running the v10.1 comparison wrapper.

## Production boundary

This phase is staging-only until explicitly promoted. Both files remain browser-local and read-only. ServoForge does not connect to, write to, force, reset, or modify a PLC.
