"use strict";

(function installMessageCompare(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-compare-communication-v8-1.js")
    : root?.ServoForgeL5KCompare;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMessageCompare(base) {
  if (!base || typeof base.compareProjects !== "function") throw new Error("ServoForge v8.1 communication comparison is required before v9.1 MSG/MESSAGE comparison.");

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

  function topology(project) {
    return project?.dependencies?.messageTopology || null;
  }

  function messageDifference(changeType, key, title, summary, options = {}) {
    return {
      id: `messages:${changeType}:${key}`,
      category: "messages",
      messageKind: options.messageKind || "message-config",
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

  function tagKey(tag) {
    return `${tag?.scope || "controller"}|${tag?.name || ""}`;
  }

  function tagMap(project) {
    return new Map((topology(project)?.messageTags || []).map((tag) => [tagKey(tag), tag]));
  }

  function controlSummary(project, tag) {
    return (topology(project)?.byControlTag || []).find((item) => item.controlTag === tag?.name && item.scope === tag?.scope) || null;
  }

  function tagSnapshot(tag, project) {
    if (!tag) return null;
    const control = controlSummary(project, tag);
    return {
      scope: tag.scope || null,
      name: tag.name || null,
      dataType: tag.dataType || "MESSAGE",
      messageType: tag.messageType || null,
      direction: control?.direction || null,
      connectionPath: tag.connectionPath || null,
      localElement: tag.localElement || null,
      remoteElement: tag.remoteElement || null,
      requestedLength: tag.requestedLength || null,
      destinationTag: tag.destinationTag || null,
      connectedFlag: tag.connectedFlag || null,
      commTypeCode: tag.commTypeCode || null,
      serviceCode: tag.serviceCode || null,
      objectType: tag.objectType || null,
      targetObject: tag.targetObject || null,
      attributeNumber: tag.attributeNumber || null,
      channel: tag.channel || null,
      sourceLink: tag.sourceLink || null,
      destinationLink: tag.destinationLink || null,
      destinationNode: tag.destinationNode || null,
      rack: tag.rack || null,
      group: tag.group || null,
      slot: tag.slot || null,
      localIndex: tag.localIndex || null,
      remoteIndex: tag.remoteIndex || null,
      cacheConnections: tag.cacheConnections || null,
      largePacketUsage: tag.largePacketUsage || null,
      pathModuleMatches: sortedUnique(control?.pathModuleMatches || [])
    };
  }

  function callSiteKey(call) {
    return `${call?.program || "?"}|${call?.routine || "?"}|${call?.rung ?? "?"}`;
  }

  function callSiteLabel(call) {
    return `${call?.program || "?"}/${call?.routine || "?"} rung ${call?.rung ?? "?"}`;
  }

  function callSnapshot(call) {
    return {
      controlTag: call?.controlTag || null,
      configurationResolved: Boolean(call?.configurationResolved),
      configurationScope: call?.configurationScope || null,
      messageType: call?.messageType || null,
      direction: call?.direction || null,
      connectionPath: call?.connectionPath || null,
      remoteElement: call?.remoteElement || null,
      localElement: call?.localElement || null,
      destinationTag: call?.destinationTag || null,
      pathModuleMatches: sortedUnique(call?.pathModuleMatches || []),
      scheduledTasks: sortedUnique((call?.schedules || []).map((item) => item?.task)),
      taskRootReachable: Boolean(call?.taskRootReachable),
      runtimeExecutionProven: false
    };
  }

  function callSiteMap(project) {
    const map = new Map();
    for (const call of topology(project)?.calls || []) {
      const key = callSiteKey(call);
      const group = map.get(key) || { label: callSiteLabel(call), calls: [] };
      group.calls.push(callSnapshot(call));
      map.set(key, group);
    }
    for (const value of map.values()) {
      value.calls.sort((a, b) => String(a.controlTag || "").localeCompare(String(b.controlTag || "")));
    }
    return map;
  }

  function recalculateStatistics(result) {
    const differences = result.differences || [];
    const categoryCounts = {};
    const changeCounts = { added: 0, removed: 0, changed: 0 };
    const reviewCounts = { info: 0, review: 0, caution: 0 };
    for (const item of differences) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      changeCounts[item.changeType] = (changeCounts[item.changeType] || 0) + 1;
      reviewCounts[item.reviewLevel] = (reviewCounts[item.reviewLevel] || 0) + 1;
    }
    result.statistics = {
      ...(result.statistics || {}),
      totalDifferences: differences.length,
      categoryCounts,
      changeCounts,
      reviewCounts,
      dependencyDifferences: categoryCounts.dependencies || 0,
      taskScheduleDifferences: categoryCounts.tasks || 0,
      communicationDifferences: categoryCounts.communications || 0,
      messageDifferences: categoryCounts.messages || 0
    };
  }

  function addMessageDifferences(result, baselineProject, currentProject) {
    const leftTopology = topology(baselineProject);
    const rightTopology = topology(currentProject);
    if (!leftTopology && !rightTopology) return result;

    const differences = result.differences || [];
    const leftTags = tagMap(baselineProject);
    const rightTags = tagMap(currentProject);
    const tagKeys = sortedUnique([...leftTags.keys(), ...rightTags.keys()]);

    for (const key of tagKeys) {
      const before = leftTags.get(key);
      const after = rightTags.get(key);
      const tag = before || after;
      const label = `${tag?.scope || "controller"}/${tag?.name || key}`;
      if (!before) {
        differences.push(messageDifference(
          "added",
          `config:${key}`,
          `MESSAGE configuration added: ${label}`,
          `${label} appears only in the current export. This proves an offline MESSAGE configuration difference only; it does not prove that a MSG executes, that the route is healthy, or that a transaction succeeds.`,
          { messageKind: "message-config", current: tagSnapshot(after, currentProject) }
        ));
        continue;
      }
      if (!after) {
        differences.push(messageDifference(
          "removed",
          `config:${key}`,
          `MESSAGE configuration removed: ${label}`,
          `${label} appears only in the baseline export. Verify the intended project revision before treating the removal as a communications defect.`,
          { messageKind: "message-config", baseline: tagSnapshot(before, baselineProject) }
        ));
        continue;
      }
      const beforeSnapshot = tagSnapshot(before, baselineProject);
      const afterSnapshot = tagSnapshot(after, currentProject);
      if (same(beforeSnapshot, afterSnapshot)) continue;
      differences.push(messageDifference(
        "changed",
        `config:${key}`,
        `MESSAGE configuration changed: ${label}`,
        `${label} has different source-visible message type, path, local/remote element, requested length, CIP service/object fields, connection/cache attributes, and/or source-visible path-module resolution. These values are comparison evidence only and are not adjustment recommendations.`,
        { messageKind: "message-config", baseline: beforeSnapshot, current: afterSnapshot }
      ));
    }

    const leftCalls = callSiteMap(baselineProject);
    const rightCalls = callSiteMap(currentProject);
    const callKeys = sortedUnique([...leftCalls.keys(), ...rightCalls.keys()]);
    for (const key of callKeys) {
      const before = leftCalls.get(key);
      const after = rightCalls.get(key);
      const label = before?.label || after?.label || key;
      if (!before) {
        differences.push(messageDifference(
          "added",
          `call:${key}`,
          `MSG call site added: ${label}`,
          `${label} contains a source-visible MSG invocation only in the current export. This does not prove the rung executes or that any message is sent or completed.`,
          { messageKind: "msg-call-site", current: after.calls }
        ));
        continue;
      }
      if (!after) {
        differences.push(messageDifference(
          "removed",
          `call:${key}`,
          `MSG call site removed: ${label}`,
          `${label} contains source-visible MSG invocation evidence only in the baseline export. Verify the intended revision and routine path before treating the difference as a communications defect.`,
          { messageKind: "msg-call-site", baseline: before.calls }
        ));
        continue;
      }
      if (same(before.calls, after.calls)) continue;
      differences.push(messageDifference(
        "changed",
        `call:${key}`,
        `MSG call site changed: ${label}`,
        `${label} has different source-visible control-tag resolution, MESSAGE configuration, path/elements, or task-root reachability context. Task reachability is static source evidence and does not prove current execution, EN/DN/ER state, or message completion.`,
        { messageKind: "msg-call-site", baseline: before.calls, current: after.calls }
      ));
    }

    result.version = "l5k-compare-v9.1";
    result.differences = differences;
    recalculateStatistics(result);
    result.messageComparison = {
      version: "v9.1",
      baselineAvailable: Boolean(leftTopology),
      currentAvailable: Boolean(rightTopology),
      sourceBoundary: "MSG/MESSAGE comparison reports offline source/configuration differences only. It does not prove rung execution, peer availability, route health, packet delivery, message completion, current EN/DN/ER state, payload freshness, or that any path/length/service value should be changed."
    };
    return result;
  }

  function compareProjects(baselineProject, currentProject, options = {}) {
    const result = baseCompareProjects(baselineProject, currentProject, options);
    return addMessageDifferences(result, baselineProject, currentProject);
  }

  return Object.freeze({
    ...base,
    version: "l5k-compare-v9.1",
    compareProjects,
    addMessageDifferences
  });
});
