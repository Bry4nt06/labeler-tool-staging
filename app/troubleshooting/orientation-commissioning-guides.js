"use strict";

(function installOrientationCommissioningGuides(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createOrientationCommissioningExtension() {
  const OBSERVE = "Use normal HMI/RPC/DARTplus diagnostic screens and read-only observations only. Do not force, bypass, or defeat guards, safety devices, bottle-present signals, trigger signals, or orientation results.";
  const SERVO = "Any calibration, synchronization, parameter change, or motion verification must be performed by authorized qualified personnel under the current OEM/site procedure with guarding and stored-energy controls in place.";
  const LOTO = "Stop the machine and follow site lockout/tagout and stored-energy procedures before camera positioning, CPU/cabling work, mechanical measurements, or other hands-on work inside guarded or electrical areas.";
  const ELECTRICAL = "Energized electrical or network/controller diagnostics are for qualified personnel under the approved electrical/controls safe-work procedure and the current machine documentation.";

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

  const records = Object.freeze([
    freezeEntry({
      id: "orientation-high-speed-wrong-plate",
      code: "ORIENTATION RESULT TO WRONG PLATE",
      category: "Bottle Orientation",
      aliases: ["wrong bottle plate", "wrong rotary plate", "orientation fails at speed", "high speed orientation", "result timing", "correct low speed wrong plate high speed"],
      contextHints: ["autocol", "orientation", "camera", "rpc", "speed", "rotary plate"],
      title: "Orientation result reaches the wrong plate at higher speed",
      summary: "When orientation is acceptable at controlled low speed but the result is associated with the wrong rotary plate as speed increases, isolate trigger geometry, RPC table data, motor assignment, result/revolution timing and synchronization evidence before changing orientation offsets.",
      probableCauses: [
        "Distance-between-rotary-plates value differs from the approved machine baseline.",
        "RPC table-diameter value differs from the approved machine baseline.",
        "Camera motor assignment or COM-device motor-number offset is incorrect.",
        "Result-analysis or revolution-clock timing is outside the machine-approved window.",
        "RPC/table-cam synchronization is incorrect.",
        "Generation-specific communication-device or framegrabber configuration is incompatible."
      ],
      checks: [
        "Confirm the symptom is speed-dependent: verify whether the same type orients correctly at controlled low speed and is associated with a different plate as speed increases.",
        "Compare the configured distance between rotary plates and RPC table diameter with the approved machine baseline; do not copy values from archived training screenshots.",
        "Verify the bottle observed after the camera is associated with the same motor number shown in RPC camera diagnostics.",
        "Review the Container orientation COM result-position and revolution-position indicators using the current OEM procedure. Treat out-of-window evidence as a timing/configuration finding, not permission to enter archived example values.",
        "If encoder or table-cam work preceded the issue, use the existing orientation synchronization diagnostic before changing orientation offsets."
      ],
      actions: [
        "Correct only a documented mismatch against the machine-specific baseline under the approved commissioning/change-control procedure.",
        "After each approved correction, repeat the same bottle/type test at controlled low speed and then at the authorized production speed.",
        "Escalate generation-specific communication-device, software, or framegrabber changes instead of applying archived version or hardware examples."
      ],
      safety: [OBSERVE, SERVO],
      sourceRefs: [
        { sourceId: "dartplus-11-en-000-965", locator: "Basic setup and motor assignment, pp. 22-24; basic orientation problems, p. 52" }
      ],
      related: ["autocol-orientation-baseline", "orientation-inaccurate", "orientation-sync-after-encoder", "orientation-trigger-geometry-baseline", "orientation-image-sequence"],
      evidenceLimits: [
        "Archived geometry, timing, hardware, software and communication-device values are examples only and are not machine-independent settings.",
        "A speed-dependent wrong-plate symptom does not by itself prove one parameter is incorrect."
      ]
    }),
    freezeEntry({
      id: "orientation-trigger-geometry-baseline",
      code: "ORIENTATION TRIGGER GEOMETRY",
      category: "Autocol / Orientation",
      aliases: ["distance between rotary plates", "table diameter", "orientation trigger position", "result timing geometry", "orientation geometry baseline"],
      contextHints: ["autocol", "orientation", "dart", "rpc", "trigger", "geometry"],
      title: "Verify orientation trigger geometry against the machine baseline",
      summary: "DARTplus commissioning uses the distance between rotary plates in orientation triggering and the table diameter in RPC machine parameters. A mismatch can shift result timing and may become visible only as speed increases.",
      probableCauses: [
        "Distance-between-rotary-plates setting differs from the approved machine geometry.",
        "RPC table-diameter setting differs from the approved machine geometry.",
        "Bottle-present or result-transfer timing no longer matches the configured geometry.",
        "Geometry changed without the required recalibration or synchronization workflow.",
        "Motor assignment or camera COM-device offset is incorrect."
      ],
      checks: [
        "Identify the affected bottle type and whether the issue began after recipe, camera, encoder, RPC, or mechanical work.",
        "Read the distance-between-rotary-plates value in the documented DARTplus orientation-triggering screen and compare it with the approved machine baseline.",
        "Read the table-diameter value in RPC machine parameters and compare it with the approved machine baseline.",
        "Check bottle-present evidence, orientation statistics, motor assignment and result-transfer timing before changing geometry.",
        "Determine from the current OEM commissioning procedure whether the specific geometry correction requires recalibration and/or synchronization."
      ],
      actions: [
        "Do not derive geometry from an archived screenshot. Restore only a verified machine-specific value under change control.",
        "If an approved geometry correction is made, complete every required calibration/synchronization step and preserve the result using the approved backup procedure.",
        "Use the high-speed wrong-plate diagnostic when the main symptom is correct low-speed operation followed by wrong-plate association at speed."
      ],
      safety: [OBSERVE, SERVO],
      sourceRefs: [
        { sourceId: "dartplus-11-en-000-965", locator: "Basic setup, p. 22; calibration conditions, pp. 25-27; result transfer, pp. 29-30; orientation troubleshooting, p. 52" }
      ],
      related: ["orientation-high-speed-wrong-plate", "autocol-orientation-baseline", "orientation-inaccurate", "orientation-sync-after-encoder"],
      evidenceLimits: [
        "No geometry value shown in archived training is promoted as the correct value for the active machine.",
        "Geometry evidence does not prove live timing state or justify changing a production recipe without an approved baseline."
      ]
    }),
    freezeEntry({
      id: "orientation-camera-cpu-replacement",
      code: "CAMERA CPU REPLACEMENT",
      category: "Autocol / Orientation",
      aliases: ["new camera CPU", "camera CPU MAC", "DRP network subsystem", "camera replacement no communication", "orientation failed after camera cpu replacement"],
      contextHints: ["autocol", "orientation", "camera", "cpu", "network", "drp"],
      title: "Restore DRP network identity after camera CPU replacement",
      summary: "The orientation hardware training states that a replacement camera CPU has a new hardware identity that must be reflected in the DRP system settings. Archived network values are examples and must not be reused as machine settings.",
      probableCauses: [
        "Replacement camera CPU identity was not updated in DRP system settings.",
        "Configured network identity does not match the installed replacement CPU.",
        "Camera CPU replacement was not followed by the required machine-specific restore/verification procedure.",
        "A separate camera cable, framegrabber, trigger/CAN, or 24 V fault is present."
      ],
      checks: [
        "Confirm that the orientation communication or image-acquisition problem began immediately after camera CPU replacement.",
        "Obtain the installed replacement CPU identity using the approved OEM/site method; do not use the identity shown in archived training screenshots.",
        "Compare the installed CPU identity with the DRP Network subsystems configuration under the qualified controls procedure.",
        "If identity matches but image acquisition still fails, route to the existing faulty-image-sequence and trigger/CAN diagnostics."
      ],
      actions: [
        "A qualified controls technician may update the DRP network-subsystem entry to the verified replacement CPU identity under change control.",
        "Complete the machine-specific restart/restore sequence, confirm camera readiness and image acquisition, and preserve the revised configuration using the approved backup procedure.",
        "Do not publish or reuse archived IP or MAC values."
      ],
      safety: [LOTO, ELECTRICAL],
      sourceRefs: [
        { sourceId: "orientation-hardware-rpc", locator: "Replacing the camera CPU, p. 20; framegrabber status context, p. 19" },
        { sourceId: "dartplus-11-en-000-965", locator: "Data backup, pp. 49-50" }
      ],
      related: ["orientation-image-sequence", "orientation-trigger-can", "autocol-orientation-baseline"],
      evidenceLimits: [
        "Archived IP and MAC values are intentionally not reproduced as settings.",
        "Matching network identity does not prove camera power, cabling, framegrabber, trigger/CAN or software health."
      ]
    }),
    freezeEntry({
      id: "dart-embossed-bottle-commissioning",
      code: "EMBOSSED BOTTLE COMMISSIONING",
      category: "Autocol / Orientation",
      aliases: ["new embossed bottle", "learn embossing", "create orientation type", "embossing setup", "DART bottle type", "commission embossed bottle"],
      contextHints: ["autocol", "orientation", "dart", "embossing", "camera", "commissioning"],
      title: "Commission a new embossed-bottle orientation type",
      summary: "The OEM sequence creates a new labeler/DART type from a similar production type, establishes camera and bottle geometry, captures representative images, defines and learns the embossing feature, evaluates detection quality, verifies correction direction and result transfer, then preserves the completed setup.",
      probableCauses: [
        "New type was not created or selected consistently in the labeler and DART workflow.",
        "An unsuitable source production type was copied.",
        "Camera height or horizontal geometry was not established for the new bottle.",
        "Container diameter at the embossing/seam location is incorrect.",
        "Image buffer contains unsuitable, stale, or nonrepresentative images.",
        "Embossing analysis window does not isolate a repeatable target feature.",
        "Feature was not relearned after image-analysis or camera-setting changes.",
        "Correction direction/angle or result transfer was not verified."
      ],
      checks: [
        "Confirm this is an authorized new-type commissioning task and record the source production type, new type identity, bottle, aggregate and machine baseline.",
        "Confirm the new type exists and is selected in both the labeler and DARTplus before editing orientation setup.",
        "With the machine secured under the approved setup procedure, position the bottle/embossing at the camera and establish the documented physical camera relationship; record final machine-specific geometry in the type notes.",
        "Enter the measured container diameter at the embossing/seam location using the current OEM procedure.",
        "Clear the camera image buffer, capture multiple representative bottles after valid bottle-present triggers, review the images, and define an analysis section containing the target feature.",
        "Learn the embossing and evaluate the result graph for a distinct repeatable feature. Relearn after approved image-analysis or camera-setting changes when required by the procedure.",
        "Check the bottle position relative to the first labeling aggregate and verify correction direction/angle through the approved guarded test."
      ],
      actions: [
        "Start from a verified similar production type and document every type-specific change; do not copy example values from the training deck.",
        "Tune only OEM-supported settings needed to isolate a repeatable feature, one controlled change at a time, and relearn/retest after changes.",
        "Complete required calibration or synchronization when commissioning conditions or geometry changes require it.",
        "Verify orientation and result transfer with representative bottles at controlled speed, then at authorized production speed.",
        "Save the completed type and perform the approved DARTplus/zenon backup after successful verification."
      ],
      safety: [LOTO, SERVO],
      sourceRefs: [
        { sourceId: "gop-embossing-orientation", locator: "Complete embossed-bottle commissioning sequence, pp. 1-13" },
        { sourceId: "dartplus-11-en-000-965", locator: "Basic setup/calibration/new type, pp. 22-30; data backup, pp. 49-50" }
      ],
      related: ["autocol-orientation-baseline", "orientation-inaccurate", "orientation-trigger-geometry-baseline", "orientation-high-speed-wrong-plate", "orientation-image-sequence", "orientation-sync-after-encoder"],
      evidenceLimits: [
        "This is a qualified commissioning workflow, not an operator fault reset or permission to bypass bottle-present, guarding, or motion controls.",
        "Archived screenshot values are training examples and are not universal geometry, calibration, network or recipe settings."
      ]
    })
  ]);

  const recordById = new Map(records.map((record) => [record.id, record]));

  function cloneFlowWithChoices(flow, nodeId, choices) {
    if (!flow?.nodes?.[nodeId]) return flow;
    const nodes = { ...flow.nodes, [nodeId]: Object.freeze({ ...flow.nodes[nodeId], choices: Object.freeze(choices) }) };
    return Object.freeze({ ...flow, nodes: Object.freeze(nodes) });
  }

  function buildFlows(base) {
    const rows = [...base.flows];
    const bottleIndex = rows.findIndex((flow) => flow.id === "bottle-orientation-flow");
    if (bottleIndex >= 0) {
      const flow = rows[bottleIndex];
      const prior = flow.nodes[flow.start].choices || [];
      rows[bottleIndex] = cloneFlowWithChoices(flow, flow.start, [
        { label: "Correct at low speed, but result goes to the wrong plate at higher speed", result: "orientation-high-speed-wrong-plate" },
        { label: "Problem began after camera CPU replacement", result: "orientation-camera-cpu-replacement" },
        { label: "Geometry / trigger baseline may be wrong", result: "orientation-trigger-geometry-baseline" },
        { label: "Commission a new embossed bottle/type — qualified commissioning", result: "dart-embossed-bottle-commissioning" },
        ...prior
      ].map((choice) => Object.freeze({ ...choice })));
    }
    const autocolIndex = rows.findIndex((flow) => flow.id === "autocol-orientation-flow");
    if (autocolIndex >= 0) {
      const flow = rows[autocolIndex];
      const prior = flow.nodes[flow.start].choices || [];
      rows[autocolIndex] = cloneFlowWithChoices(flow, flow.start, [
        { label: "Correct at low speed, wrong plate at higher speed", result: "orientation-high-speed-wrong-plate" },
        { label: "Problem began after camera CPU replacement", result: "orientation-camera-cpu-replacement" },
        { label: "Check trigger geometry / table baseline", result: "orientation-trigger-geometry-baseline" },
        { label: "Commission a new embossed bottle/type — qualified commissioning", result: "dart-embossed-bottle-commissioning" },
        ...prior
      ].map((choice) => Object.freeze({ ...choice })));
    }
    return Object.freeze(rows);
  }

  return function extendLibrary(base) {
    if (!base?.getEntry || !base?.getFlow || !base?.getSource || !base?.searchEntries || !base?.recommendFlows || !Array.isArray(base.entries) || !Array.isArray(base.flows)) {
      throw new Error("ServoForge diagnostic library and orientation baseline are required before v367 orientation guides.");
    }

    const requiredSources = ["dartplus-11-en-000-965", "orientation-hardware-rpc", "gop-embossing-orientation"];
    const requiredRelated = ["autocol-orientation-baseline", "orientation-inaccurate", "orientation-sync-after-encoder", "orientation-image-sequence", "orientation-trigger-can"];
    requiredSources.forEach((id) => {
      if (!base.getSource(id)) throw new Error(`Orientation source is unavailable: ${id}`);
    });
    requiredRelated.forEach((id) => {
      if (!base.getEntry(id)) throw new Error(`Orientation baseline record is unavailable: ${id}`);
    });

    const entries = Object.freeze([...base.entries, ...records]);
    const flows = buildFlows(base);
    const flowById = new Map(flows.map((flow) => [flow.id, flow]));

    function normalize(value) {
      return typeof base.normalize === "function" ? base.normalize(value) : String(value || "").trim().toLowerCase();
    }

    function orientationScore(entry, query, context = {}) {
      const q = normalize(query);
      if (!q) return 0;
      const compact = q.replaceAll(" ", "");
      const code = normalize(entry.code);
      if (compact === code.replaceAll(" ", "")) return 1000;
      if (normalize(entry.id) === q) return 1000;
      if ((entry.aliases || []).some((alias) => normalize(alias) === q)) return 900;
      let score = 0;
      const text = normalize([entry.title, entry.summary, entry.category, ...(entry.aliases || []), ...(entry.probableCauses || []), ...(entry.checks || [])].join(" "));
      if (normalize(entry.title).includes(q)) score += 700;
      for (const term of q.split(" ").filter((term) => term.length > 1)) if (text.includes(term)) score += 30;
      const contextText = normalize([context.machineType, context.applicationMode, context.mapName, context.brand, context.bottle].filter(Boolean).join(" "));
      for (const hint of entry.contextHints || []) if (contextText.includes(normalize(hint))) score += 20;
      return score;
    }

    function getEntry(id) {
      return recordById.get(String(id || "")) || base.getEntry(id);
    }

    function getFlow(id) {
      return flowById.get(String(id || "")) || base.getFlow(id);
    }

    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const newHits = records
        .map((entry) => ({ entry, score: orientationScore(entry, query, context) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
      const baseHits = base.searchEntries(query, context, count);
      const ordered = [
        ...newHits.filter((item) => item.score >= 900).map((item) => item.entry),
        ...baseHits,
        ...newHits.filter((item) => item.score < 900).map((item) => item.entry)
      ];
      const seen = new Set();
      return ordered.filter((entry) => {
        if (!entry?.id || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      }).slice(0, count);
    }

    function recommendFlows(context = {}) {
      const ranked = base.recommendFlows(context);
      return ranked.map((flow) => getFlow(flow.id) || flow);
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const baseIds = new Set(base.entries.map((entry) => entry.id));
      records.forEach((record) => {
        if (baseIds.has(record.id)) errors.push(`Orientation record duplicates existing id ${record.id}.`);
        if (!record.title || !record.summary || !record.safety.length) errors.push(`Orientation record ${record.id} is incomplete.`);
        record.sourceRefs.forEach((ref) => {
          if (!base.getSource(ref.sourceId)) errors.push(`Orientation record ${record.id} references unknown source ${ref.sourceId}.`);
        });
        record.related.forEach((relatedId) => {
          if (!recordById.has(relatedId) && !base.getEntry(relatedId)) errors.push(`Orientation record ${record.id} references unknown related record ${relatedId}.`);
        });
      });
      const allEntryIds = new Set(entries.map((entry) => entry.id));
      ["bottle-orientation-flow", "autocol-orientation-flow"].forEach((flowId) => {
        const flow = getFlow(flowId);
        const node = flow?.nodes?.[flow?.start];
        if (!node) errors.push(`Orientation flow ${flowId} is unavailable.`);
        node?.choices?.forEach((choice) => {
          if (choice.result && !allEntryIds.has(choice.result)) errors.push(`Orientation flow ${flowId} points to missing result ${choice.result}.`);
        });
      });
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+orientation-v367`,
      entries,
      flows,
      getEntry,
      getFlow,
      searchEntries,
      recommendFlows,
      orientationGuideIds: Object.freeze(records.map((record) => record.id)),
      validate
    });
  };
});