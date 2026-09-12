"use strict";

(function installL5XSourceAdapter(root, factory) {
  const analyzer = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-afi-v14.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(analyzer);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createL5XSourceAdapter(analyzer) {
  if (!analyzer || typeof analyzer.parseL5K !== "function") throw new Error("ServoForge PLC Analyzer source parser must load before L5X source intake v15.");

  const baseParseL5K = analyzer.parseL5K;
  const MESSAGE_ATTRIBUTES = Object.freeze([
    "MessageType", "RemoteElement", "RequestedLength", "ConnectedFlag", "ConnectionPath", "CommTypeCode",
    "ServiceCode", "ObjectType", "TargetObject", "AttributeNumber", "Channel", "SourceLink", "DestinationLink",
    "DestinationNode", "Rack", "Group", "Slot", "LocalIndex", "RemoteIndex", "LocalElement", "DestinationTag",
    "CacheConnections", "LargePacketUsage"
  ]);
  const PRODUCED_ATTRIBUTES = Object.freeze([
    "ProduceCount", "MinimumRPI", "MaximumRPI", "DefaultRPI", "PLCMappingFile", "PLC2Mapping", "UnicastPermitted",
    "ProgrammaticallySendEventTrigger", "IncludeConnectionStatus"
  ]);
  const CONSUMED_ATTRIBUTES = Object.freeze([
    "Producer", "RemoteTag", "RemoteFile", "RPI", "ProgrammaticallySendEventTrigger", "IncludeConnectionStatus",
    "TimeoutMultiplier", "NetworkDelayMultiplier", "ReactionTimeLimit", "MaxObservedNetworkDelay", "Unicast"
  ]);

  function normalize(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
  }

  function createLineLocator(text) {
    const starts = [0];
    for (let index = 0; index < text.length; index += 1) if (text[index] === "\n") starts.push(index + 1);
    return function lineAt(index) {
      const target = Math.max(0, Number(index) || 0);
      let low = 0;
      let high = starts.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (starts[mid] <= target) low = mid + 1;
        else high = mid;
      }
      return Math.max(1, low);
    };
  }

  function decodeXml(value) {
    return String(value || "")
      .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  function sourceText(value) {
    const text = String(value || "").trim();
    const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(text);
    return cdata ? cdata[1] : decodeXml(text);
  }

  function quoteL5K(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function parseAttributes(source) {
    const attributes = {};
    const matcher = /([A-Za-z_][A-Za-z0-9_:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
    let match;
    while ((match = matcher.exec(String(source || "")))) {
      const raw = match[2];
      attributes[match[1]] = decodeXml(raw.slice(1, -1));
    }
    return attributes;
  }

  function firstTag(text, name) {
    const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const selfClosing = new RegExp(`<${escaped}\\b([^>]*)\\/\\s*>`, "i").exec(text);
    const open = new RegExp(`<${escaped}\\b([^>]*)>`, "i").exec(text);
    const match = selfClosing && (!open || selfClosing.index <= open.index) ? selfClosing : open;
    return match ? { attributes: parseAttributes(match[1]), index: match.index, raw: match[0] } : null;
  }

  function elementBlocks(text, name) {
    const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`<${escaped}\\b([^>]*)\\/\\s*>|<${escaped}\\b([^>]*)>([\\s\\S]*?)<\\/${escaped}\\s*>`, "gi");
    const blocks = [];
    let match;
    while ((match = pattern.exec(text))) {
      blocks.push({
        attributes: parseAttributes(match[1] || match[2] || ""),
        body: match[3] || "",
        index: match.index,
        endIndex: pattern.lastIndex,
        raw: match[0],
        selfClosing: Boolean(match[1] !== undefined)
      });
    }
    return blocks;
  }

  function directChildSection(body, name) {
    const target = String(name || "").toLowerCase();
    const token = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?([A-Za-z_][A-Za-z0-9_.:-]*)\b[^>]*>/g;
    let depth = 0;
    let found = null;
    let match;
    while ((match = token.exec(body))) {
      const raw = match[0];
      if (/^<!--|^<!\[CDATA|^<\?/.test(raw)) continue;
      const tag = String(match[1] || "").toLowerCase();
      const closing = /^<\//.test(raw);
      const selfClosing = /\/\s*>$/.test(raw);
      if (!closing) {
        if (depth === 0 && tag === target) {
          if (selfClosing) return { body: "", index: token.lastIndex, startIndex: match.index, endIndex: token.lastIndex };
          found = { startIndex: match.index, contentStart: token.lastIndex };
        }
        if (!selfClosing) depth += 1;
        continue;
      }
      depth = Math.max(0, depth - 1);
      if (found && depth === 0 && tag === target) {
        return { body: body.slice(found.contentStart, match.index), index: found.contentStart, startIndex: found.startIndex, endIndex: token.lastIndex };
      }
    }
    return null;
  }

  function childAttributes(body, name) {
    return firstTag(body, name)?.attributes || {};
  }

  function dataValueMembers(body) {
    const values = {};
    const matcher = /<DataValueMember\b([^>]*)\/?\s*>/gi;
    let match;
    while ((match = matcher.exec(body))) {
      const attrs = parseAttributes(match[1]);
      if (attrs.Name && attrs.Value !== undefined) values[attrs.Name] = attrs.Value;
    }
    return values;
  }

  function detectSourceFormat(input, options = {}) {
    const fileName = String(options.fileName || "");
    if (/\.acd$/i.test(fileName)) return "ACD";
    const text = normalize(input).trimStart();
    if (/\.l5x$/i.test(fileName) || /<RSLogix5000Content\b/i.test(text.slice(0, 8192))) return "L5X";
    return "L5K";
  }

  function pushLine(output, lineMap, value, originalLine) {
    output.push(value);
    lineMap.push(Number(originalLine) || 1);
  }

  function attrsToL5K(attributes, names) {
    const parts = [];
    for (const name of names) {
      if (attributes[name] === undefined || attributes[name] === null || attributes[name] === "") continue;
      const value = String(attributes[name]);
      const rendered = /^(?:true|false|[+-]?(?:\d+(?:\.\d+)?|\.\d+))$/i.test(value) ? value : quoteL5K(value);
      parts.push(`${name} := ${rendered}`);
    }
    return parts;
  }

  function tagStatement(block) {
    const attrs = block.attributes || {};
    if (!attrs.Name) return null;
    const dataType = attrs.DataType || "DINT";
    const info = { ...attrs, ...childAttributes(block.body, "ProduceInfo"), ...childAttributes(block.body, "ConsumeInfo") };
    const decorated = dataValueMembers(block.body);
    for (const name of MESSAGE_ATTRIBUTES) if (decorated[name] !== undefined && info[name] === undefined) info[name] = decorated[name];
    const parts = [];
    if (attrs.AliasFor) parts.push(`Alias For := ${quoteL5K(attrs.AliasFor)}`);
    parts.push(...attrsToL5K(info, PRODUCED_ATTRIBUTES));
    parts.push(...attrsToL5K(info, CONSUMED_ATTRIBUTES));
    if (/^MESSAGE$/i.test(dataType)) parts.push(...attrsToL5K(info, MESSAGE_ATTRIBUTES));
    return `${attrs.Name} : ${dataType}${parts.length ? ` (${parts.join(", ")})` : ""};`;
  }

  function emitTags(section, absoluteOffset, lineAt, output, lineMap) {
    const tags = elementBlocks(section.body, "Tag");
    if (!tags.length) return 0;
    pushLine(output, lineMap, "TAG", lineAt(absoluteOffset + section.startIndex));
    for (const tag of tags) {
      const statement = tagStatement(tag);
      if (statement) pushLine(output, lineMap, `  ${statement}`, lineAt(absoluteOffset + section.index + tag.index));
    }
    pushLine(output, lineMap, "END_TAG", lineAt(absoluteOffset + section.endIndex));
    return tags.length;
  }

  function emitRoutine(block, absoluteOffset, lineAt, output, lineMap, unsupported) {
    const attrs = block.attributes || {};
    if (!attrs.Name) return;
    const type = String(attrs.Type || "RLL").toUpperCase();
    const routineLine = lineAt(absoluteOffset + block.index);
    if (type !== "RLL") {
      unsupported.push({ name: attrs.Name, type, line: routineLine, reason: "Only source-visible RLL rung text is normalized in v15." });
      return;
    }
    pushLine(output, lineMap, `ROUTINE ${quoteL5K(attrs.Name)} (Type := RLL)`, routineLine);
    const rll = directChildSection(block.body, "RLLContent");
    const rungSource = rll ? rll.body : block.body;
    const rungOffset = absoluteOffset + block.index + (rll?.index || 0);
    for (const rung of elementBlocks(rungSource, "Rung")) {
      const number = Number.isFinite(Number(rung.attributes.Number)) ? Number(rung.attributes.Number) : 0;
      const rungLine = lineAt(rungOffset + rung.index);
      const textMatch = /<Text\b[^>]*>([\s\S]*?)<\/Text\s*>/i.exec(rung.body);
      if (!textMatch) {
        unsupported.push({ name: `${attrs.Name}/rung ${number}`, type: "RLL", line: rungLine, reason: "Rung has no source-visible Text element." });
        continue;
      }
      const textLine = lineAt(rungOffset + rung.index + rung.body.indexOf(textMatch[0]));
      const ladder = sourceText(textMatch[1]).replace(/\s*\n\s*/g, " ").trim();
      pushLine(output, lineMap, `RUNG ${number}`, rungLine);
      pushLine(output, lineMap, `  N: ${ladder}`, textLine);
      pushLine(output, lineMap, "END_RUNG", lineAt(rungOffset + rung.endIndex));
    }
    pushLine(output, lineMap, "END_ROUTINE", lineAt(absoluteOffset + block.endIndex));
  }

  function emitPrograms(controllerBody, controllerOffset, lineAt, output, lineMap, unsupported) {
    const section = directChildSection(controllerBody, "Programs");
    if (!section) return { programs: 0, programTags: 0 };
    let programs = 0;
    let programTags = 0;
    for (const program of elementBlocks(section.body, "Program")) {
      const attrs = program.attributes || {};
      if (!attrs.Name) continue;
      programs += 1;
      const offset = controllerOffset + section.index + program.index;
      const main = attrs.MainRoutineName || attrs.Main || null;
      pushLine(output, lineMap, `PROGRAM ${quoteL5K(attrs.Name)}${main ? ` (MAIN := ${quoteL5K(main)})` : ""}`, lineAt(offset));
      const tags = directChildSection(program.body, "Tags");
      if (tags) programTags += emitTags(tags, offset, lineAt, output, lineMap);
      const routines = directChildSection(program.body, "Routines");
      if (routines) {
        const routineOffset = offset + routines.index;
        for (const routine of elementBlocks(routines.body, "Routine")) emitRoutine(routine, routineOffset, lineAt, output, lineMap, unsupported);
      }
      pushLine(output, lineMap, "END_PROGRAM", lineAt(controllerOffset + section.index + program.endIndex));
    }
    return { programs, programTags };
  }

  function emitModules(controllerBody, controllerOffset, lineAt, output, lineMap) {
    const section = directChildSection(controllerBody, "Modules");
    if (!section) return 0;
    let count = 0;
    for (const module of elementBlocks(section.body, "Module")) {
      const attrs = module.attributes || {};
      if (!attrs.Name) continue;
      count += 1;
      const offset = controllerOffset + section.index + module.index;
      const ports = elementBlocks(module.body, "Port");
      const addressedPort = ports.find((port) => port.attributes.Address && !/^\d+$/.test(String(port.attributes.Address))) || ports.find((port) => port.attributes.Address);
      const parts = [];
      const parent = attrs.ParentModule || attrs.Parent || null;
      const address = addressedPort?.attributes?.Address || attrs.Address || attrs.NodeAddress || null;
      if (parent) parts.push(`Parent := ${quoteL5K(parent)}`);
      if (attrs.Slot !== undefined && attrs.Slot !== "") parts.push(`Slot := ${attrs.Slot}`);
      if (address) parts.push(`NodeAddress := ${quoteL5K(address)}`);
      if (attrs.CatalogNumber) parts.push(`CatalogNumber := ${quoteL5K(attrs.CatalogNumber)}`);
      pushLine(output, lineMap, `MODULE ${quoteL5K(attrs.Name)}${parts.length ? ` (${parts.join(", ")})` : ""}`, lineAt(offset));
      pushLine(output, lineMap, "END_MODULE", lineAt(controllerOffset + section.index + module.endIndex));
    }
    return count;
  }

  function emitTasks(controllerBody, controllerOffset, lineAt, output, lineMap) {
    const section = directChildSection(controllerBody, "Tasks");
    if (!section) return 0;
    let count = 0;
    for (const task of elementBlocks(section.body, "Task")) {
      const attrs = task.attributes || {};
      if (!attrs.Name) continue;
      count += 1;
      const offset = controllerOffset + section.index + task.index;
      const header = attrsToL5K(attrs, ["Type", "Priority", "Rate", "Watchdog", "InhibitTask", "Class"]);
      pushLine(output, lineMap, `TASK ${quoteL5K(attrs.Name)}${header.length ? ` (${header.join(", ")})` : ""}`, lineAt(offset));
      const scheduled = directChildSection(task.body, "ScheduledPrograms");
      if (scheduled) {
        const scheduledOffset = offset + scheduled.index;
        for (const program of elementBlocks(scheduled.body, "ScheduledProgram")) {
          if (program.attributes.Name) pushLine(output, lineMap, `  ${quoteL5K(program.attributes.Name)};`, lineAt(scheduledOffset + program.index));
        }
      }
      pushLine(output, lineMap, "END_TASK", lineAt(controllerOffset + section.index + task.endIndex));
    }
    return count;
  }

  function emitDataTypes(controllerBody, controllerOffset, lineAt, output, lineMap) {
    const section = directChildSection(controllerBody, "DataTypes");
    if (!section) return 0;
    let count = 0;
    for (const dataType of elementBlocks(section.body, "DataType")) {
      if (!dataType.attributes.Name) continue;
      count += 1;
      const offset = controllerOffset + section.index + dataType.index;
      pushLine(output, lineMap, `DATATYPE ${quoteL5K(dataType.attributes.Name)}`, lineAt(offset));
      const members = directChildSection(dataType.body, "Members");
      if (members) {
        const memberOffset = offset + members.index;
        for (const member of elementBlocks(members.body, "Member")) {
          if (member.attributes.Name && member.attributes.DataType) pushLine(output, lineMap, `  ${member.attributes.DataType} ${member.attributes.Name}`, lineAt(memberOffset + member.index));
        }
      }
      pushLine(output, lineMap, "END_DATATYPE", lineAt(controllerOffset + section.index + dataType.endIndex));
    }
    return count;
  }

  function emitAoiDefinitions(controllerBody, controllerOffset, lineAt, output, lineMap) {
    const section = directChildSection(controllerBody, "AddOnInstructionDefinitions");
    if (!section) return 0;
    let count = 0;
    for (const aoi of elementBlocks(section.body, "AddOnInstructionDefinition")) {
      if (!aoi.attributes.Name) continue;
      count += 1;
      const offset = controllerOffset + section.index + aoi.index;
      pushLine(output, lineMap, `ADD_ON_INSTRUCTION_DEFINITION ${quoteL5K(aoi.attributes.Name)}`, lineAt(offset));
      const parameters = directChildSection(aoi.body, "Parameters");
      if (parameters) {
        pushLine(output, lineMap, "PARAMETERS", lineAt(offset + parameters.startIndex));
        const parameterOffset = offset + parameters.index;
        for (const parameter of elementBlocks(parameters.body, "Parameter")) {
          if (!parameter.attributes.Name || !parameter.attributes.DataType) continue;
          const usage = parameter.attributes.Usage ? ` (Usage := ${parameter.attributes.Usage})` : "";
          pushLine(output, lineMap, `  ${parameter.attributes.Name} : ${parameter.attributes.DataType}${usage};`, lineAt(parameterOffset + parameter.index));
        }
        pushLine(output, lineMap, "END_PARAMETERS", lineAt(offset + parameters.endIndex));
      }
      const locals = directChildSection(aoi.body, "LocalTags");
      if (locals) {
        pushLine(output, lineMap, "LOCAL_TAGS", lineAt(offset + locals.startIndex));
        const localOffset = offset + locals.index;
        for (const local of elementBlocks(locals.body, "LocalTag")) {
          if (local.attributes.Name && local.attributes.DataType) pushLine(output, lineMap, `  ${local.attributes.Name} : ${local.attributes.DataType};`, lineAt(localOffset + local.index));
        }
        pushLine(output, lineMap, "END_LOCAL_TAGS", lineAt(offset + locals.endIndex));
      }
      pushLine(output, lineMap, "END_ADD_ON_INSTRUCTION_DEFINITION", lineAt(controllerOffset + section.index + aoi.endIndex));
    }
    return count;
  }

  function normalizeL5XToL5K(input, options = {}) {
    const xml = normalize(input);
    if (!xml.trim()) throw new Error("L5X content is empty.");
    const rootMatch = /<RSLogix5000Content\b([^>]*)>/i.exec(xml);
    if (!rootMatch) throw new Error("L5X source does not contain an RSLogix5000Content root element.");
    const rootAttributes = parseAttributes(rootMatch[1]);
    const controllerMatch = /<Controller\b([^>]*)>([\s\S]*?)<\/Controller\s*>/i.exec(xml);
    if (!controllerMatch) throw new Error("L5X source does not contain a full Controller element. Export a full controller/project L5X rather than a component-only export.");
    const controllerAttributes = parseAttributes(controllerMatch[1]);
    const controllerName = controllerAttributes.Name || rootAttributes.TargetName || null;
    if (!controllerName) throw new Error("L5X controller identity could not be established from Controller Name or TargetName.");

    const lineAt = createLineLocator(xml);
    const controllerOffset = controllerMatch.index + controllerMatch[0].indexOf(controllerMatch[2]);
    const controllerBody = controllerMatch[2];
    const output = [];
    const lineMap = [null];
    const unsupported = [];
    if (rootAttributes.SoftwareRevision) pushLine(output, lineMap, `Studio 5000 L5K Export Version ${rootAttributes.SoftwareRevision}`, lineAt(rootMatch.index));
    pushLine(output, lineMap, `CONTROLLER ${quoteL5K(controllerName)}`, lineAt(controllerMatch.index));

    const controllerTags = directChildSection(controllerBody, "Tags");
    const controllerTagCount = controllerTags ? emitTags(controllerTags, controllerOffset, lineAt, output, lineMap) : 0;
    const dataTypes = emitDataTypes(controllerBody, controllerOffset, lineAt, output, lineMap);
    const aoiDefinitions = emitAoiDefinitions(controllerBody, controllerOffset, lineAt, output, lineMap);
    const modules = emitModules(controllerBody, controllerOffset, lineAt, output, lineMap);
    const tasks = emitTasks(controllerBody, controllerOffset, lineAt, output, lineMap);
    const programResult = emitPrograms(controllerBody, controllerOffset, lineAt, output, lineMap, unsupported);
    pushLine(output, lineMap, "END_CONTROLLER", lineAt(controllerMatch.index + controllerMatch[0].length - 1));

    return {
      text: output.join("\n"),
      lineMap,
      metadata: {
        schemaRevision: rootAttributes.SchemaRevision || null,
        softwareRevision: rootAttributes.SoftwareRevision || null,
        targetName: rootAttributes.TargetName || controllerName,
        targetType: rootAttributes.TargetType || null,
        exportDate: rootAttributes.ExportDate || null,
        containsContext: rootAttributes.ContainsContext || null,
        controllerName,
        originalLineCount: xml.split("\n").length,
        originalByteLength: options.byteLength || xml.length,
        unsupported,
        counts: {
          controllerTags: controllerTagCount,
          programTags: programResult.programTags,
          dataTypes,
          aoiDefinitions,
          modules,
          tasks,
          programs: programResult.programs
        }
      }
    };
  }

  function remapCoordinates(project, lineMap) {
    const seen = new Set();
    function visit(value) {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) return value.forEach(visit);
      for (const [key, child] of Object.entries(value)) {
        if (/^(?:line|startLine|endLine|taskLine)$/.test(key) && Number.isInteger(child) && lineMap[child]) value[key] = lineMap[child];
        else visit(child);
      }
    }
    visit(project);
    return project;
  }

  function parseL5X(input, options = {}) {
    const prepared = normalizeL5XToL5K(input, options);
    const project = baseParseL5K(prepared.text, { ...options, byteLength: prepared.text.length });
    remapCoordinates(project, prepared.lineMap);
    project.controller = prepared.metadata.controllerName || project.controller;
    project.exportVersion = prepared.metadata.softwareRevision || project.exportVersion;
    project.source = {
      ...(project.source || {}),
      fileName: options.fileName || project.source?.fileName || null,
      byteLength: prepared.metadata.originalByteLength,
      lineCount: prepared.metadata.originalLineCount,
      sourceFormat: "L5X",
      ladderEncoding: "l5x-rll-text",
      l5xAdapterVersion: "v15",
      schemaRevision: prepared.metadata.schemaRevision,
      softwareRevision: prepared.metadata.softwareRevision,
      targetName: prepared.metadata.targetName,
      targetType: prepared.metadata.targetType,
      exportDate: prepared.metadata.exportDate,
      containsContext: prepared.metadata.containsContext,
      unsupportedRoutineContent: prepared.metadata.unsupported,
      normalizationCounts: prepared.metadata.counts,
      sourceBoundary: "L5X v15 normalizes source-visible RLL, declaration, scheduling, communication, and MESSAGE metadata into the existing read-only analyzer model. Non-RLL routine content and source-protected or missing rung text are not interpreted. Static source evidence does not prove runtime state or authorize PLC changes."
    };
    project.statistics = { ...(project.statistics || {}), unsupportedL5XItems: prepared.metadata.unsupported.length };
    return project;
  }

  function parseControllerSource(input, options = {}) {
    const format = detectSourceFormat(input, options);
    if (format === "ACD") throw new Error("ACD is a binary project file and is not parsed by ServoForge. Export a readable full-project L5K or L5X source file from Studio 5000/RSLogix 5000.");
    if (format === "L5X") return parseL5X(input, options);
    const project = baseParseL5K(input, options);
    project.source = { ...(project.source || {}), sourceFormat: project.source?.sourceFormat || "L5K" };
    return project;
  }

  return Object.freeze({
    ...analyzer,
    version: "plc-analyzer-v15",
    sourceIntakeVersion: "v15",
    parseL5K: parseControllerSource,
    parseControllerSource,
    parseL5X,
    normalizeL5XToL5K,
    detectSourceFormat
  });
});
