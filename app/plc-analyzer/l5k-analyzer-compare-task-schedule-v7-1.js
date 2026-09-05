"use strict";

(function installTaskScheduleCompare(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-compare-dependencies-v5-2.js")
    : root?.ServoForgeL5KCompare;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTaskScheduleCompare(base) {
  if (!base || typeof base.compareProjects !== "function") throw new Error("ServoForge v5.2 dependency comparison is required before v7.1 task schedule comparison.");

  const baseCompareProjects = base.compareProjects;

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = stable(value[key]);
    return result;
  }

  function same(a, b) {
    return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  }

  function sortedUnique(values) {
    return [...new Set((values || []).filter((value) => value !== null && value !== undefined).map(String))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function taskDifference(changeType, key, title, summary, options = {}) {
    return {
      id: `tasks:${changeType}:${key}`,
      category: "tasks",
      taskKind: options.taskKind || "task-schedule",
      changeType,
      key,
      title,
      summary,
      classification: options.classification || "configuration-difference",
      reviewLevel: options.reviewLevel || "review",
      baseline: options.baseline ?? null,
      current: options.current ?? null,
      evidence: options.evidence || null
    };
  }

  function taskSnapshot(task) {
    return {
      name: task?.name || null,
      type: task?.type || null,
      priority: task?.priority || null,
      rate: task?.rate || null,
      watchdog: task?.watchdog || null,
      inhibitTask: task?.inhibitTask || null,
      class: task?.class || null
    };
  }

  function programOrderSnapshot(task) {
    return (task?.scheduledPrograms || []).map((item) => ({ program: item.program, order: item.order }));
  }

  function taskMap(project) {
    return new Map((project?.dependencies?.taskScheduling?.tasks || []).map((task) => [task.name, task]));
  }

  function definedPrograms(project) {
    return sortedUnique([
      ...(project?.programs || []).map((item) => item?.name || item?.program),
      ...(project?.dependencies?.programMainRoutines || []).map((item) => item?.program)
    ]);
  }

  function assignmentMap(project) {
    const map = new Map();
    for (const item of project?.dependencies?.taskScheduling?.scheduledPrograms || []) {
      if (!map.has(item.program)) map.set(item.program, []);
      map.get(item.program).push({
        task: item.task,
        order: item.order,
        taskType: item.taskType || null,
        taskPriority: item.taskPriority || null,
        taskRate: item.taskRate || null
      });
    }
    for (const [program, entries] of map) {
      entries.sort((a, b) => a.task.localeCompare(b.task) || Number(a.order || 0) - Number(b.order || 0));
      map.set(program, entries);
    }
    return map;
  }

  function addTaskScheduleDifferences(result, baselineProject, currentProject) {
    const leftScheduling = baselineProject?.dependencies?.taskScheduling;
    const rightScheduling = currentProject?.dependencies?.taskScheduling;
    if (!leftScheduling && !rightScheduling) return result;

    const differences = result.differences || [];
    const leftTasks = taskMap(baselineProject);
    const rightTasks = taskMap(currentProject);
    const taskNames = sortedUnique([...leftTasks.keys(), ...rightTasks.keys()]);

    for (const taskName of taskNames) {
      const left = leftTasks.get(taskName);
      const right = rightTasks.get(taskName);
      if (!left) {
        differences.push(taskDifference(
          "added",
          `task:${taskName}`,
          `Task ${taskName} added`,
          `TASK ${taskName} exists only in the current export. This is source/configuration evidence and does not prove the task is currently executing.`,
          { taskKind: "task", current: taskSnapshot(right), reviewLevel: "review" }
        ));
        continue;
      }
      if (!right) {
        differences.push(taskDifference(
          "removed",
          `task:${taskName}`,
          `Task ${taskName} removed`,
          `TASK ${taskName} exists only in the baseline export. Verify the intended controller revision before treating this as a defect.`,
          { taskKind: "task", baseline: taskSnapshot(left), reviewLevel: "review" }
        ));
        continue;
      }

      const leftAttributes = taskSnapshot(left);
      const rightAttributes = taskSnapshot(right);
      if (!same(leftAttributes, rightAttributes)) {
        differences.push(taskDifference(
          "changed",
          `task-attributes:${taskName}`,
          `Task attributes changed: ${taskName}`,
          `TASK ${taskName} has different source-visible Type, Priority, Rate, Watchdog, InhibitTask, and/or Class values. These values are export evidence only and are not adjustment recommendations or proof of current runtime state.`,
          { taskKind: "task-attributes", baseline: leftAttributes, current: rightAttributes, reviewLevel: "review" }
        ));
      }

      const leftOrder = programOrderSnapshot(left);
      const rightOrder = programOrderSnapshot(right);
      const leftMembers = sortedUnique(leftOrder.map((item) => item.program));
      const rightMembers = sortedUnique(rightOrder.map((item) => item.program));
      if (same(leftMembers, rightMembers) && !same(leftOrder, rightOrder)) {
        differences.push(taskDifference(
          "changed",
          `program-order:${taskName}`,
          `Program schedule order changed: ${taskName}`,
          `TASK ${taskName} contains the same source-visible programs, but their declared execution order differs between the exports. This is configuration evidence only; actual timing and execution still require runtime verification.`,
          { taskKind: "program-order", baseline: leftOrder, current: rightOrder, reviewLevel: "review" }
        ));
      }
    }

    const leftAssignments = assignmentMap(baselineProject);
    const rightAssignments = assignmentMap(currentProject);
    const programs = sortedUnique([
      ...definedPrograms(baselineProject),
      ...definedPrograms(currentProject),
      ...leftAssignments.keys(),
      ...rightAssignments.keys()
    ]);

    for (const program of programs) {
      const left = leftAssignments.get(program) || [];
      const right = rightAssignments.get(program) || [];
      const leftScheduled = left.length > 0;
      const rightScheduled = right.length > 0;

      if (leftScheduled !== rightScheduled) {
        const becameScheduled = rightScheduled;
        differences.push(taskDifference(
          "changed",
          `scheduled-state:${program}`,
          `Program ${program} ${becameScheduled ? "became scheduled" : "became unscheduled"}`,
          becameScheduled
            ? `${program} is not listed under a parsed TASK in the baseline export but is scheduled under ${right.map((item) => item.task).join(", ")} in the current export.`
            : `${program} is scheduled under ${left.map((item) => item.task).join(", ")} in the baseline export but is not listed under any parsed TASK in the current export. This may be intentional; verify project revision and export completeness.`,
          {
            taskKind: "scheduled-state",
            baseline: left,
            current: right,
            reviewLevel: becameScheduled ? "info" : "review"
          }
        ));
        continue;
      }

      if (!leftScheduled || same(left, right)) continue;
      const leftTasksOnly = sortedUnique(left.map((item) => item.task));
      const rightTasksOnly = sortedUnique(right.map((item) => item.task));
      if (!same(leftTasksOnly, rightTasksOnly)) {
        differences.push(taskDifference(
          "changed",
          `program-task:${program}`,
          `Program moved between tasks: ${program}`,
          `${program} is scheduled under different TASK declarations between the baseline and current exports. Baseline: ${leftTasksOnly.join(", ")}; current: ${rightTasksOnly.join(", ")}.`,
          { taskKind: "program-task", baseline: left, current: right, reviewLevel: "review" }
        ));
      }
    }

    const categoryCounts = {};
    const changeCounts = { added: 0, removed: 0, changed: 0 };
    const reviewCounts = { info: 0, review: 0, caution: 0 };
    for (const item of differences) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      changeCounts[item.changeType] = (changeCounts[item.changeType] || 0) + 1;
      reviewCounts[item.reviewLevel] = (reviewCounts[item.reviewLevel] || 0) + 1;
    }

    result.version = "l5k-compare-v7.1";
    result.differences = differences;
    result.statistics = {
      ...(result.statistics || {}),
      totalDifferences: differences.length,
      categoryCounts,
      changeCounts,
      reviewCounts,
      dependencyDifferences: categoryCounts.dependencies || 0,
      taskScheduleDifferences: categoryCounts.tasks || 0
    };
    result.taskScheduleComparison = {
      version: "v7.1",
      baselineAvailable: Boolean(leftScheduling),
      currentAvailable: Boolean(rightScheduling),
      sourceBoundary: "Task schedule comparison reports source/configuration differences only. TASK attributes, assignment, and order do not prove current task execution, inhibit state, timing, controller mode, or that a change is defective."
    };
    return result;
  }

  function compareProjects(baselineProject, currentProject, options = {}) {
    const result = baseCompareProjects(baselineProject, currentProject, options);
    return addTaskScheduleDifferences(result, baselineProject, currentProject);
  }

  return Object.freeze({
    ...base,
    version: "l5k-compare-v7.1",
    compareProjects,
    addTaskScheduleDifferences
  });
});
