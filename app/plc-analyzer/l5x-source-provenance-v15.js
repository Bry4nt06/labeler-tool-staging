"use strict";

(function installL5XSourceProvenance(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5x-analyzer-adapter-v15.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createL5XSourceProvenance(base) {
  if (!base || typeof base.parseControllerSource !== "function") throw new Error("ServoForge L5X source adapter v15 is required before source provenance v15.");

  const baseParseControllerSource = base.parseControllerSource;

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

  function attributes(source) {
    const result = {};
    const matcher = /([A-Za-z_][A-Za-z0-9_:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
    let match;
    while ((match = matcher.exec(String(source || "")))) result[match[1]] = decodeXml(match[2].slice(1, -1));
    return result;
  }

  function lineLocator(text) {
    const starts = [0];
    for (let index = 0; index < text.length; index += 1) if (text[index] === "\n") starts.push(index + 1);
    return function lineAt(index) {
      let low = 0;
      let high = starts.length;
      const target = Math.max(0, Number(index) || 0);
      while (low < high) {
        const mid = (low + high) >> 1;
        if (starts[mid] <= target) low = mid + 1;
        else high = mid;
      }
      return Math.max(1, low);
    };
  }

  function rungKey(program, routine, rung) {
    return `${program || ""}\u0000${routine || ""}\u0000${String(rung ?? "")}`;
  }

  function scheduleKey(task, program) {
    return `${task || ""}\u0000${program || ""}`;
  }

  function buildXmlLocations(input) {
    const xml = String(input || "").replace(/\r\n?/g, "\n");
    const lineAt = lineLocator(xml);
    const token = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?([A-Za-z_][A-Za-z0-9_.:-]*)\b([^>]*)>/g;
    const locations = {
      rungs: new Map(),
      routines: new Map(),
      tasks: new Map(),
      schedules: new Map()
    };
    let program = null;
    let routine = null;
    let routineType = null;
    let rung = null;
    let task = null;
    let match;

    while ((match = token.exec(xml))) {
      const raw = match[0];
      if (/^<!--|^<!\[CDATA|^<\?/.test(raw)) continue;
      const name = String(match[1] || "");
      const lower = name.toLowerCase();
      const closing = /^<\//.test(raw);
      const selfClosing = /\/\s*>$/.test(raw);
      const attrs = attributes(match[2] || "");
      const line = lineAt(match.index);

      if (!closing) {
        if (lower === "program") program = attrs.Name || program;
        else if (lower === "routine") {
          routine = attrs.Name || routine;
          routineType = attrs.Type || null;
          if (program && routine) locations.routines.set(`${program}\u0000${routine}`, { startLine: line, endLine: line, type: routineType });
        } else if (lower === "rung") {
          rung = attrs.Number ?? rung;
          if (program && routine && rung !== null) locations.rungs.set(rungKey(program, routine, rung), { rungLine: line, textLine: null, endLine: line });
        } else if (lower === "text" && program && routine && rung !== null && String(routineType || "RLL").toUpperCase() === "RLL") {
          const key = rungKey(program, routine, rung);
          const record = locations.rungs.get(key) || { rungLine: line, textLine: null, endLine: line };
          if (!record.textLine) record.textLine = line;
          locations.rungs.set(key, record);
        } else if (lower === "task") {
          task = attrs.Name || task;
          if (task) locations.tasks.set(task, line);
        } else if (lower === "scheduledprogram" && task && attrs.Name) {
          locations.schedules.set(scheduleKey(task, attrs.Name), line);
        }

        if (selfClosing) {
          if (lower === "rung") rung = null;
          if (lower === "routine") { routine = null; routineType = null; rung = null; }
          if (lower === "program") program = null;
          if (lower === "task") task = null;
        }
        continue;
      }

      if (lower === "rung" && program && routine && rung !== null) {
        const key = rungKey(program, routine, rung);
        const record = locations.rungs.get(key);
        if (record) record.endLine = line;
        rung = null;
      } else if (lower === "routine") {
        if (program && routine) {
          const key = `${program}\u0000${routine}`;
          const record = locations.routines.get(key);
          if (record) record.endLine = line;
        }
        routine = null;
        routineType = null;
        rung = null;
      } else if (lower === "program") {
        program = null;
        routine = null;
        routineType = null;
        rung = null;
      } else if (lower === "task") task = null;
    }
    return locations;
  }

  function applyLocations(project, locations) {
    const seen = new Set();
    function visit(value) {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) return value.forEach(visit);

      const program = value.program || null;
      const routine = value.routine || value.callerRoutine || null;
      const hasRung = value.rung !== undefined && value.rung !== null;
      if (program && routine && hasRung) {
        const record = locations.rungs.get(rungKey(program, routine, value.rung));
        if (record) {
          const sourceLine = record.textLine || record.rungLine;
          if (Number.isInteger(value.line)) value.line = sourceLine;
          if (Number.isInteger(value.startLine)) value.startLine = sourceLine;
          if (Number.isInteger(value.endLine)) value.endLine = record.endLine || sourceLine;
        }
      }

      if (value.task && Number.isInteger(value.taskLine) && locations.tasks.has(value.task)) value.taskLine = locations.tasks.get(value.task);
      if (value.task && value.program && Number.isInteger(value.line)) {
        const scheduledLine = locations.schedules.get(scheduleKey(value.task, value.program));
        if (scheduledLine) value.line = scheduledLine;
      }

      for (const child of Object.values(value)) visit(child);
    }
    visit(project);

    for (const routine of project.routines || []) {
      const record = locations.routines.get(`${routine.program || ""}\u0000${routine.name || ""}`);
      if (!record) continue;
      if (Number.isInteger(routine.startLine)) routine.startLine = record.startLine;
      if (Number.isInteger(routine.endLine)) routine.endLine = record.endLine;
    }
    return project;
  }

  function parseControllerSource(input, options = {}) {
    const project = baseParseControllerSource(input, options);
    if (project?.source?.sourceFormat !== "L5X") return project;
    const locations = buildXmlLocations(input);
    applyLocations(project, locations);
    project.source = {
      ...(project.source || {}),
      provenanceVersion: "v15",
      provenanceMode: "l5x-program-routine-rung-text",
      sourceBoundary: `${project.source?.sourceBoundary || ""} Source locations for rung-derived evidence are reanchored to the matching L5X Program / Routine / Rung Text element and remain offline source coordinates, not runtime execution proof.`.trim()
    };
    return project;
  }

  return Object.freeze({
    ...base,
    parseL5K: parseControllerSource,
    parseControllerSource,
    l5xSourceProvenance: Object.freeze({ version: "v15", buildXmlLocations })
  });
});
