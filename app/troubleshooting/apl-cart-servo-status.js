"use strict";

(function installAplCartServoStatus(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplCartServoStatusExtension() {
  return function extendLibrary(base) {
    if (!base?.getEntry || !base?.getSource || !base?.getTopModulFault || !base?.getStationFaultTemplate || !base?.getStationFaultVariant || !base?.getStationControllerTrace || !base?.searchEntries || !base?.normalize || !base?.validate || !Array.isArray(base.entries)) {
      throw new Error("Shared Station servo/circuit tracing is required before the APL Cart local servo-status bridge.");
    }

    const SOURCE_ID = "topmodul-co85-lb1-aplcart1-l5k";
    const SOURCE = base.getSource(SOURCE_ID) || base.getSource("lb1-aplcart-readable-l5k-v355");
    if (!SOURCE) throw new Error("Readable LB1 APL Cart 1 PLC source is unavailable.");

    const OBSERVE = "Use normal HMI/PLC/motion-axis/drive diagnostics only. Do not force, write, bypass, or reset axis status, Cart fault, or Cart-to-Labeler transport bits to clear a condition.";
    const LOTO = "Prevent unexpected servo motion and follow site lockout/tagout and stored-energy procedures before hands-on work on the station servo motor, drive, power circuit, feedback cable, SERCOS fiber, connectors, or guarded equipment.";
    const ELECTRICAL = "Energized electrical or signal measurements are for qualified personnel under the site's approved electrical safe-work procedure and the current machine schematic.";
    const SAFETY = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);
    const SUPPORTED = Object.freeze(Array.from({ length: 23 }, (_, index) => 32 + index));
    const INACTIVE = Object.freeze([40, 49]);
    const ACTIVE = Object.freeze(SUPPORTED.filter((number) => !INACTIVE.includes(number)));

    const code = (number) => String(number).padStart(5, "0");
    const localAddress = (number) => `Faults[${Math.floor(number / 16)}].${number % 16}`;
    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const watch = (tag, role, relationship, interpretation, caution = "") => Object.freeze({ tag, role, relationship, interpretation, caution });
    const step = (order, label, detail) => Object.freeze({ order, label, detail });
    const choice = (value, label) => Object.freeze({ value, label });
    const observe = (key, prompt, choices) => Object.freeze({ key, prompt, choices: Object.freeze(choices) });
    const result = (codeValue, severity, title, summary, next = "") => Object.freeze({ code: codeValue, severity, title, summary, next });

    function templateFor(number) {
      return base.getStationFaultTemplate(Number(number));
    }

    function traceFor(number) {
      const template = templateFor(number);
      return template?.stationControllerTrace || base.getStationControllerTrace(Number(number)) || null;
    }

    function evidenceFor(number) {
      return templateFor(number)?.stationRungEvidence || null;
    }

    function producerFor(number) {
      const trace = traceFor(number);
      const evidence = evidenceFor(number);
      if (trace?.directTriggerTag) return trace.directTriggerTag;
      if (evidence?.rootLikelihood === "disabled") return `Logic_0 -> ${trace?.localFaultAddress || localAddress(number)}`;
      return evidence?.producerSignals?.[0] || "No direct producer verified";
    }

    function namespaceBoundary(number) {
      const labeler = base.getTopModulFault(Number(number));
      if (labeler?.diagnosticScope === "Labeler" || (labeler?.number === Number(number) && !labeler?.stationTemplateOffset)) {
        return `Cart-local HMI ${code(number)} is not base Labeler Fault ${String(number).padStart(3, "0")} (${labeler.title}). The five-digit Cart code and the three-digit base-Labeler code remain separate alarm namespaces.`;
      }
      return `Cart-local HMI ${code(number)} belongs to the Station/Cart fault namespace. Do not reinterpret it as a same-number base-Labeler alarm without separate source evidence.`;
    }

    function makeEntry(number) {
      const template = templateFor(number);
      if (!template) throw new Error(`Station template ${number} is unavailable for the APL Cart servo bridge.`);
      const trace = traceFor(number);
      const evidence = evidenceFor(number);
      const active = Boolean(trace?.directTriggerTag) && evidence?.rootLikelihood !== "disabled";
      const producer = producerFor(number);
      const title = template.title;
      const summary = active
        ? `Cart-local HMI ${code(number)} is the ${title} position for LB1 APL Cart 1. The readable Cart source binds ${producer} directly to ${trace.localFaultAddress}. ServoForge reuses the existing shared Station servo/circuit method for hardware isolation instead of cloning that logic. ${namespaceBoundary(number)}`
        : `Cart-local HMI ${code(number)} exists in the alarm table as ${title}, but ${trace?.localFaultAddress || localAddress(number)} is driven by Logic_0 in the supplied Cart 1 revision. It remains searchable as an inactive source position and is not promoted to an active servo diagnosis. ${namespaceBoundary(number)}`;
      return Object.freeze({
        id: `apl-cart-${code(number)}`,
        code: code(number),
        number,
        category: "APL Cart / Servo Axis",
        aliases: Object.freeze([
          `fault ${number}`,
          `apl cart ${number}`,
          `cart local ${String(number).padStart(3, "0")}`,
          title,
          ...(trace?.directTriggerTag ? [trace.directTriggerTag] : [])
        ]),
        title,
        summary,
        probableCauses: active
          ? Object.freeze([
              `${producer} is active in the Cart motion-axis diagnostics.`,
              "The corresponding station servo hardware path may be involved only after the direct status is confirmed and alarm chronology is preserved.",
              "Another servo/status fault may have occurred first; do not replace hardware from the summary name alone."
            ])
          : Object.freeze(["No active producer is implemented for this alarm position in the supplied Cart 1 revision; a live occurrence requires controller/revision verification before diagnosis."]),
        checks: active
          ? Object.freeze([
              `Capture ${producer}, ${trace.localFaultAddress}, and the affected Station number before reset.`,
              "Review preceding Station servo faults so the first direct status is not hidden by a later summary or companion alarm.",
              "Use the existing shared Station servo circuit trace for motor-feedback, power, drive, or SERCOS hardware only after the direct status is confirmed."
            ])
          : Object.freeze([
              `Verify the live controller revision if ${code(number)} is actually displayed.`,
              `Do not assign a MainDriveAxis producer while the supplied source keeps ${trace?.localFaultAddress || localAddress(number)} on Logic_0.`
            ]),
        actions: active
          ? Object.freeze(["Correct only the drive, feedback, power, motor, SERCOS, or related condition supported by the direct axis status and the existing station circuit trace, then verify normal guarded operation."])
          : Object.freeze(["Do not troubleshoot this source position as an active Cart 1 servo fault until another readable controller revision proves an executable producer."]),
        safety: SAFETY,
        sourceRefs: Object.freeze([
          { sourceId: SOURCE_ID, locator: `${trace?.localFaultAddress || localAddress(number)} — local Fault ${String(number).padStart(3, "0")}${trace?.directTriggerTag ? `; direct trigger ${trace.directTriggerTag}` : "; inactive Logic_0 placeholder in Cart 1"}` }
        ]),
        contextHints: Object.freeze(["apl", "cart", "labeling station", "servo axis", "main drive axis"])
      });
    }

    const LOCAL_ENTRIES = Object.freeze(SUPPORTED.map(makeEntry));
    const LOCAL_BY_ID = new Map(LOCAL_ENTRIES.map((entry) => [entry.id, entry]));
    const LOCAL_BY_NUMBER = new Map(LOCAL_ENTRIES.map((entry) => [entry.number, entry]));
    const entries = Object.freeze([...base.entries, ...LOCAL_ENTRIES]);

    function stationGlobalMap(number) {
      return Object.freeze(Array.from({ length: 6 }, (_, index) => {
        const station = index + 1;
        const variant = base.getStationFaultVariant(number, station);
        const stationTrace = base.getStationControllerTrace(number, station);
        return Object.freeze({
          station,
          globalNumber: Number(variant?.number),
          globalCode: variant?.code || "",
          globalAddress: variant?.plcFault?.address || stationTrace?.labelerFaultAddress || "",
          entryId: variant?.id || "",
          title: variant?.title || "",
          labelerCopy: stationTrace?.labelerCopy || ""
        });
      }));
    }

    function buildPlan(number) {
      const n = Number(number);
      const entry = LOCAL_BY_NUMBER.get(n);
      if (!entry) return null;
      const template = templateFor(n);
      const trace = traceFor(n);
      const evidence = evidenceFor(n);
      const active = Boolean(trace?.directTriggerTag) && evidence?.rootLikelihood !== "disabled";
      const producer = producerFor(n);
      const circuitTrace = active ? template?.circuitTrace || null : null;
      const watchPoints = active
        ? freezeRows([
            watch(producer, "Direct Cart servo status", `The readable Cart 1 source binds this status directly to ${trace.localFaultAddress}.`, "If this status is active, it is stronger evidence than the generic alarm title. Preserve which direct status appeared first."),
            watch(trace.localFaultAddress, "Cart-local fault bit", `Local Fault ${String(n).padStart(3, "0")} is packed through ${trace.cartDataWord} into the Labeler station fault block.`, "Capture the local bit and affected Station before reset.", "Do not force the fault bit or transport word."),
            watch(evidence?.logicType || "direct-controller-status", "Source logic classification", "The shared Station cause model classifies this as a source-backed direct controller status.", "Use the existing circuitTrace as the hardware authority; do not create a second hardware route from the local HMI label.")
          ])
        : freezeRows([
            watch("Logic_0", "Inactive source driver", `${trace?.localFaultAddress || localAddress(n)} is driven by Logic_0 in Cart 1.`, "This source position is disabled/inactive in the supplied revision.", "A live occurrence must be verified against the actual controller revision before assigning a cause."),
            watch(trace?.localFaultAddress || localAddress(n), "Cart-local fault position", `The HMI/catalog position exists but has no active MainDriveAxis producer in this source revision.`, "Keep it searchable without promoting a hardware diagnosis.")
          ]);
      const steps = active
        ? freezeRows([
            step(1, "Confirm the Cart-local identity", `Treat ${code(n)} as local Station/Cart fault ${String(n).padStart(3, "0")}, not a same-number base-Labeler code.`),
            step(2, "Read the direct producer", `Capture ${producer} in normal motion-axis diagnostics before reset or hardware replacement.`),
            step(3, "Preserve first-fault chronology", "Compare the surrounding 032-054 servo statuses and the Station alarm history. Work from the earliest direct producer rather than the latest summary."),
            step(4, "Use the shared circuit route", circuitTrace ? "Follow the already-verified Station servo circuitTrace for the specific status family; this local bridge does not invent a second hardware path." : "No separate hardware route is added by this local bridge.")
          ])
        : freezeRows([
            step(1, "Preserve the displayed code", `${code(n)} is a real alarm-table position.`),
            step(2, "Keep the source gap visible", `${trace?.localFaultAddress || localAddress(n)} is an inactive Logic_0 placeholder in this Cart 1 revision.`),
            step(3, "Verify another revision before diagnosis", "If the machine displays this code, obtain the live/readable project or matching revision before publishing a producer or hardware route.")
          ]);
      return Object.freeze({
        id: entry.id,
        number: n,
        code: entry.code,
        title: entry.title,
        scope: "LB1 APL Cart 1 / Cart-local HMI servo-axis fault",
        family: entry.title,
        status: active ? "source-proven-direct-servo-status" : "inactive-logic0-source-position",
        producer,
        localAddress: trace?.localFaultAddress || localAddress(n),
        cartDataWord: trace?.cartDataWord || "",
        source: SOURCE,
        sourceRefs: Object.freeze([...(entry.sourceRefs || []).map((ref) => ref.locator)]),
        evidence,
        sharedStationTemplateId: template?.id || `topmodul-station-template-${n}`,
        stationGlobalMap: stationGlobalMap(n),
        circuitTrace,
        watchPoints,
        steps,
        observations: active
          ? Object.freeze([observe("producerActive", `${producer} observed active?`, [choice("yes", "Yes / active"), choice("no", "No / clear"), choice("unknown", "Not verified")])])
          : Object.freeze([]),
        safety: SAFETY,
        namespaceBoundary: namespaceBoundary(n)
      });
    }

    function resolveNumber(value) {
      if (typeof value === "object" && value) {
        if (LOCAL_BY_ID.has(value.id)) return Number(value.number);
        if (LOCAL_BY_NUMBER.has(Number(value.number)) && String(value.code || "") === code(Number(value.number))) return Number(value.number);
      }
      if (Number.isInteger(value) && LOCAL_BY_NUMBER.has(Number(value))) return Number(value);
      const text = String(value || "").trim();
      const idMatch = /^apl-cart-000(3[2-9]|4\d|5[0-4])$/i.exec(text);
      if (idMatch) return Number(idMatch[1]);
      const exactCode = /^000(3[2-9]|4\d|5[0-4])$/.exec(text);
      if (exactCode) return Number(exactCode[1]);
      const embedded = /\b000(3[2-9]|4\d|5[0-4])\b/.exec(text);
      return embedded ? Number(embedded[1]) : null;
    }

    function getAplCartServoStatusPlan(value) {
      const number = resolveNumber(value);
      return number == null ? null : buildPlan(number);
    }

    function evaluateAplCartServoStatus(value, observation = {}) {
      const plan = getAplCartServoStatusPlan(value);
      if (!plan) return null;
      if (plan.status === "inactive-logic0-source-position") {
        return result("inactive-source-position", "hold", "Inactive in supplied Cart 1 revision", `${plan.localAddress} is driven by Logic_0 in the supplied source. Do not assign a servo hardware cause from this alarm-table position.`, "Verify the live controller/revision if the code is actually displayed.");
      }
      const observed = String(observation.producerActive || "unknown");
      if (observed === "yes") {
        return result("direct-producer-active", "direct", "Direct Cart servo status is active", `${plan.producer} is the source-backed direct producer for ${plan.code}. Preserve chronology and follow the existing Station servo circuit route for this exact status family.`, "Localize the hardware path supported by the shared circuitTrace; do not replace parts from the alarm name alone.");
      }
      if (observed === "no") {
        return result("producer-clear", "hold", "Direct producer is clear at capture", `${plan.producer} is not active now. Preserve alarm history and check whether another direct 032-054 status occurred first or whether the condition cleared before inspection.`, "Do not force the status to reproduce the fault.");
      }
      return result("capture-producer", "observe", "Capture the direct producer", `Read ${plan.producer} in normal motion-axis diagnostics before choosing a hardware path.`, "Record the affected Station and surrounding alarm chronology at the same time.");
    }

    function getEntry(id) {
      return LOCAL_BY_ID.get(String(id || "")) || base.getEntry(id);
    }

    function localTextMatch(entry, normalizedQuery) {
      const fields = [entry.title, ...(entry.aliases || [])].map((value) => base.normalize(value));
      return fields.some((value) => value.includes(normalizedQuery));
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const text = String(query || "").trim();
      const normalized = base.normalize(text);
      const exactLocal = LOCAL_ENTRIES.filter((entry) => entry.code === text || base.normalize(entry.id) === normalized);
      const numericOnly = /^\d+$/.test(text);
      const localText = normalized && !numericOnly ? LOCAL_ENTRIES.filter((entry) => localTextMatch(entry, normalized)) : [];
      const baseMatches = base.searchEntries(query, context, Math.max(requested, 12));
      const seen = new Set();
      return [...exactLocal, ...localText, ...baseMatches]
        .filter((entry) => {
          if (!entry?.id || seen.has(entry.id)) return false;
          seen.add(entry.id);
          return true;
        })
        .slice(0, requested);
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      if (!/CO85_LB1_APLCart_1\.L5K$/i.test(String(SOURCE.file || ""))) errors.push("v362 lost the readable LB1 APL Cart 1 source.");
      if (LOCAL_ENTRIES.length !== 23 || ACTIVE.length !== 21 || INACTIVE.join(",") !== "40,49") errors.push("v362 APL Cart servo-status coverage count changed.");
      for (const number of SUPPORTED) {
        const entry = getEntry(`apl-cart-${code(number)}`);
        const plan = buildPlan(number);
        const template = templateFor(number);
        const trace = traceFor(number);
        if (!entry || entry.code !== code(number)) errors.push(`APL Cart ${code(number)} local entry is missing.`);
        if (!plan || plan.localAddress !== localAddress(number)) errors.push(`APL Cart ${code(number)} lost its local Faults address.`);
        if (plan?.stationGlobalMap?.length !== 6) errors.push(`APL Cart ${code(number)} lost six-station transport mapping.`);
        if (INACTIVE.includes(number)) {
          if (plan?.status !== "inactive-logic0-source-position" || !/Logic_0/.test(plan?.producer || "")) errors.push(`APL Cart ${code(number)} must remain an inactive Logic_0 source position.`);
          if (plan?.circuitTrace) errors.push(`APL Cart ${code(number)} must not gain an active servo circuit trace.`);
        } else {
          if (!trace?.directTriggerTag || plan?.producer !== trace.directTriggerTag) errors.push(`APL Cart ${code(number)} lost its direct MainDriveAxis producer.`);
          if (!template?.circuitTrace || plan?.circuitTrace !== template.circuitTrace) errors.push(`APL Cart ${code(number)} must reuse the shared Station servo circuit trace.`);
        }
      }
      const plan32 = buildPlan(32);
      if (searchEntries("00032", { machineType: "TopModul", applicationMode: "apl" }, 3)[0]?.id !== "apl-cart-00032") errors.push("Exact local HMI 00032 no longer resolves to the Cart-local servo entry first.");
      if (base.getTopModulFault(32)?.title !== "Door Closed - Push Reset") errors.push("Base Labeler Fault 032 separation was lost.");
      if (plan32?.stationGlobalMap?.map((row) => row.globalNumber).join(",") !== "1056,1136,1216,1296,1376,1456") errors.push("APL Cart 00032 lost its six global Station destinations.");
      if (!buildPlan(45)?.circuitTrace?.deviceRows?.some((row) => row.cable === "2001-W121")) errors.push("APL Cart 00045 lost W121 motor-feedback evidence.");
      if (buildPlan(45)?.circuitTrace?.deviceRows?.some((row) => row.cable === "2001-W131")) errors.push("APL Cart 00045 must not borrow base-machine encoder W131.");
      if (!buildPlan(52)?.circuitTrace?.deviceRows?.some((row) => /F101/.test(row.device || ""))) errors.push("APL Cart 00052 lost station servo phase/power evidence.");
      if (!buildPlan(53)?.circuitTrace?.deviceRows?.some((row) => /COM081/.test(row.device || ""))) errors.push("APL Cart 00053 lost SERCOS hardware evidence.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+apl-cart-servo-status-v362`,
      entries,
      getEntry,
      searchEntries,
      getAplCartServoStatusPlan,
      evaluateAplCartServoStatus,
      aplCartServoStatusFaults: SUPPORTED,
      aplCartServoStatusActiveFaults: ACTIVE,
      aplCartServoStatusInactiveFaults: INACTIVE,
      validate
    });
  };
});
