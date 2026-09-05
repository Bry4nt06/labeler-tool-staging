# PLC Compare v7.1 — Task Schedule Differences

## Scope

v7.1 extends the existing two-file PLC Compare engine with source-visible task/program scheduling differences. Both L5K files are parsed through the full v7 analyzer before comparison.

Comparison stack:

1. v2 source/configuration comparison;
2. v5.2 MAIN / JSR / UDT / AOI dependency differences;
3. v7.1 TASK / scheduled-program differences.

The task layer does not replace the earlier comparison categories.

## New category

The Compare page exposes:

`Tasks / scheduling`

Differences in this category use `category: "tasks"` and a `taskKind` describing the exact schedule difference.

## Task additions and removals

A TASK present in only one export is reported as added or removed.

The task snapshot preserves source-visible:

- Type;
- Priority;
- Rate;
- Watchdog;
- InhibitTask;
- Class.

A task addition/removal is configuration evidence only and does not prove current task execution.

## Task attribute changes

For a TASK present in both exports, v7.1 compares the source-visible task attributes above.

Numeric or enum values are displayed as export evidence. ServoForge does not recommend changing a priority, rate, watchdog, inhibit state, or class value based on the comparison alone.

## Program schedule order changes

When the same programs remain assigned to the same task but their declared order changes, v7.1 emits a dedicated `program-order` difference.

This reports the exact baseline and current declared order without claiming actual runtime timing, execution duration, or a machine defect.

## Program moved between tasks

If a program is scheduled in both exports but its task assignment changes, v7.1 emits a `program-task` difference.

This is kept separate from task add/remove evidence so a reviewer can immediately see which program changed scheduling ownership.

## Scheduled / unscheduled transitions

A defined program that changes from no parsed TASK assignment to a parsed TASK assignment is reported as `became scheduled`.

A program that changes from scheduled to no parsed TASK assignment is reported as `became unscheduled` and receives review-level attention.

An unscheduled state can still be intentional or reflect an incomplete export, so the comparison does not label it dead logic or a defect.

## Statistics

v7.1 adds:

`comparison.statistics.taskScheduleDifferences`

The existing dependency difference count remains unchanged and separate.

The Compare summary shows both dependency and task-schedule counts.

## UI / worker

The Compare worker now loads:

- v5 dependency parser;
- v6 discrepancy parser;
- v7 task-schedule parser;
- v2 comparison;
- v5.2 dependency comparison;
- v7.1 task-schedule comparison.

The Compare page uses a cache-busted worker URL for v7.1 and adds a dedicated task scheduling filter and detail boundary.

Visible staging banner:

`STAGING / TEST BUILD — PLC ANALYZER COMPARE v7.1 — TASK SCHEDULE DIFF — NOT PRODUCTION`

## Safety and interpretation boundary

Task schedule differences are static source/configuration evidence only.

They do not prove:

- current task execution;
- current inhibit state;
- actual task period or scan duration;
- event occurrence;
- controller mode;
- wiring or device health;
- that a source difference is defective.

The Compare feature remains browser-local and read-only. It does not connect to, write to, force, reset, edit, download to, or otherwise modify either PLC project.

## Regression coverage

Dedicated test:

`tests/plc-l5k-analyzer-compare-task-schedule-v7-1.test.js`

Coverage includes:

- identical task schedules;
- task addition/removal;
- task attribute changes;
- program order changes;
- program moved between tasks;
- scheduled to unscheduled transition;
- unscheduled to scheduled transition;
- existing category filter compatibility;
- page/worker load order;
- local/read-only boundaries.
