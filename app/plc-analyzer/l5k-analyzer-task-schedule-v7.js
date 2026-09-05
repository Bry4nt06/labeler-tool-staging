"use strict";

(function installTaskScheduleTopology(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-discrepancies-v6.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTaskScheduleTopology(base) {
  if (!base || typeof base.parseL5K !== "function") throw new Error("ServoForge v6 analyzer is required before v7 task scheduling analysis.");

  const baseParseL5K = base.parseL5K;
  const baseTraceTarget = base.traceTarget;

  function normalize(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
  }

  function unquote(value) {
    const text = String(value || "").trim();
    return text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1).replace(/""/g, '"') : text;
  }

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function routineKey(program, routine) {
    return `${program || "?"}/${routine || "?"}`;
  }

  function parenthesisBalance(text) {
    let balance = 0;
    let quoted = false;
    const source = String(text || "");
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '"') {
        if (quoted && source[index + 1] === '"') {
          index += 1;
          continue;
        }
        quoted = !quoted;
        continue;
      }
      if (quoted) continue;
      if (char === "(") balance += 1;
      else if (char === ")") balance -= 1;
    }
    return balance;
  }

  function parseAttributes(header) {
    const attributes = {};
    const text = String(header || "");
    const open = text.indexOf("(");
    const close = text.lastIndexOf(")");
    if (open < 0 || close <= open) return attributes;
    const body = text.slice(open + 1, close);
    const matcher = /\b([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*("(?:""|[^"])*"|[^,\r\n\)]+)/g;
    let match;
    while ((match = matcher.exec(body))) attributes[match[1]] = unquote(match[2].trim());
    return attributes;
  }

  function parseTasks(input) {
    const lines = normalize(input).split("\n");
    const tasks = [];
    for (let index = 0; index < lines.length; index += 1) {
      const start = /^\s*TASK\s+("(?:""|[^"])+"|[^\s(]+)/i.exec(lines[index]);
      if (!start) continue;

      const taskLine = index + 1;
      let header = lines[index].trim();
      let cursor = index;
      if (header.includes("(")) {
        let balance = parenthesisBalance(header);
        while (balance > 0 && cursor + 1 < lines.length && cursor - index < 40) {
          cursor += 1;
          header += `\n${lines[cursor].trim()}`;
          balance = parenthesisBalance(header);
        }
      }

      const scheduledPrograms = [];
      let endLine = cursor + 1;
      let bodyCursor = cursor + 1;
      for (; bodyCursor < lines.length; bodyCursor += 1) {
        const trimmed = lines[bodyCursor].trim();
        if (/^END_TASK\b/i.test(trimmed)) {
          endLine = bodyCursor + 1;
          break;
        }
        if (!trimmed || /^\/\//.test(trimmed) || /^COMMENT\b/i.test(trimmed)) continue;
        const program = /^("(?:""|[^"])+"|[A-Za-z_][A-Za-z0-9_:$]*)\s*;\s*(?:\/\/.*)?$/.exec(trimmed);
        if (!program) continue;
        scheduledPrograms.push({
          program: unquote(program[1]),
          order: scheduledPrograms.length + 1,
          line: bodyCursor + 1,
          raw: trimmed
        });
      }

      const attributes = parseAttributes(header);
      tasks.push({
        name: unquote(start[1]),
        line: taskLine,
        endLine,
        attributes,
        type: attributes.Type || attributes.TYPE || null,
        priority: attributes.Priority || attributes.PRIORITY || null,
        rate: attributes.Rate || attributes.RATE || null,
        watchdog: attributes.Watchdog || attributes.WATCHDOG || null,
        inhibitTask: attributes.InhibitTask || attributes.INHIBITTASK || attributes.InihibitTask || null,
        class: attributes.Class || attributes.CLASS || null,
        scheduledPrograms,
        rawHeader: header
      });
      index = Math.max(index, bodyCursor);
    }
    return tasks;
  }

  function definedProgramNames(project) {
    return unique([
      ...(project.programs || []).map((item) => item?.name || item?.program),
      ...(project.dependencies?.programMainRoutines || []).map((item) => item?.program)
    ]);
  }

  function scheduleEntries(tasks) {
    const entries = [];
    for (const task of tasks || []) {
      for (const item of task.scheduledPrograms || []) {
        entries.push({
          task: task.name,
          taskLine: task.line,
          taskType: task.type,
          taskPriority: task.priority,
          taskRate: task.rate,
          taskWatchdog: task.watchdog,
          taskInhibit: task.inhibitTask,
          program: item.program,
          order: item.order,
          line: item.line,
          raw: item.raw
        });
      }
    }
    return entries;
  }

  function taskReachability(project, tasks) {
    const routineSet = new Set((project.routines || []).map((item) => routineKey(item.program, item.name)));
    const calls = project.dependencies?.routineCalls || [];
    const mainByProgram = new Map((project.dependencies?.programMainRoutines || []).map((item) => [item.program, item.mainRoutine || null]));
    const scheduled = scheduleEntries(tasks);
    const adjacency = new Map();
    for (const call of calls) {
      const from = routineKey(call.program, call.callerRoutine);
      const to = routineKey(call.program, call.calleeRoutine);
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push(to);
    }

    const reachable = new Set();
    const roots = [];
    for (const entry of scheduled) {
      const mainRoutine = mainByProgram.get(entry.program) || null;
      const root = mainRoutine ? routineKey(entry.program, mainRoutine) : null;
      const rootPresent = Boolean(root && routineSet.has(root));
      roots.push({ ...entry, mainRoutine, routineKey: root, mainPresent: rootPresent });
      if (!rootPresent) continue;
      const stack = [root];
      while (stack.length) {
        const current = stack.pop();
        if (reachable.has(current)) continue;
        reachable.add(current);
        for (const next of adjacency.get(current) || []) if (!reachable.has(next)) stack.push(next);
      }
    }
    return { roots, reachable, routineSet, mainByProgram, scheduled };
  }

  function buildTaskFindings(project, tasks) {
    const findings = [];
    const add = (id, classification, severity, title, summary, evidence = {}) => {
      findings.push({ id, classification, severity, title, summary, evidence, sourceRule: "plc-task-schedule-v7" });
    };

    const definedPrograms = new Set(definedProgramNames(project));
    const entries = scheduleEntries(tasks);
    const byProgram = new Map();
    const byTaskProgram = new Map();
    for (const entry of entries) {
      if (!byProgram.has(entry.program)) byProgram.set(entry.program, []);
      byProgram.get(entry.program).push(entry);
      const key = `${entry.task}\u0000${entry.program}`;
      if (!byTaskProgram.has(key)) byTaskProgram.set(key, []);
      byTaskProgram.get(key).push(entry);
    }

    for (const entry of entries) {
      if (definedPrograms.has(entry.program)) continue;
      add(
        `v7:task-program-missing:${entry.task}:${entry.program}:${entry.order}`,
        "source-proven",
        "review",
        `Scheduled program not present: ${entry.task}/${entry.program}`,
        `TASK ${entry.task} schedules ${entry.program} at declared position ${entry.order}, but no matching PROGRAM definition was recognized in the supplied export. Verify export completeness and revision before treating this as a controller defect.`,
        { entry }
      );
    }

    for (const [program, programEntries] of byProgram) {
      const tasksForProgram = unique(programEntries.map((item) => item.task));
      if (tasksForProgram.length <= 1) continue;
      add(
        `v7:program-multiple-tasks:${program}`,
        "source-proven",
        "review",
        `Program appears under multiple tasks: ${program}`,
        `${program} is listed under ${tasksForProgram.length} TASK declarations in the supplied export (${tasksForProgram.join(", ")}). Rockwell L5K task structure schedules a program under one task; verify the export/revision and parser evidence before making any field change.`,
        { program, entries: programEntries }
      );
    }

    for (const [key, duplicateEntries] of byTaskProgram) {
      if (duplicateEntries.length <= 1) continue;
      const [task, program] = key.split("\u0000");
      add(
        `v7:duplicate-task-program:${task}:${program}`,
        "source-proven",
        "review",
        `Program listed more than once in task: ${task}/${program}`,
        `${program} appears ${duplicateEntries.length} times in TASK ${task}. Preserve this as source evidence and verify the intended project revision before treating it as a configuration defect.`,
        { task, program, entries: duplicateEntries }
      );
    }

    for (const program of definedPrograms) {
      if (byProgram.has(program)) continue;
      add(
        `v7:program-not-task-scheduled:${program}`,
        "static-inference",
        "info",
        `Program not listed under a parsed task: ${program}`,
        `${program} is defined in the supplied export but is not listed in any TASK block recognized by this analyzer. Unscheduled programs can be intentional, and export subsets can omit task declarations; treat this as a review cue rather than a defect.`,
        { program }
      );
    }

    const mainByProgram = new Map((project.dependencies?.programMainRoutines || []).map((item) => [item.program, item.mainRoutine || null]));
    for (const [program, programEntries] of byProgram) {
      if (mainByProgram.get(program)) continue;
      add(
        `v7:scheduled-program-main-unidentified:${program}`,
        "static-inference",
        "review",
        `Scheduled program has no identified MAIN routine: ${program}`,
        `${program} is source-visible under TASK ${programEntries.map((item) => item.task).join(", ")}, but this analyzer did not identify its PROGRAM MAIN routine. Task scheduling is therefore proven by the export while the routine entry path remains unresolved.`,
        { program, schedules: programEntries }
      );
    }

    const topology = taskReachability(project, tasks);
    const unscheduledFaultWriters = [];
    const unresolvedScheduledFaultWriters = [];
    for (const fault of project.faultWriters || []) {
      for (const writer of fault.writers || []) {
        if (!writer.program || !writer.routine) continue;
        const schedules = byProgram.get(writer.program) || [];
        const key = routineKey(writer.program, writer.routine);
        if (!schedules.length) {
          unscheduledFaultWriters.push({ target: fault.target, writer, routineKey: key });
          continue;
        }
        if (!topology.reachable.has(key)) unresolvedScheduledFaultWriters.push({ target: fault.target, writer, routineKey: key, schedules });
      }
    }

    if (unscheduledFaultWriters.length) {
      add(
        "v7:fault-writers-in-unscheduled-programs",
        "static-inference",
        "review",
        "Fault writers found in programs not listed under a parsed task",
        `${unscheduledFaultWriters.length} fault-writer location${unscheduledFaultWriters.length === 1 ? " is" : "s are"} in a PROGRAM that is not listed under any TASK block recognized in this export. This does not prove dead logic; the program may be intentionally unscheduled or the export may be incomplete.`,
        { writers: unscheduledFaultWriters }
      );
    }

    if (unresolvedScheduledFaultWriters.length) {
      add(
        "v7:fault-writers-not-task-root-reachable",
        "static-inference",
        "review",
        "Fault writers not source-reachable from scheduled task roots",
        `${unresolvedScheduledFaultWriters.length} fault-writer location${unresolvedScheduledFaultWriters.length === 1 ? " is" : "s are"} inside source-visible scheduled programs but are not reachable through the parsed TASK → PROGRAM MAIN → JSR topology. Verify MAIN identification, unsupported language calls, conditional structure, and export completeness before drawing a runtime conclusion.`,
        { writers: unresolvedScheduledFaultWriters }
      );
    }

    return findings;
  }

  function enrichProject(project, input) {
    const tasks = parseTasks(input);
    const entries = scheduleEntries(tasks);
    const topology = taskReachability(project, tasks);
    const v7Findings = buildTaskFindings(project, tasks);
    const existingIds = new Set((project.findings || []).map((item) => item.id));
    project.findings = [...(project.findings || []), ...v7Findings.filter((item) => !existingIds.has(item.id))];
    project.dependencies = {
      ...(project.dependencies || {}),
      taskScheduling: {
        version: "v7",
        evidenceClass: "static-task-scheduling",
        sourceBoundary: "TASK blocks prove only the scheduling configuration present in the supplied export. They do not prove live execution, current inhibit state, scan duration, event occurrence, or controller mode.",
        tasks,
        scheduledPrograms: entries,
        executionRoots: topology.roots,
        taskRootReachableRoutines: [...topology.reachable].sort(),
        findings: v7Findings,
        statistics: {
          tasks: tasks.length,
          scheduledPrograms: entries.length,
          scheduledProgramsWithMain: topology.roots.filter((item) => item.mainPresent).length,
          taskRootReachableRoutines: topology.reachable.size,
          findings: v7Findings.length
        }
      }
    };
    project.statistics = {
      ...(project.statistics || {}),
      tasks: tasks.length,
      scheduledPrograms: entries.length,
      taskRootReachableRoutines: topology.reachable.size,
      findings: project.findings.length,
      taskScheduleFindings: v7Findings.length
    };
    return project;
  }

  function parseL5K(input, options = {}) {
    const text = normalize(input);
    const project = baseParseL5K(text, options);
    return enrichProject(project, text);
  }

  function traceTarget(project, target, options = {}) {
    if (typeof baseTraceTarget !== "function") throw new Error("Dependency trace support is unavailable.");
    const trace = baseTraceTarget(project, target, options);
    const scheduling = project?.dependencies?.taskScheduling;
    if (!scheduling) return trace;
    const programs = unique((trace.writers || []).map((writer) => writer.program));
    const contexts = programs.map((program) => {
      const schedules = (scheduling.scheduledPrograms || []).filter((item) => item.program === program);
      const main = (project.dependencies?.programMainRoutines || []).find((item) => item.program === program)?.mainRoutine || null;
      const writerRoutines = unique((trace.writers || []).filter((item) => item.program === program).map((item) => item.routine));
      return {
        program,
        schedules,
        mainRoutine: main,
        writerRoutines: writerRoutines.map((routine) => ({
          routine,
          taskRootReachable: (scheduling.taskRootReachableRoutines || []).includes(routineKey(program, routine))
        }))
      };
    });
    return {
      ...trace,
      taskContexts: contexts,
      taskScheduleStateProven: false,
      note: `${trace.note} TASK context is also static export evidence and does not prove the task is currently executing or uninhibited.`
    };
  }

  return Object.freeze({
    ...base,
    parseL5K,
    traceTarget,
    buildTaskScheduleFindings: buildTaskFindings,
    taskScheduleTopology: Object.freeze({
      version: "v7",
      parseTasks,
      taskReachability,
      scheduleEntries
    })
  });
});
