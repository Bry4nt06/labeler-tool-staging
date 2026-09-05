"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-task-schedule-v7.js"));

const fixture = `RSLogix 5000 Export Version 20.01
CONTROLLER Task_Topology_Test
  TAG
    InputA : BOOL;
    Faults : DINT[2];
  END_TAG

  PROGRAM ScheduledProgram (MAIN := MainRoutine,
                            MODE := 0)
    ROUTINE MainRoutine
      RUNG 0
        N: JSR(FaultRoutine);
      END_RUNG
    END_ROUTINE
    ROUTINE FaultRoutine
      RUNG 0
        N: XIC(InputA)OTL(Faults[0].1);
      END_RUNG
    END_ROUTINE
  END_PROGRAM

  PROGRAM UnscheduledProgram (MAIN := MainRoutine,
                              MODE := 0)
    ROUTINE MainRoutine
      RUNG 0
        N: XIC(InputA)OTL(Faults[0].2);
      END_RUNG
    END_ROUTINE
  END_PROGRAM

  TASK MainTask (Type := CONTINUOUS,
                 Priority := 10,
                 Watchdog := 500,
                 InhibitTask := No)
    ScheduledProgram;
  END_TASK
END_CONTROLLER
`;

test("v7 parses TASK attributes and declared program schedule order", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "task-topology.L5K", byteLength: fixture.length });
  const scheduling = project.dependencies.taskScheduling;
  assert.equal(scheduling.version, "v7");
  assert.equal(scheduling.tasks.length, 1);
  assert.equal(scheduling.tasks[0].name, "MainTask");
  assert.equal(scheduling.tasks[0].type, "CONTINUOUS");
  assert.equal(scheduling.tasks[0].priority, "10");
  assert.equal(scheduling.tasks[0].watchdog, "500");
  assert.equal(scheduling.tasks[0].inhibitTask, "No");
  assert.deepEqual(scheduling.tasks[0].scheduledPrograms.map((item) => [item.program, item.order]), [["ScheduledProgram", 1]]);
});

test("v7 builds TASK to PROGRAM MAIN to JSR source reachability", () => {
  const project = analyzer.parseL5K(fixture);
  const scheduling = project.dependencies.taskScheduling;
  assert.ok(scheduling.taskRootReachableRoutines.includes("ScheduledProgram/MainRoutine"));
  assert.ok(scheduling.taskRootReachableRoutines.includes("ScheduledProgram/FaultRoutine"));
  assert.ok(!scheduling.taskRootReachableRoutines.includes("UnscheduledProgram/MainRoutine"));
  const rootEntry = scheduling.executionRoots.find((item) => item.program === "ScheduledProgram");
  assert.ok(rootEntry);
  assert.equal(rootEntry.task, "MainTask");
  assert.equal(rootEntry.mainRoutine, "MainRoutine");
  assert.equal(rootEntry.mainPresent, true);
});

test("v7 reports unscheduled programs as review cues and distinguishes their fault writers", () => {
  const project = analyzer.parseL5K(fixture);
  const unscheduled = project.findings.find((item) => item.id === "v7:program-not-task-scheduled:UnscheduledProgram");
  assert.ok(unscheduled);
  assert.equal(unscheduled.classification, "static-inference");
  assert.equal(unscheduled.severity, "info");
  assert.match(unscheduled.summary, /can be intentional/i);

  const faultFinding = project.findings.find((item) => item.id === "v7:fault-writers-in-unscheduled-programs");
  assert.ok(faultFinding);
  assert.equal(faultFinding.severity, "review");
  assert.match(faultFinding.summary, /does not prove dead logic/i);
  assert.ok(faultFinding.evidence.writers.some((item) => item.target === "Faults[0].2"));
});

test("v7 dependency trace carries task scheduling context without proving live execution", () => {
  const project = analyzer.parseL5K(fixture);
  const trace = analyzer.traceTarget(project, "Faults[0].1", { maxDepth: 5 });
  assert.equal(trace.runtimeStateProven, false);
  assert.equal(trace.taskScheduleStateProven, false);
  assert.match(trace.note, /does not prove the task is currently executing or uninhibited/i);
  const context = trace.taskContexts.find((item) => item.program === "ScheduledProgram");
  assert.ok(context);
  assert.equal(context.schedules.length, 1);
  assert.equal(context.schedules[0].task, "MainTask");
  assert.equal(context.mainRoutine, "MainRoutine");
  assert.ok(context.writerRoutines.some((item) => item.routine === "FaultRoutine" && item.taskRootReachable));
});

test("v7 reports a TASK scheduled program that is absent from the supplied export", () => {
  const text = fixture.replace("    ScheduledProgram;", "    ScheduledProgram;\n    MissingProgram;");
  const project = analyzer.parseL5K(text);
  const finding = project.findings.find((item) => item.id === "v7:task-program-missing:MainTask:MissingProgram:2");
  assert.ok(finding);
  assert.equal(finding.classification, "source-proven");
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /verify export completeness and revision/i);
});

test("v7 reports a program listed under multiple TASK declarations", () => {
  const text = fixture.replace("END_CONTROLLER", `  TASK SecondaryTask (Type := PERIODIC, Priority := 8, Rate := 10000)\n    ScheduledProgram;\n  END_TASK\nEND_CONTROLLER`);
  const project = analyzer.parseL5K(text);
  const finding = project.findings.find((item) => item.id === "v7:program-multiple-tasks:ScheduledProgram");
  assert.ok(finding);
  assert.equal(finding.classification, "source-proven");
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /under one task/i);
});

test("v7 distinguishes a task-scheduled program whose MAIN routine remains unidentified", () => {
  const text = fixture.replace(
    "  TASK MainTask (Type := CONTINUOUS,",
    `  PROGRAM ScheduledNoMain (MODE := 0)\n    ROUTINE ServiceRoutine\n      RUNG 0\n        N: XIC(InputA)OTE(InputA);\n      END_RUNG\n    END_ROUTINE\n  END_PROGRAM\n\n  TASK MainTask (Type := CONTINUOUS,`
  ).replace("    ScheduledProgram;", "    ScheduledProgram;\n    ScheduledNoMain;");
  const project = analyzer.parseL5K(text);
  const finding = project.findings.find((item) => item.id === "v7:scheduled-program-main-unidentified:ScheduledNoMain");
  assert.ok(finding);
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /task scheduling is therefore proven by the export/i);
  assert.match(finding.summary, /routine entry path remains unresolved/i);
});

test("v7 preserves legacy neutral-N ladder parsing while adding TASK topology", () => {
  const legacy = `Version := RSLogix 5000 v15.02\nCONTROLLER LegacyTask\nTAG\nInputA : BOOL;\nFaults : DINT[1];\nEND_TAG\nPROGRAM P (MAIN := Main)\nROUTINE Main\nN: JSR(FaultsRoutine);\nEND_ROUTINE\nROUTINE FaultsRoutine\nN: XIC(InputA)OTL(Faults[0].1);\nEND_ROUTINE\nEND_PROGRAM\nTASK MainTask (Type := Continuous, Priority := 10)\nP;\nEND_TASK\nEND_CONTROLLER`;
  const project = analyzer.parseL5K(legacy);
  assert.equal(project.exportVersion, "15.02");
  assert.equal(project.source.ladderEncoding, "legacy-neutral-N");
  assert.equal(project.dependencies.taskScheduling.tasks[0].name, "MainTask");
  assert.ok(project.dependencies.taskScheduling.taskRootReachableRoutines.includes("P/FaultsRoutine"));
});

test("v7 layer remains local/read-only under the current v9 analyzer release", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
  const source = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-task-schedule-v7.js"), "utf8");
  assert.match(page, /PLC ANALYZER v9 — MSG MESSAGE TOPOLOGY/);
  assert.match(page, /TASK → PROGRAM MAIN → JSR/);
  assert.match(page, /l5k-analyzer-task-schedule-v7\.js\?v=7/);
  assert.match(page, /l5k-analyzer-communication-v8\.js\?v=8/);
  assert.match(page, /l5k-analyzer-message-v9\.js\?v=9/);
  assert.match(worker, /l5k-analyzer-discrepancies-v6\.js\?v=6/);
  assert.match(worker, /l5k-analyzer-task-schedule-v7\.js\?v=7/);
  assert.match(worker, /l5k-analyzer-communication-v8\.js\?v=8/);
  assert.match(worker, /l5k-analyzer-message-v9\.js\?v=9/);
  assert.match(source, /do not prove live execution/i);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /indexedDB/);
});
