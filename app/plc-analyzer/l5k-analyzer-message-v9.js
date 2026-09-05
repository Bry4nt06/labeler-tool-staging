"use strict";

(function installMessageTopology(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-communication-v8.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMessageTopology(base) {
  if (!base || typeof base.parseL5K !== "function") throw new Error("ServoForge v8 analyzer is required before v9 MSG analysis.");

  const baseParseL5K = base.parseL5K;
  const baseTraceTarget = base.traceTarget;
  const baseSearchAnalysis = base.searchAnalysis;

  const MESSAGE_ATTRIBUTES = Object.freeze([
    "MessageType", "RemoteElement", "RequestedLength", "ConnectedFlag", "ConnectionPath", "CommTypeCode",
    "ServiceCode", "ObjectType", "TargetObject", "AttributeNumber", "Channel", "SourceLink", "DestinationLink",
    "DestinationNode", "Rack", "Group", "Slot", "LocalIndex", "RemoteIndex", "LocalElement", "DestinationTag",
    "CacheConnections", "LargePacketUsage"
  ]);

  function normalize(value) { return String(value || "").replace(/\r\n?/g, "\n"); }
  function unquote(value) {
    const text = String(value || "").trim();
    return text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1).replace(/""/g, '"') : text;
  }
  function rootSymbol(value) { return String(value || "").trim().split(".")[0].replace(/\[[^\]]*\].*$/, ""); }
  function attributeValue(statement, name) {
    const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`\\b${escaped}\\s*:=\\s*("(?:""|[^"])*"|[^,\\)\\r\\n;]+)`, "i").exec(statement);
    return match ? unquote(match[1].trim()) : null;
  }
  function statementHasTerminator(text) {
    let quoted = false;
    const source = String(text || "");
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '"') {
        if (quoted && source[index + 1] === '"') { index += 1; continue; }
        quoted = !quoted;
      } else if (!quoted && char === ";") return true;
    }
    return false;
  }

  function parseMessageTags(input) {
    const lines = normalize(input).split("\n");
    const records = [];
    let currentProgram = null;
    let inTags = false;
    let inDataType = false;
    let inAOI = false;
    let buffer = null;
    function finish(endLine) {
      if (!buffer) return;
      const raw = buffer.lines.join("\n").trim();
      const header = /^\s*([A-Za-z_][A-Za-z0-9_:$]*)\s*(?:OF\s+[^:]+)?\s*:\s*MESSAGE\b/i.exec(raw);
      if (header) {
        const attributes = {};
        for (const name of MESSAGE_ATTRIBUTES) {
          const value = attributeValue(raw, name);
          if (value !== null) attributes[name] = value;
        }
        records.push({
          name: header[1], dataType: "MESSAGE", scope: buffer.program || "controller", program: buffer.program,
          line: buffer.startLine, endLine, raw, attributes,
          messageType: attributes.MessageType ?? null,
          remoteElement: attributes.RemoteElement ?? null,
          requestedLength: attributes.RequestedLength ?? null,
          connectedFlag: attributes.ConnectedFlag ?? null,
          connectionPath: attributes.ConnectionPath ?? null,
          commTypeCode: attributes.CommTypeCode ?? null,
          serviceCode: attributes.ServiceCode ?? null,
          objectType: attributes.ObjectType ?? null,
          targetObject: attributes.TargetObject ?? null,
          attributeNumber: attributes.AttributeNumber ?? null,
          channel: attributes.Channel ?? null,
          sourceLink: attributes.SourceLink ?? null,
          destinationLink: attributes.DestinationLink ?? null,
          destinationNode: attributes.DestinationNode ?? null,
          rack: attributes.Rack ?? null,
          group: attributes.Group ?? null,
          slot: attributes.Slot ?? null,
          localIndex: attributes.LocalIndex ?? null,
          remoteIndex: attributes.RemoteIndex ?? null,
          localElement: attributes.LocalElement ?? null,
          destinationTag: attributes.DestinationTag ?? null,
          cacheConnections: attributes.CacheConnections ?? null,
          largePacketUsage: attributes.LargePacketUsage ?? null
        });
      }
      buffer = null;
    }
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNumber = index + 1;
      const trimmed = line.trim();
      if (/^DATATYPE\b/i.test(trimmed)) { inDataType = true; continue; }
      if (/^END_DATATYPE\b/i.test(trimmed)) { inDataType = false; continue; }
      if (/^ADD_ON_INSTRUCTION_DEFINITION\b/i.test(trimmed)) { inAOI = true; continue; }
      if (/^END_ADD_ON_INSTRUCTION_DEFINITION\b/i.test(trimmed)) { inAOI = false; continue; }
      if (inDataType || inAOI) continue;
      const program = /^PROGRAM\s+("[^"]+"|[^\s(]+)/i.exec(trimmed);
      if (program) currentProgram = unquote(program[1]);
      if (/^END_PROGRAM\b/i.test(trimmed)) currentProgram = null;
      if (/^TAG\b/i.test(trimmed) && !/^TAG\s*:/i.test(trimmed)) { finish(lineNumber - 1); inTags = true; continue; }
      if (/^END_TAG\b/i.test(trimmed)) { finish(lineNumber - 1); inTags = false; continue; }
      if (!inTags) continue;
      if (!buffer) {
        if (!/^\s*[A-Za-z_][A-Za-z0-9_:$]*\s*(?:OF\s+[^:]+)?\s*:\s*MESSAGE\b/i.test(line)) continue;
        buffer = { program: currentProgram, startLine: lineNumber, lines: [line] };
      } else buffer.lines.push(line);
      if (statementHasTerminator(buffer.lines.join("\n"))) finish(lineNumber);
    }
    finish(lines.length);
    return records;
  }

  function splitTopLevelArgs(text) {
    const args = [];
    let current = "";
    let depth = 0;
    let quoted = false;
    const source = String(text || "");
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '"') {
        if (quoted && source[index + 1] === '"') { current += '"'; index += 1; continue; }
        quoted = !quoted; current += char; continue;
      }
      if (!quoted) {
        if (char === "(") depth += 1;
        else if (char === ")") depth = Math.max(0, depth - 1);
        else if (char === "," && depth === 0) { args.push(current.trim()); current = ""; continue; }
      }
      current += char;
    }
    if (current.trim() || source.endsWith(",")) args.push(current.trim());
    return args;
  }

  function findMsgCalls(source) {
    const calls = [];
    const text = String(source || "");
    const starter = /\bMSG\s*\(/gi;
    let match;
    while ((match = starter.exec(text))) {
      const open = text.indexOf("(", match.index);
      let depth = 1;
      let quoted = false;
      let end = open + 1;
      for (; end < text.length && depth > 0; end += 1) {
        const char = text[end];
        if (char === '"') {
          if (quoted && text[end + 1] === '"') { end += 1; continue; }
          quoted = !quoted; continue;
        }
        if (quoted) continue;
        if (char === "(") depth += 1;
        else if (char === ")") depth -= 1;
      }
      if (depth !== 0) continue;
      const body = text.slice(open + 1, end - 1);
      const args = splitTopLevelArgs(body);
      calls.push({ raw: text.slice(match.index, end), args, controlTag: rootSymbol(unquote(args[0] || "")) || null, index: match.index });
      starter.lastIndex = end;
    }
    return calls;
  }

  function messageDirection(messageType) {
    const type = String(messageType || "").toLowerCase();
    if (!type || /unconfigured/.test(type)) return "unconfigured";
    if (/\bread\b/.test(type)) return "inbound-read";
    if (/\bwrite\b/.test(type)) return "outbound-write";
    if (/cip\s+generic/.test(type)) return "cip-generic";
    if (/module\s+reconfigure/.test(type)) return "module-service";
    return "other-message";
  }
  function moduleMatchesForPath(project, path) {
    const text = String(path || "").toLowerCase();
    if (!text) return [];
    return (project.modules || []).filter((module) => module?.name && text.includes(String(module.name).toLowerCase())).map((module) => module.name);
  }
  function resolveMessageTag(messageTags, controlTag, program) {
    if (!controlTag) return null;
    return messageTags.find((tag) => tag.name === controlTag && tag.program === program)
      || messageTags.find((tag) => tag.name === controlTag && tag.scope === "controller")
      || messageTags.find((tag) => tag.name === controlTag)
      || null;
  }
  function taskContext(project, program, routine) {
    const scheduling = project?.dependencies?.taskScheduling;
    const schedules = (scheduling?.scheduledPrograms || []).filter((item) => item.program === program);
    return { schedules, taskRootReachable: Boolean(scheduling?.taskRootReachableRoutines?.includes(`${program || ""}/${routine || ""}`)), runtimeExecutionProven: false };
  }
  function buildMessageCalls(project, messageTags) {
    const calls = [];
    for (const rung of project.rungs || []) {
      for (const call of findMsgCalls(rung.source)) {
        const config = resolveMessageTag(messageTags, call.controlTag, rung.program || null);
        const task = taskContext(project, rung.program || null, rung.routine || null);
        calls.push({
          controlTag: call.controlTag, program: rung.program || null, routine: rung.routine || null, rung: rung.number,
          line: rung.startLine, source: call.raw, configurationResolved: Boolean(config), configurationScope: config?.scope || null,
          messageType: config?.messageType || null, direction: messageDirection(config?.messageType), connectionPath: config?.connectionPath || null,
          remoteElement: config?.remoteElement || null, localElement: config?.localElement || null, destinationTag: config?.destinationTag || null,
          pathModuleMatches: moduleMatchesForPath(project, config?.connectionPath), schedules: task.schedules,
          taskRootReachable: task.taskRootReachable, runtimeExecutionProven: false
        });
      }
    }
    return calls;
  }

  function tagFindingId(tag) { return `v9:message-tag:${tag.scope}:${tag.name}`; }
  function callFindingId(call) {
    return call.configurationResolved
      ? `v9:msg-call:${call.program || "?"}:${call.routine || "?"}:${call.rung}:${call.controlTag}`
      : `v9:msg-control-unresolved:${call.program || "?"}:${call.routine || "?"}:${call.rung}`;
  }

  function buildFindings(messageTags, calls) {
    const findings = [];
    const add = (id, classification, severity, title, summary, evidence) => findings.push({ id, classification, severity, title, summary, evidence, sourceRule: "plc-message-v9" });
    for (const tag of messageTags) {
      add(
        tagFindingId(tag), "source-proven", "info", `MESSAGE configuration: ${tag.name}`,
        `${tag.name} is declared as a MESSAGE tag${tag.messageType ? ` with MessageType ${tag.messageType}` : ""}${tag.connectionPath ? ` and source path ${tag.connectionPath}` : ""}. This proves offline configuration only; it does not prove that a MSG instruction executes or that any transaction succeeds.`,
        { tag, direction: messageDirection(tag.messageType) }
      );
      const direction = messageDirection(tag.messageType);
      if (!tag.messageType || direction === "unconfigured") {
        add(
          `v9:message-unconfigured:${tag.scope}:${tag.name}`, "source-proven", "review", `MESSAGE tag is unconfigured: ${tag.name}`,
          `${tag.name} is declared as MESSAGE in the supplied export, but MessageType is ${tag.messageType || "not present"}. This is source configuration evidence only and may be intentional during commissioning or dynamic configuration.`, { tag }
        );
      }
      if ((direction === "inbound-read" || direction === "outbound-write") && (!tag.remoteElement || !tag.localElement)) {
        add(
          `v9:message-elements-incomplete:${tag.scope}:${tag.name}`, "source-proven", "review", `MESSAGE source/destination evidence incomplete: ${tag.name}`,
          `${tag.name} is configured as ${tag.messageType || "a data-table message"}, but the supplied MESSAGE tag does not expose both LocalElement and RemoteElement. Verify the intended export/revision; this analyzer does not infer missing message operands or runtime configuration.`, { tag }
        );
      }
    }
    for (const call of calls) {
      if (!call.controlTag || !call.configurationResolved) {
        add(
          callFindingId(call), "source-proven", "review", `MSG control tag unresolved: ${call.controlTag || "not identified"}`,
          `A source-visible MSG instruction was found at ${call.program || "?"}/${call.routine || "?"} rung ${call.rung}, but its MESSAGE control-tag configuration was not resolved in the supplied export. Verify project/export completeness and scope. This does not prove a live communications fault.`, { call }
        );
        continue;
      }
      add(
        callFindingId(call), "source-proven", "info", `MSG instruction: ${call.controlTag}`,
        `${call.controlTag} is invoked by a source-visible MSG instruction${call.messageType ? ` configured as ${call.messageType}` : ""}${call.connectionPath ? ` with source path ${call.connectionPath}` : ""}. The L5K proves configuration and invocation only; it does not prove the rung executes, the message is sent, or the transaction succeeds.`, { call }
      );
    }
    return findings;
  }

  function parseL5K(input, options = {}) {
    const project = baseParseL5K(input, options);
    const messageTags = parseMessageTags(input);
    const calls = buildMessageCalls(project, messageTags);
    const findings = buildFindings(messageTags, calls);
    const byControlTag = messageTags.map((tag) => ({
      controlTag: tag.name, scope: tag.scope, messageType: tag.messageType, direction: messageDirection(tag.messageType),
      connectionPath: tag.connectionPath, remoteElement: tag.remoteElement, localElement: tag.localElement,
      destinationTag: tag.destinationTag, requestedLength: tag.requestedLength,
      pathModuleMatches: moduleMatchesForPath(project, tag.connectionPath),
      calls: calls.filter((call) => call.controlTag === tag.name && (call.program === tag.program || tag.scope === "controller"))
    }));
    for (const finding of findings) {
      const tag = finding.evidence?.tag;
      if (tag) finding.evidence.pathModuleMatches = moduleMatchesForPath(project, tag.connectionPath);
    }
    project.dependencies = project.dependencies || {};
    project.dependencies.messageTopology = {
      version: "v9", messageTags, calls, byControlTag,
      sourceBoundary: "MSG topology is static L5K source evidence. A configured MESSAGE tag or MSG instruction does not prove rung execution, peer availability, route health, packet delivery, message completion, error-free status, or payload freshness.",
      statistics: { messageTags: messageTags.length, msgCalls: calls.length, resolvedCalls: calls.filter((call) => call.configurationResolved).length, taskRootReachableCalls: calls.filter((call) => call.taskRootReachable).length }
    };
    project.findings = [...(project.findings || []), ...findings];
    project.statistics = { ...(project.statistics || {}), messageTags: messageTags.length, msgCalls: calls.length, messageFindings: findings.length, findings: project.findings.length };
    return project;
  }

  function traceTarget(project, target, options = {}) {
    const trace = baseTraceTarget ? baseTraceTarget(project, target, options) : { target, nodes: [] };
    const symbols = new Set([rootSymbol(target)]);
    for (const node of trace.nodes || []) symbols.add(rootSymbol(node.symbol));
    const topology = project?.dependencies?.messageTopology;
    const contexts = (topology?.messageTags || []).filter((tag) => symbols.has(tag.name)).map((tag) => ({
      controlTag: tag.name, scope: tag.scope, messageType: tag.messageType, direction: messageDirection(tag.messageType),
      connectionPath: tag.connectionPath, remoteElement: tag.remoteElement, localElement: tag.localElement,
      destinationTag: tag.destinationTag, calls: (topology?.calls || []).filter((call) => call.controlTag === tag.name)
    }));
    return { ...trace, messageRuntimeStateProven: false, messageContexts: contexts, messageNote: contexts.length ? "MESSAGE configuration and MSG call sites are source-visible. EN/DN/ER state, actual execution, route health, completion, and payload freshness are not proven by this offline export." : null };
  }

  function searchAnalysis(project, query, limit = 50) {
    const baseResults = baseSearchAnalysis ? baseSearchAnalysis(project, query, limit) : [];
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return baseResults;
    const extra = [];
    const topology = project?.dependencies?.messageTopology;
    for (const tag of topology?.messageTags || []) {
      if (!JSON.stringify(tag).toLowerCase().includes(needle)) continue;
      extra.push({
        type: "finding", key: tagFindingId(tag), title: `${tag.name} • ${tag.messageType || "MESSAGE"}`,
        detail: `${tag.connectionPath || "path not present"} • ${tag.remoteElement || "remote element not present"}`,
        score: tag.name.toLowerCase() === needle ? 120 : 78, source: tag.raw
      });
    }
    for (const call of topology?.calls || []) {
      if (!JSON.stringify(call).toLowerCase().includes(needle)) continue;
      extra.push({
        type: "finding", key: callFindingId(call), title: `MSG ${call.controlTag || "control unresolved"}`,
        detail: `${call.program || "?"}/${call.routine || "?"} rung ${call.rung} • ${call.messageType || "configuration unresolved"}`,
        score: String(call.controlTag || "").toLowerCase() === needle ? 115 : 76, source: call.source
      });
    }
    return [...baseResults, ...extra].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, limit);
  }

  return Object.freeze({ ...base, version: "l5k-analyzer-v9", parseL5K, traceTarget, searchAnalysis, parseMessageTags, findMsgCalls, messageDirection });
});
