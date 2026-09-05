"use strict";

(function installServoForgeL5KAnalyzer(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createServoForgeL5KAnalyzer() {
  const WRITE_INSTRUCTIONS = new Set(["OTE", "OTL"]);
  const RESET_INSTRUCTIONS = new Set(["OTU", "RES"]);
  const TIMER_INSTRUCTIONS = new Set(["TON", "TOF", "RTO"]);
  const COUNTER_INSTRUCTIONS = new Set(["CTU", "CTD"]);
  const MOTION_INSTRUCTIONS = new Set(["MSO", "MSF", "MAH", "MAR", "MAM", "MAS", "MAJ", "MAG", "MAPC", "MCD", "MCS"]);
  const COMPARISON_INSTRUCTIONS = new Set(["EQU", "NEQ", "LES", "LEQ", "GRT", "GEQ", "LIM"]);
  const KNOWN_INSTRUCTIONS = new Set([
    "XIC", "XIO", "OTE", "OTL", "OTU", "TON", "TOF", "RTO", "RES", "CTU", "CTD",
    "MOV", "COP", "CPS", "GSV", "SSV", "EQU", "NEQ", "LES", "LEQ", "GRT", "GEQ",
    "ADD", "SUB", "MUL", "DIV", "CPT", "LIM", "ONS", "OSR", "OSF", "JMP", "LBL",
    "MSO", "MSF", "MAH", "MAR", "MAM", "MAS", "MAJ", "MAG", "MAPC", "MCD", "MCS"
  ]);

  function normalizeText(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
  }

  function unquote(value) {
    const text = String(value || "").trim();
    if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1).replace(/""/g, '"');
    return text;
  }

  function splitTopLevelArgs(text) {
    const args = [];
    let current = "";
    let depth = 0;
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') {
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
    if (current.trim() || text.endsWith(",")) args.push(current.trim());
    return args;
  }

  function parseInstructionCalls(source) {
    const calls = [];
    const text = String(source || "");
    const starter = /\b([A-Za-z][A-Za-z0-9_]*)\s*\(/g;
    let match;
    while ((match = starter.exec(text))) {
      const name = match[1].toUpperCase();
      if (!KNOWN_INSTRUCTIONS.has(name)) continue;
      const open = text.indexOf("(", match.index + match[1].length);
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
      const raw = text.slice(match.index, end);
      const body = text.slice(open + 1, end - 1);
      calls.push({ name, args: splitTopLevelArgs(body), raw, index: match.index });
      starter.lastIndex = end;
    }
    return calls;
  }

  function extractIOReferences(text) {
    const matches = new Set();
    const patterns = [
      /\b(?:Local|Remote|Node\w*):\d+:[IO](?:\.[A-Za-z0-9_:[\].-]+)?/gi,
      /\b[A-Za-z_][A-Za-z0-9_]*:\d+:[IO](?:\.[A-Za-z0-9_:[\].-]+)?/g
    ];
    for (const pattern of patterns) {
      for (const match of String(text || "").matchAll(pattern)) matches.add(match[0]);
    }
    return [...matches];
  }

  function extractSymbols(text) {
    const symbols = new Set(extractIOReferences(text));
    const pattern = /\b[A-Za-z_][A-Za-z0-9_:$]*(?:\[[^\]\n]+\])?(?:\.(?:[A-Za-z_][A-Za-z0-9_]*|\d+)(?:\[[^\]\n]+\])?)*/g;
    for (const match of String(text || "").matchAll(pattern)) {
      const token = match[0];
      if (KNOWN_INSTRUCTIONS.has(token.toUpperCase())) continue;
      if (/^(TRUE|FALSE|AND|OR|NOT|N|RUNG)$/i.test(token)) continue;
      symbols.add(token);
    }
    return [...symbols];
  }

  function isFaultLike(target) {
    const text = String(target || "");
    return /(?:^|[._])(?:Fault|Faults|Alarm|Trip|Malfunction)/i.test(text) || /^Faults(?:_[A-Za-z0-9]+)?\[/i.test(text);
  }

  function numericValue(value) {
    const text = String(value || "").trim();
    return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text) ? Number(text) : null;
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function parseTagLine(line, lineNumber) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_:$]*)\s*:\s*([A-Za-z_][A-Za-z0-9_\[\]]*)\b(.*?);?\s*$/.exec(line);
    if (!match) return null;
    const name = match[1];
    const dataType = match[2];
    const tail = match[3] || "";
    const aliasMatch = /Alias\s*For\s*:=\s*"?([^",)]+)"?|AliasFor\s*:=\s*"?([^",)]+)"?/i.exec(tail);
    return {
      name,
      dataType,
      aliasFor: aliasMatch ? String(aliasMatch[1] || aliasMatch[2] || "").trim() : null,
      line: lineNumber,
      raw: line.trim()
    };
  }

  function buildRungRecord(current, endLine) {
    const source = current.lines.join("\n").trim();
    const calls = parseInstructionCalls(source);
    const symbols = extractSymbols(source);
    return {
      program: current.program || null,
      routine: current.routine || null,
      number: current.number,
      startLine: current.startLine,
      endLine,
      source,
      instructions: calls,
      symbols,
      ioReferences: extractIOReferences(source)
    };
  }

  function parseL5K(input, options = {}) {
    const text = normalizeText(input);
    if (!text.trim()) throw new Error("L5K content is empty.");
    const lines = text.split("\n");
    const project = {
      controller: null,
      exportVersion: null,
      programs: [],
      routines: [],
      rungs: [],
      tags: [],
      modules: [],
      axes: [],
      timers: [],
      counters: [],
      ioReferences: [],
      faultWriters: [],
      resetWriters: [],
      moduleStatusReads: [],
      motionReferences: [],
      findings: [],
      statistics: {},
      source: {
        fileName: options.fileName || null,
        byteLength: options.byteLength || text.length,
        lineCount: lines.length
      }
    };

    let currentProgram = null;
    let currentRoutine = null;
    let currentRung = null;
    let inTagBlock = false;
    let currentModule = null;

    const programNames = new Set();
    const routineKeys = new Set();
    const ioRefs = new Set();
    const motionRefs = new Set();

    function finishRung(endLine) {
      if (!currentRung) return;
      project.rungs.push(buildRungRecord(currentRung, endLine));
      currentRung = null;
    }

    function finishModule(endLine) {
      if (!currentModule) return;
      const raw = currentModule.lines.join("\n");
      const slot = /\bSlot\s*:=\s*(\d+)/i.exec(raw)?.[1] ?? null;
      const parent = /\bParent\s*:=\s*([^,\)\n]+)/i.exec(raw)?.[1]?.trim() ?? null;
      const address = /\b(?:NodeAddress|Address)\s*:=\s*([^,\)\n]+)/i.exec(raw)?.[1]?.trim() ?? null;
      const catalog = /\bCatalogNumber\s*:=\s*"([^"]+)"/i.exec(raw)?.[1] ?? null;
      project.modules.push({ name: currentModule.name, slot, parent, address, catalog, startLine: currentModule.startLine, endLine, raw: raw.trim() });
      currentModule = null;
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNumber = index + 1;
      const trimmed = line.trim();

      if (!project.controller) {
        const controllerMatch = /^CONTROLLER\s+("[^"]+"|[^\s(]+)/i.exec(trimmed);
        if (controllerMatch) project.controller = unquote(controllerMatch[1]);
      }
      if (!project.exportVersion) {
        const versionMatch = /(?:RSLogix|Studio\s*5000|L5K)\D{0,30}(\d+(?:\.\d+){1,3})/i.exec(line) || /\b(?:Major|Revision)\s*:=\s*(\d+)\s*,\s*(?:Minor\s*:=\s*)?(\d+)/i.exec(line);
        if (versionMatch) project.exportVersion = versionMatch[2] ? `${versionMatch[1]}.${versionMatch[2]}` : versionMatch[1];
      }

      const programMatch = /^PROGRAM\s+("[^"]+"|[^\s(]+)/i.exec(trimmed);
      if (programMatch) {
        finishRung(lineNumber - 1);
        currentProgram = unquote(programMatch[1]);
        if (!programNames.has(currentProgram)) {
          programNames.add(currentProgram);
          project.programs.push({ name: currentProgram, line: lineNumber });
        }
      } else if (/^END_PROGRAM\b/i.test(trimmed)) {
        finishRung(lineNumber - 1);
        currentRoutine = null;
        currentProgram = null;
      }

      const routineMatch = /^ROUTINE\s+("[^"]+"|[^\s(]+)/i.exec(trimmed);
      if (routineMatch) {
        finishRung(lineNumber - 1);
        currentRoutine = unquote(routineMatch[1]);
        const key = `${currentProgram || ""}/${currentRoutine}`;
        if (!routineKeys.has(key)) {
          routineKeys.add(key);
          project.routines.push({ name: currentRoutine, program: currentProgram, line: lineNumber });
        }
      } else if (/^END_ROUTINE\b/i.test(trimmed)) {
        finishRung(lineNumber - 1);
        currentRoutine = null;
      }

      const rungMatch = /^RUNG\s+(-?\d+)/i.exec(trimmed);
      if (rungMatch) {
        finishRung(lineNumber - 1);
        currentRung = { number: Number(rungMatch[1]), startLine: lineNumber, program: currentProgram, routine: currentRoutine, lines: [line] };
        continue;
      }
      if (currentRung) {
        currentRung.lines.push(line);
        if (/^END_RUNG\b/i.test(trimmed)) finishRung(lineNumber);
        continue;
      }

      if (/^TAG\b/i.test(trimmed) && !/^TAG\s*:/i.test(trimmed)) {
        inTagBlock = true;
        continue;
      }
      if (/^END_TAG\b/i.test(trimmed)) {
        inTagBlock = false;
        continue;
      }
      if (inTagBlock) {
        const tag = parseTagLine(line, lineNumber);
        if (tag) project.tags.push(tag);
      }

      const moduleMatch = /^MODULE\s+("[^"]+"|[^\s(]+)/i.exec(trimmed);
      if (moduleMatch) {
        finishModule(lineNumber - 1);
        currentModule = { name: unquote(moduleMatch[1]), startLine: lineNumber, lines: [line] };
        if (/END_MODULE/i.test(trimmed)) finishModule(lineNumber);
        continue;
      }
      if (currentModule) {
        currentModule.lines.push(line);
        if (/^END_MODULE\b/i.test(trimmed)) finishModule(lineNumber);
      }
    }
    finishRung(lines.length);
    finishModule(lines.length);

    // Some exports place rung bodies on N: lines without explicit RUNG wrappers. Retain them as source-search rungs.
    if (!project.rungs.length) {
      lines.forEach((line, index) => {
        if (/^\s*N\s*:/i.test(line) && /\b(?:XIC|XIO|OTE|OTL|TON|CTU|GSV)\s*\(/i.test(line)) {
          project.rungs.push(buildRungRecord({ number: index, startLine: index + 1, program: null, routine: null, lines: [line] }, index + 1));
        }
      });
    }

    const writerMap = new Map();
    const resetMap = new Map();
    const timerMap = new Map();
    const counterMap = new Map();
    const symbolReferenceCounts = new Map();
    const pseudoIncrements = new Map();
    const comparisons = new Map();

    function addMapList(map, key, value) {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(value);
    }

    function reference(symbol) {
      symbolReferenceCounts.set(symbol, (symbolReferenceCounts.get(symbol) || 0) + 1);
    }

    for (const rung of project.rungs) {
      rung.symbols.forEach(reference);
      rung.ioReferences.forEach((value) => ioRefs.add(value));
      for (const symbol of rung.symbols) if (/Axis(?:\.|$)/i.test(symbol)) motionRefs.add(symbol);

      for (const call of rung.instructions) {
        const target = String(call.args[0] || "").trim();
        if (WRITE_INSTRUCTIONS.has(call.name) && target) {
          const record = { target, instruction: call.name, program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: rung.source, symbols: rung.symbols };
          addMapList(writerMap, target, record);
        }
        if (RESET_INSTRUCTIONS.has(call.name) && target) {
          const record = { target, instruction: call.name, program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: rung.source };
          addMapList(resetMap, target, record);
        }
        if (TIMER_INSTRUCTIONS.has(call.name) && target) {
          if (!timerMap.has(target)) timerMap.set(target, { tag: target, instructions: [], presetEvidence: [], references: [] });
          const timer = timerMap.get(target);
          timer.instructions.push({ type: call.name, program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, args: call.args, source: rung.source });
          const inlinePreset = numericValue(call.args[1]);
          if (inlinePreset !== null) timer.presetEvidence.push({ value: inlinePreset, kind: "instruction-argument", line: rung.startLine, source: call.raw });
        }
        if (COUNTER_INSTRUCTIONS.has(call.name) && target) {
          if (!counterMap.has(target)) counterMap.set(target, { tag: target, instructions: [], presetEvidence: [], resets: [] });
          const counter = counterMap.get(target);
          counter.instructions.push({ type: call.name, program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, args: call.args, source: rung.source });
          const inlinePreset = numericValue(call.args[1]);
          if (inlinePreset !== null) counter.presetEvidence.push({ value: inlinePreset, kind: "instruction-argument", line: rung.startLine, source: call.raw });
        }
        if (call.name === "MOV" && call.args.length >= 2) {
          const source = call.args[0];
          const destination = call.args[1];
          const presetMatch = /^(.+)\.PRE$/i.exec(destination || "");
          const presetValue = numericValue(source);
          if (presetMatch && presetValue !== null) {
            const tag = presetMatch[1];
            if (!timerMap.has(tag)) timerMap.set(tag, { tag, instructions: [], presetEvidence: [], references: [] });
            timerMap.get(tag).presetEvidence.push({ value: presetValue, kind: "MOV-to-PRE", line: rung.startLine, source: call.raw });
          }
        }
        if (call.name === "GSV" && String(call.args[0] || "").replaceAll('"', "").toUpperCase() === "MODULE") {
          project.moduleStatusReads.push({
            class: unquote(call.args[0]),
            instance: unquote(call.args[1]),
            attribute: unquote(call.args[2]),
            destination: call.args[3] || null,
            program: rung.program,
            routine: rung.routine,
            rung: rung.number,
            line: rung.startLine,
            source: call.raw
          });
        }
        if (MOTION_INSTRUCTIONS.has(call.name)) {
          project.motionReferences.push({ instruction: call.name, axis: call.args[0] || null, program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: call.raw });
          if (call.args[0]) motionRefs.add(call.args[0]);
        }
        if (call.name === "ADD" && call.args.length >= 3) {
          const [a, b, dest] = call.args.map((value) => String(value || "").trim());
          const incrementsSelf = dest && (dest === a || dest === b) && (numericValue(a) === 1 || numericValue(b) === 1);
          if (incrementsSelf) addMapList(pseudoIncrements, dest, { program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: call.raw });
        }
        if (COMPARISON_INSTRUCTIONS.has(call.name)) {
          for (const arg of call.args) {
            const symbol = String(arg || "").trim();
            if (/^[A-Za-z_][A-Za-z0-9_.$:\[\]]*$/.test(symbol)) addMapList(comparisons, symbol, { instruction: call.name, args: call.args, program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: call.raw });
          }
        }
      }

      for (const timer of timerMap.values()) {
        if (rung.symbols.some((symbol) => symbol === timer.tag || symbol.startsWith(`${timer.tag}.`))) {
          timer.references.push({ program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: rung.source });
        }
      }
    }

    for (const [target, resets] of resetMap) {
      if (counterMap.has(target)) counterMap.get(target).resets.push(...resets);
    }

    for (const tag of project.tags) {
      if (/^TIMER$/i.test(tag.dataType) && !timerMap.has(tag.name)) timerMap.set(tag.name, { tag: tag.name, instructions: [], presetEvidence: [], references: [] });
      if (/^COUNTER$/i.test(tag.dataType) && !counterMap.has(tag.name)) counterMap.set(tag.name, { tag: tag.name, instructions: [], presetEvidence: [], resets: [] });
      if (/AXIS/i.test(tag.dataType) || /Axis$/i.test(tag.name)) project.axes.push({ name: tag.name, dataType: tag.dataType, line: tag.line, raw: tag.raw });
      if (tag.aliasFor) extractIOReferences(tag.aliasFor).forEach((value) => ioRefs.add(value));
    }

    project.faultWriters = [...writerMap.entries()]
      .filter(([target]) => isFaultLike(target))
      .map(([target, writers]) => ({ target, writers, resets: resetMap.get(target) || [], writerCount: writers.length }));
    project.resetWriters = [...resetMap.entries()].map(([target, resets]) => ({ target, resets }));
    project.timers = [...timerMap.values()].map((timer) => ({ ...timer, presetValues: unique(timer.presetEvidence.map((item) => item.value)) }));
    project.counters = [...counterMap.values()].map((counter) => ({ ...counter, presetValues: unique(counter.presetEvidence.map((item) => item.value)) }));
    project.ioReferences = [...ioRefs].sort();
    project.axes = unique(project.axes.map((axis) => JSON.stringify(axis))).map((axis) => JSON.parse(axis));
    project.motionReferences = unique(project.motionReferences.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item));

    const motionStatusSymbols = [...motionRefs].filter((symbol) => /Axis\./i.test(symbol));
    for (const symbol of motionStatusSymbols) project.motionReferences.push({ instruction: "STATUS", axis: symbol.split(".")[0], member: symbol.slice(symbol.indexOf(".") + 1), source: symbol });

    const findings = [];
    const finding = (id, classification, severity, title, summary, evidence = {}) => findings.push({ id, classification, severity, title, summary, evidence });

    for (const item of project.faultWriters) {
      if (item.writerCount > 1) {
        finding(`multiple-writers:${item.target}`, "source-proven", "review", `Multiple writers for ${item.target}`, `${item.target} has ${item.writerCount} OTE/OTL writers in the supplied export. Confirm whether the writers are intentionally mutually exclusive before treating this as a discrepancy.`, { target: item.target, writers: item.writers });
      }
      const hasLatchedWriter = item.writers.some((writer) => writer.instruction === "OTL");
      if (hasLatchedWriter && item.resets.length === 0) {
        finding(`latched-no-otu:${item.target}`, "static-inference", "review", `No OTU located for latched ${item.target}`, `An OTL writer was found for ${item.target}, but no OTU targeting the same address was located. Another reset mechanism may exist; verify before calling this a defect.`, { target: item.target, writers: item.writers });
      }
      if (item.writers.some((writer) => /\bLogic_[01]\b/.test(writer.source))) {
        finding(`constant-driver:${item.target}`, "source-proven", "info", `Constant/disabled logic drives ${item.target}`, `${item.target} is written on a rung containing Logic_0 or Logic_1. Preserve this as source evidence; on known Cart revisions this can represent an inactive alarm position.`, { target: item.target, writers: item.writers });
      }
    }

    for (const timer of project.timers) {
      if (timer.presetValues.length > 1) {
        finding(`timer-multiple-presets:${timer.tag}`, "source-proven", "review", `Multiple preset values for ${timer.tag}`, `${timer.tag} has more than one source-proven numeric preset assignment (${timer.presetValues.join(", ")}). This may be intentional state-dependent logic; review the producing rungs.`, { timer });
      }
    }

    for (const [tag, increments] of pseudoIncrements) {
      if (!/(?:time|timer|delay|count|timeout)/i.test(tag)) continue;
      const compares = comparisons.get(tag) || [];
      finding(`scan-counter:${tag}`, "static-inference", "caution", `Potential PLC-cycle counter: ${tag}`, `${tag} is incremented by 1 in logic${compares.length ? " and compared against a threshold" : ""}. Do not interpret its numeric value as milliseconds without scan-time/runtime evidence.`, { tag, increments, comparisons: compares });
    }

    for (const read of project.moduleStatusReads) {
      if (!read.destination) continue;
      if ((symbolReferenceCounts.get(read.destination) || 0) <= 1) {
        finding(`gsv-unconsumed:${read.destination}`, "static-inference", "info", `GSV destination has limited downstream use`, `${read.destination} is populated by a MODULE GSV and was not found in additional rung symbol references. Verify whether the value is consumed indirectly or by a copied structure.`, { read });
      }
    }

    const aliasNames = new Set(project.tags.filter((tag) => tag.aliasFor).map((tag) => tag.name));
    for (const tag of project.tags.filter((item) => item.aliasFor)) {
      if (!tag.aliasFor) continue;
      finding(`alias:${tag.name}`, "source-proven", "info", `${tag.name} aliases ${tag.aliasFor}`, `Alias relationship found in the supplied export. Electrical connector/pin mapping is not inferred from the L5K alone.`, { tag });
    }

    project.findings = findings;
    project.statistics = {
      programs: project.programs.length,
      routines: project.routines.length,
      rungs: project.rungs.length,
      tags: project.tags.length,
      modules: project.modules.length,
      axes: project.axes.length,
      timers: project.timers.length,
      counters: project.counters.length,
      faultTargets: project.faultWriters.length,
      moduleStatusReads: project.moduleStatusReads.length,
      ioReferences: project.ioReferences.length,
      findings: project.findings.length,
      aliases: aliasNames.size
    };

    return project;
  }

  function searchableRecords(project) {
    const records = [];
    for (const fault of project.faultWriters || []) records.push({ type: "fault", key: fault.target, title: fault.target, text: JSON.stringify(fault), value: fault });
    for (const timer of project.timers || []) records.push({ type: "timer", key: timer.tag, title: timer.tag, text: JSON.stringify(timer), value: timer });
    for (const counter of project.counters || []) records.push({ type: "counter", key: counter.tag, title: counter.tag, text: JSON.stringify(counter), value: counter });
    for (const module of project.modules || []) records.push({ type: "module", key: module.name, title: module.name, text: JSON.stringify(module), value: module });
    for (const axis of project.axes || []) records.push({ type: "axis", key: axis.name, title: axis.name, text: JSON.stringify(axis), value: axis });
    for (const read of project.moduleStatusReads || []) records.push({ type: "module-status", key: read.destination || read.instance || "GSV", title: `${read.instance || "MODULE"} ${read.attribute || "GSV"}`, text: JSON.stringify(read), value: read });
    for (const finding of project.findings || []) records.push({ type: "finding", key: finding.id, title: finding.title, text: JSON.stringify(finding), value: finding });
    for (const rung of project.rungs || []) records.push({ type: "rung", key: `${rung.program || ""}/${rung.routine || ""}/${rung.number}`, title: `${rung.routine || "Routine"} rung ${rung.number}`, text: rung.source, value: rung });
    return records;
  }

  function searchAnalysis(project, query, limit = 50) {
    const raw = String(query || "").trim();
    if (!raw) return [];
    const normalized = raw.toLowerCase();
    const compact = normalized.replace(/\s+/g, "");
    const terms = normalized.split(/\s+/).filter(Boolean);
    return searchableRecords(project)
      .map((record) => {
        const key = String(record.key || "").toLowerCase();
        const title = String(record.title || "").toLowerCase();
        const text = String(record.text || "").toLowerCase();
        let score = 0;
        if (key === normalized || key.replace(/\s+/g, "") === compact) score += 1000;
        if (title === normalized) score += 800;
        if (key.includes(normalized)) score += 250;
        if (title.includes(normalized)) score += 200;
        if (text.includes(normalized)) score += 120;
        for (const term of terms) if (term.length > 1 && text.includes(term)) score += 10;
        return { ...record, score };
      })
      .filter((record) => record.score > 0)
      .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type) || a.title.localeCompare(b.title))
      .slice(0, Math.max(1, Number(limit) || 50));
  }

  function summarizeLogicChain(record) {
    if (!record) return [];
    if (record.writers) {
      return record.writers.map((writer) => ({
        kind: writer.instruction,
        location: `${writer.program || "?"} / ${writer.routine || "?"} / rung ${writer.rung}`,
        line: writer.line,
        symbols: unique((writer.symbols || []).filter((symbol) => symbol !== writer.target)),
        source: writer.source
      }));
    }
    if (record.instructions && record.source) {
      return [{ kind: "RUNG", location: `${record.program || "?"} / ${record.routine || "?"} / rung ${record.number}`, line: record.startLine, symbols: record.symbols || [], source: record.source }];
    }
    return [];
  }

  return Object.freeze({
    version: "l5k-analyzer-v1",
    parseL5K,
    parseInstructionCalls,
    extractSymbols,
    extractIOReferences,
    searchAnalysis,
    summarizeLogicChain,
    isFaultLike
  });
});
