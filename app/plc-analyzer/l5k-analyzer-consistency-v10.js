"use strict";

(function installConsistencyReview(root, factory) {
  const base = (typeof module !== "undefined" && module.exports)
    ? require("./l5k-analyzer-message-v9.js")
    : root?.ServoForgeL5KAnalyzer;
  const api = factory(base);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeL5KAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createConsistencyReview(base) {
  if (!base || typeof base.parseL5K !== "function" || typeof base.parseInstructionCalls !== "function") {
    throw new Error("ServoForge v9 analyzer is required before v10 consistency review.");
  }

  const baseParseL5K = base.parseL5K;
  const TIMER_INSTRUCTIONS = new Set(["TON", "TOF", "RTO"]);
  const COUNTER_INSTRUCTIONS = new Set(["CTU", "CTD"]);
  const COMPARISON_INSTRUCTIONS = new Set(["EQU", "NEQ", "LES", "LEQ", "GRT", "GEQ", "LIM"]);

  function numericValue(value) {
    const text = String(value ?? "").trim();
    return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text) ? Number(text) : null;
  }

  function rootSymbol(value) {
    return String(value || "").trim().split(".")[0].replace(/\[[^\]]*\].*$/, "");
  }

  function baseSymbol(value) {
    return String(value || "").trim().replace(/\.(?:PRE|ACC|DN|EN|TT)$/i, "");
  }

  function sortedUnique(values) {
    return [...new Set((values || []).filter((value) => value !== null && value !== undefined).map(String))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function safeId(value) {
    return String(value || "unknown").replace(/[^A-Za-z0-9_.:[\]-]+/g, "_");
  }

  function resolveDeclaration(project, symbol, program) {
    const root = rootSymbol(symbol);
    const tags = project?.dependencies?.scopedTags || [];
    return tags.find((tag) => tag.name === root && tag.program === program)
      || tags.find((tag) => tag.name === root && tag.scope === "controller")
      || null;
  }

  function createInstance(kind, symbol, rung, declaration) {
    const family = baseSymbol(symbol);
    const scopeKind = declaration?.program === rung.program && rung.program ? "program-proven" : declaration?.scope === "controller" ? "controller-proven" : "unresolved";
    const program = scopeKind === "program-proven" ? rung.program : declaration?.scope === "controller" ? null : rung.program || null;
    return {
      kind,
      family,
      declarationRoot: rootSymbol(symbol),
      scopeKind,
      program,
      instanceKey: `${scopeKind}:${program || "controller"}:${family}`,
      declaration: declaration || null,
      instructionTypes: new Set(),
      presets: new Set(),
      presetEvidence: [],
      thresholdSignatures: new Set(),
      thresholdEvidence: [],
      selfIncrementByOne: false,
      incrementEvidence: []
    };
  }

  function ensureInstance(map, kind, symbol, rung, project) {
    const declaration = resolveDeclaration(project, symbol, rung.program || null);
    const probe = createInstance(kind, symbol, rung, declaration);
    if (!map.has(probe.instanceKey)) map.set(probe.instanceKey, probe);
    return map.get(probe.instanceKey);
  }

  function collectEvidence(project) {
    const timers = new Map();
    const counters = new Map();
    const thresholds = new Map();

    for (const rung of project.rungs || []) {
      const calls = base.parseInstructionCalls(rung.source || "");
      for (const call of calls) {
        const first = String(call.args?.[0] || "").trim();

        if (TIMER_INSTRUCTIONS.has(call.name) && first) {
          const item = ensureInstance(timers, "timer", first, rung, project);
          item.instructionTypes.add(call.name);
          const preset = numericValue(call.args?.[1]);
          if (preset !== null) {
            item.presets.add(String(preset));
            item.presetEvidence.push({ value: preset, kind: "instruction-argument", program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: call.raw });
          }
        }

        if (COUNTER_INSTRUCTIONS.has(call.name) && first) {
          const item = ensureInstance(counters, "counter", first, rung, project);
          item.instructionTypes.add(call.name);
          const preset = numericValue(call.args?.[1]);
          if (preset !== null) {
            item.presets.add(String(preset));
            item.presetEvidence.push({ value: preset, kind: "instruction-argument", program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: call.raw });
          }
        }

        if (call.name === "MOV" && call.args?.length >= 2) {
          const sourceValue = numericValue(call.args[0]);
          const destination = String(call.args[1] || "").trim();
          const presetMatch = /^(.+)\.PRE$/i.exec(destination);
          if (sourceValue !== null && presetMatch) {
            const symbol = presetMatch[1].trim();
            const declaration = resolveDeclaration(project, symbol, rung.program || null);
            const declaredType = String(declaration?.dataType || "").replace(/\[[^\]]+\]$/, "").toUpperCase();
            const map = declaredType === "COUNTER" ? counters : timers;
            const kind = declaredType === "COUNTER" ? "counter" : "timer";
            const item = ensureInstance(map, kind, symbol, rung, project);
            item.presets.add(String(sourceValue));
            item.presetEvidence.push({ value: sourceValue, kind: "MOV-to-PRE", program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: call.raw });
          }
        }

        if (call.name === "ADD" && call.args?.length >= 3) {
          const a = String(call.args[0] || "").trim();
          const b = String(call.args[1] || "").trim();
          const dest = String(call.args[2] || "").trim();
          const selfIncrement = dest && ((dest === a && numericValue(b) === 1) || (dest === b && numericValue(a) === 1));
          if (selfIncrement) {
            const item = ensureInstance(thresholds, "threshold", dest, rung, project);
            item.selfIncrementByOne = true;
            item.incrementEvidence.push({ program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: call.raw });
          }
        }

        if (!COMPARISON_INSTRUCTIONS.has(call.name)) continue;
        let symbol = null;
        let signature = null;
        const args = call.args || [];
        if (call.name === "LIM" && args.length >= 3) {
          const low = numericValue(args[0]);
          const test = String(args[1] || "").trim();
          const high = numericValue(args[2]);
          if (low !== null && high !== null && test && numericValue(test) === null) {
            symbol = test;
            signature = `LIM:${low}:${high}`;
          }
        } else if (args.length >= 2) {
          const left = numericValue(args[0]);
          const right = numericValue(args[1]);
          if (left === null && right !== null) {
            symbol = String(args[0] || "").trim();
            signature = `${call.name}:symbol-left:${right}`;
          } else if (left !== null && right === null) {
            symbol = String(args[1] || "").trim();
            signature = `${call.name}:symbol-right:${left}`;
          }
        }
        if (symbol && signature) {
          const item = ensureInstance(thresholds, "threshold", symbol, rung, project);
          item.thresholdSignatures.add(signature);
          item.thresholdEvidence.push({ signature, program: rung.program, routine: rung.routine, rung: rung.number, line: rung.startLine, source: call.raw });
        }
      }
    }

    function materialize(map) {
      return [...map.values()].map((item) => ({
        ...item,
        instructionTypes: sortedUnique([...item.instructionTypes]),
        presets: sortedUnique([...item.presets]),
        thresholdSignatures: sortedUnique([...item.thresholdSignatures])
      }));
    }

    return {
      timers: materialize(timers),
      counters: materialize(counters),
      thresholds: materialize(thresholds)
    };
  }

  function peerGroups(instances, valueSelector) {
    const families = new Map();
    for (const item of instances || []) {
      if (item.scopeKind !== "program-proven" || !item.program) continue;
      if (!families.has(item.family)) families.set(item.family, []);
      families.get(item.family).push(item);
    }
    return [...families.entries()]
      .map(([family, peers]) => ({ family, peers: peers.sort((a, b) => a.program.localeCompare(b.program, undefined, { numeric: true })), values: peers.map(valueSelector) }))
      .filter((group) => new Set(group.peers.map((peer) => peer.program)).size >= 2);
  }

  function signature(values) {
    return sortedUnique(values).join("|");
  }

  function majorityEvidence(peers, selector) {
    const counts = new Map();
    for (const peer of peers) {
      const sig = signature(selector(peer));
      counts.set(sig, (counts.get(sig) || 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!ranked.length || ranked[0][1] < 2 || ranked.length < 2) return null;
    return { signature: ranked[0][0], count: ranked[0][1], total: peers.length };
  }

  function peerSnapshot(peer) {
    return {
      program: peer.program,
      family: peer.family,
      declarationLine: peer.declaration?.line || null,
      dataType: peer.declaration?.dataType || null,
      instructionTypes: peer.instructionTypes || [],
      presets: peer.presets || [],
      thresholdSignatures: peer.thresholdSignatures || [],
      selfIncrementByOne: Boolean(peer.selfIncrementByOne),
      presetEvidence: peer.presetEvidence || [],
      thresholdEvidence: peer.thresholdEvidence || [],
      incrementEvidence: peer.incrementEvidence || []
    };
  }

  function buildFindings(project, evidence) {
    const findings = [];
    const add = (id, severity, title, summary, peers, extra = {}) => findings.push({
      id,
      classification: "static-inference",
      severity,
      title,
      summary,
      evidence: { peers: peers.map(peerSnapshot), ...extra },
      sourceRule: "plc-intra-project-consistency-v10"
    });

    for (const group of peerGroups(evidence.timers, (peer) => peer.presets)) {
      const typeSignatures = new Set(group.peers.map((peer) => signature(peer.instructionTypes)));
      if (typeSignatures.size > 1) {
        add(
          `v10:timer-instruction-peer:${safeId(group.family)}`,
          "review",
          `Peer timer instruction differs: ${group.family}`,
          `${group.family} is a source-proven program-scoped timer name in multiple programs, but its timer instruction family differs across peers. Same-name program tags are treated only as inferred peers; verify machine/function intent before calling this a discrepancy.`,
          group.peers
        );
      }
      const withPresets = group.peers.filter((peer) => peer.presets.length);
      if (withPresets.length >= 2 && new Set(withPresets.map((peer) => signature(peer.presets))).size > 1) {
        const majority = majorityEvidence(withPresets, (peer) => peer.presets);
        add(
          `v10:timer-preset-peer:${safeId(group.family)}`,
          "review",
          `Peer timer PRE differs: ${group.family}`,
          `${group.family} has different source-visible numeric PRE evidence across program-scoped peers. This does not establish which value is correct and is not a recommendation to change any timer.`,
          withPresets,
          { majority }
        );
      }
    }

    for (const group of peerGroups(evidence.counters, (peer) => peer.presets)) {
      const typeSignatures = new Set(group.peers.map((peer) => signature(peer.instructionTypes)));
      if (typeSignatures.size > 1) {
        add(
          `v10:counter-instruction-peer:${safeId(group.family)}`,
          "review",
          `Peer counter instruction differs: ${group.family}`,
          `${group.family} is source-visible in multiple program scopes, but CTU/CTD instruction evidence differs across those peers. Verify intended program function and revision before treating the difference as defective.`,
          group.peers
        );
      }
      const withPresets = group.peers.filter((peer) => peer.presets.length);
      if (withPresets.length >= 2 && new Set(withPresets.map((peer) => signature(peer.presets))).size > 1) {
        const majority = majorityEvidence(withPresets, (peer) => peer.presets);
        add(
          `v10:counter-preset-peer:${safeId(group.family)}`,
          "review",
          `Peer counter PRE differs: ${group.family}`,
          `${group.family} has different source-visible numeric counter preset evidence across program-scoped peers. The values are comparison evidence only and are not adjustment recommendations.`,
          withPresets,
          { majority }
        );
      }
    }

    for (const group of peerGroups(evidence.thresholds, (peer) => peer.thresholdSignatures)) {
      const withThresholds = group.peers.filter((peer) => peer.thresholdSignatures.length);
      if (withThresholds.length < 2) continue;
      if (new Set(withThresholds.map((peer) => signature(peer.thresholdSignatures))).size <= 1) continue;
      const cycleStyle = withThresholds.some((peer) => peer.selfIncrementByOne);
      const majority = majorityEvidence(withThresholds, (peer) => peer.thresholdSignatures);
      add(
        `v10:threshold-peer:${safeId(group.family)}`,
        "review",
        `Peer decision threshold differs: ${group.family}`,
        `${group.family} has different source-visible numeric comparison signatures across program-scoped peers.${cycleStyle ? " At least one peer is incremented by 1 in logic, so threshold numbers must not be converted to milliseconds without scan-time/runtime evidence." : ""} Same-name tags are inferred peers only; this does not establish the correct threshold.`,
        withThresholds,
        { majority, cycleStyle }
      );
    }

    return findings;
  }

  function parseL5K(input, options = {}) {
    const project = baseParseL5K(input, options);
    const evidence = collectEvidence(project);
    const findings = buildFindings(project, evidence);
    const existingIds = new Set((project.findings || []).map((item) => item.id));
    const uniqueFindings = findings.filter((item) => !existingIds.has(item.id));
    project.findings = [...(project.findings || []), ...uniqueFindings];
    project.dependencies = {
      ...(project.dependencies || {}),
      consistencyReview: {
        version: "v10",
        evidenceClass: "static-peer-consistency-review",
        timers: evidence.timers,
        counters: evidence.counters,
        thresholds: evidence.thresholds,
        findings: uniqueFindings,
        sourceBoundary: "v10 compares only source-proven program-scoped same-name tags across distinct programs. Same-name tags are inferred peers, not proof of identical machine function. Numeric PRE/threshold values are export evidence only and are not adjustment recommendations. PLC-cycle counters are not converted to time without runtime scan evidence."
      }
    };
    project.statistics = {
      ...(project.statistics || {}),
      findings: project.findings.length,
      consistencyFindings: uniqueFindings.length,
      consistencyTimerInstances: evidence.timers.length,
      consistencyCounterInstances: evidence.counters.length,
      consistencyThresholdInstances: evidence.thresholds.length
    };
    return project;
  }

  return Object.freeze({
    ...base,
    version: "l5k-analyzer-v10",
    parseL5K,
    collectConsistencyEvidence: collectEvidence,
    buildConsistencyFindings: buildFindings
  });
});
