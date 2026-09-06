"use strict";

(function installUniversalTroubleshootingHandoff(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createUniversalTroubleshootingHandoff() {
  const HANDOFF_SCHEMA = "servoforge-universal-handoff-v1";

  const SAFETY = Object.freeze({
    observe: "Use read-only HMI/PLC diagnostics and normal machine observation first. Do not force outputs, defeat guards, or bypass interlocks.",
    loto: "Follow the site's lockout/tagout and stored-energy procedures before hands-on mechanical work, connector reseating, wiring work, or opening guarded areas.",
    electrical: "Energized electrical measurements are for qualified personnel under the site's approved electrical safe-work program and applicable OEM/site procedures.",
    motion: "Prevent unexpected motion before hands-on work around motors, drives, shafts, tables, starwheels, conveyors, or other moving assemblies."
  });

  const UNIVERSAL_METHODS = Object.freeze([
    Object.freeze({
      id: "universal-power-supply-isolation",
      code: "UNIVERSAL POWER SUPPLY",
      category: "Universal / Power",
      aliases: ["universal power", "universal supply", "power supply isolation"],
      contextHints: [],
      title: "Power / supply isolation",
      summary: "Determine whether the failed function is losing its required source energy, protection path, distribution path, or commanded power before replacing the end device.",
      probableCauses: [
        "The required supply is absent upstream of the affected function.",
        "A protection or distribution element is open, tripped, or not made.",
        "The command exists but the controlled power path is not completing.",
        "The load or downstream circuit is pulling the supply out of its normal state."
      ],
      checks: [
        "Define the failed function and identify what form of power or supply it requires before tracing hardware.",
        "Use normal diagnostics to compare command state, feedback state, and neighboring known-good functions.",
        "Trace from the source toward the load and identify the first point where the expected state is no longer present.",
        "Separate a missing command from a missing supply; do not treat a downstream device as failed until the upstream path is established."
      ],
      actions: [
        "Correct the first verified loss in the source/protection/distribution path, then recheck the function from a normal reset/start sequence.",
        "Use the matching machine-family schematic or OEM procedure only after the universal failure point has been narrowed to a specific circuit or device family."
      ],
      safety: [SAFETY.observe, SAFETY.loto, SAFETY.electrical],
      sourceRefs: []
    }),
    Object.freeze({
      id: "universal-safety-permissive-isolation",
      code: "UNIVERSAL SAFETY PERMISSIVE",
      category: "Universal / Safety & Permissives",
      aliases: ["universal permissive", "universal interlock", "safety permissive isolation"],
      contextHints: [],
      title: "Safety / permissive isolation",
      summary: "Identify which required ready, permissive, interlock, guard, or enable condition is withholding the function without bypassing the safety or operating-state logic.",
      probableCauses: [
        "A required safety or guard condition is not satisfied.",
        "A normal operating permissive is missing even though no direct device fault is shown.",
        "Command and feedback disagree for a supervised enable path.",
        "An upstream machine-state condition is intentionally inhibiting the function."
      ],
      checks: [
        "Start with the earliest missing ready/permissive condition shown by normal HMI or PLC diagnostics.",
        "Separate safety-chain conditions from non-safety operating permissives so the correct procedure and personnel boundary is maintained.",
        "Trace the permissive upstream until the first false condition is found; a downstream not-ready summary is not automatically the root cause.",
        "Verify the physical device/state that owns that condition rather than forcing the PLC bit to prove the path."
      ],
      actions: [
        "Restore the actual missing safe/ready condition using the approved machine procedure, then verify the permissive chain returns normally.",
        "If the condition is safety-related or the device identity is unclear, use the matching machine-family safety documentation and qualified personnel."
      ],
      safety: [SAFETY.observe, SAFETY.loto, SAFETY.electrical],
      sourceRefs: []
    }),
    Object.freeze({
      id: "universal-communication-isolation",
      code: "UNIVERSAL COMMUNICATION",
      category: "Universal / Communication",
      aliases: ["universal communication", "network isolation", "device communication isolation"],
      contextHints: [],
      title: "Communication / data-path isolation",
      summary: "Determine whether the failure is local to one device, one network segment, one producer/consumer relationship, or a broader controller/data-path loss before changing hardware or addressing.",
      probableCauses: [
        "One device is not participating on an otherwise healthy network or bus.",
        "A shared segment, module, cable, switch, gateway, or bus path is unavailable.",
        "Produced/consumed or message data is stale, missing, or not reaching the expected consumer.",
        "The apparent communication fault is secondary to missing power or an inhibited device state."
      ],
      checks: [
        "Define the communication scope: one node, one segment, one rack/module, one controller relationship, or the whole machine.",
        "Compare local device/module status with a known-good peer before changing configuration.",
        "Verify power/ready state before treating silence as a network configuration problem.",
        "Follow the data path one hop at a time and identify the first producer, transport, or consumer point that is not updating."
      ],
      actions: [
        "Restore the first verified power, physical-link, device-status, or data-transport failure and then confirm normal communication recovery.",
        "Do not copy another machine's address, node number, firmware, or network settings without verifying the installed machine documentation."
      ],
      safety: [SAFETY.observe, SAFETY.loto, SAFETY.electrical],
      sourceRefs: []
    }),
    Object.freeze({
      id: "universal-sensing-feedback-isolation",
      code: "UNIVERSAL SENSING FEEDBACK",
      category: "Universal / Sensing & Feedback",
      aliases: ["universal sensing", "universal feedback", "sensor feedback isolation"],
      contextHints: [],
      title: "Sensing / feedback isolation",
      summary: "Separate the real physical condition from sensor state, signal transport, PLC interpretation, and downstream use of that feedback.",
      probableCauses: [
        "The physical target or process state is not actually reaching the sensor's expected condition.",
        "The sensing device is not changing state reliably.",
        "The field signal changes but does not arrive correctly at the controller input/interface.",
        "The PLC sees the input but downstream logic is using a different condition, edge, debounce, or derived state."
      ],
      checks: [
        "Observe the physical condition and the corresponding device indication/input state at the same time.",
        "Compare the field indication, controller input, and derived/consumed logic state to find the first disagreement.",
        "Check repeatability across several normal cycles before treating one intermittent transition as a fixed state.",
        "If timing or position changes the result, hand off to the universal timing/synchronization method instead of adjusting the sensor blindly."
      ],
      actions: [
        "Correct the first verified physical, device, signal-path, or interpretation mismatch and retest through normal operation.",
        "Use the machine-family drawing only to identify the installed device/wiring once the failure layer is known."
      ],
      safety: [SAFETY.observe, SAFETY.loto, SAFETY.electrical],
      sourceRefs: []
    }),
    Object.freeze({
      id: "universal-timing-synchronization-isolation",
      code: "UNIVERSAL TIMING SYNC",
      category: "Universal / Timing & Synchronization",
      aliases: ["universal timing", "universal synchronization", "timing sync isolation"],
      contextHints: [],
      title: "Timing / synchronization isolation",
      summary: "Determine whether a function is wrong because the event is missing, arrives at the wrong machine position, arrives in the wrong sequence, or is evaluated with the wrong timing relationship.",
      probableCauses: [
        "A reference, trigger, encoder, clock, cam, or registration relationship changed.",
        "A timer or debounce is exposing a symptom but is not itself the root cause.",
        "The correct state occurs at the wrong point in the machine cycle.",
        "A sequence dependency is late, early, stale, or missing."
      ],
      checks: [
        "Establish the physical event that should happen and the reference event/position it should align with.",
        "Compare actual event order and state transitions using read-only diagnostics before changing offsets or timer values.",
        "Determine whether the error is constant, speed-dependent, intermittent, or introduced after encoder/timing work.",
        "If the event never occurs, return to sensing, communication, power, or permissive isolation before changing timing."
      ],
      actions: [
        "Restore the verified reference/event relationship using the approved machine-specific synchronization or setup procedure only after the failed layer is identified.",
        "Do not transfer timer presets, encoder offsets, cam positions, or synchronization values from another machine as universal settings."
      ],
      safety: [SAFETY.observe, SAFETY.motion, SAFETY.loto],
      sourceRefs: []
    }),
    Object.freeze({
      id: "universal-motion-drive-isolation",
      code: "UNIVERSAL MOTION DRIVE",
      category: "Universal / Motion & Drives",
      aliases: ["universal motion", "universal drive", "motion drive isolation"],
      contextHints: [],
      title: "Motion / drive isolation",
      summary: "Separate commanded motion, drive readiness, feedback, mechanical transmission, and actual machine movement before replacing a motor, drive, or encoder.",
      probableCauses: [
        "The motion command is not being issued because an upstream enable/permissive is missing.",
        "The drive is not ready or has its own active diagnostic state.",
        "Commanded motion exists but feedback is missing, unstable, or inconsistent.",
        "The drive/motor moves but the mechanical load or transmission does not follow correctly."
      ],
      checks: [
        "Compare command, enable/ready, actual feedback, and physical motion as separate observations.",
        "Determine whether the problem affects one axis/device or a shared group before replacing an individual component.",
        "If feedback changes but the mechanism does not follow, move to mechanical-condition isolation.",
        "If the axis is not being enabled, return to power or safety/permissive isolation before changing motion parameters."
      ],
      actions: [
        "Correct the first verified command, readiness, feedback, or mechanical-transfer failure and then recheck motion through the normal machine sequence.",
        "Use OEM drive/servo diagnostics for the installed family only after the universal failure layer has been identified."
      ],
      safety: [SAFETY.observe, SAFETY.motion, SAFETY.loto, SAFETY.electrical],
      sourceRefs: []
    }),
    Object.freeze({
      id: "universal-mechanical-condition-isolation",
      code: "UNIVERSAL MECHANICAL CONDITION",
      category: "Universal / Mechanical",
      aliases: ["universal mechanical", "mechanical condition isolation", "jam bind slip isolation"],
      contextHints: [],
      title: "Mechanical condition isolation",
      summary: "Determine whether a control fault is reporting the consequence of a bind, slip, jam, wear condition, alignment problem, lost transmission, or abnormal load.",
      probableCauses: [
        "The mechanism cannot reach the commanded position because of a jam, bind, or interference.",
        "The driven element slips or loses motion between the actuator and the load.",
        "Wear, alignment, tension, bearing, clutch, brake, belt, chain, gear, or coupling condition changes the expected movement.",
        "The control system is healthy but the physical process load is outside the mechanism's normal operating condition."
      ],
      checks: [
        "Confirm the control system is actually commanding the movement before treating the mechanism as the primary cause.",
        "Under the approved stopped/LOTO condition, inspect the complete motion path from actuator to load for binding, lost motion, interference, wear, or abnormal resistance.",
        "Compare the affected mechanism with a known-good equivalent where the machine design permits.",
        "If the mechanism moves correctly but the product/process still fails, hand off to process-condition isolation."
      ],
      actions: [
        "Correct the verified mechanical condition using the approved maintenance procedure and revalidate normal motion before returning the machine to production.",
        "Do not use increased force, speed, torque, or bypassed protection as a substitute for finding the mechanical cause."
      ],
      safety: [SAFETY.observe, SAFETY.motion, SAFETY.loto],
      sourceRefs: []
    }),
    Object.freeze({
      id: "universal-process-condition-isolation",
      code: "UNIVERSAL PROCESS CONDITION",
      category: "Universal / Process",
      aliases: ["universal process", "process condition isolation", "product process isolation"],
      contextHints: [],
      title: "Process condition isolation",
      summary: "Separate machine-control health from the product, material, pressure, vacuum, flow, label, container, conveyor, inspection, or other process condition the machine is trying to handle.",
      probableCauses: [
        "The machine is responding correctly to an abnormal product/material/process condition.",
        "A process utility or material state is outside what the mechanism expects.",
        "The product arrives at the correct station with the wrong position, spacing, condition, or quality.",
        "A downstream inspection/reject condition is reporting a process defect rather than a controller failure."
      ],
      checks: [
        "Confirm the machine command, device feedback, and mechanism are healthy before assigning the fault to the process.",
        "Compare the failing product/material condition with a known-good run without changing machine limits to make the fault disappear.",
        "Follow the process path upstream and identify the first point where the material/product condition becomes abnormal.",
        "Separate utility/material problems from sensor/timing problems when both can create the same downstream symptom."
      ],
      actions: [
        "Correct the verified upstream process/material/utility condition and then recheck the machine with normal approved settings.",
        "Use product/brand-specific setup values only from the approved local recipe or machine documentation."
      ],
      safety: [SAFETY.observe, SAFETY.loto],
      sourceRefs: []
    }),
    Object.freeze({
      id: "universal-control-sequence-isolation",
      code: "UNIVERSAL CONTROL SEQUENCE",
      category: "Universal / Control Sequence",
      aliases: ["universal control sequence", "sequence isolation", "state logic isolation"],
      contextHints: [],
      title: "Control sequence / state isolation",
      summary: "When the local PLC target does not clearly identify a physical failure mechanism, trace the sequence from request through prerequisites, state transition, output command, and feedback without treating a local tag name as the diagnosis.",
      probableCauses: [
        "The requested sequence never starts because a prerequisite is missing.",
        "The sequence starts but stalls at a state transition or expected feedback.",
        "A latched fault, reset condition, or derived state is masking the original event.",
        "The local fault target is a summary/consumer rather than the first failing producer."
      ],
      checks: [
        "Identify the request or machine action that should have occurred before the local target became active.",
        "Trace upstream dependencies and chronology to find the earliest false or abnormal condition, not merely the final fault bit.",
        "Classify that earliest condition into power, permissive, communication, sensing, timing, motion, mechanical, or process once enough evidence exists.",
        "Use timers, counters, latches, and reset paths as chronology evidence; do not assume their numeric values are universal acceptance limits."
      ],
      actions: [
        "Move into the matching universal failure-mechanism method once the earliest abnormal producer is identified.",
        "Keep all local tags, rung numbers, addresses, AFIs, timer presets, and project structure scoped to the uploaded controller."
      ],
      safety: [SAFETY.observe, SAFETY.loto, SAFETY.electrical],
      sourceRefs: []
    })
  ]);

  const UNIVERSAL_FLOW = Object.freeze({
    id: "universal-failure-mechanism-flow",
    title: "Universal fault isolation",
    category: "Universal / Failure Mechanism",
    description: "Start from the physical/control failure mechanism instead of assuming a local PLC tag or alarm number is transferable.",
    contextHints: [],
    start: "universal-start",
    nodes: Object.freeze({
      "universal-start": Object.freeze({
        question: "Which failure mechanism best matches the first verified abnormal evidence?",
        choices: Object.freeze([
          Object.freeze({ label: "Power / supply", result: "universal-power-supply-isolation" }),
          Object.freeze({ label: "Safety / permissive / interlock", result: "universal-safety-permissive-isolation" }),
          Object.freeze({ label: "Communication / data path", result: "universal-communication-isolation" }),
          Object.freeze({ label: "Sensing / feedback", result: "universal-sensing-feedback-isolation" }),
          Object.freeze({ label: "Timing / synchronization", result: "universal-timing-synchronization-isolation" }),
          Object.freeze({ label: "Motion / drive", result: "universal-motion-drive-isolation" }),
          Object.freeze({ label: "Mechanical condition", result: "universal-mechanical-condition-isolation" }),
          Object.freeze({ label: "Process / material condition", result: "universal-process-condition-isolation" }),
          Object.freeze({ label: "Not clear yet — trace the control sequence", result: "universal-control-sequence-isolation" })
        ])
      })
    })
  });

  const DOMAIN_DEFINITIONS = Object.freeze([
    Object.freeze({ id: "power-supply", label: "Power / supply", entryId: "universal-power-supply-isolation", pattern: /\b(?:power|supply|voltage|breaker|fuse|contactor|overload|current|phase|24v|dc bus|bus voltage|cb\d+|ms\d+)\b/i }),
    Object.freeze({ id: "safety-permissive", label: "Safety / permissive", entryId: "universal-safety-permissive-isolation", pattern: /\b(?:safety|guard|e-?stop|estop|interlock|permissive|ready|enable|inhibit|safe|door|gate)\b/i }),
    Object.freeze({ id: "communication", label: "Communication / data path", entryId: "universal-communication-isolation", pattern: /\b(?:msg|message|ethernet|enbt|network|comm(?:unication)?|heartbeat|produce|produced|consume|consumed|remote|can|connection|gateway|switch|node|bus)\b/i }),
    Object.freeze({ id: "sensing-feedback", label: "Sensing / feedback", entryId: "universal-sensing-feedback-isolation", pattern: /\b(?:sensor|photo\s*eye|photoeye|prox(?:imity)?|limit|feedback|detect|presence|input|switch|pe\d+|pressure switch|level switch)\b/i }),
    Object.freeze({ id: "timing-synchronization", label: "Timing / synchronization", entryId: "universal-timing-synchronization-isolation", pattern: /\b(?:timer|delay|timeout|watchdog|debounce|sync|synchron(?:ize|ized|ization)?|encoder|clock|cam|registration|trigger|phase|timing)\b/i }),
    Object.freeze({ id: "motion-drive", label: "Motion / drive", entryId: "universal-motion-drive-isolation", pattern: /\b(?:axis|servo|drive|motor|velocity|speed|position|torque|jog|kinetix|motion|vfd|frequency drive)\b/i }),
    Object.freeze({ id: "mechanical-condition", label: "Mechanical condition", entryId: "universal-mechanical-condition-isolation", pattern: /\b(?:jam|bind|binding|slip|bearing|mechanical|clutch|brake|gear|belt|chain|roller|gripper|coupling|shaft|wear|alignment)\b/i }),
    Object.freeze({ id: "process-condition", label: "Process / material condition", entryId: "universal-process-condition-isolation", pattern: /\b(?:label|bottle|container|glue|vacuum|air|pressure|level|conveyor|reject|inspection|coder|rewind|feed|transfer|product|material|flow)\b/i }),
    Object.freeze({ id: "control-sequence", label: "Control sequence / state", entryId: "universal-control-sequence-isolation", pattern: /\b(?:sequence|state|step|mode|latch|latched|reset|startstop)\b/i })
  ]);

  function normalize(base, value) {
    return typeof base?.normalize === "function"
      ? base.normalize(value)
      : String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function searchableEvidenceText(value) {
    return String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/[_./:\[\]()\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function genericEvidence(entry) {
    const overlay = entry?.uploadedPlcOverlay;
    if (!overlay) return null;
    const writers = Array.isArray(overlay.writers) ? overlay.writers : [];
    const resets = Array.isArray(overlay.resets) ? overlay.resets : [];
    const rawText = [
      overlay.target,
      ...writers.flatMap((writer) => [writer?.instruction, writer?.program, writer?.routine, ...(writer?.symbols || [])]),
      ...resets.flatMap((writer) => [writer?.instruction, writer?.program, writer?.routine, ...(writer?.symbols || [])]),
      ...(overlay.relatedTimers || []),
      ...(overlay.relatedCounters || []),
      ...(overlay.ioReferences || []),
      ...(overlay.motionReferences || []),
      ...(overlay.upstreamSymbols || [])
    ].filter(Boolean).join(" ");
    return {
      overlay,
      text: searchableEvidenceText(rawText),
      writers,
      resets,
      timerCount: (overlay.relatedTimers || []).length,
      counterCount: (overlay.relatedCounters || []).length,
      ioCount: (overlay.ioReferences || []).length,
      motionCount: (overlay.motionReferences || []).length
    };
  }

  function routeSiteEntry(entry) {
    const evidence = genericEvidence(entry);
    if (!evidence) return null;
    const scores = new Map(DOMAIN_DEFINITIONS.map((domain) => [domain.id, { ...domain, score: 0, signals: [] }]));

    function add(id, points, signal) {
      const item = scores.get(id);
      if (!item) return;
      item.score += points;
      if (signal) item.signals.push(signal);
    }

    if (evidence.timerCount) {
      add("timing-synchronization", 6, "timer reference present");
      add("control-sequence", 2, "timer reference can indicate sequence supervision");
    }
    if (evidence.counterCount) {
      add("control-sequence", 4, "counter reference present");
      add("process-condition", 2, "counter reference can track process events");
    }
    if (evidence.ioCount) add("sensing-feedback", 4, "physical I/O reference present");
    if (evidence.motionCount) add("motion-drive", 10, "motion reference present");

    const instructions = evidence.writers.concat(evidence.resets).map((writer) => String(writer?.instruction || "").toUpperCase());
    if (instructions.some((instruction) => instruction === "MSG")) add("communication", 8, "message instruction present");
    if (instructions.some((instruction) => /^(?:MAM|MAJ|MAS|MSO|MSF|MCD|MAG)$/.test(instruction))) add("motion-drive", 8, "motion instruction present");
    if (instructions.some((instruction) => /^(?:OTL|OTU|OTE|MOV|COP|CPS)$/.test(instruction))) add("control-sequence", 1, "state/output instruction present");

    for (const domain of DOMAIN_DEFINITIONS) {
      if (domain.pattern.test(evidence.text)) add(domain.id, 5, `${domain.label.toLowerCase()} terminology present`);
    }

    const ranked = [...scores.values()].sort((a, b) => b.score - a.score || DOMAIN_DEFINITIONS.findIndex((item) => item.id === a.id) - DOMAIN_DEFINITIONS.findIndex((item) => item.id === b.id));
    if (!ranked[0] || ranked[0].score <= 0) {
      add("control-sequence", 1, "no physical failure mechanism is explicit in the carried PLC evidence");
      ranked.sort((a, b) => b.score - a.score || DOMAIN_DEFINITIONS.findIndex((item) => item.id === a.id) - DOMAIN_DEFINITIONS.findIndex((item) => item.id === b.id));
    }

    function result(item) {
      return Object.freeze({
        domainId: item.id,
        label: item.label,
        entryId: item.entryId,
        score: item.score,
        confidence: item.score >= 10 ? "high" : item.score >= 6 ? "medium" : "low",
        signals: Object.freeze(unique(item.signals))
      });
    }

    const primary = result(ranked[0]);
    const alternatives = ranked
      .slice(1)
      .filter((item) => item.score >= 3 && item.score >= ranked[0].score - 5)
      .slice(0, 3)
      .map(result);

    return Object.freeze({
      schema: HANDOFF_SCHEMA,
      authority: "routing-hint-only",
      sourceEntryId: entry.id,
      sourceTarget: evidence.overlay.target || entry.code || "",
      sourceAuthority: evidence.overlay.authority || "session-site-evidence-only",
      primary,
      alternatives: Object.freeze(alternatives),
      boundary: "The carried PLC evidence only ranks a transferable failure-mechanism method. It does not change the universal library, prove root cause, or make local tags, rungs, addresses, AFIs, timer values, I/O names, or project structure transferable."
    });
  }

  return function extendLibrary(base) {
    if (!base?.entries || !base?.flows || typeof base.getEntry !== "function" || typeof base.getFlow !== "function") {
      throw new Error("ServoForge troubleshooting library is required before universal PLC handoff.");
    }

    const baseEntryIds = new Set(base.entries.map((entry) => entry?.id));
    const addedMethods = UNIVERSAL_METHODS.filter((entry) => !baseEntryIds.has(entry.id));
    const methodById = new Map(addedMethods.map((entry) => [entry.id, entry]));
    const entries = Object.freeze([...base.entries, ...addedMethods]);
    const flowExists = base.flows.some((flow) => flow?.id === UNIVERSAL_FLOW.id);
    const flows = Object.freeze(flowExists ? [...base.flows] : [...base.flows, UNIVERSAL_FLOW]);
    const baseSearch = base.searchEntries.bind(base);
    const baseGetEntry = base.getEntry.bind(base);
    const baseGetFlow = base.getFlow.bind(base);

    function getEntry(id) {
      return methodById.get(id) || baseGetEntry(id) || null;
    }

    function getFlow(id) {
      if (!flowExists && id === UNIVERSAL_FLOW.id) return UNIVERSAL_FLOW;
      return baseGetFlow(id) || null;
    }

    function methodMatches(query) {
      const q = normalize(base, query);
      const compact = q.replaceAll(" ", "");
      if (!q) return [];
      return addedMethods.filter((entry) => {
        if (normalize(base, entry.id) === q) return true;
        if (normalize(base, entry.code).replaceAll(" ", "") === compact) return true;
        if ((entry.aliases || []).some((alias) => normalize(base, alias) === q)) return true;
        return q.startsWith("universal ") && normalize(base, `${entry.code} ${entry.title} ${(entry.aliases || []).join(" ")}`).includes(q);
      });
    }

    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const universal = methodMatches(query);
      const ranked = baseSearch(query, context, Math.max(count, 8));
      if (!universal.length) return ranked.slice(0, count);
      const seen = new Set();
      return [...universal, ...ranked].filter((entry) => {
        if (!entry?.id || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      }).slice(0, count);
    }

    function recommendFlows(context = {}) {
      const current = typeof base.recommendFlows === "function" ? base.recommendFlows(context) : base.flows;
      if (current.some((flow) => flow?.id === UNIVERSAL_FLOW.id)) return current;
      return [...current, { ...UNIVERSAL_FLOW, contextScore: 0 }];
    }

    function getUniversalHandoff(entryOrId) {
      const entry = typeof entryOrId === "string" ? baseGetEntry(entryOrId) : entryOrId;
      return routeSiteEntry(entry);
    }

    function getUniversalMethod(entryId) {
      return getEntry(entryId);
    }

    function validate() {
      const current = typeof base.validate === "function" ? base.validate() : { ok: true, errors: [] };
      const errors = [...(current.errors || [])];
      const ids = new Set();
      for (const method of UNIVERSAL_METHODS) {
        if (ids.has(method.id)) errors.push(`Duplicate v372 universal method id: ${method.id}.`);
        ids.add(method.id);
        if (!method.title || !method.summary) errors.push(`Universal method ${method.id} is incomplete.`);
        if (!Array.isArray(method.safety) || !method.safety.length) errors.push(`Universal method ${method.id} has no safety boundary.`);
        if ((method.sourceRefs || []).length) errors.push(`Universal method ${method.id} must not depend on machine/site source references.`);
      }
      const flowResults = UNIVERSAL_FLOW.nodes[UNIVERSAL_FLOW.start]?.choices?.map((choice) => choice.result) || [];
      for (const id of ids) if (!flowResults.includes(id)) errors.push(`Universal method ${id} is missing from the v372 router flow.`);
      for (const entry of base.entries.filter((item) => item?.uploadedPlcOverlay)) {
        const handoff = routeSiteEntry(entry);
        if (!handoff?.primary?.entryId || !ids.has(handoff.primary.entryId)) errors.push(`Site PLC entry ${entry.id} has no valid universal handoff.`);
        if (handoff?.sourceAuthority !== "session-site-evidence-only") errors.push(`Site PLC entry ${entry.id} changed authority during universal handoff.`);
      }
      if (base.uploadedPlcOverlay?.active && base.uploadedPlcOverlay?.universalLibraryModified !== false) {
        errors.push("Universal handoff must not modify the permanent troubleshooting library.");
      }
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+universal-handoff-v372`,
      entries,
      flows,
      UNIVERSAL_HANDOFF_SCHEMA: HANDOFF_SCHEMA,
      UNIVERSAL_METHODS,
      UNIVERSAL_HANDOFF_DOMAINS: DOMAIN_DEFINITIONS,
      getEntry,
      getFlow,
      searchEntries,
      recommendFlows,
      getUniversalHandoff,
      getUniversalMethod,
      validate
    });
  };
});
