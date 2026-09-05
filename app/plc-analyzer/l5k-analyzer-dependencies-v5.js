"use strict";

(function installDependencyAnalyzer(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-legacy-v4.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDependencyAnalyzer(base) {
  if (!base || typeof base.parseL5K !== "function") throw new Error("ServoForge L5K analyzer core is required before dependency analysis.");

  const baseParseL5K = base.parseL5K;
  const WRITE_DESTINATION = Object.freeze({
    OTE: 0,
    OTL: 0,
    MOV: 1,
    COP: 1,
    CPS: 1,
    ADD: 2,
    SUB: 2,
    MUL: 2,
    DIV: 2,
    CPT: 0
  });

  function normalize(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
  }

  function unquote(value) {
    const text = String(value || "").trim();
    return text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1).replace(/""/g, '"') : text;
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
        if (quoted && source[index + 1] === '"') {
          current += '"';
          index += 1;
          continue;
        }
        quoted = !quoted;
        current += char;
        continue;
      }
      if (!quoted) {
        if (char === "(") depth += 1;
        else if (char === ")") depth = Math.max(0, depth - 1);
        else if (char === "," && depth === 0) {
          args.push(current.trim());
          current = "";
          continue;
        }
      }
      current += char;
    }
    if (current.trim() || source.endsWith(",")) args.push(current.trim());
    return args;
  }

  function findCalls(source, name) {
    const calls = [];
    const text = String(source || "");
    const escaped = String(name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!escaped) return calls;
    const starter = new RegExp(`\\b${escaped}\\s*\\(`, "gi");
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
          quoted = !quoted;
          continue;
        }
        if (quoted) continue;
        if (char === "(") depth += 1;
        else if (char === ")") depth -= 1;
      }
      if (depth !== 0) continue;
      const body = text.slice(open + 1, end - 1);
      calls.push({ name, args: splitTopLevelArgs(body), raw: text.slice(match.index, end), index: match.index });
      starter.lastIndex = end;
    }
    return calls;
  }

  function parseDataTypes(text) {
    const lines = normalize(text).split("\n");
    const items = [];
    let current = null;
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmed = line.trim();
      const start = /^DATATYPE\s+("[^"]+"|[^\s(]+)/i.exec(trimmed);
      if (start) {
        current = { name: unquote(start[1]), line: lineNumber, members: [] };
        items.push(current);
        return;
      }
      if (/^END_DATATYPE\b/i.test(trimmed)) {
        current = null;
        return;
      }
      if (!current || !trimmed || /^\(/.test(trimmed)) return;
      const member = /^([A-Za-z_][A-Za-z0-9_:$]*(?:\[[^\]]+\])?)\s+([A-Za-z_][A-Za-z0-9_:$]*(?:\[[^\]]+\])?)\b/.exec(trimmed);
      if (!member) return;
      current.members.push({ dataType: member[1], name: member[2], line: lineNumber, raw: trimmed });
    });
    return items;
  }

  function parseScopedTags(text) {
    const lines = normalize(text).split("\n");
    const tags = [];
    let currentProgram = null;
    let inTags = false;
    let inDataType = false;
    let inAOI = false;
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmed = line.trim();
      if (/^DATATYPE\b/i.test(trimmed)) { inDataType = true; return; }
      if (/^END_DATATYPE\b/i.test(trimmed)) { inDataType = false; return; }
      if (/^ADD_ON_INSTRUCTION_DEFINITION\b/i.test(trimmed)) { inAOI = true; return; }
      if (/^END_ADD_ON_INSTRUCTION_DEFINITION\b/i.test(trimmed)) { inAOI = false; return; }
      if (inDataType || inAOI) return;
      const program = /^PROGRAM\s+("[^"]+"|[^\s(]+)/i.exec(trimmed);
      if (program) currentProgram = unquote(program[1]);
      if (/^END_PROGRAM\b/i.test(trimmed)) currentProgram = null;
      if (/^TAG\b/i.test(trimmed) && !/^TAG\s*:/i.test(trimmed)) { inTags = true; return; }
      if (/^END_TAG\b/i.test(trimmed)) { inTags = false; return; }
      if (!inTags) return;
      const tag = /^([A-Za-z_][A-Za-z0-9_:$]*)\s*:\s*([A-Za-z_][A-Za-z0-9_:$]*(?:\[[^\]]+\])?)/.exec(trimmed);
      if (!tag) return;
      tags.push({ name: tag[1], dataType: tag[2], scope: currentProgram || "controller", program: currentProgram, line: lineNumber, raw: trimmed });
    });
    return tags;
  }

  function parseProgramMains(text) {
    const lines = normalize(text).split("\n");
    const programs = [];
    for (let index = 0; index < lines.length; index += 1) {
      const match = /^\s*PROGRAM\s+("[^"]+"|[^\s(]+)/i.exec(lines[index]);
      if (!match) continue;
      const name = unquote(match[1]);
      let header = lines[index];
      let cursor = index + 1;
      while (cursor < lines.length && !/\)\s*$/.test(header) && cursor < index + 20) {
        header += `\n${lines[cursor]}`;
        if (/\)\s*$/.test(lines[cursor].trim())) break;
        cursor += 1;
      }
      const main = /\bMAIN\s*:=\s*("[^"]+"|[^,\)\r\n]+)/i.exec(header);
      programs.push({ program: name, mainRoutine: main ? unquote(main[1].trim()) : null, line: index + 1 });
    }
    return programs;
  }

  function parseAOIDefinitions(text) {
    const lines = normalize(text).split("\n");
    const definitions = [];
    let current = null;
    let section = null;
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmed = line.trim();
      const start = /^ADD_ON_INSTRUCTION_DEFINITION\s+("[^"]+"|[^\s(]+)/i.exec(trimmed);
      if (start) {
        current = { name: unquote(start[1]), line: lineNumber, parameters: [], localTags: [] };
        definitions.push(current);
        section = null;
        return;
      }
      if (!current) return;
      if (/^END_ADD_ON_INSTRUCTION_DEFINITION\b/i.test(trimmed)) { current = null; section = null; return; }
      if (/^(PARAMETERS|PARAMETER)\b/i.test(trimmed)) { section = "parameters"; return; }
      if (/^(LOCAL_TAGS|LOCAL_TAG)\b/i.test(trimmed)) { section = "localTags"; return; }
      if (/^END_(PARAMETERS|PARAMETER|LOCAL_TAGS|LOCAL_TAG)\b/i.test(trimmed)) { section = null; return; }
      if (!section) return;
      const colon = /^([A-Za-z_][A-Za-z0-9_:$]*)\s*:\s*([A-Za-z_][A-Za-z0-9_:$]*(?:\[[^\]]+\])?)(.*)$/.exec(trimmed);
      if (!colon) return;
      const usage = /\bUsage\s*:=\s*([A-Za-z]+)/i.exec(colon[3] || "");
      current[section].push({ name: colon[1], dataType: colon[2], usage: usage ? usage[1] : null, line: lineNumber, raw: trimmed });
    });
    return definitions;
  }

  function rootSymbol(value) {
    const text = String(value || "").trim();
    const root = text.split(".")[0];
    return root.replace(/\[[^\]]*\].*$/, "");
  }

  function cleanDataType(value) {
    return String(value || "").replace(/\[[^\]]+\]$/, "");
  }

  function tagLookup(scopedTags, symbol, program) {
    const root = rootSymbol(symbol);
    return scopedTags.find((tag) => tag.name === root && tag.program === program)
      || scopedTags.find((tag) => tag.name === root && tag.scope === "controller")
      || scopedTags.find((tag) => tag.name === root)
      || null;
  }

  function buildRoutineCalls(project) {
    const calls = [];
    for (const rung of project.rungs || []) {
      for (const call of findCalls(rung.source, "JSR")) {
        const callee = unquote(call.args[0] || "");
        if (!callee) continue;
        calls.push({
          program: rung.program || null,
          callerRoutine: rung.routine || null,
          calleeRoutine: callee,
          rung: rung.number,
          line: rung.startLine,
          args: call.args,
          source: call.raw
        });
      }
    }
    return calls;
  }

  function buildAOICalls(project, definitions) {
    const calls = [];
    for (const definition of definitions) {
      for (const rung of project.rungs || []) {
        for (const call of findCalls(rung.source, definition.name)) {
          calls.push({
            definition: definition.name,
            instanceTag: unquote(call.args[0] || "") || null,
            program: rung.program || null,
            routine: rung.routine || null,
            rung: rung.number,
            line: rung.startLine,
            args: call.args,
            source: call.raw
          });
        }
      }
    }
    return calls;
  }

  function buildWriteRelations(project, aoiDefinitions) {
    const relations = [];
    const aoiNames = new Set((aoiDefinitions || []).map((item) => item.name));
    for (const rung of project.rungs || []) {
      for (const call of rung.instructions || []) {
        if (!(call.name in WRITE_DESTINATION)) continue;
        const destinationIndex = WRITE_DESTINATION[call.name];
        const destination = String(call.args?.[destinationIndex] || "").trim();
        if (!destination) continue;
        const upstreamSymbols = [...new Set((rung.symbols || []).filter((symbol) => {
          if (!symbol || symbol === destination) return false;
          if (rootSymbol(symbol) === rootSymbol(destination) && symbol === destination) return false;
          if (aoiNames.has(symbol)) return false;
          return true;
        }))];
        relations.push({
          id: `${rung.program || "?"}/${rung.routine || "?"}/${rung.number}:${call.name}:${destination}`,
          destination,
          instruction: call.name,
          program: rung.program || null,
          routine: rung.routine || null,
          rung: rung.number,
          line: rung.startLine,
          upstreamSymbols,
          source: rung.source
        });
      }
    }
    return relations;
  }

  function describeSymbol(project, symbol, program) {
    const dependencies = project.dependencies || {};
    const scopedTags = dependencies.scopedTags || [];
    const dataTypes = dependencies.dataTypes || [];
    const aoiDefinitions = dependencies.aoiDefinitions || [];
    const tag = tagLookup(scopedTags, symbol, program);
    const root = rootSymbol(symbol);
    const memberPath = String(symbol || "").startsWith(`${root}.`) ? String(symbol).slice(root.length + 1) : null;
    const typeName = cleanDataType(tag?.dataType);
    const dataType = dataTypes.find((item) => item.name === typeName) || null;
    const memberName = memberPath ? memberPath.split(".")[0].replace(/\[[^\]]*\]$/, "") : null;
    const member = memberName && dataType ? dataType.members.find((item) => item.name.replace(/\[[^\]]*\]$/, "") === memberName) || null : null;
    const aoi = aoiDefinitions.find((item) => item.name === typeName) || null;
    const io = /\b(?:Local|Remote|Node\w*):\d+:[IO]\b/i.test(String(symbol || "")) || /:\d+:[IO](?:\.|$)/i.test(String(symbol || ""));
    const axis = /AXIS/i.test(typeName) || (project.axes || []).some((item) => item.name === root);
    let kind = "tag-or-external-symbol";
    if (io) kind = "direct-io";
    else if (aoi) kind = memberPath ? "aoi-member" : "aoi-instance";
    else if (axis) kind = memberPath ? "axis-member" : "axis";
    else if (dataType) kind = memberPath ? "udt-member" : "udt-instance";
    else if (tag) kind = "declared-tag";
    return {
      symbol,
      root,
      memberPath,
      kind,
      declared: Boolean(tag),
      scope: tag?.scope || null,
      dataType: tag?.dataType || null,
      memberDataType: member?.dataType || null,
      dataTypeDefinition: dataType?.name || null,
      aoiDefinition: aoi?.name || null,
      sourceLine: tag?.line || null
    };
  }

  function routineExecutionPaths(project, program, routine, maxDepth = 8) {
    const dependencies = project.dependencies || {};
    const calls = dependencies.routineCalls || [];
    const main = (dependencies.programMainRoutines || []).find((item) => item.program === program)?.mainRoutine || null;
    const results = [];
    const walk = (current, path, seen, depth) => {
      if (!current || depth > maxDepth) return;
      if (current === main) {
        results.push([{ routine: current, program, root: true }, ...path]);
        return;
      }
      const callers = calls.filter((call) => call.program === program && call.calleeRoutine === current);
      if (!callers.length) {
        results.push([{ routine: current, program, unlocatedCaller: true }, ...path]);
        return;
      }
      for (const caller of callers) {
        const key = `${caller.program || "?"}/${caller.callerRoutine || "?"}->${caller.calleeRoutine}`;
        if (seen.has(key)) {
          results.push([{ routine: caller.callerRoutine, program, cycle: true }, { routine: current, call: caller }, ...path]);
          continue;
        }
        const nextSeen = new Set(seen);
        nextSeen.add(key);
        walk(caller.callerRoutine, [{ routine: current, call: caller }, ...path], nextSeen, depth + 1);
      }
    };
    walk(routine, [], new Set(), 0);
    return results.slice(0, 20);
  }

  function traceTarget(project, target, options = {}) {
    if (!project) throw new Error("Parsed PLC project is required.");
    const rootTarget = String(target || "").trim();
    if (!rootTarget) throw new Error("A target tag/address is required.");
    const maxDepth = Math.max(1, Math.min(12, Number(options.maxDepth || 6)));
    const maxNodes = Math.max(20, Math.min(1000, Number(options.maxNodes || 250)));
    const relations = project.dependencies?.writeRelations || [];
    const byDestination = new Map();
    for (const relation of relations) {
      if (!byDestination.has(relation.destination)) byDestination.set(relation.destination, []);
      byDestination.get(relation.destination).push(relation);
    }
    const nodes = new Map();
    const edges = [];
    const writerEvidence = [];
    const executionPathMap = new Map();
    let truncated = false;

    const visit = (symbol, program, depth, path) => {
      if (nodes.size >= maxNodes) { truncated = true; return; }
      const key = `${program || "?"}|${symbol}`;
      const previous = nodes.get(key);
      if (!previous || depth < previous.depth) nodes.set(key, { ...describeSymbol(project, symbol, program), program: program || null, depth });
      if (depth >= maxDepth) return;
      const writers = byDestination.get(symbol) || [];
      for (const writer of writers) {
        writerEvidence.push(writer);
        const routineKey = `${writer.program || "?"}/${writer.routine || "?"}`;
        if (!executionPathMap.has(routineKey) && writer.routine) executionPathMap.set(routineKey, routineExecutionPaths(project, writer.program, writer.routine));
        for (const upstream of writer.upstreamSymbols || []) {
          if (!upstream || upstream === symbol) continue;
          const edgeKey = `${writer.id}|${upstream}|${symbol}`;
          if (!edges.some((edge) => edge.id === edgeKey)) {
            edges.push({ id: edgeKey, from: upstream, to: symbol, relation: "source-reference-on-writer-rung", writerId: writer.id, program: writer.program, routine: writer.routine, rung: writer.rung, line: writer.line });
          }
          if (path.has(upstream)) {
            const cycleNodeKey = `${writer.program || "?"}|${upstream}`;
            const existing = nodes.get(cycleNodeKey) || { ...describeSymbol(project, upstream, writer.program), program: writer.program || null, depth: depth + 1 };
            nodes.set(cycleNodeKey, { ...existing, cycle: true });
            continue;
          }
          const nextPath = new Set(path);
          nextPath.add(upstream);
          visit(upstream, writer.program, depth + 1, nextPath);
        }
      }
    };

    visit(rootTarget, options.program || null, 0, new Set([rootTarget]));

    const aoiContexts = [];
    for (const node of nodes.values()) {
      if (!node.aoiDefinition) continue;
      const calls = (project.dependencies?.aoiCalls || []).filter((call) => call.definition === node.aoiDefinition && call.instanceTag === node.root);
      aoiContexts.push({ symbol: node.symbol, instanceTag: node.root, definition: node.aoiDefinition, calls });
    }

    return {
      target: rootTarget,
      classification: "static-inference",
      runtimeStateProven: false,
      note: "This trace follows offline source relationships only. It does not prove live tag state, execution order within a scan beyond visible routine calls, physical wiring condition, or device health.",
      nodes: [...nodes.values()].sort((a, b) => a.depth - b.depth || String(a.symbol).localeCompare(String(b.symbol))),
      edges,
      writers: [...new Map(writerEvidence.map((item) => [item.id, item])).values()],
      executionPaths: [...executionPathMap.entries()].map(([routine, paths]) => ({ routine, paths })),
      aoiContexts,
      truncated,
      limits: { maxDepth, maxNodes }
    };
  }

  function enrichProject(project, text) {
    const dataTypes = parseDataTypes(text);
    const scopedTags = parseScopedTags(text);
    const programMainRoutines = parseProgramMains(text);
    const aoiDefinitions = parseAOIDefinitions(text);
    const routineCalls = buildRoutineCalls(project);
    const aoiCalls = buildAOICalls(project, aoiDefinitions);
    const writeRelations = buildWriteRelations(project, aoiDefinitions);
    project.dependencies = {
      version: "v5",
      evidenceClass: "static-source-relationships",
      dataTypes,
      scopedTags,
      programMainRoutines,
      routineCalls,
      aoiDefinitions,
      aoiCalls,
      writeRelations,
      statistics: {
        dataTypes: dataTypes.length,
        dataTypeMembers: dataTypes.reduce((sum, item) => sum + item.members.length, 0),
        scopedTags: scopedTags.length,
        programsWithMainRoutine: programMainRoutines.filter((item) => item.mainRoutine).length,
        routineCalls: routineCalls.length,
        aoiDefinitions: aoiDefinitions.length,
        aoiCalls: aoiCalls.length,
        writeRelations: writeRelations.length
      }
    };
    project.statistics = {
      ...(project.statistics || {}),
      dataTypes: dataTypes.length,
      routineCalls: routineCalls.length,
      aoiDefinitions: aoiDefinitions.length,
      aoiCalls: aoiCalls.length
    };
    return project;
  }

  function parseL5K(input, options = {}) {
    const text = normalize(input);
    const project = baseParseL5K(text, options);
    return enrichProject(project, text);
  }

  return Object.freeze({
    ...base,
    parseL5K,
    traceTarget,
    describeDependencySymbol: describeSymbol,
    dependencyAnalysis: Object.freeze({
      version: "v5",
      parseDataTypes,
      parseAOIDefinitions,
      parseProgramMains,
      parseScopedTags
    })
  });
});
