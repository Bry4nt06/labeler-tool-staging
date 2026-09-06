"use strict";

(function installNewSourceEvidenceV369(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createNewSourceEvidenceV369() {
  const OBSERVE = "Use read-only HMI/service diagnostics first. Do not force PLC values, defeat guards, bypass safety functions, or change machine configuration merely to clear a message.";
  const QUALIFIED_CONTROLS = "Workspace, network, panel, EWF, controller, or project changes are for authorized controls/service personnel using the approved machine-specific backup and change-control procedure.";
  const ELECTRICAL = "Hands-on camera, framegrabber, encoder, cabinet, connector, or energized electrical work is for qualified personnel under the applicable LOTO/electrical safe-work procedure and the current machine schematic.";

  const NEW_SOURCES = Object.freeze([
    Object.freeze({
      id: "autocol-schematic-k747a69",
      title: "Autocol Electrical Documentation — K747A69",
      file: "Autocol schematic.pdf",
      kind: "Electrical schematic",
      status: "indexed-machine-specific",
      topics: Object.freeze(["Autocol", "K747A69", "orientation", "camera", "framegrabber", "fine clock", "revolution clock", "container present", "CAN", "encoder", "electrical", "schematic"]),
      notes: "Machine-specific Columbus Line 85 Autocol electrical set. Use only when the installed equipment/drawing revision matches. Connector channels, addresses, wiring identifiers, parts, and other drawing details are not generalized to other machines."
    }),
    Object.freeze({
      id: "zenon-service-v2433",
      title: "Krones Touch-Screen / zenon Explorer Service Instructions",
      file: "Zenon_Documentation.pdf",
      kind: "Procedure",
      status: "indexed",
      topics: Object.freeze(["zenon", "HMI", "touch screen", "DiagViewer", "service tools", "workspace", "project backup", "network", "panel settings", "EWF", "NET project"]),
      notes: "Archived Krones service documentation for zenon Explorer from V2.4.33. Read-only diagnostic use is separated from project, network, panel, EWF, or workspace changes, which require current machine-specific authorization."
    })
  ]);

  const ZENON_ENTRY = Object.freeze({
    id: "zenon-diagviewer",
    code: "ZENON DIAGVIEWER",
    category: "HMI / Diagnostics",
    aliases: Object.freeze(["zenon", "diagviewer", "diagnosis viewer", "hmi diagnostic log", "touch screen diagnostics", "zenon service tools", "hmi log"]),
    contextHints: Object.freeze(["zenon", "hmi", "touch screen", "service", "diagnostics"]),
    title: "Use zenon DiagViewer to preserve HMI/service evidence",
    summary: "The Krones zenon service documentation includes DiagViewer as a read-only evidence path for time-stamped software/service messages. Capture the message context first, then correlate it with the PLC, network, or machine event instead of changing HMI settings from a log message alone.",
    probableCauses: Object.freeze([
      "An HMI/zenon process or module reported a diagnostic event that needs correlation with the machine symptom.",
      "A communication, project, or service-layer event may be visible in zenon even when the PLC alarm text is incomplete.",
      "The HMI symptom may be secondary to a PLC, network, panel, or project condition rather than an HMI hardware failure."
    ]),
    checks: Object.freeze([
      "Record the machine symptom and approximate event time before opening service diagnostics.",
      "Using the authorized normal service path, open DiagViewer read-only and preserve the relevant IP-address, process, data-log, thread/instruction, time-stamp, message, and module fields shown by the viewer.",
      "Start with the earliest message that aligns with the machine event and compare its process/module with the PLC alarm, communication state, or machine subsystem involved.",
      "If the evidence suggests a workspace, project, panel, network, or NET-project mismatch, compare only against the approved backup/configuration for the exact machine; archived documentation is not a source of universal network values.",
      "Treat a DiagViewer message as evidence of a software/service event, not proof that the named module, cable, controller, or HMI hardware has failed."
    ]),
    actions: Object.freeze([
      "Capture or transcribe the relevant DiagViewer evidence and keep its timestamp/module/process relationship with the machine fault chronology.",
      "Route confirmed PLC, communication, orientation, servo, or station evidence into the corresponding ServoForge troubleshooting path rather than replacing hardware from the HMI log alone.",
      "Escalate workspace/project, panel, network, EWF, or service-configuration changes to authorized controls/service personnel using the current machine backup and procedure."
    ]),
    safety: Object.freeze([OBSERVE, QUALIFIED_CONTROLS]),
    sourceRefs: Object.freeze([
      Object.freeze({ sourceId: "zenon-service-v2433", locator: "Service Tools / DiagViewer, PDF pp. 38-39" })
    ]),
    related: Object.freeze(["automation-studio-diagnostics", "schematic-navigation"]),
    evidenceLimits: Object.freeze([
      "No password, IP address, network value, project setting, or EWF state from the archived manual is promoted as a universal machine setting.",
      "DiagViewer evidence does not prove live PLC state, physical device health, network reachability, or hardware failure by itself."
    ])
  });

  const AUTOCOL_ENRICHMENT = Object.freeze({
    "orientation-trigger-can": Object.freeze({
      sourceRef: Object.freeze({ sourceId: "autocol-schematic-k747a69", locator: "K747A69 orientation interface, PDF pp. 443-445 — clock/fine-clock/revolution/container-present and COM411/CAN wiring" }),
      check: "On a verified K747A69 installation, use the matching electrical drawing to trace the source-visible clock, fine-clock, revolution-clock, container-present and CAN interface path before replacing an orientation device or changing configuration.",
      limit: "K747A69 connector/channel/address details are machine/drawing-revision specific and are not universal orientation settings."
    }),
    "orientation-image-sequence": Object.freeze({
      sourceRef: Object.freeze({ sourceId: "autocol-schematic-k747a69", locator: "K747A69 orientation hardware, PDF pp. 438-441 — orientation computer/camera CPU, framegrabber and camera cabling" }),
      check: "On a verified K747A69 installation, compare the affected camera/framegrabber cable and channel path with the matching electrical drawing before treating an image-sequence symptom as a failed camera or framegrabber.",
      limit: "K747A69 camera channels, cable identifiers, hardware references and part details apply only to the matching machine/drawing revision."
    }),
    "orientation-sync-after-encoder": Object.freeze({
      sourceRef: Object.freeze({ sourceId: "autocol-schematic-k747a69", locator: "K747A69 orientation timing interface, PDF pp. 443-445 — clock/fine-clock/revolution signal path" }),
      check: "If the machine is K747A69 and encoder/timing work preceded the symptom, trace the documented clock/fine-clock/revolution signal path in the matching schematic before changing synchronization parameters.",
      limit: "The schematic proves the K747A69 signal path, not the correct synchronization value or live timing state."
    }),
    "autocol-orientation-baseline": Object.freeze({
      sourceRef: Object.freeze({ sourceId: "autocol-schematic-k747a69", locator: "K747A69 Autocol orientation hardware/interface, PDF pp. 438-445" }),
      check: "When the installed equipment matches K747A69, use the machine-specific electrical set as the hardware/wiring baseline alongside the OEM orientation training.",
      limit: "K747A69 is one machine-specific baseline; do not apply its wiring identifiers, addresses, channels or hardware population to another Autocol without a matching drawing."
    }),
    "schematic-navigation": Object.freeze({
      sourceRef: Object.freeze({ sourceId: "autocol-schematic-k747a69", locator: "Electrical documentation / connection diagram K747A69-001 — Autocol machine-specific reference" }),
      check: "For the Columbus K747A69 Autocol, use the K747A69 electrical documentation when the equipment and drawing revision match; otherwise use the schematic assigned to the actual machine.",
      limit: "Machine-specific schematic evidence is authoritative only for the matching installed equipment and revision."
    })
  });

  function appendUnique(values, addition) {
    const rows = [...(values || [])];
    if (addition && !rows.includes(addition)) rows.push(addition);
    return Object.freeze(rows);
  }

  function appendSourceRef(values, addition) {
    const rows = [...(values || [])];
    if (addition && !rows.some((ref) => ref?.sourceId === addition.sourceId && ref?.locator === addition.locator)) rows.push(addition);
    return Object.freeze(rows.map((ref) => Object.freeze({ ...ref })));
  }

  function enrichEntry(entry, spec) {
    if (!entry || !spec) return entry;
    return Object.freeze({
      ...entry,
      checks: appendUnique(entry.checks, spec.check),
      sourceRefs: appendSourceRef(entry.sourceRefs, spec.sourceRef),
      evidenceLimits: appendUnique(entry.evidenceLimits, spec.limit)
    });
  }

  return function extendLibrary(base) {
    if (!base?.getEntry || !base?.getSource || !base?.searchEntries || !base?.searchSources || !Array.isArray(base.entries) || !Array.isArray(base.sources)) {
      throw new Error("ServoForge troubleshooting library is required before v369 source evidence.");
    }

    const sourceById = new Map(NEW_SOURCES.map((source) => [source.id, source]));
    const entryById = new Map();
    const entries = base.entries.map((entry) => {
      const enriched = enrichEntry(entry, AUTOCOL_ENRICHMENT[entry.id]);
      entryById.set(enriched.id, enriched);
      return enriched;
    });
    if (entryById.has(ZENON_ENTRY.id)) throw new Error(`v369 record duplicates existing id ${ZENON_ENTRY.id}.`);
    entries.push(ZENON_ENTRY);
    entryById.set(ZENON_ENTRY.id, ZENON_ENTRY);

    const sources = Object.freeze([...base.sources, ...NEW_SOURCES]);
    const frozenEntries = Object.freeze(entries);

    function normalize(value) {
      return typeof base.normalize === "function" ? base.normalize(value) : String(value || "").trim().toLowerCase();
    }

    function getSource(id) {
      return sourceById.get(String(id || "")) || base.getSource(id);
    }

    function getEntry(id) {
      return entryById.get(String(id || "")) || base.getEntry(id);
    }

    function zenonScore(query) {
      const q = normalize(query);
      if (!q) return 0;
      if (q === normalize(ZENON_ENTRY.id) || q === normalize(ZENON_ENTRY.code)) return 1000;
      if (ZENON_ENTRY.aliases.some((alias) => normalize(alias) === q)) return 950;
      if (normalize(ZENON_ENTRY.title).includes(q)) return 800;
      if (ZENON_ENTRY.aliases.some((alias) => normalize(alias).includes(q) || q.includes(normalize(alias)))) return 700;
      if (normalize([ZENON_ENTRY.summary, ZENON_ENTRY.category, ...ZENON_ENTRY.contextHints].join(" ")).includes(q)) return 400;
      return 0;
    }

    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const score = zenonScore(query);
      const baseHits = base.searchEntries(query, context, Math.max(count, 12)).map((hit) => {
        const replacement = entryById.get(hit?.id);
        return replacement ? { ...replacement, ...(hit.searchScore != null ? { searchScore: hit.searchScore } : {}) } : hit;
      });
      const ordered = score > 0 ? [{ ...ZENON_ENTRY, searchScore: score }, ...baseHits] : baseHits;
      const seen = new Set();
      return ordered.filter((entry) => {
        if (!entry?.id || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      }).slice(0, count);
    }

    function sourceScore(source, query) {
      const q = normalize(query);
      if (!q) return 1;
      const text = normalize([source.id, source.title, source.file, source.kind, ...(source.topics || [])].join(" "));
      let score = 0;
      if (normalize(source.id) === q || normalize(source.title) === q) score += 100;
      if (normalize(source.title).includes(q) || normalize(source.file).includes(q)) score += 40;
      for (const term of q.split(" ").filter(Boolean)) if (text.includes(term)) score += 5;
      return score;
    }

    function searchSources(query, limit = 20) {
      const count = Math.max(1, Number(limit) || 20);
      const newHits = NEW_SOURCES
        .map((source) => ({ source, score: sourceScore(source, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.source.title.localeCompare(b.source.title))
        .map((item) => item.source);
      const baseHits = base.searchSources(query, Math.max(count, 30));
      const ordered = [...newHits, ...baseHits];
      const seen = new Set();
      return ordered.filter((source) => {
        if (!source?.id || seen.has(source.id)) return false;
        seen.add(source.id);
        return true;
      }).slice(0, count);
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      for (const source of NEW_SOURCES) {
        if (base.getSource(source.id)) errors.push(`v369 source duplicates existing id ${source.id}.`);
      }
      if (!getSource("autocol-schematic-k747a69") || !getSource("zenon-service-v2433")) errors.push("v369 source registration failed.");
      if (!getEntry(ZENON_ENTRY.id)) errors.push("v369 Zenon diagnostic registration failed.");
      for (const [id, spec] of Object.entries(AUTOCOL_ENRICHMENT)) {
        const entry = getEntry(id);
        if (!entry) errors.push(`v369 expected existing entry is unavailable: ${id}.`);
        else if (!(entry.sourceRefs || []).some((ref) => ref.sourceId === spec.sourceRef.sourceId)) errors.push(`v369 source enrichment missing for ${id}.`);
      }
      for (const ref of ZENON_ENTRY.sourceRefs) if (!getSource(ref.sourceId)) errors.push(`v369 Zenon diagnostic references unknown source ${ref.sourceId}.`);
      for (const related of ZENON_ENTRY.related) if (!base.getEntry(related)) errors.push(`v369 Zenon diagnostic references unknown related record ${related}.`);
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+new-source-evidence-v369`,
      sources,
      entries: frozenEntries,
      getSource,
      getEntry,
      searchSources,
      searchEntries,
      newSourceEvidenceV369Ids: Object.freeze([ZENON_ENTRY.id]),
      newSourceEvidenceV369SourceIds: Object.freeze(NEW_SOURCES.map((source) => source.id)),
      validate
    });
  };
});
