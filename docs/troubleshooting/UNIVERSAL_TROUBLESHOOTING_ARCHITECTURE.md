# ServoForge Universal Troubleshooting Architecture

## Purpose

ServoForge Troubleshooting is a universal fault-isolation method, not a master list of one site's PLC tags.

The permanent library should describe failure mechanisms, observable symptoms, safe checks, decision paths, and machine-family concepts that can transfer between sites. Site-specific PLC exports can improve local evidence, but their tag names, addresses, alarm numbering, rung names, AFIs, timing values, and controller structure remain local source evidence.

## Three evidence layers

1. **Universal troubleshooting core**
   - symptom and scope isolation
   - power and control-energy checks
   - safety/permissive state
   - communications
   - sensors and feedback
   - timing/synchronization
   - motion/servo behavior
   - mechanical condition
   - process/material condition
   - explicit safety boundaries

2. **Machine-family knowledge**
   - examples: TopModul, Autocol, APL, RPC/Danfoss, zenon
   - family-specific terminology and architecture where source-backed
   - does not assume every site uses identical PLC tags, addresses, alarm numbers, IPs, timers, or revisions

3. **Uploaded-controller site overlay**
   - produced by PLC Analyzer / Import Assistant from an uploaded readable source export
   - session-only browser evidence
   - can expose local targets, writers, resets, timers/counters, I/O/motion references, upstream dependencies, and source locations
   - can assist Troubleshooter search for that uploaded machine
   - never publishes into or mutates the permanent universal library

## Promotion rule

A local PLC tag or implementation detail must not become a universal troubleshooting rule merely because it appears in a CO85, COB25, or other site export.

Permanent-library promotion requires one of the following:

- the information describes a transferable failure mechanism independent of local tag naming; or
- machine-family documentation/source proves the concept is stable for the defined family/revision scope.

Even then, site-specific addresses, IPs, timer values, alarm numbers, or implementation names remain bounded to their verified source scope unless separately proven portable.

## Analyzer carryover

The Import Assistant can create a `servoforge-troubleshooting-plc-overlay-v1` object with authority `session-site-evidence-only`.

The overlay is stored in browser `sessionStorage`. Troubleshooter may use that overlay to locate local PLC evidence, but the overlay sets `universalLibraryModified: false` and disappears when it is cleared or the browser session ends.

The intended workflow is:

`Upload L5K -> Analyze -> Review local source evidence -> Use this controller in Troubleshooter -> Universal diagnosis + local evidence overlay`

## Safety boundary

PLC source visibility is not authorization to modify controls. ServoForge must not turn a discovered tag, timer, rung, AFI, or interlock into an instruction to force, jumper, bypass, or alter safety/control logic. Site LOTO, stored-energy procedures, qualified electrical work requirements, and machine-specific procedures remain authoritative for field work.
