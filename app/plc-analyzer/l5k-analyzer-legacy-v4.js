"use strict";

(function installLegacyL5KCompatibility(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-core.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLegacyL5KCompatibility(base) {
  if (!base || typeof base.parseL5K !== "function") throw new Error("ServoForge L5K analyzer core is required before legacy compatibility.");

  const baseParseL5K = base.parseL5K;

  function normalize(value) {
    return String(value || "").replace(/\r\n?/g, "\n");
  }

  function unquote(value) {
    const text = String(value || "").trim();
    return text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1).replace(/""/g, '"') : text;
  }

  function legacyExportVersion(text) {
    const match = /^\s*Version\s*:=\s*(?:RSLogix\s+5000|Studio\s*5000)\s+v?(\d+(?:\.\d+){1,3})\s*;?/im.exec(String(text || ""));
    return match ? match[1] : null;
  }

  function hasLegacyNeutralRungs(text) {
    return /^\s*N\s*:/im.test(String(text || ""));
  }

  function transformLegacyNeutralRungs(input) {
    const original = normalize(input);
    const lines = original.split("\n");
    const transformed = [];
    const lineMap = [null];
    let currentProgram = null;
    let currentRoutine = null;
    let routineRungOrdinal = 0;
    let legacyRungs = 0;

    function push(value, originalLine) {
      transformed.push(value);
      lineMap.push(originalLine);
    }

    lines.forEach((line, index) => {
      const originalLine = index + 1;
      const trimmed = line.trim();
      const programMatch = /^PROGRAM\s+("[^"]+"|[^\s(]+)/i.exec(trimmed);
      const routineMatch = /^ROUTINE\s+("[^"]+"|[^\s(]+)/i.exec(trimmed);

      if (programMatch) currentProgram = unquote(programMatch[1]);
      if (/^END_PROGRAM\b/i.test(trimmed)) {
        currentProgram = null;
        currentRoutine = null;
      }
      if (routineMatch) {
        currentRoutine = unquote(routineMatch[1]);
        routineRungOrdinal = 0;
      }

      if (/^\s*N\s*:/i.test(line)) {
        routineRungOrdinal += 1;
        legacyRungs += 1;
        push(`RUNG ${routineRungOrdinal}`, originalLine);
        push(line, originalLine);
        push("END_RUNG", originalLine);
      } else {
        push(line, originalLine);
      }

      if (/^END_ROUTINE\b/i.test(trimmed)) currentRoutine = null;
    });

    return {
      original,
      transformed: transformed.join("\n"),
      lineMap,
      originalLineCount: lines.length,
      legacyRungs
    };
  }

  function cleanSyntheticRungSource(value) {
    const text = String(value || "");
    const match = /^RUNG\s+-?\d+\s*\n([\s\S]*?)\nEND_RUNG\s*$/i.exec(text.trim());
    return match ? match[1].trim() : value;
  }

  function remapSourceCoordinates(project, lineMap) {
    const seen = new Set();
    function visit(value) {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if ((key === "line" || key === "startLine" || key === "endLine") && Number.isInteger(child) && lineMap[child]) {
          value[key] = lineMap[child];
          continue;
        }
        if (key === "source" && typeof child === "string") value[key] = cleanSyntheticRungSource(child);
        else visit(child);
      }
    }
    visit(project);
    return project;
  }

  function parseL5K(input, options = {}) {
    const text = normalize(input);
    if (!hasLegacyNeutralRungs(text)) {
      const project = baseParseL5K(text, options);
      if (!project.exportVersion) project.exportVersion = legacyExportVersion(text);
      return project;
    }

    const prepared = transformLegacyNeutralRungs(text);
    const project = baseParseL5K(prepared.transformed, options);
    remapSourceCoordinates(project, prepared.lineMap);
    project.exportVersion = project.exportVersion || legacyExportVersion(prepared.original);
    project.source = {
      ...(project.source || {}),
      fileName: options.fileName || project.source?.fileName || null,
      byteLength: options.byteLength || prepared.original.length,
      lineCount: prepared.originalLineCount,
      ladderEncoding: "legacy-neutral-N",
      legacyNeutralRungs: prepared.legacyRungs
    };
    return project;
  }

  return Object.freeze({
    ...base,
    parseL5K,
    legacyCompatibility: Object.freeze({
      version: "v4",
      supportsNeutralRungs: true,
      transformLegacyNeutralRungs
    })
  });
});
