"use strict";

(function installCommunicationTopology(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-task-schedule-v7.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCommunicationTopology(base) {
  if (!base || typeof base.parseL5K !== "function") throw new Error("ServoForge v7 analyzer is required before v8 communication analysis.");

  const baseParseL5K = base.parseL5K;
  const baseTraceTarget = base.traceTarget;
  const baseSearchAnalysis = base.searchAnalysis;

  const PRODUCED_ATTRIBUTES = Object.freeze([
    "ProduceCount", "MinimumRPI", "MaximumRPI", "DefaultRPI", "PLCMappingFile", "PLC2Mapping", "UnicastPermitted"
  ]);
  const CONSUMED_ATTRIBUTES = Object.freeze([
    "Producer", "RemoteTag", "RemoteFile", "RPI"
  ]);
  const SHARED_COMM_ATTRIBUTES = Object.freeze([
    "ProgrammaticallySendEventTrigger", "IncludeConnectionStatus", "TimeoutMultiplier", "NetworkDelayMultiplier", "ReactionTimeLimit", "MaxObservedNetworkDelay", "Unicast"
  ]);

  function normalize(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
  }

  function unquote(value) {
    const text = String(value || "").trim();
    return text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1).replace(/""/g, '"') : text;
  }

  function numeric(value) {
    const text = String(value ?? "").trim();
    return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text) ? Number(text) : null;
  }

  function rootSymbol(value) {
    return String(value || "").trim().split(".")[0].replace(/\[[^\]]*\].*$/, "");
  }

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

  function parseTagStatements(input) {
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
      const header = /^\s*([A-Za-z_][A-Za-z0-9_:$]*)\s*(?:OF\s+[^:]+)?\s*:\s*([A-Za-z_][A-Za-z0-9_:$]*(?:\[[^\]]+\])?)/i.exec(raw);
      if (header) {
        records.push({
          name: header[1],
          dataType: header[2],
          scope: buffer.program || "controller",
          program: buffer.program,
          line: buffer.startLine,
          endLine,
          raw
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

      if (/^TAG\b/i.test(trimmed) && !/^TAG\s*:/i.test(trimmed)) {
        finish(lineNumber - 1);
        inTags = true;
        continue;
      }
      if (/^END_TAG\b/i.test(trimmed)) {
        finish(lineNumber - 1);
        inTags = false;
        continue;
      }
      if (!inTags) continue;

      if (!buffer) {
        if (!/^\s*[A-Za-z_][A-Za-z0-9_:$]*\s*(?:OF\s+[^:]+)?\s*:\s*[A-Za-z_][A-Za-z0-9_:$]*(?:\[[^\]]+\])?/i.test(line)) continue;
        buffer = { program: currentProgram, startLine: lineNumber, lines: [line] };
      } else {
        buffer.lines.push(line);
      }
      if (statementHasTerminator(buffer.lines.join("\n"))) finish(lineNumber);
    }
    finish(lines.length);
    return records;
  }

  function classifyTag(record) {
    const attributes = {};
    for (const name of [...PRODUCED_ATTRIBUTES, ...CONSUMED_ATTRIBUTES, ...SHARED_COMM_ATTRIBUTES]) {
      const value = attributeValue(record.raw, name);
      if (value !== null) attributes[name] = value;
    }

    const producedSignals = PRODUCED_ATTRIBUTES.filter((name) => attributes[name] !== undefined);
    const consumedSignals = CONSUMED_ATTRIBUTES.filter((name) => attributes[name] !== undefined);
    const mixed = producedSignals.length > 0 && consumedSignals.length > 0;
    let role = null;
    if (consumedSignals.length) role = "consumed";
    else if (producedSignals.length) role = "produced";
    if (!role) return null;

    return {
      ...record,
      role,
      mixedRoleAttributes: mixed,
      attributes,
      produced: role === "produced" ? {
        produceCount: attributes.ProduceCount ?? null,
        minimumRPI: attributes.MinimumRPI ?? null,
        maximumRPI: attributes.MaximumRPI ?? null,
        defaultRPI: attributes.DefaultRPI ?? null,
        plcMappingFile: attributes.PLCMappingFile ?? null,
        plc2Mapping: attributes.PLC2Mapping ?? null,
        unicastPermitted: attributes.UnicastPermitted ?? null,
        programmaticallySendEventTrigger: attributes.ProgrammaticallySendEventTrigger ?? null,
        includeConnectionStatus: attributes.IncludeConnectionStatus ?? null
      } : null,
      consumed: role === "consumed" ? {
        producer: attributes.Producer ?? null,
        remoteTag: attributes.RemoteTag ?? null,
        remoteFile: attributes.RemoteFile ?? null,
        rpi: attributes.RPI ?? null,
        programmaticallySendEventTrigger: attributes.ProgrammaticallySendEventTrigger ?? null,
        includeConnectionStatus: attributes.IncludeConnectionStatus ?? null,
        timeoutMultiplier: attributes.TimeoutMultiplier ?? null,
        networkDelayMultiplier: attributes.NetworkDelayMultiplier ?? null,
        reactionTimeLimit: attributes.ReactionTimeLimit ?? null,
        maxObservedNetworkDelay: attributes.MaxObservedNetworkDelay ?? null,
        unicast: attributes.Unicast ?? null
      } : null
    };
  }

  function parseCommunicationTags(input) {
    return parseTagStatements(input).map(classifyTag).filter(Boolean);
  }

  function buildTopology(project, tags) {
    const moduleNames = new Set((project.modules || []).map((module) => module.name));
    const consumed = tags.filter((tag) => tag.role === "consumed");
    const produced = tags.filter((tag) => tag.role === "produced");
    const inbound = consumed.map((tag) => ({
      direction: "inbound",
      localTag: tag.name,
      scope: tag.scope,
      producer: tag.consumed.producer,
      remoteTag: tag.consumed.remoteTag,
      remoteFile: tag.consumed.remoteFile,
      rpi: tag.consumed.rpi,
      producerModulePresent: tag.consumed.producer ? moduleNames.has(tag.consumed.producer) : false,
      line: tag.line
    }));
    const outbound = produced.map((tag) => ({
      direction: "outbound",
      localTag: tag.name,
      scope: tag.scope,
      produceCount: tag.produced.produceCount,
      minimumRPI: tag.produced.minimumRPI,
      maximumRPI: tag.produced.maximumRPI,
      defaultRPI: tag.produced.defaultRPI,
      actualConsumersProven: false,
      line: tag.line
    }));
    return { consumed, produced, inbound, outbound };
  }

  function buildFindings(project, topology) {
    const findings = [];
    const add = (id, classification, severity, title, summary, evidence = {}) => findings.push({
      id, classification, severity, title, summary, evidence, sourceRule: "plc-communication-v8"
    });

    for (const tag of topology.consumed) {
      const info = tag.consumed;
      add(
        `v8:consumed-tag:${tag.scope}:${tag.name}`,
        "source-proven",
        "info",
        `Consumed tag: ${tag.name}`,
        `${tag.name} is configured in the supplied export as a consumed tag${info.producer ? ` from producer ${info.producer}` : ""}${info.remoteTag ? ` / remote tag ${info.remoteTag}` : info.remoteFile ? ` / remote file ${info.remoteFile}` : ""}${info.rpi ? ` at source RPI ${info.rpi} ms` : ""}. This proves configured source metadata only, not that the producer is online or data is arriving.`,
        { tag }
      );
      if (!info.producer || !info.rpi || (!info.remoteTag && !info.remoteFile)) {
        add(
          `v8:consumed-required-attributes:${tag.scope}:${tag.name}`,
          "source-proven",
          "review",
          `Consumed tag has incomplete source mapping: ${tag.name}`,
          `${tag.name} is classified from consumed-tag attributes, but the supplied tag statement does not contain the complete Producer + RPI + RemoteTag/RemoteFile mapping expected by the L5K consumed-tag model. Verify project revision/export completeness before treating this as a controller defect.`,
          { tag }
        );
      }
      if (info.rpi !== null && numeric(info.rpi) !== null && numeric(info.rpi) <= 0) {
        add(
          `v8:consumed-rpi-nonpositive:${tag.scope}:${tag.name}`,
          "source-proven",
          "review",
          `Consumed tag has non-positive source RPI: ${tag.name}`,
          `${tag.name} contains RPI := ${info.rpi}. Preserve the exact value as source evidence and verify the intended project; this analyzer does not recommend an RPI replacement value.`,
          { tag }
        );
      }
      if (info.producer && !topology.inbound.find((edge) => edge.localTag === tag.name && edge.scope === tag.scope)?.producerModulePresent) {
        add(
          `v8:producer-module-unresolved:${tag.scope}:${tag.name}`,
          "static-inference",
          "info",
          `Producer module not resolved in supplied export: ${tag.name}`,
          `${tag.name} names producer ${info.producer}, but no MODULE with that exact name was recognized in the supplied export. The I/O configuration may be incomplete, revision-specific, or represented differently; this does not prove a network fault.`,
          { tag, producer: info.producer }
        );
      }
    }

    for (const tag of topology.produced) {
      const info = tag.produced;
      add(
        `v8:produced-tag:${tag.scope}:${tag.name}`,
        "source-proven",
        "info",
        `Produced tag: ${tag.name}`,
        `${tag.name} is configured in the supplied export as a produced tag${info.produceCount ? ` with ProduceCount ${info.produceCount}` : ""}. ProduceCount and RPI bounds are configuration capacity/limits; they do not identify actual connected consumers or prove network health.`,
        { tag }
      );
      if (info.produceCount !== null && numeric(info.produceCount) !== null && numeric(info.produceCount) <= 0) {
        add(
          `v8:produce-count-nonpositive:${tag.scope}:${tag.name}`,
          "source-proven",
          "review",
          `Produced tag has non-positive ProduceCount: ${tag.name}`,
          `${tag.name} contains ProduceCount := ${info.produceCount}. Preserve the exact source value for revision review; the analyzer does not recommend a replacement consumer count.`,
          { tag }
        );
      }
      const min = numeric(info.minimumRPI);
      const max = numeric(info.maximumRPI);
      const def = numeric(info.defaultRPI);
      if (min !== null && max !== null && min > max) {
        add(
          `v8:produced-rpi-range:${tag.scope}:${tag.name}`,
          "source-proven",
          "review",
          `Produced tag RPI range is inverted: ${tag.name}`,
          `${tag.name} contains MinimumRPI := ${info.minimumRPI} and MaximumRPI := ${info.maximumRPI}. This is a source/configuration review item only; do not change values without the approved machine/project basis.`,
          { tag }
        );
      }
      if (def !== null && min !== null && max !== null && (def < min || def > max)) {
        add(
          `v8:produced-default-rpi-outside-range:${tag.scope}:${tag.name}`,
          "source-proven",
          "review",
          `Produced tag DefaultRPI is outside its source range: ${tag.name}`,
          `${tag.name} contains DefaultRPI := ${info.defaultRPI} outside the source-visible MinimumRPI/MaximumRPI range. Verify the intended export/revision; the analyzer does not recommend a replacement RPI.`,
          { tag }
        );
      }
    }

    for (const tag of [...topology.consumed, ...topology.produced].filter((item) => item.mixedRoleAttributes)) {
      add(
        `v8:mixed-communication-attributes:${tag.scope}:${tag.name}`,
        "source-proven",
        "review",
        `Tag contains both produced and consumed attribute families: ${tag.name}`,
        `${tag.name} contains source attributes from both produced and consumed tag families. Verify the exact export and Logix revision before assigning a communication role or making project changes.`,
        { tag }
      );
    }
    return findings;
  }

  function enrichProject(project, input) {
    const tags = parseCommunicationTags(input);
    const topology = buildTopology(project, tags);
    const findings = buildFindings(project, topology);
    const existing = new Set((project.findings || []).map((item) => item.id));
    project.findings = [...(project.findings || []), ...findings.filter((item) => !existing.has(item.id))];
    project.dependencies = {
      ...(project.dependencies || {}),
      communicationTopology: {
        version: "v8",
        evidenceClass: "static-produced-consumed-topology",
        sourceBoundary: "Produced/consumed tag attributes prove only the communication configuration represented in the supplied export. They do not prove peer availability, packet delivery, current connection status, network path health, actual consumer count, or that an RPI/configuration value is correct for the machine.",
        tags,
        produced: topology.produced,
        consumed: topology.consumed,
        inbound: topology.inbound,
        outbound: topology.outbound,
        findings,
        statistics: {
          communicationTags: tags.length,
          producedTags: topology.produced.length,
          consumedTags: topology.consumed.length,
          inboundMappings: topology.inbound.length,
          outboundMappings: topology.outbound.length,
          findings: findings.length
        }
      }
    };
    project.statistics = {
      ...(project.statistics || {}),
      communicationTags: tags.length,
      producedTags: topology.produced.length,
      consumedTags: topology.consumed.length,
      communicationFindings: findings.length,
      findings: project.findings.length
    };
    return project;
  }

  function parseL5K(input, options = {}) {
    const text = normalize(input);
    return enrichProject(baseParseL5K(text, options), text);
  }

  function traceTarget(project, target, options = {}) {
    if (typeof baseTraceTarget !== "function") throw new Error("Dependency trace support is unavailable.");
    const trace = baseTraceTarget(project, target, options);
    const topology = project?.dependencies?.communicationTopology;
    if (!topology) return trace;
    const roots = new Set((trace.nodes || []).map((node) => rootSymbol(node.symbol)));
    for (const writer of trace.writers || []) {
      for (const symbol of writer.symbols || []) roots.add(rootSymbol(symbol));
    }
    const contexts = (topology.tags || []).filter((tag) => roots.has(tag.name)).map((tag) => ({
      tag: tag.name,
      scope: tag.scope,
      role: tag.role,
      produced: tag.produced,
      consumed: tag.consumed,
      line: tag.line,
      runtimeConnectionProven: false
    }));
    return {
      ...trace,
      communicationContexts: contexts,
      communicationStateProven: false,
      note: `${trace.note} Produced/consumed tag context is static export evidence and does not prove peer availability, packet delivery, or current connection status.`
    };
  }

  function searchAnalysis(project, query, limit = 50) {
    const baseResults = typeof baseSearchAnalysis === "function" ? baseSearchAnalysis(project, query, limit) : [];
    const raw = String(query || "").trim();
    if (!raw) return baseResults;
    const normalized = raw.toLowerCase();
    const terms = normalized.split(/\s+/).filter(Boolean);
    const records = (project?.dependencies?.communicationTopology?.tags || []).map((tag) => ({
      type: "communication-tag",
      key: `${tag.scope}/${tag.name}`,
      title: `${tag.role} ${tag.name}`,
      text: JSON.stringify(tag),
      value: tag
    })).map((record) => {
      const key = record.key.toLowerCase();
      const title = record.title.toLowerCase();
      const text = record.text.toLowerCase();
      let score = 0;
      if (key === normalized || title === normalized) score += 900;
      if (key.includes(normalized)) score += 300;
      if (title.includes(normalized)) score += 250;
      if (text.includes(normalized)) score += 150;
      for (const term of terms) if (term.length > 1 && text.includes(term)) score += 10;
      return { ...record, score };
    }).filter((record) => record.score > 0);
    const merged = [...baseResults, ...records].sort((a, b) => b.score - a.score || a.type.localeCompare(b.type) || a.title.localeCompare(b.title));
    const seen = new Set();
    return merged.filter((item) => {
      const key = `${item.type}:${item.key}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, Math.max(1, Number(limit) || 50));
  }

  return Object.freeze({
    ...base,
    parseL5K,
    traceTarget,
    searchAnalysis,
    buildCommunicationFindings: buildFindings,
    communicationTopology: Object.freeze({
      version: "v8",
      parseTagStatements,
      parseCommunicationTags,
      producedAttributes: PRODUCED_ATTRIBUTES,
      consumedAttributes: CONSUMED_ATTRIBUTES,
      sharedAttributes: SHARED_COMM_ATTRIBUTES
    })
  });
});
