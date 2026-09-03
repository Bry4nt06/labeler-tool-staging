"use strict";

(function installTopModulLiveDiagnostics(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulLiveDiagnosticsExtension() {
  return function extendLibrary(base) {
    if (!base || typeof base.searchEntries !== "function" || typeof base.normalize !== "function") {
      throw new Error("ServoForge base troubleshooting library is required before TopModul live diagnostics.");
    }

    const observeSafety = "Observation and HMI/software checks only. Do not defeat guards, interlocks, or safety devices.";
    const lotoSafety = "Stop the machine and follow site lockout/tagout and stored-energy procedures before inspecting the encoder, coupling, connectors, cabinet wiring, or mechanical drive components.";
    const electricalSafety = "Voltage/signal measurements and energized electrical diagnostics must be performed only by personnel qualified under the site's electrical safe-work program and the machine-specific procedure.";

    const fieldSources = Object.freeze([
      {
        id: "field-topmodul-00067-20260903",
        title: "TopModul HMI field observation — Fault 00067",
        file: "Live field observation supplied 2026-09-03 (image retained in troubleshooting case, not repository archive)",
        kind: "Field observation",
        status: "field-observation",
        topics: ["TopModul", "Allen-Bradley", "PanelView 550", "00067", "labeler encoder", "encoder feedback", "field validation"],
        notes: "Allen-Bradley PanelView 550 displayed '00067 LABELER ENCODER FEEDBACK FAULT'. This confirms the operator-facing fault text and machine family. The exact PLC alarm rung/tag condition has not yet been decoded from a machine-specific readable control export."
      }
    ]);

    const sharedSourceRefs = Object.freeze([
      { sourceId: "field-topmodul-00067-20260903", locator: "PanelView 550 — Main functions — 00067 LABELER ENCODER FEEDBACK FAULT" },
      { sourceId: "krones-schematic-tutorial-r3", locator: "Use machine-specific schematic references to trace encoder power, feedback and PLC destination" },
      { sourceId: "schematic-tutorial-r3", locator: "Electrical drawing / signal tracing method" }
    ]);

    const fieldEntries = Object.freeze([
      {
        id: "topmodul-00067-labeler-encoder-feedback",
        code: "00067",
        category: "TopModul / Encoder",
        aliases: ["00067 labeler encoder feedback fault", "labeler encoder feedback fault", "encoder feedback fault", "TopModul encoder fault", "PanelView 550 00067"],
        contextHints: ["topmodul", "top modul", "labeler", "encoder", "allen bradley", "panelview"],
        title: "LABELER ENCODER FEEDBACK FAULT",
        summary: "Field-observed TopModul fault 00067. The controller is reporting a problem with labeler encoder feedback. Treat this as a machine-level encoder/feedback path until live evidence proves whether the encoder is not turning, the signal is missing/intermittent, or the fault is secondary to the machine not moving.",
        probableCauses: [
          "The labeler is expected to move but encoder feedback is not changing or is implausible.",
          "Encoder power, feedback wiring, connector, shielding/termination, or PLC/counter input path has a fault.",
          "Encoder shaft/coupling or the mechanical drive to the encoder is loose, damaged, or not turning with the machine.",
          "An intermittent cable/connector condition is dropping feedback during operation.",
          "The machine/main drive is not actually moving, making 00067 a secondary no-feedback symptom rather than the root cause.",
          "PLC-side input/count processing or alarm logic is seeing a bad state even though the field signal appears present; exact rung/tag confirmation is still pending."
        ],
        checks: [
          "Record when 00067 occurs: immediately on start, only while running, during acceleration/deceleration, after a stop, or intermittently at speed.",
          "From a safe observation point, confirm whether the main labeler/carousel is physically moving when the fault is generated. If the machine is not moving, investigate the no-motion/main-drive permissive condition first before condemning the encoder.",
          "If available in normal HMI/PLC diagnostics, observe the labeler encoder count/speed/position feedback while the machine moves. Do not force inputs or bypass interlocks. A moving machine with frozen/zero encoder feedback strongly narrows the problem to the encoder feedback path.",
          "If the feedback is intermittent, use normal guarded diagnostics/trending to determine whether the count drops out at a repeatable speed, vibration condition, or machine position. Do not handle wiring on an operating machine.",
          "Under LOTO, inspect the encoder mounting, shaft/coupling/mechanical drive, cable strain relief, connector seating, and visible pin/cable damage.",
          "Using the machine-specific TopModul electrical drawing, have qualified personnel trace encoder supply and feedback from the encoder through terminals/connectors to the PLC/high-speed-counter input. Verify the signal at successive points to localize the loss rather than replacing parts by symptom.",
          "If field signal and mechanical coupling are proven good all the way to the controller, obtain a readable L5K/L5X or rung/tag screenshot for the 00067 alarm so ServoForge can bind this live case to the exact PLC condition."
        ],
        actions: [
          "Repair the proven mechanical coupling, power, connector, cable, or input-path fault and then verify stable encoder feedback through a normal guarded run.",
          "If 00067 is secondary to a main-drive/no-motion condition, correct that upstream condition first and re-evaluate the encoder alarm.",
          "Do not bypass the encoder fault or safety chain to keep the labeler running.",
          "Do not replace the encoder solely from the HMI message if the feedback path has not been localized."
        ],
        safety: [observeSafety, lotoSafety, electricalSafety],
        sourceRefs: sharedSourceRefs
      },
      {
        id: "topmodul-00067-no-feedback-while-moving",
        code: "00067 — NO FEEDBACK",
        category: "TopModul / Encoder",
        aliases: ["machine moving encoder zero", "encoder count frozen", "encoder no feedback while running", "TopModul encoder zero"],
        contextHints: ["topmodul", "top modul", "encoder"],
        title: "Machine moves but labeler encoder feedback is zero/frozen",
        summary: "If the TopModul is physically moving while encoder feedback remains zero or frozen, the live fault is concentrated in the encoder's mechanical drive, power/signal path, or controller input/counting path.",
        probableCauses: ["Encoder/coupling not rotating with machine", "Encoder supply missing", "Open/loose feedback cable or connector", "Input/counter channel is not receiving/counting the signal"],
        checks: ["Confirm physical machine motion and frozen/zero feedback at the same time using normal diagnostics.", "Under LOTO inspect encoder/coupling/mechanical drive and connector/cable condition.", "Have qualified personnel trace power and feedback through the machine-specific schematic to the controller input.", "If the signal reaches the controller but the displayed/count value remains frozen, move to PLC/high-speed-counter and alarm-rung verification."],
        actions: ["Repair the localized coupling/power/wiring/input issue, then verify the count changes smoothly before returning to production."],
        safety: [observeSafety, lotoSafety, electricalSafety],
        sourceRefs: sharedSourceRefs
      },
      {
        id: "topmodul-00067-intermittent-feedback",
        code: "00067 — INTERMITTENT",
        category: "TopModul / Encoder",
        aliases: ["encoder feedback intermittent", "encoder drops out", "encoder fault at speed", "00067 intermittent"],
        contextHints: ["topmodul", "top modul", "encoder"],
        title: "Intermittent labeler encoder feedback dropout",
        summary: "If 00067 appears only during operation, vibration, speed changes, or specific machine positions, prioritize intermittent mechanical/cable/connector evidence before replacing the encoder.",
        probableCauses: ["Intermittent connector or damaged conductor", "Cable strain/flex/vibration problem", "Loose encoder coupling/mount", "Marginal power or feedback signal", "Controller input/count dropout"],
        checks: ["Record the speed, machine position and operating event when the fault repeats.", "Use normal guarded diagnostics/trending to see whether feedback drops before the alarm; do not manipulate wiring while the machine is operating.", "Under LOTO inspect cable flex points, strain relief, connector pins, encoder mount and coupling.", "Have qualified personnel verify supply/signal integrity according to the machine-specific drawing if the mechanical inspection is clean."],
        actions: ["Correct the proven intermittent connection/mechanical condition and verify multiple stable run cycles before closing the case."],
        safety: [observeSafety, lotoSafety, electricalSafety],
        sourceRefs: sharedSourceRefs
      },
      {
        id: "topmodul-00067-secondary-no-motion",
        code: "00067 — CHECK MOTION",
        category: "TopModul / Encoder",
        aliases: ["encoder fault machine not moving", "main drive not moving encoder feedback", "00067 no motion"],
        contextHints: ["topmodul", "top modul", "main drive", "encoder"],
        title: "Determine whether 00067 is secondary to a no-motion condition",
        summary: "If the labeler/carousel is not physically moving when 00067 appears, lack of encoder feedback may be expected. Establish why motion is absent before treating the encoder as the failed component.",
        probableCauses: ["Main-drive or motion permissive condition prevents movement", "A separate active machine/safety/drive condition is stopping motion", "Encoder fault may be secondary rather than primary"],
        checks: ["Review the HMI for the first active drive/safety/motion condition that occurred with or before 00067.", "Confirm the commanded machine state versus actual motion without bypassing safety conditions.", "Only continue down the encoder signal path if the machine is commanded/expected to move or after the upstream no-motion condition is resolved."],
        actions: ["Correct the upstream motion condition first, reset normally, and determine whether 00067 returns when the machine actually moves."],
        safety: [observeSafety],
        sourceRefs: sharedSourceRefs
      }
    ]);

    const fieldFlows = Object.freeze([
      {
        id: "topmodul-00067-encoder-flow",
        title: "TopModul — fault 00067",
        category: "TopModul / Encoder",
        description: "Live field path for LABELER ENCODER FEEDBACK FAULT: first separate no-motion from a true missing/intermittent encoder feedback signal.",
        contextHints: ["topmodul", "top modul", "encoder", "labeler", "allen bradley", "panelview"],
        start: "tm67-start",
        nodes: Object.freeze({
          "tm67-start": {
            question: "Is the HMI showing 00067 — LABELER ENCODER FEEDBACK FAULT?",
            choices: [
              { label: "Yes — this is the live fault", next: "tm67-motion" },
              { label: "No — similar encoder symptom", result: "topmodul-00067-labeler-encoder-feedback" }
            ]
          },
          "tm67-motion": {
            question: "When 00067 occurs, is the main labeler/carousel physically moving?",
            choices: [
              { label: "No — machine is not moving", result: "topmodul-00067-secondary-no-motion", hint: "Treat the encoder alarm as potentially secondary until the no-motion condition is resolved." },
              { label: "Yes — machine is moving", next: "tm67-feedback" },
              { label: "It trips only intermittently while running", result: "topmodul-00067-intermittent-feedback" },
              { label: "Not sure yet", result: "topmodul-00067-labeler-encoder-feedback" }
            ]
          },
          "tm67-feedback": {
            question: "Can you see a labeler encoder count/speed/position value in normal diagnostics, and does it change with machine motion?",
            choices: [
              { label: "Feedback is zero or frozen while machine moves", result: "topmodul-00067-no-feedback-while-moving" },
              { label: "Feedback changes, but 00067 still trips", result: "topmodul-00067-intermittent-feedback" },
              { label: "No encoder value is available to observe", result: "topmodul-00067-labeler-encoder-feedback" }
            ]
          }
        })
      }
    ]);

    const sources = Object.freeze([...base.sources, ...fieldSources]);
    const entries = Object.freeze([...base.entries, ...fieldEntries]);
    const flows = Object.freeze([...base.flows, ...fieldFlows]);

    function sourceText(source) {
      return base.normalize([source.title, source.file, source.kind, source.notes, ...(source.topics || [])].join(" "));
    }

    function fieldEntryText(entry) {
      return base.normalize([entry.code, entry.title, entry.summary, entry.category, ...(entry.aliases || []), ...(entry.probableCauses || []), ...(entry.checks || [])].join(" "));
    }

    function contextText(context = {}) {
      return base.normalize([context.site, context.zone, context.mapName, context.machineType, context.applicationMode, context.brand, context.bottle].filter(Boolean).join(" "));
    }

    function fieldScore(entry, query, context = {}) {
      const normalized = base.normalize(query);
      if (!normalized) return 0;
      const compact = normalized.replaceAll(" ", "");
      const text = fieldEntryText(entry);
      let score = 0;
      if (entry.id === "topmodul-00067-labeler-encoder-feedback" && compact === "00067") score += 250;
      if (text.includes(normalized)) score += 50;
      for (const term of normalized.split(" ").filter((term) => term.length > 1)) if (text.includes(term)) score += 8;
      const ctx = contextText(context);
      if (ctx.includes("topmodul") || ctx.includes("top modul")) score += 30;
      if (ctx.includes("encoder")) score += 6;
      return score;
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const fieldMatches = fieldEntries
        .map((entry) => ({ ...entry, searchScore: fieldScore(entry, query, context) }))
        .filter((entry) => entry.searchScore > 0);
      const baseMatches = base.searchEntries(query, context, requested + fieldEntries.length);
      const combined = [...fieldMatches, ...baseMatches];
      const seen = new Set();
      return combined
        .sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0) || String(a.title).localeCompare(String(b.title)))
        .filter((entry) => {
          if (seen.has(entry.id)) return false;
          seen.add(entry.id);
          return true;
        })
        .slice(0, requested);
    }

    function searchSources(query, limit = 20) {
      const normalized = base.normalize(query);
      const requested = Math.max(1, Number(limit) || 20);
      if (!normalized) return sources.slice(0, requested);
      return sources
        .map((source) => {
          const text = sourceText(source);
          let score = 0;
          if (text.includes(normalized)) score += 8;
          for (const term of normalized.split(" ").filter(Boolean)) if (text.includes(term)) score += 1;
          return { source, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.source.title.localeCompare(b.source.title))
        .slice(0, requested)
        .map((item) => item.source);
    }

    function recommendFlows(context = {}) {
      const ctx = contextText(context);
      const baseRanked = typeof base.recommendFlows === "function" ? base.recommendFlows(context) : base.flows;
      const fieldRanked = fieldFlows.map((flow) => ({
        ...flow,
        contextScore: (ctx.includes("topmodul") || ctx.includes("top modul") ? 100 : 0) + (ctx.includes("encoder") ? 12 : 0)
      }));
      return [...fieldRanked, ...baseRanked]
        .sort((a, b) => Number(b.contextScore || 0) - Number(a.contextScore || 0));
    }

    function getEntry(id) { return fieldEntries.find((entry) => entry.id === id) || base.getEntry(id); }
    function getFlow(id) { return fieldFlows.find((flow) => flow.id === id) || base.getFlow(id); }
    function getSource(id) { return fieldSources.find((source) => source.id === id) || base.getSource(id); }

    function validate() {
      const baseValidation = base.validate();
      const errors = [...(baseValidation.errors || [])];
      const sourceIds = new Set(sources.map((source) => source.id));
      const entryIds = new Set(entries.map((entry) => entry.id));
      for (const entry of fieldEntries) {
        if (!entry.safety?.length) errors.push(`Entry ${entry.id} has no safety guidance.`);
        for (const ref of entry.sourceRefs || []) if (!sourceIds.has(ref.sourceId)) errors.push(`Entry ${entry.id} references unknown source ${ref.sourceId}.`);
      }
      for (const flow of fieldFlows) {
        if (!flow.nodes?.[flow.start]) errors.push(`Flow ${flow.id} has missing start node ${flow.start}.`);
        for (const [nodeId, node] of Object.entries(flow.nodes || {})) {
          for (const choice of node.choices || []) {
            if (choice.next && !flow.nodes[choice.next]) errors.push(`Flow ${flow.id}/${nodeId} points to missing node ${choice.next}.`);
            if (choice.result && !entryIds.has(choice.result)) errors.push(`Flow ${flow.id}/${nodeId} points to missing result ${choice.result}.`);
          }
        }
      }
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+topmodul-live-00067-v1`,
      SOURCE_KIND: Object.freeze({ ...base.SOURCE_KIND, FIELD_OBSERVATION: "Field observation" }),
      sources,
      entries,
      flows,
      getEntry,
      getFlow,
      getSource,
      searchEntries,
      searchSources,
      recommendFlows,
      validate
    });
  };
});
