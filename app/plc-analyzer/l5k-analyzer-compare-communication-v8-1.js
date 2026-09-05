"use strict";

(function installCommunicationCompare(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-compare-task-schedule-v7-1.js")
    : root?.ServoForgeL5KCompare;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCommunicationCompare(base) {
  if (!base || typeof base.compareProjects !== "function") throw new Error("ServoForge v7.1 task schedule comparison is required before v8.1 communication comparison.");

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
    return [...new Set((values || []).filter((value) => value !== null && value !== undefined).map(String))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function communicationDifference(changeType, key, title, summary, options = {}) {
    return {
      id: `communications:${changeType}:${key}`,
      category: "communications",
      communicationKind: options.communicationKind || "communication-tag",
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

  function topology(project) {
    return project?.dependencies?.communicationTopology || null;
  }

  function tagKey(tag) {
    return `${tag?.scope || "controller"}|${tag?.name || ""}`;
  }

  function mapTags(project) {
    return new Map((topology(project)?.tags || []).map((tag) => [tagKey(tag), tag]));
  }

  function consumedSnapshot(tag, project) {
    const edge = (topology(project)?.inbound || []).find((item) => item.scope === tag.scope && item.localTag === tag.name) || null;
    return {
      role: tag?.role || null,
      scope: tag?.scope || null,
      name: tag?.name || null,
      dataType: tag?.dataType || null,
      producer: tag?.consumed?.producer || null,
      remoteTag: tag?.consumed?.remoteTag || null,
      remoteFile: tag?.consumed?.remoteFile || null,
      rpi: tag?.consumed?.rpi || null,
      includeConnectionStatus: tag?.consumed?.includeConnectionStatus || null,
      timeoutMultiplier: tag?.consumed?.timeoutMultiplier || null,
      networkDelayMultiplier: tag?.consumed?.networkDelayMultiplier || null,
      reactionTimeLimit: tag?.consumed?.reactionTimeLimit || null,
      maxObservedNetworkDelay: tag?.consumed?.maxObservedNetworkDelay || null,
      unicast: tag?.consumed?.unicast || null,
      producerModulePresent: edge?.producerModulePresent ?? false
    };
  }

  function producedSnapshot(tag) {
    return {
      role: tag?.role || null,
      scope: tag?.scope || null,
      name: tag?.name || null,
      dataType: tag?.dataType || null,
      produceCount: tag?.produced?.produceCount || null,
      minimumRPI: tag?.produced?.minimumRPI || null,
      maximumRPI: tag?.produced?.maximumRPI || null,
      defaultRPI: tag?.produced?.defaultRPI || null,
      plcMappingFile: tag?.produced?.plcMappingFile || null,
      plc2Mapping: tag?.produced?.plc2Mapping || null,
      unicastPermitted: tag?.produced?.unicastPermitted || null,
      programmaticallySendEventTrigger: tag?.produced?.programmaticallySendEventTrigger || null,
      includeConnectionStatus: tag?.produced?.includeConnectionStatus || null
    };
  }

  function snapshot(tag, project) {
    if (!tag) return null;
    if (tag.role === "consumed") return consumedSnapshot(tag, project);
    if (tag.role === "produced") return producedSnapshot(tag);
    return {
      role: tag.role || null,
      scope: tag.scope || null,
      name: tag.name || null,
      dataType: tag.dataType || null
    };
  }

  function addCommunicationDifferences(result, baselineProject, currentProject) {
    const leftTopology = topology(baselineProject);
    const rightTopology = topology(currentProject);
    if (!leftTopology && !rightTopology) return result;

    const differences = result.differences || [];
    const left = mapTags(baselineProject);
    const right = mapTags(currentProject);
    const keys = sortedUnique([...left.keys(), ...right.keys()]);

    for (const key of keys) {
      const before = left.get(key);
      const after = right.get(key);
      const tag = before || after;
      const label = `${tag?.scope || "controller"}/${tag?.name || key}`;

      if (!before) {
        differences.push(communicationDifference(
          "added",
          `tag:${key}`,
          `Communication tag added: ${label}`,
          `${label} appears only in the current export as a ${after.role} communication tag. This is source configuration evidence only and does not prove a live connection or actual data transfer.`,
          {
            communicationKind: "communication-tag",
            current: snapshot(after, currentProject),
            reviewLevel: "review"
          }
        ));
        continue;
      }

      if (!after) {
        differences.push(communicationDifference(
          "removed",
          `tag:${key}`,
          `Communication tag removed: ${label}`,
          `${label} appears only in the baseline communication topology. Verify the intended controller revision and tag definition before treating the change as a communications defect.`,
          {
            communicationKind: "communication-tag",
            baseline: snapshot(before, baselineProject),
            reviewLevel: "review"
          }
        ));
        continue;
      }

      if (before.role !== after.role) {
        differences.push(communicationDifference(
          "changed",
          `role:${key}`,
          `Communication role changed: ${label}`,
          `${label} changed from ${before.role} to ${after.role} in the supplied exports. This is a source-visible tag-role change; it does not prove current network state or whether the revision is correct for the machine.`,
          {
            communicationKind: "communication-role",
            baseline: snapshot(before, baselineProject),
            current: snapshot(after, currentProject),
            reviewLevel: "review"
          }
        ));
        continue;
      }

      const beforeSnapshot = snapshot(before, baselineProject);
      const afterSnapshot = snapshot(after, currentProject);
      if (same(beforeSnapshot, afterSnapshot)) continue;

      if (before.role === "consumed") {
        differences.push(communicationDifference(
          "changed",
          `consumed:${key}`,
          `Consumed mapping changed: ${label}`,
          `${label} has different source-visible Producer, RemoteTag/RemoteFile, RPI, connection-status/timing attributes, data type, and/or producer-module resolution evidence. RPI and timeout values are comparison evidence only, not adjustment recommendations.`,
          {
            communicationKind: "consumed-tag",
            baseline: beforeSnapshot,
            current: afterSnapshot,
            reviewLevel: "review"
          }
        ));
      } else {
        differences.push(communicationDifference(
          "changed",
          `produced:${key}`,
          `Produced mapping changed: ${label}`,
          `${label} has different source-visible ProduceCount, RPI bounds/default, mapping/unicast/status attributes, and/or data type. These values do not identify actual connected consumers and are not adjustment recommendations.`,
          {
            communicationKind: "produced-tag",
            baseline: beforeSnapshot,
            current: afterSnapshot,
            reviewLevel: "review"
          }
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

    result.version = "l5k-compare-v8.1";
    result.differences = differences;
    result.statistics = {
      ...(result.statistics || {}),
      totalDifferences: differences.length,
      categoryCounts,
      changeCounts,
      reviewCounts,
      dependencyDifferences: categoryCounts.dependencies || 0,
      taskScheduleDifferences: categoryCounts.tasks || 0,
      communicationDifferences: categoryCounts.communications || 0
    };
    result.communicationComparison = {
      version: "v8.1",
      baselineAvailable: Boolean(leftTopology),
      currentAvailable: Boolean(rightTopology),
      sourceBoundary: "Communication comparison reports produced/consumed tag configuration differences only. It does not prove peer availability, packet delivery, connection health, current connection status, actual consumer count, or that any RPI/timeout value should be changed."
    };
    return result;
  }

  function compareProjects(baselineProject, currentProject, options = {}) {
    const result = baseCompareProjects(baselineProject, currentProject, options);
    return addCommunicationDifferences(result, baselineProject, currentProject);
  }

  return Object.freeze({
    ...base,
    version: "l5k-compare-v8.1",
    compareProjects,
    addCommunicationDifferences
  });
});
