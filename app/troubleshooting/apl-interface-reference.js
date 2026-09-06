"use strict";

(function installAplInterfaceReference(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplInterfaceReferenceExtension() {
  const OBSERVE = "Use normal HMI and read-only PLC/drive diagnostics first. Do not force, bypass, jumper, or defeat emergency-stop, guard, docking, servo-ready, contactor-feedback, or aggregate-present signals.";
  const LOTO = "Stop the machine and follow site lockout/tagout and stored-energy procedures before touching Harting connectors, connector covers, servo wiring, guard devices, docking hardware, or contactor circuits.";
  const ELECTRICAL = "Energized electrical diagnostics are for qualified personnel under the approved electrical safe-work procedure and the current machine-specific schematic/revision.";
  const DRAWING_LIMIT = "K605576 is an archived 2005/2006 APL Cart drawing. Connector sections, device designations, page references, and raw I/O shown here are drawing-specific evidence and must be verified against the active machine drawing/revision before use.";

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function freezeEntry(entry) {
    return Object.freeze({
      ...entry,
      aliases: Object.freeze([...(entry.aliases || [])]),
      contextHints: Object.freeze([...(entry.contextHints || [])]),
      probableCauses: Object.freeze([...(entry.probableCauses || [])]),
      checks: Object.freeze([...(entry.checks || [])]),
      actions: Object.freeze([...(entry.actions || [])]),
      safety: Object.freeze([...(entry.safety || [])]),
      sourceRefs: Object.freeze((entry.sourceRefs || []).map((ref) => Object.freeze({ ...ref }))),
      related: Object.freeze([...(entry.related || [])]),
      evidenceLimits: Object.freeze([...(entry.evidenceLimits || [])])
    });
  }

  function freezeSource(source) {
    return Object.freeze({
      ...source,
      topics: Object.freeze([...(source.topics || [])])
    });
  }

  const SOURCE_PATCHES = Object.freeze({
    "apl-contactor-figure-2": Object.freeze({
      title: "APL Servo-Drive Guard Safety Switch Reference",
      topics: Object.freeze(["APL", "main contactor", "servo drive guard", "safety switch", "PLC monitoring"]),
      notes: "Archived field figure showing the APL servo-drive guard safety switch: one contact participates in the main-power contactor path and a second contact is used for PLC monitoring. Verify the active machine circuit before tracing."
    }),
    "apl-contactor-figure-3": Object.freeze({
      title: "APL Aggregate Functions / Change Labeling Station HMI Reference",
      topics: Object.freeze(["APL", "HMI", "aggregate functions", "change labeling station", "contactor off", "Harting disconnect sequence"]),
      notes: "Archived HMI field figure for the Aggregate Functions / Change Labeling Station sequence. Treat it as historical procedure evidence; current site/OEM isolation requirements govern any connector work."
    }),
    "apl-contactor-figure-4": Object.freeze({
      title: "APL Machine-Base Harting Connector / Cover Reference",
      topics: Object.freeze(["APL", "Harting", "machine base", "connector cover", "absent aggregate", "safety continuity"]),
      notes: "Archived field figure showing machine-base aggregate Harting connectors and OEM connector covers used when an aggregate is absent. It is not authority to fabricate or add jumpers."
    }),
    "apl-contactor-figure-5": Object.freeze({
      title: "APL Harting Connector Section Map",
      topics: Object.freeze(["APL", "Harting", "connector sections", "emergency stop", "guard door", "digital signals", "aggregate power"]),
      notes: "Archived high-level Harting section map: safety contacts in both directions, digital signals in both directions, spare section, and aggregate power. Section roles are reference only until the active machine drawing is verified."
    })
  });

  function correctedSource(source) {
    const patch = SOURCE_PATCHES[source?.id];
    return patch ? freezeSource({ ...source, ...patch }) : source;
  }

  function replaceLocator(ref, locatorBySource) {
    const locator = locatorBySource[ref.sourceId];
    return locator ? { ...ref, locator } : { ...ref };
  }

  function appendSourceRefs(refs, additions) {
    const rows = (refs || []).map((ref) => ({ ...ref }));
    for (const addition of additions) {
      if (!rows.some((ref) => ref.sourceId === addition.sourceId && ref.locator === addition.locator)) rows.push({ ...addition });
    }
    return rows;
  }

  function buildMainContactor(baseEntry) {
    if (!baseEntry) return null;
    let sourceRefs = (baseEntry.sourceRefs || []).map((ref) => replaceLocator(ref, {
      "apl-contactor-figure-2": "Servo-drive guard safety switch: contactor-path contact plus separate PLC-monitoring contact",
      "apl-contactor-figure-3": "Aggregate Functions / Change Labeling Station HMI contactor-off sequence",
      "apl-contactor-figure-4": "Machine-base Harting connectors and OEM connector-cover reference",
      "apl-schematic-605576": "K605576 p.47 — C101 main-contactor / servo-drive hardware path and I0005.22 check-back"
    }));
    sourceRefs = appendSourceRefs(sourceRefs, [
      { sourceId: "apl-contactor-figure-5", locator: "Harting connector A-F high-level section map" }
    ]);
    return freezeEntry({
      ...baseEntry,
      checks: unique([
        ...(baseEntry.checks || []),
        "After the Cart 00005 PLC producer has been isolated, and only when K605576 matches the active machine/revision, use p.47 to trace the C101 hardware path from O0007.11 through the documented LS143 / CR204 / servo-drive chain to C101 and its I0005.22 check-back. Do not infer the failed device from the Main Contactor message alone."
      ]),
      actions: unique([
        ...(baseEntry.actions || []),
        "Keep PLC producer isolation and hardware tracing separate: use the existing Cart 00005 source plan first, then the matching schematic/interface reference for the physical chain."
      ]),
      sourceRefs,
      related: unique([...(baseEntry.related || []), "apl-aggregate-interface-reference"]),
      evidenceLimits: unique([...(baseEntry.evidenceLimits || []), DRAWING_LIMIT])
    });
  }

  function buildAggregateConnection(baseEntry) {
    if (!baseEntry) return null;
    let sourceRefs = (baseEntry.sourceRefs || []).map((ref) => replaceLocator(ref, {
      "apl-main-contactor-remedy": "Main Contactor Faults — Harting, guard, docking and servo-connection checks",
      "apl-schematic-605576": "K605576 pp.15-16 — CN131/CN101 interface architecture and machine-top location of LS164 coupled/docking and LS143"
    }));
    sourceRefs = appendSourceRefs(sourceRefs, [
      { sourceId: "apl-contactor-figure-4", locator: "Machine-base Harting connectors and approved OEM connector covers" },
      { sourceId: "apl-contactor-figure-5", locator: "Harting connector high-level section roles" }
    ]);
    return freezeEntry({
      ...baseEntry,
      aliases: unique([...(baseEntry.aliases || []), "LS164", "coupled docking switch", "CN101", "CN131"]),
      checks: unique([
        ...(baseEntry.checks || []),
        "If K605576 matches the active machine/revision, use p.15 to distinguish the CN131 Ethernet/control interface from the CN101 control/safety/power interface, and p.16 to locate LS164 coupled/docking and LS143 before tracing farther.",
        "For a Main Machine E-Stop feedback symptom, route to the existing Cart 00001 source plan before using K605576 p.42 for the CN101 / CR202 / CR204 hardware bridge."
      ]),
      actions: unique([
        ...(baseEntry.actions || []),
        "Use the APL aggregate interface reference when the symptom has been isolated to docking, Harting, guard/safety continuity, or the interface between the Cart and labeling station."
      ]),
      sourceRefs,
      related: unique([...(baseEntry.related || []), "apl-aggregate-interface-reference"]),
      evidenceLimits: unique([...(baseEntry.evidenceLimits || []), DRAWING_LIMIT])
    });
  }

  function buildRewind(baseEntry) {
    if (!baseEntry) return null;
    return freezeEntry({
      ...baseEntry,
      sourceRefs: appendSourceRefs(baseEntry.sourceRefs, [
        { sourceId: "apl-schematic-605576", locator: "K605576 p.52 — rewind-unit MTR601 / ready / command-and-feedback reference" }
      ]),
      related: unique([...(baseEntry.related || []), "apl-aggregate-interface-reference"]),
      evidenceLimits: unique([...(baseEntry.evidenceLimits || []), DRAWING_LIMIT])
    });
  }

  const INTERFACE_REFERENCE = freezeEntry({
    id: "apl-aggregate-interface-reference",
    code: "APL AGGREGATE INTERFACE REFERENCE",
    category: "APL / Aggregate",
    aliases: [
      "apl connector reference",
      "aggregate interface",
      "harting sections",
      "harting connector sections",
      "CN101",
      "CN131",
      "LS164",
      "docking coupled switch",
      "connector cover",
      "aggregate connector cover",
      "apl safety interface"
    ],
    contextHints: ["apl", "aggregate", "harting", "docking", "topmodul"],
    title: "Trace the APL aggregate interface without duplicating the existing fault procedures",
    summary: "Use this drawing-specific bridge after the fault has been isolated to the APL Cart / labeling-station interface. It maps the archived K605576 connector families, docking/coupled device location, E-stop handoff and main-contactor hardware bridge to the existing ServoForge APL diagnostics; it is not a universal pinout or a reset/bypass procedure.",
    probableCauses: [
      "The wrong interface family is being traced: CN131 and CN101 serve different functions in K605576.",
      "The aggregate is not fully coupled or the LS164 docking/coupled state is not made on the matching machine design.",
      "A guard or emergency-stop continuity condition exists across the aggregate interface.",
      "The C101 contactor hardware chain is open even though the PLC command path has already been isolated.",
      "An approved connector cover is missing, incorrect, damaged, or not seated for the machine configuration.",
      "The active machine/revision does not match the archived K605576 reference."
    ],
    checks: [
      "Identify the exact machine, Cart/station, active alarm and drawing revision before opening the interface reference. Preserve first-fault chronology and use the existing fault-specific source plan first when one exists.",
      "On a verified K605576 match, p.15 separates CN131 (Ethernet/control interface) from CN101 (control/safety/power interface). Use the functional section map only to choose the correct circuit family; do not treat archived pin details as universal.",
      "On a verified K605576 match, p.16 locates LS164 as the coupled/docking safety device and also shows LS143 in the aggregate area. Compare the observed state with the applicable existing docking/guard diagnostic before touching hardware.",
      "For Cart 00001 / Main Machine E-Stop feedback, keep the v364 PLC producer authoritative, then use K605576 p.42 only as the matching hardware bridge through CN101 to CR202 direct and CR204 delayed feedback.",
      "For Cart 00005 / Main Contactor Faulted, keep the v355 PLC producer and 1500 ms monitor authoritative, then use K605576 p.47 only as the matching C101 hardware bridge, including O0007.11 and I0005.22 evidence.",
      "Use the archived field figures by their actual content: Figure 2 servo-drive guard switch, Figure 3 Aggregate Functions / Change Labeling Station HMI sequence, Figure 4 machine-base Harting connectors/OEM covers, and Figure 5 the high-level Harting section map."
    ],
    actions: [
      "Route a main-contactor symptom back to the existing APL MAIN CONTACTOR and Cart 00005 diagnostics; route an E-stop feedback symptom to Cart 00001; route a docking/Harting symptom to the existing APL aggregate connection path; route rewind/servo evidence to the existing rewind/servo path.",
      "Use only the approved connector/cover and current OEM/site procedure for the active machine configuration. Never fabricate, add, or substitute a jumper to recreate safety continuity.",
      "If the active machine drawing/revision cannot be confirmed, stop at the functional interface boundary and obtain the correct schematic before assigning connector sections, device numbers, raw I/O, or power paths."
    ],
    safety: [OBSERVE, LOTO, ELECTRICAL],
    sourceRefs: [
      { sourceId: "apl-schematic-605576", locator: "K605576 p.15 — CN131/CN101 interface architecture; p.16 — machine-top device locations; p.42 — CN101 E-stop/CR202/CR204 bridge; p.47 — C101 main-contactor/servo-drive bridge" },
      { sourceId: "apl-contactor-figure-2", locator: "Servo-drive guard safety switch reference" },
      { sourceId: "apl-contactor-figure-3", locator: "Aggregate Functions / Change Labeling Station HMI reference" },
      { sourceId: "apl-contactor-figure-4", locator: "Machine-base Harting connectors and OEM connector covers" },
      { sourceId: "apl-contactor-figure-5", locator: "Harting connector A-F high-level section map" }
    ],
    related: ["apl-main-contactor", "apl-aggregate-connection", "apl-rewind-servo-binding", "apl-cart-00001", "apl-cart-00005"],
    evidenceLimits: [
      DRAWING_LIMIT,
      "The archived Harting figure describes high-level section functions. It is intentionally not reproduced as a universal pin-level assignment.",
      "The OEM connector-cover image is evidence of an engineered machine configuration, not permission to install or improvise safety jumpers.",
      "A connector, LS164, LS143, CR202, CR204, C101 or raw-I/O designation is not assumed to apply to another machine generation without a matching drawing."
    ]
  });

  function localScore(entry, query, context = {}) {
    const normalize = typeof context.normalize === "function" ? context.normalize : (value) => String(value || "").trim().toLowerCase();
    const q = normalize(query);
    if (!q) return 0;
    const fields = [entry.id, entry.code, entry.title, ...(entry.aliases || [])].map(normalize).filter(Boolean);
    if (fields.includes(q)) return 1200;
    if (fields.some((field) => field.includes(q) || q.includes(field))) return 950;
    const tokens = q.split(/\s+/).filter(Boolean);
    const haystack = normalize([entry.code, entry.title, entry.summary, ...(entry.aliases || []), ...(entry.contextHints || [])].join(" "));
    if (tokens.length && tokens.every((token) => haystack.includes(token))) return 650;
    return 0;
  }

  return function extendLibrary(base) {
    if (!base || !Array.isArray(base.entries) || !Array.isArray(base.sources)) throw new Error("ServoForge troubleshooting base library is required.");
    if (String(base.version || "").includes("apl-interface-v368")) return base;

    const mainContactor = buildMainContactor(base.getEntry("apl-main-contactor"));
    const aggregateConnection = buildAggregateConnection(base.getEntry("apl-aggregate-connection"));
    const rewind = buildRewind(base.getEntry("apl-rewind-servo-binding"));
    const replacements = new Map([
      [mainContactor?.id, mainContactor],
      [aggregateConnection?.id, aggregateConnection],
      [rewind?.id, rewind]
    ].filter(([id, entry]) => id && entry));

    const entries = Object.freeze([
      ...base.entries.map((entry) => replacements.get(entry.id) || entry),
      INTERFACE_REFERENCE
    ]);

    const correctedSources = new Map();
    const sources = Object.freeze(base.sources.map((source) => {
      const corrected = correctedSource(source);
      if (corrected !== source) correctedSources.set(corrected.id, corrected);
      return corrected;
    }));

    function normalize(value) {
      return typeof base.normalize === "function" ? base.normalize(value) : String(value || "").trim().toLowerCase();
    }

    function getEntry(id) {
      const key = String(id || "");
      if (key === INTERFACE_REFERENCE.id) return INTERFACE_REFERENCE;
      return replacements.get(key) || base.getEntry(id);
    }

    function getSource(id) {
      return correctedSources.get(String(id || "")) || base.getSource(id);
    }

    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const score = localScore(INTERFACE_REFERENCE, query, { ...context, normalize });
      const baseHits = base.searchEntries(query, context, count).map((entry) => replacements.get(entry.id) || entry);
      const ordered = score >= 900 ? [INTERFACE_REFERENCE, ...baseHits] : score > 0 ? [...baseHits, INTERFACE_REFERENCE] : baseHits;
      const seen = new Set();
      return ordered.filter((entry) => entry && !seen.has(entry.id) && seen.add(entry.id)).slice(0, count);
    }

    function searchSources(query, limit = 10) {
      const count = Math.max(1, Number(limit) || 10);
      const q = normalize(query);
      const baseHits = base.searchSources(query, Math.max(count, base.sources.length)).map((source) => correctedSources.get(source.id) || source);
      if (!q) return baseHits.slice(0, count);
      const localHits = [...correctedSources.values()].filter((source) => {
        const haystack = normalize([source.id, source.title, source.file, source.notes, ...(source.topics || [])].join(" "));
        return haystack.includes(q) || q.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
      });
      const seen = new Set();
      return [...localHits, ...baseHits].filter((source) => source && !seen.has(source.id) && seen.add(source.id)).slice(0, count);
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      if (entries.length !== base.entries.length + 1) errors.push("v368 must add exactly one interface-reference entry.");
      if (!getEntry(INTERFACE_REFERENCE.id)) errors.push("v368 APL aggregate interface reference is missing.");
      if (!/CN101/.test(JSON.stringify(getEntry(INTERFACE_REFERENCE.id))) || !/CN131/.test(JSON.stringify(getEntry(INTERFACE_REFERENCE.id))) || !/LS164/.test(JSON.stringify(getEntry(INTERFACE_REFERENCE.id)))) errors.push("v368 interface reference lost CN101/CN131/LS164 routing evidence.");
      if (!/2005\/2006/.test(JSON.stringify(getEntry(INTERFACE_REFERENCE.id))) || !/drawing\/revision/i.test(JSON.stringify(getEntry(INTERFACE_REFERENCE.id)))) errors.push("v368 interface reference lost drawing-specific applicability boundary.");
      if (!/servo-drive guard/i.test(getSource("apl-contactor-figure-2")?.title || "")) errors.push("Figure 2 metadata must identify the servo-drive guard safety switch.");
      if (!/Aggregate Functions/i.test(getSource("apl-contactor-figure-3")?.title || "")) errors.push("Figure 3 metadata must identify the Aggregate Functions HMI reference.");
      if (!/Harting Connector \/ Cover/i.test(getSource("apl-contactor-figure-4")?.title || "")) errors.push("Figure 4 metadata must identify the machine-base Harting connector/cover reference.");
      if (!/Section Map/i.test(getSource("apl-contactor-figure-5")?.title || "")) errors.push("Figure 5 metadata must identify the Harting section map.");
      if (!/p\.47/.test(JSON.stringify(getEntry("apl-main-contactor"))) || !/I0005\.22/.test(JSON.stringify(getEntry("apl-main-contactor")))) errors.push("APL main-contactor entry lost the K605576 p.47 hardware bridge.");
      if (!/LS164/.test(JSON.stringify(getEntry("apl-aggregate-connection"))) || !/pp\.15-16/.test(JSON.stringify(getEntry("apl-aggregate-connection")))) errors.push("APL aggregate-connection entry lost the K605576 docking/interface bridge.");
      if (typeof base.getAplCartFoundationPlan === "function") {
        const fault5 = base.getAplCartFoundationPlan(5);
        if (!/1500/.test(fault5?.producer || "") || !/I0005\.22/.test(JSON.stringify(fault5 || {}))) errors.push("v368 must not replace Cart 00005 PLC producer authority.");
      }
      if (typeof base.getAplCartCorePlan === "function") {
        const fault1 = base.getAplCartCorePlan(1);
        if (!/CR202/.test(fault1?.producer || "") || !/CR204/.test(fault1?.producer || "")) errors.push("v368 must not replace Cart 00001 PLC producer authority.");
      }
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+apl-interface-v368`,
      entries,
      sources,
      getEntry,
      getSource,
      searchEntries,
      searchSources,
      aplInterfaceReferenceId: INTERFACE_REFERENCE.id,
      getAplInterfaceReference() { return INTERFACE_REFERENCE; },
      validate
    });
  };
});