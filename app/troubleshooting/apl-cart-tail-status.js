"use strict";

(function installAplCartTailStatus(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplCartTailStatusExtension() {
  return function extendLibrary(base) {
    if (!base?.getEntry || !base?.getSource || !base?.getTopModulFault || !base?.getStationFaultTemplate || !base?.getStationFaultVariant || !base?.getStationControllerTrace || !base?.searchEntries || !base?.normalize || !base?.validate || !Array.isArray(base.entries)) {
      throw new Error("Shared Station process/encoder tracing is required before the APL Cart tail-status bridge.");
    }

    const SOURCE_ID = "topmodul-co85-lb1-aplcart1-l5k";
    const SOURCE = base.getSource(SOURCE_ID) || base.getSource("lb1-aplcart-readable-l5k-v355");
    if (!SOURCE) throw new Error("Readable LB1 APL Cart 1 PLC source is unavailable.");

    const OBSERVE = "Use normal HMI/PLC/motion-axis diagnostics only. Do not force, write, bypass, or reset Cart fault, encoder status, timer, transport, or sensor bits to clear a condition.";
    const LOTO = "Follow site lockout/tagout and stored-energy requirements before hands-on work on rewind components, encoder hardware, connectors, wiring, or guarded equipment.";
    const ELECTRICAL = "Energized electrical or signal measurements are for qualified personnel under the site's approved electrical safe-work procedure and current machine schematic.";
    const SAFETY = Object.freeze([OBSERVE, LOTO, ELECTRICAL]);

    const SUPPORTED = Object.freeze([60, 64, 65, 66, 67, 68, 69, 74]);
    const NEW_ENTRY_NUMBERS = Object.freeze([60, 64, 65, 66, 68, 69, 74]);
    const ENCODER_NUMBERS = Object.freeze([64, 65, 66, 67, 68, 69]);
    const code = (number) => String(number).padStart(5, "0");
    const localAddress = (number) => `Faults[${Math.floor(number / 16)}].${number % 16}`;
    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));

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

    function namespaceBoundary(number) {
      if (number === 67) return "Cart-local 00067 is the same local Station feedback-fault position already represented by the existing field-observed 00067 workflow. v363 does not create a duplicate 00067 entry; it adds Cart-local PLC/circuit context to that existing authority.";
      const baseLabeler = base.getTopModulFault(Number(number));
      if (baseLabeler?.diagnosticScope === "Labeler" || (baseLabeler?.number === Number(number) && !baseLabeler?.stationTemplateOffset)) {
        return `Cart-local ${code(number)} is not base Labeler Fault ${String(number).padStart(3, "0")} (${baseLabeler.title}). Five-digit Cart-local and three-digit base-Labeler namespaces remain separate.`;
      }
      return `Cart-local ${code(number)} belongs to the APL Station/Cart namespace; do not reinterpret it as a same-number base-Labeler alarm without separate source evidence.`;
    }

    function sourceState(number) {
      const template = templateFor(number);
      const trace = traceFor(number);
      const evidence = evidenceFor(number);
      if (number === 74) {
        return Object.freeze({
          status: "catalog-only-no-producer",
          producer: "No executable producer for Faults[4].10 was located in the supplied readable Cart 1 export.",
          circuitTrace: null,
          logicType: evidence?.logicType || "catalog-only",
          sourceRefs: Object.freeze(["Station alarm table: 074 Height Adjustment / Circuit Breaker Tripped", "Cart 1 cause audit: alarm-table-only; no executable local producer located"])
        });
      }
      if (number === 60) {
        return Object.freeze({
          status: "source-proven-timed-rewind-full",
          producer: "ParLS_Actual.Par1[30] + E5701_PE603_DiameterRewindUnit / I0005.18 -> DiameterSensorTimer.DN -> Faults[3].12",
          circuitTrace: template?.circuitTrace || null,
          logicType: evidence?.logicType || "timed-latched",
          sourceRefs: Object.freeze(["Cart 1 Fault 060 rung evidence: rewind-full enable, PE603 diameter input, DiameterSensorTimer.DN", "K605163-001: PE603 / 5701-W603 rewind-unit circuit"])
        });
      }
      const direct = trace?.directTriggerTag;
      return Object.freeze({
        status: number === 67 ? "source-proven-existing-00067-authority" : "source-proven-direct-encoder-status",
        producer: direct || evidence?.producerSignals?.[0] || "No direct producer verified",
        circuitTrace: template?.circuitTrace || null,
        logicType: evidence?.logicType || "direct-controller-status",
        sourceRefs: Object.freeze([
          `${trace?.localFaultAddress || localAddress(number)} — local Fault ${String(number).padStart(3, "0")}${direct ? `; direct trigger ${direct}` : ""}`,
          "K605163-001: I/O071 1756-M02AE Slot 11 Channel 0 / CN131 / 2001-W131 AQB feedback path"
        ])
      });
    }

    function makeEntry(number) {
      const template = templateFor(number);
      if (!template) throw new Error(`Station template ${number} is unavailable for the APL Cart tail bridge.`);
      const source = sourceState(number);
      const summary = source.status === "catalog-only-no-producer"
        ? `Cart-local ${code(number)} exists in the supplied Station alarm table as ${template.title}, but no executable producer for ${localAddress(number)} was located in the readable Cart 1 source. ServoForge keeps the alarm searchable without inventing a height-adjustment breaker rung. ${namespaceBoundary(number)}`
        : `Cart-local ${code(number)} is ${template.title}. ${source.producer} is the source-backed Cart 1 producer/state chain. ServoForge reuses the existing shared Station process/encoder circuit authority instead of cloning hardware logic. ${namespaceBoundary(number)}`;
      return Object.freeze({
        id: `apl-cart-${code(number)}`,
        code: code(number),
        number,
        category: number === 60 ? "APL Cart / Rewind" : number === 74 ? "APL Cart / Source Gap" : "APL Cart / Base Machine Encoder",
        aliases: Object.freeze([`fault ${number}`, `apl cart ${number}`, `cart local ${String(number).padStart(3, "0")}`, template.title, ...(source.producer && !source.producer.startsWith("No executable") ? [source.producer] : [])]),
        contextHints: Object.freeze(["apl", "cart", "labeling station", number === 60 ? "rewind" : number === 74 ? "height adjustment" : "encoder"]),
        title: template.title,
        summary,
        probableCauses: source.status === "catalog-only-no-producer"
          ? Object.freeze(["The supplied Cart 1 source does not prove an executable producer for this alarm position; a live occurrence requires controller/revision verification before assigning a cause."])
          : Object.freeze(["Start with the source-backed producer/state and preserve alarm chronology before replacing hardware."]),
        checks: source.status === "catalog-only-no-producer"
          ? Object.freeze([`If ${code(number)} is displayed live, capture the controller/project revision and the actual alarm state before diagnosis.`, `Do not assign a breaker, input, or rung to ${localAddress(number)} until a readable matching revision proves it.`])
          : Object.freeze([`Capture ${source.producer} and ${traceFor(number)?.localFaultAddress || localAddress(number)} before reset.`, "Use the existing shared Station circuit trace only after the direct/timed source evidence is confirmed."]),
        actions: source.status === "catalog-only-no-producer"
          ? Object.freeze(["Obtain the matching readable controller revision before publishing a producer or hardware route."])
          : Object.freeze(["Correct only the rewind, encoder module, feedback, synchronization, or related condition supported by the source-backed state and shared circuit trace, then verify normal guarded operation."]),
        safety: SAFETY,
        sourceRefs: Object.freeze([{ sourceId: SOURCE_ID, locator: source.sourceRefs[0] }])
      });
    }

    const LOCAL_ENTRIES = Object.freeze(NEW_ENTRY_NUMBERS.map(makeEntry));
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
          title: variant?.title || ""
        });
      }));
    }

    function resolveNumber(value) {
      if (typeof value === "object" && value) {
        const n = Number(value.number);
        if (SUPPORTED.includes(n) && (String(value.code || "") === code(n) || n === 67)) return n;
      }
      if (Number.isInteger(value) && SUPPORTED.includes(Number(value))) return Number(value);
      const text = String(value || "").trim();
      const idMatch = /^apl-cart-(00060|0006[4-9]|00074)$/i.exec(text);
      if (idMatch) return Number(idMatch[1]);
      const exact = /^(00060|0006[4-9]|00074)$/.exec(text);
      if (exact) return Number(exact[1]);
      const embedded = /\b(00060|0006[4-9]|00074)\b/.exec(text);
      return embedded ? Number(embedded[1]) : null;
    }

    function getAplCartTailPlan(value) {
      const number = resolveNumber(value);
      if (number == null) return null;
      const template = templateFor(number);
      if (!template) return null;
      const source = sourceState(number);
      const trace = traceFor(number);
      const local = LOCAL_BY_NUMBER.get(number);
      return Object.freeze({
        id: local?.id || "topmodul-00067-labeler-encoder-feedback",
        number,
        code: code(number),
        title: template.title,
        scope: "LB1 APL Cart 1 / Cart-local HMI fault",
        family: number === 60 ? "Rewind-full supervision" : number === 74 ? "Unresolved height-adjustment alarm position" : "Base-machine encoder module/feedback status",
        status: source.status,
        producer: source.producer,
        localAddress: trace?.localFaultAddress || localAddress(number),
        cartDataWord: trace?.cartDataWord || "",
        source: SOURCE,
        sourceRefs: source.sourceRefs,
        circuitTrace: source.circuitTrace,
        sharedStationTemplateId: template.id || `topmodul-station-template-${number}`,
        stationGlobalMap: stationGlobalMap(number),
        namespaceBoundary: namespaceBoundary(number),
        watchPoints: source.status === "catalog-only-no-producer" ? freezeRows([
          { tag: localAddress(number), role: "Catalog-assigned local position", relationship: "Alarm text exists, but no executable writer was located in the supplied Cart 1 source.", interpretation: "Preserve the live alarm/revision if observed; do not invent the height-adjustment breaker input.", caution: "Producer unresolved in this source revision." }
        ]) : number === 60 ? freezeRows([
          { tag: "ParLS_Actual.Par1[30]", role: "Rewind-full monitoring enable", relationship: "The Cart logic uses the active parameter-set state to enable rewind-full supervision.", interpretation: "Verify the current approved recipe state without changing it.", caution: "Recipe values are machine-specific evidence, not adjustment recommendations." },
          { tag: "E5701_PE603_DiameterRewindUnit / I0005.18", role: "Rewind diameter input", relationship: "PE603 is the physical rewind-full sensor path shown on K605163-001.", interpretation: "Compare raw input state with actual rewind diameter/sensor target condition before adjustment." },
          { tag: "DiameterSensorTimer.DN / Faults[3].12", role: "Timed fault latch", relationship: "A sustained monitored PE603 condition reaches the timer-done state and latches Fault 060.", interpretation: "Preserve timer/fault chronology before reset.", caution: "No timer preset is generalized here; use the live source revision." }
        ]) : freezeRows([
          { tag: source.producer, role: "Direct base-machine encoder status", relationship: `The readable Cart source binds this status directly to ${trace?.localFaultAddress || localAddress(number)}.`, interpretation: "If active, this direct status is stronger evidence than the generic alarm title; preserve which encoder status appeared first." },
          { tag: "EEP_APL_Slot11:Ch0 / 1756-M02AE", role: "Feedback-only AQB module/channel", relationship: "The shared Station encoder circuit binds BaseMachineEncoderAxis to Slot 11 Channel 0.", interpretation: "Use module/status meaning first, then the W131/CN131 feedback path when the status implicates signal integrity." },
          { tag: "CN131 / 2001-W131", role: "AQB feedback path", relationship: "K605163-001 carries CHA/CHB/CHZ through W131 to the feedback-only module.", interpretation: "This is separate from Cart Fault 030 OPTO131 clock-monitor logic and main Labeler Fault 670 fine-clock logic.", caution: "Do not collapse these encoder namespaces." }
        ]),
        steps: source.status === "catalog-only-no-producer" ? freezeRows([
          { order: 1, label: "Preserve the exact code", detail: `${code(number)} is source-backed as an alarm-table position.` },
          { order: 2, label: "Keep the producer gap visible", detail: `No executable writer for ${localAddress(number)} was found in the readable Cart 1 source.` },
          { order: 3, label: "Verify the live revision", detail: "Obtain the matching readable project or rung/tag evidence before publishing a breaker/input diagnosis." }
        ]) : freezeRows([
          { order: 1, label: "Confirm Cart-local identity", detail: `Treat ${code(number)} as local Station/Cart Fault ${String(number).padStart(3, "0")}; preserve the affected Station and alarm chronology.` },
          { order: 2, label: "Read the source-backed state", detail: `Capture ${source.producer} before reset or hardware replacement.` },
          { order: 3, label: "Use the shared hardware authority", detail: source.circuitTrace ? "Follow the existing K605163-backed Station circuit trace for the exact status family; v363 does not create a competing hardware route." : "No separate hardware route is promoted." }
        ]),
        safety: SAFETY
      });
    }

    function evaluateAplCartTail(value, observation = {}) {
      const plan = getAplCartTailPlan(value);
      if (!plan) return null;
      if (plan.status === "catalog-only-no-producer") return Object.freeze({ code: "source-gap", severity: "hold", title: "Producer unresolved in supplied Cart 1 source", summary: `${plan.code} is real alarm-table evidence, but no executable producer is proven for ${plan.localAddress}.`, next: "Verify the live controller/revision before assigning a breaker or input cause." });
      const observed = String(observation.producerActive || "unknown");
      if (observed === "yes") return Object.freeze({ code: "producer-active", severity: "direct", title: "Source-backed producer/state is active", summary: `${plan.producer} supports ${plan.code}. Preserve chronology and use the shared circuit route for this exact family.`, next: "Localize only the hardware/process path supported by the live evidence." });
      if (observed === "no") return Object.freeze({ code: "producer-clear", severity: "hold", title: "Producer/state is clear at capture", summary: `${plan.producer} is not active now. The condition may have cleared or another related alarm may have occurred first.`, next: "Use alarm history; do not force the state to reproduce the fault." });
      return Object.freeze({ code: "capture", severity: "observe", title: "Capture the source-backed state", summary: `Read ${plan.producer} in normal diagnostics before choosing a hardware path.`, next: "Record the affected Station and first-fault chronology at the same time." });
    }

    function getEntry(id) {
      return LOCAL_BY_ID.get(String(id || "")) || base.getEntry(id);
    }

    function entryText(entry) {
      return base.normalize([entry.code, entry.title, entry.summary, entry.category, ...(entry.aliases || [])].join(" "));
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const normalized = base.normalize(query);
      const localMatches = LOCAL_ENTRIES
        .map((entry) => {
          const text = entryText(entry);
          let searchScore = 0;
          if (String(entry.code) === String(query || "").trim()) searchScore += 300;
          if (normalized && text.includes(normalized)) searchScore += 60;
          for (const term of normalized.split(" ").filter((term) => term.length > 1)) if (text.includes(term)) searchScore += 8;
          return { ...entry, searchScore };
        })
        .filter((entry) => entry.searchScore > 0);
      const combined = [...localMatches, ...base.searchEntries(query, context, requested + LOCAL_ENTRIES.length)];
      const seen = new Set();
      return combined
        .sort((a, b) => Number(b.searchScore || 0) - Number(a.searchScore || 0))
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
      for (const number of SUPPORTED) {
        const plan = getAplCartTailPlan(number);
        if (!plan) errors.push(`APL Cart tail Fault ${code(number)} has no plan.`);
      }
      for (const number of [64, 65, 66, 67, 68, 69]) {
        const plan = getAplCartTailPlan(number);
        if (!/BaseMachineEncoderAxis\./.test(plan?.producer || "")) errors.push(`APL Cart encoder Fault ${code(number)} lost its direct BaseMachineEncoderAxis producer.`);
        if (!plan?.circuitTrace?.deviceRows?.some((row) => String(row.device).includes("1756-M02AE"))) errors.push(`APL Cart encoder Fault ${code(number)} lost Slot 11 feedback-module authority.`);
      }
      const rewind = getAplCartTailPlan(60);
      if (!/PE603/.test(rewind?.producer || "") || !/DiameterSensorTimer\.DN/.test(rewind?.producer || "")) errors.push("APL Cart Fault 00060 lost PE603/timer producer evidence.");
      if (!rewind?.circuitTrace?.deviceRows?.some((row) => row.device === "PE603")) errors.push("APL Cart Fault 00060 lost K605163 PE603 circuit authority.");
      const height = getAplCartTailPlan(74);
      if (height?.status !== "catalog-only-no-producer") errors.push("APL Cart Fault 00074 must remain catalog-only without an invented producer.");
      if (LOCAL_BY_ID.has("apl-cart-00067")) errors.push("v363 must not duplicate the existing field/source-backed 00067 entry.");
      const existing67 = base.getEntry("topmodul-00067-labeler-encoder-feedback");
      if (!existing67) errors.push("Existing field-observed 00067 authority is missing.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+apl-cart-tail-v363`,
      entries,
      getEntry,
      searchEntries,
      aplCartTailFaults: SUPPORTED,
      aplCartTailNewEntryNumbers: NEW_ENTRY_NUMBERS,
      aplCartTailEncoderNumbers: ENCODER_NUMBERS,
      getAplCartTailPlan,
      evaluateAplCartTail,
      validate
    });
  };
});
