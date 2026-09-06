"use strict";

(function installServoForgeUniversalTroubleshooting(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ServoForgeUniversalTroubleshooting = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createUniversalTroubleshootingCore() {
  const HANDOFF_SCHEMA = "servoforge-analyzer-troubleshooter-context-v1";
  const STORAGE_KEY = "servoforge-analyzer-troubleshooter-context-v1";

  const families = Object.freeze([
    Object.freeze({
      id: "safety-interlock",
      title: "Safety / interlock not satisfied",
      description: "A guard, E-stop, safety-chain, mode, reset, or monitored permissive condition is not satisfied.",
      terms: [["emergency stop", 5], ["e-stop", 5], ["estop", 5], ["guard", 4], ["safety", 4], ["interlock", 3], ["permissive", 2], ["door open", 3], ["safety circuit", 5]]
    }),
    Object.freeze({
      id: "power-electrical",
      title: "Power / electrical supply path",
      description: "A supply, contactor, breaker, fuse, control-voltage, phase, overload, or electrical-protection path is not in the expected state.",
      terms: [["main contactor", 5], ["contactor", 3], ["circuit breaker", 4], ["breaker", 2], ["fuse", 3], ["control voltage", 4], ["power loss", 4], ["power supply", 3], ["phase loss", 4], ["overcurrent", 3], ["undervoltage", 3], ["overvoltage", 3], ["overload", 2]]
    }),
    Object.freeze({
      id: "communication",
      title: "Communication / controller path",
      description: "A controller, I/O, Ethernet, fieldbus, produced/consumed, message, or device-communication path is unavailable or unhealthy.",
      terms: [["communication", 4], ["ethernet", 4], ["can bus", 4], ["can-bus", 4], ["network", 3], ["connection", 2], ["message", 2], ["msg", 2], ["produced", 2], ["consumed", 2], ["i/o failure", 4], ["io failure", 4], ["node fault", 3], ["module faulted", 3]]
    }),
    Object.freeze({
      id: "encoder-feedback",
      title: "Encoder / feedback signal path",
      description: "Expected position, speed, count, or encoder feedback is missing, frozen, noisy, implausible, or not reaching the controller path.",
      terms: [["encoder feedback", 6], ["feedback fault", 5], ["feedback noise", 5], ["encoder", 3], ["pulse", 2], ["clock pulse", 4], ["aqb", 4], ["position feedback", 4], ["speed feedback", 4], ["count frozen", 5]]
    }),
    Object.freeze({
      id: "timing-synchronization",
      title: "Timing / synchronization relationship",
      description: "A machine phase, fine-clock, reference, synchronization, registration, or timing relationship is not maintained.",
      terms: [["synchron", 4], ["fine clock", 5], ["reference", 2], ["registration", 3], ["timing", 3], ["phase", 2], ["cam", 2], ["not synchronized", 5], ["sync fault", 5]]
    }),
    Object.freeze({
      id: "servo-motion",
      title: "Servo / motion-control path",
      description: "A servo axis, drive, motion group, position, commutation, SERCOS, or commanded-motion condition is not healthy.",
      terms: [["servo", 4], ["axis", 2], ["drive fault", 4], ["motion", 3], ["commutation", 4], ["sercos", 4], ["position error", 4], ["overspeed", 3], ["motor feedback", 4], ["drive over", 2]]
    }),
    Object.freeze({
      id: "label-supply-web",
      title: "Label supply / web handling",
      description: "The label reel, web, feed, rewind, loop-buffer, label-present, end-of-reel, or autochange path is outside expected condition.",
      terms: [["no labels", 5], ["end of reel", 5], ["web break", 5], ["web jam", 5], ["rewind", 3], ["feed unit", 3], ["loop buffer", 4], ["label length", 3], ["label supply", 4], ["autochange", 4], ["lackoflabel", 5]]
    }),
    Object.freeze({
      id: "container-flow",
      title: "Container flow / handling",
      description: "Bottle/container presence, spacing, transfer, infeed, discharge, jam, clutch, or conveyor flow is not as expected.",
      terms: [["container", 2], ["bottle", 2], ["infeed gap", 5], ["discharge jam", 5], ["jam", 3], ["conveyor", 3], ["clutch", 2], ["backup", 2], ["backed up", 3], ["presence", 2]]
    }),
    Object.freeze({
      id: "orientation-vision",
      title: "Orientation / vision acquisition",
      description: "Bottle orientation, camera acquisition, image sequence, trigger, framegrabber, embossing, or result-to-plate association is not correct.",
      terms: [["orientation", 5], ["camera", 4], ["image sequence", 5], ["framegrabber", 5], ["emboss", 4], ["trigger", 3], ["wrong plate", 5], ["rotary plate", 4], ["vision", 3], ["dart", 3]]
    }),
    Object.freeze({
      id: "inspection-coder",
      title: "Inspection / coding subsystem",
      description: "An inspection, reject, label-check, laser/coder, dating, or downstream quality subsystem is not ready or is reporting a fault.",
      terms: [["inspection", 4], ["heuft", 5], ["laser coder", 5], ["coder", 3], ["dating", 3], ["reject", 3], ["label inspection", 5], ["sonic", 3]]
    }),
    Object.freeze({
      id: "utilities",
      title: "Machine utility / service supply",
      description: "Air, lubrication, cooling, extraction, or another machine utility is outside the required condition.",
      terms: [["air pressure", 4], ["compressed air", 4], ["lubrication", 5], ["grease", 3], ["cooling", 3], ["extractor", 3], ["utility", 2]]
    }),
    Object.freeze({
      id: "hmi-runtime",
      title: "HMI / runtime / service computer",
      description: "The operator interface, runtime, project, panel, service computer, or diagnostic software layer requires isolation from the machine-control problem.",
      terms: [["hmi", 4], ["runtime", 3], ["zenon", 5], ["touch screen", 4], ["touch-screen", 4], ["diagviewer", 5], ["workspace", 3], ["panel", 2]]
    })
  ]);

  const familyById = new Map(families.map((family) => [family.id, family]));

  function normalize(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[_./:[\]()-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scoreFamily(text, family) {
    const value = normalize(text);
    if (!value) return 0;
    let score = 0;
    for (const [term, weight] of family.terms) {
      if (value.includes(normalize(term))) score += weight;
    }
    return score;
  }

  function classifyText(value) {
    const ranked = families
      .map((family) => ({ family, score: scoreFamily(value, family) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.family.title.localeCompare(b.family.title));
    if (!ranked.length) return null;
    const first = ranked[0];
    const second = ranked[1];
    const confidence = first.score >= 8 && (!second || first.score >= second.score + 3)
      ? "strong"
      : first.score >= 4
        ? "moderate"
        : "weak";
    return Object.freeze({ familyId: first.family.id, title: first.family.title, score: first.score, confidence });
  }

  function candidateText(candidate) {
    const writerSymbols = (candidate?.writers || []).flatMap((writer) => writer?.symbols || []);
    const motion = (candidate?.motionReferences || []).flatMap((row) => [row?.axis, row?.member, row?.source]);
    const dependency = candidate?.dependencyEvidence?.upstreamSymbols || [];
    return [candidate?.target, ...writerSymbols, ...motion, ...dependency].filter(Boolean).join(" ");
  }

  function classifyCandidate(candidate) {
    return classifyText(candidateText(candidate));
  }

  function classifyEntry(entry) {
    return classifyText([
      entry?.category,
      entry?.title,
      entry?.summary,
      ...(entry?.aliases || []),
      ...(entry?.contextHints || [])
    ].filter(Boolean).join(" "));
  }

  function writerLocations(candidate) {
    return (candidate?.writers || []).map((writer) => ({
      instruction: writer?.instruction ?? null,
      program: writer?.location?.program ?? null,
      routine: writer?.location?.routine ?? null,
      rung: writer?.location?.rung ?? null,
      line: writer?.location?.line ?? null
    }));
  }

  function buildAnalyzerHandoff(project, queue, identity = {}, options = {}) {
    if (!project || !queue) throw new Error("Parsed project and import queue are required for troubleshooting handoff.");
    const maxBindings = Math.max(1, Math.min(Number(options.maxBindings || 250), 500));
    const bindings = [];
    const familyCounts = new Map();
    let unclassifiedCount = 0;

    for (const candidate of queue.candidates || []) {
      const classification = classifyCandidate(candidate);
      if (!classification) {
        unclassifiedCount += 1;
        continue;
      }
      familyCounts.set(classification.familyId, (familyCounts.get(classification.familyId) || 0) + 1);
      if (bindings.length >= maxBindings) continue;
      bindings.push(Object.freeze({
        target: candidate.target || null,
        familyId: classification.familyId,
        confidence: classification.confidence,
        score: classification.score,
        coverageStatus: candidate.coverageStatus || null,
        writers: writerLocations(candidate),
        ioReferences: (candidate.ioReferences || []).slice(0, 20),
        motionReferences: (candidate.motionReferences || []).slice(0, 20).map((row) => ({
          instruction: row?.instruction ?? null,
          axis: row?.axis ?? null,
          member: row?.member ?? null,
          routine: row?.routine ?? null,
          rung: row?.rung ?? null
        }))
      }));
    }

    const familySummary = [...familyCounts.entries()]
      .map(([familyId, count]) => ({ familyId, title: familyById.get(familyId)?.title || familyId, count }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

    return Object.freeze({
      schema: HANDOFF_SCHEMA,
      generatedAt: options.generatedAt || new Date().toISOString(),
      evidenceScope: "temporary-controller-session-overlay",
      universalizationPolicy: "Controller tags, fault targets, addresses, rung numbers, timer values, and site naming remain local evidence and must never replace the universal troubleshooting method without separate SME/source review.",
      controller: Object.freeze({
        parsedController: project.controller || null,
        sourceFile: project.source?.fileName || queue.project?.sourceFile || null,
        exportVersion: project.exportVersion || queue.project?.exportVersion || null,
        expectedControllerId: identity.expectedControllerId || null,
        sourceStatus: identity.sourceStatus || null,
        controllerRevision: identity.controllerRevision || null,
        firmwareRevision: identity.firmwareRevision || null,
        exportDate: identity.exportDate || null,
        notes: identity.notes || null
      }),
      statistics: Object.freeze({
        totalFaultTargets: queue.statistics?.totalFaultTargets || (queue.candidates || []).length,
        classifiedTargets: [...familyCounts.values()].reduce((sum, count) => sum + count, 0),
        unclassifiedTargets: unclassifiedCount,
        storedBindings: bindings.length
      }),
      families: Object.freeze(familySummary),
      bindings: Object.freeze(bindings)
    });
  }

  function validHandoff(value) {
    return Boolean(value && value.schema === HANDOFF_SCHEMA && Array.isArray(value.bindings));
  }

  function searchBindings(query, handoff) {
    if (!validHandoff(handoff)) return [];
    const needle = normalize(query);
    if (!needle) return [];
    return handoff.bindings.filter((binding) => normalize(binding.target).includes(needle));
  }

  function evidenceForEntry(entry, handoff) {
    if (!validHandoff(handoff)) return null;
    const classification = classifyEntry(entry);
    if (!classification) return null;
    const bindings = handoff.bindings.filter((binding) => binding.familyId === classification.familyId);
    if (!bindings.length) return null;
    return Object.freeze({
      familyId: classification.familyId,
      familyTitle: familyById.get(classification.familyId)?.title || classification.familyId,
      controller: handoff.controller,
      bindings: bindings.slice(0, 12),
      totalBindings: bindings.length,
      boundary: handoff.universalizationPolicy
    });
  }

  function family(id) {
    return familyById.get(String(id || "")) || null;
  }

  return Object.freeze({
    version: "v1",
    HANDOFF_SCHEMA,
    STORAGE_KEY,
    families,
    normalize,
    family,
    classifyText,
    classifyCandidate,
    classifyEntry,
    buildAnalyzerHandoff,
    validHandoff,
    searchBindings,
    evidenceForEntry
  });
});
