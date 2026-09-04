"use strict";

(function installRpcDanfossGuides(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createRpcDanfossGuideExtension() {
  const OBSERVE_ONLY = "Use normal HMI/RPC diagnostic screens and read-only observations only. Do not force, bypass, or write machine logic to clear the condition.";
  const QUALIFIED_ELECTRICAL = "Energized electrical measurements and enclosure work are for qualified personnel under the approved site procedure. Use current machine schematics; archived training values are not universal acceptance limits.";
  const QUALIFIED_MAINTENANCE = "Servomotor removal, connector work, stored-energy exposure, or work around possible servo motion requires qualified maintenance, machine isolation, and the applicable LOTO/stored-energy procedure.";

  function freezeEntry(entry) {
    return Object.freeze({
      ...entry,
      aliases: Object.freeze([...(entry.aliases || [])]),
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
      id: "servo-terminal-code-600",
      code: "600",
      category: "RPC / Danfoss",
      aliases: ["terminal code 600", "power pc code 600", "rpc terminal code 600", "rpc terminal communication", "power pc master pc communication"],
      title: "RPC terminal / master PC communication absent — legacy Power PC generation",
      summary: "Archived Danfoss bottle-plate training identifies terminal Code 600 as absent communication between the RPC terminal/Power PC and the master PC. This record is generation-specific: verify that the machine actually uses the archived Power-PC RPC architecture before applying the archived procedure.",
      probableCauses: [
        "The legacy RPC terminal/Power-PC communication path to the master PC is unavailable.",
        "The observed machine may use a different controller generation, in which case the archived Code 600 procedure is not authoritative for that machine."
      ],
      checks: [
        "Confirm the displayed condition is terminal Code 600 and identify the installed RPC/controller generation before using this record.",
        "If the machine matches the archived Power-PC generation, use the approved current site/OEM communication diagnostics to determine whether the terminal-to-master communication path is available.",
        "If the symptom is instead a servo power, version, enumeration, or I/O-box communication condition, open the related existing ServoForge record rather than duplicating that diagnostic path here."
      ],
      actions: [
        "On a verified legacy Power-PC installation, follow the current approved site/OEM communication recovery procedure for that machine generation.",
        "The archived procedure describes waiting about two minutes before intervention. ServoForge preserves that only as historical procedure evidence; it is not promoted as a universal current wait requirement.",
        "Escalate when the installed controller generation or current recovery procedure cannot be confirmed from machine-specific documentation."
      ],
      safety: [OBSERVE_ONLY, QUALIFIED_ELECTRICAL],
      sourceRefs: [
        { sourceId: "danfoss-servo-bottle-plate-system", locator: "Power PC / master-PC communication and terminal Code 600 archived procedure" }
      ],
      related: ["servo-power-timeout", "io-box-communication", "servo-version", "servo-enumeration"],
      evidenceLimits: [
        "Do not publish or reuse archived IP addresses from the training source.",
        "Do not generalize machine-specific CAN/network settings to other labelers.",
        "The archived approximately two-minute wait is historical procedure evidence, not a ServoForge universal setting or current acceptance requirement."
      ]
    }),
    freezeEntry({
      id: "rpc-servomotor-replacement-guide",
      code: "RPC SERVOMOTOR REPLACEMENT",
      category: "RPC / Danfoss",
      aliases: ["servomotor replacement", "rpc servo motor replacement", "danfoss motor replacement", "replace bottle plate servo motor", "motor id after replacement"],
      title: "RPC servomotor replacement — qualified-maintenance guide",
      summary: "Archived DTS-5 training documents the maintenance sequence around RPC servomotor replacement, including use of the connector tool, motor-ID assignment after replacement, and checks for the spacer/sealing arrangement. This is a downstream maintenance guide after fault isolation, not a reason to replace a motor based on an alarm alone.",
      probableCauses: [
        "A servomotor has already been confirmed defective through the applicable fault-isolation path.",
        "A previously replaced motor requires correct RPC identification or verification of the documented spacer/sealing arrangement."
      ],
      checks: [
        "Complete the applicable servo-feedback, servo-malfunction, or servo-power-loss diagnosis before treating motor replacement as the corrective path.",
        "Confirm the exact installed motor/drive variant and obtain the current machine-specific OEM/site replacement procedure before disassembly.",
        "Verify the required connector tool and the documented spacer/seal configuration for the installed assembly before disturbing the motor connection.",
        "Plan for the motor-ID assignment/verification step documented by the DTS-5 training after replacement."
      ],
      actions: [
        "Isolate the machine and perform the replacement only under the current approved maintenance/LOTO procedure for the exact machine variant.",
        "Use the specified connector method/tool and perform the RPC motor-ID assignment or verification required by the current procedure after installation.",
        "Verify the spacer plate and sealing arrangement. The archive references sealing, grease, and thread-seal practices; use the current OEM/site specification for the exact materials, quantities, torque values, and assembly details.",
        "Recommission and verify the drive through normal RPC diagnostics before returning the station to production."
      ],
      safety: [OBSERVE_ONLY, QUALIFIED_MAINTENANCE, QUALIFIED_ELECTRICAL],
      sourceRefs: [
        { sourceId: "rpc-dts5-2011", locator: "Servomotor replacement, connector tool, motor-ID assignment, spacer/seal and sealing references" }
      ],
      related: ["servo-feedback", "servo-malfunction", "servo-power-loss", "servo-count", "servo-enumeration", "servo-version"],
      evidenceLimits: [
        "No connector-pin assignment is inferred from the training summary.",
        "No torque, firmware, replacement part number, lubricant quantity, sealant grade, or replacement specification is universalized by this record.",
        "The archived training estimate of about ten minutes is context only and is not a maintenance-time guarantee."
      ]
    }),
    freezeEntry({
      id: "rpc-power-monitoring-diagnostics",
      code: "RPC POWER MONITORING",
      category: "RPC / Danfoss",
      aliases: ["rpc power diagnostics", "dts-5 power monitoring", "dts5 monitoring board", "300 v supply diagnostics", "phase line status", "rpc can state", "rpc current temperature humidity"],
      title: "RPC/DTS-5 power and monitoring diagnostics",
      summary: "Archived DTS-5 training exposes power/monitoring evidence including the 300 V supply, line/phase status, CAN state, current, temperature, humidity, and enable-related indications. Use these screens to localize the branch of failure; do not treat archived values or mappings as machine-independent pass/fail specifications.",
      probableCauses: [
        "The RPC power/enable path may be unavailable or unhealthy.",
        "The monitored line/phase, CAN, or environmental status may indicate which machine-specific branch requires qualified follow-up."
      ],
      checks: [
        "Review the DTS-5/RPC monitoring screens read-only and capture the power-supply, line/phase, enable, and CAN status that is actually shown.",
        "Use current, temperature, and humidity indications as diagnostic evidence and compare them with the current machine/OEM limits; do not apply an archived value as a universal threshold.",
        "If the symptom matches ServoPower timeout, ServoEnable timeout, servo power loss, or I/O-box communication, continue in the related existing ServoForge record for that exact condition.",
        "When the display points toward an electrical supply or phase issue, stop at the screen-level observation unless qualified electrical troubleshooting under the current schematic/procedure is authorized."
      ],
      actions: [
        "Preserve the observed monitoring state and use it to choose the existing fault-specific diagnostic path rather than replacing components from a single screen indication.",
        "Qualified personnel may continue with the current machine electrical schematic and approved measurement procedure when screen evidence justifies electrical isolation work.",
        "Escalate if the exact line/fuse/device relationship, CAN configuration, or acceptable value cannot be verified for the installed machine."
      ],
      safety: [OBSERVE_ONLY, QUALIFIED_ELECTRICAL],
      sourceRefs: [
        { sourceId: "rpc-dts5-2011", locator: "DTS-5 power and monitoring diagnostics: 300 V supply, line/phase, CAN, current, temperature, humidity and enable indications" }
      ],
      related: ["servo-power-timeout", "servo-enable-timeout", "servo-power-loss", "io-box-communication"],
      evidenceLimits: [
        "No fuse-to-output/device mapping is inferred or universalized.",
        "No machine-specific CAN parameter is published as a universal setting.",
        "No archived IP address is reproduced.",
        "No archived current, temperature, humidity, or voltage indication is promoted as a universal ServoForge acceptance limit."
      ]
    })
  ]);

  return function extendLibrary(base) {
    if (!base?.getEntry || !base?.getSource || !base?.searchEntries || !Array.isArray(base.entries)) {
      throw new Error("ServoForge diagnostic library is required before RPC/Danfoss guide records.");
    }

    const sourceIds = new Set(["danfoss-servo-bottle-plate-system", "rpc-dts5-2011"]);
    const requiredRelated = new Set(records.flatMap((record) => record.related));
    for (const sourceId of sourceIds) {
      if (!base.getSource(sourceId)) throw new Error(`RPC/Danfoss source is unavailable: ${sourceId}`);
    }
    for (const relatedId of requiredRelated) {
      if (!base.getEntry(relatedId)) throw new Error(`RPC/Danfoss related record is unavailable: ${relatedId}`);
    }

    const recordById = new Map(records.map((record) => [record.id, record]));
    const entries = Object.freeze([...base.entries, ...records]);

    function normalize(value) {
      return typeof base.normalize === "function"
        ? base.normalize(value)
        : String(value || "").trim().toLowerCase();
    }

    function guideScore(entry, query) {
      const q = normalize(query);
      if (!q) return 0;
      const compact = q.replaceAll(" ", "");
      const code = normalize(entry.code);
      if (compact === code.replaceAll(" ", "")) return 1000;
      if (normalize(entry.id) === q) return 1000;
      if ((entry.aliases || []).some((alias) => normalize(alias) === q)) return 900;
      if (normalize(entry.title).includes(q)) return 700;
      if ((entry.aliases || []).some((alias) => normalize(alias).includes(q) || q.includes(normalize(alias)))) return 600;
      if (normalize(entry.summary).includes(q) || normalize(entry.category).includes(q)) return 300;
      return 0;
    }

    function getEntry(id) {
      return recordById.get(String(id || "")) || base.getEntry(id);
    }

    function getRpcDanfossGuide(value) {
      const q = normalize(value);
      if (!q) return null;
      return records.find((entry) => normalize(entry.id) === q || normalize(entry.code) === q || normalize(entry.title) === q) || null;
    }

    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const guideHits = records
        .map((entry) => ({ entry, score: guideScore(entry, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
      const baseHits = base.searchEntries(query, context, count);
      const exactGuide = guideHits.filter((item) => item.score >= 900).map((item) => item.entry);
      const otherGuides = guideHits.filter((item) => item.score < 900).map((item) => item.entry);
      const ordered = [...exactGuide, ...baseHits, ...otherGuides];
      const seen = new Set();
      return ordered.filter((entry) => {
        if (!entry?.id || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      }).slice(0, count);
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const ids = new Set(base.entries.map((entry) => entry.id));
      records.forEach((record) => {
        if (ids.has(record.id)) errors.push(`RPC/Danfoss record duplicates existing id ${record.id}.`);
        if (!record.title || !record.summary || !record.safety.length) errors.push(`RPC/Danfoss record ${record.id} is incomplete.`);
        record.sourceRefs.forEach((ref) => {
          if (!base.getSource(ref.sourceId)) errors.push(`RPC/Danfoss record ${record.id} references unknown source ${ref.sourceId}.`);
        });
        record.related.forEach((relatedId) => {
          if (!base.getEntry(relatedId)) errors.push(`RPC/Danfoss record ${record.id} references unknown related record ${relatedId}.`);
        });
      });
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+rpc-danfoss-guides-v359`,
      entries,
      getEntry,
      searchEntries,
      getRpcDanfossGuide,
      rpcDanfossGuideIds: Object.freeze(records.map((record) => record.id)),
      validate
    });
  };
});
